import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogseqService } from "../../src/services/logseq-service";

type MockLogseq = {
  Editor: {
    getCurrentBlock: ReturnType<typeof vi.fn>;
    getPage: ReturnType<typeof vi.fn>;
    getCurrentPage: ReturnType<typeof vi.fn>;
    getPageBlocksTree: ReturnType<typeof vi.fn>;
    getCurrentPageBlocksTree: ReturnType<typeof vi.fn>;
    createPage: ReturnType<typeof vi.fn>;
    insertBlock: ReturnType<typeof vi.fn>;
    updateBlock: ReturnType<typeof vi.fn>;
  };
  App: {
    showMsg: ReturnType<typeof vi.fn>;
  };
};

let mockLogseq: MockLogseq;

describe("LogseqService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    mockLogseq = {
      Editor: {
        getCurrentBlock: vi.fn().mockResolvedValue(null),
        getPage: vi.fn().mockResolvedValue(null),
        getCurrentPage: vi.fn().mockResolvedValue(null),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getCurrentPageBlocksTree: vi.fn().mockResolvedValue([]),
        createPage: vi.fn().mockResolvedValue({ uuid: "page-id" }),
        insertBlock: vi.fn(),
        updateBlock: vi.fn().mockResolvedValue(undefined)
      },
      App: {
        showMsg: vi.fn()
      }
    };
  });

  it("prefers selected text over the focused block", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({ uuid: "b1", content: "Focused block" });

    const service = new LogseqService(mockLogseq as never, {}, () => new Date("2026-05-26T14:32:00Z"));

    await expect(service.getPromptSourceText()).resolves.toBe("Selected text");
  });

  it("returns selected text plus the focused block uuid as the reply target", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-1",
      content: "Focused block",
      page: { uuid: "page-1" }
    });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPromptSource()).resolves.toEqual({
      text: "Selected text",
      replyTargetBlockUuid: "block-1"
    });
  });

  it("falls back to the focused block when nothing is selected", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({ uuid: "b1", content: "Focused block" });

    const service = new LogseqService(mockLogseq as never, {}, () => new Date("2026-05-26T14:32:00Z"));

    await expect(service.getPromptSourceText()).resolves.toBe("Focused block");
  });

  it("returns focused block content and reply target when nothing is selected", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-1",
      content: "Focused block",
      page: { uuid: "page-1" }
    });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPromptSource()).resolves.toEqual({
      text: "Focused block",
      replyTargetBlockUuid: "block-1"
    });
  });

  it("falls back to no reply target when selected text has no focused block", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue(null);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPromptSource()).resolves.toEqual({
      text: "Selected text",
      replyTargetBlockUuid: null
    });
  });

  it("creates a dated conversation page title", async () => {
    const service = new LogseqService(mockLogseq as never, {}, () => new Date("2026-05-26T14:32:00Z"));

    await service.createConversationPage();

    expect(mockLogseq.Editor.createPage).toHaveBeenCalledWith(
      "AI Chat - 2026-05-26 14:32",
      {},
      { createFirstBlock: true }
    );
  });

  it("rewrites the assistant block with accumulated streamed text", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.replaceBlockContent("assistant-id", "Hello world", "assistant");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "[assistant] Hello world");
  });

  it("rewrites streamed assistant text without the label when disabled", async () => {
    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.replaceBlockContent("assistant-id", "Hello world", "assistant");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "Hello world");
  });

  it("creates sibling conversation blocks on the page", async () => {
    mockLogseq.Editor.insertBlock
      .mockResolvedValueOnce({ uuid: "system-id" })
      .mockResolvedValueOnce({ uuid: "user-id" })
      .mockResolvedValueOnce({ uuid: "assistant-id" });

    const service = new LogseqService(mockLogseq as never);

    await service.appendSystemMetadata("page-id", "gpt-4o");
    await service.appendChildBlock("page-id", "[user] Prompt text");
    await service.createAssistantPlaceholder("page-id");

    expect(mockLogseq.Editor.insertBlock).toHaveBeenNthCalledWith(1, "page-id", "system:: gpt-4o", {
      sibling: false,
      before: false
    });
    expect(mockLogseq.Editor.insertBlock).toHaveBeenNthCalledWith(2, "page-id", "[user] Prompt text", {
      sibling: false,
      before: false
    });
    expect(mockLogseq.Editor.insertBlock).toHaveBeenNthCalledWith(3, "page-id", "[assistant] ⌨️ typing...", {
      sibling: false,
      before: false
    });
  });

  it("returns an empty string when there is no selection and no focused block", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue(null);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPromptSourceText()).resolves.toBe("");
  });

  it("marks interrupted assistant content", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.markInterrupted("assistant-id", "Partial response");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
      "assistant-id",
      "[assistant] Partial response [interrupted]"
    );
  });

  it("marks interrupted assistant content without the label when disabled", async () => {
    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.markInterrupted("assistant-id", "Partial response");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
      "assistant-id",
      "Partial response [interrupted]"
    );
  });

  it("appends an error block beneath the conversation page", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.appendErrorBlock(
      "page-id",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith(
      "page-id",
      "[error] socket closed\nRetry Ask AI after fixing the provider connection.",
      { sibling: false, before: false }
    );
  });

  it("attaches source-reply errors under the same source block", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.appendErrorBlock(
      "source-block",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith(
      "source-block",
      "[error] socket closed\nRetry Ask AI after fixing the provider connection.",
      { sibling: false, before: false }
    );
  });

  it("keeps error output prefixed when assistant labels are disabled", async () => {
    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.appendErrorBlock(
      "source-block",
      "socket closed",
      "Retry Ask AI after fixing the provider connection."
    );

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith(
      "source-block",
      "[error] socket closed\nRetry Ask AI after fixing the provider connection.",
      { sibling: false, before: false }
    );
  });

  it("finalizes the assistant block and removes the typing marker", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.finalizeBlock("assistant-id", "Final answer");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "[assistant] Final answer");
  });

  it("finalizes the assistant block without the label when disabled", async () => {
    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.finalizeBlock("assistant-id", "Final answer");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "Final answer");
  });

  it("writes a fallback message when the model returns no content", async () => {
    const service = new LogseqService(mockLogseq as never);

    await service.finalizeBlock("assistant-id", "");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "[assistant] [no response]");
  });

  it("writes a fallback message without the label when the model returns no content and labels are disabled", async () => {
    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.finalizeBlock("assistant-id", "");

    expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith("assistant-id", "[no response]");
  });

  it("appends a user turn to the current page instead of creating a new page", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.insertBlock.mockResolvedValue({ uuid: "user-id" });

    const service = new LogseqService(mockLogseq as never);

    await service.appendUserTurnToCurrentPage("Prompt text");

    expect(mockLogseq.Editor.createPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith("page-uuid", "[user] Prompt text", {
      sibling: false,
      before: false
    });
  });

  it("appends a user turn to the provided resolved page without re-resolving", async () => {
    mockLogseq.Editor.getCurrentBlock.mockRejectedValue(new Error("should not resolve current block"));
    mockLogseq.Editor.getCurrentPage.mockRejectedValue(new Error("should not resolve current page"));
    mockLogseq.Editor.insertBlock.mockResolvedValue({ uuid: "user-id" });

    const service = new LogseqService(mockLogseq as never);

    await service.appendUserTurnToCurrentPage("Prompt text", { uuid: "provided-page", name: "Provided Page" });

    expect(mockLogseq.Editor.getCurrentBlock).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getCurrentPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith("provided-page", "[user] Prompt text", {
      sibling: false,
      before: false
    });
  });

  it("resolves the focused block owner page with full title data", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "page-uuid" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "other-page", name: "Other Page" });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.resolveCurrentPage()).resolves.toEqual({ uuid: "page-uuid", name: "Project Notes" });
  });

  it("resolves the selected-text owner page with full title data", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "page-uuid" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.resolveCurrentPage()).resolves.toEqual({ uuid: "page-uuid", name: "Project Notes" });
  });

  it("returns null when selected text has a focused block without a resolvable owner page", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid"
    });
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.resolveCurrentPage()).resolves.toBeNull();
    expect(mockLogseq.Editor.getCurrentPage).not.toHaveBeenCalled();
  });

  it("returns null when selected text has a focused block whose owner page lookup fails", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "page-uuid" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue(null);
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "fallback-page", name: "Fallback Page" });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.resolveCurrentPage()).resolves.toBeNull();
    expect(mockLogseq.Editor.getPage).toHaveBeenCalledWith("page-uuid");
    expect(mockLogseq.Editor.getCurrentPage).not.toHaveBeenCalled();
  });

  it("creates the assistant placeholder as a child of the user turn", async () => {
    mockLogseq.Editor.insertBlock
      .mockResolvedValueOnce({ uuid: "user-id" })
      .mockResolvedValueOnce({ uuid: "assistant-id" });

    const service = new LogseqService(mockLogseq as never);

    await service.createAssistantPlaceholder("user-id");

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith("user-id", "[assistant] ⌨️ typing...", {
      sibling: false,
      before: false
    });
  });

  it("creates the assistant placeholder without the label when disabled", async () => {
    mockLogseq.Editor.insertBlock.mockResolvedValue({ uuid: "assistant-id" });

    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await service.createAssistantPlaceholder("user-id");

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith("user-id", "⌨️ typing...", {
      sibling: false,
      before: false
    });
  });

  it("creates an assistant placeholder as the last child of the source block", async () => {
    mockLogseq.Editor.insertBlock.mockResolvedValue({ uuid: "assistant-id" });

    const service = new LogseqService(mockLogseq as never);

    await service.createAssistantPlaceholder("source-block");

    expect(mockLogseq.Editor.insertBlock).toHaveBeenCalledWith("source-block", "[assistant] ⌨️ typing...", {
      sibling: false,
      before: false
    });
  });

  it("returns only valid prior user-assistant pairs in page order", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      { content: "[user] First", children: [{ content: "[assistant] One" }] },
      { content: "[user] Dangling", children: [] },
      { content: "[user] Second", children: [{ content: "[assistant] Two [interrupted]" }, { content: "[error] nope" }] }
    ]);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "First", assistant: "One" },
      { user: "Second", assistant: "Two [interrupted]" }
    ]);
  });

  it("recognizes unprefixed assistant child blocks when labels are disabled", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        content: "[user] First",
        children: [
          { content: "Plain answer" },
          { content: "[error] ignored" },
          { content: "status:: ignored" }
        ]
      }
    ]);

    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "First", assistant: "Plain answer" }
    ]);
  });

  it("accepts bracket-prefixed unlabeled assistant children while still skipping error and property children when labels are disabled", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        content: "[user] First",
        children: [
          { content: "[error] ignored" },
          { content: "status:: ignored" },
          { content: "[draft] hello" }
        ]
      }
    ]);

    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "First", assistant: "[draft] hello" }
    ]);
  });

  it("skips blank unlabeled assistant children before picking a plain answer when labels are disabled", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        content: "[user] First",
        children: [
          { content: "" },
          { content: "   " },
          { content: "Plain answer" }
        ]
      }
    ]);

    const service = new LogseqService(mockLogseq as never, { prependAssistantLabel: false });

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "First", assistant: "Plain answer" }
    ]);
  });

  it("recognizes legacy unlabeled assistant children when labels are enabled", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        content: "[user] Legacy",
        children: [
          { content: "[error] ignored" },
          { content: "status:: ignored" },
          { content: "Plain answer only" }
        ]
      }
    ]);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "Legacy", assistant: "Plain answer only" }
    ]);
  });

  it("prefers an explicit assistant child when both explicit and legacy unlabeled children exist", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        content: "[user] First",
        children: [
          { content: "Plain answer" },
          { content: "[assistant] Explicit answer" }
        ]
      }
    ]);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "First", assistant: "Explicit answer" }
    ]);
  });

  it("preserves empty role content when the user and assistant prefixes are present", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-uuid", name: "Project Notes" });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      { content: "[user] ", children: [{ content: "[assistant] " }] },
      { content: "[user] Next", children: [{ content: "[assistant] Answer" }] }
    ]);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getPriorAiTurns()).resolves.toEqual([
      { user: "", assistant: "" },
      { user: "Next", assistant: "Answer" }
    ]);
  });

  it("uses the provided resolved page for prior turn lookup without re-resolving", async () => {
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "owner-page" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue({ uuid: "owner-page", name: "Owner Page" });
    mockLogseq.Editor.getCurrentPageBlocksTree.mockRejectedValue(new Error("should not use current page blocks API"));
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      { content: "[user] First", children: [{ content: "[assistant] One" }] }
    ]);

    const service = new LogseqService(mockLogseq as never);
    const page = { uuid: "provided-page", name: "Provided Page" };

    await expect(service.getPriorAiTurns(page)).resolves.toEqual([
      { user: "First", assistant: "One" }
    ]);

    expect(mockLogseq.Editor.getCurrentBlock).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getCurrentPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getPageBlocksTree).toHaveBeenCalledWith("provided-page");
    expect(mockLogseq.Editor.getCurrentPageBlocksTree).not.toHaveBeenCalled();
  });

  it("uses the provided resolved page for full-page context without re-resolving", async () => {
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "owner-page" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue({ uuid: "owner-page", name: "Owner Page" });
    mockLogseq.Editor.getCurrentPageBlocksTree.mockRejectedValue(new Error("should not use current page blocks API"));
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      { content: "Heading", children: [{ content: "Child", children: [] }] }
    ]);

    const service = new LogseqService(mockLogseq as never);
    const page = { uuid: "provided-page", name: "Provided Page" };

    await expect(service.getFullPageContext(page)).resolves.toBe("Title: Provided Page\nHeading\n  Child");

    expect(mockLogseq.Editor.getCurrentBlock).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getCurrentPage).not.toHaveBeenCalled();
    expect(mockLogseq.Editor.getPageBlocksTree).toHaveBeenCalledWith("provided-page");
    expect(mockLogseq.Editor.getCurrentPageBlocksTree).not.toHaveBeenCalled();
  });

  it("uses the same resolved page source for full-page title and block tree", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue({
      uuid: "block-uuid",
      page: { uuid: "owner-page" }
    });
    mockLogseq.Editor.getPage.mockResolvedValue({ uuid: "owner-page", name: "Owner Page" });
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "other-page", name: "Other Page" });
    mockLogseq.Editor.getCurrentPageBlocksTree.mockRejectedValue(new Error("should not use current page blocks API"));
    mockLogseq.Editor.getPageBlocksTree.mockImplementation(async (pageUuid?: string) => {
      if (pageUuid === "owner-page") {
        return [{ content: "Owner heading", children: [] }];
      }

      return [{ content: "Other heading", children: [] }];
    });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getFullPageContext()).resolves.toBe("Title: Owner Page\nOwner heading");
    expect(mockLogseq.Editor.getPageBlocksTree).toHaveBeenCalledWith("owner-page");
    expect(mockLogseq.Editor.getCurrentPageBlocksTree).not.toHaveBeenCalled();
  });

  it("fails fast instead of reading the current page block tree for a different resolved page", async () => {
    const logseqWithoutPageBlocksTree = {
      ...mockLogseq,
      Editor: {
        ...mockLogseq.Editor,
        getPageBlocksTree: undefined
      }
    };
    logseqWithoutPageBlocksTree.Editor.getCurrentPage.mockResolvedValue({ uuid: "current-page", name: "Current Page" });
    logseqWithoutPageBlocksTree.Editor.getCurrentPageBlocksTree.mockResolvedValue([
      { content: "Wrong page content", children: [] }
    ]);

    const service = new LogseqService(logseqWithoutPageBlocksTree as never);

    await expect(service.getFullPageContext({ uuid: "other-page", name: "Other Page" })).rejects.toThrow(
      "Unable to read blocks for non-current page without getPageBlocksTree support."
    );
    expect(logseqWithoutPageBlocksTree.Editor.getCurrentPageBlocksTree).not.toHaveBeenCalled();
  });

  it("serializes the current page title and block tree for full-page context", async () => {
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({
      uuid: "page-uuid",
      name: "Project Notes",
      properties: { category: "notes" }
    });
    mockLogseq.Editor.getPageBlocksTree.mockResolvedValue([
      { content: "Heading", children: [{ content: "Child", children: [] }] }
    ]);

    const service = new LogseqService(mockLogseq as never);

    await expect(service.getFullPageContext()).resolves.toContain("Project Notes");
    await expect(service.getFullPageContext()).resolves.toContain("Heading\n  Child");
    await expect(service.getFullPageContext()).resolves.not.toContain("category");
  });

  it("still resolves the page through getCurrentPage when selected text has no resolvable source block", async () => {
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Selected text" } as Selection);
    mockLogseq.Editor.getCurrentBlock.mockResolvedValue(null);
    mockLogseq.Editor.getCurrentPage.mockResolvedValue({ uuid: "page-1", name: "Current Page" });

    const service = new LogseqService(mockLogseq as never);

    await expect(service.resolveCurrentPage()).resolves.toEqual({ uuid: "page-1", name: "Current Page" });
  });
});
