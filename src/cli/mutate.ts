import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const PROJECTS = ['--project=unit', '--project=integration'];

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
    file: 'src/cli/check-report.ts',
    find: '  if (explicit !== undefined) {',
    replace: '  if (false) {',
    breaks: 'A named report path that does not exist must be an error, not a pass',
  },
  {
    file: 'src/cli/gate.ts',
    find: '  if (newest > ranAt) {',
    replace: '  if (false) {',
    breaks: 'The gate must refuse test results older than the source',
  },
  {
    file: 'src/agents/roles.ts',
    find: 'Not for pure logic (unit-test-engineer) or anything needing a browser (e2e-coder).',
    replace: 'It is generally useful.',
    breaks: 'A role description must say when NOT to use it',
  },
  {
    file: 'src/agents/roles.ts',
    find: 'Load: .claude/skills/testability-audit/SKILL.md,',
    replace: 'Load: .claude/skills/does-not-exist/SKILL.md,',
    breaks: 'A role must not point at a skill that does not exist',
  },
  {
    file: 'src/agents/roles.ts',
    find: "Not for writing the fix, and not for a failure whose cause is already established.',\n  model: 'sonnet',\n  maxTurns: 25,\n  tools: ['Read', 'Grep', 'Glob', 'Bash'],",
    replace:
      "Not for writing the fix, and not for a failure whose cause is already established.',\n  model: 'sonnet',\n  maxTurns: 25,\n  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit'],",
    breaks: 'An investigating role must not be able to edit product code',
  },
  {
    file: 'src/quality/assertions.ts',
    find: 'if (assertions > 1 && explained === 0) {',
    replace: 'if (false) {',
    breaks: 'A multi-assertion test with no failure message must be flagged',
  },
  {
    file: 'src/quality/assertions.ts',
    find: 'const source = maskStringsAndComments(rawSource);',
    replace: 'const source = rawSource;',
    breaks: 'Fixture strings must not be analysed as though they were code',
  },
  {
    file: 'src/quality/assertions.ts',
    find: 'const value = block.raw.slice(valueStart, valueStart + valueLength);',
    replace: "const value = '';",
    breaks: 'The selector rule must read the real selector, not the masked blank',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "severity: 'high',",
    replace: "severity: 'medium',",
    breaks: 'An untargetable element should be a high-severity finding',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: 'unique: (occurrences.get(element.suggested) ?? 0) === 1,',
    replace: 'unique: true,',
    breaks: 'A selector matching several elements must be reported as ambiguous',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "if (el.affordance === 'toggle' && Object.keys(el.stateAttributes).length === 0) {",
    replace: 'if (false) {',
    breaks: 'A toggle exposing no state must be reported as unobservable',
  },
  {
    file: 'src/tools/schema.ts',
    find: "if (type === 'null') acc.nullable = true;",
    replace: '// nullability dropped',
    breaks: 'A field observed as null must be reported nullable',
  },
  {
    file: 'src/qe/exploration-policy.ts',
    find: 'if (control.isSubmit && !policy.allowFormSubmit) {',
    replace: 'if (false) {',
    breaks: 'A read-only environment must refuse form submission',
  },
  {
    file: 'src/qe/exploration-policy.ts',
    find: 'captureBodies: false,',
    replace: 'captureBodies: true,',
    breaks: 'Payload bodies must not be written to disk outside local',
  },
];

const PLAYWRIGHT = resolve('node_modules/@playwright/test/cli.js');

/**
 * Runs the suites and reports whether they passed.
 *
 * Distinguishing "the tests failed" from "the tests could not be started" matters
 * more here than anywhere else: if a spawn failure were treated as a failing suite,
 * every mutation would look caught while nothing ran at all — a mutation tool
 * reporting a perfect score having tested nothing. This exact thing happened when
 * the runner was invoked through the `npx` shim, which fails with EINVAL on Windows.
 */
async function suitePasses(): Promise<boolean> {
  try {
    await run(process.execPath, [PLAYWRIGHT, 'test', ...PROJECTS, '--reporter=dot'], {
      windowsHide: true,
    });
    return true;
  } catch (error) {
    const e = error as { code?: number | string };
    if (typeof e.code === 'string') {
      throw new Error(
        `Could not start the test runner (${e.code}). Refusing to report a mutation score — ` +
          `every mutation would look caught while nothing ran.`,
      );
    }
    return false;
  }
}

console.log('Baseline: running the unit + integration suites unmutated…');
if (!(await suitePasses())) {
  console.error('The suite fails before any mutation. Fix that first.');
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
  const stillPasses = await suitePasses();
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
