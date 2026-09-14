/**
 * The numbers `PLAN.md` quotes, read from the runs that produced them.
 *
 * Written after a hand-typed counting snippet read an old `results.json` and reported
 * 414 tests when 420 existed: `--reporter=json` on the command line had replaced the
 * configured reporters, so the run wrote nothing and the file was the previous run's.
 * The release gate already refused stale results; the snippet did not ask. So the
 * numbers come from a tool that refuses too, and nobody types a count again.
 */

export interface ReportTest {
  projectName: string;
  /** Playwright's own verdict: expected, unexpected, flaky or skipped. */
  status?: string;
}

export interface ReportSuite {
  suites?: ReportSuite[];
  specs?: { tests: ReportTest[] }[];
}

export interface PlaywrightReport {
  stats?: { startTime?: string };
  suites?: ReportSuite[];
}

export interface ProjectCounts {
  byProject: Record<string, number>;
  total: number;
  failing: number;
  flaky: number;
  skipped: number;
}

export function countByProject(report: PlaywrightReport): ProjectCounts {
  const counts: ProjectCounts = { byProject: {}, total: 0, failing: 0, flaky: 0, skipped: 0 };
  const walk = (suite: ReportSuite): void => {
    for (const child of suite.suites ?? []) walk(child);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        counts.byProject[test.projectName] = (counts.byProject[test.projectName] ?? 0) + 1;
        counts.total += 1;
        if (test.status === 'unexpected') counts.failing += 1;
        if (test.status === 'flaky') counts.flaky += 1;
        if (test.status === 'skipped') counts.skipped += 1;
      }
    }
  };
  for (const suite of report.suites ?? []) walk(suite);
  return counts;
}

export type Freshness =
  | { state: 'missing' }
  | { state: 'stale'; ranAt: number; newest: number }
  | { state: 'fresh'; ranAt: number };

/**
 * Whether something that ran at `ranAt` still describes code last changed at `newestSource`.
 *
 * Compared at millisecond precision, because that is all an ISO timestamp carries.
 * File mtimes are sub-millisecond: the first full mutation run recorded its end at
 * .946 and the last file it restored had an mtime of .9466, so a run was refused as
 * older than a change it had made itself.
 */
export function freshness(ranAt: number | undefined, newestSource: number): Freshness {
  if (ranAt === undefined || Number.isNaN(ranAt)) return { state: 'missing' };
  if (Math.floor(newestSource) > ranAt) {
    return { state: 'stale', ranAt, newest: newestSource };
  }
  return { state: 'fresh', ranAt };
}

export interface RunFacts {
  counts: ProjectCounts;
  freshness: Freshness;
}

export interface FactsInput {
  local: RunFacts | null;
  external: RunFacts | null;
  mutation: { caught: number; total: number; freshness: Freshness } | null;
}

function breakdown(counts: ProjectCounts): string {
  return Object.entries(counts.byProject)
    .map(([project, count]) => `${project} ${count}`)
    .join(', ');
}

function caveats(counts: ProjectCounts): string {
  const notes = [
    counts.failing > 0 ? `${counts.failing} failing` : '',
    counts.flaky > 0 ? `${counts.flaky} flaky` : '',
    counts.skipped > 0 ? `${counts.skipped} skipped` : '',
  ].filter(Boolean);
  return notes.length > 0 ? ` (${notes.join(', ')})` : '';
}

/**
 * The lines to quote, and every reason they must not be quoted yet.
 *
 * A number with a problem is still printed, marked, because hiding it would make the
 * refusal harder to act on. The caller exits non-zero whenever `problems` is not empty.
 */
export function formatFacts(input: FactsInput): { lines: string[]; problems: string[] } {
  const lines: string[] = [];
  const problems: string[] = [];

  const { local, external, mutation } = input;
  if (local === null) {
    problems.push('no local results at artifacts/results.json — run `npm test`');
  } else {
    const passed = local.counts.total - local.counts.failing - local.counts.skipped;
    lines.push(
      `- \`npm test\` **${passed} passed** — ${breakdown(local.counts)}${caveats(local.counts)}`,
    );
    if (local.freshness.state !== 'fresh') {
      problems.push('local results predate the code — run `npm test` again');
    }
    if (local.counts.byProject.unit === undefined) {
      problems.push(
        'artifacts/results.json has no unit project, so it is not an `npm test` run — ' +
          'before external runs had their own file, `npm run test:external` overwrote it',
      );
    }
    if (local.counts.failing > 0) problems.push(`${local.counts.failing} local test(s) failing`);
  }

  if (external === null) {
    problems.push('no external results — run `npm run test:external`');
  } else {
    const passed = external.counts.total - external.counts.failing - external.counts.skipped;
    lines.push(
      `- \`npm run test:external\` **${passed} passed** — ${breakdown(external.counts)}` +
        caveats(external.counts),
    );
    if (external.freshness.state !== 'fresh') {
      problems.push('external results predate the code — run `npm run test:external` again');
    }
  }

  if (mutation === null) {
    problems.push('no full mutation run recorded — run `npm run mutate` with no arguments');
  } else {
    lines.push(`- \`npm run mutate\` **${mutation.caught}/${mutation.total}**`);
    if (mutation.freshness.state !== 'fresh') {
      problems.push('the mutation run predates the code — run `npm run mutate` again');
    }
    if (mutation.caught < mutation.total) {
      problems.push(`${mutation.total - mutation.caught} mutation(s) survived`);
    }
  }

  return { lines, problems };
}
