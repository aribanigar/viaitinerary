// Ching — shortest paths. One Dijkstra, two graphs:
//  - parseCommand.js reads a sentence as a path through its word positions
//    (each edge = one way to read a span of words, cost = how unsure we are);
//    the cheapest path from the first word to the last is the best reading.
//  - route.js finds road distances between the trip's cities.
// Pure JS: no React, no DOM, no imports outside utils/ching.

/** Binary min-heap of [priority, value]. */
export class MinHeap {
  constructor() {
    this.a = []
  }

  get size() {
    return this.a.length
  }

  push(priority, value) {
    const a = this.a
    a.push([priority, value])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }

  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * Dijkstra from `source`. `edgesOf(node)` returns [{ to, cost, ...payload }]
 * with cost >= 0; nodes are any Map keys (numbers, strings).
 * Stops early once `target` (optional) is settled.
 * @returns {{ dist: Map, prev: Map }} prev maps node -> the edge used to reach it (with `from`).
 */
export function dijkstra(source, edgesOf, target) {
  const dist = new Map([[source, 0]])
  const prev = new Map()
  const done = new Set()
  const heap = new MinHeap()
  heap.push(0, source)
  while (heap.size) {
    const [d, u] = heap.pop()
    if (done.has(u)) continue
    done.add(u)
    if (u === target) break
    for (const e of edgesOf(u) || []) {
      const nd = d + e.cost
      if (!dist.has(e.to) || nd < dist.get(e.to) - 1e-12) {
        dist.set(e.to, nd)
        prev.set(e.to, { ...e, from: u })
        heap.push(nd, e.to)
      }
    }
  }
  return { dist, prev }
}

/** Cheapest path source -> target as the list of edges taken (null when unreachable). */
export function shortestPath(source, target, edgesOf) {
  const { dist, prev } = dijkstra(source, edgesOf, target)
  if (!dist.has(target)) return null
  const edges = []
  for (let n = target; n !== source; n = prev.get(n).from) edges.unshift(prev.get(n))
  return { cost: dist.get(target), edges }
}
