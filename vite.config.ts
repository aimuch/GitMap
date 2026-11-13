import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createApiMiddleware } from "./server/api.ts";

/** 把本地存储 API 挂到 Vite 的开发服务器和预览服务器上，一个进程即可运行。 */
function localStorageApi(): Plugin {
  const dataDir = process.env.OPEN_NOTION_DATA
    ? path.resolve(process.env.OPEN_NOTION_DATA)
    : path.resolve(import.meta.dirname, "data");
  return {
    name: "local-storage-api",
    configureServer(server) {
      server.middlewares.use(createApiMiddleware(dataDir));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware(dataDir));
    },
  };
}

export default defineConfig({
  plugins: [react(), localStorageApi()],
  server: {
    port: 5273,
    watch: { ignored: ["**/data/**"] },
  },
  preview: { port: 5273 },
});
