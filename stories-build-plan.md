# Stories on ginogalotti.com — build plan & Claude Code prompts

Goal: read stories at `ginogalotti.com/stories/<slug>` (e.g. `/stories/bluesky`), edit the
markdown of any story from your phone with instant saves, and (stretch) add new stories from
the browser. Built as an extension of the existing `ginogalotti` Cloudflare Pages project —
no new project, no separate Worker.

---

## Architecture (decided)

- **Storage:** Cloudflare **D1** (SQLite). Story markdown lives in a row, so edits save instantly
  with no rebuild. (Git-as-CMS was the alternative but every save = a 30–60s deploy — rejected.)
- **Serving:** **Pages Functions** in the same repo. A `functions/` folder gives you
  `ginogalotti.com/stories/*` and `/admin/*` alongside the existing static pages.
- **Reader (public):** server-rendered HTML so links are shareable (real `<title>`/OG tags, no
  loading flash). Slug comes from the filename: `bluesky.md` → `/stories/bluesky`.
- **Editor (private):** a textarea + live preview, gated behind **Cloudflare Access** scoped to
  your email — same mechanism PORTAL uses. Reads are public; writes live under `/admin/*` so one
  Access policy covers the editor UI and the save endpoint.
- **Design:** reuse the warm Fraunces + Hanken Grotesk system and color vars from the Copenhagen
  page so the whole site feels like one thing.

### Schema
```sql
CREATE TABLE stories (
  slug        TEXT PRIMARY KEY,                 -- = filename, e.g. 'bluesky'
  title       TEXT NOT NULL,
  subtitle    TEXT,
  body_md     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',    -- 'draft' (hidden) | 'published'
  cover_image TEXT,                             -- future: inspiration pic / hero
  meta        TEXT,                             -- future: JSON blob (music url, etc.)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```
`cover_image` and `meta` are reserved now so the future music/pics ideas don't need a migration —
but D1 `ALTER TABLE ADD COLUMN` is trivial anyway, so don't over-think it.

### Target repo additions
```
functions/
  stories/
    index.js          # GET  /stories         → published list (HTML)
    [slug].js         # GET  /stories/:slug    → reader (HTML, SSR markdown)
  admin/
    index.js          # GET  /admin           → dashboard w/ edit links (Access)
    [slug].js         # GET  /admin/:slug      → editor page (Access)
    api/
      stories/
        [slug].js     # PUT/POST save (Access) ; POST new = stretch
schema.sql
wrangler.jsonc        # D1 binding for local dev
seed/                 # your example stories: bluesky.md, etc.
package.json          # marked dependency
```

### Model tiers (Claude Code)
- Phase 0 schema + Access wiring → worth one **Opus** pass (gets the security boundary right).
- Phases 1–3 → **Sonnet** is the daily-dev sweet spot.

---

## Before you start
1. Put 2–3 example stories in `seed/` as `.md`, filename = desired slug (`bluesky.md`).
   First `# Heading` becomes the title; everything after is the body. You can fix titles in the
   editor later, so don't fuss over formatting.
2. Run these prompts **in order, in one Claude Code session** inside the `ginogalotti` repo.
   Test each phase locally with `wrangler pages dev` before moving on.

---

## PROMPT 0 — D1, schema, seed

```
This is the ginogalotti Cloudflare Pages repo (static site: index.html + cphrecs/). I'm adding a
"stories" feature backed by Cloudflare D1, served via Pages Functions in this same project.

Before writing anything: read index.html and cphrecs/index.html to learn the existing design
system (Fraunces + Hanken Grotesk, the CSS custom-property color palette, the paper/grain look),
and read the frontend-design skill — follow it for any UI you build later.

For this first step, set up data only — no UI yet:
1. Create schema.sql with this table (use it verbatim):
   [paste the `stories` CREATE TABLE from the plan]
2. Create wrangler.jsonc configured for Pages with a D1 binding named DB to a database called
   "ginogalotti-stories".
3. Create package.json and add "marked" as a dependency (we'll render markdown server-side later).
4. Write a small Node seed script (scripts/seed.mjs) that reads every .md file in seed/, derives
   slug from the filename, uses the first level-1 heading as the title and the remainder as
   body_md, sets status='published', and emits SQL INSERTs (idempotent: INSERT OR REPLACE) to
   seed.sql.
5. Give me the exact wrangler commands to: create the D1 database, apply schema.sql to both local
   and remote, run the seed script, and apply seed.sql locally and remote. Don't run them
   yourself — I'll run them and paste any output.

Keep it minimal and don't touch the existing pages.
```

After it finishes, run the commands it gives you. Paste errors back if any.

---

## PROMPT 1 — Reader (public)

