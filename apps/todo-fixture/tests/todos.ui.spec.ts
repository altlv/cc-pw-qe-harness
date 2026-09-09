import { test, expect } from '../../../src/fixtures/harness.js';

test.describe('Todos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('todo-item').first()).toBeVisible();
  });

  test('should add a todo and persist it via the API when a title is given', async ({
    page,
    network,
  }) => {
    const title = `Ship the harness ${Date.now()}`;

    await page.getByTestId('todo-input').fill(title);
    await page.getByTestId('todo-submit').click();

    // UI outcome.
    await expect(page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();

    // Network outcome — the half a UI-only assertion would miss. A test that
    // checks only the DOM passes even when the write silently 500s and the list
    // is rendered from stale client state.
    const create = await network.waitForCall(
      (call) => call.method === 'POST' && call.path === '/api/todos',
    );
    expect(create, 'expected a POST /api/todos').not.toBeNull();
    expect(create?.status).toBe(201);
    expect(network.failures()).toHaveLength(0);
  });

  test('should show a validation error and not create a todo when the title is empty', async ({
    page,
    network,
  }) => {
    const before = await page.getByTestId('todo-item').count();

    await page.getByTestId('todo-submit').click();

    await expect(page.getByTestId('todo-error')).toHaveText('title is required');
    await expect(page.getByTestId('todo-item')).toHaveCount(before);

    const create = await network.waitForCall(
      (call) => call.method === 'POST' && call.path === '/api/todos',
    );
    expect(create?.status).toBe(422);
  });
});
