import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// The harness project is included because the detection passes can only be tested
// against a real DOM; leaving it out let a mutation survive that the suite would
// have caught, which is precisely the blind spot mutation testing exists to find.
const PROJECTS = ['--project=unit', '--project=integration', '--project=harness'];

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
    file: 'src/agents/roles/integration-tester.ts',
    find: 'Not for pure logic (unit-test-engineer) or anything needing a browser (e2e-coder).',
    replace: 'It is generally useful.',
    breaks: 'A role description must say when NOT to use it',
  },
  {
    file: 'src/agents/roles/testability-reviewer.ts',
    find: 'Load: .claude/skills/testability-audit/SKILL.md,',
    replace: 'Load: .claude/skills/does-not-exist/SKILL.md,',
    breaks: 'A role must not point at a skill that does not exist',
  },
  {
    file: 'src/agents/roles/investigator.ts',
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
    file: 'src/tools/identity.ts',
    find: '  if (/^:r[0-9a-z]+:$/i.test(id)) return false;',
    replace: '  // generated-id check removed',
    breaks: 'A framework-generated id must not count as identity',
  },
  {
    file: 'src/tools/identity.ts',
    find: '  const total = Math.max(weighted, floor);',
    replace: '  const total = weighted;',
    breaks: 'A decisive signal must carry a match, not be outvoted by weak disagreements',
  },
  {
    file: 'src/tools/identity.ts',
    find: '    if (usedBefore.has(candidate.beforeIndex) || usedAfter.has(candidate.afterIndex))',
    replace: '    if (false)',
    breaks: 'One element must never be matched to two',
  },
  {
    file: 'src/tools/identity.ts',
    find: '  if (result.confident && result.score >= threshold) {',
    replace: '  if (result.score >= threshold) {',
    breaks: 'Pairing must require confidence, not merely a score above the threshold',
  },
  {
    file: 'src/tools/identity.ts',
    find: "  add('name', bothHave(nameBefore, nameAfter), namesMatch);",
    replace: "  add('name', false, namesMatch);",
    breaks: 'The accessible name must count — it is what most real pages offer',
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
  {
    file: 'apps/targets.ts',
    find: 'if (has(EFFECT_TAGS.writes) && !policy.allowWrites) {',
    replace: 'if (false) {',
    breaks: 'A writing test must be refused on an environment that forbids writes',
  },
  {
    file: 'apps/targets.ts',
    find: "if (policy.environment === 'local') return { allowed: true };",
    replace: 'return { allowed: true };',
    breaks: 'An untagged test must be treated as unknown, not harmless, off local',
  },
  {
    file: 'src/tools/interstitial.ts',
    find: "call.path.includes('/cdn-cgi/challenge-platform') ||",
    replace: 'false ||',
    breaks: 'A bot challenge must be reported rather than scanned as if it were the app',
  },
  {
    file: 'src/tools/interstitial.ts',
    find: 'if (observed.passwords > 0 && observed.interactive < 15) {',
    replace: 'if (false) {',
    breaks: 'A sign-in page must not be mistaken for the application behind it',
  },
  {
    file: 'src/tools/crawl.ts',
    find: 'if (response.status >= 500) {',
    replace: 'if (false) {',
    breaks: 'An unreachable robots.txt must refuse the crawl, not grant permission',
  },
  {
    file: 'src/tools/crawl.ts',
    find: '      disallowed.push(next.url);',
    replace: '      // disallow ignored',
    breaks: 'A path disallowed by robots.txt must be skipped and reported',
  },
  {
    file: 'src/tools/crawl.ts',
    find: "return (byPrefix.get(key)?.size ?? 0) >= minVariants ? '{slug}' : segment;",
    replace: 'return segment;',
    breaks: 'Slug segments must be induced, or every product page is its own template',
  },
  {
    file: 'src/tools/reveal.ts',
    find: 'if (rect.right <= 0 && rect.left < -1_000) continue;',
    replace: '// visually-hidden check removed',
    breaks: 'A control parked off-screen must count as hidden, or focus reveals nothing',
  },
  {
    file: 'apps/targets.ts',
    find: 'return new RegExp(EFFECT_TAGS.readOnly);',
    replace: 'return undefined;',
    breaks: 'A production run must be narrowed to read-only tests, not left unfiltered',
  },
  {
    file: 'src/tools/heal.ts',
    find: '  if (matches === 1) {',
    replace: '  if (false) {',
    breaks: 'A selector that still resolves must win outright, not be re-scored',
  },
  {
    file: 'src/tools/heal.ts',
    find: '  if (!sameOrigin(url, baseline.url)) {',
    replace: '  if (false) {',
    breaks: 'A baseline must never be matched against a different origin',
  },
  {
    file: 'src/tools/heal.ts',
    find: '  if (!ranked.decisive) {',
    replace: '  if (false) {',
    breaks: 'A heal that is too close to call must be refused, not resolved by rank',
  },
  {
    file: 'src/tools/heal.ts',
    find: '  if (isStableId(fingerprint.id)) return `#${fingerprint.id}`;',
    replace: '  if (fingerprint.id !== null) return `#${fingerprint.id}`;',
    breaks: 'A framework-generated id must not be proposed as the replacement selector',
  },
  {
    file: 'src/tools/heal.ts',
    find: '  if (found > 1) {',
    replace: '  if (false) {',
    breaks: 'A baseline must not be taken from a selector that matches several elements',
  },
  {
    file: 'src/qe/gate.ts',
    find: 'risks.push(`${healed.length} locator(s) healed`);',
    replace: '// mutated: healed locators no longer surface',
    breaks: 'A healed locator must not pass unmentioned',
  },
  {
    file: 'src/qe/gate.ts',
    find: 'blockers.push(`${misdirected.length} locator(s) resolved against the wrong origin`);',
    replace: '// mutated: wrong-origin baselines no longer block',
    breaks: 'A baseline used against the wrong origin must block the release',
  },
  {
    file: 'src/qe/gate.ts',
    find: 'risks.push(`${unresolved.length} locator(s) could not be resolved or healed`);',
    replace: '// mutated: unresolved locators no longer surface',
    breaks: 'A locator that could neither resolve nor heal must be reported',
  },
  {
    file: 'src/qe/baselines.ts',
    find: '  if (parsed.version !== FORMAT_VERSION) {',
    replace: '  if (false) {',
    breaks: 'A baseline file in an unknown format must be refused, not read as empty',
  },
  {
    file: 'src/qe/baselines.ts',
    find: "  const safe = name.replace(/[^a-z0-9]+/gi, '-').slice(0, 120);",
    replace: '  const safe = name;',
    breaks: 'A test title must not be able to steer where its journal is written',
  },
  {
    file: 'src/qe/baselines.ts',
    find: '  return `${path}::${selector}`;',
    replace: '  return `${url}::${selector}`;',
    breaks: 'One baseline must serve every environment, not be recaptured per host',
  },
  {
    file: 'src/qe/baselines.ts',
    find: '  for (const key of [...baselines.keys()].sort()) sorted[key] = baselines.get(key)!;',
    replace: '  for (const key of baselines.keys()) sorted[key] = baselines.get(key)!;',
    breaks: 'A recaptured baseline file must stay diffable, or no heal can be reviewed',
  },
  {
    file: 'src/fixtures/harness.ts',
    find: '          if (captureBaselines) captured.set(key, await captureBaseline(page, selector));',
    replace: '          captured.set(key, await captureBaseline(page, selector));',
    breaks: 'Baselines must only be captured when a run explicitly asks for it',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "            el.scrollIntoView({ block: 'center', inline: 'center' });",
    replace: '            // mutated: hit-test where the element happens to be sitting',
    breaks: 'Occlusion must be judged after scrolling, because Playwright scrolls before clicking',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: '      window.scrollTo(scrolledFrom.x, scrolledFrom.y);',
    replace: '      // mutated: scroll position left wherever the scan ended',
    breaks: 'A read-only scan must leave the page at the scroll position it found it',
  },
  {
    file: 'src/tools/accessible-name.ts',
    find: '    clean(parts.imageAlt)?.slice(0, 80) ??',
    replace: '',
    breaks: 'An image-only link must be named by its image alt, as every browser names it',
  },
  {
    file: 'src/tools/accessible-name.ts',
    find: '    clean(parts.value) ??',
    replace: '',
    breaks: 'A submit input must be named by its value, which is its only label',
  },
  {
    file: 'src/tools/reveal.ts',
    find: '    const stillHoverOnly = claim.signatures.filter((signature) => !withoutHover.has(signature));',
    replace: '    const stillHoverOnly = claim.signatures;',
    breaks: 'A hover reveal must disappear when the hover stops, or it arrived on its own',
  },
  {
    file: 'src/tools/heal.ts',
    find: '    if (conflicts.length === 0) {',
    replace: '    if (true) {',
    breaks: 'A selector resolving to a contradicting element must be reported, not called intact',
  },
  {
    file: 'src/tools/heal.ts',
    find: '    if (index < 0) {',
    replace: '    if (false) {',
    breaks: 'A selector resolving to a hidden element must not be reported as healthy',
  },
  {
    file: 'src/tools/heal.ts',
    find: '    if (count === 1) return rung;',
    replace: '    return rung;',
    breaks: 'A proposed selector must resolve to exactly one element',
  },
  {
    file: 'src/qe/gate.ts',
    find: 'risks.push(`${drifted.length} locator(s) resolve to something that changed`);',
    replace: '// mutated: drift no longer surfaces',
    breaks: 'A locator that drifted must reach the gate',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "        audience: ['automation'],",
    replace: "        audience: ['product', 'automation'],",
    breaks: 'An ambiguous selector must not be put in front of a product owner as a defect',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "      audience: ['recon'],",
    replace: "      audience: ['product'],",
    breaks: 'An unscanned frame is a declared blind spot, not a defect in the product',
  },
  {
    file: 'src/tools/probe.ts',
    find: '  if (zoom.horizontalOverflow) {',
    replace: '  if (false) {',
    breaks: 'A reflow failure must be reported as a product defect, not buried in the map',
  },
  {
    file: 'src/tools/probe.ts',
    find: "    .then((): Settling => 'settled')",
    replace: "    .then((): Settling => 'timed-out')",
    breaks: 'A settled page must not be reported as an incomplete inventory',
  },
  {
    file: 'src/tools/page-scanner.ts',
    find: "    ...(options.settled === 'timed-out'",
    replace: '    ...(false',
    breaks: 'An inventory taken before the page settled must declare itself a floor',
  },
  {
    file: 'src/tools/probe.ts',
    // Dropping the `load` wait alone changes nothing while networkidle still runs,
    // so the mutation carrying this rule has to remove the networkidle wait.
    find: '  const settledTo: Settling = await page',
    replace: '  const settledTo: Settling = await Promise.resolve()',
    breaks: 'Content a page adds after load must still reach the map',
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
