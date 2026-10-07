import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

function offlineShell() {
  return {
    name: "offline-shell",
    writeBundle(options) {
      const dir = resolve(options.dir || "dist");
      const assets = readdirSync(resolve(dir, "assets")).map((name) => `/assets/${name}`).sort();
      const version = createHash("sha256").update(readFileSync(resolve(dir, "index.html"))).update(assets.join()).digest("hex").slice(0, 12);
      const shell = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-180.png", ...assets];
      const worker = readFileSync("public/sw.js", "utf8")
        .replace("raagam-shell-v3", `raagam-shell-${version}`)
        .replace('/* PRECACHE */ ["/"]', JSON.stringify(shell));
      writeFileSync(resolve(dir, "sw.js"), worker);
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineShell()],
  // Capacitor loads the app from a bundled file:// origin on device,
  // so all asset paths must be relative.
  base: "./",
  build: {
    outDir: "dist",
  },
});
