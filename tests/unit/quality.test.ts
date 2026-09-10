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
  expect(call?.status, 'the write did not reach the server, so the row is not persisted').toBe(201);
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

test.describe('failure messages', () => {
  const TWO_BARE = [
    "import { test, expect } from '@playwright/test';",
    "test('checks two things', async ({ page }) => {",
    "  await page.getByTestId('a').click();",
    '  expect(1).toBe(1);',
    '  expect(2).toBe(2);',
    '});',
  ].join('\n');

  test('should flag a multi-assertion test where no failure is explained', () => {
    const kinds = analyzeSpec(TWO_BARE).map((f) => f.kind);
    expect(
      kinds,
      'a reader seeing "Expected 1, Received 2" in CI cannot tell what broke or why it matters',
    ).toContain('unexplained-failure');
  });

  test('should accept a test where one assertion explains the failure', () => {
    const explained = TWO_BARE.replace(
      'expect(2).toBe(2);',
      "expect(2, 'the second thing regressed').toBe(2);",
    );
    expect(analyzeSpec(explained).map((f) => f.kind)).not.toContain('unexplained-failure');
  });

  test('should not nag a single-assertion test — its name carries the meaning', () => {
    const one = [
      "import { test, expect } from '@playwright/test';",
      "test('should return ok', async ({ page }) => {",
      "  await page.getByTestId('a').click();",
      '  expect(1).toBe(1);',
      '});',
    ].join('\n');
    expect(analyzeSpec(one).map((f) => f.kind)).not.toContain('unexplained-failure');
  });
});

test.describe('fixture strings are not analysed as code', () => {
  // Regression: the analyzer reported findings against example specs held in
  // fixture strings — code that does not exist. False positives train people to
  // ignore the gate entirely.
  test('should ignore a test declared inside a template literal', () => {
    const withFixture =
      'const FIXTURE = `\n' +
      "test('fake test in a fixture', async ({ page }) => {\n" +
      "  await page.goto('/');\n" +
      '});\n' +
      '`;\n';
    expect(
      analyzeSpec(withFixture),
      'a test written inside a fixture string was analysed as though it were real',
    ).toEqual([]);
  });

  test('should ignore a test declared inside a quoted string', () => {
    const concatenated =
      'const FIXTURE =\n' +
      '  "import { test } from \'@playwright/test\';\n" +\n' +
      "  \"test('fake', async ({ page }) => {\n  await page.goto('/');\n});\n\";\n";
    expect(analyzeSpec(concatenated)).toEqual([]);
  });

  test('should ignore a banned wait that only appears inside a fixture string', () => {
    const withBannedWaitInFixture = [
      "import { test, expect } from '@playwright/test';",
      "const SNIPPET = 'await page.waitForTimeout(500);';",
      "test('does not actually wait', async ({ page }) => {",
      "  await page.getByTestId('a').click();",
      "  expect(SNIPPET, 'the snippet should be unchanged').toContain('waitForTimeout');",
      '});',
    ].join('\n');
    expect(
      analyzeSpec(withBannedWaitInFixture).map((f) => f.kind),
      'a banned wait quoted as data was treated as a banned wait in code',
    ).not.toContain('banned-wait');
  });

  test('should still read a real selector, which is code even though it is a string', () => {
    const realFragile = [
      "import { test, expect } from '@playwright/test';",
      "test('uses a positional selector', async ({ page }) => {",
      "  await page.locator('.actions > div:nth-child(3)').click();",
      "  expect(1, 'sanity').toBe(1);",
      '  expect(2).toBe(2);',
      '});',
    ].join('\n');
    expect(
      analyzeSpec(realFragile).map((f) => f.kind),
      'masking must not blind the selector rule — there the string IS the code',
    ).toContain('unmarked-fragile-selector');
  });
});
