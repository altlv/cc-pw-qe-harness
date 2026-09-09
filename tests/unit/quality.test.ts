import { test, expect } from '@playwright/test';
import { analyzeSpec } from '../../src/quality/assertions.js';

const VACUOUS = `
import { test } from '@playwright/test';
test('navigates and proves nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('x').click();
});
`;

const NAVIGATION_ONLY = `
import { test, expect } from '@playwright/test';
test('only checks the page loaded', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Todos/);
});
`;

const FRAGILE = `
import { test, expect } from '@playwright/test';
test('uses a positional selector', async ({ page }) => {
  await page.goto('/');
  await page.locator('.actions > div:nth-child(3)').click();
  await expect(page.getByText('ok')).toBeVisible();
  await expect(page.getByText('done')).toBeVisible();
});
`;

const GOOD = `
import { test, expect } from '../../../src/fixtures/harness.js';
test('should create a todo when the title is valid', async ({ page, network }) => {
  await page.getByTestId('todo-input').fill('x');
  await page.getByTestId('todo-submit').click();
  await expect(page.getByTestId('todo-item').last()).toBeVisible();
  const call = await network.waitForCall((c) => c.method === 'POST');
  expect(call?.status).toBe(201);
});
`;

test.describe('quality analyzer', () => {
  test('should flag a test that contains no assertion', () => {
    const kinds = analyzeSpec(VACUOUS).map((f) => f.kind);
    expect(kinds).toContain('no-assertion');
  });

  test('should flag a test that navigates and asserts once without interacting', () => {
    const kinds = analyzeSpec(NAVIGATION_ONLY).map((f) => f.kind);
    expect(kinds).toContain('navigation-only');
  });

  test('should flag a positional CSS selector that carries no TODO marker', () => {
    const kinds = analyzeSpec(FRAGILE).map((f) => f.kind);
    expect(kinds).toContain('unmarked-fragile-selector');
  });

  test('should not flag a fragile selector that is explicitly marked', () => {
    const marked = FRAGILE.replace(
      '  await page.locator(',
      '  // TODO (Fragile): needs a data-testid\n  await page.locator(',
    );
    const kinds = analyzeSpec(marked).map((f) => f.kind);
    expect(kinds).not.toContain('unmarked-fragile-selector');
  });

  test('should flag a banned wait', () => {
    const withWait = GOOD.replace(
      "await page.getByTestId('todo-submit').click();",
      "await page.waitForTimeout(500);\n  await page.getByTestId('todo-submit').click();",
    );
    expect(analyzeSpec(withWait).map((f) => f.kind)).toContain('banned-wait');
  });

  test('should report nothing for a spec that asserts real outcomes', () => {
    expect(analyzeSpec(GOOD)).toEqual([]);
  });

  // Regression: the analyzer originally brace-matched the destructured fixture
  // parameter `({ page, network })` instead of the function body, so every test
  // looked empty and reported a false "no-assertion".
  test('should read the function body, not the destructured fixture parameter', () => {
    const findings = analyzeSpec(GOOD);
    expect(findings, 'a well-formed test must produce no findings').toHaveLength(0);
  });

  test('should attribute a finding to the right test name', () => {
    const [finding] = analyzeSpec(VACUOUS);
    expect(finding?.testName).toBe('navigates and proves nothing');
  });
});
