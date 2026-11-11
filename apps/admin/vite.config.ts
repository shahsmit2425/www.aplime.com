import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const values = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  return {
    root: "apps/admin",
    envDir: "../..",
    // The shared Render group contains secrets. Only these two values are bundled.
    envPrefix: [],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(values.API_URL || ""),
      "import.meta.env.VITE_APP_ENV": JSON.stringify(
        values.APP_ENV || "development",
      ),
    },
    plugins: [react()],
    build: { outDir: "../../dist/admin", emptyOutDir: true },
    server: { host: "127.0.0.1", port: 5174 },
  };
});
