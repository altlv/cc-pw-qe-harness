import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  AUTHENTICATE,
  BROWSER_MCP_SERVER,
  FILL,
  INTERACT,
  NEVER,
  OBSERVE,
  RESET,
  UNCLASSIFIED,
  browserMcpConfig,
  browserToolsFor,
  qualify,
} from '../../src/qe/browser-tools.js';
import { policyFor } from '../../src/qe/exploration-policy.js';
import { BROWSER_ACCESS, roles } from '../../src/agents/roles.js';

/**
 * This is a safety boundary, not a convenience. It decides what an agent can do to a
 * running system, so the tests are about what it must REFUSE at least as much as what
 * it grants.
 */

const TIERS = { OBSERVE, INTERACT, FILL, AUTHENTICATE, RESET };

test.describe('the policy binds what an agent may do', () => {
  test('should let production be looked at and not touched', () => {
    const granted = browserToolsFor(policyFor('prod'));
    expect(granted, 'a session that cannot look at production cannot test it either').toContain(
      qualify('browser_take_screenshot'),
    );
    for (const forbidden of ['browser_click', 'browser_type', 'browser_fill_form']) {
      expect(
        granted,
        `production granted ${forbidden} — the preset says allowWrites and allowFormSubmit are false`,
      ).not.toContain(qualify(forbidden));
    }
  });

  test('should grant nothing beyond observation when every flag is false', () => {
    const locked = policyFor('local', {
      allowWrites: false,
      allowFormSubmit: false,
      allowDestructive: false,
      allowAuthentication: false,
    });
    expect(
      browserToolsFor(locked).sort(),
      'with every flag off the grant must be exactly the observation tier',
    ).toEqual(OBSERVE.map(qualify).sort());
  });

  test('should add a tier only when the flag that names it is set', () => {
    const base = policyFor('prod', {
      allowWrites: false,
      allowFormSubmit: false,
      allowDestructive: false,
      allowAuthentication: false,
    });
    const cases: [keyof typeof TIERS, Record<string, boolean>][] = [
      ['INTERACT', { allowWrites: true }],
      ['FILL', { allowFormSubmit: true }],
      ['AUTHENTICATE', { allowAuthentication: true }],
      ['RESET', { allowDestructive: true }],
    ];
    for (const [tier, flag] of cases) {
      const granted = browserToolsFor({ ...base, ...flag });
      for (const tool of TIERS[tier]) {
        expect(granted, `${Object.keys(flag)[0]} did not grant ${tool}`).toContain(qualify(tool));
      }
    }
  });

  test('should never grant a tool that can run arbitrary code', () => {
    // The load-bearing test. An allowlist is only a bound if nothing inside it can
    // reach past the tiers — one browser_evaluate does everything browser_fill_form
    // and browser_click are gated for.
    const everything = policyFor('local', {
      allowWrites: true,
      allowFormSubmit: true,
      allowDestructive: true,
      allowAuthentication: true,
    });
    const granted = browserToolsFor(everything);
    for (const tool of ['browser_evaluate', 'browser_run_code_unsafe']) {
      expect(
        granted,
        `${tool} was granted — it reaches every capability the other tiers gate, which voids the allowlist entirely`,
      ).not.toContain(qualify(tool));
    }
  });

  test('should never grant a tool that reads browser auth state', () => {
    // Non-negotiable #6: check a credential exists, never read its value.
    const everything = policyFor('local', {
      allowWrites: true,
      allowFormSubmit: true,
      allowDestructive: true,
      allowAuthentication: true,
    });
    const granted = browserToolsFor(everything);
    for (const tool of [
      'browser_storage_state',
      'browser_cookie_get',
      'browser_localstorage_get',
    ]) {
      expect(granted, `${tool} reads credentials back out of the browser`).not.toContain(
        qualify(tool),
      );
    }
  });

  test('should replay a captured session without granting a way to read one out', () => {
    // The asymmetry is the point: set_storage_state is how an agent reaches a logged-in
    // app without touching a password; storage_state is how it would exfiltrate one.
    const granted = browserToolsFor(policyFor('local', { allowAuthentication: true }));
    expect(
      granted,
      'without set_storage_state the authenticated half of every app stays dark, since an agent never types a password',
    ).toContain(qualify('browser_set_storage_state'));
    expect(
      granted,
      'storage_state reads the session back out — granting it alongside would hand an agent the credentials it was kept away from',
    ).not.toContain(qualify('browser_storage_state'));
  });

  test('should qualify every tool for the SDK, never leaving a bare name', () => {
    // A bare "browser_click" in allowedTools matches nothing and silently grants
    // nothing — the failure would look like a model refusing to act.
    for (const tool of browserToolsFor(policyFor('local'))) {
      expect(tool, `${tool} is not namespaced to the MCP server`).toMatch(
        new RegExp(`^mcp__${BROWSER_MCP_SERVER}__browser_`),
      );
    }
  });
});

