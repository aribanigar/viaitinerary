/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Keep heavy server-only deps out of the webpack bundle (loaded at runtime in
  // the Node serverless function instead). Avoids bundling failures for the PDF
  // and mail libraries.
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  },
  // Single-app serving: the Vite-built React SPA lives in public/ (index.html +
  // assets). Static files and /api/* route handlers are matched first; any other
  // path falls through to the SPA so React Router handles client-side routing.
  // /assets/* is excluded: a chunk missing after a deploy must 404, not come
  // back as index.html (which the browser then fails to run as JavaScript).
  async rewrites() {
    return {
      afterFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/:path((?!api/|assets/).+)", destination: "/index.html" },
      ],
    };
  },
  // Vite fingerprints everything under /assets (a changed file always gets a
  // new name), so these can be cached forever instead of re-checked on every
  // page load. index.html keeps the platform default (always revalidated), so
  // a deploy is still picked up immediately.
  async headers() {
    return [
      {
        source: "/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
