// Ching — the best order to visit the trip's hotels.
//
//  1. Road distances: Dijkstra over the road network (places.js ROADS, plus
//     each unknown-but-pinned city wired to its two nearest known towns), so
//     "Gulmarg → Pahalgam" is correctly costed through Srinagar.
//  2. Visiting order: Held–Karp dynamic programming over the loop
//     airport → every city → airport, exact for the handful of cities a trip
//     has. If the order the agent said is as good, it is kept (started from
//     the airport city when one is on the trip).
// Pure JS: no React, no DOM, no imports outside utils/ching.

import { dijkstra } from './graph.js'
import { GAZETTEER, GATEWAYS, ROADS, gazetteerKey, cityPoint, haversine } from './geo.js'
import { normKey } from './fuzzy.js'

const ROAD_FACTOR = 1.35 // straight line → road, for towns not in the road table

/** Road graph over the gazetteer + the given cities: Map node -> [{ to, cost }]. */
function roadGraph(cities, hotels) {
  const adj = new Map()
  const link = (a, b, km) => {
    if (a === b) return
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push({ to: b, cost: km })
    adj.get(b).push({ to: a, cost: km })
  }
  ROADS.forEach(([a, b, km]) => link(a, b, km))
  const known = Object.keys(GAZETTEER)
  for (const city of cities) {
    const node = nodeOf(city)
    if (adj.has(node)) continue
    const p = cityPoint(city, hotels)
    if (!p) continue
    const others = [...known, ...cities.map(nodeOf).filter((n) => n !== node && !known.includes(n))]
      .map((n) => ({ n, p: GAZETTEER[n] ? [GAZETTEER[n][0], GAZETTEER[n][1]] : cityPoint(n, hotels) }))
      .filter((x) => x.p)
      .map((x) => ({ n: x.n, km: haversine(p, x.p) * ROAD_FACTOR }))
      .sort((a, b) => a.km - b.km)
    others.slice(0, 2).forEach((x) => link(node, x.n, x.km))
  }
  return adj
}

const nodeOf = (city) => gazetteerKey(city) || normKey(city)

/**
 * Road km between the given cities (Dijkstra from each), plus each one's km
 * to the nearest airport gateway. null = unreachable / unknown.
 */
export function roadDistances(cities, hotels = []) {
  const adj = roadGraph(cities, hotels)
  const nodes = cities.map(nodeOf)
  const matrix = []
  const toGateway = []
  nodes.forEach((a) => {
    const { dist } = dijkstra(a, (u) => adj.get(u) || [])
    matrix.push(nodes.map((b) => (a === b ? 0 : dist.has(b) ? dist.get(b) : null)))
    const g = GATEWAYS.filter((x) => dist.has(x)).map((x) => dist.get(x))
    toGateway.push(g.length ? Math.min(...g) : null)
  })
  return { matrix, toGateway }
}

/**
 * Held–Karp over a closed tour 0 → (all of 1..n-1) → 0, where node 0 is the
 * airport: D[0][i] / D[i][0] = km from the gateway to stop i and back.
 * O(n²·2ⁿ) — trips have a handful of stops. Returns the order of 1..n-1.
 */
function heldKarp(D) {
  const n = D.length
  if (n <= 2) return Array.from({ length: n - 1 }, (_, i) => i + 1)
  const m = n - 1 // stops 1..n-1 as bits 0..m-1
  const FULL = (1 << m) - 1
  const cost = new Map()
  const parent = new Map()
  const key = (mask, last) => mask * 32 + last
  for (let j = 0; j < m; j++) cost.set(key(1 << j, j), D[0][j + 1])
  for (let mask = 1; mask <= FULL; mask++) {
    for (let last = 0; last < m; last++) {
      if (!(mask & (1 << last))) continue
      const c = cost.get(key(mask, last))
      if (c == null || c === Infinity) continue
      for (let nx = 0; nx < m; nx++) {
        if (mask & (1 << nx)) continue
        const k = key(mask | (1 << nx), nx)
        const nc = c + D[last + 1][nx + 1]
        if (!cost.has(k) || nc < cost.get(k) - 1e-9) {
          cost.set(k, nc)
          parent.set(k, last)
        }
      }
    }
  }
  let best = Infinity
  let bestLast = 0
  for (let last = 0; last < m; last++) {
    const c = cost.get(key(FULL, last)) + D[last + 1][0]
    if (c < best - 1e-9) {
      best = c
      bestLast = last
    }
  }
  const order = []
  let mask = FULL
  let last = bestLast
  while (mask) {
    order.unshift(last + 1)
    const p = parent.get(key(mask, last))
    mask &= ~(1 << last)
    last = p
  }
  return order
}

