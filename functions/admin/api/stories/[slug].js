// ⚠ LOCAL-DEV BYPASS
// isLocalDev() skips the Cf-Access-Jwt-Assertion check on localhost.
// In production, /admin/* is blocked by Cloudflare Access before reaching here,
// so this bypass never fires in prod. To verify, search: grep -r "isLocalDev" functions/
function isLocalDev(request) {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function requireAccess(request) {
  if (isLocalDev(request)) return null; // ← LOCAL-DEV BYPASS
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequest(context) {
  const { params, env, request } = context;

  // Auth first — don't leak method info to unauthenticated callers
  const authError = requireAccess(request);
  if (authError) return authError;

  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!env.DB) return json({ error: 'Database not configured' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { title, subtitle, body_md, status } = body;

  if (!title?.trim())           return json({ error: 'title is required' }, 422);
  if (!body_md?.trim())         return json({ error: 'body_md is required' }, 422);
  if (!['draft', 'published'].includes(status))
                                return json({ error: 'status must be "draft" or "published"' }, 422);

  const result = await env.DB
    .prepare(
      "UPDATE stories SET title = ?, subtitle = ?, body_md = ?, status = ?, updated_at = datetime('now') WHERE slug = ?"
    )
    .bind(title.trim(), subtitle?.trim() || null, body_md, status, params.slug)
    .run();

  if (!result.meta.changes) return json({ error: 'Story not found' }, 404);

  return json({ ok: true });
}
