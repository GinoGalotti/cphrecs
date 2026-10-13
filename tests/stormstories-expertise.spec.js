import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const md = fs.readFileSync(path.join('stormstories', 'expertise', 'expertises.md'), 'utf8');
const heroes = [...md.matchAll(/^### (.+)\n\n\*\*Has:\*\*/gm)].map(m => m[1].trim());

test.describe('Stormstories expertise list', () => {
  test('serves with and without trailing slash', async ({ page, request }) => {
    for (const url of ['/stormstories/expertise', '/stormstories/expertise/']) {
      expect((await request.get(url)).status()).toBe(200);
    }
    await page.goto('/stormstories/expertise');
    await expect(page).toHaveTitle('Expertises');
    await expect(page.locator('.how summary')).toHaveText('How it works');
  });

  test('four tabs, one panel visible at a time', async ({ page }) => {
    await page.goto('/stormstories/expertise');
    await expect(page.locator('.tab')).toHaveText(['Official', 'Per Origin', 'Per Heroic Path', 'Party Suggestions']);
    await expect(page.locator('.panel:visible')).toHaveCount(1);
    await expect(page.locator('#official')).toBeVisible();
    await expect(page.locator('#official td', { hasText: 'Shortspear' })).toBeVisible();

    await page.locator('.tab', { hasText: 'Per Origin' }).click();
    await expect(page).toHaveURL(/#origin$/);
    await expect(page.locator('#origin')).toBeVisible();
    await expect(page.locator('#official')).toBeHidden();
    await expect(page.locator('#origin')).toContainText('Bridgeman Survival');
  });

  test('heroic path chips narrow the list, and deep links work', async ({ page }) => {
    await page.goto('/stormstories/expertise#paths/scholar');
    await expect(page.locator('#paths .group:visible')).toHaveCount(1);
    await expect(page.locator('#paths-scholar')).toBeVisible();
    await expect(page.locator('.chip[aria-current="true"]')).toHaveText('Scholar');

    await page.locator('.chip', { hasText: 'All' }).click();
    await expect(page.locator('#paths .group:visible')).toHaveCount(6);
  });

  test('party tab has a card per hero', async ({ page }) => {
    expect(heroes.length).toBeGreaterThan(0);
    await page.goto('/stormstories/expertise#party');
    await expect(page.locator('#party .card h3')).toHaveText(heroes);
    await expect(page.locator('#party')).toContainText('Gaps the party could fill');
  });

  test('mobile 390: no horizontal scroll on any tab', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    for (const hash of ['#official', '#origin', '#paths', '#party']) {
      await page.goto('/stormstories/expertise' + hash);
      await page.evaluate(() => document.fonts.ready);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits, hash).toBe(true);
    }
    await ctx.close();
  });
});
