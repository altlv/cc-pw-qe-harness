# Smoke test pattern

Short, fast, read-only checks that a feature is alive. Under ~10 seconds, no data
creation, no complex flows — those belong in e2e.

A smoke suite answers one question: _is this build worth running the full suite
against?_

```typescript
import { test, expect } from '../../../src/fixtures/harness.js';

test.describe('Bookings smoke', () => {
  test('should load the page with its key controls present', async ({ page, network }) => {
    await page.goto('/bookings');

    // Use real test ids from apps/<app>/scans/, not guesses.
    await expect(page.getByTestId('booking-list')).toBeVisible();
    await expect(page.getByTestId('booking-submit')).toBeEnabled();

    // A page can render its shell while every data call fails.
    expect(network.failures()).toHaveLength(0);
  });
});
```

## API smoke

```typescript
test('should answer the collection endpoint', async ({ api }) => {
  const response = await api.get('/api/v1/Books');
  expect(response.status()).toBe(200);
  expect((await response.json()) as unknown[]).not.toHaveLength(0);
});
```

## Rules

- **Read-only.** A smoke test that creates data will eventually fail on dirty state,
  and it will fail at the worst moment, because smoke runs first.
- **Assert presence and reachability**, not deep behaviour.
- The network-failures check is what separates this from a screenshot: a shell that
  renders over a broken backend passes a visual check and fails this one.
- Keep it on the critical path. A smoke suite that takes five minutes stops being run,
  and a suite nobody runs is worse than none because it still looks like coverage.
