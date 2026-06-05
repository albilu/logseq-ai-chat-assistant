import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogseqFetch } from "../../src/core/logseq-fetch";

function createMockRuntime(overrides: {
  callAsyncResult?: unknown;
  callAsyncError?: Error;
  taskCallbackResult?: unknown;
  requestResult?: unknown;
  requestError?: Error;
} = {}) {
  const runtime = {
    baseInfo: { id: "test-plugin-id" },
    caller: {
      callAsync: vi.fn().mockImplementation(async () => {
        if (overrides.callAsyncError) {
          throw overrides.callAsyncError;
        }
        return "callAsyncResult" in overrides ? overrides.callAsyncResult : "req-123";
      })
    },
    Request: {
      once: vi.fn().mockImplementation((_event: string, callback: (result: unknown) => void) => {
        // Auto-fire the callback on next microtask to avoid race conditions
        queueMicrotask(() => callback(overrides.taskCallbackResult ?? "{}"));
      }),
      _request: vi.fn().mockImplementation(async () => {
        if (overrides.requestError) {
          throw overrides.requestError;
        }
        return overrides.requestResult ?? "fallback-response";
      })
    }
  };

  return { runtime };
}

describe("createLogseqFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes a GET request through the postMessage IPC channel", async () => {
    const { runtime } = createMockRuntime({ taskCallbackResult: '{"models":[]}' });

    const logseqFetch = createLogseqFetch(runtime);
    const response = await logseqFetch("http://127.0.0.1:11434/api/tags");

    expect(runtime.caller.callAsync).toHaveBeenCalledWith("api:call", {
      method: "exper_request",
      args: [
        "test-plugin-id",
        {
          url: "http://127.0.0.1:11434/api/tags",
          method: "GET",
          headers: {},
          data: undefined,
          returnType: "text"
        }
      ]
    });

    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe('{"models":[]}');
  });

  it("routes a POST request with JSON body through IPC", async () => {
    const { runtime } = createMockRuntime({
      taskCallbackResult: '{"message":{"content":"Hello"},"done":true}'
    });

    const logseqFetch = createLogseqFetch(runtime);
    const body = JSON.stringify({ model: "llama3", messages: [{ role: "user", content: "Hi" }], stream: true });

    const response = await logseqFetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    expect(runtime.caller.callAsync).toHaveBeenCalledWith("api:call", {
      method: "exper_request",
      args: [
        "test-plugin-id",
        {
          url: "http://127.0.0.1:11434/api/chat",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: { model: "llama3", messages: [{ role: "user", content: "Hi" }], stream: true },
          returnType: "text"
        }
      ]
    });

    expect(await response.text()).toBe('{"message":{"content":"Hello"},"done":true}');
  });

  it("passes Authorization header through IPC", async () => {
    const { runtime } = createMockRuntime({ taskCallbackResult: '{"data":[]}' });

    const logseqFetch = createLogseqFetch(runtime);
    await logseqFetch("https://api.openai.com/v1/models", {
      headers: { Authorization: "Bearer sk-test" }
    });

    expect(runtime.caller.callAsync).toHaveBeenCalledWith("api:call", {
      method: "exper_request",
      args: [
        "test-plugin-id",
        expect.objectContaining({
          headers: { Authorization: "Bearer sk-test" }
        })
      ]
    });
  });

  it("falls back to _request when postMessage IPC fails", async () => {
    const { runtime } = createMockRuntime({
      callAsyncError: new Error("IPC unavailable"),
      requestResult: '{"models":[]}'
    });

    const logseqFetch = createLogseqFetch(runtime);
    const response = await logseqFetch("http://127.0.0.1:11434/api/tags");

    expect(runtime.Request._request).toHaveBeenCalledWith({
      url: "http://127.0.0.1:11434/api/tags",
      method: "GET",
      headers: {},
      data: undefined,
      returnType: "text"
    });

    expect(await response.text()).toBe('{"models":[]}');
  });

  it("falls back to _request for POST when postMessage IPC fails", async () => {
    const { runtime } = createMockRuntime({
      callAsyncError: new Error("IPC unavailable"),
      requestResult: '{"message":{"content":"Hello"},"done":true}'
    });

    const logseqFetch = createLogseqFetch(runtime);
    const body = JSON.stringify({ model: "llama3", messages: [], stream: false });

    const response = await logseqFetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    expect(runtime.Request._request).toHaveBeenCalledWith({
      url: "http://127.0.0.1:11434/api/chat",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: { model: "llama3", messages: [], stream: false },
      returnType: "text"
    });

    expect(await response.text()).toBe('{"message":{"content":"Hello"},"done":true}');
  });

  it("rejects when both IPC and _request fail", async () => {
    const { runtime } = createMockRuntime({
      callAsyncError: new Error("IPC unavailable"),
      requestError: new Error("_request also failed")
    });

    const logseqFetch = createLogseqFetch(runtime);

    await expect(logseqFetch("http://127.0.0.1:11434/api/tags")).rejects.toThrow(
      "_request also failed"
    );
  });

  it("rejects when the host returns no request ID and _request fails", async () => {
    const { runtime } = createMockRuntime({
      callAsyncResult: undefined,
      requestError: new Error("_request failed too")
    });

    const logseqFetch = createLogseqFetch(runtime);

    await expect(logseqFetch("http://127.0.0.1:11434/api/tags")).rejects.toThrow(
      "_request failed too"
    );
  });

  it("returns a Response whose body is streamable by ReadableStream readers", async () => {
    const ndjsonPayload = [
      '{"message":{"content":"Hello"},"done":false}',
      '{"message":{"content":" world"},"done":false}',
      '{"message":{"content":""},"done":true}'
    ].join("\n");

    const { runtime } = createMockRuntime({ taskCallbackResult: ndjsonPayload });

    const logseqFetch = createLogseqFetch(runtime);
    const response = await logseqFetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3", messages: [], stream: true })
    });

    // Verify the response body is readable via getReader()
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    expect(result).toBe(ndjsonPayload);
  });

  it("accepts a URL object as input", async () => {
    const { runtime } = createMockRuntime();

    const logseqFetch = createLogseqFetch(runtime);
    await logseqFetch(new URL("http://127.0.0.1:11434/api/tags"));

    expect(runtime.caller.callAsync).toHaveBeenCalledWith("api:call", {
      method: "exper_request",
      args: [
        "test-plugin-id",
        expect.objectContaining({
          url: "http://127.0.0.1:11434/api/tags"
        })
      ]
    });
  });

  it("handles Headers object in init", async () => {
    const { runtime } = createMockRuntime();

    const headers = new Headers();
    headers.set("Authorization", "Bearer sk-test");
    headers.set("Content-Type", "application/json");

    const logseqFetch = createLogseqFetch(runtime);
    await logseqFetch("http://example.com/api", { headers });

    expect(runtime.caller.callAsync).toHaveBeenCalledWith("api:call", {
      method: "exper_request",
      args: [
        "test-plugin-id",
        expect.objectContaining({
          headers: {
            authorization: "Bearer sk-test",
            "content-type": "application/json"
          }
        })
      ]
    });
  });

  it("registers the once listener with the correct event name", async () => {
    const { runtime } = createMockRuntime({ callAsyncResult: "my-req-42" });

    const logseqFetch = createLogseqFetch(runtime);
    await logseqFetch("http://127.0.0.1:11434/api/tags");

    expect(runtime.Request.once).toHaveBeenCalledWith(
      "task_callback_my-req-42",
      expect.any(Function)
    );
  });
});
