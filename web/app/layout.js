// Inert root layout. The UI is the Vite-built React SPA served from public/
// (see next.config.mjs rewrites); there are no Next pages, only /api route
// handlers. App Router still expects a root layout to exist.
export const metadata = {
  title: "ViaItinerary",
  description: "Travel itinerary builder & CRM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
