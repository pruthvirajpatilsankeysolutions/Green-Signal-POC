import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During development, /api and /files are sent to the Python API on port 8000.
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