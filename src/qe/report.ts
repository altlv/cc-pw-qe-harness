import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/**
 * One report envelope for every QA skill.
 *
 * The source model this harness inherits from has 33 separate templates, one per
 * skill. That is fine for a person filling one in; it is a lot of surface for an
 * agent, and none of it is machine-readable. This is a single shape instead:
 * YAML frontmatter a script can read, a markdown body a human can read.
 *
 * The frontmatter is doing real work. `evidence` forces the Direct / Inferred /
 * Claimed distinction into the format, so an agent cannot report a conclusion
 * without saying how well it is supported. `not_covered` is required, so a gap
 * has to be declared rather than silently omitted.
 */

export const evidenceCountsSchema = z.object({
  /** Observed: a test result, a captured response, a file:line. */
  direct: z.number().int().min(0),
  /** Deduced, with the reasoning shown. Not a hunch. */
  inferred: z.number().int().min(0),
  /** Asserted but unverified. Never sufficient on its own. */
  claimed: z.number().int().min(0),
});

export const findingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['blocker', 'major', 'minor', 'question']),
  evidence: z.enum(['direct', 'inferred', 'claimed']),
  summary: z.string().min(10),
  /** File, URL, endpoint, or test name the finding attaches to. */
  where: z.string().optional(),
  /** Which oracle or check says this is wrong. Required for a defect claim. */
  basis: z.string().optional(),
});

export const reportSchema = z.object({
  report: z.enum([
    'test-design',
    'bug',
    'exploratory-session',
    'testability',
    'flake',
    'gate',
    'triage',
  ]),
  target: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  author: z.string().min(1),
  verdict: z.enum(['PASS', 'CONDITIONAL', 'FAIL', 'INFO']).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: evidenceCountsSchema,
  findings: z.array(findingSchema),
  /** What this report deliberately did not cover. Required — an empty list is a claim. */
  not_covered: z.array(z.string()),
  /** Checks that were expected but did not run. Silence about a skipped check reads as a pass. */
  not_run: z.array(z.string()).default([]),
});

export type Report = z.infer<typeof reportSchema>;
export type Finding = z.infer<typeof findingSchema>;

export interface ReportProblem {
  level: 'error' | 'warning';
  message: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseReport(
  source: string,
): { ok: true; report: Report; body: string } | { ok: false; problems: ReportProblem[] } {
  // A UTF-8 BOM before the frontmatter would stop the regex matching. Checked by
  // char code rather than a literal, which is invisible in an editor.
  const cleaned = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const match = FRONTMATTER.exec(cleaned);
  if (match === null) {
    return {
      ok: false,
      problems: [{ level: 'error', message: 'No YAML frontmatter block found.' }],
    };
  }

  let raw: unknown;
  try {
    raw = parseYaml(match[1] ?? '');
  } catch (error) {
    return {
      ok: false,
      problems: [{ level: 'error', message: `Frontmatter is not valid YAML: ${String(error)}` }],
    };
  }

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        level: 'error' as const,
        message: `${issue.path.join('.') || '(root)'}: ${issue.message}`,
      })),
    };
  }

  return { ok: true, report: parsed.data, body: match[2] ?? '' };
}

/**
 * Checks a valid report for the things a schema cannot express — mostly that the
 * evidence actually supports the conclusions drawn from it.
 */
export function auditReport(report: Report): ReportProblem[] {
  const problems: ReportProblem[] = [];
  const { direct, inferred, claimed } = report.evidence;
  const total = direct + inferred + claimed;

  if (total !== report.findings.length && report.findings.length > 0) {
    problems.push({
      level: 'warning',
      message: `evidence counts total ${total} but there are ${report.findings.length} findings — they should correspond.`,
    });
  }

  for (const finding of report.findings) {
    if (finding.severity === 'blocker' && finding.evidence !== 'direct') {
      problems.push({
        level: 'error',
        message: `${finding.id}: a blocker needs direct evidence, not "${finding.evidence}". Prove it or lower the severity.`,
      });
    }
    if (finding.evidence === 'claimed' && finding.severity !== 'question') {
      problems.push({
        level: 'error',
        message: `${finding.id}: claimed evidence is never sufficient for a finding. Verify it, or file it as a question.`,
      });
    }
    if (finding.severity !== 'question' && finding.basis === undefined) {
      problems.push({
        level: 'warning',
        message: `${finding.id}: no basis given. Name the oracle or check that says this is wrong.`,
      });
    }
  }

  if (report.not_covered.length === 0) {
    problems.push({
      level: 'warning',
      message: 'not_covered is empty — that claims complete coverage. State the scope limits.',
    });
  }

  if (report.verdict === 'PASS' && claimed > 0) {
    problems.push({
      level: 'error',
      message: 'A PASS verdict cannot rest on claimed evidence. Verify it or report CONDITIONAL.',
    });
  }

  if (total > 0 && direct === 0) {
    problems.push({
      level: 'warning',
      message: 'No direct evidence at all — this report is reasoning, not observation.',
    });
  }

  return problems;
}
