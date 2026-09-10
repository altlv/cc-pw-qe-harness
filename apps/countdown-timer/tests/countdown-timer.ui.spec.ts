import { test, expect } from '../../../src/fixtures/harness.js';

/**
 * Validation against a third-party app the harness authors did not write:
 * https://testpages.eviltester.com/apps/countdown-timer/
 *
 * A countdown is the honest test of the no-arbitrary-waits rule. The naive suite
 * sleeps for the duration and is both slow and racy. These drive Playwright's
 * clock instead, so a one-hour countdown is asserted in milliseconds and the
 * result does not depend on machine speed.
 *
 * Observed behaviour (verified before writing, not assumed):
 *   - the timer auto-starts on load
 *   - stop pauses and holds the remaining time
 *   - clear jumps straight to "Time Up!"
 *   - reset loads the seconds input and leaves the run state alone: it neither
 *     pauses a running timer nor starts a stopped one
 *   - reaching zero shows "Time Up!" and stays there
 */

const DISPLAY = '#javascript_countdown_time';

test.describe('Countdown timer', { tag: '@read-only' }, () => {
  test.beforeEach(async ({ page }) => {
    // Must be installed before page scripts run, or the app captures the real clock.
    await page.clock.install();
    await page.goto('/apps/countdown-timer/');

    // Readiness, not visibility. The static HTML ships this element already holding
    // "01:01:12" - the exact value the inline init script would set - so asserting the
    // display is visible proves nothing about whether that script ran. Until it does,
    // the control buttons carry no click listeners and every action below is silently
    // a no-op, which is a real flake this suite hit once.
    await page.waitForFunction(() => 'javascript_countdown' in globalThis);

    // The listeners are attached, but a wired button is not a running timer. One
    // virtual second is the cheapest proof the interval is genuinely ticking.
    await page.clock.runFor(1_000);
    await expect(
      page.locator(DISPLAY),
      'the countdown never advanced - the timer auto-start did not take effect, so any test relying on it would assert against a dead page',
    ).toHaveText('01:01:11');
  });

  test('should reach Time Up when the countdown runs past zero', async ({ page }) => {
    await page.locator('#timer-seconds').fill('30');
    await page.locator('#reset-timer').click();
    await expect(page.locator(DISPLAY)).toHaveText('00:00:30');

    await page.locator('#start-timer').click();
    await page.clock.runFor(31_000);

    await expect(
      page.locator(DISPLAY),
      'the countdown ran past zero without reaching Time Up — the timer stopped early or the display stalled',
    ).toHaveText('Time Up!');
  });

  test('should hold the remaining time while stopped', async ({ page }) => {
    await page.locator('#timer-seconds').fill('60');
    await page.locator('#reset-timer').click();
    await page.locator('#start-timer').click();

    await page.clock.runFor(10_000);
    await expect(page.locator(DISPLAY)).toHaveText('00:00:50');

    await page.locator('#stop-timer').click();
    const held = await page.locator(DISPLAY).textContent();

    // Proving a value does NOT change needs elapsed time. Real time would mean a
    // sleep; virtual time proves it over a simulated minute and costs nothing.
    await page.clock.runFor(60_000);
    await expect(
      page.locator(DISPLAY),
      'the display moved while stopped — stop did not halt the tick',
    ).toHaveText(held ?? '');
  });

  test('should resume from the held value when started again after a stop', async ({ page }) => {
    await page.locator('#timer-seconds').fill('60');
    await page.locator('#reset-timer').click();
    await page.locator('#start-timer').click();
    await page.clock.runFor(5_000);
    await page.locator('#stop-timer').click();
    await expect(page.locator(DISPLAY)).toHaveText('00:00:55');

    await page.locator('#start-timer').click();
    await page.clock.runFor(5_000);

    await expect(
      page.locator(DISPLAY),
      'start did not resume from the held value — it restarted or lost the remaining time',
    ).toHaveText('00:00:50');
  });

  test('should load the configured duration but keep running when reset mid-countdown', async ({
    page,
  }) => {
    // Reset changes the remaining time only; it does not stop a running timer.
    // Worth pinning down: the obvious assumption is that reset also pauses, and a
    // test written on that assumption fails against correct behaviour.
    await page.locator('#timer-seconds').fill('45');
    await page.locator('#reset-timer').click();
    await expect(page.locator(DISPLAY)).toHaveText('00:00:45');

    await page.clock.runFor(10_000);

    await expect(
      page.locator(DISPLAY),
      'reset stopped a running timer — reset should reload the duration and leave the run state alone',
    ).toHaveText('00:00:35');
  });

  test('should load the configured duration and stay paused when reset while stopped', async ({
    page,
  }) => {
    await page.locator('#stop-timer').click();
    await page.locator('#timer-seconds').fill('45');
    await page.locator('#reset-timer').click();
    await expect(page.locator(DISPLAY)).toHaveText('00:00:45');

    await page.clock.runFor(10_000);

    await expect(
      page.locator(DISPLAY),
      'reset restarted a stopped timer — it should reload the duration and stay paused',
    ).toHaveText('00:00:45');
  });

  test('should jump straight to Time Up when cleared mid-countdown', async ({ page }) => {
    await page.locator('#timer-seconds').fill('600');
    await page.locator('#reset-timer').click();
    await page.locator('#start-timer').click();
    await page.clock.runFor(5_000);
    await expect(page.locator(DISPLAY)).toHaveText('00:09:55');

    await page.locator('#clear-timer').click();

    await expect(
      page.locator(DISPLAY),
      'clear did not jump straight to Time Up — it may be counting down instead of clearing',
    ).toHaveText('Time Up!');
  });
});
