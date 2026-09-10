import { test, expect } from '../../src/fixtures/harness.js';
import { detectInterstitial } from '../../src/tools/interstitial.js';
import type { CapturedCall } from '../../src/capture/types.js';

/**
 * The check that guards every other check.
 *
 * Before this existed, a scan of torn.com reported "Testability findings: none —
 * every control is uniquely addressable" while sitting on a Cloudflare challenge.
 * A confident, tidy report about the wrong page is the worst output available
 * here, and these tests are what stop it coming back.
 *
 * Both directions matter: it must fire on a page that is not the app, and stay
 * silent on one that is. A detector that cried wolf here would make every scan
 * suspect.
 */

function call(overrides: Partial<CapturedCall> = {}): CapturedCall {
  return {
    method: 'GET',
    url: 'https://app.test/',
    path: '/',
    status: 200,
    failure: null,
    durationMs: 5,
    resourceType: 'fetch',
    requestBody: null,
    responseBody: null,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

test.describe('detecting that this is not the application', () => {
  test('should identify a bot challenge from its own traffic', async ({ page }) => {
    await page.setContent('<h1>Checking your browser</h1>');

    const found = await detectInterstitial(page, [
      call({ path: '/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1' }),
    ]);

    expect(found?.kind, 'challenge-platform traffic is the most reliable tell there is').toBe(
      'bot-challenge',
    );
    expect(
      found?.consequence,
      'the report must forbid bypassing it, not merely note the obstacle',
    ).toContain('Do not attempt to bypass');
  });

  test('should identify a challenge from the page title alone', async ({ page }) => {
    await page.setContent('<title>Just a moment...</title><h1>Please wait</h1>');

    expect(
      (await detectInterstitial(page, []))?.kind,
      'the traffic can be missed on a re-navigation, so the title is a second signal',
    ).toBe('bot-challenge');
  });

  test('should identify a login wall by its password field and thin controls', async ({ page }) => {
    await page.setContent(`
      <title>Sign in</title>
      <form>
        <label for="u">Email</label><input id="u" type="email">
        <label for="p">Password</label><input id="p" type="password">
        <button>Sign in</button>
      </form>
    `);

    const found = await detectInterstitial(page, []);

    expect(found?.kind, 'a password field on a near-empty page is the sign-in page').toBe(
      'login-wall',
    );
    expect(
      found?.consequence,
      'the fix is a stored session, and the report should say so rather than leave it to guesswork',
    ).toContain('storageState');
  });

  test('should identify a consent wall covering the viewport', async ({ page }) => {
    await page.setContent(`
      <title>Shop</title>
      <main><a href="/a">Products</a><a href="/b">Basket</a></main>
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000">
        We value your privacy. This site uses cookies. Accept all?
      </div>
    `);

    const found = await detectInterstitial(page, []);

    expect(found?.kind, 'a fixed overlay across the viewport with consent wording').toBe(
      'consent-wall',
    );
    expect(
      found?.consequence,
      'it must explain that unreachable findings underneath are about the overlay, not the app',
    ).toContain('unreachable');
  });

  test('should identify an error page from its title', async ({ page }) => {
    await page.setContent('<title>404 Not Found</title><h1>Nothing here</h1>');

    expect(
      (await detectInterstitial(page, []))?.kind,
      'scanning an error page and reporting a clean result is the failure this prevents',
    ).toBe('error-page');
  });

  test('should stay silent on an ordinary application page', async ({ page }) => {
    await page.setContent(`
      <title>Dashboard</title>
      <nav><a href="/a">Home</a><a href="/b">Orders</a><a href="/c">Reports</a></nav>
      <main>
        <button>New order</button><button>Export</button>
        <a href="/d">Settings</a><a href="/e">Help</a><a href="/f">Profile</a>
        <input type="search" aria-label="Search"><select aria-label="Filter"><option>All</option></select>
        <button>Refresh</button><button>Archive</button><a href="/g">Docs</a>
        <a href="/h">Support</a><a href="/i">Log</a><a href="/j">Audit</a>
        <button>Print</button><a href="/k">Back</a>
      </main>
    `);

    expect(
      await detectInterstitial(page, [call()]),
      'a real page must not be flagged, or every scan becomes suspect and the warning gets ignored',
    ).toBeNull();
  });

  test('should not mistake a page that merely contains a password field for a login wall', async ({
    page,
  }) => {
    // An account-settings page has a password field and plenty else besides.
    const links = Array.from({ length: 20 }, (_, i) => `<a href="/p${i}">Link ${i}</a>`).join('');
    await page.setContent(`
      <title>Account settings</title>
      <main>${links}<input type="password" aria-label="New password"><button>Save</button></main>
    `);

    expect(
      await detectInterstitial(page, []),
      'the signal is a password field on a thin page; a rich page with one is a real screen',
    ).toBeNull();
  });
});
