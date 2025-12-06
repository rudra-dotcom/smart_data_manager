import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Use a proxy in dev so relative /api calls hit the backend without needing to hardcode ports.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || "http://localhost:5001";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
