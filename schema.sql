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
