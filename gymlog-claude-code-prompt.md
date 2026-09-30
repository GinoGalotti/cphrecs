# Build `/gymlog` — variation-cycling training log

## Context
Add a small, private web app at `ginogalotti.com/gymlog` for logging lifting sessions and tracking **variation cycling**: each main movement pattern has 3 exercise variations; I train one variation per movement for a "cycle", track the heaviest weight I manage for 8 reps, and rotate to the next variation when progress stalls.

The site already runs on **Cloudflare Pages + Functions + D1**, with HTTP Basic Auth for `/admin/*` via `functions/admin/_middleware.js` and secrets in Pages settings. Inspect the repo first and **follow existing conventions** (see "Repo facts" below — already verified, but re-read the listed files before coding). Do not introduce a new framework or build step; vanilla JS + static HTML + Pages Functions API.

Before writing any UI code, invoke the **frontend-design** skill (installed plugin `frontend-design`) and follow it — within the constraints of the existing site design system described below.

Work on a branch `feat/gymlog`. Commit per phase with conventional messages (`feat(gymlog): …`), matching the repo's history style.

---

## Repo facts (verified — do not re-decide these)

| Topic | Fact | Files to read first |
|---|---|---|
| Hosting | Cloudflare Pages, **no build step**, output dir = repo root (`.`). Every file in the repo is served statically unless a Function intercepts it. | `README.md`, `wrangler.jsonc` |
| Functions | File-based routing in `functions/`. Handlers export `onRequestGet` / `onRequestPost` or a single `onRequest` with a method check. JSON helper pattern: `const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json'}})`. Errors return `{error: '...'}` with 4xx; `503` if `!env.DB`. | `functions/admin/api/stories/[slug].js`, `functions/stories/index.js` |
| D1 | **One** binding `DB` → database `ginogalotti-stories` (id in `wrangler.jsonc`). Shared with the `stories` table. Schema lives in a root `.sql` file applied with `wrangler d1 execute --file` (no `migrations/` dir). | `schema.sql`, `playwright.config.js` (comment has the local commands) |
| Auth | Basic Auth middleware, realm `"admin"`, creds from `env.ADMIN_USER` / `env.ADMIN_PASS` (Pages secrets in prod, `.dev.vars` locally — gitignored, never print its values). | `functions/admin/_middleware.js`, `.gitignore` |
| Design system | Tokens: `--paper:#f5ecdd; --paper-2:#efe3cf; --ink:#2a221c; --ink-soft:#5b4f44; --rust:#b14635; --rust-deep:#8f3326; --sage:#56715f; --gold:#c2882c; --line:#cdbca0; --card:#fffaf0; --muted:#8a7b63`. Fonts: **Fraunces** (display, italic accents) + **Hanken Grotesk** (body) via Google Fonts (copy the exact `<link>` from `meals/w25/index.html`). Paper-grain `body::before` SVG noise overlay. Uppercase letter-spaced rust **kicker**, heavy Fraunces h1, `2px solid var(--ink)` header rule. | `meals/styles.css` (**the card style to match**: `.card` with punch-hole `::before` accent stripe using `--accent`, dashed `.card-head` divider, `.macro` grid cells), `index.html` (pill buttons `.links a`, `.primary`), `functions/admin/index.js` (badges) |
| Frontend JS | Vanilla, `(function(){ "use strict"; … })()` IIFE, small `el()` helper, data fetched at runtime and rendered client-side. Page CSS in a shared stylesheet referenced relatively. | `meals/menu.js`, `meals/w25/index.html` |
| Tests | Playwright in `tests/*.spec.js`, `baseURL http://localhost:8788`, webServer = `npx wrangler pages dev . --port 8788`. **Note:** existing `tests/admin.spec.js` assumes an old Cloudflare Access bypass and fails against the current Basic Auth — out of scope, don't fix, don't be confused by it. | `playwright.config.js`, `tests/meals.spec.js` |
| Private pages | Use `<meta name="robots" content="noindex">` (as in meals). | |

---

## Architecture decisions (resolved)

