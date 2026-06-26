# Travel Agency CRM

A small React single-page application scaffolded with Vite. This repository contains a minimal CRM/dashboard and a marketing landing for a travel agency.

**Features**

- Dashboard with sidebar, header, and trip management UI
- Landing pages (Hero, Features, Showcase, TrustedBy, Footer)
- PDF generation view (`generatedpdf.html`) for exporting trip summaries
- Fast development with Vite + React

**Tech stack**

- React
- Vite (dev server + build)
- ESLint
- Plain CSS (global `index.css`)

**Quick start**

Requirements: Node.js 16+ and a package manager (`npm`, `yarn` or `pnpm`).

Install dependencies:

```bash
npm install
# or
# yarn
# pnpm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

Run lint (if configured):

```bash
npm run lint
```

**Project structure (important files)**

- [src](src/) — application source
  - [src/main.jsx](src/main.jsx) — app entry
  - [src/App.jsx](src/App.jsx) — root app component
  - [src/index.css](src/index.css) — global styles
  - [src/generatedpdf.html](src/generatedpdf.html) — PDF export template
  - [src/components/landing](src/components/landing) — landing page UI components
  - [src/components/dashboard](src/components/dashboard) — dashboard UI components (Sidebar, Header, MyTrips, TripBuilder)
- [vite.config.js](vite.config.js) — Vite configuration
- [package.json](package.json) — scripts and dependencies

**Development notes**

- The app uses Vite's dev server with HMR. Edit files under `src/` and the browser updates automatically.
- Keep component-level UI in `src/components/*`.
- `generatedpdf.html` is included as a static template for PDF export; adjust styles there if needed.

**Contributing**

Open an issue or submit a PR. For small changes, run the dev server locally and include a brief description of your change.

**License**

This project currently has no license file. Add a `LICENSE` file if you want to specify terms.
