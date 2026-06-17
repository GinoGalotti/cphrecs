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
