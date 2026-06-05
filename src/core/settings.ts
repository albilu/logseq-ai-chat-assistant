import type { ModelConfig, PluginSettings } from "./types";
import { t } from "../i18n/index";

export type SettingsSchema = Parameters<typeof logseq.useSettingsSchema>[0];

export function getSettingsSchema(models: ModelConfig[]): SettingsSchema {
  const modelNames = models.map((m) => m.name);
  const uniqueNames = Array.from(new Set(modelNames));
  if (uniqueNames.length === 0) {
    uniqueNames.push("");
  }

  return [
    { key: "providers", type: "string", default: "[]", title: t("settings.providersJsonTitle"), description: t("settings.providersJsonDesc") },
    { key: "models", type: "string", default: "[]", title: t("settings.modelsJsonTitle"), description: t("settings.modelsJsonDesc") },
    { 
      key: "defaultModel", 
      type: "enum", 
      enumChoices: uniqueNames, 
      default: uniqueNames[0] || "", 
      title: t("settings.defaultModelTitle"), 
      description: t("settings.defaultModelDesc") 
    },
    { key: "shortcutBinding", type: "string", default: "ctrl+shift+enter", title: t("settings.shortcutBindingTitle"), description: t("settings.shortcutBindingDesc") },
    {
      key: "prependAssistantLabel",
      type: "boolean",
      default: true,
      title: t("settings.prependAssistantLabelTitle"),
      description: t("settings.prependAssistantLabelDesc")
    },
    { key: "askWithHistoryShortcutBinding", type: "string", default: "", title: t("settings.askWithHistoryShortcutTitle"), description: t("settings.askWithHistoryShortcutDesc") },
    { key: "askWithFullPageContextShortcutBinding", type: "string", default: "", title: t("settings.askWithFullPageShortcutTitle"), description: t("settings.askWithFullPageShortcutDesc") },
    { key: "aiSummarizeShortcutBinding", type: "string", default: "", title: t("settings.aiSummarizeShortcutTitle"), description: t("settings.aiSummarizeShortcutDesc") }
  ];
}

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
      issues.push(t("settings.modelMissingProvider", { model: model.name, provider: model.providerId }));
    }
  }

  if (settings.defaultModel && !modelNames.has(settings.defaultModel)) {
    issues.push(t("settings.defaultModelNotConfigured", { model: settings.defaultModel }));
  }

  if (!settings.shortcutBinding.trim()) {
    issues.push(t("settings.shortcutMustNotBeEmpty"));
  }

  return { isValid: issues.length === 0, issues };
}

export function toSlashCommandName(modelName: string) {
  return `ask-${modelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
