---
name: test-design
description: Decide what to test and at which level, driven by risk rather than habit. Use when asked "what should I test", designing scenarios for a feature or change, or before writing any spec. Not for checking whether requirements are ready (requirements-sufficiency) or exploring a running feature (exploratory-session).
---

Design is the thinking artifact. If the output is a list of test titles, the thinking
was skipped.

## When to use

- A feature or change needs coverage and you must decide what and where
- Multiple levels are possible (unit / API / E2E) and you need to allocate
- Before an agent generates specs — the approved design is what it generates from

## When NOT to use

- Requirements are unclear → `requirements-sufficiency` first
- You want discovery, not coverage → `exploratory-session`
- Trivial change → run the directly affected test and say so

## Operating rules

- **Cite evidence.** Every risk traces to a code observation, an acceptance
  criterion, or domain knowledge. Mark invented ones `[UNVERIFIED]`.
- **Match depth to risk.** Don't over-design a stable, simple feature.
- **Behavioural coverage, not line coverage.** A test must fail when behaviour
  changes, not when implementation details move.

## Procedure

### 1. Scope the change (3 min)

From requirements: what are the acceptance criteria? From a diff: what changed, what
calls it, what does it call? Run `npm run scan -- <url>` for a UI surface — design
against real selectors, not remembered ones.

Ask the mission question: _what is my testing objective?_ "Confirm it matches spec"
and "find out how this actually behaves" produce different designs.

**Produces:** scope summary + the components touched.

### 2. Decompose before assessing (3 min)

Walk the dimensions and ask, for each: **what here is testable?** Skip what does not
apply — but consider each before skipping. It is a thinking tool, not a checklist.

| Dimension      | Prompts                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structure**  | Which modules, services, background jobs, config files, migrations?                                                                                                                                                                                     |
| **Function**   | Business rules · calculations and rounding · **state transitions** · error detection and messages · permissions per role · how functions interact                                                                                                       |
| **Data**       | Inputs and outputs · defaults and preset data · what persists across sessions · data that influences other data · **cardinality: zero, one, many, max** · order and sequence · invalid and corrupted input · **the full CRUD lifecycle of each entity** |
| **Interfaces** | UI · APIs and their contracts · logs and queues · import/export                                                                                                                                                                                         |
| **Platform**   | Browsers and versions · viewport sizes · locale, encoding, RTL, text expansion · third-party libraries · resources consumed                                                                                                                             |
| **Operations** | Who uses it — admin, end user, API consumer · common workflows · **uncommon ones: backup, maintenance, report runs** · extreme but legitimate use · careless or hostile use                                                                             |
| **Time**       | Timeouts and expiry · timezones, DST, holidays · **pacing — bursts, spikes, slow input, interruption** · concurrency and shared state                                                                                                                   |

Defects cluster at boundaries. **Time, Data cardinality, and uncommon Operations** are
the three most reliably skipped — and between them account for a large share of what
escapes to production.

**Produces:** scope decomposition.

### 3. Risk analysis (5 min)

For each candidate area: what could go wrong, how bad, how likely. Score with
`risk-assessment` when the change is significant.

Ask explicitly: **are there performance, security, accessibility, or data-integrity
concerns?** These get missed when attention is on functional behaviour.

**Produces:** risks tagged HIGH / MEDIUM / LOW with impact.

### 4. Allocate levels (5 min)

Push each risk as far down as it will go.

| Risk type                           | Default level                   | Push up when                   |
| ----------------------------------- | ------------------------------- | ------------------------------ |
| Validation, calculation, pure logic | unit                            | logic spans services           |
| Persistence, queries                | integration                     | complex joins or triggers      |
| Business rule, contract             | API (`src/fixtures/api.js`)     | rule has UI-specific behaviour |
| User workflow, multi-step           | E2E (`src/fixtures/harness.js`) | —                              |
| Permissions                         | API                             | role changes UI visibility     |

Rules: if a high-level test catches something no lower test caught, write the lower
test. Do not test the same thing at two levels. If a risk cannot be tested at the
suggested level, say why and move it up — never leave a HIGH risk untested.

**Produces:** risk → level → rationale.

### 5. Choose techniques and data (10 min)

| Shape                 | Technique                                  |
| --------------------- | ------------------------------------------ |
| Input ranges          | equivalence partitioning + boundary values |
| Rule combinations     | decision table                             |
| Modes and transitions | state transition table                     |
| Many parameters       | pairwise                                   |
| Unknown territory     | exploratory charter                        |

Layer in order and stop when coverage matches risk: partitions and boundaries →
pairwise → decision tables → hostile probes (null, empty, max length, unicode,
injection strings).

**Produces:** technique + data strategy per level.

### 6. Prioritise and trace (5 min)

P1 every HIGH risk and every acceptance criterion. P2 boundaries on important inputs.
P3 the rest.

Walk the chain: **AC → risk → level → technique → test case.** An AC with no case is
a gap. A case with no AC is exploratory, regression, or noise — justify or drop it.

For every mutating operation, cover the minimum negative set: missing required field ·
invalid value · invalid reference · unauthenticated · insufficient permission ·
business-rule violation.

**Verify after mutate:** every test that writes must read the state back. Never trust
the mutation response alone — this repo has a live example where a create endpoint
echoes its input and persists nothing.

**Produces:** prioritised list with traceability, gaps flagged.

## Output

Write the design to `apps/<app>/coverage.md`: the state or decision model, what is
covered, and **what is deliberately not covered and why**. The "not covered" line is
required — it is what distinguishes a considered gap from an oversight.

## Decision points

| Situation                           | Action                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| No acceptance criteria to trace to  | Stop. Run `requirements-sufficiency`.                  |
| All risks LOW                       | Quick sketch. Don't over-test a stable feature.        |
| HIGH risk with no viable test level | Escalate. Do not quietly drop it.                      |
| Time covers only P1                 | Run P1, log P2/P3 as deferred, state the coverage gap. |

## Interlaying (blind spot)

This designs against **known** risks and **stated** requirements. It cannot find what
nobody specified — pair it with `exploratory-session`. It also says nothing about
whether the assertions you write are any good; `npm run assert-quality` is the
mechanical floor for that.

_Risk-driven design, product-dimension decomposition and the test pyramid are
long-standing testing practice (Kaner/Bach/Pettichord, Marselis, Cohn). Recreated here
in our own words and wired to this repo's tooling._
