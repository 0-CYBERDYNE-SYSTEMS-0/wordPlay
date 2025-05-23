import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(currentDir, "client/src"),
      "@shared": path.resolve(currentDir, "shared"),
      "@assets": path.resolve(currentDir, "attached_assets"),
    },
  },
  root: path.resolve(currentDir, "client"),
  build: {
    outDir: path.resolve(currentDir, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
