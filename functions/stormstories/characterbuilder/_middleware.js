// Basic Auth for /stormstories/characterbuilder/* (page, PDF, atlas.json, atlas.md).
// Same approach as functions/admin/_middleware.js, but with its own player-facing
// secrets (STORMLIGHT_USER / STORMLIGHT_PASS) so the admin password is never shared.

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: { ...PRIVATE_HEADERS, "WWW-Authenticate": 'Basic realm="stormlight", charset="UTF-8"' },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest({ request, env, next }) {
  // Unset secrets lock the page rather than opening it.
  if (!env.STORMLIGHT_USER || !env.STORMLIGHT_PASS) return unauthorized();
  const [scheme, encoded] = (request.headers.get("Authorization") || "").split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();
  let decoded;
  try { decoded = atob(encoded); } catch { return unauthorized(); }
  const i = decoded.indexOf(":");
  if (i < 0) return unauthorized();
  if (!safeEqual(decoded.slice(0, i), env.STORMLIGHT_USER) || !safeEqual(decoded.slice(i + 1), env.STORMLIGHT_PASS))
    return unauthorized();

  const res = await next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) out.headers.set(k, v);
  return out;
}
