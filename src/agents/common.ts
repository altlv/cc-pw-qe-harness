/**
 * The blocks every role shares.
 *
 * Each carries three things the SDK type does not model but that decide whether a
 * role is useful: **when not to use it** (in the description, because that is what
 * makes selection reliable), **which skills to load** (otherwise the skills in
 * .claude/skills/ and these roles are two disconnected halves), and **what it must
 * hand back** (a report that `npm run check-report` can verify).
 *
 * Contract shape adapted from the agent descriptors in goose-harness:
 * mission → loads → method → boundaries → output.
 */

/**
 * Prepended to every role. Ported from core/guardrails/ and core/HARNESS.md.
 */
const GUARDRAILS = `
Working discipline:
- Evidence beats memory. Read the file, run the check. Never claim a check ran when it did not; report NOT RUN explicitly.
- A test that did not execute is not evidence. A test that passes but does not exercise the claim is insufficient.
- Your own output is the evidence most in need of checking. Before reporting a result as observed, confirm the tool actually ran and the output contains something that could only come from the real system.
- One bounded objective at a time. Note side quests instead of chasing them.
- Do not recursively load the repository. Start from structure and targeted search, then open exact files.
- Never open .env, credential stores, or browser auth state. Prefer checking that a variable exists over reading its value.
- Destructive or irreversible actions (git reset/clean/force, deleting files, production writes) require explicit authorisation. Ask first.
- Never widen a selector or delete an assertion to make a test pass. Fix the locator or report the defect.
`.trim();

const CONVENTIONS = `
Repository conventions (docs/conventions.md is authoritative):
- Import test/expect from src/fixtures/harness.js for UI specs, src/fixtures/api.js for API specs. Never from @playwright/test directly.
- Relative imports carry a .js extension (NodeNext ESM).
- Selector ladder: getByTestId > getByRole with name > getByLabel/getByText > CSS. Mark anything CSS-and-positional with // TODO (Fragile).
- Banned and lint-enforced: waitForTimeout, waitForSelector, committed test.only.
- Every test needs an assertion tied to an observable outcome. Navigating and asserting nothing is a build failure (npm run assert-quality).
- Tests must be isolated. Never assert on a shared collection's size, and never share an output path between parallel tests; assert the specific thing your test created or rejected.
`.trim();

/** Every role hands back the same envelope, so a script can check it. */
const OUTPUT = `
Output — a report per docs/report-format.md. The format is strict, because a script
reads it:

- The very first characters of your output must be \`---\` on its own line, opening the
  YAML frontmatter. No preamble, no greeting, no summary before it.
- Do NOT wrap the frontmatter in a code fence. It is the document's own header, not a
  code sample.
- Close the frontmatter with \`---\`, then write the markdown body.
- \`not_covered\` is required: state what you did not look at.

Then verify it with \`npm run check-report -- <path>\` and fix anything it reports before
you finish. The checker refuses a blocker resting on anything but direct evidence, and
refuses a PASS built on claimed evidence.

Every number and name you report must come from a command you actually ran. If you did
not run it, say so in \`not_run\` rather than estimating.
`.trim();

const TEST_LEVELS = `
Test levels in this repo, one Playwright runner for all of them (a browser starts only
when a test asks for \`page\`):
- unit         tests/unit/*.test.ts — pure logic, no I/O
- integration  tests/integration/*.int.test.ts — modules wired together, real files and
               processes, no browser
- api          apps/<app>/tests/*.api.spec.ts — HTTP contract via src/fixtures/api.js
- e2e          apps/<app>/tests/*.ui.spec.ts — browser via src/fixtures/harness.js
- exploratory  chartered session, not a spec
Push each check as far down as it will go. Do not test the same thing at two levels.
`.trim();

export { GUARDRAILS, CONVENTIONS, OUTPUT, TEST_LEVELS };
