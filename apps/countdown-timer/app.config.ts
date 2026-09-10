import type { AppConfig } from '../app-config.js';

const config: AppConfig = {
  name: 'countdown-timer',
  description:
    "Alan Richardson's countdown timer practice app. A time-based UI, which is where arbitrary waits and flake normally creep in.",
  environments: {
    // Someone else's live site. It is a practice app, but it is still production
    // for whoever runs it, and the policy that follows from that is the right one.
    prod: { baseURL: 'https://testpages.eviltester.com' },
  },
  defaultEnvironment: 'prod',
  scanScope: 'main',
  external: true,
  sourceRepo: 'https://github.com/eviltester/testpages',
};

export default config;
