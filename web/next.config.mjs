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
  async rewrites() {
    return {
      afterFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/:path((?!api/).+)", destination: "/index.html" },
      ],
    };
  },
};

export default nextConfig;
