import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TOOLBOX } from '../../src/agents/common.js';
import { roles } from '../../src/agents/roles.js';

/**
 * The toolbox tells every agent which deterministic tools exist and when to reach for
 * one instead of spending a turn. That only works while the commands are real: a
 * prompt naming a command that no longer exists costs a failed turn and teaches the
 * agent that the list is unreliable, which is worse than not having one.
 */

interface PackageJson {
  scripts?: Record<string, string>;
}

function declaredScripts(): Set<string> {
  const parsed = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
  return new Set(Object.keys(parsed.scripts ?? {}));
}

/** Every `npm run <name>` the toolbox mentions. */
function namedCommands(text: string): string[] {
  return [...new Set([...text.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1] ?? ''))];
}

test.describe('the toolbox', () => {
  test('should name only commands package.json actually defines', () => {
    const scripts = declaredScripts();
    const named = namedCommands(TOOLBOX);
    expect(
      named.length,
      'the toolbox names no commands — the scan below asserts nothing',
    ).toBeGreaterThan(5);

    const missing = named.filter((command) => !scripts.has(command)).sort();
    expect(
      missing,
      `the toolbox tells agents to run: ${missing.join(', ')} — no such script. Rename
the entry or restore the script; an agent that hits one of these learns to ignore
the whole list`,
    ).toEqual([]);
  });

  test('should warn against the one command that never returns', () => {
    // test:watch opens Playwright's interactive UI. An agent that runs it hangs until
    // the wall-clock budget kills the run, and the run reports as a timeout rather
    // than as a mistake.
    expect(TOOLBOX, 'test:watch is interactive; an agent must be told not to run it').toContain(
      'test:watch',
    );
    expect(TOOLBOX).toMatch(/Never run .?npm run test:watch/);
  });

  test('should reach every role', () => {
    // The same failure as the orphaned skills, one layer up: capability that exists
    // and nothing reads. Three of eight roles mentioned a single tool before this.
    for (const [name, role] of Object.entries(roles)) {
      expect(
        role.prompt,
        `"${name}" was not given the toolbox, so it will reason its way to answers a script already has`,
      ).toContain('Deterministic tools.');
    }
  });

  test('should tell an agent to scan rather than ask a browser what is on a page', () => {
    // The measured saving, and the counter-intuitive half: the accessibility tree is
    // the expensive way to look, not the cheap one.
    expect(TOOLBOX, 'the cheapest inventory is the one no model has to read').toContain(
      'npm run scan',
    );
    expect(
      TOOLBOX,
      'without the screenshot-versus-tree guidance an agent will reach for the tree, which costs 3x on a real page',
    ).toMatch(/screenshot/i);
  });
});
