export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  streamChat(messages: ChatMessage[], onChunk: (chunk: string) => void | Promise<void>): Promise<void>;
}
