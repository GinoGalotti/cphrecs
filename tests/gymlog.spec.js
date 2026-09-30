import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Gym log (/gymlog) — auth, seed idempotency and the end-to-end variation-cycling flow.
// The spec resets and re-seeds the LOCAL gym_* tables itself (never --remote), so it can be
// re-run at will. Requires `npx wrangler pages dev . --port 8788` (started by playwright.config.js).
// Admin creds come from ADMIN_USER / ADMIN_PASS, falling back to .dev.vars (gitignored).

function credentials() {
  if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    return { username: process.env.ADMIN_USER, password: process.env.ADMIN_PASS };
  }
  const vars = {};
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { username: vars.ADMIN_USER, password: vars.ADMIN_PASS };
}

test.use({ httpCredentials: credentials() });
test.describe.configure({ mode: 'serial' }); // one shared DB, ordered steps

const TODAY = (() => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const sh = cmd => execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
const resetDb = () => sh('npm run gymlog:reset:local && npm run gymlog:db:local');
const seedAgain = () => sh('npm run gymlog:db:local');

const ID = { bench: 1, incline: 2, chestPress: 3 };
const TEMPLATE = { push: 1, pull: 2, upper: 4 };

// helpers over the JSON API (authenticated `request` fixture)
const get = async (request, path) => {
  const r = await request.get(`/gymlog/api/${path}`);
  expect(r.ok(), `${path} -> ${r.status()}`).toBeTruthy();
  return r.json();
};
const postSession = async (request, exercises, template_id = TEMPLATE.push) => {
  const r = await request.post('/gymlog/api/sessions', { data: { date: TODAY, template_id, notes: '', exercises } });
  expect(r.status()).toBe(201);
  return (await r.json()).id;
};
const counts = async request => {
  const [ex, tp, cy] = await Promise.all([get(request, 'exercises?include_archived=1'), get(request, 'templates'), get(request, 'cycles')]);
  return {
    exercises: ex.exercises.length,
    templates: tp.templates.length,
    slots: tp.templates.reduce((n, t) => n + t.slots.length, 0),
    groups: cy.cycles.length,
    openCycles: cy.cycles.filter(c => c.active).length,
  };
};
const horizontalPress = async request => (await get(request, 'cycles')).cycles[0];

test.beforeAll(() => {
  resetDb();
});

test('1. everything under /gymlog is 401 without credentials; admin still 401, meals still 200', async ({ baseURL }) => {
  // plain fetch: Playwright request contexts would inherit httpCredentials from test.use()
  const anon = {
    get: async p => {
      const r = await fetch(new URL(p, baseURL), { redirect: 'manual' });
      return { status: () => r.status };
    },
  };
  for (const path of ['/gymlog/', '/gymlog/new/', '/gymlog/gymlog.js', '/gymlog/api/exercises', '/admin']) {
    const r = await anon.get(path);
    expect(r.status(), path).toBe(401);
  }
  expect((await anon.get('/meals/w25/')).status()).toBe(200);
});

test('2. schema + seed are idempotent (counts unchanged after re-running)', async ({ request }) => {
  const before = await counts(request);
  expect(before).toEqual({ exercises: 28, templates: 5, slots: 20, groups: 6, openCycles: 6 });
  seedAgain();
  seedAgain();
  expect(await counts(request)).toEqual(before);
});

test('3. Push session (DB bench 3×8 @ 30): Upper proposes 30, default template becomes Pull', async ({ request }) => {
  await postSession(request, [{ exercise_id: ID.bench, sets: [8, 8, 8].map(reps => ({ reps, weight: 30 })) }]);

  const { rows } = await get(request, `defaults?template_id=${TEMPLATE.upper}`);
  const bench = rows.find(r => r.exercise.id === ID.bench);
  expect(bench.sets).toEqual([8, 8, 8].map(reps => ({ reps, weight: 30 })));
  expect(bench.cycle_max).toBe(30);

  expect((await get(request, 'templates')).default_template_id).toBe(TEMPLATE.pull);
});

test('4. 32×8 is highlighted as a cycle PR in the log (first session is not); Cycles shows 32 with 2 bars', async ({ request, page }) => {
  await postSession(request, [{ exercise_id: ID.bench, sets: [{ reps: 8, weight: 32 }] }]);

  const { sessions } = await get(request, 'sessions');
  expect(sessions[0].exercises[0].sets[0]).toMatchObject({ weight: 32, is_cycle_pr: true });
  expect(sessions[1].exercises[0].sets.every(s => !s.is_cycle_pr)).toBe(true);

  await page.goto('/gymlog/');
  await page.waitForSelector('.session');
  await expect(page.locator('.pr')).toHaveCount(1);
  await expect(page.locator('.pr')).toContainText('32');

  await page.goto('/gymlog/cycles/');
  const card = page.locator('.card').first();
  await expect(card.locator('.bigbox .v')).toContainText('32');
  await expect(card.locator('.trend svg > g')).toHaveCount(2);
});

test('5. Rotate Horizontal Press: Incline press becomes active, history shows the closed cycle, Push defaults follow', async ({ request, page }) => {
  await page.goto('/gymlog/cycles/');
  const card = page.locator('.card').first();
  await card.getByRole('button', { name: 'Rotate', exact: true }).click();
  await expect(card.locator('.rotpanel select')).toHaveValue(String(ID.incline)); // next in rotation
  await card.getByRole('button', { name: 'Confirm rotate' }).click();
  await expect(card.locator('h2')).toHaveText('Incline press');

  await card.locator('details.history summary').click();
  const histRows = card.locator('table.hist tbody tr');
  await expect(histRows).toHaveCount(1);
  await expect(histRows.first()).toContainText('Dumbbell bench press');
  await expect(histRows.first()).toContainText('32');

  const { rows } = await get(request, `defaults?template_id=${TEMPLATE.push}`);
  expect(rows[0].exercise.id).toBe(ID.incline);
  expect(rows[0].is_active_variation).toBe(true);

  // rotating to the already-active variation is rejected
  const again = await request.post('/gymlog/api/cycles/rotate', { data: { group_id: 1, exercise_id: ID.incline, date: TODAY } });
  expect(again.status()).toBe(409);
});

test('6+8. swap a row to a non-active variation and save: cycle_id NULL, cycle stats untouched; 82,5 and 82.5 both store 82.5', async ({ request, page }) => {
  const before = (await horizontalPress(request)).active;

  await page.goto('/gymlog/new/');
  await page.waitForSelector('.exrow');
  await page.locator('select[aria-label="Template"]').selectOption({ label: 'No template' });
  await expect(page.locator('.exrow')).toHaveCount(0);

  await page.locator('.addrow select').selectOption({ label: 'Chest press' });
  const row = page.locator('.exrow');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.warnnote')).toContainText("Not the active variation");

  const inputs = row.locator('.sets input');
  await inputs.nth(1).fill('82,5'); // set 1 kg (decimal comma)
  await inputs.nth(3).fill('82.5'); // set 2 kg (decimal point); inputs are reps, kg per set
  await page.locator('.savebar .btn.primary').click();
  await page.waitForURL('**/gymlog/');

  const { sessions } = await get(request, 'sessions');
  const chest = sessions[0].exercises[0];
  expect(chest.exercise_id).toBe(ID.chestPress);
  expect(chest.sets.slice(0, 2).map(s => s.weight)).toEqual([82.5, 82.5]);
  expect(chest.sets.every(s => s.cycle_id === null)).toBe(true);

  const after = (await horizontalPress(request)).active;
  expect({ n: after.sessions, max: after.eight_rep_max }).toEqual({ n: before.sessions, max: before.eight_rep_max });
});

test('7. edit + delete from the UI; autosave survives a reload mid-entry', async ({ request, page }) => {
  await page.goto('/gymlog/');
  await page.locator('.session').first().click();
  await page.waitForURL(/\/gymlog\/new\/\?id=\d+/);
  const id = Number(new URL(page.url()).searchParams.get('id'));
  const weight = page.locator('.exrow').first().locator('.sets input').nth(1);
  await expect(weight).toHaveValue('82.5');

  // mid-entry reload: draft restored, banner shown; Discard drops it
  await weight.fill('90');
  await page.reload();
  await expect(page.locator('.banner')).toContainText('Restored unsaved session');
  await expect(page.locator('.exrow').first().locator('.sets input').nth(1)).toHaveValue('90');
  await page.locator('.banner').getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.banner')).toHaveCount(0);
  await expect(page.locator('.exrow').first().locator('.sets input').nth(1)).toHaveValue('82.5');

  // edit and save
  await page.locator('.exrow').first().locator('.sets input').nth(1).fill('85');
  await page.locator('.savebar .btn.primary').click();
  await page.waitForURL('**/gymlog/');
  expect((await get(request, `sessions/${id}`)).session.exercises[0].sets[0].weight).toBe(85);

  // delete (confirm dialog)
  await page.goto(`/gymlog/new/?id=${id}`);
  await page.waitForSelector('.exrow');
  page.once('dialog', d => d.accept());
  await page.locator('.savebar').getByRole('button', { name: 'Delete' }).click();
  await page.waitForURL('**/gymlog/');
  expect((await request.get(`/gymlog/api/sessions/${id}`)).status()).toBe(404);
});

test('exercises: add, duplicate name is a friendly 409, active variation cannot be archived', async ({ page }) => {
  await page.goto('/gymlog/exercises/');
  await page.waitForSelector('.card');
  const add = async name => {
    await page.locator('details.details-card > summary', { hasText: 'Add exercise' }).click();
    const form = page.locator('form.addform');
    await form.locator('input[type=text]').first().fill(name);
    await form.locator('input[type=checkbox]').first().check();
    await form.locator('select').selectOption({ label: 'Horizontal Press' });
    await form.getByRole('button', { name: 'Add exercise' }).click();
  };

  await add('Cable fly');
  await expect(page.locator('.exitem', { hasText: 'Cable fly' })).toBeVisible();

  await add('cable FLY');
  await expect(page.locator('form.addform .error')).toContainText('already exists');

  await page.reload();
  const incline = page.locator('.exitem', { hasText: 'Incline press' });
  await expect(incline.locator('.badge.ok')).toHaveText('Active');
  await incline.getByRole('button', { name: 'Edit' }).click();
  await page.locator('form.editform').getByLabel(/Archived/).check();
  await page.locator('form.editform').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('form.editform .error')).toContainText('Rotate this group first');
});

test.describe('390px viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  const pages = [
    ['log', '/gymlog/', '.session'],
    ['new', '/gymlog/new/', '.exrow'],
    ['cycles', '/gymlog/cycles/', '.card'],
    ['exercises', '/gymlog/exercises/', '.exitem'],
  ];
  for (const [name, path, ready] of pages) {
    test(`10. ${name}: screenshot, no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector(ready);
      await page.screenshot({ path: `test-results/gymlog-${name}-390.png`, fullPage: true });

      const overflow = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('body *')]
          .filter(e => !e.closest('svg') && e.getBoundingClientRect().right > vw + 0.5 && getComputedStyle(e).position !== 'fixed')
          .map(e => e.tagName.toLowerCase() + '.' + e.className);
        return { scroll: document.documentElement.scrollWidth, vw, wide };
      });
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.vw);
      expect(overflow.wide).toEqual([]);
    });
  }
});
