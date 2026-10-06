import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const md = fs.readFileSync(path.join('stormstories', 'zero', 'session-zero.md'), 'utf8');
const mdLine = (re) => {
  const m = md.match(re);
  if (!m) throw new Error('not found in session-zero.md: ' + re);
  return m[1].trim();
};
const IDS = ['world', 'tone', 'you', 'cracks', 'someone', 'each-other', 'moment'];

test.describe('Stormstories session zero', () => {
  test('serves with and without trailing slash, with the right title', async ({ page, request }) => {
    for (const url of ['/stormstories/zero', '/stormstories/zero/']) {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
    }
    await page.goto('/stormstories/zero');
    await expect(page).toHaveTitle('Before the First Storm');
    await page.goto('/stormstories/zero/');
    await expect(page).toHaveTitle('Before the First Storm');
  });

  test('seven sections and a working sphere TOC', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const ids = await page.locator('main section').evaluateAll((els) => els.map((e) => e.id));
    expect(ids).toEqual(IDS);
    const hrefs = await page.locator('.toc a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(IDS.map((i) => '#' + i));
    for (const h of hrefs) await expect(page.locator(h)).toHaveCount(1);
  });

  test('fifteen questions numbered 1..15 in order', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const items = page.locator('ol.qs > li');
    await expect(items).toHaveCount(15);
    const ns = await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-n')));
    expect(ns).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
  });

  test('wording matches session-zero.md', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const epigraph = mdLine(/^> \*(.+)\*$/m);
    await expect(page.locator('.epigraph')).toHaveText(epigraph);

    const contract = mdLine(/^\*\*The table contract:\*\* (.+)$/m);
    await expect(page.locator('.contract')).toHaveText('The table contract: ' + contract);

    const q7 = mdLine(/^7\. \*\*On the road:\*\* (.+)$/m);
    await expect(page.locator('ol.qs > li[data-n="7"]')).toHaveText('On the road: ' + q7);

    const footer = mdLine(/^\*(Journey before destination\.)\*$/m);
    await expect(page.locator('footer.sign')).toContainText(footer);
  });

  test('mobile 390: no horizontal scroll, scale is vertical', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto('/stormstories/zero');
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    const tops = await page.locator('#world .scale li').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(tops[1]).toBeGreaterThan(tops[0]);
    expect(tops[2]).toBeGreaterThan(tops[1]);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'test-results/stormstories-zero-390.png', fullPage: true });
    await ctx.close();
  });

  test('desktop: canon scale sits on one row at 1024', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/stormstories/zero');
    const tops = await page.locator('#world .scale li').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    await ctx.close();
  });

  test('desktop 1280 screenshot', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/stormstories/zero');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'test-results/stormstories-zero-1280.png', fullPage: true });
    await ctx.close();
  });

  test('reduced motion: hero spheres do not animate', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/stormstories/zero');
    const names = await page.locator('.toc .sphere').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
    expect(names).toHaveLength(7);
    for (const n of names) expect(n).toBe('none');
    await ctx.close();
  });

  test('og.png is served as an image', async ({ request }) => {
    const res = await request.get('/stormstories/zero/og.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });
});
