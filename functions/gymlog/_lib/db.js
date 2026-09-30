// Shared gym log queries + derivation rules. No onRequest export, so this is not a route.
import { isDate, isEmpty, parseReps, parseWeight, toId } from './http.js';

export const STALL_SESSIONS = 3;
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 8;
export const MAX_EXERCISES = 50;
export const MAX_SETS = 50;

const rows = async stmt => (await stmt.all()).results;
const placeholders = n => Array(n).fill('?').join(',');

export const exerciseOut = e => ({
  id: e.id,
  name: e.name,
  is_cycling: !!e.is_cycling,
  per_hand: !!e.per_hand,
  group_id: e.group_id ?? null,
  variation_order: e.variation_order ?? null,
  starting_weight: e.starting_weight,
  archived: !!e.archived,
});

// ---------- catalog (all small tables, loaded per request) ----------

export async function loadCatalog(db) {
  const [g, e, c] = await db.batch([
    db.prepare('SELECT * FROM gym_groups ORDER BY sort_order, id'),
    db.prepare('SELECT * FROM gym_exercises ORDER BY id'),
    db.prepare('SELECT * FROM gym_cycles ORDER BY started_on, id'),
  ]);
  const catalog = {
    groups: g.results,
    exercises: e.results,
    cycles: c.results,
    exById: new Map(e.results.map(x => [x.id, x])),
    open: new Map(c.results.filter(x => x.ended_on == null).map(x => [x.group_id, x])),
  };
  return catalog;
}

export const variationsOf = (catalog, groupId, { includeArchived = false } = {}) =>
  catalog.exercises
    .filter(e => e.is_cycling && e.group_id === groupId && (includeArchived || !e.archived))
    .sort((a, b) => a.variation_order - b.variation_order || a.id - b.id);

// Active variation = exercise of the group's open cycle (fallback: first non-archived variation).
export function activeExerciseId(catalog, groupId) {
  const open = catalog.open.get(groupId);
  if (open) return open.exercise_id;
  return variationsOf(catalog, groupId)[0]?.id ?? null;
}

// Next non-archived variation after the active one in variation_order, wrapping.
export function nextVariationId(catalog, groupId) {
  const vars = variationsOf(catalog, groupId);
  if (!vars.length) return null;
  const idx = vars.findIndex(v => v.id === activeExerciseId(catalog, groupId));
  return vars[(idx + 1) % vars.length].id;
}

// ---------- cycle_id stamping ----------

export function stampCycleId(exercise, date, cycles) {
  if (!exercise || !exercise.is_cycling || exercise.group_id == null) return null;
  const match = cycles.filter(
    c =>
      c.group_id === exercise.group_id &&
      c.exercise_id === exercise.id &&
      c.started_on <= date &&
      (c.ended_on == null || date <= c.ended_on)
  );
  if (!match.length) return null;
  const open = match.find(c => c.ended_on == null);
  if (open) return open.id;
  return match.sort((a, b) => b.started_on.localeCompare(a.started_on) || b.id - a.id)[0].id;
}

// ---------- cycle stats ----------

// setRows: all sets of ONE cycle, ordered by session date, session id. {session_id, date, reps, weight}
export function cycleStats(setRows) {
  const trend = [];
  let cur = null;
  for (const r of setRows) {
    if (!cur || cur.session_id !== r.session_id) {
      cur = { session_id: r.session_id, date: r.date, max: null };
      trend.push(cur);
    }
    if (r.reps >= 8 && (cur.max == null || r.weight > cur.max)) cur.max = r.weight;
  }
  let best = null;
  let bestIndex = 0; // 1-based session index where best was first reached
  trend.forEach((s, i) => {
    if (s.max != null && (best == null || s.max > best)) {
      best = s.max;
      bestIndex = i + 1;
    }
  });
  const k = trend.length;
  return {
    sessions: k,
    eight_rep_max: best,
    trend,
    stalled: best != null && k - bestIndex >= STALL_SESSIONS,
  };
}

