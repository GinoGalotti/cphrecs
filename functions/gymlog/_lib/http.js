// Shared HTTP helpers for /gymlog/api/*. No onRequest export, so this is not a route.

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

export const err = (message, status = 400) => json({ error: message }, status);

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export const isEmpty = v => v == null || (typeof v === 'string' && v.trim() === '');

// Accepts 82.5, "82.5" or "82,5". Returns a finite number >= 0, else null.
export function parseWeight(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Integer >= 0 (number or numeric string), else null.
export function parseReps(v) {
  if (typeof v === 'string') {
    if (!/^\d+$/.test(v.trim())) return null;
    v = Number(v);
  }
  return Number.isInteger(v) && v >= 0 ? v : null;
}

export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

export const toId = v => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);

export const toFlag = v => (v === true || v === 1 || v === '1' ? 1 : 0);

// Route wrapper: method dispatch + 503 without DB + JSON 500 on unexpected errors.
//   export const onRequest = methods({ GET: handler, POST: handler });
export const methods = handlers => async context => {
  const handler = handlers[context.request.method];
  if (!handler) {
    return json({ error: 'Method not allowed' }, 405, { Allow: Object.keys(handlers).join(', ') });
  }
  if (!context.env.DB) return err('Database not configured', 503);
  try {
    return await handler(context);
  } catch (e) {
    console.error(e);
    return err('Internal error', 500);
  }
};
