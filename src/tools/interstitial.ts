import type { Page } from '@playwright/test';
import type { CapturedCall } from '../capture/types.js';

/**
 * Answers the question every other check assumes: **is this actually the app?**
 *
 * A scan of a Cloudflare challenge reports zero controls and no findings, which
 * reads as "a clean, simple page" rather than "we never reached the application".
 * That is the worst kind of wrong answer — confident, tidy, and about something
 * else entirely. Login walls, maintenance pages, geo-blocks, 404s and consent
 * overlays all produce the same false calm.
 *
 * This detects and reports. It never attempts to get past anything: defeating a
 * bot check is out of bounds, and a challenge page is a fact to report to whoever
 * asked for the scan, not an obstacle to route around.
 */

export type InterstitialKind =
  'bot-challenge' | 'login-wall' | 'error-page' | 'consent-wall' | 'geo-block';

export interface Interstitial {
  kind: InterstitialKind;
  /** The observable that proves it, so the claim can be checked. */
  evidence: string;
  /** What the scan below it is therefore worth. */
  consequence: string;
}

const ERROR_TITLES =
  /\b(404|403|500|502|503|not found|forbidden|access denied|unavailable|maintenance|error)\b/i;

const CHALLENGE_TITLES = /just a moment|checking your browser|attention required|verify you are/i;

/**
 * Looks for signs that the page under the scan is not the application.
 *
 * Takes the captured calls as well as the DOM: a challenge is most reliably
 * identified by its own traffic, which survives even when the page renders
 * something innocuous.
 */
export async function detectInterstitial(
  page: Page,
  calls: CapturedCall[],
): Promise<Interstitial | null> {
  const url = page.url();
  const title = await page.title().catch(() => '');

  // --- Bot challenge ------------------------------------------------------
  const challengeTraffic = calls.find(
    (call) =>
      call.path.includes('/cdn-cgi/challenge-platform') ||
      call.path.includes('/_Incapsula_Resource') ||
      call.path.includes('/akam/'),
  );
  if (challengeTraffic !== undefined || /__cf_chl|__cf_bm=/.test(url)) {
    return {
      kind: 'bot-challenge',
      evidence:
        challengeTraffic !== undefined
          ? `${challengeTraffic.method} ${challengeTraffic.path.slice(0, 60)}`
          : 'challenge token in the URL',
      consequence:
        'Everything below describes the challenge page, not the application. Do not attempt to bypass it — scan an environment that permits automated access, or ask whoever owns the site for one.',
    };
  }
  if (CHALLENGE_TITLES.test(title)) {
    return {
      kind: 'bot-challenge',
      evidence: `page title "${title}"`,
      consequence:
        'The scan below is of an interstitial. Nothing it reports is about the application.',
    };
  }

  // --- Everything else needs the DOM -------------------------------------
  const observed = await page.evaluate(() => {
    const passwords = document.querySelectorAll('input[type=password]').length;
    const interactive = document.querySelectorAll(
      'button, a[href], input, select, textarea',
    ).length;

    // A consent wall is a fixed overlay that covers most of the viewport and
    // carries consent wording.
    let consentOverlay: string | null = null;
    for (const el of Array.from(document.querySelectorAll('div, section, aside, dialog'))) {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed') continue;
      const rect = el.getBoundingClientRect();
      const coverage = (rect.width * rect.height) / (window.innerWidth * window.innerHeight);
      if (coverage < 0.4) continue;
      const text = (el as HTMLElement).innerText?.slice(0, 400) ?? '';
      if (/cookie|consent|privacy|we value your|accept all/i.test(text)) {
        consentOverlay = text.replace(/\s+/g, ' ').slice(0, 80);
        break;
      }
    }

    return {
      passwords,
      interactive,
      bodyText: document.body?.innerText?.slice(0, 300).replace(/\s+/g, ' ') ?? '',
      consentOverlay,
    };
  });

  if (observed.consentOverlay !== null) {
    return {
      kind: 'consent-wall',
      evidence: `fixed overlay covering the viewport: "${observed.consentOverlay}"`,
      consequence:
        'Controls beneath it are present in the DOM but unclickable, so expect the unreachable findings above to be about the overlay rather than the app. Dismiss it first, or scope the scan below it.',
    };
  }

  if (observed.passwords > 0 && observed.interactive < 15) {
    return {
      kind: 'login-wall',
      evidence: `${observed.passwords} password field(s) and only ${observed.interactive} controls`,
      consequence:
        'This is the sign-in page, not the application behind it. Use a stored storageState to scan what is actually under test.',
    };
  }

  if (ERROR_TITLES.test(title)) {
    return {
      kind: 'error-page',
      evidence: `page title "${title}"`,
      consequence: 'The scan describes an error page. Whatever was requested was not served.',
    };
  }

  if (/only available in|not available in your (country|region)|geo/i.test(observed.bodyText)) {
    return {
      kind: 'geo-block',
      evidence: `body text "${observed.bodyText.slice(0, 60)}"`,
      consequence: 'The site refused this location; the app was never reached.',
    };
  }

  return null;
}

export function formatInterstitial(interstitial: Interstitial): string {
  return [
    '!!! THIS IS NOT THE APPLICATION !!!',
    '',
    `  Detected: ${interstitial.kind}`,
    `  Evidence: ${interstitial.evidence}`,
    `  ${interstitial.consequence}`,
    '',
    '  Treat every finding below as describing this page, not the app under test.',
  ].join('\n');
}
