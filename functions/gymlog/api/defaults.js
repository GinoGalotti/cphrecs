import { err, isDate, json, methods, toId } from '../_lib/http.js';
import { loadCatalog, loadTemplates, rowDefaults } from '../_lib/db.js';

// GET ?template_id=  -> { template_id, rows: [row, ...] }   (one row per slot, in order)
// GET ?exercise_id=  -> row                                  (optional &slot_group_id= is echoed back)
// optional &date=YYYY-MM-DD bounds the "last time" lookup (sessions on or before that date)
async function get({ env, request }) {
  const q = new URL(request.url).searchParams;
  const date = q.get('date');
  if (date && !isDate(date)) return err('date must be YYYY-MM-DD', 422);
  const catalog = await loadCatalog(env.DB);

  if (q.has('exercise_id')) {
    const id = toId(q.get('exercise_id'));
    if (id == null || !catalog.exById.has(id)) return err('exercise not found', 404);
    const slot = q.has('slot_group_id') ? toId(q.get('slot_group_id')) : null;
    return json(await rowDefaults(env.DB, catalog, id, slot, date));
  }

  if (q.has('template_id')) {
    const id = toId(q.get('template_id'));
    const template = (await loadTemplates(env.DB, catalog)).find(t => t.id === id);
    if (!template) return err('template not found', 404);
    const rows = await Promise.all(
      template.slots.map(s => rowDefaults(env.DB, catalog, s.exercise_id, s.group_id, date))
    );
    return json({ template_id: template.id, rows });
  }

  return err('template_id or exercise_id is required', 422);
}

export const onRequest = methods({ GET: get });
