# Frosted‑glass (glassmorphism) — ViaItinerary

Reusable "frosted glass" effect for the app, on‑brand with Urbanist +
`#181C22` (ink) + `#E7F63C` (lime).

The utility classes below are **already defined** in
`frontend/src/index.css` — to use the effect anywhere, just add the class
(no extra CSS needed). Tell me the spot and I'll drop it in.

---

## What it is

`backdrop-filter: blur()` blurs **whatever is behind** an element (not the
element itself). Combine that with a semi‑transparent tint + a bright
hairline border and you get the frosted‑glass look.

> It only works when there's something behind it — an image, a gradient, a
> colored panel, or the map/preview. Over a flat color it does nothing.

---

## Ready‑to‑use classes (in `index.css`)

| Class         | Use on…                                             |
| ------------- | --------------------------------------------------- |
| `.glass`      | Light frosted panel (default — over images/gradients) |
| `.glass-dark` | Dark frosted panel (white text) — over bright/lime   |
| `.glass-lime` | Lime‑tinted glass — accent chips/badges              |

```css
/* frontend/src/index.css */
.glass {
  background: rgba(255, 255, 255, 0.55);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 40px -12px rgba(24, 28, 34, 0.25);
}
.glass-dark {
  background: rgba(24, 28, 34, 0.45); /* #181C22 @ 45% */
  color: #fff;
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px -12px rgba(0, 0, 0, 0.45);
}
.glass-lime {
  background: rgba(231, 246, 60, 0.18); /* #E7F63C @ 18% */
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(231, 246, 60, 0.5);
  box-shadow: 0 10px 40px -12px rgba(24, 28, 34, 0.25);
}

/* Fallback for browsers without backdrop-filter (make it more opaque) */
@supports not (
  (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
) {
  .glass      { background: rgba(255, 255, 255, 0.9); }
  .glass-dark { background: rgba(24, 28, 34, 0.92); }
  .glass-lime { background: rgba(231, 246, 60, 0.85); }
}
```

Pair with a radius, e.g. `class="glass rounded-[20px]"`.

---

## Usage examples

```html
<!-- Light frosted card over the world map / an image -->
<div class="glass rounded-[20px] p-6">…</div>

<!-- Dark frosted "Live Preview" pill over a bright photo -->
<div class="glass-dark rounded-full px-4 py-2 flex items-center gap-2">
  <span class="w-2 h-2 rounded-full bg-[#e7f63c]"></span>
  <span class="text-[10px] font-semibold uppercase tracking-widest">Live Preview</span>
</div>

<!-- Lime accent chip -->
<div class="glass-lime rounded-full px-4 py-1.5 text-xs font-semibold text-[#181c22]">63%</div>
```

### Tailwind‑only equivalent (no class needed)

```html
<!-- light  --> <div class="bg-white/55 backdrop-blur-xl backdrop-saturate-150 border border-white/60 rounded-[20px] shadow-2xl">
<!-- dark   --> <div class="bg-[#181c22]/45 backdrop-blur-xl border border-white/10 text-white rounded-[20px]">
<!-- lime   --> <div class="bg-[#e7f63c]/20 backdrop-blur-xl border border-[#e7f63c]/50 rounded-full">
```

---

## Rules of thumb (so it never looks cheap)

1. **Needs a busy backdrop** — image, gradient, map, or the itinerary
   preview. Never over a flat panel.
2. **Use it sparingly** — 1–2 glass panels per screen. `backdrop-filter`
   is GPU‑heavy; don't animate the blur.
3. **Always ship the `-webkit-` prefix** (Safari) + the `@supports`
   fallback above.
4. **Test light *and* dark** — glass reads very differently on each; pick
   `.glass` vs `.glass-dark` based on what's behind it.
5. **Keep text legible** — bump the tint opacity (`/55` → `/70`) if the
   background is loud.

---

## Good places to apply it in ViaItinerary

- AI‑assistant **floating cards** over the world map / analytics mockups
- The **"Live Preview"** badge and **"Preparing the result 63%"** progress
  card (already partly glass)
- **Dropdowns/popovers** (History, Templates) when they overlap imagery
- A **hero/CTA overlay** on the landing page

_Reference: Josh W. Comeau — "Next‑level frosted glass with backdrop‑filter"._
