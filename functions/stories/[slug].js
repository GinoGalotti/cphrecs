import { marked } from 'marked';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap';

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function readingMins(text) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
}

function page404() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Story not found — Gino Galotti</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
:root{--paper:#f5ecdd;--ink:#2a221c;--ink-soft:#5b4f44;--rust:#b14635}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px;
  -webkit-font-smoothing:antialiased;position:relative}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.card{position:relative;z-index:1;text-align:center;max-width:480px}
h1{font-family:"Fraunces",serif;font-weight:900;font-size:clamp(2.2rem,8vw,3.6rem);
  line-height:1;letter-spacing:-.02em;margin-bottom:18px}
p{color:var(--ink-soft);margin-bottom:24px}
a{color:var(--rust);font-weight:600;text-decoration:none;
  border-bottom:1.5px solid transparent;transition:border-color .2s}
a:hover{border-color:var(--rust)}
</style>
</head>
<body>
<div class="card">
  <h1>Story not found.</h1>
  <p>That story doesn't exist or hasn't been published yet.</p>
  <a href="/stories">← Back to all stories</a>
</div>
</body>
</html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function pageStory(story, bodyHtml, mins) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(story.title)} — Gino Galotti</title>
<meta name="description" content="${esc(story.subtitle || story.title)}">
<meta property="og:title" content="${esc(story.title)}">
<meta property="og:description" content="${esc(story.subtitle || story.title)}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(story.title)}">
<meta name="twitter:description" content="${esc(story.subtitle || story.title)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
:root{
  --paper:#f5ecdd;--paper-2:#efe3cf;--ink:#2a221c;--ink-soft:#5b4f44;
  --rust:#b14635;--rust-deep:#8f3326;--line:#cdbca0;--shadow:rgba(42,34,28,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden;line-height:1.65}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
#reading-progress{position:fixed;top:0;left:0;width:0%;height:3px;background:var(--rust);z-index:100;transition:width .1s linear}
.wrap{position:relative;z-index:1;max-width:720px;margin:0 auto;padding:48px 24px 80px}
.back{display:inline-block;color:var(--ink-soft);text-decoration:none;
  font-size:.82rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  border-bottom:1.5px solid transparent;transition:color .2s,border-color .2s;margin-bottom:48px}
.back:hover{color:var(--rust);border-color:var(--rust)}
.story-header{margin-bottom:48px;padding-bottom:32px;border-bottom:2px solid var(--ink)}
.kicker{font-size:.78rem;letter-spacing:.32em;text-transform:uppercase;
  color:var(--rust);font-weight:700;margin-bottom:14px}
.story-header h1{font-family:"Fraunces",serif;font-weight:900;
  font-size:clamp(2.2rem,7vw,3.8rem);line-height:.95;letter-spacing:-.02em;margin-bottom:14px}
.subtitle{font-size:1.15rem;color:var(--ink-soft);font-style:italic;font-family:"Fraunces",serif}
article{font-family:"Fraunces",serif;font-size:clamp(1.05rem,.4vw + 1rem,1.15rem);
  line-height:1.82;color:var(--ink);max-width:65ch}
article h1,article h2,article h3{font-family:"Fraunces",serif;font-weight:600;
  margin:2em 0 .6em;line-height:1.15;letter-spacing:-.01em}
article h1{font-size:1.65rem}
article h2{font-size:1.3rem}
article h3{font-size:1.1rem}
article p{margin-bottom:1.35em}
article p:last-child{margin-bottom:0}
article a{color:var(--rust);text-decoration:underline;text-underline-offset:3px}
article strong{font-weight:700}
article em{font-style:italic}
article blockquote{border-left:3px solid var(--rust);padding:4px 0 4px 20px;
  margin:1.5em 0;color:var(--ink-soft);font-style:italic}
article hr{border:none;border-top:1.5px solid var(--line);margin:2.5em 0}
.story-footer{margin-top:56px;padding-top:24px;border-top:1px solid var(--line);
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.dl-link{font-size:.82rem;font-weight:700;color:var(--ink-soft);text-decoration:none;
  letter-spacing:.04em;text-transform:uppercase;
  border-bottom:1.5px solid transparent;transition:color .2s,border-color .2s}
.dl-link:hover{color:var(--rust);border-color:var(--rust)}
</style>
</head>
<body>
<div id="reading-progress" aria-hidden="true"></div>
<div class="wrap">
  <a class="back" href="/stories">← All stories</a>
  <header class="story-header">
    <p class="kicker">${mins} min read</p>
    <h1>${esc(story.title)}</h1>
    ${story.subtitle ? `<p class="subtitle">${esc(story.subtitle)}</p>` : ''}
  </header>
  <article>${bodyHtml}</article>
  <div class="story-footer">
    <a class="back" style="margin-bottom:0" href="/stories">← All stories</a>
    <a class="dl-link" href="?format=md" download="${esc(story.slug)}.md">Download .md ↓</a>
  </div>
</div>
<script>
(function(){
  var bar = document.getElementById('reading-progress');
  window.addEventListener('scroll', function() {
    var d = document.documentElement;
    var pct = d.scrollTop / (d.scrollHeight - d.clientHeight) * 100;
    bar.style.width = Math.min(100, pct || 0) + '%';
  }, { passive: true });
})();
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = params.slug;
  const url = new URL(request.url);

  if (!env.DB) {
    return new Response('Database not configured', { status: 503 });
  }

  const story = await env.DB
    .prepare('SELECT * FROM stories WHERE slug = ? AND status = ?')
    .bind(slug, 'published')
    .first();

  if (!story) return page404();

  if (url.searchParams.get('format') === 'md') {
    return new Response(story.body_md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.md"`,
      },
    });
  }

  const bodyHtml = marked.parse(story.body_md);
  const mins = readingMins(story.body_md);

  return new Response(pageStory(story, bodyHtml, mins), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
