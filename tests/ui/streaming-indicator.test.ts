import { afterEach, describe, expect, it, vi } from "vitest";
import * as streamingIndicator from "../../src/ui/streaming-indicator";

describe("streaming indicator contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the static typing placeholder text", () => {
    expect((streamingIndicator as Record<string, unknown>).STREAMING_MARKER_TEXT).toBe("⌨️ typing...");
  });

  it("exports animated frames that include the typing marker text", () => {
    const frames = (streamingIndicator as Record<string, unknown>).STREAMING_MARKER_FRAMES;

    expect(Array.isArray(frames)).toBe(true);
    expect((frames as string[]).length).toBeGreaterThan(1);
    expect((frames as string[])[0]).toContain("⌨️");
  });

  it("detects reduced motion with matchMedia", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    const shouldReduceStreamingMotion = (streamingIndicator as Record<string, unknown>).shouldReduceStreamingMotion;

    expect(typeof shouldReduceStreamingMotion).toBe("function");
    expect((shouldReduceStreamingMotion as () => boolean)()).toBe(true);
  });
});
