import { z } from 'zod';

/**
 * Ported from the verdict schema in goose-harness (.ai/state/schemas/verdict.json).
 *
 * The three-way outcome is the point. A binary pass/fail forces a QA engineer to
 * either block a release over a known, accepted risk or to stay silent about it;
 * CONDITIONAL lets the risk be shipped *and* recorded.
 */
export const verdictSchema = z.object({
  verdict: z.enum(['PASS', 'CONDITIONAL', 'FAIL']),
  timestamp: z.string(),
  phase: z.string().optional(),
  reasons: z.array(
    z.object({
      category: z.enum([
        'correctness',
        'security',
        'performance',
        'accessibility',
        'testability',
        'maintainability',
        'requirements',
        'other',
      ]),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
      detail: z.string().min(10),
      /** Pointer to the artifact the reason rests on. A reason without one is an opinion. */
      evidence: z.string().optional(),
    }),
  ),
  /** Must be resolved before proceeding. Non-empty implies FAIL. */
  blockers: z.array(z.string()),
  /** Accepted and monitored. Non-empty with no blockers implies CONDITIONAL. */
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type Verdict = z.infer<typeof verdictSchema>;
export type VerdictReason = Verdict['reasons'][number];

export function formatVerdict(verdict: Verdict): string {
  const lines = [`${verdict.verdict}${verdict.phase ? ` — ${verdict.phase}` : ''}`, ''];

  if (verdict.blockers.length > 0) {
    lines.push('Blockers:');
    for (const blocker of verdict.blockers) lines.push(`  ✗ ${blocker}`);
    lines.push('');
  }
  if (verdict.risks.length > 0) {
    lines.push('Accepted risks:');
    for (const risk of verdict.risks) lines.push(`  ! ${risk}`);
    lines.push('');
  }
  if (verdict.reasons.length > 0) {
    lines.push('Reasons:');
    for (const reason of verdict.reasons) {
      lines.push(`  [${reason.severity}/${reason.category}] ${reason.detail}`);
      if (reason.evidence !== undefined) lines.push(`      evidence: ${reason.evidence}`);
    }
    lines.push('');
  }
  if (verdict.recommendations.length > 0) {
    lines.push('Recommendations:');
    for (const item of verdict.recommendations) lines.push(`  - ${item}`);
  }

  return lines.join('\n').trimEnd();
}
