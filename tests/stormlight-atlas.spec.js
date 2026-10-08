import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';

// Stormlight Character Atlas (/stormstories/characterbuilder) — auth, hash routing,
// prerequisite highlighting, PDF download and 400px layout.
// Credentials come from STORMLIGHT_USER / STORMLIGHT_PASS, falling back to .dev.vars (gitignored).
// The dev server needs the same values in .dev.vars (wrangler ignores --binding when .dev.vars exists).

const BASE = '/stormstories/characterbuilder';
const FILES = ['index.html', 'atlas.json', 'atlas.md', 'Stormlight-Character-Atlas.pdf'];

function credentials() {
  if (process.env.STORMLIGHT_USER && process.env.STORMLIGHT_PASS) {
    return { username: process.env.STORMLIGHT_USER, password: process.env.STORMLIGHT_PASS };
  }
  const vars = {};
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { username: vars.STORMLIGHT_USER, password: vars.STORMLIGHT_PASS };
}

test.describe('Stormlight atlas: auth', () => {
  test('every file asks for credentials and rejects wrong ones', async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    for (const f of ['', ...FILES]) {
      const res = await anon.get(`${BASE}/${f === 'index.html' ? '' : f}`, { maxRedirects: 0 });
      expect(res.status(), f || '/').toBe(401);
      expect(res.headers()['www-authenticate']).toContain('Basic');
    }
    const wrong = await playwright.request.newContext({ baseURL, httpCredentials: { username: 'nope', password: 'nope' } });
    expect((await wrong.get(`${BASE}/`)).status()).toBe(401);
    await anon.dispose();
    await wrong.dispose();
  });

  test('admin credentials do not open it', async ({ playwright, baseURL }) => {
    const vars = Object.fromEntries(readFileSync('.dev.vars', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
    test.skip(!vars.ADMIN_USER, 'no admin creds in .dev.vars');
    const admin = await playwright.request.newContext({ baseURL, httpCredentials: { username: vars.ADMIN_USER, password: vars.ADMIN_PASS } });
    expect((await admin.get(`${BASE}/`)).status()).toBe(401);
    await admin.dispose();
  });
});

test.describe('Stormlight atlas: page', () => {
  test.use({ httpCredentials: credentials() });

  test('files are served privately and stay under the 25 MB Pages limit', async ({ request }) => {
    for (const f of FILES) {
      expect(statSync(`stormstories/characterbuilder/${f}`).size, f).toBeLessThan(25 * 1024 * 1024);
      const res = await request.get(`${BASE}/${f === 'index.html' ? '' : f}`);
      expect(res.status(), f).toBe(200);
      expect(res.headers()['cache-control']).toBe('private, no-store');
      expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
    }
    const json = await (await request.get(`${BASE}/atlas.json`)).json();
    expect(json.talents.paths.length).toBeGreaterThan(10);
  });

  test('renders, tabs switch, and #windrunner deep-links', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await expect(page).toHaveTitle('Stormlight Character Atlas');
    await expect(page.locator('#tabs [role="tab"]')).toHaveCount(7);
    await page.locator('#tabs [role="tab"]', { hasText: 'Gear' }).click();
    await expect(page.locator('[data-sec="gear"]')).toBeVisible();

    await page.goto(`${BASE}/#windrunner`);
    await expect(page.locator('#sec-windrunner')).toBeVisible();
    await expect(page.locator('#sec-windrunner h2').first()).toHaveText('Windrunner');
    await expect(page.locator('#tabs [aria-selected="true"]')).toHaveText('Radiant orders');
  });

  test('clicking a talent lights its prerequisite chain', async ({ page }) => {
    await page.goto(`${BASE}/#agent`);
    await page.locator('#sec-agent .node[data-name="Gather Evidence"]').click();
    await expect(page.locator('#sec-agent .node.sel')).toHaveAttribute('data-name', 'Gather Evidence');
    const chain = await page.locator('#sec-agent .node.chain').evaluateAll(els => els.map(e => e.dataset.name));
    expect(chain).toEqual(expect.arrayContaining(['Quick Analysis', 'Watchful Eye', 'Opportunist (Agent Key)']));
    expect(await page.locator('#sec-agent svg.wires path.lit').count()).toBeGreaterThan(0);
    await expect(page.locator('.rail[data-rail="Agent"]')).toBeVisible();
  });

  test('Download PDF link downloads the PDF', async ({ page }) => {
    await page.goto(`${BASE}/`);
    const link = page.getByRole('link', { name: /Download PDF/ });
    await expect(link).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(dl.suggestedFilename()).toBe('Stormlight-Character-Atlas.pdf');
    expect(statSync(await dl.path()).size).toBe(statSync('stormstories/characterbuilder/Stormlight-Character-Atlas.pdf').size);
  });

  test('phone 400: no horizontal page scroll', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, httpCredentials: credentials() });
    const page = await ctx.newPage();
    for (const hash of ['', '#windrunner', '#create', '#gear']) {
      await page.goto(`${BASE}/${hash}`);
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits, hash || 'top').toBe(true);
    }
    await page.goto(`${BASE}/#windrunner`);
    await page.screenshot({ path: 'test-results/stormlight-atlas-400.png' });
    await page.locator('#sec-windrunner .node').nth(3).click();
    await page.screenshot({ path: 'test-results/stormlight-atlas-400-rail.png' });
    await ctx.close();
  });
});
