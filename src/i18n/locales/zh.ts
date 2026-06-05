// src/i18n/locales/zh.ts
import type { Translations } from "../types";

export const zh: Translations = {
  ui: {
    providerUnreachable: '提供商"{{name}}"无法连接：{{error}}',
    selectTextOrBlock: "请先选择文本或聚焦到一个块。",
    unableToResolvePage: "无法解析当前页面以输出 AI 内容。",
    unableToCreateUserBlock: "无法创建用户对话块。",
    unableToReadBlocksNonCurrentPage:
      "在不支持 getPageBlocksTree 的情况下，无法读取非当前页面的块。",
    skippingShortcut: '快捷键"{{binding}}"已注册，跳过。',
    registeringModelSlashCommand:
      '由于"{{original}}"已被占用，将为"{{name}}"注册斜杠命令"{{registered}}"。',
    retryAfterFix: "修复提供商连接后，请重试 AI 提问。",
    contextMenuAskAi: "提问 AI",
    contextMenuAskWithHistory: "带历史记录提问 AI",
    contextMenuAskWithFullPage: "带完整页面提问 AI",
    contextMenuSummarize: "AI 摘要",
    slashAskAi: "提问AI",
    slashAskWithHistory: "带历史提问AI",
    slashAskWithFullPage: "带页面提问AI",
    slashSummarize: "AI摘要",
  },
  settings: {
    providersJsonTitle: "提供商 JSON",
    providersJsonDesc: "提供商配置的 JSON 数组",
    modelsJsonTitle: "模型 JSON",
    modelsJsonDesc: "模型配置的 JSON 数组",
    defaultModelTitle: "默认模型",
    defaultModelDesc: "要运行的默认模型名称",
    shortcutBindingTitle: "快捷键",
    shortcutBindingDesc: "提问 AI 的键盘快捷键",
    prependAssistantLabelTitle: "在助手回复前添加 [assistant] 标签",
    prependAssistantLabelDesc:
      "仅控制助手回复的前缀（如 [assistant]），不影响 [error] 块的格式。",
    askWithHistoryShortcutTitle: "带历史记录提问的快捷键",
    askWithHistoryShortcutDesc: "带 AI 历史记录提问的可选快捷键",
    askWithFullPageShortcutTitle: "带完整页面提问的快捷键",
    askWithFullPageShortcutDesc: "带完整页面上下文提问的可选快捷键",
    aiSummarizeShortcutTitle: "AI 摘要快捷键",
    aiSummarizeShortcutDesc: "AI 摘要的可选快捷键",
    modelMissingProvider: '模型"{{model}}"引用了不存在的提供商"{{provider}}"',
    defaultModelNotConfigured: '默认模型"{{model}}"未配置',
    shortcutMustNotBeEmpty: "快捷键不能为空",
  },
  blocks: {
    user: "[用户]",
    assistant: "[助手]",
    noResponse: "[无响应]",
    error: "[错误]",
    interrupted: "[已中断]",
    chatPageTitle: "AI 对话 - {{date}}",
  },
  prompts: {
    defaultSystemPrompt: "你是一个有用的 AI 助手。",
    summarizeBlock: "请总结以下 Logseq 块内容：\n\n{{content}}",
    pageContext: "请将以下页面内容作为参考来回答问题。\n\n{{context}}",
  },
  streaming: {
    frame0: "⌨️ 正在输入...",
    frame1: "⌨️ 正在输入.. ",
    frame2: "⌨️ 正在输入.  ",
  },
};
