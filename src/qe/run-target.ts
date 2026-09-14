import { ENVIRONMENTS, isEnvironment, type Environment } from './exploration-policy.js';

/**
 * Where a run points, resolved once from `--app` and `--env` through the registry.
 *
 * Until 2026-09-14 a run took `--target` as free text. The browser's allowed origins
 * and the shell guard read it; the specs a coder wrote, and the post-run gate that ran
 * them, read the registry's default environment instead. A run could look at one
 * deployment and test another, and an api-coder got no environment at all. Drawing
 * where each consumer took its target from is what showed it.
 *
 * One resolution now feeds every consumer: the browser's allowed origins, the shell
 * guard's hosts, and `TEST_ENV` for every spec run including the gate's.
 */

export interface RegisteredTarget {
  baseURL: string;
  /** Hosts the app's own config allows beyond its base URL — an auth provider, an API. */
  extraHosts: readonly string[];
}

export type TargetLookup = (app: string, environment: Environment) => RegisteredTarget | undefined;

export interface RunTarget {
  app: string;
  environment: Environment;
  baseURL: string;
  /** For the browser's `--allowed-origins`. Extra hosts are assumed to be https. */
  origins: string[];
  /** For the shell guard: the base URL's host, then the app's extra hosts. */
  hosts: string[];
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A target, or every reason there is none. Neither flag given is not a problem here —
 * whether a role needs a target is the definition of ready's question, not this one's.
 */
export function resolveRunTarget(
  request: { app?: string; env?: string },
  known: { apps: readonly string[]; lookup: TargetLookup },
): { target: RunTarget | null; problems: string[] } {
  if (request.app === undefined && request.env === undefined) return { target: null, problems: [] };

  const problems: string[] = [];
  if (request.app === undefined) {
    problems.push('--env without --app: name the registered app the environment belongs to');
  } else if (!known.apps.includes(request.app)) {
    problems.push(`unknown app "${request.app}" — registered: ${known.apps.join(', ')}`);
  }
  if (request.env === undefined) {
    problems.push('--app without --env: a run has no default environment');
  } else if (!isEnvironment(request.env)) {
    problems.push(`--env must be one of ${ENVIRONMENTS.join(', ')} — got "${request.env}"`);
  }
  if (problems.length > 0 || request.app === undefined || !isEnvironment(request.env)) {
    return { target: null, problems };
  }

  const registered = known.lookup(request.app, request.env);
  if (registered === undefined) {
    return {
      target: null,
      problems: [`${request.app} declares no ${request.env} environment in its app config`],
    };
  }
  const baseHost = hostOf(registered.baseURL);
  if (baseHost === null) {
    return {
      target: null,
      problems: [`${request.app}/${request.env} has a baseURL that is not a URL`],
    };
  }

  const extra = registered.extraHosts.map((host) => host.toLowerCase());
  return {
    target: {
      app: request.app,
      environment: request.env,
      baseURL: registered.baseURL,
      origins: [new URL(registered.baseURL).origin, ...extra.map((host) => `https://${host}`)],
      hosts: [...new Set([baseHost, ...extra])],
    },
    problems: [],
  };
}
