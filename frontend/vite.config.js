import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One app: the client pages and Story Studio (at /studio) are built together.
// In development, /api and /files go to the Python API on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/files": "http://localhost:8000",
    },
  },
});
