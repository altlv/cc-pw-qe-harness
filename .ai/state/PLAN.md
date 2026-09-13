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

Head is `7c04a40` — the commit this file was last checked against. A file cannot name
the commit that contains it, so `npm run precommit` accepts HEAD itself, or HEAD's
parent when the latest commit updated this file.

Roles drive a real browser through Playwright MCP, bounded by the exploration policy at
three layers; the toolbox reaches every role; the session briefing is a tested module
rather than inline prompt text; `npm run precommit` guards documentation drift before
each commit.

## Proven — direct evidence, re-run before this commit

- `npm test` **420 passed** — unit 320, harness 63, integration 30, todo-fixture 7 ·
  `npm run test:external` **22**
- `npm run gate` **PASS** · `npm run assert-quality` **34 files, 0 findings**
- `npm run mutate` **80/80**, one mutation per enforced rule, no survivors
- `npm run check` clean · `npm run precommit` clean
- **A role runs.** `test-planner` executed against the live API on 2026-09-13: 1 turn,
  $0.1677, 6s, returned what it was asked for
- **A role sees.** `testability-reviewer` against academybugs under a `prod` policy
  reported "a cookie-consent banner overlapping the third product image" — an
  occlusion, which is a spatial fact no DOM query returns. 4 turns, $0.0728, 17s
- **A role reasons from a pre-computed map.** Given `npm run scan` output, it named
  `getByRole('link', { name: "Select Options" })` as the most fragile selector on the
  page — three products, one accessible name, "resolves, looks valid, and silently
  clicks the wrong product instead of failing loud"
- **The policy binds three ways, none of them a promise the model makes:** the tool
  allowlist (what it may hold), the browser's own `--allowed-origins` (where it may
  go), and a fail-closed `canUseTool` guard (which target, and how many times)
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
- **No skill has ever been invoked by name.** Demonstrated at cost on 2026-09-11:
  `oracle-check` already held the exact oracle that found nearly every bug in a manual
  session, and went unread because nothing made anyone read it.
- **`AgentDefinition.skills` may be inert.** Every role now declares its skills through
  the SDK's own field, but `client.ts` runs hermetic (`settingSources: []`) and project
  skill discovery may depend on those sources. If it does, the prose is still doing all
  the work. One live run with a skill-specific probe settles it.
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

### Foundations — nothing waits on these

| #   | Item                                                     | Blocked by | Why                                                                                                                                                                              |
| --- | -------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **E4 — heuristics as a callable layer.** Trigger to move | —          | The driver's action selection reads from this. Without it a driver is a random clicker. 183 heuristic items exist across the skills with no bridge from any of them to an action |

### Then — in this order

| #   | Item                                                                                                                                | Blocked by | Why                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | **E5 — the driver.** Action selection under E4, diffing via `identity.ts`                                                           | 1          | Much smaller than it was: the hands exist and are bounded, so this is now action _selection_ rather than a driver. Set `allowWrites` and give it something to choose with       |
| 4   | **The map is a single state.** Transient surfaces — mini-cart, dropdown, modal, toast, drawer — appear in no inventory and no crawl | 3          | Reaching them means opening them, which means interacting. A defect was missed for exactly this reason: the cart page was tested thoroughly and the cart _preview_ never opened |
| 5   | **E6 — enforce the session report** through `check-report`                                                                          | —          | Could start now; wanted before E7, because an unenforced report format is how a session's findings quietly go missing                                                           |
| 6   | **E7 — a real agent session against the scored benchmark**                                                                          | 1–3, 5     | The empirical test of all of it, and the only thing that turns "better" from opinion into a number. No longer blocked on a key — OAuth works                                    |

### Independent — any time, in any order

