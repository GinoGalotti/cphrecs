import { test, expect } from '@playwright/test';

// The local-dev auth bypass is active when tests run against localhost:8788,
// so no Cf-Access-Jwt-Assertion header is needed here.

// ── /admin dashboard ─────────────────────────────────────────────────────────

test.describe('/admin dashboard', () => {
  test('returns 200 (local bypass active)', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.status()).toBe(200);
  });

  test('page title contains "Admin"', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin/i);
  });

  test('shows a story table', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.stories-table')).toBeVisible();
  });

  test('shows at least one Edit link', async ({ page }) => {
    await page.goto('/admin');
    const editLinks = page.getByRole('link', { name: /edit/i });
    await expect(editLinks.first()).toBeVisible();
  });

  test('shows status badges', async ({ page }) => {
    await page.goto('/admin');
    const badges = page.locator('.badge');
    await expect(badges.first()).toBeVisible();
  });

  test('has link back to home', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: /ginogalotti\.com/i })).toBeVisible();
  });
});

// ── /admin/:slug editor ───────────────────────────────────────────────────────

test.describe('/admin/:slug editor', () => {
  test('returns 200 for an existing story', async ({ page }) => {
    const res = await page.goto('/admin/bluesky');
    expect(res?.status()).toBe(200);
  });

  test('returns 404 for an unknown slug', async ({ page }) => {
    const res = await page.goto('/admin/does-not-exist-xyz');
    expect(res?.status()).toBe(404);
  });

  test('populates textarea with body content', async ({ page }) => {
    await page.goto('/admin/bluesky');
    // Content loaded via JS from initial-data; wait for it
    await expect(page.locator('#body-md')).not.toHaveValue('');
  });

  test('populates title input', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.locator('#title')).not.toHaveValue('');
  });

  test('has a status select', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.locator('#status')).toBeVisible();
  });

  test('has a Save button', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.locator('#save-btn')).toBeVisible();
  });

  test('has a preview toggle button', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.locator('#toggle-preview')).toBeVisible();
  });

  test('preview is hidden by default', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.locator('#preview')).toBeHidden();
  });

  test('toggle shows then hides the preview', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await page.locator('#toggle-preview').click();
    await expect(page.locator('#preview')).toBeVisible();
    await page.locator('#toggle-preview').click();
    await expect(page.locator('#preview')).toBeHidden();
  });

  test('preview renders markdown after toggling on', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await page.locator('#toggle-preview').click();
    // preview-content should have some HTML (marked renders # headings as <h1>)
    const html = await page.locator('#preview-content').innerHTML();
    expect(html.trim().length).toBeGreaterThan(0);
  });

  test('save button shows Saved status on success', async ({ page }) => {
    await page.goto('/admin/bluesky');
    // Wait for textarea to populate
    await expect(page.locator('#body-md')).not.toHaveValue('');
    await page.locator('#save-btn').click();
    await expect(page.locator('#status-msg')).toContainText(/saved/i, { timeout: 5000 });
  });

  test('has a back link to /admin', async ({ page }) => {
    await page.goto('/admin/bluesky');
    await expect(page.getByRole('link', { name: /all stories/i })).toBeVisible();
  });
});

// ── /admin/api/stories/:slug PUT ─────────────────────────────────────────────

test.describe('/admin/api/stories/:slug PUT', () => {
  test('returns 200 for a valid PUT', async ({ request }) => {
    const res = await request.put('/admin/api/stories/bluesky', {
      data: {
        title:    'Updated title',
        subtitle: null,
        body_md:  'Updated body content for the PUT test.',
        status:   'published',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('returns 422 when title is empty', async ({ request }) => {
    const res = await request.put('/admin/api/stories/bluesky', {
      data: { title: '', body_md: 'some content', status: 'published' },
    });
    expect(res.status()).toBe(422);
  });

  test('returns 422 when body_md is empty', async ({ request }) => {
    const res = await request.put('/admin/api/stories/bluesky', {
      data: { title: 'Title', body_md: '', status: 'published' },
    });
    expect(res.status()).toBe(422);
  });

  test('returns 422 for an invalid status value', async ({ request }) => {
    const res = await request.put('/admin/api/stories/bluesky', {
      data: { title: 'Title', body_md: 'Content', status: 'banana' },
    });
    expect(res.status()).toBe(422);
  });

  test('returns 404 for a non-existent slug', async ({ request }) => {
    const res = await request.put('/admin/api/stories/this-slug-xyz-404', {
      data: { title: 'Title', body_md: 'Content', status: 'draft' },
    });
    expect(res.status()).toBe(404);
  });

  test('returns 405 for a GET request', async ({ request }) => {
    const res = await request.get('/admin/api/stories/bluesky');
    // Pages returns 405 for unmatched methods or falls through to 404
    expect([404, 405]).toContain(res.status());
  });

  test('response Content-Type is application/json', async ({ request }) => {
    const res = await request.put('/admin/api/stories/bluesky', {
      data: { title: 'Title', body_md: 'Content', status: 'draft' },
    });
    expect(res.headers()['content-type']).toContain('application/json');
  });
});
