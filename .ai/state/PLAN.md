# PLAN — where we are and what is next

Regenerated at each end gate, never hand-patched. Status and next actions live
together because they are one sentence: what is true now decides what comes next.

Durable working agreements live in `HANDOFF.md`. Facts about an app under test live
in that app's `README.md`. Why a line of code exists lives in a comment next to it.
None of that belongs here.

**Checked:** 2026-09-10, commands re-run at the gate.

## Where we are

Clean tree, pushed. Three commits landed 2026-09-10: `5ad1a7b` scanner re-centred on
identify and interact, `d0c16c0` rules of engagement, `7951117` definition of done.
Each was verified to build and pass on its own. CI green — run 34460682606.

## Proven (direct evidence, re-run at this gate)

- `npm test` **166 passed** · `npm run test:external` **22 passed**
- `npm run gate` **PASS** · `npm run assert-quality` **16 files, 0 findings**
- `npm run mutate` **22/22**, after five new mutations were added and two survived
  first time — one rule was untested, one was masked by a rule behind it
- `npm run check` clean
- Scanner re-centring verified on a real app: the countdown timer went from a finding
  per element to two, both real — the defect a role previously found by hand
- Environment gating verified in **both** directions: a prod-policy log contains no
  payload text; the local log does
- Occlusion detection verified in both directions: fires on a real overlay naming the
  culprit, silent on two known-good pages

## Not proven — do not claim otherwise

- **No exploratory session has ever been run.** Skill, role and checklist all exist;
  none has been exercised. The largest unproven claim in the repo.
- **Self-healing has never run against a real application change.** The mechanism is
  built and proven against staged changes — regenerated ids, reworded labels, a moved
  link, a shadow-root control — plus the refusals. What no run has yet produced is a
  heal caused by someone else changing a real app.
- **Framework detection is ~92% unverified** — see D1.
- Five of seven roles have never run. No role has written a _browser_ spec.
- No skill has been invoked by name.

## The exploration loop — the current thread

Exploration is **interact → observe → hypothesise → test the hypothesis**. Scanning and
logging are tooling that supports it; heuristics and session reports are separate tools
that also support it. All are needed.

**Order of work: W → E3 → E4 → E5 → E6 → E7.**

**W — walk three subjects, one at a time.** Agreed 2026-09-10, and it comes before E3
deliberately. E3's scorer needs signal weights — how much a matching role is worth
against an id, a name, a position — and inventing those numbers is guessing. Three
deliberately different apps give real data to derive them from:

| Order | Subject              | Env   | Why this one                                                                                                                                                                                                 |
| ----- | -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W1    | **Swagger Petstore** | test  | The only API that ships a **declared OpenAPI spec**, so the data dictionary stops being something we trust and becomes something we can check against a contract. Read-only; no objects created              |
| W2    | **Polymer Shop**     | test  | A real online shop whose browsing is read-only (client-side cart, no account, no payment) and **real shadow DOM** — the hardest element-identity case, and the one we currently declare rather than see into |
| W3    | **juice-shop**       | local | Angular, source access, two environments. Source access is the point: when the scanner claims a control exposes no state we can read the component and know whether we are right                             |

Signals the three are chosen to span: Angular's build-generated ids (so `id` must score
low), identity behind a shadow boundary, and an API with no DOM at all where sameness
rests entirely on payload shape.

**Verify:** D1 detection on two real frameworks · scanner findings on apps nobody built
for us · occlusion against a live cookie banner rather than a fixture · the dictionary
against a published contract · the environment machinery end to end on the one subject
with two deployments.

**Improve, expected:** D3 shadow-DOM traversal, which the Polymer shop turns from an
admitted blind spot into an obvious hole · D2 tests for `stack.ts`/`probe.ts` ·
E3 signal weights, derived rather than invented.

### What the walk found so far (2026-09-10)

**W2 Polymer Shop — three real bugs, one of them severe.**

- The scan reported **0 interactive elements on a working storefront**. Every control
  lives inside `<shop-app>`'s shadow root, and declaring that as a blind spot was
  honest and useless. The scanner now walks open shadow roots iteratively: 0 -> 10
  controls, 1 -> 7 hosts found through nesting.
- **`elementFromPoint` does not pierce shadow DOM**, so it returns the _host_ and
  every shadow control reported as "covered by `<shop-app>`" — a false positive on
  every Web Components app in existence. The hit test now descends through each root
  at the same point. 3 blocked -> 0.
