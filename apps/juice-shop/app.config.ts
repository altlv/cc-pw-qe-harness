import type { AppConfig } from '../app-config.js';

/**
 * OWASP Juice Shop — a deliberately vulnerable web application, and the first
 * subject here that exists at more than one environment.
 *
 * That is why it is in the harness: every other app is local-only or prod-only,
 * so the environment machinery was never actually exercised. This one runs
 * locally from a clone we control and also exists as a public demo, which makes
 * "the same test, a different policy" something we can demonstrate rather than
 * assert.
 *
 * It is also an Angular application, so it is the target that verifies the
 * framework detection in `src/tools/stack.ts` beyond the single jQuery case.
 *
 * The source is **not vendored**. It lives in its own clone; only our config,
 * tests and notes live here.
 */
const config: AppConfig = {
  environments: {
    local: {
      baseURL: 'http://127.0.0.1:3000',
      note: 'clone at C:/Users/User/owasp-juice-shop — npm install && npm start (first build is slow)',
    },
    // The public demo. Shared with the whole internet, reset on a schedule that
    // is not ours, and belonging to someone else: prod in every sense that
    // matters, so read-only.
    prod: {
      baseURL: 'https://demo.owasp-juice.shop',
      note: 'public shared demo — read-only, never a place to leave test data. Returned "Application Error" when probed 2026-09-10, so treat availability as unreliable; this is why external apps stay out of CI.',
    },
  },
  defaultEnvironment: 'local',
  external: true,
  sourceRepo: 'https://github.com/juice-shop/juice-shop',
  name: 'juice-shop',
  description:
    'OWASP Juice Shop, run from a local clone and also reachable as a public demo. The one subject that exists at two environments, and an Angular app for verifying framework detection.',
};

export default config;
