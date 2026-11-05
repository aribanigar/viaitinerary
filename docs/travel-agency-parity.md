# travel-agency → viaitinerary: feature-by-feature comparison

Checked 2026-11-06 against neelipetstay-debug/travel-agency `main` at e1fdf24
(Laravel API + React SPA, viakashmiritinerary.in). travel-agency itself was
not changed.

How it was checked:
- every route in travel-agency's `backend/routes/api.php` (150 method + path
  pairs) matched by script against viaitinerary's `web/app/api/**/route.js`
  exports;
- every API call in viaitinerary's `frontend/src` matched against its own
  API (this found pages calling routes that did not exist);
- every screen route in both `App.jsx` files;
- every travel-agency commit since the June port, read one by one.

## API routes

136 of 150 match the same path and method. The other 14:

| travel-agency | viaitinerary | Status |
|---|---|---|
| `POST /trip-inquiries/{identifier}` | `POST /lead-inquiries/{identifier}` | Same agency enquiry form; travel-agency has both paths on one controller, viaitinerary's form uses the second |
| `PATCH /integrations/facebook/settings` | `PATCH /integrations/[platform]/settings` | Same (the script can't match a fixed name to a `[platform]` folder) |
| `GET /image-search`, `POST /image-search/save` | `GET/POST /destinations/photos`, `/destinations/fill-photos` | Same job (Pixabay photos for destinations), different paths |
| `GET /storage/{path}` | Supabase Storage URLs | Not needed: files are served by Supabase |
| `POST /blog-leads` | none | travel-agency's Kashmir travel blog lead form (server-rendered blog); viaitinerary's blog is the product blog with no lead form |
| `GET /teams/{id}`, `GET /plans/{id}` | none | Not called by either frontend |
| `/instant-itinerary-templates` (6 routes) | none | Not on GitHub: uncommitted work in progress in the local travel-agency folder on 2026-11-06. Port once it is committed |

## Routes that viaitinerary's own screens called but that did not exist

These were errors before this change, and are now ported from travel-agency:

| Screen | Routes added |
|---|---|
| Schedule a Demo (public) + Super Admin → Demo Requests | `POST/GET /demo-requests`, `PATCH /demo-requests/:id/status`, `DELETE /demo-requests/:id`; alert + confirmation emails |
| Landing showcase + Super Admin → Showcase | `GET/POST /showcase-items`, `GET/PUT/DELETE /showcase-items/:id` |
| Landing "Trusted by" + Super Admin → Trusted Companies | `GET /trusted-companies`, `GET/POST /trusted-companies-admin`, `GET/POST(_method=PUT)/PUT/DELETE /trusted-companies-admin/:id` |
| Integrations (Meta / Google leads) | `GET /integrations`, `DELETE /integrations/:platform`, `PATCH /integrations/facebook/settings` (Page token, lead subscription, Google Sheet sync), `GET /auth/:platform/redirect`, `GET /auth/:platform/callback`, `GET/POST /webhooks/meta` |

The Integrations page no longer falls back to opening the API URL with the
session token in it; it shows the error instead.

## Screens

Every travel-agency screen route exists in viaitinerary. `/whatsapp-itinerary`
was the only missing one and is now added. viaitinerary has more (AI
assistant, Operations, Activities, Package Builder, client proposal and
supplier pages, ...).

## travel-agency changes since the port, one by one

| travel-agency change | viaitinerary |
|---|---|
| WhatsApp Itinerary page | Ported |
| Super admin select + delete public leads | Ported |
| Lead Inquiries select + bulk delete | Ported |
| Public lead form emails customer and admin | Ported |
| Trips list shows travellers | Ported (Pax column) |
| New trips start with last-used inclusions/exclusions; clearing keeps Policies | Ported |
| Start an empty trip on "Create a trip" | Already there, differently: "New trip" opens a blank tab |
| Itinerary limit 450 / 500 + super admin settings | Ported |
| Hotel / cab date outside the trip: amber window + soft warning | Window was there; warning toast ported |
| Export Premium only | Ported (Budget + Premium modal → "Premium only") |
| Budgeted + Premium export, Premium price follows Budget price, breakup | Already there, differently (tier export picks the Premium hotel per stay) |
| Budget / Premium preview switch; per-stay Premium star category + meal plan | Not ported: viaitinerary's tier model picks hotels at export time, so there is no stored per-stay premium option to preview |
| Packages (reusable trip templates) | Already there (packages are trips flagged `isPackage`) |
| Destination side panel | Not ported: viaitinerary edits destinations on their own page |
| Searchable A-Z destination picker, Day N: prefix | Already there |
| Pixabay photo search for destinations | Already there |
| Undo / redo, day moves keep hotels and cabs, bulk delete + sortable lists, saved price kept, refresh rates, cost breakup | Already there |
| Phone layout tightening | Not ported: viaitinerary has its own (redesigned) layout |
| Blog content, IndexNow, SEO pages, footer | Not ported: travel-agency's Kashmir travel blog content; viaitinerary has its own marketing site |
| Mail sender fixes, "code only on the live server" | travel-agency server specifics |

## Account import

Settings → Import Account copies an owner's data from travel-agency (same
email, owner on both): settings and policies (empty fields only), destinations,
hotels, vehicles, leads, trips (days, stays, cabs, paid/refunded totals,
created date) and packages. It only reads travel-agency's API. Re-running it
copies nothing twice. See `web/lib/travelAgencyImport.js`.

Not importable through travel-agency's API: team members (no password
hashes), the SMTP app password (hidden), accounting settlements, integrations
(tokens hidden; reconnect Meta/Google here).

## Verification

- `node web/scripts/ta-import.test.mjs`, `node web/scripts/integrations.test.mjs`,
  `node frontend/scripts/plan-window.test.mjs`, plus all existing test scripts (28 files)
- Every new and changed route run against a real Postgres (PGlite) with the
  real Prisma client: import (twice), itinerary limit on every create path,
  public lead delete, demo requests, showcase, trusted companies, Meta settings
  + sheet sync, webhook (signature, repeat), OAuth redirect + callback (forged
  state rejected)
- `prisma db push` of the full schema succeeds (new tables: platform_settings,
  import_links, showcase_items, trusted_companies, integrations)
- Frontend and API builds pass; no new lint errors in any changed file

## Environment to set in Vercel (only for Integrations)

`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_REDIRECT_URI`
(default `<site>/api/auth/facebook/callback`), `META_VERIFY_TOKEN`,
`META_INCLUDE_EMAIL` / `META_INCLUDE_PAGES_SCOPES` / `META_INCLUDE_LEADS_RETRIEVAL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, optional
`FRONTEND_URL`, `ADMIN_ALERT_EMAIL`. Without them the Integrations page says
sign-in isn't set up; everything else works.
