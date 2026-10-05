// Price maths for voice pricing ("quote ₹45,000", "margin ₹10,000", "what's
// my profit"). Pure. The item costs come from the Trip Builder's own
// calculators (settings.priceOf in editTrip), so Ching's numbers are the
// Pricing tab's numbers.
//
// The builder's total: Σ item cost × (1 + item markup or trip margin) + other
// costs × (1 + trip margin), then GST on top when it's on.

/** "45000", "45,000", "45k", "45 thousand", "1.2 lakh", "₹ 45000" → 45000 (or null). */
export function parseAmount(text) {
  const m = String(text || '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k\b|thousand\b|lakhs?\b|lacs?\b|l\b)?/)
  if (!m) return null
  let n = Number(m[1])
  const unit = m[2] || ''
  if (unit === 'k' || unit === 'thousand') n *= 1000
  else if (unit) n *= 100000
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * parts = { items: [{ cost, markup|null }], other, marginPct, gstPct, includeGST }
 * → { base, flexBase, fixedBase, fixedMarked, net, gst, total, profit }
 */
export function priceBreakdown({ items = [], other = 0, marginPct = 0, gstPct = 0, includeGST = true } = {}) {
  const m = (Number(marginPct) || 0) / 100
  let flexBase = Number(other) || 0
  let fixedBase = 0
  let fixedMarked = 0
  for (const it of items) {
    const cost = Number(it.cost) || 0
    if (it.markup === null || it.markup === undefined || it.markup === '') flexBase += cost
    else {
      fixedBase += cost
      fixedMarked += cost * (1 + (Number(it.markup) || 0) / 100)
    }
  }
  const base = flexBase + fixedBase
  const net = flexBase * (1 + m) + fixedMarked
  const gst = includeGST ? net * ((Number(gstPct) || 0) / 100) : 0
  return { base, flexBase, fixedBase, fixedMarked, net, gst, total: net + gst, profit: net - base }
}

/**
 * The trip margin % that makes the client total `target` (to the rupee, with
 * as few decimals as that needs); null if the cost alone exceeds it.
 */
export function marginForTotal(p, target, { gstPct = 0, includeGST = true } = {}) {
  if (!(p.flexBase > 0)) return null
  const g = includeGST ? (Number(gstPct) || 0) / 100 : 0
  const exact = ((target / (1 + g) - p.fixedMarked) / p.flexBase - 1) * 100
  if (exact < 0) return null
  const totalAt = (pct) => Math.round((p.flexBase * (1 + pct / 100) + p.fixedMarked) * (1 + g))
  for (let d = 2; d <= 8; d++) {
    const f = 10 ** d
    for (const pct of [Math.round(exact * f) / f, Math.ceil(exact * f) / f, Math.floor(exact * f) / f]) {
      if (pct >= 0 && totalAt(pct) === Math.round(target)) return pct
    }
  }
  return exact
}

/** The trip margin % that earns `amount` profit before GST (to the rupee); null if impossible. */
export function marginForProfit(p, amount) {
  if (!(p.flexBase > 0)) return null
  const extra = p.fixedMarked - p.fixedBase
  const exact = ((amount - extra) / p.flexBase) * 100
  if (exact < 0) return null
  const profitAt = (pct) => Math.round(p.flexBase * (pct / 100) + extra)
  for (let d = 2; d <= 8; d++) {
    const f = 10 ** d
    for (const pct of [Math.round(exact * f) / f, Math.ceil(exact * f) / f, Math.floor(exact * f) / f]) {
      if (pct >= 0 && profitAt(pct) === Math.round(amount)) return pct
    }
  }
  return exact
}
