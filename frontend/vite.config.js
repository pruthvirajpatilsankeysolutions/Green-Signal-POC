import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two separate pages are built from this folder:
//   index.html   the client app (Postcraft), served at /
//   studio.html  Story Studio, the agency's own tool, served at /studio
// In development, /studio and /studio/anything open studio.html; /api and /files go to the Python API on port 8000.
const studioRoutes = () => ({
  name: "studio-routes",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url || "").split("?")[0];
      if (path === "/studio" || (path.startsWith("/studio/") && !/\.[a-z0-9]+$/i.test(path))) req.url = "/studio.html";
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), studioRoutes()],
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), studio: resolve(import.meta.dirname, "studio.html") } },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/files": "http://localhost:8000",
    },
  },
});
