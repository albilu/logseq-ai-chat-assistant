import type { Translations } from "../types";

export const en: Translations = {
  ui: {
    providerUnreachable: 'Provider "{{name}}" is unreachable: {{error}}',
    selectTextOrBlock: "Select text or focus a block first.",
    unableToResolvePage: "Unable to resolve the current page for AI output.",
    unableToCreateUserBlock: "Unable to create the user turn block.",
    unableToReadBlocksNonCurrentPage:
      "Unable to read blocks for non-current page without getPageBlocksTree support.",
    skippingShortcut:
      'Skipping shortcut binding "{{binding}}" because it is already registered.',
    registeringModelSlashCommand:
      'Registering model slash command "{{registered}}" for "{{name}}" because "{{original}}" is already in use.',
    retryAfterFix: "Retry Ask AI after fixing the provider connection.",
    contextMenuAskAi: "Ask AI",
    contextMenuAskWithHistory: "Ask With AI History",
    contextMenuAskWithFullPage: "Ask With Full Page Context",
    contextMenuSummarize: "AI Summarize",
    slashAskAi: "ask-ai",
    slashAskWithHistory: "ask-with-ai-history",
    slashAskWithFullPage: "ask-with-full-page-context",
    slashSummarize: "ai-summarize",
  },
  settings: {
    providersJsonTitle: "Providers JSON",
    providersJsonDesc: "JSON array of provider configs",
    modelsJsonTitle: "Models JSON",
    modelsJsonDesc: "JSON array of model configs",
    defaultModelTitle: "Default model",
    defaultModelDesc: "Name of the default model to run",
    shortcutBindingTitle: "Shortcut binding",
    shortcutBindingDesc: "Keyboard shortcut for Ask AI",
    prependAssistantLabelTitle: "Prepend [assistant] label to assistant replies",
    prependAssistantLabelDesc:
      "Controls only assistant reply prefixes such as [assistant]. This does not change [error] block formatting.",
    askWithHistoryShortcutTitle: "Ask with history shortcut binding",
    askWithHistoryShortcutDesc: "Optional keyboard shortcut for Ask with AI history",
    askWithFullPageShortcutTitle: "Ask with full page context shortcut binding",
    askWithFullPageShortcutDesc: "Optional keyboard shortcut for Ask with full page context",
    aiSummarizeShortcutTitle: "AI summarize shortcut binding",
    aiSummarizeShortcutDesc: "Optional keyboard shortcut for AI Summarize",
    modelMissingProvider:
      'Model "{{model}}" references missing provider "{{provider}}"',
    defaultModelNotConfigured: 'Default model "{{model}}" is not configured',
    shortcutMustNotBeEmpty: "Shortcut binding must not be empty",
  },
  blocks: {
    user: "[user]",
    assistant: "[assistant]",
    noResponse: "[no response]",
    error: "[error]",
    interrupted: "[interrupted]",
    chatPageTitle: "AI Chat - {{date}}",
  },
  prompts: {
    defaultSystemPrompt: "You are a helpful AI assistant.",
    summarizeBlock: "Summarize the following Logseq block content:\n\n{{content}}",
    pageContext: "Use this page context as reference when answering.\n\n{{context}}",
  },
  streaming: {
    frame0: "⌨️ typing...",
    frame1: "⌨️ typing.. ",
    frame2: "⌨️ typing.  ",
  },
};
