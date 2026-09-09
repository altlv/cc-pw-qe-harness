import type { Locator, Page } from '@playwright/test';

/**
 * Base for Page Objects.
 *
 * The one rule that keeps Page Objects useful: **no assertions in here**. A Page
 * Object exposes actions and locators; the test decides what is correct. Once
 * assertions leak in, failures point at the Page Object instead of the behaviour,
 * and the same object cannot serve a positive and a negative test.
 *
 * Actions return void or a Locator. `expect` must not be imported by a subclass.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Path this page lives at, relative to the project's baseURL. */
  protected abstract readonly path: string;

  async goto(): Promise<void> {
    // `load` can hang forever on an SPA with lazy resources; web-first assertions
    // in the test handle the real readiness check.
    await this.page.goto(this.path, { waitUntil: 'domcontentloaded' });
  }

  /** Prefer test ids. See docs/conventions.md for the selector ladder. */
  protected byTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }
}