export async function loadCycles(db) {
  const catalog = await loadCatalog(db);
  const setRows = await rows(
    db.prepare(
      `SELECT s.cycle_id, s.session_id, ss.date, s.reps, s.weight
         FROM gym_sets s JOIN gym_sessions ss ON ss.id = s.session_id
        WHERE s.cycle_id IS NOT NULL
        ORDER BY s.cycle_id, ss.date, ss.id, s.position, s.set_index`
    )
  );
  const byCycle = new Map();
  for (const r of setRows) {
    if (!byCycle.has(r.cycle_id)) byCycle.set(r.cycle_id, []);
    byCycle.get(r.cycle_id).push(r);
  }
  const describe = c => ({
    cycle_id: c.id,
    exercise_id: c.exercise_id,
    exercise_name: catalog.exById.get(c.exercise_id)?.name ?? null,
    per_hand: !!catalog.exById.get(c.exercise_id)?.per_hand,
    started_on: c.started_on,
    ended_on: c.ended_on,
    ...cycleStats(byCycle.get(c.id) || []),
  });
  return catalog.groups.map(g => {
    const groupCycles = catalog.cycles.filter(c => c.group_id === g.id);
    const open = catalog.open.get(g.id);
    return {
      group: { id: g.id, name: g.name, color: g.color, sort_order: g.sort_order },
      active: open ? describe(open) : null,
      next_exercise_id: nextVariationId(catalog, g.id),
      variations: variationsOf(catalog, g.id, { includeArchived: true }).map(v => ({
        id: v.id,
        name: v.name,
        variation_order: v.variation_order,
        archived: !!v.archived,
      })),
      history: groupCycles
        .filter(c => c.ended_on != null)
        .sort((a, b) => b.started_on.localeCompare(a.started_on) || b.id - a.id)
        .map(describe),
    };
  });
}

// ---------- session validation + writes ----------

// Returns { error, status } or { value } where value = {date, template_id, notes, exercises:[{exercise_id, sets:[{reps, weight}]}]}
export async function validateSession(db, body, catalog) {
  if (!body) return { error: 'Invalid JSON body', status: 400 };
  if (!isDate(body.date)) return { error: 'date must be YYYY-MM-DD', status: 422 };

  let templateId = null;
  if (!isEmpty(body.template_id)) {
    templateId = toId(body.template_id);
    if (templateId == null) return { error: 'template_id must be an integer or null', status: 422 };
    const t = await db.prepare('SELECT id FROM gym_templates WHERE id = ?').bind(templateId).first();
    if (!t) return { error: 'template not found', status: 422 };
  }

  let notes = null;
  if (body.notes != null) {
    if (typeof body.notes !== 'string') return { error: 'notes must be text', status: 422 };
    notes = body.notes.trim().slice(0, 4000) || null;
  }

  if (!Array.isArray(body.exercises)) return { error: 'exercises must be an array', status: 422 };
  if (body.exercises.length > MAX_EXERCISES) return { error: 'too many exercises', status: 422 };

  const exercises = [];
  for (const [i, ex] of body.exercises.entries()) {
    const exId = toId(ex?.exercise_id);
    if (exId == null || !catalog.exById.has(exId)) {
      return { error: `exercises[${i}]: exercise not found`, status: 422 };
    }
    if (!Array.isArray(ex.sets)) return { error: `exercises[${i}]: sets must be an array`, status: 422 };
    if (ex.sets.length > MAX_SETS) return { error: `exercises[${i}]: too many sets`, status: 422 };
    const sets = [];
    for (const [j, s] of ex.sets.entries()) {
      if (isEmpty(s?.reps) && isEmpty(s?.weight)) continue; // blank row, ignored
      const reps = parseReps(s?.reps);
      if (reps == null) return { error: `exercises[${i}].sets[${j}]: reps must be a whole number >= 0`, status: 422 };
      const weight = parseWeight(s?.weight);
      if (weight == null) return { error: `exercises[${i}].sets[${j}]: weight must be a number >= 0`, status: 422 };
      sets.push({ reps, weight });
    }
    if (sets.length) exercises.push({ exercise_id: exId, sets });
  }
  if (!exercises.length) return { error: 'session has no sets', status: 422 };

  return { value: { date: body.date, template_id: templateId, notes, exercises } };
}

// Flat set rows with position/set_index assigned and cycle_id recomputed from scratch.
function flattenSets(value, catalog) {
  const out = [];
  value.exercises.forEach((ex, position) => {
    const exercise = catalog.exById.get(ex.exercise_id);
    const cycleId = stampCycleId(exercise, value.date, catalog.cycles);
    ex.sets.forEach((s, setIndex) =>
      out.push([ex.exercise_id, cycleId, position, setIndex + 1, s.reps, s.weight])
    );
  });
  return out;
}

const INSERT_SET =
  'INSERT INTO gym_sets (session_id, exercise_id, cycle_id, position, set_index, reps, weight) VALUES ';

