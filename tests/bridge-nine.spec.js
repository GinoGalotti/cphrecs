import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const md = fs.readFileSync(path.join('stormstories', 'sessions', 'session-zero.md'), 'utf8');
const title = md.match(/^# (.+)$/m)[1].trim();

test.describe('Bridge Nine sessions', () => {
  test('session-zero renders from markdown', async ({ page }) => {
    const res = await page.goto('/stormstories/session-zero');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('.hero h1')).toHaveText(title);
    await expect(page.locator('main h2')).toHaveCount(4);
    await expect(page.locator('main a[href="https://coppermind.net/wiki/Fearspren"]')).toHaveCount(1);
    await expect(page.locator('main blockquote')).toContainText('Spoiler warning');
  });

  test('index lists sessions linking to their pages', async ({ page }) => {
    const res = await page.goto('/bridge-nine');
    expect(res.status()).toBe(200);
    const links = page.locator('ul.sessions a');
    await expect(links.first()).toHaveAttribute('href', /^\/stormstories\/session-/);
    await expect(page.locator('ul.sessions a[href="/stormstories/session-zero"] .t')).toHaveText(title);
  });

  test('unknown session is a 404, primer still served statically', async ({ request }) => {
    expect((await request.get('/stormstories/session-99')).status()).toBe(404);
    const zero = await request.get('/stormstories/zero');
    expect(zero.status()).toBe(200);
    expect(await zero.text()).toContain('Before the First Storm');
  });

  test('mobile 390: no horizontal scroll', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    for (const url of ['/stormstories/session-zero', '/bridge-nine']) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits).toBe(true);
    }
    await page.goto('/stormstories/session-zero');
    await page.screenshot({ path: 'test-results/bridge-nine-session-zero-390.png', fullPage: true });
    await ctx.close();
  });
});
