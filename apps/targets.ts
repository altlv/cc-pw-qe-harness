import { apps } from './registry.js';
import { EFFECT_TAGS, type AppConfig, type AppEnvironment, type EffectTag } from './app-config.js';
import {
  policyFor,
  type Environment,
  type ExplorationPolicy,
} from '../src/qe/exploration-policy.js';

/**
 * The flattened subject x environment view.
 *
 * `registry.ts` stays the one authored list; everything here is derived from it,
 * so there is no second source of truth to keep in sync. That matters more than
 * convenience: a hand-maintained index of the same facts is how the state files
 * came to contradict each other.
 *
 * Its real job is to make a mismatch visible. An app whose only deployment is
 * production, carrying tests that write, is a decision somebody should have made
 * deliberately — spread across three files nobody sees it, in one table it is
 * obvious. `validateTargets()` turns that from something you might notice into
 * something that fails.
 */

export interface Target {
  app: AppConfig;
  environment: Environment;
  baseURL: string;
  webServer?: { command: string; port: number };
  note?: string;
  /** What may be done here. Derived from the environment, plus any override. */
  policy: ExplorationPolicy;
}

/** Every app/environment pair, in registry order. */
export function targets(): Target[] {
  return apps.flatMap((app) =>
    (Object.entries(app.environments) as [Environment, AppEnvironment][]).map(
      ([environment, config]) => ({
        app,
        environment,
        baseURL: config.baseURL,
        ...(config.webServer !== undefined ? { webServer: config.webServer } : {}),
        ...(config.note !== undefined ? { note: config.note } : {}),
        policy: policyFor(environment),
      }),
    ),
  );
}

/** The one deployment an app uses when nothing names another. */
export function defaultTarget(app: AppConfig): Target {
  const found = targets().find(
    (target) => target.app.name === app.name && target.environment === app.defaultEnvironment,
  );
  if (found === undefined) {
    throw new Error(
      `${app.name}: defaultEnvironment "${app.defaultEnvironment}" is not among its environments`,
    );
  }
  return found;
}

export function targetFor(appName: string, environment?: Environment): Target | undefined {
  const app = apps.find((candidate) => candidate.name === appName);
  if (app === undefined) return undefined;
  return targets().find(
    (target) =>
      target.app.name === appName && target.environment === (environment ?? app.defaultEnvironment),
  );
}

/**
 * Whether a test carrying these tags may run here.
 *
 * An untagged test is *unknown*, not harmless. Unknown runs locally, where the
 * worst case is a fixture that needs resetting, and nowhere else.
 */
export function effectAllowed(
  policy: ExplorationPolicy,
  tags: readonly string[],
): { allowed: true } | { allowed: false; reason: string } {
  const has = (tag: EffectTag): boolean => tags.includes(tag);

  if (has(EFFECT_TAGS.destructive) && !policy.allowDestructive) {
    return {
      allowed: false,
      reason: `destructive tests do not run on ${policy.environment}`,
    };
  }
  if (has(EFFECT_TAGS.writes) && !policy.allowWrites) {
    return { allowed: false, reason: `writing tests do not run on ${policy.environment}` };
  }
  if (has(EFFECT_TAGS.readOnly)) return { allowed: true };

  // Nothing declared. Safe only where a mistake is cheap.
  if (policy.environment === 'local') return { allowed: true };
  return {
    allowed: false,
    reason: `untagged test has an unknown effect, so it does not run on ${policy.environment} — tag it ${EFFECT_TAGS.readOnly} if it changes nothing`,
  };
}

/** A Playwright `--grep` expression selecting what may run under this policy. */
export function grepForPolicy(policy: ExplorationPolicy): RegExp | undefined {
  if (policy.allowDestructive) return undefined; // local: everything runs
  if (policy.allowWrites) return new RegExp(`${EFFECT_TAGS.readOnly}|${EFFECT_TAGS.writes}`);
  return new RegExp(EFFECT_TAGS.readOnly);
}

export interface TargetProblem {
  target: string;
  problem: string;
}

/**
 * Invariants that would otherwise be invisible until something went wrong.
 *
 * Checked by a unit test rather than left as documentation, because an index
 * nothing reads back is write-only — and this one exists precisely to catch the
 * case where we ship writing tests against somebody else's production service.
 */
export function validateTargets(): TargetProblem[] {
  const problems: TargetProblem[] = [];
  const seen = new Set<string>();

  for (const app of apps) {
    if (seen.has(app.name)) {
      problems.push({ target: app.name, problem: 'duplicate app name in the registry' });
    }
    seen.add(app.name);

    const environments = Object.keys(app.environments) as Environment[];
    if (environments.length === 0) {
      problems.push({ target: app.name, problem: 'declares no environments' });
    }
    if (!environments.includes(app.defaultEnvironment)) {
      problems.push({
        target: app.name,
        problem: `defaultEnvironment "${app.defaultEnvironment}" is not one of its environments`,
      });
    }
  }

  for (const target of targets()) {
    const label = `${target.app.name}/${target.environment}`;

    if (target.webServer !== undefined && target.environment !== 'local') {
      problems.push({
        target: label,
        problem: 'starts its own web server on a non-local environment',
      });
    }

    const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(target.baseURL);
    if (target.environment === 'prod' && isLoopback) {
      problems.push({ target: label, problem: 'a prod environment points at localhost' });
    }
    if (target.environment === 'local' && !isLoopback) {
      problems.push({
        target: label,
        problem:
          'a local environment points off-machine, so its permissive policy would apply to a remote system',
      });
    }
  }

  return problems;
}

/** The matrix, for `npm run targets`. */
export function formatTargets(): string {
  const lines: string[] = ['Subjects under test, and where they can be pointed:', ''];

  for (const app of apps) {
    const owner = app.external === true ? 'not ours' : 'ours';
    lines.push(`${app.name}  (${owner})`);
    lines.push(`  ${app.description}`);
    if (app.sourceRepo !== undefined) lines.push(`  source: ${app.sourceRepo}`);

    for (const target of targets().filter((entry) => entry.app.name === app.name)) {
      const permits = [
        'read',
        target.policy.allowWrites ? 'write' : null,
        target.policy.allowDestructive ? 'destructive' : null,
      ]
        .filter((entry) => entry !== null)
        .join(' · ');
      const isDefault = target.environment === app.defaultEnvironment ? '  [default]' : '';
      lines.push(`    ${target.environment.padEnd(6)} ${target.baseURL}`);
      lines.push(
        `           permits: ${permits}${target.policy.captureBodies ? ' · bodies logged' : ' · bodies withheld'}${isDefault}`,
      );
      if (target.note !== undefined) lines.push(`           ${target.note}`);
    }
    lines.push('');
  }

  const problems = validateTargets();
  if (problems.length === 0) {
    lines.push('No problems found.');
  } else {
    lines.push(`Problems (${problems.length}):`);
    for (const problem of problems) lines.push(`  ${problem.target}: ${problem.problem}`);
  }

  return lines.join('\n');
}
