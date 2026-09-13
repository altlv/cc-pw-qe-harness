# PLAN — where we are and what is next

Regenerated at each end gate, never hand-patched. Status and next actions live
together because they are one sentence: what is true now decides what comes next.

Durable working agreements live in `HANDOFF.md`. Facts about an app under test live in
that app's `README.md`. Why a line of code exists lives in a comment next to it.
Attribution lives in `docs/sources.md`. None of that belongs here.

**Regenerated:** 2026-09-13, commands re-run at the gate.

## Where we are

Head is `092b9b9`. One uncommitted tree on top: agent roles split into two families,
a planning role, delegation turned on, model and budget configuration centralised, and
`.env` isolation.

## Proven — direct evidence, re-run at this gate

- `npm test` **350 passed** — unit 258, harness 63, integration 22, todo-fixture 7 ·
  `npm run test:external` **22**
- `npm run gate` **PASS** · `npm run assert-quality` **28 files, 0 findings**
- `npm run mutate` **70/70**, one mutation per enforced rule, no survivors
- `npm run check` clean
- **A role runs.** `test-planner` executed against the live API on 2026-09-13: 1 turn,
  $0.1677, 6s, returned what it was asked for
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
- **Self-healing has never faced a change someone else made.**
- Framework detection is largely unverified; three tiers confirmed against live sites.
- Seven of eight roles have never run. No role has written a browser spec.

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
moved that number. The 2026-09-11 work fixed how the map reads; the 2026-09-13 work
fixed who does the thinking and what pays for it. Neither clicked anything.

## Work queue

Ordered so nothing appears before what it needs. The **blocked by** column is the
ordering — if it is empty, it can start today.

An earlier version of this table had E5 first and E4 sixth, while E5's own
description read "action selection under E4". Ranking by importance rather than by
dependency puts the most-wanted thing on top and quietly makes it unstartable.

### Foundations — nothing waits on these

| #   | Item                                                                                                                  | Blocked by | Why                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **E4 — heuristics as a callable layer.** Trigger to move                                                              | —          | The driver's action selection reads from this. Without it a driver is a random clicker. 183 heuristic items exist across the skills with no bridge from any of them to an action       |
| 2   | **A way to see.** No role has a screenshot tool, and `visual-inspection` says outright that it cannot run without one | —          | Roughly half the defects found by hand were visible and unqueryable: a tile 30px short, a panel over the footer, a cart preview off the page edge. Also gates the driver's visual work |

### Then — in this order

| #   | Item                                                                                                                                | Blocked by | Why                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | **E5 — the driver.** Action selection under E4, obeying the environment policy, diffing via `identity.ts`                           | 1, 2       | The blocker on the benchmark number. Everything the harness misses, it misses for want of a click                                                                               |
| 4   | **The map is a single state.** Transient surfaces — mini-cart, dropdown, modal, toast, drawer — appear in no inventory and no crawl | 3          | Reaching them means opening them, which means interacting. A defect was missed for exactly this reason: the cart page was tested thoroughly and the cart _preview_ never opened |
| 5   | **E6 — enforce the session report** through `check-report`                                                                          | —          | Could start now; wanted before E7, because an unenforced report format is how a session's findings quietly go missing                                                           |
| 6   | **E7 — a real agent session against the scored benchmark**                                                                          | 1–3, 5     | The empirical test of all of it, and the only thing that turns "better" from opinion into a number. No longer blocked on a key — OAuth works                                    |

### Independent — any time, in any order

| #   | Item                                                                                                                                                                                                  | Why                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **`storageState`**, captured once by a person and replayed by the harness                                                                                                                             | The authenticated half of every app is otherwise permanently dark. An agent never enters credentials, so this is the only route in: `playwright codegen --save-storage`                                                                  |
| 8   | **A performance pass** — `performance.getEntriesByType`, roughly fifteen lines                                                                                                                        | One of the five benchmark categories has no capability at all. Fifteen hand-written lines found ~3x oversized images, 2.2MB of payload and a dead CDN                                                                                    |
| 9   | **Multi-provider / multi-model, as a side quest.** A second seam — `askModel(model, prompt)`, single-shot, no tools, no budget loop — reaching OpenRouter (Gemini and the rest) beside the Claude SDK | The SDK is Anthropic-only by construction: it recognises `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, Bedrock and Vertex, and nothing else. So this is a **sibling of `runAgent`, never a replacement**. See below |
| 10  | **`AgentDefinition.skills` under `settingSources: []`** — one live run that proves a declared skill is actually preloaded, or shows it is not                                                         | Every role now declares skills through the SDK field. If discovery needs setting sources we have added structure that does nothing, and the prose is carrying it alone                                                                   |
| 11  | **Register `mcpa-bot` as a subject** at its external path, the way `juice-shop` is                                                                                                                    | Local Express app, own `.env`, nine `node:test` files and Playwright e2e **with page objects** — so it exercises item 15 with a real example, and its existing tests are ground truth to check an agent's findings against               |

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

This file drifted through the whole of 2026-09-13 and was only regenerated when the
user asked, having already been hand-patched on 09-12 against its own stated rule.
That is not three people being careless; it is one unenforced rule, and every rule in
this repo that survives is mechanically checked. Diagnosed as three separate causes,
so each gets its own fix rather than a resolution to try harder.

| #   | Cause                                                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Nothing checks it.** The end gate is prose in a file that asks nicely                                               | Staleness detection in `gate.ts`, reusing the mechanism at `src/cli/gate.ts:79` that already refuses test results older than their source. This file records the commit it was regenerated at; the gate compares against HEAD and the working tree. Stale is a **risk in the verdict, never a blocker** — a blocker mid-session gets disabled inside a week |
| D2  | **Regenerating is expensive.** ~200 lines and four commands, so it gets shortcut into a hand-patch                    | `npm run plan:facts` emits the _Proven_ block from real commands, ready to paste. The judgement half stays written by hand; the counts stop being typed by hand. Hold this until D1 and D3 have been tried — if they work, the cost stops mattering                                                                                                         |
| D3  | **A session has no end.** "End gate" presumes a boundary that an interactive session never reaches; it just continues | Move the trigger from _end of session_ to **before every commit**. The user owns every commit, which makes it a real, frequent, observable boundary, and `npm run gate` already runs there                                                                                                                                                                  |

D1 and D3 are worth doing together and are roughly thirty lines against machinery that
already exists. None of this makes anyone diligent — it makes the failure visible,
which is the only version that has worked here before.

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
