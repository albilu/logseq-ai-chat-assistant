import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@logseq/libs", () => ({}));

type MockLogseqRuntimeOptions = {
  settings?: Record<string, unknown>;
};

const validSettings = {
  providers: '[{"name":"cloud","type":"openai","baseUrl":"https://api.example.com/v1","apiKey":"key"}]',
  models: '[{"name":"Chat Model","providerId":"cloud","modelId":"gpt-4o","systemPrompt":"help"}]',
  defaultModel: "Chat Model",
  shortcutBinding: "mod+shift+a",
  askWithHistoryShortcutBinding: "ctrl+shift+h",
  askWithFullPageContextShortcutBinding: "ctrl+shift+f",
  aiSummarizeShortcutBinding: "ctrl+shift+s"
};

async function mockProviderRegistryWithSuccessfulProbe() {
  vi.doMock("../../src/core/provider-registry", async () => {
    const actual = await vi.importActual<typeof import("../../src/core/provider-registry")>("../../src/core/provider-registry");
    return {
      ...actual,
      probeProvider: vi.fn().mockResolvedValue(undefined)
    };
  });
}

function createMockLogseqRuntime(options: MockLogseqRuntimeOptions = {}) {
  return {
    settings: options.settings ?? {},
    useSettingsSchema: vi.fn(),
    onSettingsChanged: vi.fn(),
    updateSettings: vi.fn(),
    Editor: {
      getCurrentBlock: vi.fn().mockResolvedValue({ uuid: "block-1", content: "Focused block" }),
      createPage: vi.fn().mockResolvedValue({ uuid: "page-1" }),
      insertBlock: vi.fn().mockResolvedValue({ uuid: "child-1" }),
      updateBlock: vi.fn().mockResolvedValue(undefined),
      registerSlashCommand: vi.fn(),
      registerBlockContextMenuItem: vi.fn()
    },
    App: {
      showMsg: vi.fn(),
      registerCommandShortcut: vi.fn(),
      getUserConfigs: vi.fn().mockResolvedValue({ preferredLanguage: "en" })
    }
  };
}

function createMockLogseqService(
  runtime?: ReturnType<typeof createMockLogseqRuntime>,
  overrides: Record<string, unknown> = {}
) {
  return {
    getPromptSource: vi.fn().mockResolvedValue({ text: "Focused block", replyTargetBlockUuid: "block-1" }),
    resolveCurrentPage: vi.fn().mockResolvedValue({ uuid: "page-1", name: "Page" }),
    getLatestAiTurn: vi.fn().mockResolvedValue({ user: "Earlier", assistant: "Answer" }),
    getPriorAiTurns: vi.fn().mockResolvedValue([{ user: "Earlier", assistant: "Answer" }]),
    getFullPageContext: vi.fn().mockResolvedValue("Title: Page\nBody"),
    showMessage: vi.fn((message, level) => runtime?.App.showMsg(message, level)),
    ...overrides
  };
}

