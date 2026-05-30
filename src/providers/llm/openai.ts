import type { ChatMessage, LLMProvider } from "./interface";

interface OpenAIProviderConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

async function* readSseLines(response: Response) {
  const body = response.body;

  if (!body) {
    throw new Error("OpenAI response body is missing");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) {
          yield line.slice(6);
        }
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer) {
    for (const line of buffer.split("\n")) {
      if (line.startsWith("data: ")) {
        yield line.slice(6);
      }
    }
  }
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly config: OpenAIProviderConfig) {}

  async streamChat(messages: ChatMessage[], onChunk: (chunk: string) => void | Promise<void>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.config.modelId, messages, stream: true })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`.trim());
    }

    for await (const line of readSseLines(response)) {
      if (line === "[DONE]") {
        break;
      }

      const payload = JSON.parse(line) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = payload.choices?.[0]?.delta?.content;

      if (delta) {
        await onChunk(delta);
      }
    }
  }
}
