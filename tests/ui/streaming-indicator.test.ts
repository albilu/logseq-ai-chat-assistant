import { afterEach, describe, expect, it, vi } from "vitest";
import * as streamingIndicator from "../../src/ui/streaming-indicator";

describe("streaming indicator contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports getStreamingMarkerText() returning the typing placeholder", () => {
    const fn = (streamingIndicator as Record<string, unknown>).getStreamingMarkerText;
    expect(typeof fn).toBe("function");
    expect((fn as () => string)()).toContain("⌨️");
  });

  it("exports getStreamingMarkerFrames() returning multiple frames", () => {
    const fn = (streamingIndicator as Record<string, unknown>).getStreamingMarkerFrames;
    expect(typeof fn).toBe("function");
    const frames = (fn as () => string[])();
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]).toContain("⌨️");
  });

  it("detects reduced motion with matchMedia", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const shouldReduceStreamingMotion =
      (streamingIndicator as Record<string, unknown>).shouldReduceStreamingMotion;
    expect(typeof shouldReduceStreamingMotion).toBe("function");
    expect((shouldReduceStreamingMotion as () => boolean)()).toBe(true);
  });
});
