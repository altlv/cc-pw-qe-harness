# PLAN — where we are and what is next

**Kept accurate, never left stale.** Before every commit, every fact here is re-verified
by running the command that produces it; sections that changed are updated in place,
and anything no longer true is deleted rather than left beside its correction. A stale
number is worse than no number, because it is believed. Status and next actions live
together because they are one sentence: what is true now decides what comes next.

Durable working agreements live in `HANDOFF.md`. Facts about an app under test live in
that app's `README.md`. Why a line of code exists lives in a comment next to it.
Attribution lives in `docs/sources.md`. None of that belongs here.

## Where we are

Head is `1eb4880` — the commit this file was last checked against. A file cannot name
the commit that contains it, so `npm run precommit` accepts HEAD itself, or HEAD's
parent when the latest commit updated this file.

Roles drive a real browser through Playwright MCP, bounded by the exploration policy at
three layers, the third not yet seen firing in a live run; the toolbox reaches every role; the session briefing is a tested module
rather than inline prompt text; `npm run precommit` guards documentation drift before
each commit, and `npm run plan:facts` supplies the numbers below.

Heuristics now have a bridge to action. `src/qe/heuristics.ts` sorts each one by what
does the work — scripted, generated, scriptable, or judgement. `npm run ideas` turns a
saved scan into the generated cases, and `npm run assert-quality` gates the two that
generated suites most reliably skip: a write checked only by its render, and a write
never read back.

A role run no longer rests on the agent's word. `docs/agent-workflows.md` is the
specification, written from a drawing of the flow: preflight refuses a run missing its
inputs, the runner injects the role's skills and design, one `PreToolUse` hook guards
every tool call including `Bash`, and a post-run gate re-checks the work — with
`npm run fault-check` proving an app spec notices its server failing. Built and tested
on 2026-09-14; no live agent run has gone through it yet.

Runs are separable by construction. Each works in its own git worktree at the base
commit, beside the repository, so its diff is its work and nobody else's; one run holds
each app and environment at a time; a server the harness starts gets a free port per
run; the work comes back uncommitted for a person to bring in. `--preflight` runs every
refusal and stops before anything costs money.

## Proven — direct evidence, re-run before this commit

The first three lines are `npm run plan:facts` output, which refuses any run older than
the code.

- `npm test` **592 passed** — unit 473, integration 49, todo-fixture 7, harness 63
- `npm run test:external` **22 passed** — countdown-timer 6, fakerestapi 16
- `npm run mutate` **130/130**, one mutation per enforced rule, no survivors
- `npm run gate` **PASS** · `npm run assert-quality` **56 files, 0 findings**
- `npm run check` clean · `npm run precommit` clean · `CI=1 npm test` 592 passed
- **The write gates hold both ways.** Silent on every committed spec, and firing on
  real specs once their verification is removed: fakerestapi books without its
  read-back marker, todo-fixture UI without its network checks, todo-fixture API
  without its reads, and the countdown spec retagged `@writes`. 2026-09-14
- **`npm run ideas` runs on real scans** — four the-internet pages (login, checkboxes,
  dropdown, inputs) and the local todo fixture, 2026-09-14. It refuses the committed
  countdown-timer scan, which predates the constraint format, out loud. Those scans were
  not committed, so this cannot be re-run from the repo yet — item 31
- **A role runs.** `test-planner` executed against the live API on 2026-09-13: 1 turn,
  $0.1677, 6s, returned what it was asked for
- **A role sees.** `testability-reviewer` against academybugs under a `prod` policy
  reported "a cookie-consent banner overlapping the third product image" — an
  occlusion, which is a spatial fact no DOM query returns. 4 turns, $0.0728, 17s
- **A role reasons from a pre-computed map.** Given `npm run scan` output, it named
  `getByRole('link', { name: "Select Options" })` as the most fragile selector on the
  page — three products, one accessible name, "resolves, looks valid, and silently
  clicks the wrong product instead of failing loud"
- **The policy binds the browser at two layers the model cannot talk its way past:** the
  tool allowlist (what it may hold) and the browser's own `--allowed-origins` (where it
  may go). The third, the per-call guard, moved on 2026-09-14 — see _Not proven_
- **`npm run fault-check` holds both ways on real specs** — its integration test runs
  the probe spec under the fault and requires the client-only test refused as survived
  and the server-dependent one credited as caught, and runs the todos API spec and
  requires every test caught. 2026-09-14
- **The post-run gate, readiness, skill injection, the shell guard and per-role wall
  clocks are enforced in code**, each with unit tests in both directions and a mutation.
  Enforced is not exercised: see _Not proven_
- **Worktree isolation holds against a real git repository** — a throwaway one: the
  worktree's changes are exactly the run's while the checkout is edited alongside, an
  uncommitted design is absent at the base, a differing lockfile is refused, and a plain
  `git worktree remove` leaves the checkout's `node_modules` intact. That last test was
  shown to fail against the first version, which linked modules inside the worktree.
  2026-09-14
