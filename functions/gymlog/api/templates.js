import { json, methods } from '../_lib/http.js';
import { defaultTemplateId, loadCatalog, loadTemplates } from '../_lib/db.js';

// Slots are resolved: group slots point at the group's active variation.
async function get({ env }) {
  const catalog = await loadCatalog(env.DB);
  const [templates, defaultId] = await Promise.all([
    loadTemplates(env.DB, catalog),
    defaultTemplateId(env.DB),
  ]);
  return json({ default_template_id: defaultId, templates });
}

export const onRequest = methods({ GET: get });
