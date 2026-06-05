import type { Translations } from "../types";

export const nl: Translations = {
  ui: {
    providerUnreachable: 'Provider "{{name}}" is niet bereikbaar: {{error}}',
    selectTextOrBlock: "Selecteer tekst of focus een blok.",
    unableToResolvePage: "Huidige pagina voor AI-uitvoer kon niet worden opgelost.",
    unableToCreateUserBlock: "Gebruikersblok kon niet worden aangemaakt.",
    unableToReadBlocksNonCurrentPage:
      "Blokken van niet-huidige pagina kunnen niet worden gelezen zonder getPageBlocksTree-ondersteuning.",
    skippingShortcut:
      'Sneltoets "{{binding}}" overgeslagen omdat deze al is geregistreerd.',
    registeringModelSlashCommand:
      'Slash-opdracht "{{registered}}" voor "{{name}}" wordt geregistreerd omdat "{{original}}" al in gebruik is.',
    retryAfterFix: "Probeer AI opnieuw na het herstellen van de providerverbinding.",
    contextMenuAskAi: "AI vragen",
    contextMenuAskWithHistory: "AI vragen met geschiedenis",
    contextMenuAskWithFullPage: "AI vragen met volledige pagina",
    contextMenuSummarize: "AI-samenvatting",
    slashAskAi: "ai-vragen",
    slashAskWithHistory: "ai-vragen-geschiedenis",
    slashAskWithFullPage: "ai-vragen-volledige-pagina",
    slashSummarize: "ai-samenvatting",
  },
  settings: {
    providersJsonTitle: "Providers JSON",
    providersJsonDesc: "JSON-array van providerconfiguraties",
    modelsJsonTitle: "Modellen JSON",
    modelsJsonDesc: "JSON-array van modelconfiguraties",
    defaultModelTitle: "Standaardmodel",
    defaultModelDesc: "Naam van het te gebruiken standaardmodel",
    shortcutBindingTitle: "Sneltoets",
    shortcutBindingDesc: "Sneltoets voor AI vragen",
    prependAssistantLabelTitle: "[assistent]-label toevoegen aan antwoorden",
    prependAssistantLabelDesc:
      "Beheert alleen antwoordprefixen zoals [assistent]. Wijzigt de [fout]-blokopmaak niet.",
    askWithHistoryShortcutTitle: "Sneltoets voor AI met geschiedenis",
    askWithHistoryShortcutDesc: "Optionele sneltoets voor AI vragen met geschiedenis",
    askWithFullPageShortcutTitle: "Sneltoets voor AI met volledige pagina",
    askWithFullPageShortcutDesc: "Optionele sneltoets voor AI vragen met volledige paginacontext",
    aiSummarizeShortcutTitle: "Sneltoets voor AI-samenvatting",
    aiSummarizeShortcutDesc: "Optionele sneltoets voor AI-samenvatting",
    modelMissingProvider: 'Model "{{model}}" verwijst naar ontbrekende provider "{{provider}}"',
    defaultModelNotConfigured: 'Standaardmodel "{{model}}" is niet geconfigureerd',
    shortcutMustNotBeEmpty: "Sneltoets mag niet leeg zijn",
  },
  blocks: {
    user: "[gebruiker]",
    assistant: "[assistent]",
    noResponse: "[geen antwoord]",
    error: "[fout]",
    interrupted: "[onderbroken]",
    chatPageTitle: "AI-chat - {{date}}",
  },
  prompts: {
    defaultSystemPrompt: "Je bent een behulpzame AI-assistent.",
    summarizeBlock: "Vat de volgende Logseq-blokinhoud samen:\n\n{{content}}",
    pageContext: "Gebruik deze paginacontext als referentie bij het beantwoorden.\n\n{{context}}",
  },
  streaming: {
    frame0: "⌨️ aan het typen...",
    frame1: "⌨️ aan het typen.. ",
    frame2: "⌨️ aan het typen.  ",
  },
};
