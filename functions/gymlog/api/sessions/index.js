import { err, isDate, json, methods, readJson, toId } from '../../_lib/http.js';
import { createSession, loadCatalog, loadSessions, validateSession } from '../../_lib/db.js';

// GET ?before=<date>[&before_id=<id>]&limit=30. Newest first. Pass the returned
// next_before / next_before_id to page (before_id keeps same-day sessions from being skipped).
async function get({ env, request }) {
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(toId(q.get('limit')) || 30, 1), 100);
  const before = q.get('before');
  const beforeId = toId(q.get('before_id'));
  if (before && !isDate(before)) return err('before must be YYYY-MM-DD', 422);

  let where = '';
  const binds = [];
  if (before && beforeId != null) {
    where = 'WHERE date < ? OR (date = ? AND id < ?)';
    binds.push(before, before, beforeId);
  } else if (before) {
    where = 'WHERE date < ?';
    binds.push(before);
  }
  const { results } = await env.DB
    .prepare(`SELECT id, date FROM gym_sessions ${where} ORDER BY date DESC, id DESC LIMIT ?`)
    .bind(...binds, limit + 1)
    .all();
  const page = results.slice(0, limit);
  const last = page[page.length - 1];
  const more = results.length > limit;
  return json({
    sessions: await loadSessions(env.DB, page.map(r => r.id)),
    has_more: more,
    next_before: more ? last.date : null,
    next_before_id: more ? last.id : null,
  });
}

async function post({ env, request }) {
  const catalog = await loadCatalog(env.DB);
  const { error, status, value } = await validateSession(env.DB, await readJson(request), catalog);
  if (error) return err(error, status);
  const id = await createSession(env.DB, value, catalog);
  return json({ id }, 201);
}

export const onRequest = methods({ GET: get, POST: post });
