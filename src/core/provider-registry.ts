import type { ModelConfig, PluginSettings, ProviderConfig } from "./types";
import type { LLMProvider } from "../providers/llm/interface";
import { OllamaProvider } from "../providers/llm/ollama";
import { OpenAIProvider } from "../providers/llm/openai";

const PROBE_TIMEOUT_MS = 5000;

export function createLLMProvider(provider: ProviderConfig, model: ModelConfig): LLMProvider {
  if (provider.type === "openai") {
    return new OpenAIProvider({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey ?? "",
      modelId: model.modelId
    });
  }

  return new OllamaProvider({
    baseUrl: provider.baseUrl,
    modelId: model.modelId
  });
}

export async function probeProvider(provider: ProviderConfig) {
  const url = provider.type === "openai"
    ? `${provider.baseUrl}/models`
    : `${provider.baseUrl}/api/tags`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Probe timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getModelOrThrow(settings: PluginSettings, modelName: string) {
  const model = settings.models.find((candidate) => candidate.name === modelName);

  if (!model) {
    console.warn("[logseq-ai-chat-assistant] model lookup failed", {
      requestedModel: modelName,
      availableModels: settings.models.map((candidate) => candidate.name)
    });
    throw new Error(`Model "${modelName}" is not configured`);
  }

  return model;
}

export function getProviderForModel(settings: PluginSettings, model: ModelConfig) {
  const provider = settings.providers.find((candidate) => candidate.name === model.providerId);

  if (!provider) {
    console.warn("[logseq-ai-chat-assistant] provider lookup failed", {
      requestedProvider: model.providerId,
      modelName: model.name,
      availableProviders: settings.providers.map((candidate) => candidate.name)
    });
    throw new Error(`Provider "${model.providerId}" is not configured`);
  }

  return provider;
}
