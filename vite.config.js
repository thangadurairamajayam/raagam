import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Capacitor loads the app from a bundled file:// origin on device,
  // so all asset paths must be relative.
  base: "./",
  build: {
    outDir: "dist",
  },
});
