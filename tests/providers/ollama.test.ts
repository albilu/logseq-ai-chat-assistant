import { beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "../../src/providers/llm/ollama";

function mockFetchNdjson(lines: string[]) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(lines.join("\n"), {
      headers: { "Content-Type": "application/x-ndjson" }
    })
  ) as typeof fetch;
}

describe("OllamaProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emits content chunks from an Ollama NDJSON response", async () => {
    const chunks: string[] = [];

    mockFetchNdjson([
      JSON.stringify({ message: { content: "Hello" } }),
      JSON.stringify({ message: { content: " world" } }),
      JSON.stringify({ done: true })
    ]);

    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      modelId: "llama3"
    });

    await provider.streamChat([{ role: "user", content: "Hi" }], (chunk) => chunks.push(chunk));

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("awaits each async chunk callback before reading the next line", async () => {
    const events: string[] = [];
    let releaseFirstChunk!: () => void;
    let notifyFirstChunkStarted!: () => void;
    const firstChunkHandled = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve;
    });
    const firstChunkStarted = new Promise<void>((resolve) => {
      notifyFirstChunkStarted = resolve;
    });

    mockFetchNdjson([
      JSON.stringify({ message: { content: "Hello" } }),
      JSON.stringify({ message: { content: " world" } }),
      JSON.stringify({ done: true })
    ]);

    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      modelId: "llama3"
    });

    let settled = false;
    const streamPromise = provider.streamChat([{ role: "user", content: "Hi" }], async (chunk) => {
      events.push(`start:${chunk}`);

      if (chunk === "Hello") {
        notifyFirstChunkStarted();
        await firstChunkHandled;
      }

      events.push(`end:${chunk}`);
    });
    streamPromise.then(() => {
      settled = true;
    });

    await firstChunkStarted;
    await Promise.resolve();

    expect(settled).toBe(false);

    releaseFirstChunk();
    await streamPromise;

    expect(events).toEqual([
      "start:Hello",
      "end:Hello",
      "start: world",
      "end: world"
    ]);
  });

  it("posts the configured request payload to the Ollama chat endpoint", async () => {
    mockFetchNdjson([JSON.stringify({ done: true })]);

    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      modelId: "llama3"
    });

    await provider.streamChat([{ role: "user", content: "Hi" }], vi.fn());

    expect(fetch).toHaveBeenCalledWith("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3",
        messages: [{ role: "user", content: "Hi" }],
        stream: true
      })
    });
  });

  it("throws a clear error when the Ollama response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error"
    }) as typeof fetch;

    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      modelId: "llama3"
    });

    await expect(provider.streamChat([{ role: "user", content: "Hi" }], vi.fn())).rejects.toThrow(
      "Ollama request failed: 500 Internal Server Error"
    );
  });

  it("throws a clear error when the Ollama response body is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null
    }) as typeof fetch;

    const provider = new OllamaProvider({
      baseUrl: "http://localhost:11434",
      modelId: "llama3"
    });

    await expect(provider.streamChat([{ role: "user", content: "Hi" }], vi.fn())).rejects.toThrow(
      "Ollama response body is missing"
    );
  });
});
