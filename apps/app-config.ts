import type { Environment } from '../src/qe/exploration-policy.js';

export type { Environment };

/**
 * One deployment of an app. The key it is filed under carries the safety
 * meaning: `prod` is real users and real data, whether or not we own it.
 */
export interface AppEnvironment {
  baseURL: string;
  /** Set when the harness starts this deployment itself. Only ever `local`. */
  webServer?: { command: string; port: number };
  /** How to reach it, when it is not simply running. Shown by `npm run targets`. */
  note?: string;
}

/**
 * What a test does to the system, declared per test with a Playwright tag.
 *
 * Untagged means *unknown*, and unknown is treated as unsafe: a prod run
 * executes only what has explicitly claimed to be read-only. Safe by default is
 * the point — the alternative is learning a test's effect by watching it run
 * somewhere it should not have.
 */
export const EFFECT_TAGS = {
  readOnly: '@read-only',
  writes: '@writes',
  destructive: '@destructive',
} as const;

export type EffectTag = (typeof EFFECT_TAGS)[keyof typeof EFFECT_TAGS];

export interface AppConfig {
  /** Folder name under apps/, and the Playwright project name. */
  name: string;
  /** One line: what this app is and why it is in the harness. */
  description: string;
  /**
   * Every deployment we can point at. At least one. Apps rarely have all three:
   * a bundled fixture is local-only, a third-party site is prod-only.
   */
  environments: Partial<Record<Environment, AppEnvironment>>;
  /** Used when nothing names an environment. */
  defaultEnvironment: Environment;
  /**
   * CSS scope for page scanning. Without it a scan of a documentation site
   * returns eighty nav links and buries the app's own controls.
   */
  scanScope?: string;
  /**
   * True when the app is not ours — someone else's repository or service.
   *
   * This is **ownership**, not risk; risk is carried by the environment key. It
   * exists so CI can skip suites whose failures would be someone else's outage,
   * because a suite that goes red for reasons the team cannot fix teaches the
   * team to ignore red.
   */
  external?: boolean;
  /** Where the app itself lives, when it is not in this repo. */
  sourceRepo?: string;
}
