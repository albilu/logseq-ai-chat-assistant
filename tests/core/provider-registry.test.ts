import { describe, expect, it, vi } from "vitest";
import {
  createLLMProvider,
  getModelOrThrow,
  getProviderForModel,
  probeProvider
} from "../../src/core/provider-registry";
import { defaultSettings } from "../../src/core/settings";
import type { PluginSettings } from "../../src/core/types";
import { OllamaProvider } from "../../src/providers/llm/ollama";
import { OpenAIProvider } from "../../src/providers/llm/openai";

describe("probeProvider", () => {
  it("probes the correct endpoint for each provider type", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;

    await probeProvider({ name: "cloud", type: "openai", baseUrl: "https://api.example.com/v1", apiKey: "key" });
    await probeProvider({ name: "local", type: "ollama", baseUrl: "http://localhost:11434" });

    expect(fetch).toHaveBeenNthCalledWith(1, "https://api.example.com/v1/models", expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, "http://localhost:11434/api/tags", expect.any(Object));
  });

  it("aborts a stalled probe request after the timeout", async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new Error("Probe timed out"));
      });
    }));

    global.fetch = fetchSpy as typeof fetch;

    const probePromise = probeProvider({
      name: "cloud",
      type: "openai",
      baseUrl: "https://api.example.com/v1",
      apiKey: "key"
    });

    const probeExpectation = expect(probePromise).rejects.toThrow("Probe timed out");

    await vi.advanceTimersByTimeAsync(5000);

    await probeExpectation;
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/v1/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    vi.useRealTimers();
  });
});

describe("createLLMProvider", () => {
  it("creates an OpenAI provider for openai configs", () => {
    const provider = createLLMProvider(
      { name: "cloud", type: "openai", baseUrl: "https://api.example.com/v1", apiKey: "key" },
      { name: "chat", providerId: "cloud", modelId: "gpt-4o", systemPrompt: "help" }
    );

    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("creates an Ollama provider for ollama configs", () => {
    const provider = createLLMProvider(
      { name: "local", type: "ollama", baseUrl: "http://localhost:11434" },
      { name: "chat", providerId: "local", modelId: "llama3", systemPrompt: "help" }
    );

    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});

describe("provider lookup helpers", () => {
  const settings: PluginSettings = {
    ...defaultSettings,
    providers: [
      { name: "cloud", type: "openai", baseUrl: "https://api.example.com/v1", apiKey: "key" },
      { name: "local", type: "ollama", baseUrl: "http://localhost:11434" }
    ],
    models: [
      { name: "Chat", providerId: "cloud", modelId: "gpt-4o", systemPrompt: "help" },
      { name: "Local", providerId: "local", modelId: "llama3", systemPrompt: "help" }
    ],
    defaultModel: "Chat",
    shortcutBinding: "mod+shift+a"
  };

  it("returns a configured model by name", () => {
    expect(getModelOrThrow(settings, "Chat").modelId).toBe("gpt-4o");
  });

  it("throws when a model is missing", () => {
    expect(() => getModelOrThrow(settings, "Missing")).toThrow('Model "Missing" is not configured');
  });

  it("returns the provider for a configured model", () => {
    expect(getProviderForModel(settings, settings.models[1]).name).toBe("local");
  });

  it("throws when a model references a missing provider", () => {
    expect(() =>
      getProviderForModel(settings, {
        name: "Ghost",
        providerId: "missing",
        modelId: "ghost",
        systemPrompt: ""
      })
    ).toThrow('Provider "missing" is not configured');
  });
});
