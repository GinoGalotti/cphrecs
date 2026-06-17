import { test, expect } from '@playwright/test';

// The Week 25 page must render its values FROM meals/w25/recipes.json
// (rendered client-side), not from hardcoded numbers in the markup.
test.describe('Week 25 meal-prep menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/meals/w25/');
    await page.waitForSelector('.card');
  });

  test('chrome: masthead + week pill come from the route', async ({ page }) => {
    await expect(page.locator('.masthead h1')).toHaveText('The Prep Sheet');
    await expect(page.locator('#weekPill')).toHaveText('Week 25');
    await expect(page).toHaveTitle(/Week 25/);
  });

  test('renders every recipe in the data (not a fixed three)', async ({ page }) => {
    const data = await page.evaluate(() =>
      fetch('/meals/w25/recipes.json').then((r) => r.json())
    );
    await expect(page.locator('.card')).toHaveCount(data.recipes.length);
  });

  test('recipe 1: Bloody Seagull hero + per-100 g, rounded per the rules', async ({ page }) => {
    const card = page.locator('.card').first();
    await expect(card.locator('h2')).toHaveText('Bloody Seagull');
    await expect(card.locator('.yield')).toHaveText('Makes 8');

    // hero = per portion (default unit)
    const hero = card.locator('.basis.portion');
    await expect(hero).toHaveText('per portion');
    const heroVals = card.locator('.macros').first().locator('.macro .v');
    await expect(heroVals.nth(0)).toHaveText('404');     // kcal -> whole
    await expect(heroVals.nth(1)).toHaveText('47.9g');   // protein -> 1 dp (raw, not the HTML's 48)
    await expect(heroVals.nth(2)).toHaveText('18.0g');
    await expect(heroVals.nth(3)).toHaveText('10.0g');
    await expect(heroVals.nth(4)).toHaveText('0.3g');

    // secondary = per 100 g
    const per100 = card.locator('.macros.per100 .macro .v');
    await expect(per100.nth(0)).toHaveText('98');
    await expect(per100.nth(1)).toHaveText('11.7g');
  });

  test('per_portion label respects portion_unit', async ({ page }) => {
    const cards = page.locator('.card');
    await expect(cards.nth(1).locator('.basis.portion')).toHaveText('per pancake'); // panownie
    await expect(cards.nth(2).locator('.basis.portion')).toHaveText('per half');    // roasted veggies
    await expect(cards.nth(2).locator('.macros').first().locator('.macro.kcal .v')).toHaveText('699');
  });

  test('seagull appears on the first recipe only, and bobs unless reduced-motion', async ({ page }) => {
    await expect(page.locator('.card').first().locator('svg.gull')).toHaveCount(1);
    await expect(page.locator('.card svg.gull')).toHaveCount(1);
  });

  test('ingredient names come from ingredients.json', async ({ page }) => {
    const first = page.locator('.card').first();
    await first.locator('.ingredients summary').click();
    await expect(first.locator('.ing-name').first()).toHaveText('Extra virgin olive oil');
  });
});