describe("plugin bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("../../src/services/logseq-service");
    vi.doUnmock("../../src/core/provider-registry");
    vi.doUnmock("../../src/core/chat-flow");
  });

  it("wires a bootstrap callback into Logseq startup", async () => {
    const ready = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("logseq", { ready });

    await import("../../src/main");

    expect(ready).toHaveBeenCalledWith(expect.any(Function));

    vi.unstubAllGlobals();
  });

  it("does not treat the ready callback model argument as the runtime", async () => {
    const useSettingsSchema = vi.fn();
    const ready = vi.fn(async (callback) => {
      await callback({ model: true });
    });

    vi.stubGlobal("logseq", {
      ready,
      useSettingsSchema,
      settings: {},
      App: { showMsg: vi.fn(), registerCommandShortcut: vi.fn(), getUserConfigs: vi.fn().mockResolvedValue({ preferredLanguage: "en" }) },
      Editor: {
        registerSlashCommand: vi.fn(),
        registerBlockContextMenuItem: vi.fn(),
        getCurrentBlock: vi.fn().mockResolvedValue(null),
        createPage: vi.fn(),
        insertBlock: vi.fn(),
        updateBlock: vi.fn()
      }
    });
    
    await import("../../src/main");

    expect(useSettingsSchema).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("can be imported without a global logseq runtime", async () => {
    await expect(import("../../src/main")).resolves.toHaveProperty("main");
  });

  it("registers settings, generic slash commands, model-specific slash commands, context actions, and shortcuts on startup", async () => {
    const runtime = createMockLogseqRuntime({
      settings: validSettings
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.useSettingsSchema).toHaveBeenCalled();
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-ai", expect.any(Function));
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-with-ai-history", expect.any(Function));
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-with-full-page-context", expect.any(Function));
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ai-summarize", expect.any(Function));
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-chat-model", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask AI", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask With AI History", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask With Full Page Context", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("AI Summarize", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).not.toHaveBeenCalledWith("Summarize", expect.any(Function));
    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledWith({ binding: "mod+shift+a" }, expect.any(Function));
    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledWith({ binding: "ctrl+shift+h" }, expect.any(Function));
    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledWith({ binding: "ctrl+shift+f" }, expect.any(Function));
    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledWith({ binding: "ctrl+shift+s" }, expect.any(Function));
  });

  it("constructs LogseqService with prependAssistantLabel from settings", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();

    const LogseqServiceMock = vi.fn().mockImplementation(() => createMockLogseqService());

    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: LogseqServiceMock
    }));

    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        prependAssistantLabel: false
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(LogseqServiceMock).toHaveBeenCalledWith(runtime, expect.objectContaining({ prependAssistantLabel: false }));
  });

  it("does not register empty optional action shortcuts", async () => {
    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        askWithHistoryShortcutBinding: "",
        askWithFullPageContextShortcutBinding: "",
        aiSummarizeShortcutBinding: ""
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledTimes(1);
    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledWith({ binding: "mod+shift+a" }, expect.any(Function));
  });

  it("does not register whitespace-only optional action shortcuts", async () => {
    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        askWithHistoryShortcutBinding: "   ",
        askWithFullPageContextShortcutBinding: "\t",
        aiSummarizeShortcutBinding: "\n  "
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.App.registerCommandShortcut).toHaveBeenCalledTimes(1);
    expect(runtime.App.registerCommandShortcut).not.toHaveBeenCalledWith({ binding: "   " }, expect.any(Function));
    expect(runtime.App.registerCommandShortcut).not.toHaveBeenCalledWith({ binding: "\t" }, expect.any(Function));
    expect(runtime.App.registerCommandShortcut).not.toHaveBeenCalledWith({ binding: "\n  " }, expect.any(Function));
  });

  it("registers history and full-page ask actions", async () => {
    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask With AI History", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask With Full Page Context", expect.any(Function));
  });

  it("keeps model-specific slash commands available with a deterministic alternate name when they collide with built-ins", async () => {
    await mockProviderRegistryWithSuccessfulProbe();

    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        models: '[{"name":"AI","providerId":"cloud","modelId":"gpt-4o","systemPrompt":"help"}]',
        defaultModel: "AI"
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.Editor.registerSlashCommand.mock.calls.filter(([name]) => name === "ask-ai")).toHaveLength(1);
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-ai-model", expect.any(Function));
    expect(runtime.App.showMsg).toHaveBeenCalledWith(
      'Registering model slash command "ask-ai-model" for "AI" because "ask-ai" is already in use.',
      "warning"
    );
  });

  it("warns and skips later duplicate shortcut bindings", async () => {
    await mockProviderRegistryWithSuccessfulProbe();

    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        askWithHistoryShortcutBinding: "mod+shift+a",
        askWithFullPageContextShortcutBinding: "mod+shift+a",
        aiSummarizeShortcutBinding: "ctrl+shift+s"
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.App.registerCommandShortcut.mock.calls.filter(([shortcut]) => shortcut.binding === "mod+shift+a")).toHaveLength(1);
    expect(runtime.App.showMsg).toHaveBeenCalledWith(
      'Skipping shortcut binding "mod+shift+a" because it is already registered.',
      "warning"
    );
  });

  it("keeps later duplicate model-derived slash command names available with deterministic alternate names", async () => {
    await mockProviderRegistryWithSuccessfulProbe();

    const runtime = createMockLogseqRuntime({
      settings: {
        ...validSettings,
        models: '[{"name":"Chat Model","providerId":"cloud","modelId":"gpt-4o","systemPrompt":"help"},{"name":"Chat-Model","providerId":"cloud","modelId":"gpt-4o-mini","systemPrompt":"help"}]',
        defaultModel: "Chat Model"
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.Editor.registerSlashCommand.mock.calls.filter(([name]) => name === "ask-chat-model")).toHaveLength(1);
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-chat-model-model", expect.any(Function));
    expect(runtime.App.showMsg).toHaveBeenCalledWith(
      'Registering model slash command "ask-chat-model-model" for "Chat-Model" because "ask-chat-model" is already in use.',
      "warning"
    );
  });

  it("logs parsed manual settings to help debug runtime configuration", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const runtime = createMockLogseqRuntime({
      settings: {
        providers: [
          { name: "local-ollama", type: "ollama", baseUrl: "http://127.0.0.1:11434" }
        ],
        models: [
          {
            name: "Qwen 2.5",
            providerId: "local-ollama",
            modelId: "qwen2.5:0.5b",
            systemPrompt: "You are a helpful assistant for Logseq notes."
          }
        ],
        defaultModel: "Qwen 2.5",
        shortcutBinding: "mod+shift+a"
      }
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(infoSpy).toHaveBeenCalledWith(
      "[logseq-ai-chat-assistant] parsed settings",
      expect.objectContaining({
        providerNames: ["local-ollama"],
        modelNames: ["Qwen 2.5"],
        defaultModel: "Qwen 2.5"
      })
    );

    infoSpy.mockRestore();
  });

  it("uses selected text when Ask AI runs", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "Selected note text", replyTargetBlockUuid: "block-1" }),
      showMessage: vi.fn()
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({
      settings: validSettings
    });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "last-exchange",
      promptSourceText: "Selected note text",
      replyTargetBlockUuid: "block-1",
      targetPage: { uuid: "page-1", name: "Page" }
    }));
  });

  it("falls back to top-level user turn creation when selected text has no source block", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "Selected note text", replyTargetBlockUuid: null }),
      showMessage: vi.fn()
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      promptSourceText: "Selected note text",
      replyTargetBlockUuid: null
    }));
  });

  it("passes the same resolved page into context loading and output writing", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const resolvedPage = { uuid: "owner-page", name: "Owner Page" };
    const logseqService = createMockLogseqService(undefined, {
      resolveCurrentPage: vi.fn().mockResolvedValue(resolvedPage),
      showMessage: vi.fn()
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(logseqService.resolveCurrentPage).toHaveBeenCalledTimes(1);
    expect(logseqService.getLatestAiTurn).toHaveBeenCalledWith(resolvedPage);
    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      targetPage: resolvedPage
    }));
  });

  it("still prefers selected text for AI Summarize", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "Selected note text", replyTargetBlockUuid: "block-1" }),
      showMessage: vi.fn()
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const summarizeHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "AI Summarize")?.[1];

    await summarizeHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "summarize",
      contextMode: "last-exchange",
      promptSourceText: "Selected note text",
      replyTargetBlockUuid: "block-1"
    }));
    expect(logseqService.resolveCurrentPage).toHaveBeenCalledTimes(1);
    expect(logseqService.getLatestAiTurn).not.toHaveBeenCalled();
    expect(logseqService.getPriorAiTurns).not.toHaveBeenCalled();
    expect(logseqService.getFullPageContext).not.toHaveBeenCalled();
  });

  it("routes Ask With AI History through ai-history mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const historyHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask With AI History")?.[1];

    await historyHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "ai-history",
      priorTurns: [{ user: "Earlier", assistant: "Answer" }]
    }));
  });

  it("routes Ask With Full Page Context through full-page mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const fullPageHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask With Full Page Context")?.[1];

    await fullPageHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "full-page",
      fullPageContext: "Title: Page\nBody"
    }));
  });

  it("routes Ask AI through last-exchange mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "last-exchange"
    }));
    expect(logseqService.getLatestAiTurn).toHaveBeenCalledTimes(1);
    expect(logseqService.getPriorAiTurns).not.toHaveBeenCalled();
  });

  it("routes slash commands through last-exchange mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const slashHandler = runtime.Editor.registerSlashCommand.mock.calls.find(([name]) => name === "ask-chat-model")?.[1];

    await slashHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "last-exchange"
    }));
  });

  it("routes /ask-ai through last-exchange mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const slashHandler = runtime.Editor.registerSlashCommand.mock.calls.find(([name]) => name === "ask-ai")?.[1];

    await slashHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "last-exchange"
    }));
  });

  it("routes /ask-with-ai-history through ai-history mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const slashHandler = runtime.Editor.registerSlashCommand.mock.calls.find(([name]) => name === "ask-with-ai-history")?.[1];

    await slashHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "ai-history",
      priorTurns: [{ user: "Earlier", assistant: "Answer" }]
    }));
  });

  it("routes /ask-with-full-page-context through full-page mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const slashHandler = runtime.Editor.registerSlashCommand.mock.calls.find(([name]) => name === "ask-with-full-page-context")?.[1];

    await slashHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "full-page",
      fullPageContext: "Title: Page\nBody"
    }));
  });

  it("routes /ai-summarize through summarize mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const slashHandler = runtime.Editor.registerSlashCommand.mock.calls.find(([name]) => name === "ai-summarize")?.[1];

    await slashHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "summarize",
      contextMode: "last-exchange",
      promptSourceText: "Focused block"
    }));
  });

  it("routes the keyboard shortcut through last-exchange mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const shortcutHandler = runtime.App.registerCommandShortcut.mock.calls[0]?.[1];

    await shortcutHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "last-exchange"
    }));
  });

  it("routes the ask-with-history keyboard shortcut through ai-history mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const shortcutHandler = runtime.App.registerCommandShortcut.mock.calls.find(([shortcut]) => shortcut.binding === "ctrl+shift+h")?.[1];

    await shortcutHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "ai-history",
      priorTurns: [{ user: "Earlier", assistant: "Answer" }]
    }));
  });

  it("routes the ask-with-full-page-context keyboard shortcut through full-page mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const shortcutHandler = runtime.App.registerCommandShortcut.mock.calls.find(([shortcut]) => shortcut.binding === "ctrl+shift+f")?.[1];

    await shortcutHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ask",
      contextMode: "full-page",
      fullPageContext: "Title: Page\nBody"
    }));
  });

  it("routes the ai-summarize keyboard shortcut through summarize mode", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const logseqService = createMockLogseqService(undefined, { showMessage: vi.fn() });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const shortcutHandler = runtime.App.registerCommandShortcut.mock.calls.find(([shortcut]) => shortcut.binding === "ctrl+shift+s")?.[1];

    await shortcutHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      mode: "summarize",
      contextMode: "last-exchange"
    }));
  });

  it("warns and aborts when there is no prompt source", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));

    const runtime = createMockLogseqRuntime({
      settings: validSettings
    });
    const logseqService = createMockLogseqService(runtime, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "", replyTargetBlockUuid: null })
    });

    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const summarizeHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "AI Summarize")?.[1];

    await summarizeHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("Select text or focus a block first.", "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
  });

  it("warns and aborts when the default model is invalid", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const runtime = createMockLogseqRuntime({
      settings: {
        providers: '[{"name":"cloud","type":"openai","baseUrl":"https://api.example.com/v1","apiKey":"key"}]',
        models: '[{"name":"Chat Model","providerId":"cloud","modelId":"gpt-4o","systemPrompt":"help"}]',
        defaultModel: "Ghost",
        shortcutBinding: "mod+shift+a"
      }
    });

    const logseqService = createMockLogseqService(runtime, {
      getLatestAiTurn: vi.fn().mockResolvedValue(null),
      getPriorAiTurns: vi.fn().mockResolvedValue([]),
      getFullPageContext: vi.fn().mockResolvedValue("Title: Page")
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith('Model "Ghost" is not configured', "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[logseq-ai-chat-assistant] model lookup failed",
      expect.objectContaining({
        requestedModel: "Ghost",
        availableModels: ["Chat Model"]
      })
    );

    warnSpy.mockRestore();
  });

  it("still surfaces invalid provider errors before page resolution warnings", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));

    const runtime = createMockLogseqRuntime({
      settings: {
        providers: '[{"name":"cloud","type":"openai","baseUrl":"https://api.example.com/v1","apiKey":"key"}]',
        models: '[{"name":"Broken Model","providerId":"missing-provider","modelId":"gpt-4o","systemPrompt":"help"}]',
        defaultModel: "Broken Model",
        shortcutBinding: "mod+shift+a"
      }
    });

    const logseqService = createMockLogseqService(runtime, {
      resolveCurrentPage: vi.fn().mockResolvedValue(null)
    });

    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith('Provider "missing-provider" is not configured', "warning");
    expect(runtime.App.showMsg).not.toHaveBeenCalledWith("Unable to resolve the current page for AI output.", "warning");
    expect(logseqService.resolveCurrentPage).not.toHaveBeenCalled();
    expect(runChatFlow).not.toHaveBeenCalled();
  });

  it("warns and aborts when selected text exists but no focused block page can be resolved", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const runtime = createMockLogseqRuntime({ settings: validSettings });
    const logseqService = createMockLogseqService(runtime, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "Selected note text", replyTargetBlockUuid: null }),
      resolveCurrentPage: vi.fn().mockResolvedValue(null),
      getLatestAiTurn: vi.fn().mockResolvedValue(null),
      getPriorAiTurns: vi.fn().mockResolvedValue([]),
      getFullPageContext: vi.fn().mockResolvedValue("")
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("Unable to resolve the current page for AI output.", "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
  });

  it("falls back to the current page when selected text exists without a focused block", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    const runChatFlow = vi.fn();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow }));
    vi.doUnmock("../../src/services/logseq-service");

    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected note text" } as Selection);

    const runtime = {
      ...createMockLogseqRuntime({ settings: validSettings }),
      Editor: {
        ...createMockLogseqRuntime({ settings: validSettings }).Editor,
        getCurrentBlock: vi.fn().mockResolvedValue(null),
        getPage: vi.fn().mockResolvedValue(null),
        getCurrentPage: vi.fn().mockResolvedValue({ uuid: "page-1", name: "Current Page" }),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getCurrentPageBlocksTree: vi.fn().mockResolvedValue([])
      }
    };

    const { main } = await import("../../src/main");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runChatFlow).toHaveBeenCalledWith(expect.objectContaining({
      promptSourceText: "Selected note text",
      replyTargetBlockUuid: null,
      targetPage: { uuid: "page-1", name: "Current Page" }
    }));
  });

  it("warns and aborts when selected text has a focused block but its owner page cannot be resolved", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    const runChatFlow = vi.fn();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow }));
    vi.doUnmock("../../src/services/logseq-service");

    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected note text" } as Selection);

    const runtime = {
      ...createMockLogseqRuntime({ settings: validSettings }),
      Editor: {
        ...createMockLogseqRuntime({ settings: validSettings }).Editor,
        getCurrentBlock: vi.fn().mockResolvedValue({
          uuid: "block-1",
          content: "Focused block",
          page: { uuid: "page-1" }
        }),
        getPage: vi.fn().mockResolvedValue(null),
        getCurrentPage: vi.fn().mockResolvedValue({ uuid: "fallback-page", name: "Fallback Page" }),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getCurrentPageBlocksTree: vi.fn().mockResolvedValue([])
      }
    };

    const { main } = await import("../../src/main");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await askHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("Unable to resolve the current page for AI output.", "warning");
    expect(runtime.Editor.getCurrentPage).not.toHaveBeenCalled();
    expect(runChatFlow).not.toHaveBeenCalled();
  });

  it("warns and aborts when source-reply placement fails before insertion", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    const runChatFlow = vi.fn().mockRejectedValue(new Error("Source block not found"));
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow }));
    const runtime = createMockLogseqRuntime({ settings: validSettings });
    const logseqService = createMockLogseqService(runtime, {
      getPromptSource: vi.fn().mockResolvedValue({ text: "Selected note text", replyTargetBlockUuid: "block-1" })
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await expect(askHandler?.()).resolves.toBeUndefined();

    expect(runChatFlow).toHaveBeenCalledTimes(1);
    expect(runtime.App.showMsg).toHaveBeenCalledWith("Source block not found", "warning");
  });

  it("warns and aborts when the current page cannot be resolved for summarize", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const runtime = createMockLogseqRuntime({ settings: validSettings });
    const logseqService = createMockLogseqService(runtime, {
      resolveCurrentPage: vi.fn().mockResolvedValue(null),
      getLatestAiTurn: vi.fn().mockResolvedValue(null),
      getPriorAiTurns: vi.fn().mockResolvedValue([]),
      getFullPageContext: vi.fn().mockResolvedValue("")
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const summarizeHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "AI Summarize")?.[1];

    await summarizeHandler?.();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("Unable to resolve the current page for AI output.", "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
    expect(logseqService.resolveCurrentPage).toHaveBeenCalledTimes(1);
    expect(logseqService.getLatestAiTurn).not.toHaveBeenCalled();
    expect(logseqService.getPriorAiTurns).not.toHaveBeenCalled();
    expect(logseqService.getFullPageContext).not.toHaveBeenCalled();
  });

  it("warns and aborts when resolving the current page rejects", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));
    const runtime = createMockLogseqRuntime({ settings: validSettings });
    const logseqService = createMockLogseqService(runtime, {
      resolveCurrentPage: vi.fn().mockRejectedValue(new Error("page lookup failed")),
      getLatestAiTurn: vi.fn().mockResolvedValue(null),
      getPriorAiTurns: vi.fn().mockResolvedValue([]),
      getFullPageContext: vi.fn().mockResolvedValue("")
    });
    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await expect(askHandler?.()).resolves.toBeUndefined();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("page lookup failed", "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
    expect(logseqService.getLatestAiTurn).not.toHaveBeenCalled();
    expect(logseqService.getPriorAiTurns).not.toHaveBeenCalled();
    expect(logseqService.getFullPageContext).not.toHaveBeenCalled();
  });

  it("warns and aborts when last-exchange context loading rejects", async () => {
    vi.resetModules();
    await mockProviderRegistryWithSuccessfulProbe();
    vi.doMock("../../src/core/chat-flow", () => ({ runChatFlow: vi.fn() }));

    const runtime = createMockLogseqRuntime({ settings: validSettings });
    const logseqService = createMockLogseqService(runtime, {
      getLatestAiTurn: vi.fn().mockRejectedValue(new Error("history lookup failed"))
    });

    vi.doMock("../../src/services/logseq-service", () => ({
      LogseqService: vi.fn().mockImplementation(() => logseqService)
    }));

    const { main } = await import("../../src/main");
    const { runChatFlow } = await import("../../src/core/chat-flow");
    await main(runtime as any);
    const askHandler = runtime.Editor.registerBlockContextMenuItem.mock.calls.find(([label]) => label === "Ask AI")?.[1];

    await expect(askHandler?.()).resolves.toBeUndefined();

    expect(runtime.App.showMsg).toHaveBeenCalledWith("history lookup failed", "warning");
    expect(runChatFlow).not.toHaveBeenCalled();
  });

  it("warns when a configured provider is unreachable on startup", async () => {
    vi.resetModules();
    vi.doMock("../../src/core/provider-registry", async () => {
      const actual = await vi.importActual<typeof import("../../src/core/provider-registry")>("../../src/core/provider-registry");
      return {
        ...actual,
        probeProvider: vi.fn().mockRejectedValue(new Error("401 Unauthorized"))
      };
    });

    const runtime = createMockLogseqRuntime({
      settings: validSettings
    });

    const { main } = await import("../../src/main");
    await main(runtime as any);

    expect(runtime.App.showMsg).toHaveBeenCalledWith('Provider "cloud" is unreachable: 401 Unauthorized', "warning");
  });

  it("still registers commands when a provider probe times out", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.doMock("../../src/core/provider-registry", async () => {
      const actual = await vi.importActual<typeof import("../../src/core/provider-registry")>("../../src/core/provider-registry");
      return {
        ...actual,
        probeProvider: vi.fn(() => new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error("Probe timed out")), 5000);
        }))
      };
    });

    const runtime = createMockLogseqRuntime({
      settings: validSettings
    });

    const { main } = await import("../../src/main");
    const startupPromise = main(runtime as any);

    await vi.advanceTimersByTimeAsync(5000);
    await startupPromise;

    expect(runtime.App.showMsg).toHaveBeenCalledWith('Provider "cloud" is unreachable: Probe timed out', "warning");
    expect(runtime.Editor.registerSlashCommand).toHaveBeenCalledWith("ask-chat-model", expect.any(Function));
    expect(runtime.Editor.registerBlockContextMenuItem).toHaveBeenCalledWith("Ask AI", expect.any(Function));

    vi.useRealTimers();
  });
});
