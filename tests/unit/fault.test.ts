import { test, expect } from '@playwright/test';
import {
  FAULT_ANNOTATION,
  corruptible,
  faultRequested,
  formatFaultVerdicts,
  judgeFaultRun,
  type FaultReport,
} from '../../src/qe/fault.js';

/**
 * The fault check is the only thing that can show an app spec would notice its server
 * failing. A judge that calls a green spec "caught" would be the toolbox's old false
 * claim again, with a command attached.
 */

const run = (
  tests: { title: string; status?: string; corrupted?: number; onTest?: boolean }[],
): FaultReport => ({
  suites: [
    {
      specs: tests.map((entry) => {
        const annotations =
          entry.corrupted === undefined
            ? []
            : [{ type: FAULT_ANNOTATION, description: String(entry.corrupted) }];
        return {
          title: entry.title,
          file: 'apps/example/tests/example.ui.spec.ts',
          tests: [
            {
              projectName: 'example',
              annotations: entry.onTest === true ? annotations : [],
              results: [
                { status: entry.status, annotations: entry.onTest === true ? [] : annotations },
              ],
            },
          ],
        };
      }),
    },
  ],
});

const outcomeOf = (report: FaultReport) => judgeFaultRun(report).map((verdict) => verdict.outcome);

test.describe('judging a fault run', () => {
  test('should call a spec that fails once its responses are corrupted caught', () => {
    expect(outcomeOf(run([{ title: 'a', status: 'failed', corrupted: 2 }]))).toEqual(['caught']);
  });

  test('should call a spec that passes over corrupted responses survived', () => {
    expect(
      outcomeOf(run([{ title: 'a', status: 'passed', corrupted: 3 }])),
      'green over a broken backend is exactly what this exists to find',
    ).toEqual(['survived']);
  });

  test('should not judge a spec whose page never called its server', () => {
    expect(
      outcomeOf(run([{ title: 'a', status: 'passed', corrupted: 0 }])),
      'a client-only feature has nothing to corrupt, and must not be blamed for it',
    ).toEqual(['untouched']);
  });

  test('should not credit the fault with a failure it did not cause', () => {
    expect(
      outcomeOf(run([{ title: 'a', status: 'failed', corrupted: 0 }])),
      'a spec failing with nothing corrupted is broken for another reason',
    ).toEqual(['inconclusive']);
  });

  test('should read the count from the test as well as the result', () => {
    expect(outcomeOf(run([{ title: 'a', status: 'passed', corrupted: 1, onTest: true }]))).toEqual([
      'survived',
    ]);
  });

  test('should treat a test with no result as skipped', () => {
    expect(outcomeOf(run([{ title: 'a', status: 'skipped' }]))).toEqual(['skipped']);
  });
});

test.describe('what a fault run reports', () => {
  test('should refuse a survivor and an inconclusive failure, and accept the rest', () => {
    const { problems } = formatFaultVerdicts(
      judgeFaultRun(
        run([
          { title: 'survivor', status: 'passed', corrupted: 2 },
          { title: 'broken', status: 'failed', corrupted: 0 },
          { title: 'good', status: 'failed', corrupted: 1 },
          { title: 'client-only', status: 'passed', corrupted: 0 },
        ]),
      ),
    );
    expect(problems.map((problem) => problem.split(':')[0])).toEqual(['survivor', 'broken']);
  });

  test('should refuse a run in which nothing was judged', () => {
    const { problems } = formatFaultVerdicts(
      judgeFaultRun(run([{ title: 'a', status: 'skipped' }])),
    );
    expect(problems.join(' '), 'a check that ran nothing must not read as a pass').toContain(
      'no test ran',
    );
  });
});

test.describe('what the fault touches', () => {
  test('should corrupt only calls to the server, never the page itself', () => {
    expect(['fetch', 'xhr'].map(corruptible)).toEqual([true, true]);
    expect(
      ['document', 'script', 'stylesheet', 'image'].map(corruptible),
      'a page that cannot load never reaches the assertions being judged',
    ).toEqual([false, false, false, false]);
  });

  test('should switch on only when asked for exactly', () => {
    expect(faultRequested({ HARNESS_FAULT: '1' })).toBe(true);
    expect(
      [faultRequested({ HARNESS_FAULT: '0' }), faultRequested({})],
      'an ordinary run must never corrupt its own traffic',
    ).toEqual([false, false]);
  });
});
