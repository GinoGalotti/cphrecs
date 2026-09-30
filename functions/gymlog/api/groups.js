import { json, methods } from '../_lib/http.js';
import { activeExerciseId, loadCatalog } from '../_lib/db.js';

async function get({ env }) {
  const catalog = await loadCatalog(env.DB);
  return json({
    groups: catalog.groups.map(g => ({
      id: g.id,
      name: g.name,
      sort_order: g.sort_order,
      color: g.color,
      active_exercise_id: activeExerciseId(catalog, g.id),
    })),
  });
}

export const onRequest = methods({ GET: get });