- **The runner refuses as a process, not only as functions.** `role.ts` run with
  `--preflight` in a throwaway repository refuses an unknown role, a coder with no target
  or design, an uncommitted design, a differing lockfile, a target a live run holds, a
  coding role in another run's worktree, and a path that is not a run worktree; it
  replaces a dead run's lock and releases its own. Each refusal carries a mutation.
  Three repeats under `CI=1`, no failures. 2026-09-14
- **`npm run plan:facts` refuses failing external tests.** It had quoted 19 passed
  beside 3 failures and printed the failures after the last project's count, where they
  read as fakerestapi's. Both fixed, each with a test
- **CI is green** on `1eb4880`: 592 passed, release gate PASS — the first green run since
  the plan-stamp rule landed. Every run before it failed because `actions/checkout`
  fetched one commit and precommit could not see HEAD's parent; a depth-1 clone
  reproduced the refusal and a depth-2 clone passed. CI fetches two commits now
- **The harness needs no API key.** A role ran with `ANTHROPIC_API_KEY` absent from the
  process, on the Claude Code OAuth session alone — 1 turn, $0.027. `.env.example` had
  claimed the key was required since before the fallback existed, which is why one was
  issued and pasted in that nobody needed
- **Cost floor per role invocation ≈ $0.14** — the difference between a bare
  one-line system prompt ($0.027) and a full role prompt with skills ($0.168). At the
  default `maxUsd` of $1.00 that leaves roughly five to six turns of real work
- **The harness loads its own `.env` and no subject's** — two integration tests, one
  staging a temp directory with its own `.env`, plus the mutation that reverts to the
  cwd-relative load
- Self-healing proven against staged change: regenerated ids, a reworded label held by
  its `name` attribute, a reworded and moved link held by its href, a control behind a
  shadow boundary — plus every refusal
- Detector precision corrected against a live site: two occlusion false positives and
  one hover false positive, each carrying a regression test

## Not proven — do not claim otherwise

- **No exploratory session has ever been run by an agent.** Skills, roles and
  checklists exist; none has been exercised. Still the largest unproven claim here.
- **No spec has been written from `npm run ideas`.** Its output has been read by a
  person, not used by an agent. That it saves agent turns is the reason it exists and
  is still a claim — item 30 measures it through the driver, with it and without.
- **No skill has ever been invoked by name.** Demonstrated at cost on 2026-09-11:
  `oracle-check` already held the exact oracle that found nearly every bug in a manual
  session, and went unread because nothing made anyone read it.
- **No agent run has gone through the new runner.** Readiness, skill injection, the
  guard hook, the post-run gate and per-role wall clocks are unit-tested and mutated,
  and not one has met a live agent. The first run must show a refusal in preflight, a
  refused `Bash` command, and a gate verdict on real output.
- **No agent has worked in a run worktree.** Creating one, confining the file tools to
  it and gating inside it are tested apart; `--preflight` stops before the worktree, so
  no test runs the whole path. Also open: `Bash` can `cd` out of a worktree — the shell
  guard refuses git writes, secrets and foreign hosts, not paths — and nothing removes
  finished worktrees, by design, so they accumulate beside the repository until a person
  removes them.
- **No agent has run in CI.** The agents job skipped every run for want of an API key,
  and a skipped step showed green. It now authenticates with `CLAUDE_CODE_OAUTH_TOKEN`, a
  subscription token, and warns when it skips. Unproven until a CI run's smoke triage
  actually authenticates and returns a verdict.
- **Three countdown-timer failures are unexplained.** One `npm run test:external` on
  2026-09-14 failed three of its six tests; 90 runs since — 30 parallel, 30 on one
  worker, 30 beside `npm test` — failed none, nor did the full verification run after
  them. Not called flaky: no cause is established
  and no rate measured under the conditions that failed. `apps/countdown-timer/README.md`
- **Which guard path the SDK calls under `bypassPermissions` is unobserved (F7).** Its
  types say that mode bypasses permission checks, which is why `canUseTool` was
  replaced with a `PreToolUse` hook. Until a live run refuses a command, neither is shown
  to fire — and the browser guard's old "fail-closed" claim was never shown either.
- **What injected skills cost per run is unmeasured.** `e2e-coder`'s four skills are
  several hundred lines of prompt on every run, against a measured floor of $0.14.
- **The per-role wall clocks are estimates.** No role has run long enough to observe a
  median.
- **The fault check tries one fault.** Every server response becomes a 500. A spec that
  notices a 500 but not a wrong value passes it, and an API spec that builds absolute
  URLs bypasses the fault and is reported untouched.
- **Delegation has never fired.** A coder can call `test-planner`; none has.
- **`maxStates` is enforced by nothing.** The per-call guard sees one tool call at a
  time and cannot tell a new page from a return to an old one. It needs the driver's
  state model. `denyLabels` and `maxActions` are enforced; this one is not.
- **The label guard reads the model's own words.** Playwright MCP names a target by an
  opaque `ref` plus a description the model writes, so "Delete account" is refused and
  "the third button" is not. A guard against accident, not against an adversary —
  there is a test asserting exactly that limit.
- **No interactive session has run.** Every browser run so far was read-only under a
  `prod` policy, so `INTERACT`, `FILL` and the action ceiling are unexercised against
  a live page.
