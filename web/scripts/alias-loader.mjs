// Lets plain node run web/lib modules: resolves the "@/" alias and treats app
// sources as ES modules (Next does both at build time). Test scripts only.
import { pathToFileURL, fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('../', import.meta.url))
export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) return next(pathToFileURL(ROOT + spec.slice(2) + (spec.endsWith('.js') ? '' : '.js')).href, ctx)
  return next(spec, ctx)
}
export async function load(url, ctx, next) {
  if (url.startsWith('file://' + ROOT) && !url.includes('/node_modules/') && url.endsWith('.js')) return next(url, { ...ctx, format: 'module' })
  return next(url, ctx)
}
