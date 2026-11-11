import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // Shared Render groups include server secrets; public configuration is injected explicitly.
  envPrefix: [],
  plugins: [react()],
  build: { outDir: "dist/client", sourcemap: false },
  server: { host: "127.0.0.1" },
});
