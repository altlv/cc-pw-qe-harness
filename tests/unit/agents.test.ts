import { test, expect } from '@playwright/test';
import { Budget } from '../../src/agents/budget.js';
import { extractJson, triageVerdictSchema } from '../../src/agents/triage.js';
import { auditTestability, type ScannedElement } from '../../src/tools/page-scanner.js';

test.describe('budget — the rabbit-hole guard', () => {
  test('should not be exceeded before anything is spent', () => {
    const budget = new Budget({ maxTurns: 5, maxUsd: 1, timeoutMs: 60_000 });
    expect(budget.exceeded()).toBeNull();
  });

  test('should stop the run at the turn limit', () => {
    const budget = new Budget({ maxTurns: 3, maxUsd: 1, timeoutMs: 60_000 });
    budget.record({ turns: 3 });
    expect(budget.exceeded()).toContain('turn limit');
  });

  test('should stop the run at the spend limit', () => {
    const budget = new Budget({ maxTurns: 100, maxUsd: 0.5, timeoutMs: 60_000 });
    budget.record({ costUsd: 0.5 });
    expect(budget.exceeded()).toContain('spend limit');
  });

  test('should stop the run on elapsed time', () => {
    const budget = new Budget({ maxTurns: 100, maxUsd: 100, timeoutMs: 0 });
    expect(budget.exceeded()).toContain('timeout');
  });

  test('should keep running while under every limit', () => {
    const budget = new Budget({ maxTurns: 10, maxUsd: 1, timeoutMs: 60_000 });
    budget.record({ turns: 9, costUsd: 0.99 });
    expect(budget.exceeded()).toBeNull();
  });

  test('should abort the underlying controller when told to stop', () => {
    const budget = new Budget();
    expect(budget.controller.signal.aborted).toBe(false);
    budget.abort('turn limit');
    expect(budget.controller.signal.aborted).toBe(true);
  });
});

test.describe('triage output parsing', () => {
  const valid = {
    classification: 'infrastructure',
    confidence: 'high',
    summary: 'The POST returned 403, so the session had expired.',
    evidence: ['POST /api/todos -> 403'],
    suggestedFix: 'Re-run auth setup.',
  };

  test('should read a bare JSON reply', () => {
    expect(extractJson(JSON.stringify(valid))).toMatchObject({ classification: 'infrastructure' });
  });

  test('should read a reply wrapped in a fenced code block', () => {
    const fenced = '```json\n' + JSON.stringify(valid) + '\n```';
    expect(extractJson(fenced)).toMatchObject({ classification: 'infrastructure' });
  });

  test('should read JSON surrounded by prose', () => {
    const chatty = `Here is my analysis:\n${JSON.stringify(valid)}\nHope that helps.`;
    expect(extractJson(chatty)).toMatchObject({ classification: 'infrastructure' });
  });

  test('should return null when there is no JSON at all', () => {
    expect(extractJson('I could not determine the cause.')).toBeNull();
  });

  test('should return null on malformed JSON rather than throwing', () => {
    expect(extractJson('{"classification": "infra"')).toBeNull();
  });

  test('should accept a verdict that carries evidence', () => {
    expect(triageVerdictSchema.safeParse(valid).success).toBe(true);
  });

  test('should reject a verdict with no evidence — no evidence, no verdict', () => {
    expect(triageVerdictSchema.safeParse({ ...valid, evidence: [] }).success).toBe(false);
  });

  test('should reject an invented classification', () => {
    expect(triageVerdictSchema.safeParse({ ...valid, classification: 'gremlins' }).success).toBe(
      false,
    );
  });
});

test.describe('testability grading', () => {
  function element(over: Partial<ScannedElement>): ScannedElement {
    return {
      tag: 'button',
      type: null,
      role: null,
      accessibleName: 'Save',
      testId: null,
      suggested: "getByRole('button', { name: 'Save' })",
      stability: 'text-dependent',
      ...over,
    };
  }

  test('should raise nothing for an element with a test id', () => {
    expect(auditTestability([element({ testId: 'save', stability: 'stable' })])).toEqual([]);
  });

  test('should raise a high-severity finding for an untargetable element', () => {
    const [issue] = auditTestability([element({ accessibleName: null, stability: 'fragile' })]);
    expect(issue?.severity).toBe('high');
  });

  test('should raise a medium finding for a text-dependent element', () => {
    const [issue] = auditTestability([element({})]);
    expect(issue?.severity).toBe('medium');
  });

  test('should name a concrete fix in every finding', () => {
    const issues = auditTestability([
      element({}),
      element({ accessibleName: null, stability: 'fragile' }),
    ]);
    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue.suggestion, 'a finding without a fix is noise').toContain('data-testid');
    }
  });
});
