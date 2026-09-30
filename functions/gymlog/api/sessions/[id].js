import { err, json, methods, readJson, toId } from '../../_lib/http.js';
import { deleteSession, loadCatalog, loadSessions, replaceSession, validateSession } from '../../_lib/db.js';

async function find(env, params) {
  const id = toId(params.id);
  if (id == null) return null;
  return (await loadSessions(env.DB, [id]))[0] ?? null;
}

async function get({ env, params }) {
  const session = await find(env, params);
  return session ? json({ session }) : err('Session not found', 404);
}

async function put({ env, request, params }) {
  const existing = await find(env, params);
  if (!existing) return err('Session not found', 404);
  const catalog = await loadCatalog(env.DB);
  const { error, status, value } = await validateSession(env.DB, await readJson(request), catalog);
  if (error) return err(error, status);
  await replaceSession(env.DB, existing.id, value, catalog);
  return json({ id: existing.id });
}

async function del({ env, params }) {
  const existing = await find(env, params);
  if (!existing) return err('Session not found', 404);
  await deleteSession(env.DB, existing.id);
  return json({ ok: true });
}

export const onRequest = methods({ GET: get, PUT: put, DELETE: del });