```
Now build the public reading experience as Pages Functions. No auth on these — they're public.

1. functions/stories/[slug].js — GET handler:
   - Look up the story by slug in D1 (context.env.DB) where status='published'.
   - 404 (a styled page matching the site) if missing or draft.
   - Render body_md to HTML with marked, server-side.
   - Return a full HTML page using the site's design system (Fraunces display, Hanken body, the
     paper/grain palette from index.html). Reading-optimized: ~65ch measure, generous line-height,
     serif body for long-form, the title + subtitle up top, and a subtle reading-progress bar.
     Include proper <title> and Open Graph / Twitter meta tags (title, subtitle as description) so
     shared links look good. Show an estimated reading time computed from word count.
   - Add a small "Download .md" link that returns the raw body_md (this is our lightweight backup,
     since D1 isn't version-controlled).

2. functions/stories/index.js — GET /stories: a cute index page listing published stories
   (title, subtitle, reading time), each linking to /stories/<slug>. Match the design system;
   reuse the card aesthetic from the Copenhagen "desert-island four" if it fits.

Test with `wrangler pages dev` and tell me the local URL. Show me the diff/files before I deploy.
Keep all markdown rendering server-side — no client-side md library on the reader.
```

---

## PROMPT 2 — Editor (private, behind Access)

```
Now the editor. Everything under /admin must be private. I'll configure Cloudflare Access in the
dashboard to gate /admin/* to my email; in the Functions, also defensively reject any request to
/admin/* that lacks the Cf-Access-Jwt-Assertion header (belt and suspenders).

1. functions/admin/index.js — GET /admin: dashboard listing ALL stories (including drafts) with
   status badges and an "Edit" link to /admin/<slug>. Plain, fast, matches the design system.

2. functions/admin/[slug].js — GET /admin/<slug>: the editor page. Load the current row from D1
   and inject body_md into a large <textarea> (textareas are the most reliable thing on mobile —
   no fancy editor widget). Include:
   - editable fields for title, subtitle, and status (draft/published)
   - a live-preview toggle that renders the textarea markdown client-side (import marked from a
     CDN/esm for preview only) next to or under the textarea
   - a Save button that PUTs JSON to /admin/api/stories/<slug>
   - autosave-to-localStorage of the textarea as a crash guard, restored on load
   - clear "Saved ✓ / Saving… / Error" status feedback

3. functions/admin/api/stories/[slug].js — PUT handler: validate, update title/subtitle/body_md/
   status and set updated_at=now in D1, return JSON. Reject non-PUT and missing-Access-header.

Test with `wrangler pages dev`. Note: Access headers won't be present in local dev, so add an
env-guarded bypass for local only (e.g. if the request is on localhost) and tell me exactly where
that bypass is so I can confirm it's local-only. Show me the files before I deploy.
```

---

## PROMPT 3 — Stretch: add a new story from the browser

```
Add new-story creation, reusing the existing editor.

1. functions/admin/api/stories/[slug].js — add a POST handler that inserts a new row (slug from
   the URL, status defaults to draft). Error clearly if the slug already exists.
2. functions/admin/index.js — add a "New story" control: prompt for a slug (validate it's
   url-safe: lowercase, hyphens, no spaces) and a title, create the draft via POST, then redirect
   to /admin/<slug> to start writing.
3. Optional: on the new-story form, allow pasting raw markdown or choosing a .md file to prefill
   the body.

Keep it consistent with the editor. Test locally, show me the diff.
```

---

## Manual steps you do in the Cloudflare dashboard (not Claude Code)

These can't be done from the repo — do them once after Phase 2 is deployed:

1. **Deploy:** commit + push; Pages auto-builds. Confirm `/stories` and a seeded story load on the
   live site (or the preview URL) first.
2. **Cloudflare Access** → Zero Trust → Access → Applications → Add application → Self-hosted:
   - Application domain: `ginogalotti.com`, path `/admin` (covers `/admin/*`).
   - Policy: Allow, rule = Emails → your address. Use your existing PORTAL identity provider
     (Google SSO) if you set one up.
3. Visit `ginogalotti.com/admin` — you should hit the Access login, then the dashboard. An
   incognito window without your login should be blocked.

---

## Notes & guardrails

- **Backup:** D1 has no version history like git. The per-story "Download .md" button is your
  cheap insurance, and your Google Docs stay the source of truth. (If you ever want auto-backup,
  the Save handler can also commit the .md to the repo via the GitHub API — skip for now.)
- **Sanitization:** you're the only author, so XSS risk is low; marked alone is fine for v1. If
  you ever open writing to others, add a sanitizer before shipping that.
- **Drafts:** `status='draft'` hides a story from the index and returns 404 on the reader, so you
  can write in the open without it being linkable. Flip to `published` when ready.
- **Future hooks (don't build yet, but the shape's ready):**
  - *Background music loop:* store a track URL in `meta` JSON; the reader adds a small
    play/pause toggle (autoplay is blocked by browsers, so it must be user-triggered). Host audio
    in R2, not Pages — remember the 25 MB per-file Pages limit.
  - *Inspiration pics:* `cover_image` for a hero; for inline images, store them in R2 and
    reference by URL in the markdown.
```
