import type { Translations } from "../types";

export const de: Translations = {
  ui: {
    providerUnreachable: 'Anbieter "{{name}}" nicht erreichbar: {{error}}',
    selectTextOrBlock: "Text auswählen oder Block fokussieren.",
    unableToResolvePage: "Aktuelle Seite für KI-Ausgabe konnte nicht aufgelöst werden.",
    unableToCreateUserBlock: "Benutzer-Block konnte nicht erstellt werden.",
    unableToReadBlocksNonCurrentPage:
      "Blöcke der nicht aktuellen Seite ohne getPageBlocksTree-Unterstützung nicht lesbar.",
    skippingShortcut:
      'Tastenkürzel "{{binding}}" wird übersprungen, da es bereits registriert ist.',
    registeringModelSlashCommand:
      'Slash-Befehl "{{registered}}" für "{{name}}" wird registriert, da "{{original}}" bereits belegt ist.',
    retryAfterFix: "KI erneut anfragen, nachdem die Anbieterverbindung korrigiert wurde.",
    contextMenuAskAi: "KI fragen",
    contextMenuAskWithHistory: "KI mit Verlauf fragen",
    contextMenuAskWithFullPage: "KI mit vollständiger Seite fragen",
    contextMenuSummarize: "KI-Zusammenfassung",
    slashAskAi: "ki-fragen",
    slashAskWithHistory: "ki-fragen-verlauf",
    slashAskWithFullPage: "ki-fragen-ganze-seite",
    slashSummarize: "ki-zusammenfassung",
  },
  settings: {
    providersJsonTitle: "Anbieter-JSON",
    providersJsonDesc: "JSON-Array der Anbieterkonfigurationen",
    modelsJsonTitle: "Modell-JSON",
    modelsJsonDesc: "JSON-Array der Modellkonfigurationen",
    defaultModelTitle: "Standardmodell",
    defaultModelDesc: "Name des zu verwendenden Standardmodells",
    shortcutBindingTitle: "Tastenkürzel",
    shortcutBindingDesc: "Tastenkürzel für KI fragen",
    prependAssistantLabelTitle: "[Assistent]-Bezeichnung voranstellen",
    prependAssistantLabelDesc:
      "Steuert nur Antwort-Präfixe wie [Assistent]. Ändert nicht die [Fehler]-Block-Formatierung.",
    askWithHistoryShortcutTitle: "Tastenkürzel für KI mit Verlauf",
    askWithHistoryShortcutDesc: "Optionales Tastenkürzel für KI mit Verlauf fragen",
    askWithFullPageShortcutTitle: "Tastenkürzel für KI mit vollständiger Seite",
    askWithFullPageShortcutDesc: "Optionales Tastenkürzel für KI mit vollständigem Seitenkontext",
    aiSummarizeShortcutTitle: "Tastenkürzel für KI-Zusammenfassung",
    aiSummarizeShortcutDesc: "Optionales Tastenkürzel für KI-Zusammenfassung",
    modelMissingProvider: 'Modell "{{model}}" verweist auf fehlenden Anbieter "{{provider}}"',
    defaultModelNotConfigured: 'Standardmodell "{{model}}" ist nicht konfiguriert',
    shortcutMustNotBeEmpty: "Tastenkürzel darf nicht leer sein",
  },
  blocks: {
    user: "[Benutzer]",
    assistant: "[Assistent]",
    noResponse: "[keine Antwort]",
    error: "[Fehler]",
    interrupted: "[unterbrochen]",
    chatPageTitle: "KI-Chat - {{date}}",
  },
  prompts: {
    defaultSystemPrompt: "Du bist ein hilfreicher KI-Assistent.",
    summarizeBlock: "Fasse den folgenden Logseq-Blockinhalt zusammen:\n\n{{content}}",
    pageContext: "Verwende diesen Seitenkontext als Referenz beim Antworten.\n\n{{context}}",
  },
  streaming: {
    frame0: "⌨️ tippt...",
    frame1: "⌨️ tippt.. ",
    frame2: "⌨️ tippt.  ",
  },
};
