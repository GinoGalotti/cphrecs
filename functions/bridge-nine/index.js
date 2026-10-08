// /bridge-nine — session index, newest first, discovered from stormstories/sessions/*.md.

import { esc, listSessions, page } from '../stormstories/_lib/sessions.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const sessions = await listSessions(env, request);

  const main = sessions.length
    ? `<ul class="sessions">
${sessions
  .map(
    s => `  <li><a href="/stormstories/${esc(s.slug)}"><span class="t">${esc(s.title)}</span>${
      s.sub ? `<span class="s">${esc(s.sub)}</span>` : ''
    }</a></li>`
  )
  .join('\n')}
</ul>`
    : '<p class="empty">No sessions written up yet.</p>';

  return page({
    title: 'Bridge Nine',
    description: 'Session notes for the Bridge Nine Cosmere RPG table.',
    heading: 'Bridge Nine',
    sub: 'Session notes from the table',
    main,
  });
}
