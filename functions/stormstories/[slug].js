// /stormstories/session-zero, /stormstories/session-1, ... rendered from stormstories/sessions/*.md.
// Any other slug (e.g. /stormstories/zero) falls through to the static site.

import { SESSION_SLUG, loadSession, renderBody, page } from './_lib/sessions.js';

export async function onRequestGet(context) {
  const { params, env, request } = context;
  if (!SESSION_SLUG.test(params.slug)) return context.next();

  const s = await loadSession(env, request, params.slug);
  if (!s) {
    return page({
      title: 'Session not found',
      description: 'That session has not been written up yet.',
      crumb: '<a href="/bridge-nine">← Bridge Nine</a>',
      heading: 'Session not found',
      main: '<p>That session hasn\'t been written up yet. <a href="/bridge-nine">See all sessions</a>.</p>',
      status: 404,
    });
  }

  return page({
    title: s.title,
    description: s.sub || 'Bridge Nine session notes.',
    crumb: '<a href="/bridge-nine">← Bridge Nine</a>',
    heading: s.title,
    sub: s.sub,
    main: renderBody(s.body),
  });
}
