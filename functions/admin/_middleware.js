function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest({ request, env, next }) {
  const [scheme, encoded] = (request.headers.get("Authorization") || "").split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();
  const decoded = atob(encoded);
  const i = decoded.indexOf(":");
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  if (!safeEqual(user, env.ADMIN_USER || "") || !safeEqual(pass, env.ADMIN_PASS || ""))
    return unauthorized();
  return next();
}
