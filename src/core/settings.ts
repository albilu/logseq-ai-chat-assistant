import type { PluginSettings } from "./types";

type SettingsSchema = Parameters<typeof logseq.useSettingsSchema>[0];

export const settingsSchema: SettingsSchema = [
  { key: "providers", type: "string", default: "[]", title: "Providers JSON", description: "JSON array of provider configs" },
  { key: "models", type: "string", default: "[]", title: "Models JSON", description: "JSON array of model configs" },
  { key: "defaultModel", type: "string", default: "", title: "Default model", description: "Name of the default model to run" },
  { key: "shortcutBinding", type: "string", default: "ctrl+shift+enter", title: "Shortcut binding", description: "Keyboard shortcut for Ask AI" },
  {
    key: "prependAssistantLabel",
    type: "boolean",
    default: true,
    title: "Prepend [assistant] label to assistant replies",
    description: "Controls only assistant reply prefixes such as [assistant]. This does not change [error] block formatting."
  },
  { key: "askWithHistoryShortcutBinding", type: "string", default: "", title: "Ask with history shortcut binding", description: "Optional keyboard shortcut for Ask with AI history" },
  { key: "askWithFullPageContextShortcutBinding", type: "string", default: "", title: "Ask with full page context shortcut binding", description: "Optional keyboard shortcut for Ask with full page context" },
  { key: "aiSummarizeShortcutBinding", type: "string", default: "", title: "AI summarize shortcut binding", description: "Optional keyboard shortcut for AI Summarize" }
];

export const defaultSettings: PluginSettings = {
  providers: [],
  models: [],
  defaultModel: "",
  shortcutBinding: "ctrl+shift+enter",
  prependAssistantLabel: true,
  askWithHistoryShortcutBinding: "",
  askWithFullPageContextShortcutBinding: "",
  aiSummarizeShortcutBinding: ""
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProviderConfig(value: unknown): value is PluginSettings["providers"][number] {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    (value.type === "openai" || value.type === "ollama") &&
    typeof value.baseUrl === "string" &&
    (value.apiKey === undefined || typeof value.apiKey === "string")
  );
}

function isModelConfig(value: unknown): value is PluginSettings["models"][number] {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.providerId === "string" &&
    typeof value.modelId === "string" &&
    typeof value.systemPrompt === "string"
  );
}

function parseJsonArray<T>(value: unknown, itemGuard: (item: unknown) => item is T): T[] {
  const parsed = Array.isArray(value) ? value : parseJson(value);

  if (!Array.isArray(parsed) || !parsed.every(itemGuard)) {
    return [];
  }

  return parsed;
}

export function parseSettings(raw: Record<string, unknown>): PluginSettings {
  return {
    providers: parseJsonArray(raw.providers, isProviderConfig),
    models: parseJsonArray(raw.models, isModelConfig),
    defaultModel: String(raw.defaultModel ?? defaultSettings.defaultModel),
    shortcutBinding: String(raw.shortcutBinding ?? defaultSettings.shortcutBinding),
    prependAssistantLabel: typeof raw.prependAssistantLabel === "boolean"
      ? raw.prependAssistantLabel
      : defaultSettings.prependAssistantLabel,
    askWithHistoryShortcutBinding: String(raw.askWithHistoryShortcutBinding ?? defaultSettings.askWithHistoryShortcutBinding),
    askWithFullPageContextShortcutBinding: String(raw.askWithFullPageContextShortcutBinding ?? defaultSettings.askWithFullPageContextShortcutBinding),
    aiSummarizeShortcutBinding: String(raw.aiSummarizeShortcutBinding ?? defaultSettings.aiSummarizeShortcutBinding)
  };
}

export function validateSettings(settings: PluginSettings) {
  const issues: string[] = [];
  const providerNames = new Set(settings.providers.map((provider) => provider.name));
  const modelNames = new Set(settings.models.map((model) => model.name));

  for (const model of settings.models) {
    if (!providerNames.has(model.providerId)) {
      issues.push(`Model "${model.name}" references missing provider "${model.providerId}"`);
    }
  }

  if (settings.defaultModel && !modelNames.has(settings.defaultModel)) {
    issues.push(`Default model "${settings.defaultModel}" is not configured`);
  }

  if (!settings.shortcutBinding.trim()) {
    issues.push("Shortcut binding must not be empty");
  }

  return { isValid: issues.length === 0, issues };
}

export function toSlashCommandName(modelName: string) {
  return `ask-${modelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
