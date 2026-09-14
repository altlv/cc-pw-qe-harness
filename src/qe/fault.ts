/**
 * Proves an app spec would notice its server going wrong.
 *
 * `npm run mutate` breaks the harness's own rules and checks the harness suite
 * notices. It never touched an app spec, and the toolbox told every coder it proved
 * "the tests you just wrote can actually fail" — false for every spec under `apps/`.
 * This is the check that claim needed: run the spec again with every response from the
 * server corrupted, and require it to fail.
 *
 * Deliberately coarse. It does not mutate the app; it replaces what the server says
 * with a 500. A spec that still passes asserted nothing the server decides — it can be
 * green over a broken backend. A spec whose page made no server calls at all is not
 * judged, because there was nothing to corrupt.
 */

export const FAULT_ENV = 'HARNESS_FAULT';
export const FAULT_ANNOTATION = 'harness-fault';
export const FAULT_STATUS = 500;
export const FAULT_BODY = JSON.stringify({ error: 'fault injected by the harness' });

export function faultRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FAULT_ENV] === '1';
}

/**
 * Only the calls a page makes to its server. The document, scripts and styles still
 * load, so the page renders and the spec gets as far as asserting — which is the
 * point: a spec that errors on navigation proves nothing about its assertions.
 */
export function corruptible(resourceType: string): boolean {
  return resourceType === 'fetch' || resourceType === 'xhr';
}

export type FaultOutcome = 'caught' | 'survived' | 'untouched' | 'inconclusive' | 'skipped';

interface Annotation {
  type: string;
  description?: string;
}

interface FaultResult {
  status?: string;
  annotations?: Annotation[];
}

interface FaultTest {
  projectName: string;
  annotations?: Annotation[];
  results: FaultResult[];
}

interface FaultSpec {
  title: string;
  file: string;
  tests: FaultTest[];
}

interface FaultSuite {
  suites?: FaultSuite[];
  specs?: FaultSpec[];
}

export interface FaultReport {
  stats?: { startTime?: string };
  suites?: FaultSuite[];
}

export interface FaultVerdict {
  title: string;
  file: string;
  outcome: FaultOutcome;
  /** Responses the fault replaced during the last attempt. */
  corrupted: number;
}

function corruptedIn(test: FaultTest, result: FaultResult | undefined): number {
  const annotations = [...(result?.annotations ?? []), ...(test.annotations ?? [])];
  const found = annotations.find((annotation) => annotation.type === FAULT_ANNOTATION);
  const count = Number(found?.description ?? 0);
  return Number.isFinite(count) ? count : 0;
}

export function judgeFaultRun(report: FaultReport): FaultVerdict[] {
  const verdicts: FaultVerdict[] = [];
  const walk = (suite: FaultSuite): void => {
    for (const child of suite.suites ?? []) walk(child);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const result = test.results.at(-1);
        const corrupted = corruptedIn(test, result);
        const status = result?.status;
        let outcome: FaultOutcome;
        if (status === undefined || status === 'skipped') outcome = 'skipped';
        else if (status !== 'passed') outcome = corrupted > 0 ? 'caught' : 'inconclusive';
        else outcome = corrupted > 0 ? 'survived' : 'untouched';
        verdicts.push({ title: spec.title, file: spec.file, outcome, corrupted });
      }
    }
  };
  for (const suite of report.suites ?? []) walk(suite);
  return verdicts;
}

const EXPLAIN: Record<FaultOutcome, string> = {
  caught: 'failed once its server responses were corrupted',
  survived: 'PASSED with its server responses corrupted — it asserts nothing the server decides',
  untouched: 'made no server calls, so there was nothing to corrupt — not judged',
  inconclusive:
    'failed without a single corrupted response — it fails for another reason; fix that first',
  skipped: 'skipped',
};

export function formatFaultVerdicts(verdicts: FaultVerdict[]): {
  lines: string[];
  problems: string[];
} {
  const lines = verdicts.map(
    (verdict) =>
      `${verdict.outcome.padEnd(12)} ${verdict.title} (${verdict.file}, ${verdict.corrupted} corrupted) — ${EXPLAIN[verdict.outcome]}`,
  );
  const problems: string[] = [];
  const judged = verdicts.filter((verdict) => verdict.outcome !== 'skipped');
  if (judged.length === 0) {
    problems.push('no test ran under the fault, so nothing was checked');
  }
  for (const verdict of judged) {
    if (verdict.outcome === 'survived' || verdict.outcome === 'inconclusive') {
      problems.push(`${verdict.title}: ${EXPLAIN[verdict.outcome]}`);
    }
  }
  return { lines, problems };
}
