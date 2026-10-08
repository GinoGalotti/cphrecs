# Session Zero Primer — Stormlight Design Spec

Design direction for the Stonewalkers session zero page. Content lives in `session-zero.md`, and a working scaffold is in `session-zero.html`. This spec covers the Stormlight-specific identity only. Fold layout chrome, header and footer into the existing site conventions.

## Concept

**Spheres in the dark.** On Roshar, light is money, and it comes from gemstones infused by the highstorm. The page reads like a quiet room lit by spheres.

- Each section of the primer is keyed to one of the ten Essences, shown as its gemstone.
- The section markers are spheres, not numbers.
- The hero holds the seven spheres in a row as the table of contents. On load they are *dun* (unlit), then they infuse one by one. That is the page's single motion moment.

## Tokens

### Base

| Token | Hex | Role |
|---|---|---|
| `--storm` | `#1b2430` | Page background: storm-slate, not black |
| `--storm-deep` | `#121a23` | Hero band, contract panel |
| `--stormlight` | `#e4eef4` | Body text: pale, slightly blue, like held Stormlight |
| `--mist` | `#9fb0bf` | Secondary text, scale descriptions |
| `--crem` | `#a88a5c` | Rules, scale track, question numbers: the mud that coats Roshar |

### Gems (one per section)

The pairings are deliberate nods to each section's theme. The gem colours are reserved for spheres and their glow. Never use them for body text or backgrounds.

| Section | Essence / Herald / Order | Gem | Hex | Why |
|---|---|---|---|---|
| I. The World | Palah / Pailiah / Truthwatchers | Emerald | `#3fbf87` | Knowledge, learning |
| II. The Tone | Chach / Chana / Dustbringers | Ruby | `#ef4f5f` | Bravery, danger |
| III. Who You Are | Kokh / Kalak / Willshapers | Amethyst | `#a77ee8` | Self-making, creation |
| IV. The Cracks | Shash / Shalash / Lightweavers | Garnet | `#b4436a` | Painful truths, art from brokenness |
| V. Someone Else | Vev / Vedel / Edgedancers | Diamond | `#dbeeff` | Care, remembering those overlooked |
| VI. Each Other | Ishi / Ishar / Bondsmiths | Heliodor | `#e8c547` | Bonds, connection |
| VII. Bring a Moment | Tanat / Talenel / Stonewards | Topaz | `#e39a3b` | Dependable. Also a nod to the campaign itself |

Ruby and garnet sit close together. Keep garnet pushed toward wine/pink so they stay distinct.

### Type

| Role | Face | Notes |
|---|---|---|
| Display (title, section heads, question numbers) | **Cormorant Unicase** 600 | Unicase reads as carved inscription or glyph-script without falling into "fantasy Cinzel". Use it only at display sizes. |
| Body | **Alegreya** 400 / 400 italic / 700 | Calligraphic humanist serif; holds up on phones. Line-height 1.65. |

- Scale: 1.250 (major third), with a 1.0625rem body.
- Title: `clamp(2.6rem, 9vw, 4.75rem)`.
- No all-caps labels, no eyebrow text above headings, and no single-word accent colouring in headlines.

### Sphere component

```
lit:  radial-gradient(circle at 35% 30%, #ffffffcc 0 8%, var(--gem) 38%, color-mix(var(--gem) 35%, #000) 100%)
      + box-shadow: 0 0 18px color-mix(var(--gem) 55%, transparent)
dun:  same shape, filter: grayscale(.85) brightness(.45), no glow
```

- Hero spheres: 30px.
- Section-header spheres: 34px.
- **Dun sphere** (`.sphere.dun`): the unlit state, permanently. Used only for the starting-hooks appendix, which is reference material from the adventure, not one of the seven question sections. It is not in the hero contents list; Q7 links to it.

## Layout

```
┌─────────────────────────────────┐
│ HERO (storm-deep band)          │
│  Before the First Storm         │  ← Unicase, left-aligned
│  Session zero primer…           │
│  intro paragraph                │
│  ● ● ● ● ● ● ●                  │  ← sphere TOC, infuse on load
│  World Tone You Cracks …        │
├─────────────────────────────────┤
│ ●  The World                    │  ← sphere + h2, left-aligned
│  1  How close to canon?         │  ← crem Unicase numerals, one continuous count 1–15
│     ┃ 1 Canon is sacred…        │  ← scale: vertical track on mobile,
│     ┃ 3 Canon is the spine…     │     horizontal 3-column ≥ 640px
│     ┃ 5 Our Roshar…             │
│  2  What do you love…           │
├─────────────────────────────────┤
│ ●  The Cracks                   │
│    "On Roshar, power enters…"   │  ← epigraph, italic, mist; echoes
│  9 …                            │     the books' chapter epigraphs
│  ┃ The table contract…          │  ← garnet left rule, storm-deep panel
├─────────────────────────────────┤
│ ○  Why You Walk with Taszo      │  ← dun sphere; appendix after section VII
│  Agent or Hunter                │  ← Unicase h3
│  hook paragraph                 │
│  italic mist questions          │
│  Suggested goal: …              │  ← label in crem bold
│  ─────────                      │  ← faint crem rule between hooks
└─────────────────────────────────┘
```

- Everything is left-aligned in a single column with a max width of 40rem (~65ch). The page is read on phones first.
- Sections are separated by generous space plus one thin crem rule. Avoid cards and drop shadows.
- The book presents the hooks as a 4-column table. Don't reproduce it as a table: it's unreadable on phones. Each hook is a stacked block.
- Question numbers count continuously 1–15 across sections, because players will refer to them at the table ("about 12…").

## Principles

1. **Light is the only ornament.** Spheres are the one decorative device. No glyph watermarks, parchment textures or gradient washes.
2. **Gems mean something.** Every colour on the page maps to a section, and a section's sphere colour shows up nowhere else.
3. **One motion moment.** Hero spheres infuse in sequence on load, about 120ms apart. Under `prefers-reduced-motion` they render lit immediately. Nothing else animates.
4. **Readable at the table.** Phone-first, ≥ 4.5:1 contrast for all text, visible focus rings in `--stormlight`.

## Integration notes for Claude Code

- `session-zero.md` is the source of truth for wording. If the site renders pages via `marked`, the scales, epigraph and contract need either a small custom extension or hand-written HTML. The scaffold shows the target markup.
- Fonts come from Google Fonts: `Cormorant Unicase:wght@600` and `Alegreya:ital,wght@0,400;0,700;1,400`.
- Pick the route to match the site; something like `/stonewalkers/session-zero` fits.
- The page is dark-only by design. Don't flip it under a light-mode preference, because the spheres need the dark.
