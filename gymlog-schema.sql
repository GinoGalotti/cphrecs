-- Gym log (/gymlog). Idempotent: safe to re-run, never drops or wipes data.
--   local:  npm run gymlog:db:local
--   remote: npm run gymlog:db:remote

CREATE TABLE IF NOT EXISTS gym_groups (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL,
  color       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_exercises (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  is_cycling      INTEGER NOT NULL DEFAULT 0,
  per_hand        INTEGER NOT NULL DEFAULT 0,
  group_id        INTEGER REFERENCES gym_groups(id),
  variation_order INTEGER,
  starting_weight REAL NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gym_templates (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_template_slots (
  id          INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL,
  position    INTEGER NOT NULL,
  group_id    INTEGER,
  exercise_id INTEGER,
  CHECK ((group_id IS NULL) <> (exercise_id IS NULL))
);

CREATE TABLE IF NOT EXISTS gym_cycles (
  id          INTEGER PRIMARY KEY,
  group_id    INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  started_on  TEXT NOT NULL,  -- 'YYYY-MM-DD'
  ended_on    TEXT            -- NULL = open
);

CREATE TABLE IF NOT EXISTS gym_sessions (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,  -- 'YYYY-MM-DD', client-local
  template_id INTEGER,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gym_sets (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  cycle_id    INTEGER,
  position    INTEGER NOT NULL,
  set_index   INTEGER NOT NULL,
  reps        INTEGER NOT NULL,
  weight      REAL NOT NULL
);

-- exactly one open cycle per group
CREATE UNIQUE INDEX IF NOT EXISTS gym_cycles_one_open ON gym_cycles(group_id) WHERE ended_on IS NULL;
CREATE INDEX IF NOT EXISTS gym_sets_exercise ON gym_sets(exercise_id);
CREATE INDEX IF NOT EXISTS gym_sets_cycle    ON gym_sets(cycle_id);
CREATE INDEX IF NOT EXISTS gym_sets_session  ON gym_sets(session_id);
CREATE INDEX IF NOT EXISTS gym_sessions_date ON gym_sessions(date);
