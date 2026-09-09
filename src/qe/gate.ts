import type { QualityFinding } from '../quality/assertions.js';
import type { Verdict, VerdictReason } from './verdict.js';

export interface RunStats {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
}

export interface GateInput {
  stats: RunStats;
  failedTests: string[];
  flakyTests: string[];
  qualityFindings: { file: string; finding: QualityFinding }[];
  phase?: string;
}

/**
 * Turns run evidence into an explicit release decision.
 *
 * The judgement encoded here: a failing test and a test that asserts nothing are
 * both blockers, because both mean the suite is not telling the truth about the
 * product. Flake and weak-but-present coverage are risks — real, worth recording,
 * not worth blocking a release over on their own.
 */
export function assessGate(input: GateInput): Verdict {
  const reasons: VerdictReason[] = [];
  const blockers: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  if (input.stats.unexpected > 0) {
    blockers.push(`${input.stats.unexpected} failing test(s)`);
    reasons.push({
      category: 'correctness',
      severity: 'critical',
      detail: `Test run has ${input.stats.unexpected} failure(s): ${input.failedTests.slice(0, 5).join('; ')}`,
      evidence: 'artifacts/results.json',
    });
  }

  const vacuous = input.qualityFindings.filter((f) => f.finding.kind === 'no-assertion');
  if (vacuous.length > 0) {
    blockers.push(`${vacuous.length} test(s) with no assertion`);
    reasons.push({
      category: 'testability',
      severity: 'high',
      detail:
        `${vacuous.length} test(s) contain no assertion and cannot fail on a regression: ` +
        vacuous
          .slice(0, 5)
          .map((f) => `${f.finding.testName}`)
          .join('; '),
      evidence: 'npm run assert-quality',
    });
  }

  if (input.stats.flaky > 0) {
    risks.push(`${input.stats.flaky} flaky test(s) passed only on retry`);
    reasons.push({
      category: 'correctness',
      severity: 'medium',
      detail: `Flaky on this run: ${input.flakyTests.slice(0, 5).join('; ')}. A test that needs a retry is not yet evidence.`,
      evidence: 'artifacts/results.json',
    });
    recommendations.push('Investigate flaky tests before they are normalised as noise.');
  }

  const weak = input.qualityFindings.filter(
    (f) => f.finding.kind === 'navigation-only' || f.finding.kind === 'unmarked-fragile-selector',
  );
  if (weak.length > 0) {
    risks.push(`${weak.length} test(s) with weak assertions or fragile selectors`);
    reasons.push({
      category: 'maintainability',
      severity: 'low',
      detail: `${weak.length} test(s) either prove only that a page loads, or depend on position/class selectors that will rot.`,
      evidence: 'npm run assert-quality',
    });
  }

  if (input.stats.skipped > 0) {
    risks.push(`${input.stats.skipped} skipped test(s)`);
    recommendations.push('Confirm skipped tests are intentional, not silently disabled coverage.');
  }

  if (input.stats.expected === 0 && input.stats.unexpected === 0) {
    blockers.push('No tests ran');
    reasons.push({
      category: 'requirements',
      severity: 'critical',
      detail: 'The run contained no executed tests, so it is not evidence of anything.',
      evidence: 'artifacts/results.json',
    });
  }

  const verdict: Verdict['verdict'] =
    blockers.length > 0 ? 'FAIL' : risks.length > 0 ? 'CONDITIONAL' : 'PASS';

  return {
    verdict,
    timestamp: new Date().toISOString(),
    phase: input.phase,
    reasons,
    blockers,
    risks,
    recommendations,
  };
}
