import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_PROXY_TARGET || "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react-globe.gl", "three", "globe.gl"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
