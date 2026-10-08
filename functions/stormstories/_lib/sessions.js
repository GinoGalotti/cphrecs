// Shared helpers for Bridge Nine session pages. No onRequest export, so this is not a route.
// Content: stormstories/sessions/<slug>.md, served as a static asset and rendered with marked.
// Slugs: session-zero, session-1, session-2, ... (contiguous; the index stops at the first gap).

import { marked } from 'marked';

export const SESSION_SLUG = /^session-(zero|[1-9]\d*)$/;
const MAX_SESSIONS = 200;

export const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const slugFor = n => (n === 0 ? 'session-zero' : `session-${n}`);

// Splits "# Title" and an optional "*subtitle*" line off the top; the rest is the body.
function parse(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const h1 = lines.findIndex(l => /^#\s/.test(l));
  const title = h1 >= 0 ? lines[h1].replace(/^#\s+/, '').trim() : '';
  let rest = h1 >= 0 ? lines.slice(h1 + 1) : lines;
  const next = rest.findIndex(l => l.trim() !== '');
  let sub = '';
  const m = next >= 0 && rest[next].trim().match(/^\*([^*].*)\*$/);
  if (m) {
    sub = m[1].trim();
    rest = rest.slice(next + 1);
  }
  return { title, sub, body: rest.join('\n') };
}

export async function loadSession(env, request, slug) {
  if (!SESSION_SLUG.test(slug)) return null;
  const res = await env.ASSETS.fetch(new URL(`/stormstories/sessions/${slug}.md`, request.url));
  // With no 404.html, Pages answers a missing asset with the root index.html (200), so reject HTML.
  if (!res.ok || (res.headers.get('Content-Type') || '').includes('text/html')) return null;
  return { slug, ...parse(await res.text()) };
}

// session-zero, then session-1, session-2, ... until the first missing file. Newest first.
export async function listSessions(env, request) {
  const found = [];
  for (let n = 0; n <= MAX_SESSIONS; n++) {
    const s = await loadSession(env, request, slugFor(n));
    if (!s) break;
    found.push(s);
  }
  return found.reverse();
}

export const renderBody = md => marked.parse(md);

const FONTS =
  'https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,700;1,400&family=Cormorant+Unicase:wght@600&display=swap';

const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='35%25' cy='30%25' r='75%25'%3E%3Cstop offset='0' stop-color='%23fff'/%3E%3Cstop offset='.08' stop-color='%23fff'/%3E%3Cstop offset='.38' stop-color='%23e39a3b'/%3E%3Cstop offset='1' stop-color='%2350320f'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23g)'/%3E%3C/svg%3E";

// Tokens and type mirror stormstories/zero (see stormstories/zero/DESIGN.md). Dark-only by design.
const CSS = `
:root {
  --storm: #1b2430; --storm-deep: #121a23; --stormlight: #e4eef4; --mist: #9fb0bf; --crem: #a88a5c;
  --garnet: #b4436a;
  --display: "Cormorant Unicase", "Cormorant Garamond", Georgia, serif;
  --body: "Alegreya", Georgia, serif;
  --measure: 40rem;
}
* { box-sizing: border-box; }
html { background: var(--storm); }
body {
  margin: 0; background: var(--storm); color: var(--stormlight);
  font-family: var(--body); font-size: 1.0625rem; line-height: 1.65;
  -webkit-font-smoothing: antialiased; overflow-wrap: break-word;
}
a { color: inherit; text-decoration-color: var(--crem); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--stormlight); }
:focus-visible { outline: 2px solid var(--stormlight); outline-offset: 4px; border-radius: 2px; }
.wrap { max-width: var(--measure); margin: 0 auto; padding: 0 1rem; }

.hero {
  background: var(--storm-deep);
  padding: clamp(3rem, 10vw, 6rem) 0 clamp(2.5rem, 7vw, 4rem);
  border-bottom: 1px solid color-mix(in srgb, var(--crem) 45%, transparent);
}
.hero h1 {
  font-family: var(--display); font-weight: 600;
  font-size: clamp(2.2rem, 8vw, 4rem); line-height: 1.05; letter-spacing: 0.01em; margin: 0 0 0.75rem;
}
.hero .sub { font-style: italic; color: var(--mist); font-size: 1.25rem; margin: 0; }
.crumb { margin: 0 0 1.5rem; font-size: 0.875rem; color: var(--mist); }
.crumb a { text-decoration: none; }
.crumb a:hover { color: var(--stormlight); }

main { padding: 1rem 0 4rem; }
main h2 {
  font-family: var(--display); font-weight: 600;
  font-size: clamp(1.6rem, 5vw, 2.1rem); line-height: 1.1;
  margin: 3rem 0 1.25rem; padding-top: 3rem;
  border-top: 1px solid color-mix(in srgb, var(--crem) 30%, transparent);
}
main > h2:first-child, main hr + h2 { border-top: 0; padding-top: 0; }
main > h2:first-child { padding-top: 1.5rem; }
main h3 { font-family: var(--display); font-weight: 600; font-size: 1.35rem; margin: 2rem 0 0.75rem; }
main p { margin: 0 0 1.25rem; }
main strong { font-weight: 700; }
main ul, main ol { margin: 0 0 1.5rem; padding-left: 1.2rem; }
main li { margin: 0 0 0.75rem; }
main li ul { margin: 0.5rem 0 0; }
main li li { margin: 0.25rem 0; }
main ul li::marker { color: var(--crem); }
main ol { list-style: none; padding-left: 2.6rem; counter-reset: n; }
main ol > li { position: relative; counter-increment: n; }
main ol > li::before {
  content: counter(n); position: absolute; left: -2.6rem; top: -0.15rem; width: 2rem; text-align: right;
  font-family: var(--display); font-weight: 600; font-size: 1.5rem; line-height: 1.3; color: var(--crem);
}
main blockquote {
  margin: 0.5rem 0 1.5rem; padding: 1.1rem 1.25rem;
  background: var(--storm-deep); border-left: 3px solid var(--garnet);
}
main blockquote p:last-child { margin: 0; }
main hr { border: 0; border-top: 1px solid color-mix(in srgb, var(--crem) 30%, transparent); margin: 2.5rem 0; }

ul.sessions { list-style: none; padding: 0; margin: 2rem 0 0; }
ul.sessions li { margin: 0; border-top: 1px solid color-mix(in srgb, var(--crem) 30%, transparent); }
ul.sessions li:last-child { border-bottom: 1px solid color-mix(in srgb, var(--crem) 30%, transparent); }
ul.sessions li::marker { content: none; }
ul.sessions a { display: block; padding: 1.25rem 0; text-decoration: none; }
ul.sessions .t { display: block; font-family: var(--display); font-weight: 600; font-size: 1.4rem; line-height: 1.2; }
ul.sessions .s { display: block; color: var(--mist); font-style: italic; margin-top: 0.25rem; }
ul.sessions a:hover .t { text-decoration: underline; text-decoration-color: var(--crem); text-underline-offset: 4px; }
.empty { color: var(--mist); font-style: italic; }

footer.sign {
  font-style: italic; color: var(--mist); padding: 3rem 0 4rem;
  border-top: 1px solid color-mix(in srgb, var(--crem) 30%, transparent);
}
.sign .home { margin: 0.75rem 0 0; font-style: normal; font-size: 0.875rem; }
`;

export function page({ title, description, crumb = '', heading, sub = '', main, status = 200 }) {
  const html = `<!doctype html>
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
    ${crumb ? `<p class="crumb">${crumb}</p>` : ''}
    <h1>${esc(heading)}</h1>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
  </div>
</header>

<main class="wrap">
${main}
</main>

<footer class="sign">
  <div class="wrap">Journey before destination.
    <p class="home">${crumb ? '<a href="/bridge-nine">All sessions</a> · ' : ''}<a href="/">ginogalotti.com</a></p>
  </div>
</footer>

</body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
