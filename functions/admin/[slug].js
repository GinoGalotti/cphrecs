const FONTS =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap';

const esc = s =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ⚠ LOCAL-DEV BYPASS — same pattern as admin/index.js and api handler.
// isLocalDev() skips the Access JWT check on localhost only.
function isLocalDev(request) {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function requireAccess(request) {
  if (isLocalDev(request)) return null; // ← LOCAL-DEV BYPASS
  if (!request.headers.get('Cf-Access-Jwt-Assertion')) {
    return new Response('Unauthorized — Cloudflare Access required', { status: 401 });
  }
  return null;
}

function pageEditor(story) {
  // Story data injected as JSON to avoid textarea/attribute escaping edge cases.
  const initialJson = JSON.stringify({
    slug:     story.slug,
    title:    story.title,
    subtitle: story.subtitle ?? '',
    status:   story.status,
    body_md:  story.body_md,
  });

  const pubChecked  = story.status === 'published' ? 'selected' : '';
  const draftChecked = story.status === 'draft'    ? 'selected' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Edit: ${esc(story.slug)} — Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
:root{
  --paper:#f5ecdd;--paper-2:#efe3cf;--ink:#2a221c;--ink-soft:#5b4f44;
  --rust:#b14635;--rust-deep:#8f3326;--sage:#56715f;--sage-soft:#dfe6d8;
  --gold:#c2882c;--line:#cdbca0;--shadow:rgba(42,34,28,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Hanken Grotesk",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.55}
body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.04;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:32px 24px 80px}

/* header */
.page-header{margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid var(--ink);
  display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px}
.kicker{font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--rust);font-weight:700;margin-bottom:4px}
.page-header h1{font-family:"Fraunces",serif;font-weight:600;font-style:italic;font-size:clamp(1.4rem,3vw,2rem)}
.header-links{display:flex;gap:14px;font-size:.82rem;font-weight:700;flex-shrink:0}
.header-links a{color:var(--ink-soft);text-decoration:none;
  border-bottom:1.5px solid transparent;transition:color .2s,border-color .2s}
.header-links a:hover{color:var(--rust);border-color:var(--rust)}

/* restore banner */
.restore-banner{background:#f0dfc4;border:1.5px solid var(--gold);border-radius:10px;
  padding:12px 16px;margin-bottom:20px;font-size:.88rem;display:flex;
  align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.restore-banner button{font-size:.82rem;font-weight:700;border:none;border-radius:6px;
  padding:5px 12px;cursor:pointer;font-family:inherit}
.btn-restore{background:var(--gold);color:#fff}
.btn-discard{background:transparent;color:var(--ink-soft);text-decoration:underline}

/* meta fields */
.meta-row{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;margin-bottom:18px;align-items:end}
@media(max-width:640px){.meta-row{grid-template-columns:1fr}}
label{display:block;font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-soft);margin-bottom:5px}
input[type=text],select{width:100%;padding:10px 12px;font-size:1rem;font-family:inherit;
  background:var(--paper-2);border:1.5px solid var(--line);border-radius:10px;color:var(--ink);
  transition:border-color .2s}
input[type=text]:focus,select:focus{outline:none;border-color:var(--rust)}

/* toolbar */
.toolbar{display:flex;align-items:center;justify-content:space-between;
  margin-bottom:10px;flex-wrap:wrap;gap:10px}
.toolbar-left{display:flex;align-items:center;gap:10px}
.btn{font-family:inherit;font-size:.88rem;font-weight:700;border:none;border-radius:10px;
  padding:9px 18px;cursor:pointer;transition:background .2s,transform .15s}
.btn-toggle{background:var(--paper-2);color:var(--ink);border:1.5px solid var(--line)}
.btn-toggle:hover{border-color:var(--ink)}
.btn-save{background:var(--rust);color:#fff}
.btn-save:hover{background:var(--rust-deep)}
.btn-save:disabled{opacity:.6;cursor:not-allowed}
.status-msg{font-size:.86rem;font-weight:600;transition:color .2s;min-width:90px;text-align:right}
.status-msg.saving{color:var(--ink-soft)}
.status-msg.saved{color:var(--sage)}
.status-msg.error{color:var(--rust)}

/* editor / preview area */
.editor-area{display:grid;grid-template-columns:1fr;gap:16px}
.editor-area.split{grid-template-columns:1fr 1fr}
@media(max-width:860px){.editor-area.split{grid-template-columns:1fr}}
#body-md{width:100%;min-height:62vh;font-family:"Courier New",Courier,monospace;
  font-size:15px;line-height:1.65;padding:16px 18px;
  background:var(--paper-2);border:1.5px solid var(--line);border-radius:12px;
  color:var(--ink);resize:vertical;transition:border-color .2s}
#body-md:focus{outline:none;border-color:var(--rust)}
#preview{background:var(--paper-2);border:1.5px solid var(--line);border-radius:12px;
  padding:24px 26px;overflow-y:auto;max-height:80vh}

/* preview prose */
#preview-content{font-family:"Fraunces",serif;font-size:1.05rem;line-height:1.75;color:var(--ink)}
#preview-content h1,#preview-content h2,#preview-content h3{
  font-family:"Fraunces",serif;font-weight:600;margin:1.5em 0 .5em;line-height:1.15}
