import type { AppConfig } from '../app-config.js';

/**
 * The Polymer Project's demo shop — a real e-commerce front end built from Web
 * Components, so its controls live inside **shadow roots**.
 *
 * That is why it is here. Our scanner reports shadow hosts as `unscanned-shadow-root`
 * and does not descend into them, which meets the declare-your-blind-spots bar and
 * fails the actually-useful bar. This is the subject that forces the difference.
 *
 * Browsing is read-only: the cart is client-side, there is no account and no payment
 * path, so nothing here creates anything on a server.
 */
const config: AppConfig = {
  name: 'polymer-shop',
  description:
    "The Polymer Project's demo shop. A Web Components storefront whose controls sit behind shadow roots — the hardest element-identity case available, and read-only to browse.",
  environments: {
    test: {
      baseURL: 'https://shop.polymer-project.org',
      note: 'read-only browsing only — client-side cart, no account, no payment path',
    },
  },
  defaultEnvironment: 'test',
  external: true,
  sourceRepo: 'https://github.com/Polymer/shop',
};

export default config;
