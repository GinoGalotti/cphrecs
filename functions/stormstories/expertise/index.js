// /stormstories/expertise — expertise inspiration list, rendered from stormstories/expertise/expertises.md.
// Each "##" section of the markdown lands in one of four tabs (see TABS). The page works without JS
// (every tab is stacked); the inline script turns it into tabs with #hash deep links.

import { marked } from 'marked';
import { esc } from '../_lib/sessions.js';

const MD_PATH = '/stormstories/expertise/expertises.md';

// Tab id, label, and the "##" headings it collects, in order. "How it works" sits above the tabs.
const TABS = [
  { id: 'official', label: 'Official', lede: 'Straight from the rulebooks: the cultures everyone starts with, the weapon and armour expert traits, and the rare specialist knowledge.', sections: ['Cultural', 'Weapons', 'Armour', 'Specialist'] },
  { id: 'origin', label: 'Per Origin', lede: '', sections: ['Origin'] },
  { id: 'paths', label: 'Per Heroic Path', lede: 'Ideas grouped by heroic path. Nothing stops a Warrior from taking Cartography; these are just where each path tends to look first.', sections: ['Agent', 'Envoy', 'Hunter', 'Leader', 'Scholar', 'Warrior'], chips: true },
  { id: 'party', label: 'Party Suggestions', lede: '', sections: ['Our party'] },
];
const INTRO = 'How it works';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Splits front matter, "# Title", the "*subtitle*" line, the lead paragraphs and the "##" sections.
function parse(md) {
  md = md.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '');
  const [head, ...parts] = md.split(/^## /m);
  const title = (head.match(/^# (.+)$/m) || [, 'Expertises'])[1].trim();
  const subM = head.match(/^\*([^*].*)\*$/m);
  const lead = head.replace(/^# .+$/m, '').replace(subM ? subM[0] : '', '').trim();
  const sections = new Map();
  for (const p of parts) {
    const nl = p.indexOf('\n');
    sections.set(p.slice(0, nl).trim(), p.slice(nl + 1).trim());
  }
  return { title, sub: subM ? subM[1].trim() : '', lead, sections };
}

// Tables get data-label on each cell so they can stack into cards on phones.
function renderMd(md) {
  return marked
    .lexer(md)
    .map(t => {
      if (t.type !== 'table') return marked.parser([t]);
      const labels = t.header.map(h => h.text.replace(/[*_`]|…$/g, ''));
      const head = t.header.map(h => `<th scope="col">${marked.parseInline(h.text)}</th>`).join('');
      const rows = t.rows
        .map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(labels[i])}">${marked.parseInline(c.text)}</td>`).join('')}</tr>`)
        .join('\n');
      return `<div class="tbl"><table class="cols-${labels.length}"><thead><tr>${head}</tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
    })
    .join('');
}

// "Our party": each "###" hero (a block with a "**Has:**" line) becomes a card; other "###"
// blocks, such as "Gaps the party could fill", follow the cards as plain sections.
function renderParty(md) {
  const [intro, ...blocks] = md.split(/^### /m);
  const cards = [];
  const rest = [];
  for (const b of blocks) {
    const nl = b.indexOf('\n');
    const name = b.slice(0, nl).trim();
    const body = renderMd(b.slice(nl + 1));
    if (/^\*\*Has:\*\*/m.test(b)) cards.push(`<article class="card" id="hero-${slug(name)}"><h3>${esc(name)}</h3>${body}</article>`);
    else rest.push(`<h3>${esc(name)}</h3>${body}`);
  }
  return `${renderMd(intro)}<div class="cards">${cards.join('\n')}</div>${rest.join('\n')}`;
}

function renderTab(tab, sections) {
  const parts = tab.sections.filter(name => sections.has(name));
  const chips = tab.chips
    ? `<nav class="chips" aria-label="Heroic paths"><a class="chip" href="#${tab.id}" aria-current="true" data-path="">All</a>${parts
        .map(n => `<a class="chip" href="#${tab.id}/${slug(n)}" data-path="${slug(n)}">${esc(n)}</a>`)
        .join('')}</nav>`
    : '';
  const body = parts
    .map(name => {
      const md = sections.get(name);
      const inner = name === 'Our party' ? renderParty(md) : renderMd(md);
      const showHeading = parts.length > 1;
      return `<section class="group" id="${tab.id}-${slug(name)}" data-path="${slug(name)}">${showHeading ? `<h2>${esc(name)}</h2>` : ''}${inner}</section>`;
    })
    .join('\n');
  return `<div class="panel" id="${tab.id}" role="tabpanel" aria-labelledby="tab-${tab.id}">
<h2 class="panel-title">${esc(tab.label)}</h2>
${tab.lede ? `<p class="lede">${esc(tab.lede)}</p>` : ''}
${chips}
${body}
</div>`;
}

export async function onRequestGet({ env, request }) {
  const res = await env.ASSETS.fetch(new URL(MD_PATH, request.url));
  // With no 404.html, Pages answers a missing asset with the root index.html (200), so reject HTML.
  if (!res.ok || (res.headers.get('Content-Type') || '').includes('text/html')) {
    return new Response('Expertise list not found', { status: 500 });
  }
  const { title, sub, lead, sections } = parse(await res.text());

  const tabs = TABS.map(
    (t, i) =>
      `<a class="tab" role="tab" id="tab-${t.id}" href="#${t.id}" aria-controls="${t.id}" aria-selected="${i === 0}">${esc(t.label)}</a>`
  ).join('');
  const intro = sections.has(INTRO)
    ? `<details class="how"><summary>${esc(INTRO)}</summary>${renderMd(sections.get(INTRO))}</details>`
    : '';

  return new Response(html({ title, sub, lead: renderMd(lead), intro, tabs, panels: TABS.map(t => renderTab(t, sections)).join('\n') }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,700;1,400&family=Alegreya+Sans:wght@400;500&family=Cormorant+Unicase:wght@600&display=swap';

// Emerald sphere: Palah / knowledge, as in stormstories/zero/DESIGN.md.
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='35%25' cy='30%25' r='75%25'%3E%3Cstop offset='0' stop-color='%23fff'/%3E%3Cstop offset='.08' stop-color='%23fff'/%3E%3Cstop offset='.38' stop-color='%233fbf87'/%3E%3Cstop offset='1' stop-color='%23123b29'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23g)'/%3E%3C/svg%3E";

// Tokens and type mirror stormstories/zero (see stormstories/zero/DESIGN.md). Dark-only by design.
const CSS = `
:root {
  --storm: #1b2430; --storm-deep: #121a23; --surface: #222d3a; --line: #36434f;
  --stormlight: #e4eef4; --mist: #9fb0bf; --crem: #a88a5c; --emerald: #3fbf87;
  --rule: color-mix(in srgb, var(--crem) 35%, transparent);
  --display: "Cormorant Unicase", "Cormorant Garamond", Georgia, serif;
  --body: "Alegreya", Georgia, serif;
  --ui: "Alegreya Sans", "Segoe UI", system-ui, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { background: var(--storm); }
body {
  margin: 0; background: var(--storm); color: var(--stormlight);
  font-family: var(--body); font-size: 1.0625rem; line-height: 1.6;
  -webkit-font-smoothing: antialiased; overflow-wrap: break-word;
}
a { color: inherit; text-decoration-color: var(--crem); text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--stormlight); outline-offset: 3px; border-radius: 2px; }
.wrap { max-width: 64rem; margin: 0 auto; padding: 0 1rem; }
.prose { max-width: 42rem; }

.hero { background: var(--storm-deep); padding: clamp(2.5rem, 8vw, 4.5rem) 0 2rem; border-bottom: 1px solid var(--rule); }
.crumb { margin: 0 0 1.25rem; font-family: var(--ui); font-size: 0.875rem; color: var(--mist); }
.crumb a { text-decoration: none; }
.crumb a:hover { color: var(--stormlight); }
.hero h1 { font-family: var(--display); font-weight: 600; font-size: clamp(2.4rem, 8vw, 4rem); line-height: 1.05; margin: 0 0 0.5rem; display: flex; align-items: center; gap: 0.9rem; }
.sphere { width: 0.55em; aspect-ratio: 1; border-radius: 50%; flex: none;
  background: radial-gradient(circle at 35% 30%, #ffffffcc 0 8%, var(--emerald) 38%, color-mix(in srgb, var(--emerald) 35%, #000) 100%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--emerald) 55%, transparent); }
.hero .sub { font-style: italic; color: var(--mist); font-size: 1.2rem; margin: 0 0 1.25rem; }
.hero p { margin: 0 0 1rem; }

.how { margin: 0.5rem 0 0; border: 1px solid var(--line); border-radius: 6px; background: var(--storm); }
.how > summary { cursor: pointer; padding: 0.7rem 1rem; font-family: var(--display); font-weight: 600; font-size: 1.25rem; list-style-position: inside; }
.how > summary::marker { color: var(--crem); }
.how[open] > summary { border-bottom: 1px solid var(--line); }
.how > :not(summary) { margin-left: 1rem; margin-right: 1rem; }
.how > p:last-child { margin-bottom: 1rem; }

.nav { position: sticky; top: 0; z-index: 10; background: var(--storm); border-bottom: 1px solid var(--rule); }
.tabs { display: flex; gap: 0.25rem; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { font-family: var(--ui); font-weight: 500; font-size: 1rem; color: var(--mist); text-decoration: none; padding: 0.75rem 0.9rem 0.65rem; border-bottom: 2px solid transparent; white-space: nowrap; }
.tab:hover { color: var(--stormlight); }
.tab[aria-selected="true"] { color: var(--stormlight); border-bottom-color: var(--emerald); }

main { padding: 1.5rem 1rem 4rem; }
.panel { scroll-margin-top: 4rem; }
.js .panel[hidden] { display: none; }
.panel + .panel { margin-top: 3rem; }
.js .panel + .panel { margin-top: 0; }
.panel-title { font-family: var(--display); font-weight: 600; font-size: clamp(1.9rem, 5vw, 2.5rem); line-height: 1.1; margin: 0.5rem 0 0.5rem; }
.lede { color: var(--mist); font-style: italic; max-width: 42rem; margin: 0 0 1.5rem; }
.group h2 { font-family: var(--display); font-weight: 600; font-size: 1.6rem; line-height: 1.15; margin: 2.25rem 0 0.75rem; padding-top: 1.5rem; border-top: 1px solid var(--rule); }
.group:first-of-type h2, .chips + .group h2 { border-top: 0; padding-top: 0; }
.group > p, .group > ul { max-width: 42rem; }
.group h3, .card h3 { font-family: var(--display); font-weight: 600; font-size: 1.3rem; margin: 1.5rem 0 0.5rem; }
p { margin: 0 0 1rem; }
ul { padding-left: 1.2rem; margin: 0 0 1.25rem; }
li { margin: 0 0 0.4rem; }
li::marker { color: var(--crem); }
em { color: var(--mist); }
strong em, em strong { color: inherit; }

.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1.25rem; }
.chip { font-family: var(--ui); font-size: 0.95rem; text-decoration: none; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 0.25rem 0.85rem; }
.chip:hover { border-color: var(--crem); }
.chip[aria-current="true"] { background: var(--emerald); border-color: var(--emerald); color: var(--storm-deep); }
.js .group[hidden] { display: none; }

.tbl { margin: 0 0 1.5rem; }
table { width: 100%; border-collapse: collapse; font-size: 1rem; }
th { font-family: var(--ui); font-weight: 500; font-size: 0.875rem; color: var(--mist); text-align: left; padding: 0.4rem 0.75rem 0.5rem; border-bottom: 1px solid var(--crem); }
td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--line); vertical-align: top; }
td:first-child { white-space: nowrap; }
td:first-child strong { font-weight: 700; }
td:last-child { color: var(--mist); }
.cols-3 td:nth-child(2), .cols-2 td:last-child { color: var(--stormlight); }
tbody tr:hover { background: color-mix(in srgb, var(--surface) 60%, transparent); }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 28rem), 1fr)); gap: 1rem; margin: 1rem 0 2rem; }
.card { background: var(--storm-deep); border: 1px solid var(--line); border-radius: 6px; padding: 1rem 1.1rem 0.25rem; }
.card h3 { margin-top: 0; }
.card td:first-child { white-space: normal; }

/* Phones: each table row becomes a small labelled card. */
@media (max-width: 40rem) {
  table, tbody, tr, td { display: block; }
  thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  tr { padding: 0.6rem 0; border-bottom: 1px solid var(--line); }
  td { border: 0; padding: 0.1rem 0; white-space: normal !important; }
  td:first-child { font-size: 1.05rem; }
  td:not(:first-child)::before { content: attr(data-label) ": "; font-family: var(--ui); font-size: 0.85rem; color: var(--crem); }
  tbody tr:hover { background: none; }
  .tab { padding: 0.75rem 0.45rem 0.65rem; font-size: 0.95rem; }
}

footer.sign { font-style: italic; color: var(--mist); padding: 2.5rem 0 3.5rem; border-top: 1px solid var(--rule); }
.sign .home { margin: 0.75rem 0 0; font-style: normal; font-family: var(--ui); font-size: 0.875rem; }
`;

// Tabs: show one panel at a time; #paths/<path> also narrows the heroic-path chips.
const SCRIPT = `
(() => {
  document.documentElement.classList.add('js');
  const tabs = [...document.querySelectorAll('.tab')];
  const panels = [...document.querySelectorAll('.panel')];
  function show(hash, scroll) {
    let [id, sub = ''] = hash.replace(/^#/, '').split('/');
    if (!panels.some(p => p.id === id)) {
      const inner = id && document.getElementById(id);
      const owner = inner && inner.closest('.panel');
      id = owner ? owner.id : panels[0].id;
    }
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.getAttribute('aria-controls') === id)));
    panels.forEach(p => (p.hidden = p.id !== id));
    const panel = document.getElementById(id);
    const chips = panel.querySelectorAll('.chip');
    if (chips.length) {
      chips.forEach(c => c.setAttribute('aria-current', String(c.dataset.path === sub)));
      panel.querySelectorAll('.group').forEach(g => (g.hidden = !!sub && g.dataset.path !== sub));
    }
    if (scroll) {
      const nav = document.querySelector('.nav');
      if (nav.getBoundingClientRect().top <= 0) window.scrollTo({ top: nav.offsetTop });
    }
  }
  addEventListener('hashchange', () => show(location.hash, true));
  document.addEventListener('click', e => {
    const a = e.target.closest('a.tab, a.chip');
    if (!a) return;
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    show(a.getAttribute('href'), true);
  });
  show(location.hash, false);
})();
`;

function html({ title, sub, lead, intro, tabs, panels }) {
  const description = sub || 'Expertise ideas for Stormlight characters.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#121a23">
<link rel="icon" href="${ICON}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ginogalotti.com">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <p class="crumb"><a href="/bridge-nine">← Bridge Nine</a></p>
    <h1><span class="sphere" aria-hidden="true"></span>${esc(title)}</h1>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    <div class="prose">${lead}${intro}</div>
  </div>
</header>

<nav class="nav" aria-label="Expertise lists"><div class="wrap tabs" role="tablist">${tabs}</div></nav>

<main class="wrap">
${panels}
</main>

<footer class="sign">
  <div class="wrap">Journey before destination.
    <p class="home"><a href="/bridge-nine">All sessions</a> · <a href="/">ginogalotti.com</a></p>
  </div>
</footer>

<script>${SCRIPT}</script>
</body>
</html>`;
}
