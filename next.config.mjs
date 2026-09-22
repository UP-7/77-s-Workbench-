import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Tesseract 模型/内核 CDN：缓存后即可离线 OCR
        urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com)\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "ocr-assets",
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https?.*\/api\/feed.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "feed-api",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 12 },
          networkTimeoutSeconds: 10,
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 60 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https?.*/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "offline-fallback",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist 在浏览器端不需要 Node 的 canvas 可选依赖
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withPWA(nextConfig);
