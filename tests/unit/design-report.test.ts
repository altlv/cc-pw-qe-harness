import { test, expect } from '@playwright/test';
import { auditReport, parseReport } from '../../src/qe/report.js';

/**
 * A design is the handoff from planner to coder. One that lists no cases hands a coder
 * nothing, and a coder handed nothing invents the design while it writes code — the
 * failure the planner role was split out to stop.
 */

const design = (cases: string): string => `---
report: test-design
target: apps/todo-fixture
date: 2026-09-14
author: test-planner
confidence: medium
evidence:
  direct: 0
  inferred: 0
  claimed: 0
findings: []
not_covered:
  - concurrency
${cases}---

Body.
`;

const errorsIn = (source: string): string[] => {
  const parsed = parseReport(source);
  if (!parsed.ok) return parsed.problems.map((problem) => problem.message);
  return auditReport(parsed.report)
    .filter((problem) => problem.level === 'error')
    .map((problem) => problem.message);
};

test.describe('a test design report', () => {
  test('should be refused when it lists no cases', () => {
    expect(
      errorsIn(design('')).join(' '),
      'a design with no cases reaches a coder as nothing to implement',
    ).toContain('lists no cases');
  });

  test('should be accepted with cases that carry id, level and technique', () => {
    const cases = [
      'cases:',
      '  - id: C1',
      '    level: api',
      '    technique: boundary values',
      '    summary: A title at the maximum length is stored whole.',
      '',
    ].join('\n');
    expect(errorsIn(design(cases)), 'a well-formed design must not be refused').toEqual([]);
  });

  test('should refuse a case with no level', () => {
    const cases = [
      'cases:',
      '  - id: C1',
      '    technique: boundary values',
      '    summary: A title at the maximum length is stored whole.',
      '',
    ].join('\n');
    expect(
      errorsIn(design(cases)).join(' '),
      'a case with no level cannot be pushed to the lowest level that catches it',
    ).toContain('level');
  });

  test('should not ask any other kind of report for cases', () => {
    const bug = design('').replace('report: test-design', 'report: bug');
    expect(errorsIn(bug), 'only a design hands cases to a coder').toEqual([]);
  });
});
