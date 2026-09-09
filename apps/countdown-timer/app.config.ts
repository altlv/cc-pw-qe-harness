import type { AppConfig } from '../app-config.js';

const config: AppConfig = {
  name: 'countdown-timer',
  description:
    "Alan Richardson's countdown timer practice app. A time-based UI, which is where arbitrary waits and flake normally creep in.",
  baseURL: 'https://testpages.eviltester.com',
  scanScope: 'main',
  external: true,
};

export default config;