| #   | Item                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **`storageState`**, captured once by a person and replayed by the harness                                                                                                                             | The authenticated half of every app is otherwise permanently dark. An agent never enters credentials, so this is the only route in: `playwright codegen --save-storage`                                                                                                                                                                                                                                                                                                                        |
| 8   | **A performance pass** — `performance.getEntriesByType`, roughly fifteen lines                                                                                                                        | One of the five benchmark categories has no capability at all. Fifteen hand-written lines found ~3x oversized images, 2.2MB of payload and a dead CDN                                                                                                                                                                                                                                                                                                                                          |
| 9   | **Multi-provider / multi-model, as a side quest.** A second seam — `askModel(model, prompt)`, single-shot, no tools, no budget loop — reaching OpenRouter (Gemini and the rest) beside the Claude SDK | The SDK is Anthropic-only by construction: it recognises `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, Bedrock and Vertex, and nothing else. So this is a **sibling of `runAgent`, never a replacement**. See below                                                                                                                                                                                                                                                       |
| 10  | **`AgentDefinition.skills` under `settingSources: []`** — one live run that proves a declared skill is actually preloaded, or shows it is not                                                         | Every role now declares skills through the SDK field. If discovery needs setting sources we have added structure that does nothing, and the prose is carrying it alone                                                                                                                                                                                                                                                                                                                         |
| 11  | **Register `mcpa-bot` as a subject** at its external path, the way `juice-shop` is                                                                                                                    | Local Express app, own `.env`, nine `node:test` files and Playwright e2e **with page objects** — so it exercises item 15 with a real example, and its existing tests are ground truth to check an agent's findings against                                                                                                                                                                                                                                                                     |
| 24  | **Measured trial: `microsoft/playwright-cli` against Playwright MCP.** Same role, same task, same page; compare cost, turns, and exactly which policy bounds are lost                                 | Microsoft's own README positions the CLI as the alternative for coding agents — "token-efficient. Does not force page data into LLM" — which matches our measurement that the accessibility tree is the expensive way to look. The price: every bound here is built on MCP tool names, and a CLI runs through `Bash`, where neither the allowlist nor `canUseTool` can bind a subcommand. Split to be proven, not assumed: testing roles keep MCP, `e2e-coder` authors via the CLI. Apache-2.0 |
| 25  | **Review the test skills on skills.sh as benchmarks** — read, never install, and compare against our own. Shortlist below                                                                             | Recreating what already exists well is waste; missing a technique someone else found is worse. Registry audits (Gen Agent Trust Hub, Socket, Snyk) are partial — many entries show Pending — and nothing states they cover prompt injection, the real risk in a skill. Check each licence before taking anything and credit it in `docs/sources.md`                                                                                                                                            |

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

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | **A triage ledger for test failures**, from Kody: a failure signature maps to `{status, note, who, when}` in `.ai/state/triage.json`, never deleted, and `gate.ts` reads it so a diagnosed flake becomes a documented risk instead of being re-litigated or silently retried away each run. `heal.ts` already carries exactly this for locators; there is no equivalent memory for test failures |
| 13  | **Split app docs by audience**, from Kody — each `apps/<name>/` gets a human-facing `README.md` (what, prerequisites, done-when) and an agent-facing `AGENTS.md` (how to invoke, smoke tests, edge cases), instead of one README serving both readers badly                                                                                                                                      |
| 14  | **Event-first triage**, from Kody — trigger `triageFailure` off a failed CI run rather than a schedule. Only matters once triage runs unattended; today it is 100% human-invoked                                                                                                                                                                                                                 |
| 15  | **Analyzer blind to Page Objects** — `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(`                                                                                                                                                                                                                                                   |
| 16  | **LICENSE** — a public repo with none is legally unusable. **User's decision**                                                                                                                                                                                                                                                                                                                   |
| 17  | CI actions target Node 20; GitHub is migrating to 24. A `@v5` bump clears the annotation                                                                                                                                                                                                                                                                                                         |
| 18  | `apps/todo-fixture/coverage.md` — three skills point at `apps/<app>/coverage.md` and only countdown-timer has one                                                                                                                                                                                                                                                                                |
| 19  | Fresh-clone verification: `npm ci` → browsers → all suites, proving it works for someone who is not us                                                                                                                                                                                                                                                                                           |
| 20  | The crawl writes no artefact, so two crawls cannot be diffed                                                                                                                                                                                                                                                                                                                                     |
| 21  | Scans overwrite and nothing reads one back — no drift detection between runs                                                                                                                                                                                                                                                                                                                     |
| 22  | Recipes 0 of 9 · agent contracts 7 of 22 · schemas for requirements-analysis and triage-report not ported                                                                                                                                                                                                                                                                                        |
| 23  | **`maxStates` enforcement** — needs the driver's state model; the per-call guard cannot see state. Pairs with item 3                                                                                                                                                                                                                                                                             |

## Considered and declined

Kept because a rejection with no reasons gets re-proposed. Reopen any of these on new
evidence — but bring the evidence, not the idea again.

| Proposal                                                             | Declined because                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Durable memory as a queryable cross-agent store** (from Kody)      | `HANDOFF.md` and `CLAUDE.md` already serve this at this size, file-based. A query layer would be overhead, not capability          |
| **Packages as publishable / forkable units** (from Kody)             | App folders here are subjects under test. They are meant to be deleted, not shared outside the repo                                |
| **Per-project scoping of test runs**                                 | Measured at a 4% saving on 2026-09-11 after being confidently proposed. Not worth the complexity                                   |
| **Multi-provider for the agent roles themselves** (see queue item 9) | The Claude Agent SDK is Anthropic-only by construction. A second provider belongs in a single-shot sibling seam, not in `runAgent` |

## Keeping this file honest

Lettered like the architecture gaps, because they are the same kind of thing: known
structural weaknesses rather than features.

This file drifted through the whole of 2026-09-13 and was only brought up to date when
the user asked. That is not carelessness; it was one unenforced rule, and every rule in
this repo that survives is mechanically checked. Three causes, three fixes:

| #   | Cause                                                                                         | State                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Nothing checked it.** The end gate was prose in a file that asked nicely                    | **Done, differently than planned.** Not in `gate.ts`: `npm run precommit` refuses a `PLAN.md` whose recorded head is not HEAD, alongside dead commands and paths, undocumented commands, and uncatalogued skills. A blocker at the commit, not a risk |
| D2  | **Updating was expensive**, so it got skipped                                                 | **Open, smaller.** The rule no longer demands a full rewrite — targeted updates are allowed, and re-running the numbers is the cost that remains. `npm run plan:facts` to emit the _Proven_ block is held until that cost actually bites              |
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

| Item                                        | Outcome                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation drifted unchecked             | **DONE** — `npm run precommit`: dead commands and paths, undocumented commands, uncatalogued skills, a stale plan head; obligations derived from the diff  |
| "Regenerate, never hand-patch" misfired     | **DONE** — redefined as "kept accurate": re-run every number, update what changed, delete what is no longer true                                           |
| A way to see                                | **DONE** — Playwright MCP, granted per role and per environment. Proved by a role reporting an occlusion, which no DOM query returns                       |
| The exploration policy bound nothing        | **DONE** — it compiles to the tool allowlist, the browser's allowed origins, and a fail-closed per-call guard. `actionAllowed` had no caller for months    |
| The toolbox was invisible                   | **DONE** — every role gets it; three of eight had named a single tool each. Every command in it is checked against `package.json`                          |
| Prompt logic nothing could test             | **DONE** — `session-briefing.ts`, after an inline contradiction cost 4 turns and $0.2613 against 1 turn and $0.1871                                        |
| Agent-to-skill pairing                      | **DONE** — every skill declared by a role through the SDK's `skills` field, prose and field must agree, nothing orphaned, all enforced                     |
| Roles conflated two kinds of work           | **DONE** — a `coding` family and a `testing` family, as data in `roles.ts` rather than a naming convention. Two names that lied were corrected             |
| Design done by whoever wrote the code       | **DONE** — `test-planner` owns risk and design and holds no Edit; the four coders shed `test-design`                                                       |
| Delegation wired and dead                   | **DONE** — `role.ts` passes `agents`; the coding family holds the `Agent` tool and is told to call the planner for a named gap. **Never yet exercised**    |
| Model chosen in three places that disagreed | **DONE** — `src/agents/models.ts`. Roles no longer pin a model, so a subagent inherits its parent's and a delegated planner cannot end up on another model |
| Turn budgets one flat number                | **DONE** — per-tier multipliers over what each role declares. `.env.example` no longer ships `AGENT_MAX_TURNS`, which had been cutting every role to 12    |
| Harness read `.env` relative to cwd         | **DONE** — anchored to the module. A subject's secrets can no longer reach the harness process. mcpa-bot had this right first                              |
| `.env.example` claimed a key was required   | **DONE** — it is optional; OAuth suffices, and that is now measured and dated in the file                                                                  |
| Element identity and fuzzy matching         | **DONE** — one scorer; decisive signals set a floor rather than casting a vote                                                                             |
| Self-healing                                | **DONE** — baselines, resolution, drift, verified proposals, every heal gated                                                                              |
| Three detector false positives              | **DONE** — occlusion measured after scrolling, hover given a control group, `alt` added to the name ladder                                                 |
| One report mixing three audiences           | **DONE** — the map, the product findings, automation readiness, in that order                                                                              |
| ISTQB techniques named but not defined      | **DONE** — `test-techniques`, with derivation rules and coverage criteria                                                                                  |
| No method for looking at a page             | **DONE** — `visual-inspection`, written after three defects were missed by looking once                                                                    |
| Inventory taken before a page settled       | **DONE** — settle unconditionally, and the map now declares whether it is a floor                                                                          |

## Plans change; facts go stale

Two kinds of content live here and only one is at risk. Judgements — what to build
next, and why — age slowly. Facts — counts, verdicts, what is proven — age the moment a
command runs. Every number above came from a command run at this gate. If the tree has
moved since, re-run them rather than trusting the page.
