import { rm } from 'node:fs/promises';
import { test, expect } from '../../src/fixtures/harness.js';
import { loadBaselines } from '../../src/qe/baselines.js';

/**
 * The whole loop, through the interface a real test would use.
 *
 * The pieces are covered separately — `heal.ui.spec.ts` proves the matching,
 * `heal.test.ts` the reporting, `baselines.int.test.ts` the store. What is only
 * provable here is that they connect: a baseline captured in one run is found and
 * used by the next, and a heal that happens inside a passing test still leaves a
 * record behind.
 */

const BASELINES = 'artifacts/self-test/baselines.json';

test.describe.configure({ mode: 'serial' });

// Journalled away from artifacts/heals: a heal staged on purpose by the
// harness's own tests is not debt in the product's suite, and letting it reach
// the gate would have it report a problem that does not exist.
test.use({ baselineFile: BASELINES, healJournalDir: 'artifacts/self-test/heals' });

test.beforeAll(async () => {
  await rm('artifacts/self-test', { recursive: true, force: true });
});

test.describe('with capture turned on', () => {
  test.use({ captureBaselines: true });

  test('should capture a baseline for a selector that has none', async ({ page, healing }) => {
    await page.goto('/');

    const submit = await healing.locator('[data-testid="todo-submit"]');
    await expect(submit).toBeVisible();

    expect(
      healing.records(),
      'there was no baseline to resolve against, so nothing was healed and nothing should be journalled',
    ).toHaveLength(0);
  });
});

test('should heal a selector the application no longer offers', async ({ page, healing }) => {
  await page.goto('/');

  const stored = await loadBaselines(BASELINES);
  expect(
    stored.size,
    'the previous test must have left a baseline behind, or this test proves nothing',
  ).toBe(1);

  // The change under test: the attribute the selector depends on is gone. Done
  // in the browser only — the application's own markup is untouched, which is
  // what makes this a test of the healer rather than of the fixture app.
  await page.evaluate(() => {
    document.querySelector('[data-testid="todo-submit"]')?.removeAttribute('data-testid');
  });

  const submit = await healing.locator('[data-testid="todo-submit"]');
  await expect(
    submit,
    'the button is still there; only the hook the test used to reach it is gone',
  ).toBeVisible();

  const [record] = healing.records();
  expect(record?.status).toBe('healed');
  expect(
    record?.proposed,
    'the record must name the selector the test should be changed to, not merely report that something was healed',
  ).toBe('role=button[name="Add"]');
});

test('should fail loudly, with evidence, when the control is genuinely gone', async ({
  page,
  healing,
}) => {
  await page.goto('/');

  await page.evaluate(() => {
    document.querySelector('[data-testid="todo-submit"]')?.remove();
  });

  // The alternative to throwing here is a test that proceeds against whichever
  // element scored highest — which is how self-healing turns a regression into a
  // pass.
  await expect(healing.locator('[data-testid="todo-submit"]')).rejects.toThrow(/lost/);

  const [record] = healing.records();
  expect(record?.status, 'the refusal has to be journalled, not only thrown').toBe('lost');
  expect(
    record?.evidence,
    'the message a person reads must say what was searched, or "lost" is indistinguishable from a bug in the healer',
  ).toMatch(/no candidate among \d+/);
});

test('should resolve a selector that has no baseline, without complaint', async ({
  page,
  healing,
}) => {
  await page.goto('/');

  const input = await healing.locator('[data-testid="todo-input"]');
  await input.fill('something');
  await expect(
    input,
    'a selector with no baseline must behave exactly as it would without this fixture',
  ).toHaveValue('something');

  expect(healing.records(), 'with nothing to resolve against, there is nothing to journal').toEqual(
    [],
  );
});

test('should not have captured a baseline for it', async () => {
  // A separate test on purpose: the fixture writes during teardown, so the
  // previous test could not have observed its own side effect. Serial mode is
  // what makes the ordering here a fact rather than a hope.
  const stored = await loadBaselines(BASELINES);
  expect(
    [...stored.keys()],
    'capturing whatever a run happens to see leaves every baseline exactly as old as the page it was checked against, and one that is never older can never notice a change',
  ).toEqual(['/::[data-testid="todo-submit"]']);
});
