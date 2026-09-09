import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Mutation testing for the harness's own logic.
 *
 * A green suite proves the tests ran, not that they check anything. Each mutation
 * below deliberately breaks a rule the harness claims to enforce; if the unit suite
 * still passes, that rule is not actually tested and the confidence it gives is
 * false.
 *
 * Deliberately a hand-written list rather than a generic mutation engine. Nine
 * targeted mutations against the rules that matter say more than a thousand random
 * operator flips, and this runs in under a minute.
 */
interface Mutation {
  file: string;
  find: string;
  replace: string;
  breaks: string;
}

const MUTATIONS: Mutation[] = [
  {
    file: 'src/qe/gate.ts',
    find: 'blockers.push(`${input.stats.unexpected} failing test(s)`);',
    replace: '// mutated: failing tests no longer block',
    breaks: 'Failing tests should block the release',
  },
  {
    file: 'src/qe/gate.ts',
    find: 'blockers.push(`${vacuous.length} test(s) with no assertion`);',
    replace: '// mutated: vacuous tests no longer block',
    breaks: 'A test that asserts nothing should block',
  },
  {
    file: 'src/qe/gate.ts',
    find: "blockers.length > 0 ? 'FAIL' : risks.length > 0 ? 'CONDITIONAL' : 'PASS'",
    replace: "'PASS'",
    breaks: 'The gate should not always say PASS',
  },
  {
    file: 'src/quality/assertions.ts',
    find: "kind: 'no-assertion',",
    replace: "kind: 'banned-wait',",
    breaks: 'A test with no assertion should be reported as such',
  },
  {
    file: 'src/qe/report.ts',
    find: "if (finding.severity === 'blocker' && finding.evidence !== 'direct') {",
    replace: 'if (false) {',
    breaks: 'A blocker must rest on direct evidence',
  },
  {
    file: 'src/qe/report.ts',
    find: "if (report.verdict === 'PASS' && claimed > 0) {",
    replace: 'if (false) {',
    breaks: 'A PASS verdict must not rest on claimed evidence',
  },
  {
    file: 'src/agents/budget.ts',
    find: 'if (this.turns >= this.limits.maxTurns) {',
    replace: 'if (false) {',
    breaks: 'The turn limit should stop an agent',
  },
  {
    file: 'src/agents/budget.ts',
    find: 'if (this.costUsd >= this.limits.maxUsd) {',
    replace: 'if (false) {',
    breaks: 'The spend limit should stop an agent',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "severity: 'high',",
    replace: "severity: 'medium',",
    breaks: 'An untargetable element should be a high-severity finding',
  },
];

async function unitSuitePasses(): Promise<boolean> {
  try {
    // npx needs its .cmd shim on Windows; avoids shell:true, which concatenates
    // rather than escapes arguments.
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    await run(npx, ['playwright', 'test', '--project=unit', '--reporter=dot'], {
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

console.log('Baseline: running the unit suite unmutated…');
if (!(await unitSuitePasses())) {
  console.error('The unit suite fails before any mutation. Fix that first.');
  process.exit(2);
}
console.log('Baseline green.\n');

let caught = 0;
const survivors: Mutation[] = [];

for (const mutation of MUTATIONS) {
  const original = await readFile(mutation.file, 'utf8');
  if (!original.includes(mutation.find)) {
    console.log(
      `SKIP    ${mutation.breaks}\n        (anchor no longer present in ${mutation.file})`,
    );
    continue;
  }

  await writeFile(mutation.file, original.replace(mutation.find, mutation.replace), 'utf8');
  const stillPasses = await unitSuitePasses();
  await writeFile(mutation.file, original, 'utf8');

  if (stillPasses) {
    survivors.push(mutation);
    console.log(`SURVIVED ${mutation.breaks}`);
  } else {
    caught += 1;
    console.log(`caught   ${mutation.breaks}`);
  }
}

const total = caught + survivors.length;
const score = total === 0 ? 0 : Math.round((caught / total) * 100);
console.log(`\nMutation score: ${caught}/${total} (${score}%)`);

if (survivors.length > 0) {
  console.log('\nSurvivors — these rules are not actually tested:');
  for (const s of survivors) console.log(`  - ${s.breaks}  (${s.file})`);
  console.log('\nA surviving mutation means the suite would stay green if that rule broke.');
}

process.exit(survivors.length > 0 ? 1 : 0);
