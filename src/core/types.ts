export type ProviderType = "openai" | "ollama";

export type ContextMode = "last-exchange" | "ai-history" | "full-page";

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
}

export interface ModelConfig {
  name: string;
  providerId: string;
  modelId: string;
  systemPrompt: string;
}

export interface PluginSettings {
  providers: ProviderConfig[];
  models: ModelConfig[];
  defaultModel: string;
  shortcutBinding: string;
  prependAssistantLabel: boolean;
  askWithHistoryShortcutBinding: string;
  askWithFullPageContextShortcutBinding: string;
  aiSummarizeShortcutBinding: string;
}
