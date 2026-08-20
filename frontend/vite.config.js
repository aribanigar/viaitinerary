import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registered manually in src/main.jsx
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "ViaItinerary — Travel CRM",
        short_name: "ViaItinerary",
        description:
          "Build itineraries, manage trips, and run your travel agency from anywhere.",
        start_url: "/dashboard",
        id: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#181c22",
        theme_color: "#181c22",
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Never cache API calls or auth-sensitive data — only the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        // The world-cities dataset (Country/State/City manual-entry dropdown)
        // is multi-MB and lazily fetched only when someone opens the
        // Accommodation form — don't force every visitor to precache it
        // upfront. It still gets cached at runtime via the "app-shell"
        // StaleWhileRevalidate rule below on first actual use.
        globIgnores: ["**/city-*.js"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "app-shell" },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
