# Page Object pattern

Lives in `apps/<app>/pages/<name>-page.ts`. Extends `src/pages/base-page.ts`.

**The rule that keeps them useful: no assertions inside a Page Object.** It exposes
actions and locators; the test decides what is correct. Once assertions leak in,
failures point at the object instead of the behaviour, and the same object cannot
serve both a positive and a negative test.

```typescript
import type { Locator } from '@playwright/test';
import { BasePage } from '../../../src/pages/base-page.js';

export class BookingsPage extends BasePage {
  protected readonly path = '/bookings';

  // Getters return Locators — the test asserts on them.
  get list(): Locator {
    return this.byTestId('booking-list');
  }

  get rows(): Locator {
    return this.byTestId('booking-row');
  }

  rowByName(name: string): Locator {
    return this.rows.filter({ hasText: name });
  }

  // Actions return void. No expect() anywhere in this file.
  async createBooking(name: string): Promise<void> {
    await this.byTestId('booking-name').fill(name);
    await this.byTestId('booking-submit').click();
  }

  async openFilters(): Promise<void> {
    await this.byTestId('filters-toggle').click();
  }
}
```

Used from a test:

```typescript
const bookings = new BookingsPage(page);
await bookings.goto();
await bookings.createBooking(name);
await expect(bookings.rowByName(name)).toBeVisible(); // assertion lives here
```

## When to create one

When a flow is reused across specs, or a page has enough controls that inline locators
start repeating. A single spec touching three elements does not need one — a Page
Object with one caller is indirection, not abstraction.

## Rules

- No `expect` import. If you feel you need one, that logic belongs in the test.
- No waiting for arbitrary time. Locator getters auto-wait when the test asserts on them.
- Keep selectors private to the object; expose intent (`rowByName`) rather than
  implementation (`'[data-testid=booking-row]'`).
- One object per page or major component, not per test.
