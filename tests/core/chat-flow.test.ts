import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/ui/streaming-indicator", async () => {
  const actual = await vi.importActual<typeof import("../../src/ui/streaming-indicator")>("../../src/ui/streaming-indicator");

  return {
    ...actual,
    shouldReduceStreamingMotion: vi.fn(() => false)
  };
});

import type { RunChatFlowInput } from "../../src/core/chat-flow";
import { buildMessages, runChatFlow } from "../../src/core/chat-flow";
import {
  getStreamingMarkerFrames,
  getStreamingMarkerText,
  shouldReduceStreamingMotion
} from "../../src/ui/streaming-indicator";

type HasRequiredReplyTarget = RunChatFlowInput extends { replyTargetBlockUuid: string | null } ? true : false;
const replyTargetBlockUuidIsRequired: HasRequiredReplyTarget = true;
void replyTargetBlockUuidIsRequired;

const mockLogseqService: RunChatFlowInput["logseqService"] = {
  appendUserTurnToCurrentPage: vi.fn().mockResolvedValue({ pageUuid: "page-id", userBlockUuid: "user-id" }),
  createAssistantPlaceholder: vi.fn().mockResolvedValue({ uuid: "assistant-id" }),
  replaceBlockContent: vi.fn().mockResolvedValue(undefined),
  finalizeBlock: vi.fn().mockResolvedValue(undefined),
  markInterrupted: vi.fn().mockResolvedValue(undefined),
  appendErrorBlock: vi.fn().mockResolvedValue({ uuid: "error-id" })
};

const baseInput = {
  mode: "ask" as const,
  promptSourceText: "Explain backlinks",
  replyTargetBlockUuid: null,
  targetPage: { uuid: "page-id", name: "Page" },
  model: {
    name: "chat",
    providerId: "local",
    modelId: "llama3",
    systemPrompt: "You are helpful"
  },
  contextMode: "last-exchange" as const,
  priorTurns: [],
  logseqService: mockLogseqService
};

describe("buildMessages", () => {
  it("builds messages with only the latest prior exchange for last-exchange mode", () => {
    expect(
      buildMessages("ask", "You are helpful", "New prompt", {
        contextMode: "last-exchange",
        priorTurns: [
          { user: "Earlier", assistant: "Answer one" },
          { user: "Latest", assistant: "Answer two" }
        ]
      })
    ).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Latest" },
      { role: "assistant", content: "Answer two" },
      { role: "user", content: "New prompt" }
    ]);
  });

  it("includes all prior turns for ai-history mode", () => {
    expect(
      buildMessages("ask", "You are helpful", "New prompt", {
        contextMode: "ai-history",
        priorTurns: [{ user: "Earlier", assistant: "Answer one" }]
      })
    ).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Earlier" },
      { role: "assistant", content: "Answer one" },
      { role: "user", content: "New prompt" }
    ]);
  });

  it("wraps serialized page content for full-page mode", () => {
    expect(
      buildMessages("ask", "You are helpful", "New prompt", {
        contextMode: "full-page",
        fullPageContext: "Title: Project Notes\nHeading\n  Child"
      })
    ).toEqual([
      { role: "system", content: "You are helpful" },
      {
        role: "user",
        content: expect.stringMatching(/Use this page context as reference[\s\S]*Title: Project Notes\nHeading\n  Child/)
      },
      { role: "user", content: "New prompt" }
    ]);
  });

  it("does not add a synthetic full-page wrapper when full-page context is blank", () => {
    expect(
      buildMessages("ask", "You are helpful", "New prompt", {
        contextMode: "full-page",
        fullPageContext: "   \n\t"
      })
    ).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "New prompt" }
    ]);
  });
});

