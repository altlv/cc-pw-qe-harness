import { test, expect } from '../../src/fixtures/harness.js';

/**
 * Known answers for `npm run fault-check`, used by its integration test: one spec the
 * fault must catch, one it must not.
 *
 * Collected only under the fault — `playwright.config.ts` ignores this file otherwise.
 * Skipping it inside ordinary runs was the first version, and the release gate read
 * the two skips as disabled coverage and returned CONDITIONAL on every run.
 */
test.describe('fault check probe', () => {
  test('should keep what was typed in the input', async ({ page }) => {
    // Survives the fault by design: typing is client-side, and nothing asserted here
    // depends on what the server answered.
    await page.goto('/');
    await page.getByTestId('todo-input').fill('typed');
    await expect(page.getByTestId('todo-input'), 'the input lost what was typed').toHaveValue(
      'typed',
    );
  });

  test('should list the todos the server returns', async ({ page }) => {
    // Caught by the fault: the list exists only if GET /api/todos answers.
    await page.goto('/');
    await expect(
      page.getByTestId('todo-item').first(),
      'no todo rendered from GET /api/todos',
    ).toBeVisible();
    await expect(page.getByTestId('todo-item')).not.toHaveCount(0);
  });
});
