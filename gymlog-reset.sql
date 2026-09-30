-- Gym log RESET. DESTROYS ALL gym_* DATA. Local dev only:
--   npm run gymlog:reset:local
-- NEVER run this with --remote.

DROP TABLE IF EXISTS gym_sets;
DROP TABLE IF EXISTS gym_sessions;
DROP TABLE IF EXISTS gym_cycles;
DROP TABLE IF EXISTS gym_template_slots;
DROP TABLE IF EXISTS gym_templates;
DROP TABLE IF EXISTS gym_exercises;
DROP TABLE IF EXISTS gym_groups;
