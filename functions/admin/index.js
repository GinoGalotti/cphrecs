const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap';

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ⚠ LOCAL-DEV BYPASS
// isLocalDev() returns true for localhost, skipping the Access JWT check.
// Production requests are blocked by Cloudflare Access before they reach this
// function, so this bypass never fires in prod — but confirm it with:
//   grep -r "isLocalDev" functions/
function isLocalDev(request) {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function requireAccess(request) {
  if (isLocalDev(request)) return null; // ← LOCAL-DEV BYPASS (remove to test auth locally)
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) {
    return new Response('Unauthorized — Cloudflare Access required', { status: 401 });
  }
  return null;
}

function storyRow(s) {
  const date = s.updated_at
    ? String(s.updated_at).replace('T', ' ').slice(0, 16)
    : '—';
  const badge =
    s.status === 'published'
      ? '<span class="badge pub">published</span>'
      : '<span class="badge draft">draft</span>';
  const viewLink =
    s.status === 'published'
      ? `<a class="act view" href="/stories/${esc(s.slug)}" target="_blank" rel="noopener">View ↗</a>`
      : '';
  return `<tr>
  <td class="td-title">${esc(s.title)}</td>
  <td><code class="slug-chip">${esc(s.slug)}</code></td>
  <td>${badge}</td>
  <td class="td-date">${date}</td>
  <td class="td-act">${viewLink}<a class="act edit" href="/admin/${esc(s.slug)}">Edit →</a></td>
</tr>`;
}

function pageIndex(stories) {
  const rows = stories.length
    ? stories.map(storyRow).join('\n')
    : '<tr><td colspan="5" class="empty-cell">No stories yet.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Stories</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
:root{
  --paper:#f5ecdd;--paper-2:#efe3cf;--ink:#2a221c;--ink-soft:#5b4f44;
  --rust:#b14635;--rust-deep:#8f3326;--sage:#56715f;--sage-soft:#dfe6d8;
  --gold:#c2882c;--line:#cdbca0;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.55}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.04;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:40px 24px 80px}
.page-header{margin-bottom:32px;padding-bottom:18px;border-bottom:2px solid var(--ink)}
.kicker{font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--rust);font-weight:700;margin-bottom:6px}
.page-header h1{font-family:"Fraunces",serif;font-weight:600;font-style:italic;font-size:clamp(1.7rem,4vw,2.4rem)}
.stories-table{width:100%;border-collapse:collapse;font-size:.93rem}
.stories-table th{text-align:left;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--ink-soft);font-weight:700;padding:10px 14px;border-bottom:1.5px solid var(--line)}
.stories-table td{padding:14px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.stories-table tr:last-child td{border-bottom:none}
.td-title{font-weight:600}
.slug-chip{font-family:"Courier New",monospace;font-size:.8rem;
  background:var(--paper-2);padding:2px 8px;border-radius:5px;color:var(--ink-soft)}
.badge{font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  padding:3px 10px;border-radius:100px;white-space:nowrap}
.badge.pub{background:var(--sage-soft);color:var(--sage)}
.badge.draft{background:#f0dfc4;color:var(--gold)}
.td-date{font-size:.8rem;color:var(--ink-soft);white-space:nowrap}
.td-act{white-space:nowrap;text-align:right}
.act{font-size:.82rem;font-weight:700;text-decoration:none;
  border-bottom:1.5px solid transparent;transition:color .2s,border-color .2s;margin-left:12px}
.act.edit{color:var(--rust)}
.act.edit:hover{border-color:var(--rust)}
.act.view{color:var(--ink-soft)}
.act.view:hover{color:var(--rust);border-color:var(--rust)}
.empty-cell{text-align:center;color:var(--ink-soft);font-style:italic;padding:36px}
.footer-nav{margin-top:40px;font-size:.84rem;color:var(--ink-soft)}
.footer-nav a{color:var(--ink-soft);font-weight:600;text-decoration:none;
  border-bottom:1.5px solid transparent;transition:color .2s,border-color .2s}
.footer-nav a:hover{color:var(--rust);border-color:var(--rust)}
@media(max-width:600px){
  .td-date,.stories-table th:nth-child(4){display:none}
}
</style>
</head>
<body>
<div class="wrap">
  <header class="page-header">
    <p class="kicker">Admin</p>
    <h1>Stories</h1>
  </header>
  <table class="stories-table">
    <thead>
      <tr>
        <th>Title</th>
        <th>Slug</th>
        <th>Status</th>
        <th>Updated</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer-nav" style="margin-top:40px">
    <a href="/">← ginogalotti.com</a>
    &nbsp;·&nbsp;
    <a href="/stories">Public view ↗</a>
  </p>
</div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { env, request } = context;

  const authError = requireAccess(request);
  if (authError) return authError;

  if (!env.DB) return new Response('Database not configured', { status: 503 });

  const { results } = await env.DB
    .prepare('SELECT slug, title, status, updated_at FROM stories ORDER BY updated_at DESC')
    .all();

  return new Response(pageIndex(results), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
