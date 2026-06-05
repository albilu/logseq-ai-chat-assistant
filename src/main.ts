import "@logseq/libs";

import { registerCommands } from "./core/commands";
import { createLogseqFetch } from "./core/logseq-fetch";
import { fetchProviderModels } from "./core/provider-registry";
import { parseSettings, getSettingsSchema, validateSettings } from "./core/settings";
import type { ModelConfig } from "./core/types";
import { initLocale, t } from "./i18n/index";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

type RuntimeWithShowMsg = typeof logseq & {
  App: {
    showMsg(message: string, level: "success" | "warning" | "error"): void;
    getUserConfigs?(): Promise<{ preferredLanguage: string }>;
  };
};

export async function main(runtime: typeof logseq = logseq) {
  const appRuntime = runtime as RuntimeWithShowMsg;

  // Create an IPC-bridged fetch that bypasses browser CORS restrictions.
  // Logseq plugins run inside a lsp://logseq.io iframe; native fetch to
  // localhost origins (Ollama, local OpenAI-compatible servers) is blocked
  // by CORS.  The IPC bridge routes requests through the Electron main
  // process which has no such restriction.
  const logseqFetch = createLogseqFetch(runtime as never);

  // Do NOT await initLocale here — getUserConfigs() is an IPC call that
  // deadlocks the Logseq handshake because the host won't process IPC
  // until the ready callback returns.  Locale defaults to English; the
  // background init below will activate the correct locale for all
  // runtime messages (commands, warnings, etc.) and refresh the schema
  // with localized labels.

  const settings = parseSettings(appRuntime.settings ?? {});

  console.info("[logseq-ai-chat-assistant] parsed settings", {
    providerNames: settings.providers.map((provider) => provider.name),
    modelNames: settings.models.map((model) => model.name),
    defaultModel: settings.defaultModel,
    shortcutBinding: settings.shortcutBinding
  });

  // Fetch available models from all configured providers, merging with any
  // existing manually-configured models. Returns the merged list, or undefined
  // if no providers are configured. Fetches all providers in parallel.
  async function syncModels(runtime: RuntimeWithShowMsg): Promise<ModelConfig[] | undefined> {
    const currentSettings = parseSettings(runtime.settings ?? {});
    console.debug("[logseq-ai-chat-assistant] syncModels start", {
      providerCount: currentSettings.providers.length,
      providers: currentSettings.providers.map(p => ({ name: p.name, type: p.type, baseUrl: p.baseUrl })),
      existingModelCount: currentSettings.models.length,
      existingModels: currentSettings.models.map(m => m.name)
    });

    if (currentSettings.providers.length === 0) {
      console.debug("[logseq-ai-chat-assistant] syncModels: no providers configured, skipping");
      return undefined;
    }

    const existingModels = new Map(currentSettings.models.map(m => [`${m.providerId}:${m.modelId}`, m]));
    const newModels: ModelConfig[] = [];

    // Fetch all providers in parallel for faster startup
    const providerResults = await Promise.all(
      currentSettings.providers.map(async (provider) => {
        const url = provider.type === "openai"
          ? `${provider.baseUrl}/models`
          : `${provider.baseUrl}/api/tags`;
        console.debug(`[logseq-ai-chat-assistant] syncModels: fetching from provider "${provider.name}"`, { url });
        try {
          const modelIds = await fetchProviderModels(provider, logseqFetch);
          console.debug(`[logseq-ai-chat-assistant] syncModels: provider "${provider.name}" returned ${modelIds.length} model(s)`, modelIds);
          return { provider, modelIds };
        } catch (error) {
          console.warn(`[logseq-ai-chat-assistant] syncModels: failed to fetch models for provider "${provider.name}"`, error);
          runtime.App.showMsg(t("ui.providerUnreachable", { name: provider.name, error: getErrorMessage(error) }), "warning");
          return { provider, modelIds: [] as string[] };
        }
      })
    );

    for (const { provider, modelIds } of providerResults) {
      for (const modelId of modelIds) {
        const key = `${provider.name}:${modelId}`;
        if (existingModels.has(key)) {
          console.debug(`[logseq-ai-chat-assistant] syncModels: keeping existing model for key "${key}"`);
          newModels.push(existingModels.get(key)!);
        } else {
          console.debug(`[logseq-ai-chat-assistant] syncModels: adding new model for key "${key}"`);
          newModels.push({
            name: `${provider.name} ${modelId}`,
            providerId: provider.name,
            modelId: modelId,
            systemPrompt: t("prompts.defaultSystemPrompt")
          });
        }
      }
    }

    // Preserve any manually-added models not returned by any provider
    const fetchedKeys = new Set(newModels.map(m => `${m.providerId}:${m.modelId}`));
    for (const model of currentSettings.models) {
      const key = `${model.providerId}:${model.modelId}`;
      if (!fetchedKeys.has(key)) {
        console.debug(`[logseq-ai-chat-assistant] syncModels: preserving manually-added model "${model.name}" (not returned by any provider)`);
        newModels.push(model);
      }
    }

    const newModelsJson = JSON.stringify(newModels);
    const currentModelsJson = JSON.stringify(currentSettings.models);
    const modelNames = new Set(newModels.map(m => m.name));
    const needsDefaultModel = newModels.length > 0 && !modelNames.has(currentSettings.defaultModel);

    if (newModelsJson !== currentModelsJson || needsDefaultModel) {
      const settingsUpdate: Record<string, string> = {};

      if (newModelsJson !== currentModelsJson) {
        console.info("[logseq-ai-chat-assistant] syncModels: writing updated model list", {
          before: currentSettings.models.map(m => m.name),
          after: newModels.map(m => m.name)
        });
        settingsUpdate.models = JSON.stringify(newModels, null, 2);
      }

      if (needsDefaultModel) {
        console.info("[logseq-ai-chat-assistant] syncModels: auto-selecting default model", {
          previous: currentSettings.defaultModel,
          selected: newModels[0].name
        });
        settingsUpdate.defaultModel = newModels[0].name;
      }

      runtime.updateSettings(settingsUpdate);
    } else {
      console.debug("[logseq-ai-chat-assistant] syncModels: model list unchanged, skipping updateSettings");
    }

    return newModels;
  }

  // Register settings schema immediately with cached models so the UI is
  // responsive right away. Background model sync will update it later.
  console.info("[logseq-ai-chat-assistant] registering settings schema", {
    modelCount: settings.models.length,
    modelNames: settings.models.map(m => m.name)
  });
  appRuntime.useSettingsSchema(getSettingsSchema(settings.models));

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

  appRuntime.onSettingsChanged(async (newSettingsRaw, oldSettingsRaw) => {
    const newSettings = parseSettings(newSettingsRaw);
    const oldSettings = parseSettings(oldSettingsRaw);

    if (JSON.stringify(newSettings.models) !== JSON.stringify(oldSettings.models)) {
      console.debug("[logseq-ai-chat-assistant] onSettingsChanged: models changed, refreshing schema", {
        modelNames: newSettings.models.map(m => m.name)
      });
      appRuntime.useSettingsSchema(getSettingsSchema(newSettings.models));
    }

    if (JSON.stringify(newSettings.providers) !== JSON.stringify(oldSettings.providers)) {
      console.debug("[logseq-ai-chat-assistant] onSettingsChanged: providers changed, re-syncing models");
      const synced = await syncModels(appRuntime);
      if (synced) {
        appRuntime.useSettingsSchema(getSettingsSchema(synced));
      }
    }
  });

  await registerCommands(appRuntime, settings, logseqFetch);

  // Background work — none of this blocks the Logseq handshake.

  // 1. Activate the user's locale and refresh settings labels.
  //    Must happen after the handshake so getUserConfigs() IPC succeeds.
  initLocale(appRuntime)
    .then(() => {
      console.info("[logseq-ai-chat-assistant] locale initialized, refreshing schema");
      appRuntime.useSettingsSchema(getSettingsSchema(settings.models));
    })
    .catch(error => {
      console.warn("[logseq-ai-chat-assistant] locale init failed, keeping English defaults", error);
    });

  // 2. Sync models from configured providers.
  //    Provider reachability is checked here instead of a separate probe step.
  console.debug("[logseq-ai-chat-assistant] starting background model sync");
  syncModels(appRuntime)
    .then(syncedModels => {
      if (syncedModels) {
        console.info("[logseq-ai-chat-assistant] background sync complete, updating schema", {
          modelCount: syncedModels.length,
          modelNames: syncedModels.map(m => m.name)
        });
        appRuntime.useSettingsSchema(getSettingsSchema(syncedModels));
      }
    })
    .catch(error => {
      console.warn("[logseq-ai-chat-assistant] background model sync failed", error);
    });
}

if (typeof globalThis.logseq !== "undefined" && typeof globalThis.logseq.ready === "function") {
  globalThis.logseq.ready(() => main(globalThis.logseq));
}
