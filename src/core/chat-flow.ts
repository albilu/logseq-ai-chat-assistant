import type { ContextMode, ModelConfig } from "./types";
import type { ChatMessage, LLMProvider } from "../providers/llm/interface";
import type { ResolvedPage } from "../services/logseq-service";
import {
  STREAMING_MARKER_FRAMES,
  STREAMING_MARKER_TEXT,
  shouldReduceStreamingMotion
} from "../ui/streaming-indicator";

type PriorTurn = {
  user: string;
  assistant: string;
};

type BuildMessagesContext = {
  contextMode: ContextMode;
  priorTurns?: PriorTurn[];
  fullPageContext?: string;
};

type RunChatFlowInput = {
  mode: "ask" | "summarize";
  contextMode: ContextMode;
  promptSourceText: string;
  replyTargetBlockUuid: string | null;
  targetPage: ResolvedPage;
  priorTurns: PriorTurn[];
  fullPageContext?: string;
  model: ModelConfig;
  llmProvider: LLMProvider;
  logseqService: {
    appendUserTurnToCurrentPage(prompt: string, page: ResolvedPage): Promise<{ pageUuid: string; userBlockUuid: string }>;
    createAssistantPlaceholder(parentUuid: string): Promise<{ uuid: string }>;
    replaceBlockContent(blockUuid: string, content: string, role: "user" | "assistant"): Promise<unknown>;
    finalizeBlock(blockUuid: string, content: string): Promise<unknown>;
    markInterrupted(blockUuid: string, content: string): Promise<unknown>;
    appendErrorBlock(parentUuid: string, error: string, hint: string): Promise<unknown>;
  };
};

const STREAMING_INDICATOR_INTERVAL_MS = 300;

function startStreamingIndicatorLoop(
  blockUuid: string,
  logseqService: RunChatFlowInput["logseqService"]
) {
  if (shouldReduceStreamingMotion()) {
    const pendingWrite = (async () => {
      try {
        await logseqService.replaceBlockContent(blockUuid, STREAMING_MARKER_TEXT, "assistant");
      } catch {
        // ignore indicator failures and allow chat flow to continue
      }
    })();

    return async () => {
      await pendingWrite;
    };
  }

  const frames = STREAMING_MARKER_FRAMES;

  let cancelled = false;
  let frameIndex = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingWrite = Promise.resolve();

  const scheduleNextFrame = () => {
    if (cancelled) {
      return;
    }

    timeoutId = setTimeout(() => {
      pendingWrite = (async () => {
        if (cancelled) {
          return;
        }

        try {
          await logseqService.replaceBlockContent(blockUuid, frames[frameIndex], "assistant");
        } catch {
          cancelled = true;
          return;
        }

        frameIndex = (frameIndex + 1) % frames.length;

        if (!cancelled) {
          scheduleNextFrame();
        }
      })();
    }, STREAMING_INDICATOR_INTERVAL_MS);
  };

  scheduleNextFrame();

  return async () => {
    cancelled = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    await pendingWrite;
  };
}

export async function runChatFlow(input: RunChatFlowInput) {
  let content = "";
  let parentUuid: string | null = null;
  let assistantBlockUuid: string | null = null;
  let hasReceivedFirstChunk = false;
  const isSourceReply = Boolean(input.replyTargetBlockUuid);
  let stopStreamingIndicator = async () => {};
  let queuedChunkWrite = Promise.resolve();
  let latestChunkWrite = Promise.resolve();

  try {
    parentUuid = input.replyTargetBlockUuid
      ?? (await input.logseqService.appendUserTurnToCurrentPage(input.promptSourceText, input.targetPage)).userBlockUuid;

    assistantBlockUuid = (await input.logseqService.createAssistantPlaceholder(parentUuid)).uuid;
    stopStreamingIndicator = startStreamingIndicatorLoop(assistantBlockUuid, input.logseqService);

    await input.llmProvider.streamChat(
      buildMessages(input.mode, input.model.systemPrompt, input.promptSourceText, {
        contextMode: input.contextMode,
        priorTurns: input.priorTurns,
        fullPageContext: input.fullPageContext
      }),
      (chunk) => {
        latestChunkWrite = queuedChunkWrite.then(async () => {
          const shouldStopStreamingIndicator = !hasReceivedFirstChunk;

          if (shouldStopStreamingIndicator) {
            hasReceivedFirstChunk = true;
            await stopStreamingIndicator();
          }

          content += chunk;
          await input.logseqService.replaceBlockContent(assistantBlockUuid, content, "assistant");
        });
        queuedChunkWrite = latestChunkWrite.catch(() => {});

        return latestChunkWrite;
      }
    );

    await latestChunkWrite;
    await stopStreamingIndicator();
    await input.logseqService.finalizeBlock(assistantBlockUuid, content);
  } catch (error) {
    if (isSourceReply && !assistantBlockUuid) {
      throw error;
    }

    if (assistantBlockUuid) {
      await latestChunkWrite.catch(() => {});
      await stopStreamingIndicator();

      if (content) {
        await input.logseqService.markInterrupted(assistantBlockUuid, content);
      } else {
        await input.logseqService.finalizeBlock(assistantBlockUuid, content);
      }
    }

    if (!parentUuid) {
      throw error;
    }

    await input.logseqService.appendErrorBlock(
      parentUuid,
      getErrorMessage(error),
      "Retry Ask AI after fixing the provider connection."
    );
  }
}

export function buildMessages(
  mode: "ask" | "summarize",
  systemPrompt: string,
  promptSourceText: string,
  context: BuildMessagesContext
): ChatMessage[] {
  if (mode === "summarize") {
    return [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Summarize the following Logseq block content:\n\n${promptSourceText}`
      }
    ];
  }

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  const fullPageContext = context.fullPageContext?.trim();

  if (context.contextMode === "full-page" && fullPageContext) {
    messages.push({
      role: "user",
      content: `Use this page context as reference when answering.\n\n${fullPageContext}`
    });
  }

  const priorTurns = context.contextMode === "last-exchange"
    ? context.priorTurns?.slice(-1) ?? []
    : context.contextMode === "ai-history"
      ? context.priorTurns ?? []
      : [];

  for (const turn of priorTurns) {
    messages.push(
      { role: "user", content: turn.user },
      { role: "assistant", content: turn.assistant }
    );
  }

  messages.push({ role: "user", content: promptSourceText });

  return messages;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export type { RunChatFlowInput };
