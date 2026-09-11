# PLAN — where we are and what is next

Regenerated at each end gate, never hand-patched. Status and next actions live
together because they are one sentence: what is true now decides what comes next.

Durable working agreements live in `HANDOFF.md`. Facts about an app under test live in
that app's `README.md`. Why a line of code exists lives in a comment next to it.
Attribution lives in `docs/sources.md`. None of that belongs here.

**Regenerated:** 2026-09-11, commands re-run at the gate.

## Where we are

Four commits pushed: `82d8436` the crawler, `4e95061` element identity, `0e2ba4c` the
healer, `dafe8b6` three detector false positives fixed. One tree of skill and layering
work on top.

## Proven — direct evidence, re-run at this gate

- `npm test` **303 passed** — unit 216, harness 60, integration 20, todo-fixture 7 ·
  `npm run test:external` 22
- `npm run gate` **PASS** · `npm run assert-quality` **26 files, 0 findings**
- `npm run mutate` — one mutation per enforced rule, no survivors
- `npm run check` clean
- Self-healing proven against staged change: regenerated ids, a reworded label held by
  its `name` attribute, a reworded and moved link held by its href, a control behind a
  shadow boundary — plus every refusal
- Detector precision corrected against a live site: two occlusion false positives and
  one hover false positive, each found by re-running against a real page and each now
  carrying a regression test

## Not proven — do not claim otherwise

- **No exploratory session has ever been run by an agent.** Skills, roles and
  checklists exist; none has been exercised. Still the largest unproven claim here.
- **No skill has ever been invoked by name.** Demonstrated at cost on 2026-09-11:
  `oracle-check` already held the exact oracle that found nearly every bug in a manual
  session, and went unread because nothing made anyone read it.
- **Self-healing has never faced a change someone else made.**
- Framework detection is largely unverified; three tiers confirmed against live sites.
- Five of seven roles have never run. No role has written a browser spec.

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

**The honest headline: this is a good map and not yet a tester.** The 2026-09-11 work
did not move that number and did not claim to; it fixed how the map reads, how complete
it admits to being, and what methods exist to use it.

## Work queue

