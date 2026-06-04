export interface Translations {
  ui: {
    providerUnreachable: string;
    selectTextOrBlock: string;
    unableToResolvePage: string;
    unableToCreateUserBlock: string;
    unableToReadBlocksNonCurrentPage: string;
    skippingShortcut: string;
    registeringModelSlashCommand: string;
    retryAfterFix: string;
    contextMenuAskAi: string;
    contextMenuAskWithHistory: string;
    contextMenuAskWithFullPage: string;
    contextMenuSummarize: string;
  };
  settings: {
    providersJsonTitle: string;
    providersJsonDesc: string;
    modelsJsonTitle: string;
    modelsJsonDesc: string;
    defaultModelTitle: string;
    defaultModelDesc: string;
    shortcutBindingTitle: string;
    shortcutBindingDesc: string;
    prependAssistantLabelTitle: string;
    prependAssistantLabelDesc: string;
    askWithHistoryShortcutTitle: string;
    askWithHistoryShortcutDesc: string;
    askWithFullPageShortcutTitle: string;
    askWithFullPageShortcutDesc: string;
    aiSummarizeShortcutTitle: string;
    aiSummarizeShortcutDesc: string;
    modelMissingProvider: string;
    defaultModelNotConfigured: string;
    shortcutMustNotBeEmpty: string;
  };
  blocks: {
    user: string;
    assistant: string;
    noResponse: string;
    error: string;
    interrupted: string;
    chatPageTitle: string;
  };
  prompts: {
    defaultSystemPrompt: string;
    summarizeBlock: string;
    pageContext: string;
  };
  streaming: {
    frame0: string;
    frame1: string;
    frame2: string;
  };
}

type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? LeafPaths<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`;
}[keyof T & string];

export type TranslationKey = LeafPaths<Translations>;
