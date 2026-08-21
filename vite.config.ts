import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwind from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      devOptions: {
        enabled: true, // enables SW in `vite dev` for easier testing (optional)
        type: "module",
      },
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "CashTrack",
        short_name: "CashTrack",
        description:
          "Lightweight offline-ready POS and expense tracker with Google Sheets integration.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#10b981",
        icons: [
          {
            src: "/icons/icon-48.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "/icons/icon-72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "/icons/icon-96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "/icons/icon-128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/icons/icon-144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "/icons/icon-152.png",
            sizes: "152x152",
            type: "image/png",
          },
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // cache generated assets + static files
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // runtime caching for your catalog GET
        runtimeCaching: [
          {
            // GET products (Netlify function)
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/.netlify/functions/products-get"),
            handler: "NetworkFirst",
            options: {
              cacheName: "catalog-v2", // bump name to avoid old entries
              networkTimeoutSeconds: 4, // if slow, fall back to cache
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts (if you use them)
            urlPattern: ({ url }) =>
              url.origin.includes("fonts.gstatic.com") ||
              url.origin.includes("fonts.googleapis.com"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fonts" },
          },
        ],
        // don’t try to cache POSTs (sales-append stays app-driven via IDB)
        navigateFallback: "/index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
  },
});