- **Polymer was not detected** while `<dom-module>` and `<custom-style>` sat in its own
  DOM. Added Polymer and Lit; rendering went `server-rendered` -> `spa`, which is
  correct.
- Finding order corrected: a nameless control that is _also_ duplicated is duplicated
  **because** it is nameless, so `unaddressable` now precedes `ambiguous`. The
  actionable fix is the missing name.
- Regression checked both ways: todo-fixture still 0 findings, countdown-timer still
  its 2 real ones.

**W1 Swagger Petstore — the data dictionary validated against an independent oracle.**
Inferred the `Pet` shape from live `findByStatus` responses and compared it to the
published `swagger.json`: **6 of 6 fields agree**, types included. Until now
`schema.ts` was only ever checked against tests we wrote ourselves. No divergence
found on this endpoint, so no defect in the service either — worth re-running against
a less canonical API before trusting the technique broadly.

**D1 progress: 2 of 13 detectors confirmed live** — jQuery and Polymer. Angular waits
on W3.

**Not covered, deliberately:** writes, auth and destructive paths are exercised only on
juice-shop local. The two remote subjects prove nothing about `storageState` or
write-refusal on a live system.

| #   | Stage                     | State                                                                                                                                                                                                                                             | Blocked by |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E1  | **Observe**               | DONE — stack profile, affordances, input constraints, observable state, data dictionary from captured traffic                                                                                                                                     | —          |
| E2  | **Rules of engagement**   | DONE — session-start checklist plus an enforced policy; body capture gated by environment                                                                                                                                                         | —          |
| E3  | **Identity + matcher**    | DONE — one scorer answers "are these two observations the same element?" with decisive signals setting a floor rather than casting a vote; serves self-healing, fuzzy matching, drift detection **and** state-diffing                             | —          |
| E3b | **Healer + baselines**    | DONE 2026-09-11 — `heal.ts` resolves a baseline against the live page, `qe/baselines.ts` keeps baselines between runs, the `healing` fixture is the call site, and every heal reaches the gate as a recorded risk naming its replacement selector | —          |
| E4  | **Heuristics**            | NOT BUILT — trigger→move pairs. The cure for the weakness the skill already names: an agent reports a clean session because it never tried anything surprising                                                                                    | nothing    |
| E5  | **Interact** (the driver) | NOT BUILT — action selection under E4, obeying E2, diffing via E3; emits a state graph and an `unexplored` list carrying the reason each control was skipped                                                                                      | E3, E4     |
| E6  | **Session report**        | NOT ENFORCED — the skill asks for observations/questions/defects/not-reached and nothing checks it. Route through `check-report`                                                                                                                  | nothing    |
| E7  | **A real session**        | NOT RUN — the empirical test of whether any of the above is enough                                                                                                                                                                                | E5, a key  |

## The crawler — BUILT 2026-09-10, with two gaps still open

`npm run crawl -- <url>` models the **site** rather than a page. It asks the site
first — `robots.txt` rules and `Crawl-delay` are obeyed, `sitemap.xml` seeds the
queue — and only discovers what is not declared. Fetch-first, escalating to a real
browser when a page turns out to be a shell.

Verified on two sites: the-internet never needed a browser, the Polymer shop
escalated every page and produced `/detail/mens_outerwear/{slug}` x13 and a
checkout template varying on `shipCountry, billCountry, ccExpMonth, ccExpYear`.
Twenty-two pages collapsed to four shapes.

**Still open, deliberately not rushed:**

| #   | Gap                                                                                                                        | Why it is not yet done                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **The crawl writes no artefact.** Console output only, so nothing can diff two crawls or use the map as a baseline         | Entangled with A1 accumulation, A2 provenance and E3 identity. What it should eventually write is a diffable baseline, and bolting on a JSON dump now would be the wrong shape |
| C2  | **The evidence base is two sites**, and `minVariants = 3` in `induceTemplates` is an unvalidated guess, not a tuned number | Needs a large site, a paginated one, and one with query-string routing. That is its own activity                                                                               |

## Self-healing — BUILT 2026-09-11, with one gap open

The loop is closed and gated: capture a baseline -> store it -> a later run finds the
selector no longer resolves -> the control is identified by fingerprint -> the test
proceeds and the heal is journalled -> `npm run gate` reports it as a risk naming the
selector the test should be changed to say. Nothing rewrites a test file.

