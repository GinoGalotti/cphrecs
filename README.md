# ginogalotti.com

Static site, no build step.

## Structure
- `index.html` — landing page at the root domain
- `cphrecs/index.html` — Copenhagen food guide → served at `/cphrecs`
- `cphrecs/cph-img/` — the four highlight photos
- `cphrecs/charlie/` — Charlie gallery media (edit the CHARLIE_MEDIA list in cphrecs/index.html)
- `meals/` — weekly meal-prep menus. Shared `styles.css` + `menu.js`; `ingredients.json` is the shared macro library.
  - `meals/w25/index.html` → served at `/meals/w25`; reads `meals/w25/recipes.json` at runtime.
  - New week = copy a `wNN/` folder (index.html + recipes.json). The week number is read from the URL, so the markup is identical each week.

## Hosting (Cloudflare Pages)
Framework preset: **None**. Build command: **(empty)**. Output directory: **/** (root).
Pure static — Pages just serves the files as-is.

## Stormstories (`/stormstories`)
- `stormstories/zero/` → `/stormstories/zero` — session zero primer for the Stonewalkers campaign.
- Static. Wording source is `session-zero.md`, design spec is `DESIGN.md` (same folder).
- `noindex`, and not linked from the landing page.

## Gym log (`/gymlog`)
Private, mobile-first lifting log with **variation cycling**. Vanilla JS pages in `gymlog/`, JSON API in `functions/gymlog/`, tables prefixed `gym_` in the shared `DB` (D1 `ginogalotti-stories`). Everything under `/gymlog/*` (pages, assets and API) is behind the same Basic Auth as `/admin` (`functions/gymlog/_middleware.js` re-exports it; no extra secrets).

### Routes
| Route | What |
|---|---|
| `/gymlog/` | Log: sessions newest first, ★ on new cycle maxes |
| `/gymlog/new/` | New session (`/gymlog/new/?id=123` edits or deletes session 123) |
| `/gymlog/cycles/` | One card per movement group: active variation, 8-rep max, trend, rotate, history |
| `/gymlog/exercises/` | Add / edit / archive exercises |
| `/gymlog/api/…` | `groups`, `templates`, `exercises`, `exercises/:id`, `sessions`, `sessions/:id`, `cycles`, `cycles/rotate`, `defaults` |

### Local setup
```
npm run gymlog:db:local                 # schema + seed into the local D1 (idempotent)
npx wrangler pages dev . --port 8788
```
Open http://localhost:8788/gymlog/ and log in with the `ADMIN_USER` / `ADMIN_PASS` from `.dev.vars` (gitignored). `npm run gymlog:reset:local` drops all `gym_*` tables (local dev only — **never run the reset SQL with `--remote`**).

### Production setup
Run `npm run gymlog:db:remote` **before** pushing the deploy (the pages call the API on load). It is idempotent, so re-running never wipes or duplicates data. `ADMIN_USER` / `ADMIN_PASS` are the existing Pages secrets.

### Tests
`npx playwright test tests/gymlog.spec.js` — resets and re-seeds the local `gym_*` tables itself, then covers auth (401 without credentials), seed idempotency, the cycling flow and 390px screenshots (`test-results/gymlog-*-390.png`). Credentials come from `ADMIN_USER`/`ADMIN_PASS` or `.dev.vars`.

### Adding an exercise
Use the **Exercises** page. Tick *Cycling exercise* and pick a movement group to add a variation (appended to the end of that group's rotation, `MAX(variation_order)+1`); leave it unticked for an auxiliary exercise. Names must be unique (case-insensitive, otherwise a 409). Edit name, per-hand, starting weight and archived inline; archived exercises are hidden from dropdowns but stay in history, and the group's *active* variation can't be archived until you rotate. Day templates are seeded in `gymlog-seed.sql` (no editor in v1).

### How it works
- **Dates** are `YYYY-MM-DD`, computed client-side in local time and sent to the API; the server only falls back to `date('now')` (UTC) when a date is missing.
- **Cycle** = a period where one group uses one variation; exactly one is open per group. **8-rep max** = heaviest weight on any set with `reps >= 8`.
- **cycle_id stamping** (recomputed on every session save): a set of a cycling exercise gets the cycle with the same group *and* exercise where `started_on <= session date` and the session date is on or before `ended_on` (or the cycle is open); the open cycle wins if several match. No match (e.g. a swapped, non-active variation) or an auxiliary exercise gives `NULL`, so it never affects cycle stats.
- **Same-day rotation:** a session dated on the rotation day that uses the *old* variation is stamped to the just-closed cycle, by design.
- **Cycle PR (★):** a set with `reps >= 8` and a cycle, strictly heavier than every earlier qualifying set in that cycle. The cycle's first session is the baseline and is never highlighted.
- **Trend:** per session in the cycle (date, then id), its best 8-rep weight (empty tick if none).
- **Stall:** with the best first reached at session `i` of `k`, the cycle is stalled when `k - i >= 3` (`STALL_SESSIONS` in `functions/gymlog/_lib/db.js`).
- **Rotate:** closes the open cycle (`ended_on` = today) and opens the next variation (`started_on` = today) in one batch; defaults to the next non-archived variation in `variation_order`, wrapping; rotating to the active variation is rejected.
- **Defaults** (3 × 8 unless copied): cycling rows use the open-cycle 8-rep max, then the best 8-rep ever, then the last weight used, then the starting weight, then 0. Auxiliary rows copy the sets of the last session that logged them, else 3 × 8 at the starting weight. The default template is the one after the last logged session's template (wrapping); the first if nothing is logged.
- **Writes** that touch several rows (save/edit/delete session, rotate) run in `DB.batch`, so they are atomic.