describe("runChatFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shouldReduceStreamingMotion).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes a user turn and assistant child on the current page", async () => {
    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await onChunk("Hello");
        await onChunk(" world");
      })
    };

    await runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendUserTurnToCurrentPage).toHaveBeenCalledWith("Explain backlinks", { uuid: "page-id", name: "Page" });
    expect(mockLogseqService.replaceBlockContent).toHaveBeenLastCalledWith("assistant-id", "Hello world", "assistant");
    expect(mockLogseqService.createAssistantPlaceholder).toHaveBeenCalledWith("user-id");
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "Hello world");
    expect(provider.streamChat).toHaveBeenCalledWith([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Explain backlinks" }
    ], expect.any(Function));
  });

  it("starts animated typing updates and stops them before writing the first real chunk", async () => {
    vi.useFakeTimers();

    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await vi.advanceTimersByTimeAsync(350);
        await onChunk("Hello");
        await vi.advanceTimersByTimeAsync(350);
      })
    };

    await runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(
      1,
      "assistant-id",
      getStreamingMarkerFrames()[0],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(2, "assistant-id", "Hello", "assistant");
    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledTimes(2);
  });

  it("preserves chunk order when the provider emits chunks without awaiting callbacks", async () => {
    vi.useFakeTimers();

    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await vi.advanceTimersByTimeAsync(350);
        onChunk("A");
        onChunk("B");
      })
    };

    await runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledWith("assistant-id", "AB", "assistant");
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "AB");
  });

  it("waits for overlapping chunk writes to finish before finalizing", async () => {
    let releaseFirstWrite!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const events: string[] = [];

    vi.mocked(mockLogseqService.replaceBlockContent).mockImplementation(async (_blockUuid, content) => {
      if (content === "A") {
        await firstWrite;
      }

      events.push(`write:${content}`);
    });
    vi.mocked(mockLogseqService.finalizeBlock).mockImplementation(async (_blockUuid, content) => {
      events.push(`finalize:${content}`);
    });

    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        void onChunk("A");
        void onChunk("B");
      })
    };

    const flowPromise = runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(mockLogseqService.finalizeBlock).not.toHaveBeenCalled();

    releaseFirstWrite();
    await flowPromise;

    expect(events).toEqual([
      "write:A",
      "write:AB",
      "finalize:AB"
    ]);
  });

  it("cancels typing updates before finalizing an empty response when no chunks arrive", async () => {
    vi.useFakeTimers();

    let release!: () => void;
    const provider = {
      streamChat: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
    };

    const flowPromise = runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    await vi.advanceTimersByTimeAsync(350);
    release();
    await flowPromise;

    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledWith(
      "assistant-id",
      getStreamingMarkerFrames()[0],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledTimes(1);
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "");
  });

  it("keeps reduced-motion placeholder static without scheduling typing-frame writes", async () => {
    vi.useFakeTimers();
    vi.mocked(shouldReduceStreamingMotion).mockReturnValue(true);

    let release!: () => void;
    const provider = {
      streamChat: vi.fn(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
    };

    const flowPromise = runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    await vi.advanceTimersByTimeAsync(1200);
    release();
    await flowPromise;

    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledWith(
      "assistant-id",
      getStreamingMarkerText(),
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).not.toHaveBeenCalledWith(
      "assistant-id",
      getStreamingMarkerFrames()[1],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).not.toHaveBeenCalledWith(
      "assistant-id",
      getStreamingMarkerFrames()[2],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledTimes(1);
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "");
  });

  it("degrades safely when a typing-frame update fails", async () => {
    vi.useFakeTimers();

    vi.mocked(mockLogseqService.replaceBlockContent)
      .mockRejectedValueOnce(new Error("indicator update failed"))
      .mockResolvedValue(undefined);

    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await vi.advanceTimersByTimeAsync(350);
        await onChunk("Hello");
      })
    };

    await runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(
      1,
      "assistant-id",
      getStreamingMarkerFrames()[0],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(2, "assistant-id", "Hello", "assistant");
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "Hello");
    expect(mockLogseqService.markInterrupted).not.toHaveBeenCalled();
    expect(mockLogseqService.appendErrorBlock).not.toHaveBeenCalled();
  });

  it("cancels typing updates before interruption handling when the provider errors after a partial chunk", async () => {
    vi.useFakeTimers();

    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await vi.advanceTimersByTimeAsync(350);
        await onChunk("Partial");
        await vi.advanceTimersByTimeAsync(350);
        throw new Error("socket closed");
      })
    };

    await runChatFlow({
      ...baseInput,
      llmProvider: provider as any
    });

    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(
      1,
      "assistant-id",
      getStreamingMarkerFrames()[0],
      "assistant"
    );
    expect(mockLogseqService.replaceBlockContent).toHaveBeenNthCalledWith(2, "assistant-id", "Partial", "assistant");
    expect(mockLogseqService.replaceBlockContent).toHaveBeenCalledTimes(2);
    expect(mockLogseqService.markInterrupted).toHaveBeenCalledWith("assistant-id", "Partial");
  });

  it("uses the provided resolved page for output writing", async () => {
    const provider = { streamChat: vi.fn(async () => undefined) };

    await runChatFlow({
      ...baseInput,
      targetPage: { uuid: "owner-page", name: "Owner Page" },
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendUserTurnToCurrentPage).toHaveBeenCalledWith("Explain backlinks", {
      uuid: "owner-page",
      name: "Owner Page"
    });
  });

  it("replies under the source block without creating a duplicate user turn", async () => {
    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await onChunk("Hello");
      })
    };

    await runChatFlow({
      ...baseInput,
      replyTargetBlockUuid: "source-block",
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendUserTurnToCurrentPage).not.toHaveBeenCalled();
    expect(mockLogseqService.createAssistantPlaceholder).toHaveBeenCalledWith("source-block");
  });

  it("falls back to creating a user turn when no reply target block exists", async () => {
    const provider = { streamChat: vi.fn(async () => undefined) };

    await runChatFlow({
      ...baseInput,
      replyTargetBlockUuid: null,
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendUserTurnToCurrentPage).toHaveBeenCalledWith("Explain backlinks", {
      uuid: "page-id",
      name: "Page"
    });
  });

  it("uses a fixed summarization instruction for summarize mode", async () => {
    const provider = { streamChat: vi.fn(async () => undefined) };

    await runChatFlow({
      ...baseInput,
      mode: "summarize",
      promptSourceText: "Long note body",
      llmProvider: provider as any
    });

    expect(provider.streamChat).toHaveBeenCalledWith([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Summarize the following Logseq block content:\n\nLong note body" }
    ], expect.any(Function));
  });

  it("marks partial responses as interrupted and appends an error block", async () => {
    const provider = {
      streamChat: vi.fn(async (_messages, onChunk) => {
        await onChunk("Partial");
        throw new Error("socket closed");
      })
    };

    await runChatFlow({ ...baseInput, llmProvider: provider as any });

    expect(mockLogseqService.markInterrupted).toHaveBeenCalledWith("assistant-id", "Partial");
    expect(mockLogseqService.finalizeBlock).not.toHaveBeenCalled();
    expect(mockLogseqService.appendErrorBlock).toHaveBeenCalledWith(
      "user-id",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );
  });

  it("finalizes an empty assistant block when the provider fails before the first chunk", async () => {
    const provider = {
      streamChat: vi.fn(async () => {
        throw new Error("socket closed");
      })
    };

    await runChatFlow({ ...baseInput, llmProvider: provider as any });

    expect(mockLogseqService.markInterrupted).not.toHaveBeenCalled();
    expect(mockLogseqService.replaceBlockContent).not.toHaveBeenCalled();
    expect(mockLogseqService.finalizeBlock).toHaveBeenCalledWith("assistant-id", "");
    expect(mockLogseqService.appendErrorBlock).toHaveBeenCalledWith(
      "user-id",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );
  });

  it("attaches errors under the source block in source-reply mode", async () => {
    const provider = {
      streamChat: vi.fn(async () => {
        throw new Error("socket closed");
      })
    };

    await runChatFlow({
      ...baseInput,
      replyTargetBlockUuid: "source-block",
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendErrorBlock).toHaveBeenCalledWith(
      "source-block",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );
  });

  it("propagates source-reply placement failure before assistant insertion without appending an error", async () => {
    const provider = { streamChat: vi.fn(async () => undefined) };
    vi.mocked(mockLogseqService.createAssistantPlaceholder).mockRejectedValueOnce(new Error("Source block not found"));

    await expect(
      runChatFlow({
        ...baseInput,
        replyTargetBlockUuid: "source-block",
        llmProvider: provider as any
      })
    ).rejects.toThrow("Source block not found");

    expect(mockLogseqService.appendUserTurnToCurrentPage).not.toHaveBeenCalled();
    expect(mockLogseqService.appendErrorBlock).not.toHaveBeenCalled();
    expect(provider.streamChat).not.toHaveBeenCalled();
  });

  it("appends an error under the fallback user block when assistant placement fails after user insertion", async () => {
    const provider = { streamChat: vi.fn(async () => undefined) };
    vi.mocked(mockLogseqService.createAssistantPlaceholder).mockRejectedValueOnce(new Error("Assistant block insert failed"));

    await runChatFlow({
      ...baseInput,
      replyTargetBlockUuid: null,
      llmProvider: provider as any
    });

    expect(mockLogseqService.appendUserTurnToCurrentPage).toHaveBeenCalledWith("Explain backlinks", {
      uuid: "page-id",
      name: "Page"
    });
    expect(mockLogseqService.appendErrorBlock).toHaveBeenCalledWith(
      "user-id",
      "Assistant block insert failed",
      "Retry Ask AI after fixing the provider connection."
    );
    expect(provider.streamChat).not.toHaveBeenCalled();
  });
});
