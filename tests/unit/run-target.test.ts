import { test, expect } from '@playwright/test';
import { resolveRunTarget, type TargetLookup } from '../../src/qe/run-target.js';

/**
 * A run's target had two sources: free text for the browser and guard, the registry's
 * default for the specs and the gate. One resolution must now feed all of them, and
 * refuse anything it cannot resolve rather than guess.
 */

const registry: Record<string, Record<string, { baseURL: string; extraHosts: string[] }>> = {
  'todo-fixture': { local: { baseURL: 'http://127.0.0.1:4173', extraHosts: [] } },
  shop: {
    test: { baseURL: 'https://test.shop.example', extraHosts: ['Auth.Example.com'] },
    prod: { baseURL: 'https://shop.example', extraHosts: [] },
  },
};

const lookup: TargetLookup = (app, environment) => registry[app]?.[environment];
const known = { apps: Object.keys(registry), lookup };

test.describe('resolving a run target', () => {
  test('should resolve the app’s own URL for the named environment', () => {
    const { target, problems } = resolveRunTarget({ app: 'shop', env: 'test' }, known);
    expect(problems).toEqual([]);
    expect(target?.baseURL, 'the specs, the browser and the guard must all read this one URL').toBe(
      'https://test.shop.example',
    );
  });

  test('should allow the app’s extra hosts, and only those', () => {
    const { target } = resolveRunTarget({ app: 'shop', env: 'test' }, known);
    expect(target?.hosts, 'hosts are compared lowercased').toEqual([
      'test.shop.example',
      'auth.example.com',
    ]);
    expect(target?.origins).toEqual(['https://test.shop.example', 'https://auth.example.com']);
  });

  test('should refuse an environment the app does not declare', () => {
    const { target, problems } = resolveRunTarget({ app: 'todo-fixture', env: 'prod' }, known);
    expect(target).toBeNull();
    expect(
      problems.join(' '),
      'guessing a deployment is how a run tests somewhere it was not meant to',
    ).toContain('declares no prod environment');
  });

  test('should refuse an unknown app, and a missing half', () => {
    expect(resolveRunTarget({ app: 'nope', env: 'local' }, known).problems.join(' ')).toContain(
      'unknown app',
    );
    expect(
      resolveRunTarget({ app: 'shop' }, known).problems.join(' '),
      'a run has no default environment',
    ).toContain('--app without --env');
    expect(resolveRunTarget({ env: 'test' }, known).problems.join(' ')).toContain(
      '--env without --app',
    );
  });

  test('should refuse an environment name that is not one', () => {
    expect(resolveRunTarget({ app: 'shop', env: 'staging' }, known).problems.join(' ')).toContain(
      '--env must be one of',
    );
  });

  test('should leave a run that names neither to the readiness check', () => {
    expect(resolveRunTarget({}, known)).toEqual({ target: null, problems: [] });
  });
});
