import type { Translations } from "../types";

export const fr: Translations = {
  ui: {
    providerUnreachable: 'Fournisseur "{{name}}" inaccessible\u00a0: {{error}}',
    selectTextOrBlock: "Sélectionnez du texte ou focalisez un bloc.",
    unableToResolvePage: "Impossible de résoudre la page actuelle pour la sortie IA.",
    unableToCreateUserBlock: "Impossible de créer le bloc de l'échange utilisateur.",
    unableToReadBlocksNonCurrentPage:
      "Impossible de lire les blocs d'une page non courante sans prise en charge de getPageBlocksTree.",
    skippingShortcut:
      'Raccourci "{{binding}}" ignoré car il est déjà enregistré.',
    registeringModelSlashCommand:
      'Enregistrement de la commande slash "{{registered}}" pour "{{name}}" car "{{original}}" est déjà utilisé.',
    retryAfterFix: "Réessayez Demander à l'IA après avoir corrigé la connexion au fournisseur.",
    contextMenuAskAi: "Demander à l'IA",
    contextMenuAskWithHistory: "Demander à l'IA avec historique",
    contextMenuAskWithFullPage: "Demander à l'IA avec page complète",
    contextMenuSummarize: "Résumer avec l'IA",
  },
  settings: {
    providersJsonTitle: "JSON des fournisseurs",
    providersJsonDesc: "Tableau JSON des configurations de fournisseurs",
    modelsJsonTitle: "JSON des modèles",
    modelsJsonDesc: "Tableau JSON des configurations de modèles",
    defaultModelTitle: "Modèle par défaut",
    defaultModelDesc: "Nom du modèle à utiliser par défaut",
    shortcutBindingTitle: "Raccourci clavier",
    shortcutBindingDesc: "Raccourci clavier pour Demander à l'IA",
    prependAssistantLabelTitle: "Préfixer les réponses avec [assistant]",
    prependAssistantLabelDesc:
      "Contrôle uniquement les préfixes des réponses tels que [assistant]. Ne modifie pas le formatage des blocs [erreur].",
    askWithHistoryShortcutTitle: "Raccourci Demander avec historique",
    askWithHistoryShortcutDesc: "Raccourci clavier optionnel pour Demander avec historique IA",
    askWithFullPageShortcutTitle: "Raccourci Demander avec page complète",
    askWithFullPageShortcutDesc: "Raccourci clavier optionnel pour Demander avec contexte de page complète",
    aiSummarizeShortcutTitle: "Raccourci Résumer avec l'IA",
    aiSummarizeShortcutDesc: "Raccourci clavier optionnel pour Résumer avec l'IA",
    modelMissingProvider: 'Le modèle "{{model}}" référence un fournisseur manquant "{{provider}}"',
    defaultModelNotConfigured: 'Le modèle par défaut "{{model}}" n\'est pas configuré',
    shortcutMustNotBeEmpty: "Le raccourci clavier ne doit pas être vide",
  },
  blocks: {
    user: "[utilisateur]",
    assistant: "[assistant]",
    noResponse: "[sans réponse]",
    error: "[erreur]",
    interrupted: "[interrompu]",
    chatPageTitle: "Chat IA - {{date}}",
  },
  prompts: {
    defaultSystemPrompt: "Vous êtes un assistant IA utile.",
    summarizeBlock: "Résumez le contenu du bloc Logseq suivant\u00a0:\n\n{{content}}",
    pageContext: "Utilisez ce contexte de page comme référence pour répondre.\n\n{{context}}",
  },
  streaming: {
    frame0: "⌨️ saisie en cours...",
    frame1: "⌨️ saisie en cours.. ",
    frame2: "⌨️ saisie en cours.  ",
  },
};
