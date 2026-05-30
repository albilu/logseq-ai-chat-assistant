# Logseq AI Chat Assistant

# logseq ai-chat-assistant

## Features:

- Multi LLM provider support (openai specification, ollama)
- Multi models configuration
- Easy integration with Logseq
    - Shortcut/Slash/Block context actions
        - Ask AI
        - Summarize
        - /ask-{{model}}
    - Stream responses in real-time with (thinking, typing)
- Page Conversation history with

## Similar plugins:

https://github.com/ahonn/logseq-plugin-ai-assistant
https://github.com/briansunter/logseq-plugin-gpt3-openai

## Development

```bash
npm install
npm run test
npm run build
```

Configure providers and models in the Logseq plugin settings, then use:

- `Ask AI`
- `Summarize`
- `/ask-<model>`
- `Mod+Shift+A`

Selected text is used first. If nothing is selected, the focused block content is used.
