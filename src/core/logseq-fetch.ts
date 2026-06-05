/**
 * Routes HTTP requests through Logseq's IPC bridge, bypassing browser CORS
 * restrictions that block direct fetches from the lsp://logseq.io origin.
 *
 * Uses the postMessage IPC channel (`caller.callAsync`) instead of
 * `logseq.Request._request()`, which accesses `window.top` directly and
 * fails with a DOMException in cross-origin iframe plugins.
 *
 * Falls back to `logseq.Request._request()` if the postMessage path is
 * unavailable (e.g. older Logseq versions that do not expose
 * `exper_request` via `api:call`).
 */

const REQUEST_TIMEOUT_MS = 30_000;

interface LogseqRuntime {
  baseInfo: { id: string };
  caller: {
    callAsync(type: string, payload?: unknown): Promise<unknown>;
  };
  Request: {
    once(event: string, callback: (result: unknown) => void): void;
    _request(options: Record<string, unknown>): Promise<unknown>;
  };
}

async function fetchViaPostMessage(
  runtime: LogseqRuntime,
  urlStr: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    data?: unknown;
  } = {}
): Promise<string> {
  const pluginId = runtime.baseInfo.id;

  const requestId = (await runtime.caller.callAsync("api:call", {
    method: "exper_request",
    args: [
      pluginId,
      {
        url: urlStr,
        method: options.method ?? "GET",
        headers: options.headers,
        data: options.data,
        returnType: "text"
      }
    ]
  })) as string | number | undefined;

  if (!requestId) {
    throw new TypeError(`Logseq host did not return a request ID for ${urlStr}`);
  }

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TypeError(`Request to ${urlStr} timed out after ${REQUEST_TIMEOUT_MS}ms`));
    }, REQUEST_TIMEOUT_MS);

    runtime.Request.once(`task_callback_${requestId}`, (result: unknown) => {
      clearTimeout(timer);

      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result as string);
      }
    });
  });
}

/**
 * Returns a fetch-compatible implementation that routes requests through
 * Logseq's host process, bypassing browser CORS restrictions that block
 * direct fetches from the lsp://logseq.io origin.
 *
 * For streaming endpoints (SSE / NDJSON), the host buffers the entire
 * response and returns it at once. The existing streaming parsers still
 * work because they split by newlines regardless of chunk boundaries.
 */
export function createLogseqFetch(runtime: LogseqRuntime): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    const method = init?.method ?? "GET";

    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headers[key] = value;
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    let data: unknown;
    if (init?.body) {
      if (typeof init.body === "string") {
        try {
          data = JSON.parse(init.body);
        } catch {
          data = init.body;
        }
      } else {
        data = init.body;
      }
    }

    try {
      const text = await fetchViaPostMessage(runtime, urlStr, { method, headers, data });
      return new Response(text, { status: 200 });
    } catch {
      // Fallback: try the legacy SDK method which uses window.top access.
      // This still works when the plugin runs in shadow-mode or when
      // window.top is same-origin (e.g. some desktop Logseq builds).
      const text = (await runtime.Request._request({
        url: urlStr,
        method,
        headers,
        data,
        returnType: "text"
      })) as string;

      return new Response(text, { status: 200 });
    }
  };
}
