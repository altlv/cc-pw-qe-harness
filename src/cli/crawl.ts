import '../env.js';
import { chromium, type Browser } from '@playwright/test';
import { crawlSite, formatCrawl, USER_AGENT } from '../tools/crawl.js';
import { isEnvironment, policyFor } from '../qe/exploration-policy.js';

const seed = process.argv[2];

if (seed === undefined) {
  console.error('usage: npm run crawl -- <url>');
  console.error('  EXPLORE_ENV=local|test|prod  sets the politeness bounds (default local)');
  console.error('  CRAWL_MAX_PAGES=<n>          may only lower the environment cap');
  console.error('  CRAWL_DELAY_MS=<n>           may only raise the environment delay');
  console.error('  CRAWL_MAX_DEPTH=3            how many clicks from the seed');
  console.error('  CRAWL_NO_BROWSER=1           never escalate to a browser, even on a shell');
  process.exit(2);
}

const declared = process.env.EXPLORE_ENV;
if (declared !== undefined && !isEnvironment(declared)) {
  console.error(`EXPLORE_ENV must be local, test or prod — got "${declared}"`);
  process.exit(2);
}
const policy = policyFor(isEnvironment(declared) ? declared : 'local');

const number = (name: string): number | null => {
  const raw = process.env[name];
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The environment sets the bounds and the command line may only move them in the
 * safer direction: fewer pages, longer gaps. Letting an argument loosen a policy
 * would make the policy advice rather than a limit, and the thing being limited
 * here is how hard we hit somebody else's server.
 */
const maxPages = Math.min(number('CRAWL_MAX_PAGES') ?? policy.crawlMaxPages, policy.crawlMaxPages);
const delayMs = Math.max(number('CRAWL_DELAY_MS') ?? policy.crawlDelayMs, policy.crawlDelayMs);

// Opened lazily: a server-rendered site never needs one, and launching a browser
// to crawl a static site would be pure cost.
let browser: Browser | undefined;
const render = async (
  url: string,
): Promise<{ html: string; hrefs: string[]; axes: string[] } | null> => {
  try {
    browser ??= await chromium.launch();
    const page = await browser.newPage({ userAgent: USER_AGENT });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);

      // Walk shadow roots: page.content() serialises the light DOM only, so on a
      // Web Components app every link and control inside a shadow root is absent
      // from the markup even after rendering.
      const collected = await page.evaluate(() => {
        const roots: (Document | ShadowRoot)[] = [document];
        const found: string[] = [];
        const axes: string[] = [];

        for (let index = 0; index < roots.length; index += 1) {
          const root = roots[index];
          if (root === undefined) continue;

          for (const anchor of Array.from(root.querySelectorAll('a[href]'))) {
            found.push((anchor as HTMLAnchorElement).href);
          }
          for (const control of Array.from(
            root.querySelectorAll(
              'select[name], input[type=radio][name], [data-option], [aria-label]',
            ),
          )) {
            const axis =
              control.getAttribute('name') ??
              control.getAttribute('data-option') ??
              control.getAttribute('aria-label') ??
              '';
            if (axis !== '' && axis.length < 30) axes.push(axis);
          }
          for (const element of Array.from(root.querySelectorAll('*'))) {
            if (element.shadowRoot !== null) roots.push(element.shadowRoot);
          }
        }

        return { found, axes: [...new Set(axes)] };
      });

      return { html: await page.content(), hrefs: collected.found, axes: collected.axes };
    } finally {
      await page.close();
    }
  } catch {
    return null;
  }
};

console.log(
  `Environment: ${policy.environment} — at most ${maxPages} page(s), ${delayMs}ms apart.\n`,
);

try {
  const result = await crawlSite(seed, {
    maxPages,
    delayMs,
    maxDepth: number('CRAWL_MAX_DEPTH') ?? 3,
    ...(process.env.CRAWL_NO_BROWSER === '1' ? {} : { render }),
  });

  console.log(formatCrawl(result));
} finally {
  if (browser !== undefined) await browser.close();
}

// Broken links are a defect in the site, not in the crawl, so this exits 0. The
// caller decides whether the finding is a failure.