- **Self-healing has never faced a change someone else made.**
- Framework detection is largely unverified; three tiers confirmed against live sites.
- Six of eight roles have never run. No role has written a browser spec.

## The measured gap

`academybugs.com/find-bugs/` plants **25 bugs across five categories** — functional,
visual, content, performance, crash — and ships its own oracle: a counter overlay whose
`a.academy-tooltip-bug-link` elements carry found/unfound state in the DOM, per
session. That makes the harness's find rate a number rather than an opinion.

Measured 2026-09-11:

| Finder                                    | Distinct findings |
| ----------------------------------------- | ----------------- |
| A person with a browser, over four passes | ~30               |
| **The harness's tools, ever**             | **~8**            |
| Of those ~8, ones the person had missed   | ~4                |

The eight are all static and structural. Every serious defect on that site — a phantom
$100 added to every cart total, a quantity field that silently caps at 2, three
products with no purchasable path, an inert currency switcher, dead pagination — needs
**interaction**, and the harness never clicks anything.

**The honest headline: this is a good map and not yet a tester.** Nothing since has
moved that number. 2026-09-11 fixed how the map reads. 2026-09-13 fixed who does the
thinking, what pays for it, and — at the end — gave the roles hands and eyes.
2026-09-14 gave them something to choose with.

**The hands are new and have not been used.** A role can now click, under a policy
that decides which controls and how many, and no session has done it once. The
difference between this and the previous entry is that the gap is a session away
rather than a capability away.

## Work queue

Ordered so nothing appears before what it needs. The **blocked by** column is the
ordering — if it is empty, it can start today.

An earlier version of this table had E5 first and E4 sixth, while E5's own
description read "action selection under E4". Ranking by importance rather than by
dependency puts the most-wanted thing on top and quietly makes it unstartable.

### In this order

| #   | Item                                                                                                                                | Blocked by | Why                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3   | **E5 — the driver.** Action selection under E4, diffing via `identity.ts`                                                           | —          | Smaller again now E4 is done: what to try comes from `ideasFor`, and what it must not decide is the catalogue's judgement list. The hands exist and are bounded, so this is action _selection_. Set `allowWrites` and give it something to choose with |
| 4   | **The map is a single state.** Transient surfaces — mini-cart, dropdown, modal, toast, drawer — appear in no inventory and no crawl | 3          | Reaching them means opening them, which means interacting. A defect was missed for exactly this reason: the cart page was tested thoroughly and the cart _preview_ never opened                                                                        |
| 5   | **E6 — enforce the session report** through `check-report`                                                                          | —          | Could start now; wanted before E7, because an unenforced report format is how a session's findings quietly go missing                                                                                                                                  |
| 6   | **E7 — a real agent session against the scored benchmark**                                                                          | 3, 5       | The empirical test of all of it, and the only thing that turns "better" from opinion into a number. No longer blocked on a key — OAuth works                                                                                                           |

### Independent — any time, in any order

