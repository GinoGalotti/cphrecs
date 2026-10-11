import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const md = fs.readFileSync(path.join('stormstories', 'zero', 'session-zero.md'), 'utf8').replace(/\r/g, '');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

const PARTS = ['world-tone', 'you-cracks', 'connections', 'hooks', 'orders', 'scenes'];
const GEMS = [
  ['world', 'emerald'], ['tone', 'ruby'], ['you', 'amethyst'], ['cracks', 'garnet'],
  ['someone', 'diamond'], ['each-other', 'heliodor'], ['moment', 'topaz'],
];
const HOOKS = [
  "The Assassin's Glyphs", 'Cultural Guide', 'Dreams of the Storm',
  'Sacred Relic Guard', 'Secrets of the Lost Radiants', 'Hired Bodyguard',
];
const ORDERS = [
  ['Windrunner', 'sapphire'], ['Skybreaker', 'smokestone'], ['Dustbringer', 'ruby'],
  ['Edgedancer', 'diamond'], ['Truthwatcher', 'emerald'], ['Lightweaver', 'garnet'],
  ['Elsecaller', 'zircon'], ['Willshaper', 'amethyst'], ['Stoneward', 'topaz'],
  ['Bondsmith', 'heliodor'],
];

/** Every plain-text fragment the md says, as strings that must appear on the page. */
function mdFragments() {
  const out = [];
  const push = (s, min) => {
    s = norm(s.replace(/\*/g, ''));
    if (s.length >= min) out.push(s);
  };
  for (let line of md.split('\n')) {
    line = line.trimEnd();
    if (!line.trim() || /^---+$/.test(line.trim())) continue;
    if (/^\|\s*-/.test(line)) continue;
    if (/^\|\s*Radiant Order/.test(line)) continue;
    if (line.startsWith('|')) {
      for (const cell of line.split('|').slice(1, -1)) push(cell, 3);
      continue;
    }
    const heading = line.match(/^(#+)\s+(.*)$/);
    if (heading) {
      let t = heading[2];
      if (heading[1] === '##') t = t.replace(/^\d+\.\s+/, ''); // part numerals render in their own span
      push(t, 3);
      continue;
    }
    line = line.replace(/^>\s*/, '').replace(/^\s*[*-]\s+/, '').replace(/^\d+\.\s+/, '');
    const label = line.match(/^\*\*(.+?)\*\*\s*(.*)$/) || line.match(/^\*([^*]+:)\*\s*(.*)$/);
    if (label) {
      for (const piece of label[1].replace(/:$/, '').split(' · ')) push(piece, 3);
      push(label[2], 20);
    } else {
      push(line, 20);
    }
  }
  return out;
}

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

  test('six numbered parts and seven gem subsections with the right gems', async ({ page }) => {
    await page.goto('/stormstories/zero');
    expect(await page.locator('main > section.part').evaluateAll((els) => els.map((e) => e.id))).toEqual(PARTS);
    expect(await page.locator('main > section.part > h2 .num').allTextContents()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(await page.locator('main section.gem').evaluateAll((els) => els.map((e) => e.id))).toEqual(GEMS.map((g) => g[0]));
    for (const [id, gem] of GEMS) {
      const sphere = page.locator(`#${id} > .sec-head .sphere`);
      await expect(sphere).toHaveClass(new RegExp(`(^| )g-${gem}( |$)`));
      await expect(page.locator(`#${id} > .sec-head h3`)).toHaveCount(1);
    }
    // gems 1-3 live in parts 1-3
    expect(await page.locator('#world-tone section.gem').count()).toBe(2);
    expect(await page.locator('#you-cracks section.gem').count()).toBe(2);
    expect(await page.locator('#connections section.gem').count()).toBe(3);
    // reference parts carry the dun sphere
    for (const id of ['hooks', 'orders', 'scenes']) {
      await expect(page.locator(`#${id} > h2 .sphere`)).toHaveClass(/(^| )dun( |$)/);
    }
  });

  test('hero: seven sphere links, reference links, all targets exist', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const toc = page.locator('.toc a');
    await expect(toc).toHaveCount(7);
    const hrefs = await toc.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(GEMS.map((g) => '#' + g[0]));
    for (const h of hrefs) await expect(page.locator(h)).toHaveCount(1);
    await expect(toc).toHaveText([
      'The World', 'The Tone', 'Character Foundations', 'The Cracks', 'Someone Else', 'Each Other', 'Bring a Moment',
    ]);
    const refs = page.locator('.refs a');
    expect(await refs.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual(['#hooks', '#orders', '#scenes']);
    await expect(refs).toHaveText(['Why You Walk with Taszo', 'Spren, Radiant Orders & The Nahel Bond', 'Scene Types & Game Mechanics']);
    await expect(page.locator('.refs .sphere.dun')).toHaveCount(3);
  });

  test('"Section 4" link goes to the hooks and scrolls them into view', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const link = page.locator('#you a[href="#hooks"]');
    await expect(link).toHaveCount(1);
    await expect(link).toContainText('Section 4');
    await link.click();
    await expect(page.locator('#hooks')).toBeInViewport();
    await expect(page.locator('#hooks h2')).toBeInViewport();
  });

  test('Each Other: twelve numbered items', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const items = page.locator('#each-other ol.qs > li');
    await expect(items).toHaveCount(12);
    expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-n')))).toEqual(
      Array.from({ length: 12 }, (_, i) => String(i + 1)));
    await expect(items.nth(11).locator('strong')).toHaveText('As a group:');
    // no other numbered lists
    await expect(page.locator('ol.qs')).toHaveCount(1);
  });

  test('hooks: six named hooks in order, no cut copy', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const hooks = page.locator('#hooks .hook');
    await expect(hooks).toHaveCount(6);
    await expect(hooks.locator('h3')).toHaveText(HOOKS);
    // paths sit below the name, never above it
    const order = await hooks.first().evaluate((el) => [...el.children].map((c) => c.tagName + '.' + c.className));
    expect(order.slice(0, 2)).toEqual(['H3.', 'P.paths']);
    await expect(hooks.first().locator('.paths')).toHaveText('Agent or Hunter');
    await expect(hooks.first().locator('.ask')).toContainText('Question:');
    await expect(hooks.first().locator('.goal')).toContainText('Suggested Goal:');
    const text = await page.locator('body').innerText();
    for (const bad of ["Taln's Honorblade", "Po'ahu", 'Parry', '[cite', '&amp;', '⚡', '💥']) {
      expect(text, bad).not.toContain(bad);
    }
    expect(md).not.toContain("Taln's Honorblade");
  });

  test('orders: ten in md order, each with its gem', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const rows = page.locator('#orders .orders > li');
    await expect(rows).toHaveCount(10);
    await expect(rows.locator('.name')).toHaveText(ORDERS.map((o) => o[0]));
    const cls = await rows.evaluateAll((els) => els.map((e) => e.className));
    expect(cls).toEqual(ORDERS.map((o) => `g-${o[1]}`));
    await expect(page.locator('#orders .orders .surges').nth(5)).toHaveText('Illumination & Transform.');
    await expect(page.locator('#orders .orders .surges').nth(6)).toHaveText('Transform. & Transport.');
    // the column names stay available
    await expect(page.locator('#orders-cols')).toHaveText('Radiant Order, Associated Surges, Core Philosophy / Personality Focus');
    // smokestone is lit, not dun
    const filter = await rows.nth(1).locator('.sphere').evaluate((e) => getComputedStyle(e).filter);
    expect(filter).toBe('none');
  });

  test('scenes: headings and the plot die', async ({ page }) => {
    await page.goto('/stormstories/zero');
    await expect(page.locator('#scenes h3')).toHaveText([
      '1. Combats', '2. Conversations', '3. Endeavors', 'The Plot Die: Opportunities & Complications',
    ]);
    await expect(page.locator('#scenes li strong', { hasText: 'Fast' }).first()).toBeVisible();
  });

  test('every sentence in session-zero.md appears on the page', async ({ page }) => {
    await page.goto('/stormstories/zero');
    const text = norm(await page.locator('body').innerText());
    const frags = mdFragments();
    expect(frags.length).toBeGreaterThan(100);
    const missing = frags.filter((f) => !text.includes(f));
    expect(missing).toEqual([]);
  });

  test('keyboard focus shows an outline on the first TOC link', async ({ page }) => {
    await page.goto('/stormstories/zero');
    await page.keyboard.press('Tab');
    const first = page.locator('.toc a').first();
    await expect(first).toBeFocused();
    const style = await first.evaluate((e) => getComputedStyle(e).outlineStyle);
    expect(style).not.toBe('none');
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
    await page.evaluate(() => document.fonts.ready);
    const running = await page.evaluate(() => document.getAnimations().length);
    expect(running).toBe(0);
    await ctx.close();
  });

  test('og.png is served as an image', async ({ request }) => {
    const res = await request.get('/stormstories/zero/og.png');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });
});
