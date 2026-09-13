import { test, expect } from '@playwright/test';
import {
  ALWAYS,
  uncataloguedSkills,
  CONSEQUENCES,
  commandsNamedIn,
  obligationsFor,
  pathsNamedIn,
  undocumentedCommands,
} from '../../src/qe/housekeeping.js';

/**
 * These rules used to live inside the CLI, where the only way to exercise one was to
 * damage the real repository. A mutation that disabled the undocumented-command rule
 * survived, because the only test asserted the README happened to be honest rather
 * than that the rule could fail on a bad input. These give it bad inputs.
 */

test.describe('what a document claims', () => {
  test('should find every command a document tells a reader to run', () => {
    const found = commandsNamedIn('Run `npm run gate`, then `npm run check-report -- x`.');
    expect(found, 'both commands must be found, including the one with arguments').toEqual([
      'gate',
      'check-report',
    ]);
  });

  test('should find repo paths and ignore prose that merely looks like one', () => {
    const found = pathsNamedIn('See `src/qe/gate.ts` and `apps/<app>/coverage.md` and `foo/bar`.');
    expect(
      found,
      'a placeholder and a path outside the known roots must both be left alone',
    ).toEqual(['src/qe/gate.ts']);
  });

  test('should not treat a glob as a path', () => {
    // `tests/unit/*.test.ts` describes a set, not a file that must exist.
    expect(pathsNamedIn('Specs live in `tests/unit/*.test.ts`.')).toEqual([]);
  });
});

test.describe('capability that nobody documented', () => {
  test('should report a command the README never mentions', () => {
    // The direction of drift the first version of this gate missed entirely, and which
    // it then demonstrated on itself: `precommit` was added and left undocumented.
    const found = undocumentedCommands(['gate', 'precommit'], 'Run `npm run gate`.', {});
    expect(
      found,
      'a command that exists and is never mentioned is a capability nobody can find',
    ).toEqual(['precommit']);
  });

  test('should stay silent when everything is documented', () => {
    // A gate that fires on a clean tree gets switched off within a week.
    expect(
      undocumentedCommands(['gate', 'scan'], 'Run `npm run gate` and `npm run scan`.', {}),
      'no finding is correct here, and a false one would make the whole command noise',
    ).toEqual([]);
  });

  test('should accept a command declared internal with a reason', () => {
    // The escape hatch that keeps this from demanding a README entry for `typecheck`.
    expect(
      undocumentedCommands(['typecheck'], 'nothing here', { typecheck: 'composed by check' }),
      'an explicitly internal command must not be reported',
    ).toEqual([]);
  });

  test('should never demand documentation for the bare test command', () => {
    expect(undocumentedCommands(['test'], 'nothing here', {})).toEqual([]);
  });
});

test.describe('a skill nobody can find', () => {
  test('should report a skill the catalogue never lists', () => {
    // Twice in two messages: test-techniques and visual-inspection were written,
    // wired into roles, enforced against orphaning — and in neither README.
    expect(
      uncataloguedSkills(['oracle-check', 'visual-inspection'], 'see `oracle-check`'),
      'a skill absent from the catalogue is loadable but not findable',
    ).toEqual(['visual-inspection']);
  });

  test('should stay silent when the catalogue is complete', () => {
    expect(
      uncataloguedSkills(['oracle-check'], 'see [`oracle-check`](oracle-check/SKILL.md)'),
      'a linked entry counts as listed; firing here would make the gate noise',
    ).toEqual([]);
  });
});

test.describe('obligations derived from the diff', () => {
  test('should name the document a change implicates', () => {
    const obligations = obligationsFor(['package.json']);
    expect(
      obligations.join(' '),
      'changing package.json means a command or dependency changed, and the README lists both',
    ).toContain('README Commands table');
  });

  test('should stay quiet about areas the change did not touch', () => {
    const obligations = obligationsFor(['README.md']);
    expect(
      obligations.join(' '),
      'a README-only change must not lecture about roles — an irrelevant item is how a list stops being read',
    ).not.toContain('a role changed');
  });

  test('should always include what applies to any change at all', () => {
    for (const changed of [[], ['README.md'], ['src/qe/gate.ts']]) {
      expect(
        obligationsFor(changed),
        `the always-on items must survive a change set of ${JSON.stringify(changed)}`,
      ).toEqual(expect.arrayContaining(ALWAYS));
    }
  });

  test('should give every consequence a document to go and look at', () => {
    // An obligation that names no file is a feeling, not an instruction.
    for (const rule of CONSEQUENCES) {
      expect(
        rule.obligation,
        `"${String(rule.touches)}" produces an obligation that names no document`,
      ).toMatch(/README|PLAN\.md|HANDOFF\.md|docs\/|TOOLBOX|roles\.ts/);
    }
  });
});