Three refusals are what make it safe, and each is held by a mutation: a working
selector is never re-scored, a heal that is not decisive is refused with its rivals
listed, and a baseline is never matched against a different origin.

| #   | Gap                                                                                                                                                        | Why it is not yet done                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **No measured failure rate.** Every change the healer has faced was one we staged. Similo, tuned and peer-reviewed over 598 cases, still failed 12%        | Needs the page-mutation harness — generate ground truth by transforming a real scan, so the transformation is the label and accuracy becomes a number |
| H2  | **No geometry signals.** Similo's optimised weights rank position and area highly; we carry only `siblingIndex`, so nameless controls have little to go on | Worth nothing until H1 can say whether adding them helped                                                                                             |

Fixed before the first push: bounds now come from `EnvironmentPolicy` (prod crawls
25 pages a second apart, local 150 with no delay, and the command line may only
tighten that, never loosen it), and the output declares what it cannot follow so
the coverage count is not read as a total.

What the graph gives that a page scan cannot:

|                           | Why it cannot come from page scanning                                                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Coverage denominator**  | "We cover 40%" is a guess until something counts the pages                                                                                                                                                                                                              |
| **Template clusters**     | 200 product pages are one template; test one, sample the rest. The insight only exists _across_ pages. Clusters are distinguished by their **variant axes** — clothing varies on size/colour, laptops on RAM/storage — and those axes are exactly what to boundary-test |
| **Orphans and dead ends** | Pages nothing links to, and pages you can enter but not leave                                                                                                                                                                                                           |
| **Broken links**          | Needs the graph                                                                                                                                                                                                                                                         |
| **Depth from entry**      | How many clicks to reach a feature: a testability signal                                                                                                                                                                                                                |

Two things fit patterns already proven here:

- **`robots.txt` is the site's own rules of engagement.** It is `EnvironmentPolicy`
  written by the site owner, and on someone else's production it outranks our
  defaults. Feed it in; do not sit beside it.
- **`sitemap.xml` is a declared contract of which pages exist**, so crawl-versus-
  sitemap is the same check that validated the data dictionary against Petstore's
  OpenAPI spec. Divergence means orphans or dead entries.

Crawling is the one read-only activity that can still cause harm — load — so it
needs politeness bounds (concurrency, delay, `Crawl-delay`) as first-class policy.

## Cheap signals worth adding (low cost, high value)

- **Console and page errors.** We capture the network and not the console, so a JS
  exception that leaves the DOM looking fine is invisible. One listener.
- **Duplicate DOM ids.** Trivial, and the root cause of the ambiguity we already
  report: `#id` silently matches the first.
- **Storage and cookie keys.** Reveals the app's client-side state model, which is
  what exploration needs and no DOM scan shows.

## Architecture gaps

| #   | Gap                                   | Detail                                                                                                                                                                                      |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No accumulation**                   | Scans overwrite and no code reads one back. Every session is first contact; no baseline for healing, no drift detection                                                                     |
| A2  | **No provenance**                     | A spec does not record which scan it was authored against, so a break has no "before" to compare against                                                                                    |
| A3  | **Drift detection**                   | Falls out of E3 nearly free: diff live scan against committed scan and fail _before_ the suite, reporting "Save was renamed to Submit" instead of thirty timeouts                           |
| A4  | **Healing must propose, never apply** | A silently re-targeted selector can pass against the wrong element — the failure `assert-quality` exists to prevent. Emit a candidate with score and matched signals as `inferred` evidence |

## Self-audit against `docs/definition-of-done.md`

| #   | Gap                                     | State                                                                                                                                                                                       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Framework detection is ~92% unverified  | OPEN — 13 detectors written, one (jQuery) confirmed live. React, Vue, Angular, Svelte, Next, Nuxt, Remix, SvelteKit, Alpine, htmx, Turbo, AngularJS are **untested claims in shipped code** |
| D2  | `stack.ts` and `probe.ts` have no tests | OPEN — `formatStack` and `stackAdvice` are pure and testable today; detection needs fixture pages. Closes alongside D1                                                                      |
| D3  | Shadow DOM declared, not traversed      | OPEN — reported as `unscanned-shadow-root`, which meets the blind-spot bar but not the coverage one                                                                                         |
| D4  | Scan artefacts are write-only           | OPEN — same as A1                                                                                                                                                                           |
| D5  | `actionAllowed` is never called         | OPEN — tested and unused until E5 exists. Ready, not active                                                                                                                                 |

