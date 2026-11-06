import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  publicDir:
    command === "serve" && !isPreview
      ? resolve(import.meta.dirname, "../../examples")
      : false,
  server: { host: "127.0.0.1", port: 5173 },
  build: {
    rolldownOptions: {
      input: {
        playground: resolve(import.meta.dirname, "index.html"),
        preview: resolve(import.meta.dirname, "preview.html"),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
}));
