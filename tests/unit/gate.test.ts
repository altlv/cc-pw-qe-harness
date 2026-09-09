import { test, expect } from '@playwright/test';
import { assessGate, type GateInput } from '../../src/qe/gate.js';
import type { QualityFinding } from '../../src/quality/assertions.js';

function input(over: Partial<GateInput> = {}): GateInput {
  return {
    stats: { expected: 10, unexpected: 0, flaky: 0, skipped: 0 },
    failedTests: [],
    flakyTests: [],
    qualityFindings: [],
    ...over,
  };
}

function finding(kind: QualityFinding['kind']): { file: string; finding: QualityFinding } {
  return {
    file: 'apps/x/tests/a.spec.ts',
    finding: { kind, testName: 'a test', line: 1, detail: 'detail' },
  };
}

test.describe('release gate', () => {
  test('should PASS a clean run', () => {
    expect(assessGate(input()).verdict).toBe('PASS');
  });

  test('should FAIL when tests failed', () => {
    const verdict = assessGate(
      input({
        stats: { expected: 8, unexpected: 2, flaky: 0, skipped: 0 },
        failedTests: ['checkout works'],
      }),
    );
    expect(verdict.verdict).toBe('FAIL');
    expect(verdict.blockers.join(' ')).toContain('failing test');
  });

  test('should FAIL when a test asserts nothing — a suite that cannot fail is not evidence', () => {
    const verdict = assessGate(input({ qualityFindings: [finding('no-assertion')] }));
    expect(verdict.verdict).toBe('FAIL');
  });

  test('should be CONDITIONAL on flake rather than blocking', () => {
    const verdict = assessGate(
      input({
        stats: { expected: 10, unexpected: 0, flaky: 2, skipped: 0 },
        flakyTests: ['login'],
      }),
    );
    expect(verdict.verdict).toBe('CONDITIONAL');
    expect(verdict.blockers).toHaveLength(0);
    expect(verdict.risks.join(' ')).toContain('flaky');
  });

  test('should be CONDITIONAL on weak assertions and fragile selectors', () => {
    const verdict = assessGate(
      input({
        qualityFindings: [finding('navigation-only'), finding('unmarked-fragile-selector')],
      }),
    );
    expect(verdict.verdict).toBe('CONDITIONAL');
  });

  test('should FAIL when no tests ran at all', () => {
    const verdict = assessGate(
      input({ stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 } }),
    );
    expect(verdict.verdict).toBe('FAIL');
    expect(verdict.blockers.join(' ')).toContain('No tests ran');
  });

  test('should record skipped tests as a risk, not silently', () => {
    const verdict = assessGate(
      input({ stats: { expected: 9, unexpected: 0, flaky: 0, skipped: 1 } }),
    );
    expect(verdict.verdict).toBe('CONDITIONAL');
    expect(verdict.risks.join(' ')).toContain('skipped');
  });

  test('should attach evidence to every reason it gives', () => {
    const verdict = assessGate(
      input({
        stats: { expected: 8, unexpected: 2, flaky: 0, skipped: 0 },
        failedTests: ['x'],
      }),
    );
    expect(verdict.reasons.length).toBeGreaterThan(0);
    for (const reason of verdict.reasons) {
      expect(reason.evidence, `reason "${reason.detail}" has no evidence`).toBeDefined();
    }
  });
});
