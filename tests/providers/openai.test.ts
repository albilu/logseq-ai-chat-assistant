import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../../src/providers/llm/openai";

function mockFetchSSE(lines: string[]) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(lines.join("\n\n"), {
      headers: { "Content-Type": "text/event-stream" }
    })
  ) as typeof fetch;
}

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emits delta chunks from an OpenAI-compatible SSE response", async () => {
    const chunks: string[] = [];

    mockFetchSSE([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      "data: [DONE]"
    ]);

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "gpt-4o"
    });

    await provider.streamChat([{ role: "user", content: "Hi" }], (chunk) => chunks.push(chunk));

    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("awaits each async chunk callback before reading the next delta", async () => {
    const events: string[] = [];
    let releaseFirstChunk!: () => void;
    let notifyFirstChunkStarted!: () => void;
    const firstChunkHandled = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve;
    });
    const firstChunkStarted = new Promise<void>((resolve) => {
      notifyFirstChunkStarted = resolve;
    });

    mockFetchSSE([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      "data: [DONE]"
    ]);

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "gpt-4o"
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

  it("posts the configured request payload to the chat completions endpoint", async () => {
    mockFetchSSE(["data: [DONE]"]);

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "gpt-4o"
    });

    await provider.streamChat([{ role: "user", content: "Hi" }], vi.fn());

    expect(fetch).toHaveBeenCalledWith("https://api.example.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer key"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        stream: true
      })
    });
  });

  it("omits the authorization header when the api key is empty", async () => {
    mockFetchSSE(["data: [DONE]"]);

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "",
      modelId: "gpt-4o"
    });

    await provider.streamChat([{ role: "user", content: "Hi" }], vi.fn());

    expect(fetch).toHaveBeenCalledWith("https://api.example.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        stream: true
      })
    });
  });

  it("throws a clear error when the OpenAI response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized"
    }) as typeof fetch;

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "gpt-4o"
    });

    await expect(provider.streamChat([{ role: "user", content: "Hi" }], vi.fn())).rejects.toThrow(
      "OpenAI request failed: 401 Unauthorized"
    );
  });

  it("throws a clear error when the OpenAI response body is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null
    }) as typeof fetch;

    const provider = new OpenAIProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "key",
      modelId: "gpt-4o"
    });

    await expect(provider.streamChat([{ role: "user", content: "Hi" }], vi.fn())).rejects.toThrow(
      "OpenAI response body is missing"
    );
  });
});
