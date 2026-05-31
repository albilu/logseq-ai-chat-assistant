import { runChatFlow } from "./chat-flow";
import { createLLMProvider, getModelOrThrow, getProviderForModel } from "./provider-registry";
import { toSlashCommandName } from "./settings";
import type { ContextMode, PluginSettings } from "./types";
import { LogseqService } from "../services/logseq-service";
import type { ResolvedPage } from "../services/logseq-service";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function resolveAvailableSlashCommandName(baseName: string, registeredNames: Set<string>) {
  if (!registeredNames.has(baseName)) {
    return baseName;
  }

  let suffix = "model";
  let candidate = `${baseName}-${suffix}`;
  let duplicateIndex = 2;

  while (registeredNames.has(candidate)) {
    candidate = `${baseName}-${suffix}-${duplicateIndex}`;
    duplicateIndex += 1;
  }

  return candidate;
}

export async function registerCommands(runtime: typeof logseq, settings: PluginSettings) {
  const logseqService = new LogseqService(runtime as never, {
    prependAssistantLabel: settings.prependAssistantLabel
  });
  const builtInSlashCommands = new Set([
    "ask-ai",
    "ask-with-ai-history",
    "ask-with-full-page-context",
    "ai-summarize"
  ]);
  const registeredSlashCommandNames = new Set(builtInSlashCommands);
  const registeredShortcutBindings = new Set<string>();

  function registerShortcutIfPresent(binding: string, handler: () => Promise<void>) {
    const trimmedBinding = binding.trim();

    if (!trimmedBinding) {
      return;
    }

    if (registeredShortcutBindings.has(trimmedBinding)) {
      logseqService.showMessage(`Skipping shortcut binding "${trimmedBinding}" because it is already registered.`, "warning");
      return;
    }

    registeredShortcutBindings.add(trimmedBinding);

    runtime.App.registerCommandShortcut({ binding: trimmedBinding }, handler);
  }

  async function resolveContextPayload(page: ResolvedPage, mode: "ask" | "summarize", contextMode: ContextMode) {
    try {
      if (mode === "summarize") {
        return {
          contextMode,
          priorTurns: []
        };
      }

      if (contextMode === "full-page") {
        return {
          contextMode,
          priorTurns: [],
          fullPageContext: await logseqService.getFullPageContext(page)
        };
      }

      if (contextMode === "last-exchange") {
        const latestTurn = await logseqService.getLatestAiTurn(page);

        return {
          contextMode,
          priorTurns: latestTurn ? [latestTurn] : []
        };
      }

      return {
        contextMode,
        priorTurns: await logseqService.getPriorAiTurns(page)
      };
    } catch (error) {
      logseqService.showMessage(getErrorMessage(error), "warning");
      return null;
    }
  }

  async function runCommand(mode: "ask" | "summarize", modelName: string, contextMode: ContextMode) {
    const { text: promptSourceText, replyTargetBlockUuid } = await logseqService.getPromptSource();

    if (!promptSourceText) {
      logseqService.showMessage("Select text or focus a block first.", "warning");
      return;
    }

    // Resolve the actual model name - if it's the special marker, read current defaultModel from settings
    let actualModelName = modelName;
    if (modelName === "__DEFAULT_MODEL__") {
      const currentSettings = await runtime.settings;
      actualModelName = String(currentSettings?.defaultModel ?? settings.defaultModel);
    }

    let model;
    let provider;

    try {
      model = getModelOrThrow(settings, actualModelName);
      provider = getProviderForModel(settings, model);
    } catch (error) {
      logseqService.showMessage(getErrorMessage(error), "warning");
      return;
    }

    let targetPage;

    try {
      targetPage = await logseqService.resolveCurrentPage();
    } catch (error) {
      logseqService.showMessage(getErrorMessage(error), "warning");
      return;
    }

    if (!targetPage) {
      logseqService.showMessage("Unable to resolve the current page for AI output.", "warning");
      return;
    }

    const contextPayload = await resolveContextPayload(targetPage, mode, contextMode);

    if (!contextPayload) {
      return;
    }

    try {
      await runChatFlow({
        mode,
        contextMode: contextPayload.contextMode,
        promptSourceText,
        replyTargetBlockUuid,
        targetPage,
        priorTurns: contextPayload.priorTurns,
        fullPageContext: contextPayload.fullPageContext,
        model,
        llmProvider: createLLMProvider(provider, model),
        logseqService
      });
    } catch (error) {
      logseqService.showMessage(getErrorMessage(error), "warning");
    }
  }

  for (const model of settings.models) {
    const slashCommandName = toSlashCommandName(model.name);
    const registeredSlashCommandName = resolveAvailableSlashCommandName(slashCommandName, registeredSlashCommandNames);

    if (registeredSlashCommandName !== slashCommandName) {
      logseqService.showMessage(
        `Registering model slash command "${registeredSlashCommandName}" for "${model.name}" because "${slashCommandName}" is already in use.`,
        "warning"
      );
    }

    registeredSlashCommandNames.add(registeredSlashCommandName);

    runtime.Editor.registerSlashCommand(registeredSlashCommandName, async () => runCommand("ask", model.name, "last-exchange"));
  }

  runtime.Editor.registerSlashCommand("ask-ai", async () => runCommand("ask", "__DEFAULT_MODEL__", "last-exchange"));
  runtime.Editor.registerSlashCommand("ask-with-ai-history", async () => runCommand("ask", "__DEFAULT_MODEL__", "ai-history"));
  runtime.Editor.registerSlashCommand("ask-with-full-page-context", async () => runCommand("ask", "__DEFAULT_MODEL__", "full-page"));
  runtime.Editor.registerSlashCommand("ai-summarize", async () => runCommand("summarize", "__DEFAULT_MODEL__", "last-exchange"));

  runtime.Editor.registerBlockContextMenuItem("Ask AI", async () => runCommand("ask", "__DEFAULT_MODEL__", "last-exchange"));
  runtime.Editor.registerBlockContextMenuItem("Ask With AI History", async () => runCommand("ask", "__DEFAULT_MODEL__", "ai-history"));
  runtime.Editor.registerBlockContextMenuItem("Ask With Full Page Context", async () => runCommand("ask", "__DEFAULT_MODEL__", "full-page"));
  runtime.Editor.registerBlockContextMenuItem("AI Summarize", async () => runCommand("summarize", "__DEFAULT_MODEL__", "last-exchange"));

  registerShortcutIfPresent(settings.shortcutBinding, async () => runCommand("ask", "__DEFAULT_MODEL__", "last-exchange"));
  registerShortcutIfPresent(settings.askWithHistoryShortcutBinding, async () => runCommand("ask", "__DEFAULT_MODEL__", "ai-history"));
  registerShortcutIfPresent(settings.askWithFullPageContextShortcutBinding, async () => runCommand("ask", "__DEFAULT_MODEL__", "full-page"));
  registerShortcutIfPresent(settings.aiSummarizeShortcutBinding, async () => runCommand("summarize", "__DEFAULT_MODEL__", "last-exchange"));
}
