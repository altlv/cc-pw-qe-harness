import { test, expect } from '../../src/fixtures/harness.js';

/**
 * Tests of the harness itself, not of the fixture app.
 *
 * The premise of this repo is that DOM assertions alone let real failures through.
 * If that were false, the network capture layer would not be worth its weight — so
 * it is asserted here rather than claimed in the README.
 */
test.describe('network capture', () => {
  test('should surface a failed write that the DOM reports as success', async ({
    page,
    network,
  }) => {
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'database unavailable' }),
        });
        return;
      }
      await route.continue();
    });

    // ?optimistic=1 renders the row before the write is confirmed, and never rolls
    // back — the common SPA bug this harness exists to catch.
    await page.goto('/?optimistic=1');
    const title = `Silent failure ${Date.now()}`;
    await page.getByTestId('todo-input').fill(title);
    await page.getByTestId('todo-submit').click();

    // The DOM says the todo was created. A UI-only test stops here and goes green,
    // even though nothing was persisted.
    await expect(page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();

    // The capture layer tells the truth.
    const create = await network.waitForCall(
      (call) => call.method === 'POST' && call.path === '/api/todos',
    );
    expect(create?.status).toBe(500);
    expect(network.failures()).toHaveLength(1);
    expect(create?.responseBody).toContain('database unavailable');
  });

  test('should record status, timing and body for a successful call', async ({ page, network }) => {
    await page.goto('/');

    const load = await network.waitForCall(
      (call) => call.method === 'GET' && call.path === '/api/todos',
    );
    expect(load?.status).toBe(200);
    expect(load?.responseBody).toContain('todos');
    expect(load?.durationMs).not.toBeNull();
    expect(network.failures()).toHaveLength(0);
  });

  test('should exclude favicon so incidental browser traffic cannot fail a suite', async ({
    page,
    network,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('todo-item').first()).toBeVisible();

    await network.settle();
    expect(network.entries().some((call) => call.path === '/favicon.ico')).toBe(false);
  });
});