## Tooling decisions from reviewing the pydantic-ai post (item 22, closed)

Source: <https://blog.pamelafox.org/2026/08/browser-automation-with-pydantic-ai.html>

| #   | Item                                                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **Playwright MCP as the E5 driver**                     | OPEN FORK. `playwright-mcp` drives from the accessibility tree, not pixels — same stance we reached independently. Its refs are snapshot-scoped, so it solves within-session identity and **not** the cross-run identity E3 needs. The installed Agent SDK takes `mcpServers` per agent and `disallowedTools` accepts `mcp__server__*`, so a role can be given MCP tools with specific ones denied — meaning policy can gate at tool level rather than being bypassed   |
| T2  | **Split action vs navigation timeouts**                 | ADOPT — a click on a missing selector should fail fast; a page load deserves longer. We have one bound for both                                                                                                                                                                                                                                                                                                                                                         |
| T3  | **Content budget**                                      | ADOPT — they cap page text returned to the model. We bound turns, dollars and wall-clock but **not context size**; a large page can blow the window mid-session                                                                                                                                                                                                                                                                                                         |
| T4  | **Explicit domain allowlist + block private addresses** | ADOPT — stronger than our `stayOnOrigin`. Invert the private-address block for local fixtures, keep it for test/prod                                                                                                                                                                                                                                                                                                                                                    |
| T5  | **Trace artefact an agent can audit**                   | ADOPT — they write a traces file and point a coding agent at it to critique the browser calls. We track budget but keep no record of what an agent actually did. Same shape as A1                                                                                                                                                                                                                                                                                       |
| T6  | **`storage_state` for authenticated sites**             | ADOPT — `playwright codegen --save-storage` produces it. This is the concrete recipe for open item 16                                                                                                                                                                                                                                                                                                                                                                   |
| T7  | **Microsoft Foundry**                                   | SKIP — a hosting platform, not a QE toolset. Its agent tools are enterprise data grounding (Bing, Fabric, Logic Apps); the two QE-adjacent ones, Browser Automation and Code Interpreter, we already have better versions of. Foundry classic is deprecated, retiring 2027. Worth stealing one idea only: `tool_choice` forces a specific tool deterministically, versus prose instructions which do not — relevant to our unproven "no skill has been invoked by name" |
| T8  | **Python as a second language**                         | NO as an implementation language — one runner covering five levels is the harness's structural virtue. Reconsider only as a **notebook kernel** for human-facing worksheets, which never touches `src/` or CI                                                                                                                                                                                                                                                           |

## Hands-on artefacts — a subsection for human testing (idea)

Everything built so far optimises for re-execution without a human. This is the other
half: artefacts that help a person **go and look**, generated **on demand through agent
prompting** rather than by a fixed pipeline. The job is to make sure the agent has
tools smooth enough that producing one is not taxing.

The rule that makes it safe: **regenerated, never amended** — derived from a scan the
way the `.txt` digest is derived from the `.json`, so it cannot drift.

The input already exists. `schema.ts` infers endpoint, method, templated path, observed
statuses, request and response fields with types, nullability and **real sample
values**; the scan knows every input's constraints and which controls expose state.
Candidates, cheapest first:

- **`.http` file** — plain text, diffs readably, runs natively in VS Code REST Client
  and JetBrains with no import step
- **Postman collection** — same source data, different renderer, for people who live there
- **Exploration sheet** — the session checklist and charter pre-filled with this app's
  actual affordances, boundaries and unobservable controls
- **Notebook** — only if a markdown sheet proves too static; needs a kernel, see T8

Home would be `apps/<app>/handson/`, per app like `tests/` and `scans/`.

## Open — carried forward

