export const STREAMING_MARKER_TEXT = "⌨️ typing...";

export const STREAMING_MARKER_FRAMES = [
  "⌨️ typing...",
  "⌨️ typing.. ",
  "⌨️ typing.  "
];

export function shouldReduceStreamingMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const STREAMING_MARKER = STREAMING_MARKER_TEXT;

export function StreamingIndicator() {
  return STREAMING_MARKER_TEXT;
}