1. **Auth reuse** — create `functions/gymlog/_middleware.js` containing exactly:
   ```js
   export { onRequest } from "../admin/_middleware.js";
   ```
   This protects every request under `/gymlog/*` (static HTML/JS/CSS **and** API) with the same credentials and realm, so the browser reuses the admin login. No new secrets, no copied logic.
   Must verify (see Verification): unauthenticated `curl -i` on `/gymlog/`, `/gymlog/new/`, `/gymlog/gymlog.js`, `/gymlog/api/exercises` all return **401**.
2. **Pages are static files, API is Functions.** Static HTML in a `gymlog/` folder (like `meals/`), client JS calls JSON endpoints under `/gymlog/api/`. No server-rendered HTML for gymlog.
3. **Same D1 database, prefixed tables.** Use the existing `DB` binding. All tables prefixed `gym_` (avoids clashes with the shared DB and the SQLite keyword `GROUPS`).
4. **Schema/seed as root SQL files**, mirroring `schema.sql`: `gymlog-schema.sql` (idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE … INDEX IF NOT EXISTS`) and `gymlog-seed.sql` (idempotent: `INSERT OR IGNORE` with explicit ids, or guarded by `WHERE NOT EXISTS`). Re-running either must never wipe or duplicate data. Plus `gymlog-reset.sql` (DROPs the `gym_*` tables) for local dev only — README must say **never run with `--remote`**.
5. **Dates** are `TEXT 'YYYY-MM-DD'`. "Today" is computed **client-side in local time** (I'm in Copenhagen; server UTC would be wrong near midnight) and sent to the API (e.g. rotate sends `{date}`); server falls back to `date('now')` only if absent.
6. **Atomic writes** — any multi-statement write (save session + sets, rotate cycle) uses `env.DB.batch([...])` (transactional in D1).
7. JSON API responses add `Cache-Control: no-store`.

### File plan
```
functions/gymlog/_middleware.js            # re-export admin Basic Auth
functions/gymlog/_lib/db.js                # shared queries: bestEightRep, defaults, cycle lookup, stats (no onRequest exports → not a route)
functions/gymlog/_lib/http.js              # json(), readJson(), parseWeight(), validation helpers
functions/gymlog/api/groups.js             # GET
functions/gymlog/api/templates.js          # GET (slots resolved)
functions/gymlog/api/exercises/index.js    # GET (?include_archived=1), POST
functions/gymlog/api/exercises/[id].js     # PUT (edit incl. archived flag)
functions/gymlog/api/sessions/index.js     # GET (?before=<date>&limit=30), POST
functions/gymlog/api/sessions/[id].js      # GET, PUT, DELETE
functions/gymlog/api/cycles/index.js       # GET (derived stats + history)
functions/gymlog/api/cycles/rotate.js      # POST {group_id, exercise_id?, date}
functions/gymlog/api/defaults.js           # GET ?template_id=&date=[&exercise_id=]
gymlog/index.html                          # /gymlog/        Log (landing)
gymlog/new/index.html                      # /gymlog/new/    New session; edit via /gymlog/new/?id=123
gymlog/cycles/index.html                   # /gymlog/cycles/
gymlog/exercises/index.html                # /gymlog/exercises/
gymlog/gymlog.css                          # shared styles (site tokens + gym components)
gymlog/gymlog.js                           # shared: api() fetch wrapper, el(), fmtKg(), parseWeight(), todayLocal(), tab bar, group colours
gymlog/log.js  gymlog/session.js  gymlog/cycles.js  gymlog/exercises.js   # per-page
gymlog-schema.sql  gymlog-seed.sql  gymlog-reset.sql
tests/gymlog.spec.js
```
Add npm scripts to `package.json` (use `npx wrangler`, wrangler isn't a dependency):
`gymlog:db:local` (schema + seed, `--local`), `gymlog:db:remote` (schema + seed, `--remote`), `gymlog:reset:local`.

---

## Core concepts
- **Movement group** (cycling group): Horizontal Press, Horizontal Pull, Vertical Press, Vertical Pull, Squat, Hinge. Each has an ordered list of 3 variations.
- **Cycling exercise**: belongs to a group; its performance is tracked per cycle.
- **Auxiliary exercise**: not cycled (triceps rope, face pulls, abs…). Logged the same way, but no cycle stats.
- **Cycle**: one period where a group uses one specific variation. Exactly one open cycle per group at a time. Both weekly sessions that hit a group use the same active variation.
- **8-rep max** for an exercise within a cycle = heaviest weight on any set with `reps >= 8`.
- **Day template**: an ordered list of slots. A slot is either a movement group (resolves to that group's active variation) or a fixed auxiliary exercise.

## Seed data

### Groups and variations (rotation order; first = currently active)
| Group | Variations |
|---|---|
| Horizontal Press | Dumbbell bench press, Incline press, Chest press |
| Horizontal Pull | Barbell row, Chest supported row, Single arm row |
| Vertical Press | Military press, Viking press, DB shoulder press |
| Vertical Pull | Pull-up, Pull-down (machine), Neutral-grip chin-up |
| Squat | Front squat, Back squat, Pendulum squat |
| Hinge | Deadlift, Single leg DL, RDL |

Seed one open cycle per group on its first variation, `started_on = date('now')`.

### Auxiliary exercises
Triceps rope, Overhead cable triceps extension, Lateral raises, Bicep curl, Face pull, Hip thrust, Abs, Bulgarian split squat, Leg extension, Leg curl.

### Per-hand (dumbbell) flags — seed `per_hand = 1` for:
Dumbbell bench press, DB shoulder press, Single arm row, Lateral raises, Bicep curl. Everything else `0` (editable later on the Exercises page).

### Day templates (5-day split; order = default rotation, not tied to weekdays)
1. **Push**: Horizontal Press, Vertical Press, Triceps rope, Lateral raises
2. **Pull**: Horizontal Pull, Vertical Pull, Bicep curl, Face pull
3. **Legs A**: Squat, Hinge, Hip thrust, Abs
4. **Upper**: Horizontal Press, Vertical Pull, Vertical Press, Horizontal Pull
5. **Legs B**: Squat, Hinge, Bulgarian split squat, Abs

Starting weights: 0 for all (I'll edit). Units: kg.

## Data model (D1)
```
gym_groups(id INTEGER PK, name TEXT UNIQUE NOT NULL, sort_order INT NOT NULL, color TEXT NOT NULL)
gym_exercises(id INTEGER PK, name TEXT UNIQUE NOT NULL, is_cycling INT NOT NULL DEFAULT 0,
              per_hand INT NOT NULL DEFAULT 0, group_id INT NULL REFERENCES gym_groups(id),
              variation_order INT NULL, starting_weight REAL NOT NULL DEFAULT 0,
              archived INT NOT NULL DEFAULT 0)
gym_templates(id INTEGER PK, name TEXT UNIQUE NOT NULL, sort_order INT NOT NULL)
gym_template_slots(id INTEGER PK, template_id INT NOT NULL, position INT NOT NULL,
                   group_id INT NULL, exercise_id INT NULL,
                   CHECK ((group_id IS NULL) <> (exercise_id IS NULL)))
gym_cycles(id INTEGER PK, group_id INT NOT NULL, exercise_id INT NOT NULL,
           started_on TEXT NOT NULL, ended_on TEXT NULL)
  -- CREATE UNIQUE INDEX IF NOT EXISTS gym_cycles_one_open ON gym_cycles(group_id) WHERE ended_on IS NULL;
gym_sessions(id INTEGER PK, date TEXT NOT NULL, template_id INT NULL, notes TEXT,
             created_at TEXT NOT NULL DEFAULT (datetime('now')),
             updated_at TEXT NOT NULL DEFAULT (datetime('now')))
gym_sets(id INTEGER PK, session_id INT NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,
         exercise_id INT NOT NULL, cycle_id INT NULL, position INT NOT NULL,
         set_index INT NOT NULL, reps INT NOT NULL, weight REAL NOT NULL)
```
Add indexes on `gym_sets(exercise_id)`, `gym_sets(cycle_id)`, `gym_sets(session_id)`, `gym_sessions(date)`. Don't rely on `ON DELETE CASCADE` alone: delete sets explicitly in the same batch.

`gym_groups.color` = the group's chip/accent colour. Seed with these colours from the site palette: Horizontal Press `#b14635` (rust), Horizontal Pull `#56715f` (sage), Vertical Press `#c2882c` (gold), Vertical Pull `#5b8aa6` (sky), Squat `#5a3b2e` (cocoa), Hinge `#6b7335` (olive). Auxiliary exercises use `--ink-soft`.

### Derivation rules (implement exactly, in `_lib/db.js`)
- **cycle_id stamping** (on every POST/PUT of a session, recomputed from scratch): for a set whose exercise is cycling, `cycle_id` = the cycle with `group_id = exercise.group_id AND exercise_id = set.exercise_id AND started_on <= session.date AND (ended_on IS NULL OR session.date <= ended_on)`. Prefer the open cycle if more than one matches (rotation day overlap). If none match (e.g. a swapped, non-active variation), use `NULL`. Auxiliary gives `NULL`.
- **Cycle 8-rep max** = `MAX(weight) FROM gym_sets WHERE cycle_id = ? AND reps >= 8`.
- **Per-session trend** = for each session with sets in the cycle (date asc, id asc), that session's max weight with reps ≥ 8 (or null if none).
- **Stall**: `const STALL_SESSIONS = 3`. Let the cycle's best be first reached at session index `i` (1-based) out of `k` sessions. The cycle is stalled if `k - i >= STALL_SESSIONS`.
- **New cycle max highlight (log)**: a set is flagged `is_cycle_pr` if it has `reps >= 8`, a `cycle_id`, and a weight strictly greater than every earlier (by session date, id, then position/set_index) qualifying set in the same cycle, and it's the first set in its session reaching that weight. The cycle's **first session is baseline and never highlighted**. Compute server-side in the sessions GET.
- **Default weight** (cycling rows): best 8-rep in the current open cycle for that exercise, then best 8-rep ever for that exercise, then last weight used, then `starting_weight`, then 0. Defaults: 3 sets × 8 reps at that weight.
- **Auxiliary defaults**: copy the sets (count, reps, weight) from the last session that logged that exercise. If it has never been logged: 3 × 8 @ `starting_weight`.
- **Default template**: the template after the last logged session's template (latest `date`, then `id`) in `sort_order`, wrapping. First template if there are no sessions.
- **Defaults endpoint** `GET /gymlog/api/defaults?template_id=` returns ordered rows `{slot_group_id|null, exercise:{id,name,per_hand,is_cycling,group_id}, active_exercise_id|null, is_active_variation, sets:[{reps,weight}], last_time:{date, sets:[{reps,weight}]}|null, cycle_max|null}`. `GET /gymlog/api/defaults?exercise_id=` returns the same shape for a single row, which the client uses when the user swaps the exercise in a row.

---

## Features

### 1. New session (`/gymlog/new/`): primary screen, mobile-first
- Date (default today, local) and template picker. Default template = see derivation rules.
- Selecting a template populates exercise rows via `/defaults`. Group slots resolve to the group's active variation; auxiliary slots resolve to their exercise.
- Each exercise row:
  - Exercise **dropdown** to swap. For cycling rows, list the group's variations first (`<optgroup>` labelled with group name), then everything else. Auxiliary rows list all exercises. Archived exercises are hidden. Swapping a cycling exercise to a different variation for one session does **not** change the active cycle; show a small note ("Not the active variation, won't count toward the cycle") if the chosen variation isn't the active one. On swap, refetch that row's defaults.
  - Sets: default **3 sets**, each with reps (default 8) and weight inputs. Add/remove set buttons. Each set is independent.
  - Show the "last time" hint (date + sets, e.g. `12 Sep · 80×8, 85×8, 85×7`) and the current cycle max inline.
  - Weight is a free numeric input (no step buttons). Decimals are allowed, and both `.` and `,` work as the decimal separator (`parseWeight`: replace `,` with `.`, `Number()`, must be finite and ≥ 0; validate again server-side). Store as REAL. Display with trailing zeros trimmed (`82.5`, `80`).
  - Dumbbell (`per_hand`) exercises are logged per dumbbell (one hand). Label the weight column "Kg / dumbbell" for those, and "Kg" otherwise.
- Append an exercise row (button at the bottom), remove a row. Reordering isn't required.
- Notes textarea (optional).
- Save session: `POST /gymlog/api/sessions` (or `PUT …/:id` in edit mode), then redirect to `/gymlog/`. Server validates: date format, reps int ≥ 0, weight ≥ 0, exercise exists. Ignore sets where both reps and weight are empty.
- **Autosave** the in-progress form to `localStorage` on every input (key `gymlog:draft:new`, or `gymlog:draft:<id>` when editing). On load, if a draft exists, restore it and show a dismissible "Restored unsaved session · Discard" banner. Clear the draft on successful save. Wrap all storage access in try/catch.
- Large touch targets (≥ 44px), `inputmode="decimal"` for weight, `inputmode="numeric"` for reps. Usable one-handed. The Save button is sticky at the bottom, above the tab bar.
- **Edit mode**: `/gymlog/new/?id=123` loads the session via `GET /gymlog/api/sessions/123` into the same form, with a Delete button (confirm first) that sends `DELETE` and redirects to `/gymlog/`.

### 2. Log (`/gymlog/`): landing page
- Reverse-chronological list of sessions (30 per page, "Load older" button using `?before=`). Each shows date, template name, and each exercise with its sets compactly (e.g. `Front squat — 80×8, 85×8, 85×7`). Highlight `is_cycle_pr` sets (rust, bold, small ★). Show group colour chips on cycling exercises.
- Tapping a session goes to `/gymlog/new/?id=…` (edit/delete).
- Prominent "Log session" button (`.primary` pill style).
- Empty state when there are no sessions yet.

### 3. Cycles (`/gymlog/cycles/`)
- One card per group, using the meals `.card` style with the punch-hole stripe in the group colour (`--accent`). Each card shows the active variation, cycle start date, number of sessions in the cycle, the current 8-rep max (big number, like `.macro .v`), and the per-session trend as **inline SVG bars** (no chart library; null sessions render as an empty tick).
- **Stall hint**: a gold badge "Stalled · no new 8-rep max in 3 sessions" when stalled.
- A "Rotate" button opens an inline panel (not a modal) with a variation picker that defaults to the next variation in `variation_order` (wrapping; skip archived) and a Confirm button. Confirm sends a POST to `/rotate` with `{group_id, exercise_id, date: todayLocal()}`. In one batch it closes the open cycle (`ended_on = date`) and opens the new one (`started_on = date`). Reject rotating to the currently active variation.
- Cycle history table per group (collapsible `<details>`): variation, start–end, sessions, 8-rep max at the end.

### 4. Exercises (`/gymlog/exercises/`)
- List all exercises grouped as: each movement group (in rotation order), then Auxiliary, then Archived (collapsed). Each row shows the name, type, group chip, per-hand marker, and starting weight.
- Add exercise form: name, `is_cycling` checkbox, group dropdown (enabled only when cycling, required if so), `per_hand` checkbox, starting weight. New cycling exercises are appended to the end of their group's rotation order (`MAX(variation_order)+1`). Duplicate names give a 409 with a friendly message.
- Edit inline (name, per_hand, starting weight, archived). Archiving the **active** variation of a group is rejected with a message ("Rotate this group first"). Archived exercises are hidden from dropdowns but kept in history.
- Template editing is **out of scope for v1** (the seed is enough).

## API summary (all under `/gymlog/api/`, JSON, Basic Auth via middleware)
`GET groups` · `GET templates` · `GET|POST exercises` · `PUT exercises/:id` · `GET|POST sessions` · `GET|PUT|DELETE sessions/:id` · `GET cycles` · `POST cycles/rotate` · `GET defaults`.
Session payload: `{date, template_id|null, notes, exercises:[{exercise_id, sets:[{reps, weight}]}]}`. The server assigns `position` (the exercise index), `set_index`, and `cycle_id`.

**As built (phase 2 is done; the UI must use these shapes, and `functions/gymlog/` is the source of truth):**
- Lists are wrapped: `{groups}`, `{exercises}`, `{templates, default_template_id}`, `{cycles}` (each cycle includes `next_exercise_id`), and `{sessions, has_more, next_before, next_before_id}`. For "Load older", pass **both** `before` and `before_id`.
- `defaults?template_id=` returns `{template_id, rows}`. `defaults?exercise_id=` returns a **single row object** (pass `slot_group_id` so it's echoed back).
- Errors are `{error}` with 409 (duplicate name, archiving the active variation) or 422 (validation, **including a session with no sets**). Show `error` inline near the relevant control.
- Same-day rotation: a session dated on the rotation day that uses the *old* variation is stamped to the just-closed cycle, by design. Mention this in the README's cycles section.

## UI spec (the claude.ai prototype isn't in the repo, so this describes it)
- **Bottom tab bar**, fixed, 4 tabs: Log · New · Cycles · Exercises. Current tab highlighted in rust. Pad it with `env(safe-area-inset-bottom)`. Content gets bottom padding so nothing hides behind it.
- A compact masthead on each page: rust kicker "Gym log" plus a Fraunces h1 (the page name). Keep it smaller than the meals masthead, since this is a tool.
- **Group colour chips**: a small pill in the group colour with paper text (e.g. `H-PRESS`, `SQUAT`).
- **Set rows** as a 4-column grid: `Set | Reps | Kg | ×` with a header row in the `.basis`-style micro-label (uppercase, letter-spaced, muted).
- Exercise rows on the new-session screen are `.card`s with the punch-hole stripe in the group colour (ink-soft for auxiliary).
- Max content width 680px (`.sheet`), 16px side padding, paper grain background. Respect `prefers-reduced-motion`.

## Non-goals (v1)
No multi-user, no charts library (inline SVG only), no plate calculator, no RPE, no rest timers, no import of old logs, and no template editor.

## Deliverables
1. `gymlog-schema.sql`, `gymlog-seed.sql`, `gymlog-reset.sql`, plus npm scripts.
2. API functions and `_lib`.
3. Pages: log, new/edit session, cycles, exercises.
4. README section "Gym log (`/gymlog`)" covering: routes; local setup (`npm run gymlog:db:local`, `npx wrangler pages dev . --port 8788`, log in with the `.dev.vars` admin creds); production setup (`npm run gymlog:db:remote` **before** pushing the deploy); how to add an exercise; how cycles, defaults, and stall are computed.
5. `tests/gymlog.spec.js` (Playwright). Read the creds from `process.env.ADMIN_USER/ADMIN_PASS`, falling back to parsing `.dev.vars`, and pass them via `test.use({ httpCredentials })`. Cover the 401 without creds and the verification flow below.

## Verification (must actually run, and report the output)
Local, against a fresh DB (`npm run gymlog:reset:local && npm run gymlog:db:local`), with `npx wrangler pages dev . --port 8788`:
1. `curl -i` **without** creds on `/gymlog/`, `/gymlog/new/`, `/gymlog/gymlog.js`, and `/gymlog/api/exercises` all give 401. `/admin` still gives 401 and `/meals/w25/` still gives 200.
2. With creds (`curl -u "$ADMIN_USER:$ADMIN_PASS"`, loaded from `.dev.vars` without echoing them): run schema + seed twice and check that the counts don't change (idempotency).
3. Log a Push session with Dumbbell bench press 3×8 @ 30. Check that `GET defaults?template_id=<Upper>` then proposes 30 for Dumbbell bench press, and that the default template is Pull.
4. Log a second session with Dumbbell bench press at 32×8. The log highlights 32 as a cycle PR (the first session doesn't). Cycles shows max 32 with 2 trend bars.
5. Rotate Horizontal Press. The next variation (Incline press) becomes active, the history shows the closed cycle, and `defaults` for Push now resolves to Incline press.
6. Swap a row to a non-active variation and save. Its sets get `cycle_id NULL` and it doesn't affect cycle stats.
7. Edit and then delete a session from the UI. Check the autosave restore after a page reload mid-entry.
8. Test weights `82,5` and `82.5`, which should both store `82.5`.
9. `npx playwright test tests/gymlog.spec.js` passes.
10. Check the UI at a 390px viewport (Playwright screenshot of each of the 4 pages) and fix any overflow.

Ask me before choosing anything that contradicts existing repo conventions or the decisions above. Don't touch `tripjuly26.html`, `trips/`, `cphrecs/`, `meals/`, or the stories/admin functions (except importing the admin middleware).