test.describe('the role ceiling binds independently of the environment', () => {
  test('should keep an observe-only role read-only on the most permissive environment', () => {
    // The reason testability-reviewer must not submit a form is its job, not the
    // blast radius. A disposable local fixture is no argument for widening it.
    const granted = browserToolsFor(policyFor('local'), 'observe');
    expect(
      granted.sort(),
      'local grants every tier, so without a role ceiling an auditor holds browser_fill_form',
    ).toEqual(OBSERVE.map(qualify).sort());
  });

  test('should give a full-access role what the environment permits, and no more', () => {
    const onLocal = browserToolsFor(policyFor('local'), 'full');
    const onProd = browserToolsFor(policyFor('prod'), 'full');
    expect(onLocal, 'a full role on a disposable fixture should be able to click').toContain(
      qualify('browser_click'),
    );
    expect(
      onProd,
      'the role ceiling must not lift a production restriction — the grant is an intersection',
    ).not.toContain(qualify('browser_click'));
  });

  test('should default to full, so a forgotten argument cannot silently widen a grant', () => {
    // Defaulting to 'observe' would be safer per call and worse overall: a role that
    // quietly loses its hands looks like a model refusing to work.
    expect(
      browserToolsFor(policyFor('local')),
      'the default must match what the explicit full ceiling gives',
    ).toEqual(browserToolsFor(policyFor('local'), 'full'));
  });

  test('should give every browser role a declared ceiling and nobody else one', () => {
    for (const [name, access] of Object.entries(BROWSER_ACCESS)) {
      expect(roles[name], `BROWSER_ACCESS names "${name}", which is not a role`).toBeDefined();
      expect(['observe', 'full'], `"${name}" has an unknown ceiling`).toContain(access);
    }
    // api-coder reaches a service through the API fixture and unit-coder never touches
    // a browser. A ceiling for them would imply they get one.
    for (const name of ['unit-coder', 'integration-coder', 'api-coder', 'test-planner']) {
      expect(
        BROWSER_ACCESS[name],
        `"${name}" was given browser access — it has no reason to look at a rendered page`,
      ).toBeUndefined();
    }
  });
});

test.describe('the browser config binds where it may go', () => {
  test('should confine the browser to the origin when the policy says to', () => {
    const { args } = browserMcpConfig(policyFor('prod'), 'https://example.com');
    expect(
      args.join(' '),
      'stayOnOrigin had no teeth until this — a permitted browser_navigate can point anywhere',
    ).toContain('--allowed-origins https://example.com');
  });

  test('should not confine it when the policy allows leaving', () => {
    const { args } = browserMcpConfig(
      policyFor('local', { stayOnOrigin: false }),
      'http://127.0.0.1:4173',
    );
    expect(args, 'a policy that permits leaving must not pin the origin').not.toContain(
      '--allowed-origins',
    );
  });

  test('should isolate the profile so one session is not the next one’s starting state', () => {
    expect(
      browserMcpConfig(policyFor('local'), 'http://127.0.0.1:4173').args,
      'a shared profile makes a run unreproducible',
    ).toContain('--isolated');
  });

  test('should default to attaching a full accessibility tree, and allow turning it off', () => {
    // Playwright MCP's own default, restated explicitly so the flag is visible in the
    // spawn arguments rather than implied by its absence.
    const on = browserMcpConfig(policyFor('local'), 'http://127.0.0.1:4173');
    expect(on.args.join(' '), 'the default must be stated, not inherited silently').toContain(
      '--snapshot-mode full',
    );
    const off = browserMcpConfig(policyFor('local'), 'http://127.0.0.1:4173', 'out', 'none');
    expect(
      off.args.join(' '),
      'a session that only looks should be able to stop paying for a tree it never reads',
    ).toContain('--snapshot-mode none');
  });

  test('should point at a real CLI, resolved from this module rather than the cwd', () => {
    // The same failure as src/env.ts had: a relative path here works only while the
    // command happens to be run from the repo root.
    const { command, args } = browserMcpConfig(policyFor('local'), 'http://127.0.0.1:4173');
    expect(command, 'the server is spawned with node, not a shell').toBe(process.execPath);
    const cli = args[0] ?? '';
    expect(isAbsolute(cli), `${cli} is not absolute`).toBe(true);
    expect(existsSync(cli), `${cli} does not exist — the MCP server would fail to spawn`).toBe(
      true,
    );
  });
});

