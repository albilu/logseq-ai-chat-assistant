import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  parseSettings,
  toSlashCommandName,
  validateSettings
} from "../../src/core/settings";

describe("defaultSettings", () => {
  it("starts with no configured providers or models", () => {
    expect(defaultSettings.providers).toEqual([]);
    expect(defaultSettings.models).toEqual([]);
    expect(defaultSettings.defaultModel).toBe("");
    expect(defaultSettings.shortcutBinding).toBe("ctrl+shift+enter");
  });

  it("defaults prependAssistantLabel to true", () => {
    expect(defaultSettings.prependAssistantLabel).toBe(true);
  });

  it("defaults the new shortcut settings to empty strings", () => {
    expect(defaultSettings.askWithHistoryShortcutBinding).toBe("");
    expect(defaultSettings.askWithFullPageContextShortcutBinding).toBe("");
    expect(defaultSettings.aiSummarizeShortcutBinding).toBe("");
  });
});

describe("validateSettings", () => {
  it("reports dangling provider references", () => {
    const result = validateSettings({
      ...defaultSettings,
      providers: [{ name: "local", type: "ollama", baseUrl: "http://localhost:11434" }],
      models: [{ name: "chat", providerId: "missing", modelId: "llama3", systemPrompt: "" }],
      defaultModel: "chat",
      shortcutBinding: "mod+shift+a"
    });

    expect(result.issues).toContain('Model "chat" references missing provider "missing"');
  });

  it("reports an unknown default model", () => {
    const result = validateSettings({
      ...defaultSettings,
      providers: [],
      models: [],
      defaultModel: "ghost",
      shortcutBinding: "mod+shift+a"
    });

    expect(result.issues).toContain('Default model "ghost" is not configured');
  });
});

describe("parseSettings", () => {
  it("uses ctrl+shift+enter as the fresh-install default shortcut", () => {
    expect(defaultSettings.shortcutBinding).toBe("ctrl+shift+enter");

    expect(
      parseSettings({
        providers: "[]",
        models: "[]",
        defaultModel: "",
        shortcutBinding: undefined
      }).shortcutBinding
    ).toBe("ctrl+shift+enter");
  });

  it("parses JSON-backed settings into typed config", () => {
    const parsed = parseSettings({
      providers: '[{"name":"cloud","type":"openai","baseUrl":"https://api.example.com","apiKey":"key"}]',
      models: '[{"name":"Chat Model","providerId":"cloud","modelId":"gpt-4o","systemPrompt":"help"}]',
      defaultModel: "Chat Model",
      shortcutBinding: "mod+shift+a"
    });

    expect(parsed.providers[0]?.type).toBe("openai");
    expect(parsed.models[0]?.name).toBe("Chat Model");
  });

  it("parses the new optional shortcut settings", () => {
    const parsed = parseSettings({
      providers: "[]",
      models: "[]",
      defaultModel: "",
      shortcutBinding: "ctrl+shift+enter",
      askWithHistoryShortcutBinding: "ctrl+shift+h",
      askWithFullPageContextShortcutBinding: "ctrl+shift+f",
      aiSummarizeShortcutBinding: "ctrl+shift+s"
    });

    expect(parsed.askWithHistoryShortcutBinding).toBe("ctrl+shift+h");
    expect(parsed.askWithFullPageContextShortcutBinding).toBe("ctrl+shift+f");
    expect(parsed.aiSummarizeShortcutBinding).toBe("ctrl+shift+s");
  });

  it("parses prependAssistantLabel from raw settings", () => {
    expect(
      parseSettings({
        providers: "[]",
        models: "[]",
        defaultModel: "",
        shortcutBinding: "ctrl+shift+enter",
        prependAssistantLabel: false
      }).prependAssistantLabel
    ).toBe(false);
  });

  it("treats a missing prependAssistantLabel as true for backward compatibility", () => {
    expect(
      parseSettings({
        providers: "[]",
        models: "[]",
        defaultModel: "",
        shortcutBinding: "ctrl+shift+enter"
      }).prependAssistantLabel
    ).toBe(true);
  });

  it("accepts object-backed settings values from manual config", () => {
    const parsed = parseSettings({
      providers: [
        {
          name: "local-ollama",
          type: "ollama",
          baseUrl: "http://127.0.0.1:11434"
        }
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
    });

    expect(parsed.providers[0]?.name).toBe("local-ollama");
    expect(parsed.models[0]?.name).toBe("Qwen 2.5");
    expect(validateSettings(parsed).issues).not.toContain('Default model "Qwen 2.5" is not configured');
  });

  it("falls back when providers JSON is null", () => {
    const parsed = parseSettings({
      providers: "null",
      models: "[]",
      defaultModel: "",
      shortcutBinding: "mod+shift+a"
    });

    expect(parsed.providers).toEqual([]);
  });

  it("falls back when providers JSON is an object", () => {
    const parsed = parseSettings({
      providers: "{}",
      models: "[]",
      defaultModel: "",
      shortcutBinding: "mod+shift+a"
    });

    expect(parsed.providers).toEqual([]);
  });

  it("falls back when models JSON contains non-object entries", () => {
    const parsed = parseSettings({
      providers: "[]",
      models: "[1]",
      defaultModel: "",
      shortcutBinding: "mod+shift+a"
    });

    expect(parsed.models).toEqual([]);
  });

  it("keeps validation safe on malformed JSON-backed settings", () => {
    expect(() =>
      validateSettings(
        parseSettings({
          providers: "null",
          models: "[1]",
          defaultModel: "ghost",
          shortcutBinding: "mod+shift+a"
        })
      )
    ).not.toThrow();
  });
});

describe("toSlashCommandName", () => {
  it("normalizes model names for slash commands", () => {
    expect(toSlashCommandName("Chat Model")).toBe("ask-chat-model");
  });
});
