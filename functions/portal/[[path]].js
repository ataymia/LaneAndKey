/**
 * Cloudflare Pages Function — SPA catch-all for /portal/* deep routes.
 *
 * When a browser refreshes at e.g. /portal/tenant/lease, Cloudflare finds no
 * matching static file and falls back to the root index.html (marketing site).
 * This function intercepts all /portal/* routes that don't match a static asset
 * and serves the Vite-built portal/index.html so React Router handles routing.
 *
 * Static assets (/portal/assets/*) are excluded via _routes.json and served
 * directly by the CDN — they never hit this function.
 */

export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/portal/index.html';
  return context.env.ASSETS.fetch(url);
}
