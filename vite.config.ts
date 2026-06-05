import { defineConfig } from "vite";
import logseqDevPluginModule from "vite-plugin-logseq";
import { copyFileSync, writeFileSync, readFileSync } from "fs";

const logseqDevPlugin =
  typeof logseqDevPluginModule === "function"
    ? logseqDevPluginModule
    : logseqDevPluginModule.default;

export default defineConfig({
  base: "",
  plugins: [
    logseqDevPlugin(),
    {
      name: "copy-plugin-assets",
      writeBundle() {
        // Copy icon
        copyFileSync("icon.svg", "dist/icon.svg");

        // Copy package.json with only necessary fields.
        // Use "index.html" as main (not "dist/index.html") because the
        // release CI flattens dist/* into the plugin root directory.
        const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
        const distPkg = {
          name: pkg.name,
          version: pkg.version,
          main: "index.html",
          logseq: pkg.logseq
        };
        writeFileSync("dist/package.json", JSON.stringify(distPkg, null, 2));
      }
    }
  ],
  build: {
    target: "esnext",
    minify: "esbuild"
  }
});
