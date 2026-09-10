import { test, expect } from '@playwright/test';
import { auditReport, parseReport, type Report } from '../../src/qe/report.js';

function report(over: Partial<Report> = {}): Report {
  return {
    report: 'testability',
    target: 'apps/x',
    date: '2026-09-09',
    author: 'tester',
    confidence: 'high',
    evidence: { direct: 1, inferred: 0, claimed: 0 },
    findings: [
      {
        id: 'F1',
        severity: 'major',
        evidence: 'direct',
        summary: 'Something specific is wrong here.',
        basis: 'Internal consistency',
      },
    ],
    not_covered: ['mobile'],
    not_run: [],
    ...over,
  };
}

const VALID_DOC = `---
report: bug
target: apps/todo-fixture
date: 2026-09-09
author: investigator
confidence: medium
evidence:
  direct: 1
  inferred: 0
  claimed: 0
findings:
  - id: F1
    severity: major
    evidence: direct
    summary: The create endpoint returns 200 but does not persist.
    basis: Claims — the API documents 201 on create.
not_covered:
  - concurrency
not_run: []
---

Body goes here.
`;

test.describe('report parsing', () => {
  test('should parse a well-formed report and return its body', () => {
    const parsed = parseReport(VALID_DOC);
    expect(parsed.ok, 'a valid report failed to parse — the format is unusable').toBe(true);
    if (parsed.ok) {
      expect(parsed.report.report).toBe('bug');
      expect(parsed.body.trim()).toBe('Body goes here.');
    }
  });

  test('should reject a document with no frontmatter', () => {
    const parsed = parseReport('# Just markdown\n');
    expect(parsed.ok).toBe(false);
  });

  test('should reject an unknown report type', () => {
    const parsed = parseReport(VALID_DOC.replace('report: bug', 'report: horoscope'));
    expect(parsed.ok).toBe(false);
  });

  test('should reject a malformed date', () => {
    const parsed = parseReport(VALID_DOC.replace('2026-09-09', '9th Sept'));
    expect(parsed.ok).toBe(false);
  });

  test('should tolerate a UTF-8 BOM before the frontmatter', () => {
    expect(parseReport(`\uFEFF${VALID_DOC}`).ok).toBe(true);
  });
});

test.describe('report audit', () => {
  test('should accept an honest report', () => {
    expect(auditReport(report())).toEqual([]);
  });

  test('should reject a blocker that rests on inference', () => {
    const problems = auditReport(
      report({
        findings: [
          {
            id: 'F1',
            severity: 'blocker',
            evidence: 'inferred',
            summary: 'Probably breaks under load.',
            basis: 'reasoning',
          },
        ],
      }),
    );
    expect(problems.some((p) => p.level === 'error' && p.message.includes('blocker'))).toBe(true);
  });

  test('should reject claimed evidence on anything but a question', () => {
    const problems = auditReport(
      report({
        evidence: { direct: 0, inferred: 0, claimed: 1 },
        findings: [
          {
            id: 'F1',
            severity: 'major',
            evidence: 'claimed',
            summary: 'A developer said this is safe.',
            basis: 'hearsay',
          },
        ],
      }),
    );
    expect(problems.some((p) => p.level === 'error' && p.message.includes('claimed'))).toBe(true);
  });

  test('should allow claimed evidence when filed as a question', () => {
    const problems = auditReport(
      report({
        evidence: { direct: 0, inferred: 0, claimed: 1 },
        findings: [
          {
            id: 'F1',
            severity: 'question',
            evidence: 'claimed',
            summary: 'Unclear whether retries are idempotent.',
          },
        ],
      }),
    );
    expect(problems.filter((p) => p.level === 'error')).toEqual([]);
  });

  test('should reject a PASS verdict built on claimed evidence', () => {
    const problems = auditReport(
      report({
        verdict: 'PASS',
        evidence: { direct: 1, inferred: 0, claimed: 1 },
        findings: [
          {
            id: 'F1',
            severity: 'question',
            evidence: 'claimed',
            summary: 'Someone asserted this works.',
          },
        ],
      }),
    );
    expect(problems.some((p) => p.level === 'error' && p.message.includes('PASS'))).toBe(true);
  });

  test('should warn when not_covered is empty — that claims total coverage', () => {
    const problems = auditReport(report({ not_covered: [] }));
    expect(problems.some((p) => p.message.includes('not_covered'))).toBe(true);
  });

  test('should warn when a finding names no basis', () => {
    const problems = auditReport(
      report({
        findings: [
          { id: 'F1', severity: 'minor', evidence: 'direct', summary: 'Something is off here.' },
        ],
      }),
    );
    expect(problems.some((p) => p.message.includes('basis'))).toBe(true);
  });
});
