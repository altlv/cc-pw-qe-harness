import type { Locator } from '@playwright/test';
import { BasePage } from '../../../src/pages/base-page.js';

/**
 * Page Object for the countdown timer.
 *
 * The app exposes no `data-testid`, so every locator falls to the id tier. These
 * ids are hand-written and stable, which is the one case where a CSS id selector
 * is the right answer rather than a compromise.
 */
export class CountdownTimerPage extends BasePage {
  protected readonly path = '/apps/countdown-timer/';

  get display(): Locator {
    return this.page.locator('#javascript_countdown_time');
  }

  get durationInput(): Locator {
    return this.page.locator('#timer-seconds');
  }

  async setDuration(seconds: number): Promise<void> {
    await this.durationInput.fill(String(seconds));
  }

  async start(): Promise<void> {
    await this.page.locator('#start-timer').click();
  }

  async stop(): Promise<void> {
    await this.page.locator('#stop-timer').click();
  }

  async clear(): Promise<void> {
    await this.page.locator('#clear-timer').click();
  }

  /** Loads the duration input. Does not change running state — verified, not assumed. */
  async reset(): Promise<void> {
    await this.page.locator('#reset-timer').click();
  }

  /**
   * Advances virtual time. `runFor` rather than `fastForward`: the app reschedules
   * its tick with a recursive setTimeout, and fastForward fires only the single
   * pending timer, advancing the display by one second however far you jump.
   */
  async advance(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
  }
}
