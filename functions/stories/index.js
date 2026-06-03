const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap';

// Mirrors the four pick-card colours from the Copenhagen guide
const CARD_COLORS = ['var(--rust)', 'var(--sage)', 'var(--ink)', 'var(--gold)'];

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function readingMins(text) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
}

function renderCards(stories) {
  if (!stories.length) {
    return '<p class="empty">No stories published yet — check back soon.</p>';
  }
  return stories
    .map((s, i) => {
      const mins = readingMins(s.body_md);
      const bg = CARD_COLORS[i % CARD_COLORS.length];
      return `<a class="story-card" href="/stories/${esc(s.slug)}" style="background:${bg}">
  <p class="sc-label">${mins} min read</p>
  <p class="sc-title">${esc(s.title)}</p>
  ${s.subtitle ? `<p class="sc-sub">${esc(s.subtitle)}</p>` : ''}
  <span class="sc-go">Read story →</span>
</a>`;
    })
    .join('\n');
}

function pageIndex(stories) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stories — Gino Galotti</title>
<meta name="description" content="Stories by Gino Galotti.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
:root{
  --paper:#f5ecdd;--paper-2:#efe3cf;--ink:#2a221c;--ink-soft:#5b4f44;
  --rust:#b14635;--rust-deep:#8f3326;--sage:#56715f;--gold:#c2882c;
  --line:#cdbca0;--shadow:rgba(42,34,28,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden;line-height:1.65}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:1;max-width:820px;margin:0 auto;padding:0 24px}
header.page-header{padding:64px 0 40px;text-align:center}
.kicker{font-size:.78rem;letter-spacing:.32em;text-transform:uppercase;
  color:var(--rust);font-weight:700;margin-bottom:18px}
header h1{font-family:"Fraunces",serif;font-weight:900;
  font-size:clamp(2.6rem,8vw,4.6rem);line-height:.95;letter-spacing:-.02em}
header h1 em{font-style:italic;font-weight:500;color:var(--rust)}
.flag{display:block;margin:26px auto 0;width:62px;height:2px;
  background:var(--rust);position:relative}
.flag::before{content:"";position:absolute;left:30px;top:-9px;
  width:2px;height:20px;background:var(--rust)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;padding:48px 0 48px}
@media(max-width:560px){.grid{grid-template-columns:1fr}}
.story-card{position:relative;display:flex;flex-direction:column;color:#fff;
  border-radius:16px;padding:24px 22px 22px;text-decoration:none;overflow:hidden;
  box-shadow:0 6px 22px -10px rgba(42,34,28,.35);
  transition:transform .25s ease,box-shadow .25s ease}
.story-card:hover{transform:translateY(-4px);box-shadow:0 14px 30px -12px rgba(42,34,28,.4)}
.sc-label{font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;
  opacity:.8;font-weight:700;margin-bottom:12px}
.sc-title{font-family:"Fraunces",serif;font-weight:600;
  font-size:1.45rem;line-height:1.1;margin-bottom:8px}
.sc-sub{font-size:.92rem;opacity:.85;line-height:1.4;margin-bottom:8px;
  font-style:italic;font-family:"Fraunces",serif}
.sc-go{margin-top:auto;padding-top:16px;font-size:.82rem;font-weight:700;
  opacity:.95;display:inline-flex;align-items:center;gap:6px}
.home-link{display:block;text-align:center;padding:0 0 56px;
  color:var(--ink-soft);font-size:.84rem;text-decoration:none;font-weight:600;
  border-bottom:1.5px solid transparent;transition:color .2s}
.home-link:hover{color:var(--rust)}
.empty{text-align:center;color:var(--ink-soft);padding:48px 0;
  font-style:italic;font-family:"Fraunces",serif}
</style>
</head>
<body>
<div class="wrap">
  <header class="page-header">
    <p class="kicker">A few things I wanted to write</p>
    <h1>Stories by <em>Gino</em></h1>
    <span class="flag" aria-hidden="true"></span>
  </header>
  <div class="grid">
    ${renderCards(stories)}
  </div>
  <a class="home-link" href="/">← Back to ginogalotti.com</a>
</div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.DB) {
    return new Response('Database not configured', { status: 503 });
  }

  const { results } = await env.DB
    .prepare(
      'SELECT slug, title, subtitle, body_md FROM stories WHERE status = ? ORDER BY created_at DESC'
    )
    .bind('published')
    .all();

  return new Response(pageIndex(results), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
