/* global process */
// Build-time plugin: the page's own code starts downloading with the app.
//
// Every screen is a lazy() chunk, so before this the browser only learned
// which chunk a URL needs after index.js had downloaded AND run (a full extra
// round trip on a phone). This plugin reads src/App.jsx — its lazy() screens
// and <Route path="…" element={<Screen/>}> lines, so the map can't drift from
// the routes — and writes into index.html a tiny script that, for the URL being
// opened, adds <link rel="modulepreload"> for that screen's chunk and the
// chunks it imports. It also preloads the main font file (src/fonts.css).
import fs from "node:fs";
import path from "node:path";

function readRoutes(appFile) {
  const src = fs.readFileSync(appFile, "utf8");
  const lazyImports = new Map();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g)) {
    lazyImports.set(m[1], m[2]);
  }
  const routes = [];
  for (const m of src.matchAll(/path="([^"]+)"\s+element=\{<(\w+)/g)) {
    if (lazyImports.has(m[2])) routes.push({ path: m[1], module: lazyImports.get(m[2]) });
  }
  return routes;
}

// "/trip-builder/:tripId" → "^/trip-builder/[^/]+/?$"
const pattern = (routePath) =>
  "^" + routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z]+/g, "[^/]+") + "/?$";

export default function routePreload({ appFile, fontPattern }) {
  return {
    name: "route-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
        const entry = chunks.find((c) => c.isEntry);
        // Already requested by index.html itself.
        const loaded = new Set([entry.fileName, ...(entry.imports || [])]);
        const srcDir = path.dirname(appFile);
        const chunkFor = (mod) => {
          const want = path.resolve(srcDir, mod).replace(/\.(jsx?|tsx?)$/, "");
          return chunks.find((c) => c.facadeModuleId && c.facadeModuleId.replace(/\.(jsx?|tsx?)$/, "") === want);
        };
        const table = [];
        for (const r of readRoutes(appFile)) {
          const chunk = chunkFor(r.module);
          if (!chunk) continue;
          const files = [];
          const seen = new Set();
          const walk = (f) => {
            if (loaded.has(f) || seen.has(f)) return;
            seen.add(f);
            files.push(f);
            (bundle[f]?.imports || []).forEach(walk);
          };
          walk(chunk.fileName);
          if (files.length) table.push([pattern(r.path), files]);
        }
        // Shared chunk names → one list, routes refer to indexes (keeps the script small).
        const names = [...new Set(table.flatMap(([, f]) => f))];
        const compact = table.map(([re, f]) => [re, f.map((x) => names.indexOf(x))]);
        const script =
          `(function(){try{var n=${JSON.stringify(names)},t=${JSON.stringify(compact)},p=location.pathname;` +
          `for(var i=0;i<t.length;i++){if(new RegExp(t[i][0]).test(p)){t[i][1].forEach(function(j){` +
          `var l=document.createElement("link");l.rel="modulepreload";l.href="/"+n[j];document.head.appendChild(l)});break}}}catch(e){}})();`;
        const tags = [{ tag: "script", children: script, injectTo: "head-prepend" }];
        const font = Object.keys(bundle).find((n) => fontPattern.test(n));
        if (font) {
          tags.push({
            tag: "link",
            attrs: { rel: "preload", as: "font", type: "font/woff2", href: "/" + font, crossorigin: "" },
            injectTo: "head-prepend",
          });
        }
        if (process.env.ROUTE_PRELOAD_DEBUG) console.log("route-preload:", table.length, "routes,", names.length, "chunks, font:", font);
        return { html, tags };
      },
    },
  };
}
