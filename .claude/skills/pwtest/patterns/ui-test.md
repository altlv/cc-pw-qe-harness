# UI test pattern

For `apps/<app>/tests/<feature>.ui.spec.ts`. Import from the harness fixture, never
from `@playwright/test` — the fixture is what enables network capture.

## Independent tests (default)

Prefer this. Each test sets up its own state and can run in any order or in parallel.

```typescript
import { test, expect } from '../../../src/fixtures/harness.js';
import { faker } from '@faker-js/faker';

test.describe('Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookings');
    await expect(page.getByTestId('booking-list')).toBeVisible();
  });

  test('should create a booking when the form is valid', async ({ page, network }) => {
    // Arrange — unique data, so parallel runs cannot collide
    const name = faker.company.name();

    // Act
    await page.getByTestId('booking-name').fill(name);
    await page.getByTestId('booking-submit').click();

    // Assert — UI outcome
    await expect(page.getByTestId('booking-row').filter({ hasText: name })).toBeVisible();

    // Assert — network outcome. Catches a silent 500 behind an optimistic render.
    const create = await network.waitForCall(
      (call) => call.method === 'POST' && call.path === '/api/bookings',
    );
    expect(create?.status).toBe(201);
  });
});
```

## Serial flow (only when state must carry)

Use `test.describe.serial` only when steps genuinely depend on each other — create,
then edit, then delete the same record. It costs parallelism and one failure skips
the rest, so justify it.

```typescript
test.describe.serial('Booking lifecycle', () => {
  let bookingId: string;

  test('Step 1: create', async ({ page }) => {
    /* sets bookingId */
  });
  test('Step 2: edit', async ({ page }) => {
    /* uses bookingId */
  });
  test('Step 3: delete and verify removal', async ({ page }) => {
    /* ... */
  });
});
```

## Rules

- **Never assert on a shared collection's size.** Parallel workers share app state, so
  a count is a race. Assert the specific row your test created.
- **No `waitForTimeout`.** Lint blocks it. Use web-first assertions, `locator.waitFor()`,
  or `page.clock` for time-dependent UI.
- **Assert the outcome, not the click.** Assert on the thing that proves the feature
  worked, not on the button you just pressed.
- Mark any positional or class-based CSS selector with `// TODO (Fragile):`.
- Prefer `getByTestId`; see the ladder in `docs/conventions.md`.

## Time-dependent UI

```typescript
await page.clock.install(); // before goto, or the app captures the real clock
await page.goto('/timer');
await page.clock.runFor(31_000); // runFor, not fastForward
await expect(page.locator('#display')).toHaveText('Time Up!');
```

`runFor` advances tick by tick and fires every scheduled timer. `fastForward` jumps and
fires each pending timer once, which advances a one-second interval by one second no
matter how far you jump.
