import { afterEach, describe, expect, it } from "vitest";
import { getAllTranslationsOf, initLocale, t } from "../../src/i18n/index";

function makeRuntime(preferredLanguage: string) {
  return {
    App: {
      getUserConfigs: async () => ({ preferredLanguage }),
    },
  };
}

describe("t()", () => {
  afterEach(async () => {
    await initLocale(makeRuntime("en"));
  });

  it("resolves a simple string key", () => {
    expect(t("ui.selectTextOrBlock")).toBe("Select text or focus a block first.");
  });

  it("substitutes {{var}} placeholders", () => {
    expect(t("ui.providerUnreachable", { name: "MyProvider", error: "timeout" })).toBe(
      'Provider "MyProvider" is unreachable: timeout'
    );
  });

  it("leaves unreferenced placeholders intact", () => {
    expect(t("ui.providerUnreachable", { name: "X" })).toContain("{{error}}");
  });

  it("returns a string for every key in the Translations interface", () => {
    const keys: string[] = [
      "ui.providerUnreachable",
      "ui.contextMenuAskAi",
      "settings.providersJsonTitle",
      "settings.modelMissingProvider",
      "blocks.user",
      "blocks.chatPageTitle",
      "prompts.defaultSystemPrompt",
      "streaming.frame0",
    ];

    for (const key of keys) {
      expect(typeof t(key as Parameters<typeof t>[0])).toBe("string");
    }
  });
});

describe("initLocale()", () => {
  afterEach(async () => {
    await initLocale(makeRuntime("en"));
  });

  it("defaults to English when no locale is initialized", () => {
    expect(t("blocks.user")).toBe("[user]");
  });

  it("falls back to English for an unrecognized locale prefix", async () => {
    await initLocale(makeRuntime("ja"));
    expect(t("blocks.user")).toBe("[user]");
  });

  it("falls back to English when getUserConfigs throws", async () => {
    await initLocale({
      App: {
        getUserConfigs: async () => {
          throw new Error("API unavailable");
        },
      },
    });
    expect(t("blocks.user")).toBe("[user]");
  });

  it("falls back to English when getUserConfigs is not a function", async () => {
    await initLocale({ App: {} } as never);
    expect(t("blocks.user")).toBe("[user]");
  });
});

describe("getAllTranslationsOf()", () => {
  it("returns the English value", () => {
    const values = getAllTranslationsOf("blocks.user");
    expect(values).toContain("[user]");
  });

  it("returns unique values only", () => {
    const values = getAllTranslationsOf("blocks.user");
    expect(values.length).toBe(new Set(values).size);
  });
});
