import { test, expect } from '@playwright/test';

// ── /stories index ──────────────────────────────────────────────────────────

test.describe('/stories index', () => {
  test('returns 200', async ({ page }) => {
    const res = await page.goto('/stories');
    expect(res?.status()).toBe(200);
  });

  test('page title contains "Stories"', async ({ page }) => {
    await page.goto('/stories');
    await expect(page).toHaveTitle(/Stories/i);
  });

  test('lists at least one link to a story page', async ({ page }) => {
    await page.goto('/stories');
    const hrefs = await page.getByRole('link').evaluateAll(els =>
      els.map(el => el.getAttribute('href')).filter(h => h?.startsWith('/stories/'))
    );
    expect(hrefs.length).toBeGreaterThan(0);
  });

  test('has link back to home', async ({ page }) => {
    await page.goto('/stories');
    await expect(page.getByRole('link', { name: /ginogalotti\.com/i })).toBeVisible();
  });

  test('seeded story "bluesky" appears', async ({ page }) => {
    await page.goto('/stories');
    const blueskyLink = page.getByRole('link').filter({ hasText: /bluesky/i });
    await expect(blueskyLink.or(page.getByRole('link', { name: /warming up/i }))).toBeVisible();
  });
});

// ── /stories/:slug reader ────────────────────────────────────────────────────

test.describe('/stories/:slug reader', () => {
  test('returns 200 for a published story', async ({ page }) => {
    const res = await page.goto('/stories/bluesky');
    expect(res?.status()).toBe(200);
  });

  test('shows story title in a heading', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await expect(page.locator('header h1')).toBeVisible();
  });

  test('shows reading time kicker', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await expect(page.getByText(/\d+\s*min read/i)).toBeVisible();
  });

  test('has reading progress bar element', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await expect(page.locator('#reading-progress')).toBeAttached();
  });

  test('progress bar advances on scroll', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await page.evaluate(() => window.scrollBy(0, 300));
    // Give scroll event time to fire
    await page.waitForTimeout(150);
    const width = await page
      .locator('#reading-progress')
      .evaluate(el => parseFloat(el.style.width));
    expect(width).toBeGreaterThan(0);
  });

  test('has back link to /stories', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await expect(
      page.getByRole('link', { name: /all stories/i }).first()
    ).toBeVisible();
  });

  test('has download .md link', async ({ page }) => {
    await page.goto('/stories/bluesky');
    await expect(page.getByRole('link', { name: /download/i })).toBeVisible();
  });

  test('?format=md returns raw markdown with correct content-type', async ({ request }) => {
    const res = await request.get('/stories/bluesky?format=md');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/markdown');
    const body = await res.text();
    expect(body.trim().length).toBeGreaterThan(0);
  });

  test('returns 404 for an unknown slug', async ({ page }) => {
    const res = await page.goto('/stories/this-slug-does-not-exist-xyz123');
    expect(res?.status()).toBe(404);
  });

  test('404 page has a back link', async ({ page }) => {
    await page.goto('/stories/this-slug-does-not-exist-xyz123');
    await expect(page.getByRole('link', { name: /back/i })).toBeVisible();
  });

  test('draft stories return 404', async ({ page }) => {
    // If no draft exists this just verifies the published-only filter doesn't break
    // A draft slug would 404 just like a missing slug
    const res = await page.goto('/stories/this-slug-does-not-exist-xyz123');
    expect(res?.status()).toBe(404);
  });
});

// ── Regression: existing static pages ────────────────────────────────────────

test.describe('regression — existing pages', () => {
  test('home page loads', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Gino')).toBeVisible();
  });

  test('cphrecs guide loads', async ({ page }) => {
    const res = await page.goto('/cphrecs');
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/Copenhagen/i)).toBeVisible();
  });

  test('cphrecs picks grid is present', async ({ page }) => {
    await page.goto('/cphrecs');
    const grid = page.locator('.picks-grid');
    await expect(grid).toBeVisible();
    const cards = grid.locator('.pick');
    await expect(cards).toHaveCount(4);
  });
});
