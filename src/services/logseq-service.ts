import { STREAMING_MARKER } from "../ui/streaming-indicator";

const ASSISTANT_PLACEHOLDER_TEXT = STREAMING_MARKER === "[typing...]"
  ? "⌨️ typing..."
  : STREAMING_MARKER;

type BlockEntity = {
  uuid: string;
  content?: string;
  page?: PageEntity | null;
  children?: BlockTreeNode[];
};

type PageEntity = {
  uuid: string;
  name?: string;
  properties?: Record<string, unknown>;
};

type ResolvedPage = {
  uuid: string;
  name?: string;
};

type BlockTreeNode = {
  content?: string;
  children?: BlockTreeNode[];
};

type InsertBlockOptions = {
  sibling: boolean;
  before: boolean;
};

type CreatePageOptions = {
  createFirstBlock: boolean;
};

type LogseqServiceOptions = {
  prependAssistantLabel?: boolean;
};

type LogseqApi = {
  Editor: {
    getCurrentBlock(): Promise<BlockEntity | null>;
    getPage(pageIdentifier: string): Promise<PageEntity | null>;
    getCurrentPage(): Promise<PageEntity | null>;
    getPageBlocksTree?(pageIdentifier: string): Promise<BlockTreeNode[]>;
    getCurrentPageBlocksTree(pageIdentifier?: string): Promise<BlockTreeNode[]>;
    createPage(title: string, properties: Record<string, never>, options: CreatePageOptions): Promise<PageEntity | null>;
    insertBlock(parentUuid: string, content: string, options: InsertBlockOptions): Promise<BlockEntity | null>;
    updateBlock(blockUuid: string, content: string): Promise<unknown>;
  };
  App: {
    showMsg(message: string, level: "success" | "warning" | "error"): void;
  };
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatConversationTitle(date: Date) {
  return `AI Chat - ${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export class LogseqService {
  constructor(
    private readonly api: LogseqApi,
    private readonly options: LogseqServiceOptions = {},
    private readonly now: () => Date = () => new Date()
  ) {}

  async getPromptSource() {
    const selectedText = this.getSelectedText();
    const block = await this.api.Editor.getCurrentBlock();

    if (selectedText) {
      return {
        text: selectedText,
        replyTargetBlockUuid: block?.uuid ?? null
      };
    }

    return {
      text: block?.content?.trim() ?? "",
      replyTargetBlockUuid: block?.uuid ?? null
    };
  }

  async getPromptSourceText() {
    const promptSource = await this.getPromptSource();
    return promptSource.text;
  }

  async createConversationPage() {
    const title = formatConversationTitle(this.now());
    return this.api.Editor.createPage(title, {}, { createFirstBlock: true });
  }

  async resolveCurrentPage() {
    const selectedText = this.getSelectedText();
    const block = await this.api.Editor.getCurrentBlock();
    const pageFromBlock = await this.resolvePageFromBlock(block);

    if (pageFromBlock) {
      return pageFromBlock;
    }

    if (selectedText) {
      if (block) {
        return null;
      }

      return this.api.Editor.getCurrentPage();
    }

    return this.api.Editor.getCurrentPage();
  }

  private async resolvePageFromBlock(block: BlockEntity | null) {
    const pageUuid = block?.page?.uuid;

    if (!pageUuid) {
      return null;
    }

    return this.api.Editor.getPage(pageUuid);
  }

  private getSelectedText() {
    return window.getSelection?.()?.toString().trim() ?? "";
  }

  async appendUserTurnToCurrentPage(prompt: string, page?: ResolvedPage | null) {
    const resolvedPage = page ?? await this.resolveCurrentPage();

    if (!resolvedPage) {
      throw new Error("Unable to resolve the current page for AI output.");
    }

    const userBlock = await this.api.Editor.insertBlock(resolvedPage.uuid, `[user] ${prompt}`, {
      sibling: false,
      before: false
    });

    if (!userBlock) {
      throw new Error("Unable to create the user turn block.");
    }

    return {
      pageUuid: resolvedPage.uuid,
      userBlockUuid: userBlock.uuid
    };
  }

  async getPriorAiTurns(page?: ResolvedPage | null) {
    const resolvedPage = page ?? await this.resolveCurrentPage();

    if (!resolvedPage) {
      return [];
    }

    const blocks = await this.getResolvedPageBlocksTree(resolvedPage);

    return blocks.flatMap((block) => {
      const user = stripRolePrefix(block.content, "user");

      if (user === null) {
        return [];
      }

      const assistant = this.extractAssistantChildContent(block.children ?? []);

      if (assistant === null) {
        return [];
      }

      return [{ user, assistant }];
    });
  }

  async getLatestAiTurn(page?: ResolvedPage | null) {
    const priorTurns = await this.getPriorAiTurns(page);
    return priorTurns.at(-1) ?? null;
  }

  async getFullPageContext(page?: ResolvedPage | null) {
    const resolvedPage = page ?? await this.resolveCurrentPage();

    if (!resolvedPage) {
      return "";
    }

    const blocks = await this.getResolvedPageBlocksTree(resolvedPage);
    const serializedBlocks = serializeBlockTree(blocks);

    return serializedBlocks
      ? `Title: ${resolvedPage.name ?? ""}\n${serializedBlocks}`
      : `Title: ${resolvedPage.name ?? ""}`;
  }

  async appendSystemMetadata(parentUuid: string, modelId: string) {
    return this.api.Editor.insertBlock(parentUuid, `system:: ${modelId}`, { sibling: false, before: false });
  }

  async appendChildBlock(parentUuid: string, content: string) {
    return this.api.Editor.insertBlock(parentUuid, content, { sibling: false, before: false });
  }

  async createAssistantPlaceholder(parentUuid: string) {
    return this.appendChildBlock(parentUuid, this.formatAssistantContent(ASSISTANT_PLACEHOLDER_TEXT));
  }

  async replaceBlockContent(blockUuid: string, content: string, role: "user" | "assistant" = "assistant") {
    const formattedContent = role === "assistant"
      ? this.formatAssistantContent(content)
      : `[${role}] ${content}`;

    await this.api.Editor.updateBlock(blockUuid, formattedContent);
  }

  async finalizeBlock(blockUuid: string, content: string) {
    const finalContent = content.trim() ? content : "[no response]";
    await this.replaceBlockContent(blockUuid, finalContent, "assistant");
  }

  async appendErrorBlock(parentUuid: string, error: string, hint: string) {
    return this.api.Editor.insertBlock(parentUuid, `[error] ${error}\n${hint}`, { sibling: false, before: false });
  }

  async markInterrupted(blockUuid: string, content: string) {
    await this.replaceBlockContent(blockUuid, `${content} [interrupted]`, "assistant");
  }

  showMessage(message: string, level: "success" | "warning" | "error" = "warning") {
    this.api.App.showMsg(message, level);
  }

  private async getResolvedPageBlocksTree(page: ResolvedPage) {
    if (this.api.Editor.getPageBlocksTree) {
      return this.api.Editor.getPageBlocksTree(page.uuid);
    }

    const currentPage = await this.api.Editor.getCurrentPage();

    if (currentPage?.uuid !== page.uuid) {
      throw new Error("Unable to read blocks for non-current page without getPageBlocksTree support.");
    }

    return this.api.Editor.getCurrentPageBlocksTree(page.uuid);
  }

  private formatAssistantContent(content: string) {
    if (this.options.prependAssistantLabel === false) {
      return content;
    }

    return `[assistant] ${content}`;
  }

  private isPropertyBlock(content: string | undefined) {
    return typeof content === "string" && /^\s*[^\s:][^:]*::/.test(content);
  }

  private extractAssistantChildContent(children: BlockTreeNode[]) {
    const legacyAssistantContent = children
      .map((child) => stripRolePrefix(child.content, "assistant"))
      .find((value): value is string => value !== null);

    if (legacyAssistantContent !== undefined) {
      return legacyAssistantContent;
    }

    return children
      .map((child) => child.content)
      .find((content): content is string => (
        this.isLegacyUnlabeledAssistantChild(content)
      )) ?? null;
  }

  private isLegacyUnlabeledAssistantChild(content: string | undefined) {
    if (content === undefined) {
      return false;
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return false;
    }

    return !trimmedContent.startsWith("[error]")
      && !this.isPropertyBlock(content);
  }
}

export { formatConversationTitle };
export type { ResolvedPage };

function stripRolePrefix(content: string | undefined, role: "user" | "assistant") {
  const prefix = `[${role}] `;

  if (!content?.startsWith(prefix)) {
    return null;
  }

  return content.slice(prefix.length);
}

function serializeBlockTree(blocks: BlockTreeNode[], depth = 0): string {
  return blocks
    .flatMap((block) => {
      const lines: string[] = [];
      const content = block.content?.trim();

      if (content) {
        lines.push(`${"  ".repeat(depth)}${content}`);
      }

      const childContent = serializeBlockTree(block.children ?? [], depth + 1);

      if (childContent) {
        lines.push(childContent);
      }

      return lines;
    })
    .join("\n");
}
