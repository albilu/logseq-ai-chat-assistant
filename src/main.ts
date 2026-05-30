import "@logseq/libs";

import { registerCommands } from "./core/commands";
import { probeProvider } from "./core/provider-registry";
import { parseSettings, settingsSchema, validateSettings } from "./core/settings";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

type RuntimeWithShowMsg = typeof logseq & {
  App: {
    showMsg(message: string, level: "success" | "warning" | "error"): void;
  };
};

export async function main(runtime: typeof logseq = logseq) {
  const appRuntime = runtime as RuntimeWithShowMsg;

  appRuntime.useSettingsSchema(settingsSchema);

  const settings = parseSettings(appRuntime.settings ?? {});
  console.info("[logseq-ai-chat-assistant] parsed settings", {
    providerNames: settings.providers.map((provider) => provider.name),
    modelNames: settings.models.map((model) => model.name),
    defaultModel: settings.defaultModel,
    shortcutBinding: settings.shortcutBinding
  });
  const validation = validateSettings(settings);

  if (validation.issues.length > 0) {
    console.warn("[logseq-ai-chat-assistant] settings validation issues", {
      issues: validation.issues,
      providerNames: settings.providers.map((provider) => provider.name),
      modelNames: settings.models.map((model) => model.name),
      defaultModel: settings.defaultModel
    });
  }

  for (const issue of validation.issues) {
    appRuntime.App.showMsg(issue, "warning");
  }

  for (const provider of settings.providers) {
    try {
      await probeProvider(provider);
    } catch (error) {
      appRuntime.App.showMsg(`Provider "${provider.name}" is unreachable: ${getErrorMessage(error)}`, "warning");
    }
  }

  await registerCommands(appRuntime, settings);
}

if (typeof globalThis.logseq !== "undefined" && typeof globalThis.logseq.ready === "function") {
  globalThis.logseq.ready(() => main(globalThis.logseq));
}
