import type { ChatMessage, LLMProvider } from "./interface";

interface OllamaProviderConfig {
  baseUrl: string;
  modelId: string;
}

async function* readNdjsonLines(response: Response) {
  const body = response.body;

  if (!body) {
    throw new Error("Ollama response body is missing");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (part) {
        yield part;
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer) {
    yield buffer;
  }
}

export class OllamaProvider implements LLMProvider {
  constructor(private readonly config: OllamaProviderConfig) {}

  async streamChat(messages: ChatMessage[], onChunk: (chunk: string) => void | Promise<void>) {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.modelId, messages, stream: true })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`.trim());
    }

    for await (const line of readNdjsonLines(response)) {
      const payload = JSON.parse(line) as {
        message?: { content?: string };
        done?: boolean;
      };
      const delta = payload.message?.content;

      if (delta) {
        await onChunk(delta);
      }

      if (payload.done) {
        break;
      }
    }
  }
}
