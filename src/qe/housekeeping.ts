/**
 * The rules behind `npm run precommit`, as pure functions.
 *
 * They lived inside the CLI, where the only way to test one was to stage drift in the
 * real repository — and the first attempt at that left `docs/conventions.md` dirty
 * whenever a run was interrupted. Worse, a mutation disabling the undocumented-command
 * rule **survived**, because the only test asserted the README was currently honest
 * rather than that the rule could fail. A rule that cannot be given a bad input has
 * not been tested.
 */

/** Commands a document tells a reader to run. */
export function commandsNamedIn(text: string): string[] {
  return [...new Set([...text.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1] ?? ''))];
}

/**
 * Repo paths a document points at.
 *
 * Deliberately narrow. A detector that cries wolf is worse than none, so this only
 * accepts a path under a known root, skips globs, and requires a file extension —
 * `apps/<app>/coverage.md` is a pattern, not a claim.
 */
export function pathsNamedIn(text: string): string[] {
  const candidates = [
    ...[...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? ''),
    ...[...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1] ?? ''),
  ];
  return [
    ...new Set(
      candidates.filter(
        (candidate) =>
          /^(src|tests|apps|docs|scripts|\.claude|\.ai|\.github)\/[\w./-]+\.\w+$/.test(candidate) &&
          !candidate.includes('*'),
      ),
    ),
  ];
}

/**
 * Commands that exist and the README never mentions.
 *
 * The drift that actually happened, and the direction the first version of this gate
 * missed entirely: it checked that documented commands exist, not that existing
 * commands are documented. `npm run precommit` slipped through on the run that
 * introduced it, one message after five README fixes.
 *
 * `internal` is why this is not a blanket rule. Demanding a README entry for
 * `typecheck` and `format:check` — parts that `check` composes — would cry wolf on ten
 * commands to catch the one that matters, and then get ignored.
 */
export function undocumentedCommands(
  scripts: string[],
  readme: string,
  internal: Record<string, string>,
): string[] {
  return scripts
    .filter((name) => name !== 'test' && !(name in internal) && !readme.includes(`npm run ${name}`))
    .sort();
}

/**
 * Skills that exist and the catalogue never lists.
 *
 * The same drift as an undocumented command, and it happened twice in two messages:
 * `test-techniques` and `visual-inspection` were written, wired into roles, enforced
 * by a test that nothing is orphaned — and absent from both READMEs. Being loadable
 * is not the same as being findable.
 */
export function uncataloguedSkills(skills: string[], catalogue: string): string[] {
  return skills.filter((name) => !catalogue.includes(`\`${name}\``)).sort();
}

export interface Consequence {
  touches: RegExp;
  obligation: string;
}

/**
 * What changed, and which document talks about that kind of thing.
 *
 * A static checklist asks an agent to remember what it did, which is precisely what an
 * agent does not reliably do — this repo has the evidence. Reading the diff turns
 * "think about the README" into "you changed package.json, and the README lists
 * commands".
 */
export const CONSEQUENCES: Consequence[] = [
  {
    touches: /^package\.json$/,
    obligation:
      'package.json changed — a new command belongs in the README Commands table and ' +
      'usually in TOOLBOX (src/agents/common.ts); a new dependency may belong in the ' +
      'README Stack list, and in docs/sources.md if an idea came with it',
  },
  {
    touches: /^src\/agents\/roles\//,
    obligation:
      'a role changed — check families and BROWSER_ACCESS in roles.ts, the README ' +
      'status row, and whether PLAN.md still says how many roles have never run',
  },
  {
    touches: /^\.claude\/skills\/[^/]+\/SKILL\.md$/,
    obligation:
      'a skill changed — it must be declared by a role (roles.test.ts enforces it) ' +
      'and listed in .claude/skills/README.md and the README Practices paragraph',
  },
  {
    touches: /^src\/(cli|tools)\//,
    obligation:
      'a capability changed — if it is something a person or an agent would invoke, ' +
      'the README and TOOLBOX are where they will look for it',
  },
  {
    touches: /^\.env\.example$/,
    obligation:
      '.env.example changed — the README has repeated its values before, and was ' +
      'still recommending an AGENT_MAX_TURNS that had been deleted for good reason',
  },
  {
    touches: /^src\/qe\//,
    obligation:
      'a rule changed — does it have a mutation proving the test can fail, and does ' +
      'PLAN.md still describe it correctly under Proven or Not proven?',
  },
];

/** Items that apply to any change at all, however small. */
export const ALWAYS = [
  'README — does the Status table still describe what is true, in both columns?',
  'PLAN.md — did anything move between Proven and Not proven?',
  'HANDOFF.md — did this work earn a trap, or make one stop being true?',
];

export function obligationsFor(changed: string[]): string[] {
  const derived = CONSEQUENCES.filter((rule) =>
    changed.some((file) => rule.touches.test(file)),
  ).map((rule) => rule.obligation);
  return [...derived, ...ALWAYS];
}
