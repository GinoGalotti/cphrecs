-- Gym log seed. Idempotent: explicit ids + INSERT OR IGNORE, so re-running
-- never duplicates rows or overwrites edits (e.g. after a cycle rotation).

-- Movement groups (id = rotation position)
INSERT OR IGNORE INTO gym_groups (id, name, sort_order, color) VALUES
  (1, 'Horizontal Press', 1, '#b14635'),
  (2, 'Horizontal Pull',  2, '#56715f'),
  (3, 'Vertical Press',   3, '#c2882c'),
  (4, 'Vertical Pull',    4, '#5b8aa6'),
  (5, 'Squat',            5, '#5a3b2e'),
  (6, 'Hinge',            6, '#6b7335');

-- Cycling variations (first of each group = initially active)
INSERT OR IGNORE INTO gym_exercises (id, name, is_cycling, per_hand, group_id, variation_order) VALUES
  (1,  'Dumbbell bench press',   1, 1, 1, 1),
  (2,  'Incline press',          1, 0, 1, 2),
  (3,  'Chest press',            1, 0, 1, 3),
  (4,  'Barbell row',            1, 0, 2, 1),
  (5,  'Chest supported row',    1, 0, 2, 2),
  (6,  'Single arm row',         1, 1, 2, 3),
  (7,  'Military press',         1, 0, 3, 1),
  (8,  'Viking press',           1, 0, 3, 2),
  (9,  'DB shoulder press',      1, 1, 3, 3),
  (10, 'Pull-up',                1, 0, 4, 1),
  (11, 'Pull-down (machine)',    1, 0, 4, 2),
  (12, 'Neutral-grip chin-up',   1, 0, 4, 3),
  (13, 'Front squat',            1, 0, 5, 1),
  (14, 'Back squat',             1, 0, 5, 2),
  (15, 'Pendulum squat',         1, 0, 5, 3),
  (16, 'Deadlift',               1, 0, 6, 1),
  (17, 'Single leg DL',          1, 0, 6, 2),
  (18, 'RDL',                    1, 0, 6, 3);

-- Auxiliary exercises (not cycled)
INSERT OR IGNORE INTO gym_exercises (id, name, is_cycling, per_hand) VALUES
  (19, 'Triceps rope',                       0, 0),
  (20, 'Overhead cable triceps extension',   0, 0),
  (21, 'Lateral raises',                     0, 1),
  (22, 'Bicep curl',                         0, 1),
  (23, 'Face pull',                          0, 0),
  (24, 'Hip thrust',                         0, 0),
  (25, 'Abs',                                0, 0),
  (26, 'Bulgarian split squat',              0, 0),
  (27, 'Leg extension',                      0, 0),
  (28, 'Leg curl',                           0, 0);

-- One open cycle per group on its first variation
INSERT OR IGNORE INTO gym_cycles (id, group_id, exercise_id, started_on) VALUES
  (1, 1, 1,  date('now')),
  (2, 2, 4,  date('now')),
  (3, 3, 7,  date('now')),
  (4, 4, 10, date('now')),
  (5, 5, 13, date('now')),
  (6, 6, 16, date('now'));

-- 5-day split (order = default rotation)
INSERT OR IGNORE INTO gym_templates (id, name, sort_order) VALUES
  (1, 'Push',   1),
  (2, 'Pull',   2),
  (3, 'Legs A', 3),
  (4, 'Upper',  4),
  (5, 'Legs B', 5);

-- Slots: exactly one of group_id / exercise_id
INSERT OR IGNORE INTO gym_template_slots (id, template_id, position, group_id, exercise_id) VALUES
  -- Push: Horizontal Press, Vertical Press, Triceps rope, Lateral raises
  (1,  1, 0, 1, NULL), (2,  1, 1, 3, NULL), (3,  1, 2, NULL, 19), (4,  1, 3, NULL, 21),
  -- Pull: Horizontal Pull, Vertical Pull, Bicep curl, Face pull
  (5,  2, 0, 2, NULL), (6,  2, 1, 4, NULL), (7,  2, 2, NULL, 22), (8,  2, 3, NULL, 23),
  -- Legs A: Squat, Hinge, Hip thrust, Abs
  (9,  3, 0, 5, NULL), (10, 3, 1, 6, NULL), (11, 3, 2, NULL, 24), (12, 3, 3, NULL, 25),
  -- Upper: Horizontal Press, Vertical Pull, Vertical Press, Horizontal Pull
  (13, 4, 0, 1, NULL), (14, 4, 1, 4, NULL), (15, 4, 2, 3, NULL), (16, 4, 3, 2, NULL),
  -- Legs B: Squat, Hinge, Bulgarian split squat, Abs
  (17, 5, 0, 5, NULL), (18, 5, 1, 6, NULL), (19, 5, 2, NULL, 26), (20, 5, 3, NULL, 25);