test.describe('classification keeps up with the package', () => {
  /**
   * Tool names as shipped. Scanned from the installed package rather than hardcoded,
   * so a new release is caught rather than assumed — the whole reason this is an
   * allowlist is that Playwright MCP grows.
   */
  function shippedTools(): string[] {
    const found = new Set<string>();
    // Nested node_modules are walked deliberately: @playwright/mcp is a thin wrapper
    // and every tool name lives in the playwright-core it bundles. Skipping them, as
    // a directory walk normally would, found nothing and would have passed this test
    // vacuously — which is what the length assertion below now prevents.
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(js|mjs|cjs|ts)$/.test(entry.name)) {
          for (const match of readFileSync(full, 'utf8').matchAll(/['"](browser_[a-z_]+)['"]/g)) {
            found.add(match[1] ?? '');
          }
        }
      }
    };
    walk(join('node_modules', '@playwright', 'mcp'));
    return [...found].sort();
  }

  test('should have sorted every tool the installed package ships', () => {
    const shipped = shippedTools();
    expect(
      shipped.length,
      'no tool names found — the scan broke, and a broken scan would pass this test silently',
    ).toBeGreaterThan(50);

    const known = new Set([
      ...OBSERVE,
      ...INTERACT,
      ...FILL,
      ...AUTHENTICATE,
      ...RESET,
      ...Object.keys(NEVER),
      ...Object.keys(UNCLASSIFIED),
    ]);
    const unsorted = shipped.filter((tool) => !known.has(tool)).sort();
    expect(
      unsorted,
      `Playwright MCP ships tools this repo has not classified: ${unsorted.join(', ')}.
Put each in a tier, in NEVER with a reason, or in UNCLASSIFIED with a reason. An
unclassified tool is refused, so nothing is unsafe — but the decision should be made
rather than defaulted into.`,
    ).toEqual([]);
  });

  test('should not classify a tool in two places at once', () => {
    // A tool in both OBSERVE and NEVER would be granted, and the NEVER entry would
    // read like a guarantee that is not being kept.
    const seen = new Map<string, string[]>();
    const record = (name: string, where: string): void => {
      seen.set(name, [...(seen.get(name) ?? []), where]);
    };
    for (const [where, list] of Object.entries(TIERS)) for (const t of list) record(t, where);
    for (const t of Object.keys(NEVER)) record(t, 'NEVER');
    for (const t of Object.keys(UNCLASSIFIED)) record(t, 'UNCLASSIFIED');

    const duplicated = [...seen.entries()]
      .filter(([, places]) => places.length > 1)
      .map(([name, places]) => `${name} in ${places.join(' and ')}`);
    expect(duplicated, 'a tool classified twice is a tool whose refusal is not real').toEqual([]);
  });

  test('should give a reason for every refusal', () => {
    // "Denied" with no reason gets reversed by the next person who wants the tool.
    for (const [tool, reason] of [...Object.entries(NEVER), ...Object.entries(UNCLASSIFIED)]) {
      expect(reason.length, `${tool} is refused with no reason given`).toBeGreaterThan(15);
    }
  });
});