Ranked. The first item is what everything else waits behind.

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why now                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **E5 — the driver.** Action selection under E4, obeying the environment policy, diffing via `identity.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | The single blocker on the benchmark number. Everything the harness misses, it misses for want of a click                                                                                                          |
| 2   | **A way to see.** No role has a screenshot tool, and `visual-inspection` says outright it cannot run without one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Roughly half the defects found by hand were visible and unqueryable: a tile 30px short, a panel over the footer, a cart preview off the page edge                                                                 |
| 3   | **`storageState`**, captured once by a person and replayed by the harness                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | The authenticated half of every app is otherwise permanently dark. An agent never enters credentials, so this is the only route in. Recipe: `playwright codegen --save-storage`                                   |
| 4   | **A performance pass** — `performance.getEntriesByType`, roughly fifteen lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | One of the five benchmark categories has no capability at all. Fifteen hand-written lines found ~3x oversized images on every product, 2.2MB of payload and a dead CDN                                            |
| 5   | **The map is a single state.** Transient surfaces — mini-cart, dropdown, modal, toast, drawer — appear in no inventory and no crawl                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The same shape as the settle bug fixed on 2026-09-11, one level up. A defect was missed for exactly this reason: the cart page was tested thoroughly and the cart _preview_ was never opened                      |
| 6   | **E4 — heuristics as a callable layer**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 183 heuristic items across the skills and no bridge from any of them to an action. Ours are analysis; the ~35 execution moves we lack are in Trowser's `testheuristics.md` — see `docs/sources.md`                |
| 7   | **Agent-to-skill pairing.** Twelve skills, seven roles, and the matrix has never been reviewed. `honesty-check` and `work-discipline` are **orphans that no role loads** — the first written precisely because agents overclaim. `bug-report` does not reach the exploratory tester, whose entire output is defects; `risk-assessment` reaches nobody who runs `test-design`, which tells them to use it; `oracle-check` and `visual-inspection` do not reach the coders. Cross-cutting skills belong in the shared guardrails; the rest need one deliberate pass, and a test asserting no skill is orphaned. A mutation already checks a role cannot point at a skill that does not exist — nothing checks the inverse | Skills only work if something reads them, and today two of twelve are read by nothing. Cheap to fix, and it is the prerequisite for E7 meaning anything: an agent session tests the pairing as much as the skills |
| 8   | **E6 — enforce the session report** through `check-report`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The skill asks for observations / questions / defects / not-reached, and nothing checks it                                                                                                                        |
| 9   | **E7 — a real agent session**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The empirical test of whether any of the above is enough. Needs E5 and a key                                                                                                                                      |

### Smaller, unblocked

| #   | Item                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | **Analyzer blind to Page Objects** — `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(` |
| 11  | **LICENSE** — a public repo with none is legally unusable. **User's decision**                                                                 |
| 12  | CI actions target Node 20; GitHub is migrating to 24. A `@v5` bump clears the annotation                                                       |
| 13  | `apps/todo-fixture/coverage.md` — three skills point at `apps/<app>/coverage.md` and only countdown-timer has one                              |
| 14  | Fresh-clone verification: `npm ci` → browsers → all suites, proving it works for someone who is not us                                         |
| 15  | The crawl writes no artefact, so two crawls cannot be diffed                                                                                   |
| 16  | Scans overwrite and nothing reads one back — no drift detection between runs                                                                   |
| 17  | Recipes 0 of 9 · agent contracts 7 of 22 · schemas for requirements-analysis and triage-report not ported                                      |

## Architecture gaps

| #   | Gap                               | State                                                                                                                |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A1  | No accumulation                   | Locator baselines exist (`qe/baselines.ts`); scans and crawls still overwrite                                        |
| A2  | No provenance                     | A spec does not record which scan it was authored against                                                            |
| A3  | Drift detection                   | Half done — the healer reports drift when it resolves; there is no scan-against-scan diff                            |
| A4  | Healing must propose, never apply | **Closed.** Every heal reaches the gate as a risk naming a replacement selector that was verified to resolve         |
| A5  | No performance or security pass   | Two benchmark categories with no capability. Queue item 4, and see `docs/sources.md` for the engines Trowser bundles |

## Subjects

Six registered: `todo-fixture` (local fixture), `countdown-timer`, `juice-shop` (local
plus public demo — the only two-environment subject), `polymer-shop` (real shadow DOM),
`fakerestapi`, `petstore` (a declared OpenAPI spec, so the inferred data dictionary can
be checked against a contract).

Used but not registered: **`academybugs`** (the scored benchmark above), `the-internet`,
`rigassatiksme`, `adayinhistory`.

Parked with reasons in `apps/README.md`: uitestingplayground · saucedemo · qaplayground ·
automationexercise · demoqa · testsheepnz calculator · parabank · parkcalc ·
qa-practice · applitools demo · gh-users-search · realworld · bugeater ·
practice-software-testing.

## Recently closed

| Item                                   | Outcome                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Element identity and fuzzy matching    | **DONE** — one scorer; decisive signals set a floor rather than casting a vote                             |
| Self-healing                           | **DONE** — baselines, resolution, drift, verified proposals, every heal gated                              |
| Three detector false positives         | **DONE** — occlusion measured after scrolling, hover given a control group, `alt` added to the name ladder |
| One report mixing three audiences      | **DONE** — the map, the product findings, automation readiness, in that order                              |
| Attribution inline in every skill      | **DONE** — `docs/sources.md`, one line per skill                                                           |
| ISTQB techniques named but not defined | **DONE** — `test-techniques`, with derivation rules and coverage criteria                                  |
| No method for looking at a page        | **DONE** — `visual-inspection`, written after three defects were missed by looking once                    |
| All seven roles in one file            | **DONE** — `common.ts` plus one file per role                                                              |
| Inventory taken before a page settled  | **DONE** — settle unconditionally, and the map now declares whether it is a floor                          |

## Plans change; facts go stale

Two kinds of content live here and only one is at risk. Judgements — what to build
next, and why — age slowly. Facts — counts, verdicts, what is proven — age the moment a
command runs. Every number above came from a command run at this gate. If the tree has
moved since, re-run them rather than trusting the page.
