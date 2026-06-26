import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: ["lucide-react", "framer-motion", "react-toastify"],
          charts: ["recharts"],
          utils: ["xlsx", "html2pdf.js", "date-fns"],
          editor: ["@tiptap/react", "@tiptap/starter-kit"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: "esbuild",
  },
  server: {
    open: true,
    proxy: {
      // Proxy blog routes to Laravel backend
      "/blog": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/sitemap.xml": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
