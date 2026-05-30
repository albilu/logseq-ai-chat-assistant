import { defineConfig } from "vite";
import logseqDevPluginModule from "vite-plugin-logseq";

const logseqDevPlugin =
  typeof logseqDevPluginModule === "function"
    ? logseqDevPluginModule
    : logseqDevPluginModule.default;

export default defineConfig({
  base: "",
  plugins: [logseqDevPlugin()],
  build: {
    target: "esnext",
    minify: "esbuild"
  }
});
