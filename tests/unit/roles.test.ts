import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { roles } from '../../src/agents/roles.js';

/**
 * These roles have never been executed against the API. That is recorded honestly in
 * .ai/state/HANDOFF.md and must not be claimed otherwise.
 *
 * What can be verified without a live run is the contract: that every role says when
 * NOT to use it, that the skills it tells an agent to load actually exist, that it is
 * bounded, and that it is required to hand back a checkable report. Those are the
 * properties that make the difference between a role and a paragraph.
 */

const entries = Object.entries(roles);

test.describe('agent role contracts', () => {
  test('should define a role for every test level plus investigation', () => {
    expect(Object.keys(roles).sort()).toEqual(
      [
        'api-coder',
        'e2e-coder',
        'exploratory-tester',
        'integration-tester',
        'investigator',
        'testability-reviewer',
        'unit-test-engineer',
      ].sort(),
    );
  });

  for (const [name, role] of entries) {
    test.describe(name, () => {
      test('should say when NOT to use it — that is what makes selection reliable', () => {
        expect(
          // Deliberately strict. A looser regex including "rather than" passed a
          // mutation that stripped the negative scope entirely — "rather than" occurs
          // in ordinary prose, so it asserted nothing.
          /\bnot for\b/i.test(role.description),
          `"${name}" must say what it is NOT for, in those words — vague scoping is
how the wrong agent gets selected`,
        ).toBe(true);
      });

      test('should be bounded by a turn limit', () => {
        expect(
          role.maxTurns,
          `"${name}" has no maxTurns — an agent that cannot solve a
problem keeps trying`,
        ).toBeDefined();
        expect(role.maxTurns ?? 0).toBeGreaterThan(0);
        expect(role.maxTurns ?? 0).toBeLessThanOrEqual(40);
      });

      test('should carry the guardrails', () => {
        expect(
          role.prompt,
          `"${name}" lost the guardrails — an unguarded agent can claim a check ran when it did not`,
        ).toContain('Evidence beats memory');
        expect(role.prompt).toContain('did not execute is not evidence');
      });

      test('should require a checkable report as its output', () => {
        expect(role.prompt).toContain('docs/report-format.md');
        expect(role.prompt, 'a role must verify its own output, not just produce it').toContain(
          'check-report',
        );
      });

      test('should point only at skills that exist', () => {
        const referenced = [...role.prompt.matchAll(/\.claude\/skills\/[\w/-]+\.md/g)].map(
          (m) => m[0],
        );
        expect(
          referenced.length,
          `"${name}" loads no skills — roles and skills are
then two disconnected halves`,
        ).toBeGreaterThan(0);
        for (const path of referenced) {
          expect(
            existsSync(path),
            `"${name}" tells an agent to load ${path}, which does not exist`,
          ).toBe(true);
        }
      });

      test('should restrict its tools', () => {
        expect(role.tools, `"${name}" inherits every tool`).toBeDefined();
        expect((role.tools ?? []).length).toBeGreaterThan(0);
      });
    });
  }

  test('read-only roles should not be able to write product code', () => {
    for (const name of ['investigator', 'testability-reviewer']) {
      const role = roles[name];
      expect(role, `${name} missing`).toBeDefined();
      expect(
        role?.tools ?? [],
        `"${name}" reviews or investigates — it must not hold Edit`,
      ).not.toContain('Edit');
    }
  });

  test('every level named in the shared contract should have a role', () => {
    const contract = roles['unit-test-engineer']?.prompt ?? '';
    for (const level of ['unit', 'integration', 'api', 'e2e', 'exploratory']) {
      expect(contract, `the shared level table omits ${level}`).toContain(level);
    }
  });
});
