import { test, expect } from '@playwright/test';
import {
  countByProject,
  formatFacts,
  freshness,
  type FactsInput,
  type PlaywrightReport,
} from '../../src/qe/facts.js';

/**
 * The numbers PLAN.md quotes. A hand-typed snippet once read a stale results file and
 * reported 414 tests when 420 existed; these rules exist so that cannot happen quietly.
 */

const report = (tests: { projectName: string; status?: string }[]): PlaywrightReport => ({
  stats: { startTime: '2026-09-13T10:00:00.000Z' },
  suites: [{ specs: tests.map((t) => ({ tests: [t] })) }],
});

const fresh = { state: 'fresh', ranAt: 2 } as const;

const input = (over: Partial<FactsInput> = {}): FactsInput => ({
  local: {
    counts: countByProject(
      report([
        { projectName: 'unit', status: 'expected' },
        { projectName: 'harness', status: 'expected' },
      ]),
    ),
    freshness: fresh,
  },
  external: {
    counts: countByProject(report([{ projectName: 'fakerestapi', status: 'expected' }])),
    freshness: fresh,
  },
  mutation: { caught: 80, total: 80, freshness: fresh },
  ...over,
});

test.describe('counting a run', () => {
  test('should count tests per project and in total', () => {
    const counts = countByProject(
      report([
        { projectName: 'unit', status: 'expected' },
        { projectName: 'unit', status: 'expected' },
        { projectName: 'harness', status: 'expected' },
      ]),
    );
    expect(counts.byProject, 'each project must be counted separately').toEqual({
      unit: 2,
      harness: 1,
    });
    expect(counts.total).toBe(3);
  });

  test('should separate failing, flaky and skipped from passing', () => {
    const counts = countByProject(
      report([
        { projectName: 'unit', status: 'unexpected' },
        { projectName: 'unit', status: 'flaky' },
        { projectName: 'unit', status: 'skipped' },
        { projectName: 'unit', status: 'expected' },
      ]),
    );
    expect(
      [counts.failing, counts.flaky, counts.skipped],
      'a failing or skipped test quoted as passed is the exact kind of wrong number this exists to stop',
    ).toEqual([1, 1, 1]);
  });
});

test.describe('whether a run still describes the code', () => {
  test('should call a run stale when source changed after it started', () => {
    expect(
      freshness(100, 200).state,
      'results older than the code are the ones a hand-typed snippet quoted as current',
    ).toBe('stale');
  });

  test('should call a run fresh when nothing changed after it', () => {
    expect(freshness(200, 100).state, 'a current run must not be refused').toBe('fresh');
  });

  test('should compare at the millisecond precision a timestamp actually has', () => {
    // A mutation run recorded its end at .946 and its last restored file carried an
    // mtime of .9466; the run was refused as older than its own restore.
    expect(
      freshness(1000, 1000.6).state,
      'a change inside the same millisecond as the run cannot be shown to come after it',
    ).toBe('fresh');
    expect(freshness(1000, 1001.2).state, 'a change in a later millisecond is a real change').toBe(
      'stale',
    );
  });

  test('should call a run with no start time missing, not fresh', () => {
    expect(freshness(Number.NaN, 100).state, 'an unreadable timestamp proves nothing').toBe(
      'missing',
    );
  });
});

test.describe('what may be quoted', () => {
  test('should produce quotable lines and no problems when everything is current', () => {
    const { lines, problems } = formatFacts(input());
    expect(problems, 'a clean set of runs must not be refused').toEqual([]);
    expect(lines.join('\n')).toContain('**2 passed**');
    expect(lines.join('\n')).toContain('**80/80**');
  });

  test('should refuse stale local results', () => {
    const { problems } = formatFacts(
      input({
        local: {
          counts: countByProject(report([{ projectName: 'unit', status: 'expected' }])),
          freshness: { state: 'stale', ranAt: 1, newest: 2 },
        },
      }),
    );
    expect(problems.join(' '), 'stale results must never be quotable').toContain('npm test');
  });

  test('should refuse a local results file that is not an npm test run', () => {
    // The clobbering this caught: test:external used to write results.json, leaving
    // only external projects in the file the gate and this tool read.
    const { problems } = formatFacts(
      input({
        local: {
          counts: countByProject(report([{ projectName: 'fakerestapi', status: 'expected' }])),
          freshness: fresh,
        },
      }),
    );
    expect(
      problems.join(' '),
      'a results file with no unit project is somebody else’s run and must be refused',
    ).toContain('no unit project');
  });

  test('should refuse when tests are failing', () => {
    const { problems } = formatFacts(
      input({
        local: {
          counts: countByProject(report([{ projectName: 'unit', status: 'unexpected' }])),
          freshness: fresh,
        },
      }),
    );
    expect(problems.join(' '), 'a failing suite must not be quoted as green').toContain('failing');
  });

  test('should refuse a stale or missing mutation run', () => {
    const stale = formatFacts(
      input({
        mutation: { caught: 80, total: 80, freshness: { state: 'stale', ranAt: 1, newest: 2 } },
      }),
    );
    const missing = formatFacts(input({ mutation: null }));
    expect(stale.problems.join(' '), 'a mutation score from older code is not a score').toContain(
      'npm run mutate',
    );
    expect(missing.problems.join(' ')).toContain('npm run mutate');
  });

  test('should refuse when external results are missing', () => {
    const { problems } = formatFacts(input({ external: null }));
    expect(
      problems.join(' '),
      'the plan quotes the external count too, so it must have been run',
    ).toContain('test:external');
  });
});
