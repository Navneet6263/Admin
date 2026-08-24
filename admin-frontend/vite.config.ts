import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "src/server.ts" } }),
    nitro({ preset: "node-server" }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