| #   | Item                                                       | Why it is open                                                                                                                                                                                                                                                                                                                                                                                                                         | Blocked by          |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 3   | **Recipes** — 9 multi-phase workflows                      | The orchestration layer; 0 of 9 ported                                                                                                                                                                                                                                                                                                                                                                                                 | needs the agents    |
| 4   | **Agent contracts** — 7 of 22                              | The seven cover every test level; missing delivery-orchestrator, code-reviewer, release-gate-reviewer, requirements-analyst                                                                                                                                                                                                                                                                                                            | nothing             |
| 8   | **LICENSE**                                                | Public repo has none — legally unusable                                                                                                                                                                                                                                                                                                                                                                                                | **user's decision** |
| 10  | `apps/todo-fixture/coverage.md`                            | Three skills point at `apps/<app>/coverage.md`; only countdown-timer has one                                                                                                                                                                                                                                                                                                                                                           | nothing             |
| 11  | **Analyzer blind to Page Objects**                         | `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(`. Found against mcpa-bot; our own specs barely use POs                                                                                                                                                                                                                                                                        | nothing             |
| 12  | Polish — CI badge, topics, CONTRIBUTING, .nvmrc, CHANGELOG | —                                                                                                                                                                                                                                                                                                                                                                                                                                      | nothing             |
| 13  | Mutation testing as a debugging **skill**                  | `npm run mutate` is a tool; make it something agents reach for when asked whether tests prove anything                                                                                                                                                                                                                                                                                                                                 | nothing             |
| 14  | Fresh-clone verification                                   | `npm ci` → browsers → all suites. Proves it works for someone who is not us                                                                                                                                                                                                                                                                                                                                                            | nothing             |
| 15  | Trust tier 3 — evals with a pass rate                      | Everything is tier 2 at best                                                                                                                                                                                                                                                                                                                                                                                                           | nothing             |
| 16  | Auth / storageState setup project                          | Conspicuous absence to a practitioner                                                                                                                                                                                                                                                                                                                                                                                                  | an app with a login |
| 17  | Flake detection feeding the gate                           | Skill exists; no tool                                                                                                                                                                                                                                                                                                                                                                                                                  | nothing             |
| 18  | Regression selection, quality metrics                      | No suite history to act on yet                                                                                                                                                                                                                                                                                                                                                                                                         | a real project      |
| 19  | Schemas: requirements-analysis, triage-report              | verdict ported; these two not                                                                                                                                                                                                                                                                                                                                                                                                          | nothing             |
| 20  | CI actions target Node 20                                  | GitHub is force-migrating runs to 24. A `@v5` bump clears the annotation                                                                                                                                                                                                                                                                                                                                                               | nothing             |
| 24  | **juice-shop local build + D1**                            | The clone is at `C:/Users/User/owasp-juice-shop` (shallow, v20.2.0, 47M). `npm install && npm start` builds it on :3000. It is the Angular target that verifies framework detection, and the only subject with two environments — so it is also where the effect filter gets demonstrated end to end rather than unit-tested. The public demo returned "Application Error" on 2026-09-10, so local is the only usable deployment today | nothing             |
| 25  | **uitestingplayground.com**                                | User-supplied, unexplored. A deliberately awkward UI (delayed elements, dynamic ids, hidden layers, AJAX) — likely the sharpest available test of the scanner's ambiguous / unreachable / no-observable-state findings, and of the occlusion detector. Park until the environment work settles                                                                                                                                         | nothing             |
| 21  | **mcpa-bot blind benchmark**                               | Their suite is the reference answer. Point `e2e-coder` at the running app _without_ letting it read `e2e/`, then diff coverage. Reading their tests measures copying                                                                                                                                                                                                                                                                   | E5, a key           |
| 22  | Review browser-automation-with-pydantic-ai                 | User-supplied, flagged post-main-task                                                                                                                                                                                                                                                                                                                                                                                                  | after the loop      |

## Recently closed

| Item                                    | Outcome                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Four state files with overlapping jobs  | **DONE** — two. Volatile plan here, durable agreements in `HANDOFF.md`               |
| Validate a writing role                 | **DONE** — `api-coder` wrote `authors.api.spec.ts`; it runs, passes, clears the gate |
| Scanner organised around test ids       | **DONE** — re-centred on identify / interact / observe                               |
| Network bodies collected then discarded | **DONE** — `schema.ts` infers a data dictionary                                      |
| No frontend detection                   | **DONE** — `stack.ts`, each signal naming its evidence                               |
| Definition of done for harness work     | **DONE** — `docs/definition-of-done.md`                                              |
| `.ai/` hidden by `.gitignore`           | **DONE** — un-ignored; new state files are no longer silently skipped                |

## Plans change; facts go stale

Two kinds of content live here and only one is at risk.

**Plans are meant to change.** E3 only became the keystone once it was clear that
self-healing, fuzzy matching, drift detection and state-diffing are one primitive.
That is the plan working, not rotting.

**Statements of fact go stale, and that is the hazard.** This file has claimed a role
was unvalidated after it was validated. The cost is concrete: someone resuming redoes
finished work. So anything asserting what _is_ true carries the date it was checked
and is re-checked at the gate rather than recalled.
