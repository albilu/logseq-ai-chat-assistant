import "@logseq/libs";

import { registerCommands } from "./core/commands";
import { fetchProviderModels, probeProvider } from "./core/provider-registry";
import { parseSettings, getSettingsSchema, validateSettings } from "./core/settings";
import type { ModelConfig } from "./core/types";

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

  const settings = parseSettings(appRuntime.settings ?? {});

  console.info("[logseq-ai-chat-assistant] parsed settings", {
    providerNames: settings.providers.map((provider) => provider.name),
    modelNames: settings.models.map((model) => model.name),
    defaultModel: settings.defaultModel,
    shortcutBinding: settings.shortcutBinding
  });

  for (const provider of settings.providers) {
    try {
      await probeProvider(provider);
    } catch (error) {
      appRuntime.App.showMsg(`Provider "${provider.name}" is unreachable: ${getErrorMessage(error)}`, "warning");
    }
  }

  // Fetch available models from all configured providers, merging with any
  // existing manually-configured models. Returns the merged list, or undefined
  // if no providers are configured.
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

    for (const provider of currentSettings.providers) {
      const url = provider.type === "openai"
        ? `${provider.baseUrl}/models`
        : `${provider.baseUrl}/api/tags`;
      console.debug(`[logseq-ai-chat-assistant] syncModels: fetching from provider "${provider.name}"`, { url });
      try {
        const modelIds = await fetchProviderModels(provider);
        console.debug(`[logseq-ai-chat-assistant] syncModels: provider "${provider.name}" returned ${modelIds.length} model(s)`, modelIds);
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
              systemPrompt: "You are a helpful AI assistant."
            });
          }
        }
      } catch (error) {
        console.warn(`[logseq-ai-chat-assistant] syncModels: failed to fetch models for provider "${provider.name}"`, error);
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
    if (newModelsJson !== currentModelsJson) {
      console.info("[logseq-ai-chat-assistant] syncModels: writing updated model list", {
        before: currentSettings.models.map(m => m.name),
        after: newModels.map(m => m.name)
      });
      runtime.updateSettings({ models: JSON.stringify(newModels, null, 2) });
    } else {
      console.debug("[logseq-ai-chat-assistant] syncModels: model list unchanged, skipping updateSettings");
    }

    return newModels;
  }

  // Fetch and persist models BEFORE calling useSettingsSchema so the
  // defaultModel enum dropdown is pre-populated when the settings panel opens.
  console.debug("[logseq-ai-chat-assistant] starting model sync");
  const syncedModels = await syncModels(appRuntime);
  const finalModels = syncedModels ?? settings.models;
  console.info("[logseq-ai-chat-assistant] registering settings schema", {
    modelCount: finalModels.length,
    modelNames: finalModels.map(m => m.name)
  });
  appRuntime.useSettingsSchema(getSettingsSchema(finalModels));

  const finalSettings = { ...settings, models: finalModels };

  const validation = validateSettings(finalSettings);
  if (validation.issues.length > 0) {
    console.warn("[logseq-ai-chat-assistant] settings validation issues", {
      issues: validation.issues,
      providerNames: finalSettings.providers.map((provider) => provider.name),
      modelNames: finalSettings.models.map((model) => model.name),
      defaultModel: finalSettings.defaultModel
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

  await registerCommands(appRuntime, finalSettings);
}

if (typeof globalThis.logseq !== "undefined" && typeof globalThis.logseq.ready === "function") {
  globalThis.logseq.ready(() => main(globalThis.logseq));
}
