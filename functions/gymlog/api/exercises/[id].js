import { err, isEmpty, json, methods, parseWeight, readJson, toFlag, toId } from '../../_lib/http.js';
import { activeExerciseId, exerciseOut, loadCatalog } from '../../_lib/db.js';

// Partial update of name, per_hand, starting_weight, archived.
async function put({ env, request, params }) {
  const id = toId(params.id);
  const body = await readJson(request);
  if (!body) return err('Invalid JSON body', 400);
  const catalog = await loadCatalog(env.DB);
  const ex = id == null ? null : catalog.exById.get(id);
  if (!ex) return err('Exercise not found', 404);

  const sets = [];
  const binds = [];

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return err('name is required', 422);
    if (name.length > 80) return err('name is too long', 422);
    const dup = catalog.exercises.find(e => e.id !== id && e.name.toLowerCase() === name.toLowerCase());
    if (dup) return err(`An exercise called "${name}" already exists`, 409);
    sets.push('name = ?');
    binds.push(name);
  }
  if ('per_hand' in body) {
    sets.push('per_hand = ?');
    binds.push(toFlag(body.per_hand));
  }
  if ('starting_weight' in body) {
    const w = isEmpty(body.starting_weight) ? 0 : parseWeight(body.starting_weight);
    if (w == null) return err('starting_weight must be a number >= 0', 422);
    sets.push('starting_weight = ?');
    binds.push(w);
  }
  if ('archived' in body) {
    const archived = toFlag(body.archived);
    if (archived && ex.is_cycling && activeExerciseId(catalog, ex.group_id) === ex.id) {
      return err('This is the active variation. Rotate this group first.', 409);
    }
    sets.push('archived = ?');
    binds.push(archived);
  }
  if (!sets.length) return err('nothing to update', 422);

  await env.DB.prepare(`UPDATE gym_exercises SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run();
  const row = await env.DB.prepare('SELECT * FROM gym_exercises WHERE id = ?').bind(id).first();
  return json({ exercise: exerciseOut(row) });
}

export const onRequest = methods({ PUT: put });
