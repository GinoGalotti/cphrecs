import { json, methods } from '../../_lib/http.js';
import { loadCycles } from '../../_lib/db.js';

// Per group: active cycle (8-rep max, per-session trend, stalled), next variation, history.
async function get({ env }) {
  return json({ cycles: await loadCycles(env.DB) });
}

export const onRequest = methods({ GET: get });
