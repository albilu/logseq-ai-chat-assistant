# Logseq AI Chat Assistant

A powerful Logseq plugin that brings AI chat capabilities directly into your knowledge base with support for multiple LLM providers.

## Demo

![Logseq AI Chat Assistant Demo](./demo.gif)

## Features

- **Multi LLM Provider Support**
    - OpenAI-compatible APIs
    - Ollama for local models
- **Multiple Model Configuration**
    - Configure and switch between different AI models
    - Custom system prompts per model
- **Seamless Logseq Integration**
    - Keyboard shortcuts (default: `Mod+Shift+Enter`)
    - Slash commands: `/ask-ai`, `/ask-with-ai-history`, `/ask-with-full-page-context`, `/ai-summarize`
    - Per-model slash commands: `/ask-{{model}}`
    - Block context menu actions
- **Real-time Streaming Responses**
    - Live streaming with visual indicators (thinking, typing)
    - See AI responses as they're generated
- **Conversation History**
    - Maintains page-level conversation context
    - Ask with AI history for contextual follow-ups
    - Full page context support

## Installation

### From Logseq Marketplace (Recommended)

1. Open Logseq
2. Go to `Settings` → `Plugins` → `Marketplace`
3. Search for "AI Chat Assistant"
4. Click `Install`

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/albilu/logseq-ai-chat-assistant/releases)
2. Extract the zip file
3. In Logseq, go to `Settings` → `Advanced` → Enable `Developer mode`
4. Go to `Plugins` → `Load unpacked plugin`
5. Select the extracted folder

## Configuration

1. Open Logseq Settings → Plugin Settings → AI Chat Assistant
2. Configure your providers (OpenAI or Ollama)
3. Select your default model
4. Customize keyboard shortcuts (optional)

## Usage

### Quick Start

1. Select text or focus on a block
2. Press `Mod+Shift+Enter` (or your configured shortcut)
3. The AI will respond in a new block below

### Available Commands

**Slash Commands:**

- `/ask-ai` - Ask AI with last exchange context
- `/ask-with-ai-history` - Ask with full AI conversation history
- `/ask-with-full-page-context` - Ask with entire page content as context
- `/ai-summarize` - Summarize selected content
- `/ask-{{model}}` - Ask using a specific model

**Block Context Menu:**
Right-click any block to access:

- Ask AI
- Ask With AI History
- Ask With Full Page Context
- AI Summarize

**Keyboard Shortcuts:**
Configure custom shortcuts in plugin settings for quick access to any command.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm run test

# Build plugin
npm run build

# Watch mode for development
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/albilu/logseq-ai-chat-assistant/issues) on GitHub.