const MAX_STOPS = 12 // Held–Karp is 2^n; no real trip has more distinct cities

/**
 * Best visiting order for stays [{ city, ... }] (as spoken / as on the trip).
 * The trip is a loop from the airport (Srinagar, Jammu, Leh…) through every
 * city and back to the nearest airport; Held–Karp finds the shortest such loop.
 * Ties go to: the order the agent said, started from the airport city if one
 * is on the trip. Stays in one city stay together; a second stay in the start
 * city becomes the last night (back near the airport).
 * @param {{ hotels?: object[], first?: string }} opts  first = the city the agent wants to start in
 * @returns {{ ok, order: number[], changed, km, spokenKm, path: string[], unknown: string[] }}
 *   order = indexes into `stays`; km = road km of the chosen loop, spokenKm = of the given order.
 */
export function bestStayOrder(stays, { hotels = [], first = '' } = {}) {
  const idx = stays.map((_, i) => i)
  const result = (extra) => ({ ok: true, order: idx, changed: false, km: 0, spokenKm: 0, path: [], unknown: [], ...extra })
  if (stays.length < 2) return result()

  // Distinct cities in spoken order; each holds its stays' indexes.
  const cities = []
  stays.forEach((s, si) => {
    const k = nodeOf(s.city)
    let i = cities.findIndex((c) => c.key === k)
    if (i < 0) i = cities.push({ key: k, name: s.city, stays: [] }) - 1
    cities[i].stays.push(si)
  })
  if (cities.length < 2) return result()
  if (cities.length > MAX_STOPS) return result({ ok: false })
  const unknown = cities.filter((c) => !c.name || !cityPoint(c.name, hotels)).map((c) => c.name || 'a stay with no city')
  if (unknown.length) return result({ ok: false, unknown })

  const { matrix, toGateway } = roadDistances(cities.map((c) => c.name), hotels)
  if (matrix.some((row) => row.some((v) => v == null))) return result({ ok: false, unknown: cities.map((c) => c.name) })
  const gw = toGateway.map((v) => v ?? 0)
  const firstAt = first ? cities.findIndex((c) => c.key === nodeOf(first)) : -1

  // Node 0 = the airport; stops 1..m = cities. Forcing a first city = only it is reachable from 0.
  const solve = (only) =>
    heldKarp([
      [0, ...gw.map((g, i) => (only < 0 || i === only ? g : Infinity))],
      ...cities.map((_, i) => [gw[i], ...matrix[i]]),
    ]).map((i) => i - 1)
  const loopKm = (seq) => gw[seq[0]] + seq.slice(1).reduce((a, v, i) => a + matrix[seq[i]][v], 0) + gw[seq[seq.length - 1]]
  const spoken = cities.map((_, i) => i)
  const gateways = spoken.filter((i) => gw[i] === 0)
  const optimal = solve(firstAt)
  const bestKm = loopKm(optimal)
  const close = (seq) => loopKm(seq) <= bestKm * 1.02 + 2
  const rotate = (seq, g) => [g, ...seq.filter((i) => i !== g)]
  // Candidates, best-liked first: as said (from the airport city), as said,
  // shortest loop from each airport city, shortest loop either way round.
  const starts = firstAt >= 0 ? [firstAt] : gateways
  const candidates = [
    ...starts.map((g) => rotate(spoken, g)),
    spoken,
    ...starts.map((g) => solve(g)),
    optimal,
    [...optimal].reverse(),
  ].filter((seq) => firstAt < 0 || seq[0] === firstAt)
  const ok = candidates.filter(close)
  const pick = ok.find((seq) => !starts.length || starts.includes(seq[0])) || ok[0] || optimal

  const order = []
  pick.forEach((ci, n) => order.push(...(n === 0 ? cities[ci].stays.slice(0, 1) : cities[ci].stays)))
  order.push(...cities[pick[0]].stays.slice(1))
  return result({
    order,
    changed: order.some((v, i) => v !== i),
    km: Math.round(loopKm(pick)),
    spokenKm: Math.round(loopKm(spoken)),
    path: pick.map((ci) => cities[ci].name),
  })
}
