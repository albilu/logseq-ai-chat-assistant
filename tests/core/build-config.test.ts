// @vitest-environment node

import { describe, expect, it } from "vitest";

import viteConfig from "../../vite.config";

describe("vite config", () => {
  it("includes the Logseq Vite plugin", () => {
    const plugins = Array.isArray(viteConfig.plugins) ? viteConfig.plugins : [];

    expect(plugins.some((plugin) => plugin?.name?.includes("logseq"))).toBe(true);
  });

  it("builds with a relative base for Logseq file loading", () => {
    expect(viteConfig.base).toBe("");
  });
});