#preview-content h1{font-size:1.5rem}
#preview-content h2{font-size:1.2rem}
#preview-content p{margin-bottom:1.2em}
#preview-content p:last-child{margin-bottom:0}
#preview-content a{color:var(--rust)}
#preview-content strong{font-weight:700}
#preview-content em{font-style:italic}
#preview-content blockquote{border-left:3px solid var(--rust);padding:4px 0 4px 16px;
  margin:1.2em 0;color:var(--ink-soft);font-style:italic}
#preview-content hr{border:none;border-top:1.5px solid var(--line);margin:2em 0}
</style>
</head>
<body>
<div class="wrap">

  <header class="page-header">
    <div>
      <p class="kicker">Admin — Editor</p>
      <h1>${esc(story.slug)}</h1>
    </div>
    <nav class="header-links">
      <a href="/admin">← All stories</a>
      ${story.status === 'published'
        ? `<a href="/stories/${esc(story.slug)}" target="_blank" rel="noopener">Public view ↗</a>`
        : ''}
    </nav>
  </header>

  <div id="restore-banner" class="restore-banner" hidden>
    <span>⚠ Unsaved local draft found — restore it?</span>
    <span>
      <button class="btn btn-restore" id="restore-yes">Restore draft</button>
      <button class="btn btn-discard" id="restore-no">Discard</button>
    </span>
  </div>

  <div class="meta-row">
    <div>
      <label for="title">Title</label>
      <input type="text" id="title" autocomplete="off" placeholder="Story title">
    </div>
    <div>
      <label for="subtitle">Subtitle <span style="font-weight:400;text-transform:none">(optional)</span></label>
      <input type="text" id="subtitle" autocomplete="off" placeholder="One-line teaser">
    </div>
    <div>
      <label for="status">Status</label>
      <select id="status">
        <option value="draft" ${draftChecked}>Draft</option>
        <option value="published" ${pubChecked}>Published</option>
      </select>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-left">
      <button class="btn btn-toggle" id="toggle-preview">Show preview</button>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <span class="status-msg" id="status-msg"></span>
      <button class="btn btn-save" id="save-btn">Save</button>
    </div>
  </div>

  <div class="editor-area" id="editor-area">
    <textarea id="body-md" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
    <div id="preview" hidden>
      <div id="preview-content"></div>
    </div>
  </div>

</div>

<!-- Story data injected server-side; read by the module script below -->
<script id="initial-data" type="application/json">${initialJson}</script>

<script type="module">
import { marked } from 'https://esm.sh/marked@13';

const data    = JSON.parse(document.getElementById('initial-data').textContent);
const SLUG    = data.slug;
const LS_KEY  = 'story-draft-' + SLUG;

const titleEl    = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const statusEl   = document.getElementById('status');
const textarea   = document.getElementById('body-md');
const preview    = document.getElementById('preview');
const previewEl  = document.getElementById('preview-content');
const toggleBtn  = document.getElementById('toggle-preview');
const saveBtn    = document.getElementById('save-btn');
const statusMsg  = document.getElementById('status-msg');
const banner     = document.getElementById('restore-banner');

// Populate fields from server data
titleEl.value    = data.title;
subtitleEl.value = data.subtitle;
textarea.value   = data.body_md;

// Autosave restore
const saved = localStorage.getItem(LS_KEY);
if (saved && saved !== data.body_md) {
  banner.hidden = false;
  document.getElementById('restore-yes').addEventListener('click', () => {
    textarea.value = saved;
    updatePreview();
    banner.hidden = true;
  });
  document.getElementById('restore-no').addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    banner.hidden = true;
  });
}

// Autosave on input (500 ms debounce)
let autosaveTimer;
textarea.addEventListener('input', () => {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    localStorage.setItem(LS_KEY, textarea.value);
  }, 500);
  updatePreview();
});

// Preview toggle
let previewOn = false;
function updatePreview() {
  if (!previewOn) return;
  previewEl.innerHTML = marked.parse(textarea.value);
}
toggleBtn.addEventListener('click', () => {
  previewOn = !previewOn;
  preview.hidden = !previewOn;
  toggleBtn.textContent = previewOn ? 'Hide preview' : 'Show preview';
  document.getElementById('editor-area').classList.toggle('split', previewOn);
  if (previewOn) updatePreview();
});

// Save
saveBtn.addEventListener('click', async () => {
  statusMsg.textContent = 'Saving…';
  statusMsg.className = 'status-msg saving';
  saveBtn.disabled = true;

  try {
    const res = await fetch('/admin/api/stories/' + SLUG, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    titleEl.value.trim(),
        subtitle: subtitleEl.value.trim() || null,
        body_md:  textarea.value,
        status:   statusEl.value,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Save failed');
    }

    localStorage.removeItem(LS_KEY);
    statusMsg.textContent = 'Saved ✓';
    statusMsg.className = 'status-msg saved';
    setTimeout(() => {
      statusMsg.textContent = '';
      statusMsg.className = 'status-msg';
    }, 3000);
  } catch (err) {
    statusMsg.textContent = 'Error: ' + err.message;
    statusMsg.className = 'status-msg error';
  } finally {
    saveBtn.disabled = false;
  }
});
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;

  const authError = requireAccess(request);
  if (authError) return authError;

  if (!env.DB) return new Response('Database not configured', { status: 503 });

  const story = await env.DB
    .prepare('SELECT * FROM stories WHERE slug = ?')
    .bind(params.slug)
    .first();

  if (!story) {
    return new Response('Story not found', { status: 404 });
  }

  return new Response(pageEditor(story), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