| #   | Item                                                                                                                                                                                                                                                                         | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **`storageState`**, captured once by a person and replayed by the harness                                                                                                                                                                                                    | The authenticated half of every app is otherwise permanently dark. An agent never enters credentials, so this is the only route in: `playwright codegen --save-storage`                                                                                                                                                                                                                                                                                                                                                             |
| 8   | **A performance pass** — `performance.getEntriesByType`, roughly fifteen lines                                                                                                                                                                                               | One of the five benchmark categories has no capability at all. Fifteen hand-written lines found ~3x oversized images, 2.2MB of payload and a dead CDN                                                                                                                                                                                                                                                                                                                                                                               |
| 9   | **Multi-provider / multi-model, as a side quest.** A second seam — `askModel(model, prompt)`, single-shot, no tools, no budget loop — reaching OpenRouter (Gemini and the rest) beside the Claude SDK                                                                        | The SDK is Anthropic-only by construction: it recognises `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, Bedrock and Vertex, and nothing else. So this is a **sibling of `runAgent`, never a replacement**. See below                                                                                                                                                                                                                                                                                            |
| 10  | **The first live run through the new runner, and what injected skills cost.** One cheap role run that must show a preflight refusal, a refused `Bash` command, a worktree created and gated, a gate verdict, and the token cost of the skills now injected into every prompt | Everything built on 2026-09-14 is enforced in code and exercised by nothing live — see _Not proven_. Whether the SDK's `skills` field works no longer matters for delivery, since the runner injects the text; what it costs does, against the $0.14 floor. About $0.20 of agent time                                                                                                                                                                                                                                               |
| 11  | **Register `mcpa-bot` as a subject** at its external path, the way `juice-shop` is                                                                                                                                                                                           | Local Express app, own `.env`, nine `node:test` files and Playwright e2e **with page objects** — so it exercises item 15 with a real example, and its existing tests are ground truth to check an agent's findings against                                                                                                                                                                                                                                                                                                          |
| 24  | **Measured trial: `microsoft/playwright-cli` against Playwright MCP.** Same role, same task, same page; compare cost, turns, and exactly which policy bounds are lost                                                                                                        | Microsoft's own README positions the CLI as the alternative for coding agents — "token-efficient. Does not force page data into LLM" — which matches our measurement that the accessibility tree is the expensive way to look. The price: every bound here is built on MCP tool names, and a CLI runs through `Bash`, where the tool allowlist cannot bind a subcommand and the shell guard reads only the command as written. Split to be proven, not assumed: testing roles keep MCP, `e2e-coder` authors via the CLI. Apache-2.0 |
| 25  | **Review the test skills on skills.sh as benchmarks** — read, never install, and compare against our own. Shortlist below, plus `aihero.dev/skills-grilling`, recommended to the user on 2026-09-14                                                                          | Recreating what already exists well is waste; missing a technique someone else found is worse. Registry audits (Gen Agent Trust Hub, Socket, Snyk) are partial — many entries show Pending — and nothing states they cover prompt injection, the real risk in a skill. Check each licence before taking anything and credit it in `docs/sources.md`                                                                                                                                                                                 |
| 26  | **Keep a history of runs, not only the latest.** After each run, copy `artifacts/results.json` to `artifacts/runs/<timestamp>.json` and keep the last N; `results.json` stays the fixed path the gate and `plan:facts` read                                                  | Flake tracking over time is on the README's "Not yet" list, and no trend shows in a single file; it also starts closing A1, no accumulation. A copy beside the fixed file, never a replacement: timestamped names in its place would have readers pick "the newest file", which is exactly how an old run gets quoted when the latest one wrote nothing                                                                                                                                                                             |
| 27  | **Move the scriptable heuristics to scripted.** `npm run ideas -- --catalogue` lists each with what it needs. Cheapest first: a console listener in the scan, a literal-string search over rendered text, a command that measures a flake's rate alone and in parallel       | Scriptable is a decision to defer, not a decision against. Each one moved removes turns from every session that would otherwise do it by reading, and a gate can only check work that something produces                                                                                                                                                                                                                                                                                                                            |

#### On item 25 — the shortlist

From `skills.sh/?q=test` on 2026-09-13: the first 100 results, ranked by relevance,
publisher and installs. The list is rendered client-side, so it was read in a browser.

- **Web, E2E and browser** — against `pwtest` and `visual-inspection`: `anthropics/skills`
  webapp-testing · `github/awesome-copilot` webapp-testing, playwright-generate-test,
  scoutqa-test · `wshobson/agents` e2e-testing-patterns · `addyosmani/agent-skills`
  browser-testing-with-devtools · `browserbase/skills` ui-test · `affaan-m/ecc`
  e2e-testing · and the skill shipped with `microsoft/playwright-cli` (item 24)
- **Strategy and process** — against `test-design`, `risk-assessment` and
  `exploratory-session`: `anthropics/knowledge-work-plugins` testing-strategy ·
  `obra/superpowers` and `addyosmani/agent-skills` test-driven-development ·
  `riekelt/principal-engineer` testing-changes, writing-unit-tests ·
  `github/awesome-copilot` breakdown-test, polyglot-test-agent · `api/git` vip-test-plan,
  vip-test-executor
- **Techniques** — against `test-techniques`: `trailofbits/skills` property-based-testing
- **Failures and regressions** — against `flaky-test-detection` and triage:
  `forcedotcom/sf-skills` dx-devops-test-failures-analyze · `affaan-m/ecc`
  ai-regression-testing, relevant to the tier-3 evals nothing here has yet
- **Areas `.claude/skills/README.md` lists as deliberately absent** — re-read before that
  line is kept: accessibility — `wshobson/agents` screen-reader-testing; security —
  `usestrix/strix` owasp-top-10-testing, web-app-penetration-testing,
  api-security-testing. Review only: offensive testing is for a local subject such as
  `juice-shop`, never a third-party target
- **Vendor-bound** — ideas only, expect lock-in: `momentic-ai/skills` momentic-test ·
  `alwaysmeticulous/skills` meticulous-test
- **Out of scope** — language- or platform-specific (Go, Rust, Swift, Flutter, Dart, C#,
  Kotlin, Apex, Terraform and others), marketing A/B tests, trading backtests

#### On item 9 — the shape, so it is not rediscovered

Three separate problems, and conflating them is the trap:

1. **Running the roles.** Agentic, tool-using, needs the Claude Agent SDK. Anthropic
   direct, OAuth, Bedrock, Vertex, or a gateway speaking the Anthropic Messages API.
   OAuth covers it today for free. `src/agents/models.ts` is the single place this is
   decided, so a tier could gain a `via:` field without touching a role. **Verify
   first whether OpenRouter serves an Anthropic-Messages endpoint** — if it does,
   `ANTHROPIC_BASE_URL` is the whole integration; if not, roles stay Anthropic-only.
2. **Second opinion and cross-model comparison.** Single-shot, no tools, no loop. Any
   provider. This is where OpenRouter earns its keep — one key, every model. It also
   unlocks the thing `honesty-check` most needs: **a role's output judged by a
   different model than wrote it**, since self-assessment is its weakest link.
3. **The model a subject under test uses** — mcpa-bot's `CHAT_PROVIDER` and
   `OLLAMA_BASE_URL`. Not ours. The `.env` anchoring now enforces that boundary rather
   than trusting it.

### Smaller, unblocked

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | **A triage ledger for test failures**, from Kody: a failure signature maps to `{status, note, who, when}` in `.ai/state/triage.json`, never deleted, and `gate.ts` reads it so a diagnosed flake becomes a documented risk instead of being re-litigated or silently retried away each run. `heal.ts` already carries exactly this for locators; there is no equivalent memory for test failures                                                                                                               |
| 13  | **Split app docs by audience**, from Kody — each `apps/<name>/` gets a human-facing `README.md` (what, prerequisites, done-when) and an agent-facing `AGENTS.md` (how to invoke, smoke tests, edge cases), instead of one README serving both readers badly                                                                                                                                                                                                                                                    |
| 14  | **Event-first triage**, from Kody — trigger `triageFailure` off a failed CI run rather than a schedule. Only matters once triage runs unattended; today it is 100% human-invoked                                                                                                                                                                                                                                                                                                                               |
| 15  | **Analyzer blind to Page Objects** — `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(`. The write gates share the blind spot: a page object's `save()` hides the click, so `write-unverified` never sees the write                                                                                                                                                                                                                                     |
| 16  | **LICENSE** — a public repo with none is legally unusable. **User's decision**                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 17  | CI actions target Node 20; GitHub is migrating to 24. A `@v5` bump clears the annotation                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 18  | `apps/todo-fixture/coverage.md` — three skills point at `apps/<app>/coverage.md` and only countdown-timer has one                                                                                                                                                                                                                                                                                                                                                                                              |
| 19  | Fresh-clone verification: `npm ci` → browsers → all suites, proving it works for someone who is not us                                                                                                                                                                                                                                                                                                                                                                                                         |
| 20  | The crawl writes no artefact, so two crawls cannot be diffed                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 21  | Scans overwrite and nothing reads one back — no drift detection between runs. `npm run ideas` now reads one, but only the latest                                                                                                                                                                                                                                                                                                                                                                               |
| 22  | Recipes 0 of 9 · agent contracts 7 of 22 · schemas for requirements-analysis and triage-report not ported                                                                                                                                                                                                                                                                                                                                                                                                      |
| 23  | **`maxStates` enforcement** — needs the driver's state model; the per-call guard cannot see state. Pairs with item 3                                                                                                                                                                                                                                                                                                                                                                                           |
| 28  | `apps/countdown-timer/scans/timer.json` predates the constraint format, so `npm run ideas` refuses it. Re-scan it — read-only, against an external site                                                                                                                                                                                                                                                                                                                                                        |
| 29  | The write gates read patterns, not meaning: a helper that wraps `network.waitForCall` under another name is refused as unverified. Widen the recognised checks when a real spec hits it, not before                                                                                                                                                                                                                                                                                                            |
| 30  | **Measure `npm run ideas` through the driver (E5), once it runs.** Same charter, target and model, with it and without, so weak ideas are not blamed on a weak driver — the user chose this over a coder trial on 2026-09-14. Compare turns, cost and findings scored against the benchmark. Until then "saves turns" is the claim under _Not proven_                                                                                                                                                          |
| 31  | **Commit the evidence and test the command.** The real scans behind the Proven line sit in a session scratch folder that disappears with the session, and the `ideas` CLI has no integration test — only its functions do. Commit a todo-fixture scan under `apps/todo-fixture/scans/`, and test the CLI on it: new format, old format refused, non-scan input exits 2                                                                                                                                         |
| 32  | **Proposal, not decided: a coverage gate from ideas to specs.** For each case `npm run ideas` generates, a spec covers it or its report lists it under `not_covered`. It would turn the generated list into a checked obligation rather than a suggestion — and needs A2, a spec recording which scan it was written against                                                                                                                                                                                   |
| 33  | **Audit the harness itself for AI-specific gaps**, after `marvin-template`'s `harden` skill (MIT). Ask visibility, access, deployment and compliance first and set severity from the answers; say what is and is not covered before starting; ask only what the code cannot answer. Then: prompt injection into role prompts, data the model can see, cost controls, whether AI output is checked before anything acts on it, hard-coded model assumptions. Findings as a checkable report, not a letter grade |
| 34  | **A "what a run can break" table in each `apps/<app>/README.md`** — action, risk, who is affected — after `marvin-template`'s per-integration Danger Zone. The exploration policy binds; the table tells a person what the binding protects                                                                                                                                                                                                                                                                    |
| 35  | **"When not to use" in every skill.** Most skills here say when to load them and not when to leave them, which is how a skill fires on the wrong task. Find which lack it; a test beside `roles.test.ts` could require it                                                                                                                                                                                                                                                                                      |
| 36  | **List and clean up run worktrees.** Nothing removes them — see _Not proven_. A command listing each run worktree with its gate verdict and uncommitted changes, removing only those with nothing uncommitted, never work a person has not brought in; `git worktree prune` for stale entries                                                                                                                                                                                                                  |
| 37  | **Add to item 24's comparison:** `marvin-template` prefers a CLI when it is well maintained and its auth simpler, and MCP when no CLI exists or streaming is needed. Neither criterion covers bounds — the allowlist binds MCP tool names, and a CLI through `Bash` binds nothing — which is the one that decides here                                                                                                                                                                                         |

## Waiting on the user

Raised, recommended, and not yet answered. Only the user can close these.

- **Should `oracle-check` reach the coding family?** `tests/unit/roles.test.ts` refuses
  it, and `risk-assessment`, on any coding role. Clarified on 2026-09-14: role
  restrictions are about activity — a unit-coder does not go exploring — not about
  knowledge, and every test a coder writes must assert well. An assertion is an oracle
  written down, so a coder choosing an expected value is doing oracle work.
  Recommended: allow `oracle-check` for coders; keep `risk-assessment` with the
  planner, because ranking risk is design and design is the planner's. A guard change,
  so it waits for a yes.
- **A test-reviewer role?** Judging whether a finished test is good enough is reviewer
  work. `assert-quality` and `mutate` are its mechanical floor; nothing covers the
  judgement half — is this the right oracle, does it test the risk it claims. Proposed:
  a testing-family role with no Edit that reads a spec against its scan's
  `npm run ideas` output and the judgement list. Not built.
- **Should `prod` keep granting `allowAuthentication`?** It grants
  `browser_set_storage_state` on production — the one capability there beyond
  observation. Recommended: keep it. It changes browser state, not server state, and
  authenticating is how production is reached at all.
- **Should commit obligations be answered in writing?** Proposed: when handing a commit
  over, the agent answers each obligation `npm run precommit` prints, one line each, so
  the user reviews answers rather than taking "precommit ran" on trust. A
  `work-discipline` rule, no code. Prompted by a skill-catalogue obligation that fired,
  was skipped, and was right.
- **Remove `AGENT_MAX_TURNS=12` from the local `.env`.** Setting it overrides every
  role's declared budget — a run showed test-planner capped at 12 against the 20 it
  asks for. `.env.example` no longer ships it; the live `.env` still sets it, and
  agents do not edit `.env`.

## Considered and declined

Kept because a rejection with no reasons gets re-proposed. Reopen any of these on new
evidence — but bring the evidence, not the idea again.

| Proposal                                                                           | Declined because                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Durable memory as a queryable cross-agent store** (from Kody)                    | `HANDOFF.md` and `CLAUDE.md` already serve this at this size, file-based. A query layer would be overhead, not capability                                                                                                                                                                                                                                                                                 |
| **Packages as publishable / forkable units** (from Kody)                           | App folders here are subjects under test. They are meant to be deleted, not shared outside the repo                                                                                                                                                                                                                                                                                                       |
| **Per-project scoping of test runs**                                               | Measured at a 4% saving on 2026-09-11 after being confidently proposed. Not worth the complexity                                                                                                                                                                                                                                                                                                          |
| **Multi-provider for the agent roles themselves** (see queue item 9)               | The Claude Agent SDK is Anthropic-only by construction. A second provider belongs in a single-shot sibling seam, not in `runAgent`                                                                                                                                                                                                                                                                        |
| **A Context7 MCP server for library documentation** (2026-09-13)                   | The installed package is the authority: `node_modules`, its `.d.ts` and `--help` are the version actually run, and a test already scans the package so a release is caught. It would add an unclassified tool surface, a third-party text channel into agent context, and a network hole in a deliberately hermetic client. Revisit when a role must work against a library that is not installed locally |
| **A maintainer / DevOps role for documentation upkeep**                            | A role has to be invoked, and not being invoked was the failure; only the author of a change knows why its docs must change. The upkeep lives in the `work-discipline` end gate, run before every commit through `npm run precommit`                                                                                                                                                                      |
| **Timestamped results files in place of `results.json`**                           | A run that bypasses the configured reporters writes no file under any name, and readers would have to pick "the newest file" — which is how an old run gets quoted. History is kept as copies beside the fixed file instead: item 26                                                                                                                                                                      |
| **Scripting every heuristic** (2026-09-14)                                         | A script that decides what matters or whether something is wrong produces a confident, tidy false negative. Those stay judgement in `src/qe/heuristics.ts`, each with its reason, and `npm run ideas` prints them as what is still the reader's to do                                                                                                                                                     |
| **An automatic repair pass after a failed post-run gate** (2026-09-14)             | The user chose stop and report: a person reading why the gate failed is cheaper than a second run spent on a finding nobody looked at                                                                                                                                                                                                                                                                     |
| **Letting an agent read its skills on demand**                                     | That was the state before 2026-09-14, and a skill left for the agent to choose to read went unread when it mattered. The runner injects the text instead                                                                                                                                                                                                                                                  |
| **`canUseTool` as the guard path**                                                 | A permission handler, and runs use `bypassPermissions`. One `PreToolUse` hook carries every guard; two paths for one rule would leave neither shown to work                                                                                                                                                                                                                                               |
| **One lock for the whole checkout** (2026-09-14)                                   | Once each run has its own worktree, files no longer collide; what still does is the deployment two runs write to. The lock is per app and environment, so runs against different targets proceed side by side                                                                                                                                                                                             |
| **Tracking an agent's edits by comparing the tree before and after**               | Chosen first, then replaced the same day. A person's edits during the run land in the same comparison, and a tool that restores a timestamp hides its own. A worktree makes the run's changes separable by construction instead of by inference                                                                                                                                                           |
| **A branch per run, or a patch file as the run's output**                          | The user chose uncommitted work in the worktree. A branch is a name to clean up and invites merging by automation; a patch is a copy of what `git -C <worktree> diff` already shows. A person reviews in place and brings the work in                                                                                                                                                                     |
| **Fixed ports for servers the harness starts**                                     | A server a crashed run left behind answers the next run's specs, which then test the wrong process. A free port per run, passed through `portEnv`                                                                                                                                                                                                                                                         |
| **Overriding a failed gate, or retrying it**                                       | A failure is a finding. Its cause is proved — test design, app behaviour against a named oracle, or a flake with a measured rate — before anything runs again. The runner prints the investigator command and a person starts it, because starting it spends                                                                                                                                              |
| **Generating complete spec files from a scan**                                     | A generated spec encodes today's behaviour as the expected result, which is the oracle problem with the judgement removed. Values, sequences and tags are generated; the expected outcome and the decision to write the test stay with the author                                                                                                                                                         |
| **Installing skills automatically** (from `marvin-template`, 2026-09-14)           | It runs `npx skills add … -g -y` on start and installs suggested skills on request. A skill is a stranger's prompt text, and registry audits say nothing about prompt injection. Skills from skills.sh are read and compared, never installed — item 25                                                                                                                                                   |
| **Cloning and running a toolkit at runtime** (from `marvin-template`)              | Its software-engineering skill runs `git clone … && ./setup` mid-session: unreviewed code executed by an agent. Dependencies arrive through `package-lock.json` in a reviewed commit                                                                                                                                                                                                                      |
| **An agent writing real API keys into `.env`** (from `marvin-template`)            | An agent here never reads a `.env` value, let alone writes one. A person creates and enters every key                                                                                                                                                                                                                                                                                                     |
| **Safety as a confirmation the prompt asks for** (from `marvin-template`)          | "Confirm before sending" is a promise the model makes. Bounds here are the tool allowlist and the `PreToolUse` guard, which the model cannot talk its way past                                                                                                                                                                                                                                            |
| **Letter grades computed from finding counts** (from `marvin-template`'s `harden`) | A grade hides the evidence each finding rests on; two claimed findings can outscore one proven blocker. Reports here carry evidence per finding                                                                                                                                                                                                                                                           |

## Keeping this file honest

Lettered like the architecture gaps, because they are the same kind of thing: known
structural weaknesses rather than features.

This file drifted through the whole of 2026-09-13 and was only brought up to date when
the user asked. That is not carelessness; it was one unenforced rule, and every rule in
this repo that survives is mechanically checked. Three causes, three fixes:

| #   | Cause                                                                                         | State                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Nothing checked it.** The end gate was prose in a file that asked nicely                    | **Done, differently than planned.** Not in `gate.ts`: `npm run precommit` refuses a `PLAN.md` whose recorded head is not HEAD, alongside dead commands and paths, undocumented commands, and uncatalogued skills. A blocker at the commit, not a risk |
| D2  | **Updating was expensive**, so it got skipped                                                 | **Done.** `npm run plan:facts` prints the numbers this file quotes from the runs that produced them and refuses any older than the code. Built once the cost bit: a hand-typed count read a stale results file and quoted 414 tests when 420 existed  |
| D3  | **A session has no end.** "End gate" presumed a boundary an interactive session never reaches | **Done.** The `work-discipline` end gate is now "before every commit" and runs `npm run precommit`, whose judgement list is derived from the diff                                                                                                     |

None of this makes anyone diligent — it makes the failure visible, which is the only
version that has worked here before. It still cannot catch a sentence that was true and
quietly stopped being true; that is what reading the judgement list is for.

## Architecture gaps

| #   | Gap                               | State                                                                                                                |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A1  | No accumulation                   | Locator baselines exist (`qe/baselines.ts`); scans and crawls still overwrite                                        |
| A2  | No provenance                     | A spec does not record which scan it was authored against                                                            |
| A3  | Drift detection                   | Half done — the healer reports drift when it resolves; there is no scan-against-scan diff                            |
| A4  | Healing must propose, never apply | **Closed.** Every heal reaches the gate as a risk naming a replacement selector that was verified to resolve         |
| A5  | No performance or security pass   | Two benchmark categories with no capability. Queue item 8, and see `docs/sources.md` for the engines Trowser bundles |

## Subjects

Six registered: `todo-fixture` (local fixture), `countdown-timer`, `juice-shop` (local
plus public demo — the only two-environment subject), `polymer-shop` (real shadow DOM),
`fakerestapi`, `petstore` (a declared OpenAPI spec, so the inferred data dictionary can
be checked against a contract).

Used but not registered: **`academybugs`** (the scored benchmark above), `the-internet`,
`rigassatiksme`, `adayinhistory`. Candidate, not yet registered: **`mcpa-bot`** (queue
item 11) — it is its own repository and nothing from it is copied in.

Parked with reasons in `apps/README.md`: uitestingplayground · saucedemo · qaplayground ·
automationexercise · demoqa · testsheepnz calculator · parabank · parkcalc ·
qa-practice · applitools demo · gh-users-search · realworld · bugeater ·
practice-software-testing.

## Recently closed

| Item                                          | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A role run rested on the agent's word (F1–F7) | **DONE** — drawn first, then specified in `docs/agent-workflows.md` and built: preflight refuses a run missing its inputs (a coder needs `--design`); declared skills injected as text; one `PreToolUse` hook guards every tool call, `Bash` included; per-role wall clocks; a post-run gate re-checks what the run changed, including `npm run fault-check` on app specs, and stops rather than retrying. Found while building: the browser guard sat on `canUseTool`, which `bypassPermissions` may skip; and a nested Playwright run cleared the outer run's traces. Enforced and tested, not yet exercised live |
| Runs could not be told apart (G1–G5)          | **DONE** — reviewing `docs/agent-workflows.md` against its own principles found concurrency, attribution and cleanup patched one by one, which meant one broken principle: a run's effects must be separable. A worktree per run, a lock per target, a port per run, the design required at the base commit, one registry resolution feeding the browser, the shell and `TEST_ENV`. Found before commit: removing a worktree deleted the checkout's `node_modules`, and tool paths were relative to the working directory                                                                                           |
| Heuristics with no bridge to action (E4)      | **DONE** — `src/qe/heuristics.ts` sorts each by what does the work; `npm run ideas` prints the generated cases from a saved scan, with values importable from `src/fixtures/probes.ts` so specs loop rather than retype; `assert-quality` gates a write checked only by its render and a write never read back. The first run on real pages found three flaws the unit fixtures had agreed with — a bodiless beacon offered as a read-back, login probes tagged for shared environments, duplicate cases — each now a test and a mutation                                                                           |
| The gate judged the wrong suite               | **DONE** — `npm run test:external` wrote the same results file as `npm test`, and the gate then returned PASS over 22 external tests without seeing the local suite. External runs now write `results-external.json`                                                                                                                                                                                                                                                                                                                                                                                                |
| Plan numbers typed by hand                    | **DONE** — `npm run plan:facts` reads them from the runs and refuses any older than the code, after a hand-typed count quoted a stale file                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Documentation drifted unchecked               | **DONE** — `npm run precommit`: dead commands and paths, undocumented commands, uncatalogued skills, a stale plan head; obligations derived from the diff                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| "Regenerate, never hand-patch" misfired       | **DONE** — redefined as "kept accurate": re-run every number, update what changed, delete what is no longer true                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A way to see                                  | **DONE** — Playwright MCP, granted per role and per environment. Proved by a role reporting an occlusion, which no DOM query returns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| The exploration policy bound nothing          | **DONE** — it compiles to the tool allowlist, the browser's allowed origins, and a fail-closed per-call guard. `actionAllowed` had no caller for months                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| The toolbox was invisible                     | **DONE** — every role gets it; three of eight had named a single tool each. Every command in it is checked against `package.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Prompt logic nothing could test               | **DONE** — `session-briefing.ts`, after an inline contradiction cost 4 turns and $0.2613 against 1 turn and $0.1871                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Agent-to-skill pairing                        | **DONE** — every skill declared by a role through the SDK's `skills` field, prose and field must agree, nothing orphaned, all enforced                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Roles conflated two kinds of work             | **DONE** — a `coding` family and a `testing` family, as data in `roles.ts` rather than a naming convention. Two names that lied were corrected                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Design done by whoever wrote the code         | **DONE** — `test-planner` owns risk and design and holds no Edit; the four coders shed `test-design`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Delegation wired and dead                     | **DONE** — `role.ts` passes `agents`; the coding family holds the `Agent` tool and is told to call the planner for a named gap. **Never yet exercised**                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Model chosen in three places that disagreed   | **DONE** — `src/agents/models.ts`. Roles no longer pin a model, so a subagent inherits its parent's and a delegated planner cannot end up on another model                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Turn budgets one flat number                  | **DONE** — per-tier multipliers over what each role declares. `.env.example` no longer ships `AGENT_MAX_TURNS`, which had been cutting every role to 12                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Harness read `.env` relative to cwd           | **DONE** — anchored to the module. A subject's secrets can no longer reach the harness process. mcpa-bot had this right first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `.env.example` claimed a key was required     | **DONE** — it is optional; OAuth suffices, and that is now measured and dated in the file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Element identity and fuzzy matching           | **DONE** — one scorer; decisive signals set a floor rather than casting a vote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Self-healing                                  | **DONE** — baselines, resolution, drift, verified proposals, every heal gated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Three detector false positives                | **DONE** — occlusion measured after scrolling, hover given a control group, `alt` added to the name ladder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| One report mixing three audiences             | **DONE** — the map, the product findings, automation readiness, in that order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ISTQB techniques named but not defined        | **DONE** — `test-techniques`, with derivation rules and coverage criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| No method for looking at a page               | **DONE** — `visual-inspection`, written after three defects were missed by looking once                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Inventory taken before a page settled         | **DONE** — settle unconditionally, and the map now declares whether it is a floor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Plans change; facts go stale

Two kinds of content live here and only one is at risk. Judgements — what to build
next, and why — age slowly. Facts — counts, verdicts, what is proven — age the moment a
command runs. Every number above came from a command run at this gate. If the tree has
moved since, re-run them rather than trusting the page.
