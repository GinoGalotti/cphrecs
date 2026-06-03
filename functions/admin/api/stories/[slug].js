const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequest(context) {
  const { params, env, request } = context;

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

  if (!title?.trim())                          return json({ error: 'title is required' }, 422);
  if (!body_md?.trim())                        return json({ error: 'body_md is required' }, 422);
  if (!['draft', 'published'].includes(status)) return json({ error: 'status must be "draft" or "published"' }, 422);

  const result = await env.DB
    .prepare(
      "UPDATE stories SET title = ?, subtitle = ?, body_md = ?, status = ?, updated_at = datetime('now') WHERE slug = ?"
    )
    .bind(title.trim(), subtitle?.trim() || null, body_md, status, params.slug)
    .run();

  if (!result.meta.changes) return json({ error: 'Story not found' }, 404);

  return json({ ok: true });
}
