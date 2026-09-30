import { err, isEmpty, json, methods, parseWeight, readJson, toFlag, toId } from '../../_lib/http.js';
import { activeExerciseId, exerciseOut, loadCatalog } from '../../_lib/db.js';

async function get({ env, request }) {
  const includeArchived = new URL(request.url).searchParams.get('include_archived') === '1';
  const catalog = await loadCatalog(env.DB);
  const groups = new Map(catalog.groups.map(g => [g.id, g]));
  const order = e => (e.group_id == null ? 1e6 : groups.get(e.group_id)?.sort_order ?? 1e5);
  const exercises = catalog.exercises
    .filter(e => includeArchived || !e.archived)
    .sort(
      (a, b) =>
        order(a) - order(b) ||
        (a.variation_order ?? 0) - (b.variation_order ?? 0) ||
        a.name.localeCompare(b.name)
    )
    .map(e => ({
      ...exerciseOut(e),
      group_name: groups.get(e.group_id)?.name ?? null,
      group_color: groups.get(e.group_id)?.color ?? null,
      is_active_variation: !!e.is_cycling && activeExerciseId(catalog, e.group_id) === e.id,
    }));
  return json({ exercises });
}

async function post({ env, request }) {
  const body = await readJson(request);
  if (!body) return err('Invalid JSON body', 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return err('name is required', 422);
  if (name.length > 80) return err('name is too long', 422);

  const isCycling = toFlag(body.is_cycling);
  let groupId = null;
  if (isCycling) {
    groupId = toId(body.group_id);
    const g =
      groupId == null ? null : await env.DB.prepare('SELECT id FROM gym_groups WHERE id = ?').bind(groupId).first();
    if (!g) return err('group_id is required for cycling exercises', 422);
  }

  let startingWeight = 0;
  if (!isEmpty(body.starting_weight)) {
    startingWeight = parseWeight(body.starting_weight);
    if (startingWeight == null) return err('starting_weight must be a number >= 0', 422);
  }

  const dup = await env.DB.prepare('SELECT id FROM gym_exercises WHERE lower(name) = lower(?)').bind(name).first();
  if (dup) return err(`An exercise called "${name}" already exists`, 409);

  try {
    // new cycling exercises go to the end of their group's rotation
    const res = await env.DB
      .prepare(
        `INSERT INTO gym_exercises (name, is_cycling, per_hand, group_id, variation_order, starting_weight)
         VALUES (?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL
                                  ELSE (SELECT COALESCE(MAX(variation_order), 0) + 1 FROM gym_exercises WHERE group_id = ?) END, ?)`
      )
      .bind(name, isCycling, toFlag(body.per_hand), groupId, groupId, groupId, startingWeight)
      .run();
    const row = await env.DB.prepare('SELECT * FROM gym_exercises WHERE id = ?').bind(res.meta.last_row_id).first();
    return json({ exercise: exerciseOut(row) }, 201);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return err(`An exercise called "${name}" already exists`, 409);
    throw e;
  }
}

export const onRequest = methods({ GET: get, POST: post });