// Atomic create. Returns the new session id.
export async function createSession(db, value, catalog) {
  const stmts = [
    db.prepare('INSERT INTO gym_sessions (date, template_id, notes) VALUES (?, ?, ?)')
      .bind(value.date, value.template_id, value.notes),
    // batch runs sequentially and atomically, so MAX(id) is the row inserted above
    ...flattenSets(value, catalog).map(r =>
      db.prepare(INSERT_SET + '((SELECT MAX(id) FROM gym_sessions), ?, ?, ?, ?, ?, ?)').bind(...r)
    ),
  ];
  const res = await db.batch(stmts);
  return res[0].meta.last_row_id;
}

// Atomic replace: update header, delete all sets, re-insert with fresh cycle stamping.
export async function replaceSession(db, id, value, catalog) {
  await db.batch([
    db.prepare("UPDATE gym_sessions SET date = ?, template_id = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(value.date, value.template_id, value.notes, id),
    db.prepare('DELETE FROM gym_sets WHERE session_id = ?').bind(id),
    ...flattenSets(value, catalog).map(r => db.prepare(INSERT_SET + '(?, ?, ?, ?, ?, ?, ?)').bind(id, ...r)),
  ]);
}

export async function deleteSession(db, id) {
  await db.batch([
    db.prepare('DELETE FROM gym_sets WHERE session_id = ?').bind(id),
    db.prepare('DELETE FROM gym_sessions WHERE id = ?').bind(id),
  ]);
}

// ---------- cycle PR highlighting ----------

// Returns a Set of gym_sets ids that are new cycle maxes (reps >= 8, strictly above every earlier
// qualifying set in the same cycle; the cycle's first session is baseline and never flagged).
export async function cyclePrSetIds(db, sessionIds) {
  const prs = new Set();
  if (!sessionIds.length) return prs;
  const setRows = await rows(
    db
      .prepare(
        `SELECT s.id, s.cycle_id, s.session_id, s.reps, s.weight
           FROM gym_sets s JOIN gym_sessions ss ON ss.id = s.session_id
          WHERE s.cycle_id IN (SELECT DISTINCT cycle_id FROM gym_sets
                                WHERE cycle_id IS NOT NULL AND session_id IN (${placeholders(sessionIds.length)}))
          ORDER BY s.cycle_id, ss.date, ss.id, s.position, s.set_index`
      )
      .bind(...sessionIds)
  );
  let cycle = null;
  let baselineSession = null;
  let max = null;
  for (const r of setRows) {
    if (r.cycle_id !== cycle) {
      cycle = r.cycle_id;
      baselineSession = r.session_id;
      max = null;
    }
    if (r.reps < 8) continue;
    if (r.session_id !== baselineSession && (max == null || r.weight > max)) prs.add(r.id);
    if (max == null || r.weight > max) max = r.weight;
  }
  return prs;
}

// Full session objects for the given ids, in the given order.
export async function loadSessions(db, ids) {
  if (!ids.length) return [];
  const ph = placeholders(ids.length);
  const [sessions, sets, prs] = await Promise.all([
    rows(
      db
        .prepare(
          `SELECT ss.*, t.name AS template_name FROM gym_sessions ss
             LEFT JOIN gym_templates t ON t.id = ss.template_id WHERE ss.id IN (${ph})`
        )
        .bind(...ids)
    ),
    rows(
      db
        .prepare(
          `SELECT s.*, e.name, e.per_hand, e.is_cycling, e.group_id, g.name AS group_name, g.color
             FROM gym_sets s JOIN gym_exercises e ON e.id = s.exercise_id
             LEFT JOIN gym_groups g ON g.id = e.group_id
            WHERE s.session_id IN (${ph}) ORDER BY s.session_id, s.position, s.set_index`
        )
        .bind(...ids)
    ),
    cyclePrSetIds(db, ids),
  ]);
  const byId = new Map(
    sessions.map(s => [
      s.id,
      {
        id: s.id,
        date: s.date,
        template_id: s.template_id,
        template_name: s.template_name,
        notes: s.notes,
        exercises: [],
      },
    ])
  );
  const lastEx = new Map(); // session_id -> current exercise entry
  for (const s of sets) {
    const session = byId.get(s.session_id);
    let cur = lastEx.get(s.session_id);
    if (!cur || cur.position !== s.position) {
      cur = {
        position: s.position,
        exercise_id: s.exercise_id,
        name: s.name,
        per_hand: !!s.per_hand,
        is_cycling: !!s.is_cycling,
        group_id: s.group_id,
        group_name: s.group_name,
        color: s.color,
        sets: [],
      };
      session.exercises.push(cur);
      lastEx.set(s.session_id, cur);
    }
    cur.sets.push({ reps: s.reps, weight: s.weight, cycle_id: s.cycle_id, is_cycle_pr: prs.has(s.id) });
  }
  return ids.map(id => byId.get(id)).filter(Boolean);
}

// ---------- templates + defaults ----------

// Template after the last logged session's template (latest date, then id), wrapping; first if none.
export async function defaultTemplateId(db) {
  const templates = await rows(db.prepare('SELECT id FROM gym_templates ORDER BY sort_order, id'));
  if (!templates.length) return null;
  const last = await db
    .prepare('SELECT template_id FROM gym_sessions ORDER BY date DESC, id DESC LIMIT 1')
    .first();
  const idx = last?.template_id == null ? -1 : templates.findIndex(t => t.id === last.template_id);
  return templates[(idx + 1) % templates.length].id;
}

export async function loadTemplates(db, catalog) {
  const [templates, slots] = await Promise.all([
    rows(db.prepare('SELECT * FROM gym_templates ORDER BY sort_order, id')),
    rows(db.prepare('SELECT * FROM gym_template_slots ORDER BY template_id, position, id')),
  ]);
  return templates.map(t => ({
    id: t.id,
    name: t.name,
    sort_order: t.sort_order,
    slots: slots
      .filter(s => s.template_id === t.id)
      .map(s => {
        const groupId = s.group_id ?? null;
        const exerciseId = groupId != null ? activeExerciseId(catalog, groupId) : s.exercise_id;
        const ex = catalog.exById.get(exerciseId);
        return {
          position: s.position,
          group_id: groupId,
          group_name: groupId != null ? catalog.groups.find(g => g.id === groupId)?.name ?? null : null,
          exercise_id: exerciseId,
          exercise_name: ex?.name ?? null,
        };
      }),
  }));
}

async function lastTime(db, exerciseId, date) {
  const dateClause = date ? 'AND ss.date <= ?' : '';
  const binds = date ? [exerciseId, date] : [exerciseId];
  const last = await db
    .prepare(
      `SELECT ss.id, ss.date FROM gym_sessions ss
        WHERE EXISTS (SELECT 1 FROM gym_sets WHERE session_id = ss.id AND exercise_id = ?) ${dateClause}
        ORDER BY ss.date DESC, ss.id DESC LIMIT 1`
    )
    .bind(...binds)
    .first();
  if (!last) return null;
  const sets = await rows(
    db
      .prepare(
        'SELECT reps, weight FROM gym_sets WHERE session_id = ? AND exercise_id = ? ORDER BY position, set_index'
      )
      .bind(last.id, exerciseId)
  );
  return { date: last.date, sets };
}

const repeat = (n, make) => Array.from({ length: n }, make);

// One defaults row; see "Defaults endpoint" shape in the spec.
export async function rowDefaults(db, catalog, exerciseId, slotGroupId = null, date = null) {
  const ex = catalog.exById.get(exerciseId);
  const active = ex.is_cycling ? activeExerciseId(catalog, ex.group_id) : null;
  const last = await lastTime(db, ex.id, date);

  let cycleMax = null;
  let sets;
  if (ex.is_cycling) {
    const open = catalog.open.get(ex.group_id);
    if (open && open.exercise_id === ex.id) {
      cycleMax = (
        await db.prepare('SELECT MAX(weight) AS m FROM gym_sets WHERE cycle_id = ? AND reps >= 8').bind(open.id).first()
      ).m;
    }
    const ever = (
      await db.prepare('SELECT MAX(weight) AS m FROM gym_sets WHERE exercise_id = ? AND reps >= 8').bind(ex.id).first()
    ).m;
    const lastWeight = last ? last.sets[last.sets.length - 1]?.weight : null;
    const weight = cycleMax ?? ever ?? lastWeight ?? ex.starting_weight ?? 0;
    sets = repeat(DEFAULT_SETS, () => ({ reps: DEFAULT_REPS, weight }));
  } else {
    sets = last
      ? last.sets.map(s => ({ reps: s.reps, weight: s.weight }))
      : repeat(DEFAULT_SETS, () => ({ reps: DEFAULT_REPS, weight: ex.starting_weight ?? 0 }));
  }

  return {
    slot_group_id: slotGroupId,
    exercise: {
      id: ex.id,
      name: ex.name,
      per_hand: !!ex.per_hand,
      is_cycling: !!ex.is_cycling,
      group_id: ex.group_id ?? null,
    },
    active_exercise_id: active,
    is_active_variation: ex.is_cycling ? active === ex.id : false,
    sets,
    last_time: last,
    cycle_max: cycleMax,
  };
}
