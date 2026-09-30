import { err, isDate, isEmpty, json, methods, readJson, toId } from '../../_lib/http.js';
import { activeExerciseId, loadCatalog, nextVariationId } from '../../_lib/db.js';

// POST {group_id, exercise_id?, date?}. exercise_id defaults to the next variation, date to server today.
async function post({ env, request }) {
  const body = await readJson(request);
  if (!body) return err('Invalid JSON body', 400);
  const catalog = await loadCatalog(env.DB);

  const groupId = toId(body.group_id);
  if (groupId == null || !catalog.groups.some(g => g.id === groupId)) return err('group not found', 404);

  const exerciseId = isEmpty(body.exercise_id) ? nextVariationId(catalog, groupId) : toId(body.exercise_id);
  const ex = exerciseId == null ? null : catalog.exById.get(exerciseId);
  if (!ex || !ex.is_cycling || ex.group_id !== groupId) return err('exercise is not a variation of this group', 422);
  if (ex.archived) return err('exercise is archived', 422);
  if (activeExerciseId(catalog, groupId) === exerciseId) return err('That variation is already active', 409);

  if (!isEmpty(body.date) && !isDate(body.date)) return err('date must be YYYY-MM-DD', 422);
  const dateSql = isEmpty(body.date) ? "date('now')" : '?';
  const dateBind = isEmpty(body.date) ? [] : [body.date];

  // close the open cycle and open the new one atomically
  const res = await env.DB.batch([
    env.DB.prepare(`UPDATE gym_cycles SET ended_on = ${dateSql} WHERE group_id = ? AND ended_on IS NULL`).bind(
      ...dateBind,
      groupId
    ),
    env.DB.prepare(`INSERT INTO gym_cycles (group_id, exercise_id, started_on) VALUES (?, ?, ${dateSql})`).bind(
      groupId,
      exerciseId,
      ...dateBind
    ),
  ]);
  return json({ cycle_id: res[1].meta.last_row_id, group_id: groupId, exercise_id: exerciseId }, 201);
}

export const onRequest = methods({ POST: post });
