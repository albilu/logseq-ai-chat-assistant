// src/ui/streaming-indicator.tsx
import { t } from "../i18n/index";

export function getStreamingMarkerText(): string {
  return t("streaming.frame0");
}

export function getStreamingMarkerFrames(): string[] {
  return [t("streaming.frame0"), t("streaming.frame1"), t("streaming.frame2")];
}

export function shouldReduceStreamingMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
