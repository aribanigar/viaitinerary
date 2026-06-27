import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Build straight into the Next app's public/ so a single Vercel deploy
    // (the web/ Next app) serves the SPA and the /api routes together.
    outDir: "../web/public",
    emptyOutDir: true,
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
      // In dev, proxy API calls to the Next app (`next dev` on :3000) so the
      // SPA and API behave like the single deployed app.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
