---
name: test-techniques
description: Execute a test design technique properly — equivalence partitioning, boundary values, decision tables, state transitions, pairwise, structure-based coverage, and the sequence probes that catch what static input testing cannot. Use when you have found an input, a rule, a mode, or a workflow and need to decide which values and paths to try. Not for deciding what to test at all (test-design) or for unscripted discovery (exploratory-session).
---

`test-design` decides **what** deserves coverage. This decides **which values**.

It exists because naming a technique is not using one. "Input ranges → equivalence
partitioning + boundary values" is a pointer; this is the derivation rule, the
coverage criterion, and the point at which you can say you are done.

## When to use

- You found an input, and now have to choose values
- A rule has several conditions and you need the combinations that matter
- Something has modes, and you need the transitions — including the ones nobody intended
- Mid-session in `exploratory-session`: **the moment you find a field with a declared
  bound, that is not a different activity, it is six values**

## When NOT to use

- You do not yet know what is worth testing → `test-design`
- You want discovery rather than coverage → `exploratory-session`
- The value set is tiny and obvious → test all of it and move on

## Operating rules

- **State the coverage criterion before you start.** A technique without one produces
  a pile of cases and no way to know when to stop.
- **A declared constraint is a specification handed to you free.** `min`, `max`,
  `maxlength`, `pattern`, `required`, `options` — `npm run scan` prints every one of
  them under "Inputs". Not probing them is leaving a written spec unread.
- **The page's own claims are boundaries too.** "Maximum purchase amount of 10 is
  allowed" is a boundary even when no attribute says so.
- **One idea, many values.** Prefer a single case "handles invalid input (empty,
  space, string, accented, unicode, over-length, wrong delimiter)" to a dozen
  one-value tests. Granularity that fine makes review impossible and adds nothing.

---

## 1. Equivalence partitioning

Split the input domain into classes where every member should be treated the same.
Test one representative per class; testing a second tells you nothing new.

**Derive:** list the **valid** classes, then the **invalid** ones. Invalid classes are
where the bugs live and where people stop early. For a quantity field accepting 1–10
integers: valid `{1..10}`; invalid `{0 and below}`, `{11 and above}`, `{fractional}`,
`{non-numeric}`, `{empty}`.

**Coverage criterion:** every class exercised at least once. Report it as
`classes covered / classes identified`.

**Trap:** classes are about _how the system should treat the value_, not about
arithmetic. If a field treats 0 and −1 differently, they are two classes.

## 2. Boundary value analysis

Defects cluster where a class ends. Off-by-one is the most common coding mistake
there is.

**Derive:** for each boundary, take **2-value** (the boundary and its neighbour on the
far side) or **3-value** (below, at, above). Use 3-value where the cost of being wrong
is high — money, permissions, limits.

For `min=1 max=10`: **0, 1, 2, 9, 10, 11**. Six values.

**Coverage criterion:** every boundary of every partition.

**In this repo:** run `npm run scan -- <url>` first and read the "Inputs" block — each
`min`, `max`, `maxlength` and `pattern` it lists is a boundary the page declared.
On a real shop this exact six-value set finds a quantity field that accepts your input
and silently stores something else, which is a defect nobody notices by clicking.

## 3. Decision tables

For rules with several conditions where the combination decides the outcome.

**Derive:** conditions as rows, each combination as a column, actions at the bottom.
Then **collapse** columns where a condition turns out not to matter, marking it `—`.
Collapsing is the work — it is what turns 2ⁿ into something testable.

```
Logged in?        Y  Y  N  N
Has variant?      Y  N  Y  N
-----------------------------
Show price        Y  Y  ?  Y      <- the ? is an uncovered rule, and a finding
Add to cart       Y  Y  N  Y
```

**Coverage criterion:** every rule (column) exercised. An outcome nobody can state is
not a gap in the table; it is a gap in the product.

## 4. State transition testing

For anything with modes: a cart, a wizard, a session, an order.

**Derive:** a table of state × event → next state. Fill in **every** cell, including
the ones that should be impossible — those are the **sneak paths**, and they are where
the interesting failures are.

**Coverage criteria, in increasing strength:**

| Level        | Covers                                          |
| ------------ | ----------------------------------------------- |
| **0-switch** | every valid transition once                     |
| **1-switch** | every valid _pair_ of consecutive transitions   |
| **sneak**    | every invalid transition, attempted and refused |

**Why 1-switch matters:** a cart that accepts one quantity update and silently
ignores every update after it passes 0-switch perfectly. Only the second consecutive
transition exposes it. Most state bugs are 1-switch bugs.

**Sneak paths in a browser:** the URL is an event source. So is the back button.
Reaching step 3 without step 2, re-submitting a consumed form, and replaying an
add-to-cart link are all transitions the UI does not offer and the system must still
refuse.

## 5. Pairwise

When parameters multiply past what anyone will run. Most defects are triggered by one
parameter or by a pair, not by a six-way interaction.

**Derive:** cover every _pair_ of parameter values at least once rather than every
combination. Four parameters of four values each is 256 exhaustive, about 20 pairwise.

**In this repo:** `npm run crawl -- <url>` reports variant axes it found in the served
HTML (`varies on: sortfield, ec_currency_conversion`). Those are your parameters, read
off the real site rather than guessed.

## 6. Structure-based

Black-box techniques cannot see a branch nobody exposed.

| Criterion     | Satisfied when                                     |
| ------------- | -------------------------------------------------- |
| **statement** | every line executed                                |
| **branch**    | every decision taken both ways — strictly stronger |

Branch coverage over statement coverage, always: a one-line `if` with no `else` gives
100% statement coverage while the false path has never run.

**Use it to find what is untested, never as a target to hit.** Coverage is a floor
that spots gaps, not a goal that proves quality — a suite can execute every line and
assert nothing, which is what `npm run assert-quality` exists to catch.

## 7. Experience-based

**Error guessing** — ask where _this_ system is likely to be weak, from a defect
taxonomy rather than vibes: off-by-one · rounding and currency · timezone and DST ·
encoding · null and empty · concurrency · unbounded input · state left behind.

**Checklist** — the minimum negative set for every mutating operation: missing required
field · invalid value · invalid reference · unauthenticated · insufficient permission ·
business-rule violation.

---

## 8. Sequence probes — what static input testing cannot reach

Everything above tests a value. These test a _history_. They are cheap, and each one
has found real defects that no amount of per-field testing would.

| Probe                           | Do this                                                              | Catches                                                    |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Repeat the transition**       | Do the same update two, three times in a row                         | Accepts once, silently ignores the rest — the 1-switch bug |
| **Continuous use**              | Do not restart between checks. Leave it open, let state pile up      | Systems tie themselves in knots over time                  |
| **Back after submit**           | Submit, press back, submit again                                     | Double-charging, resurrected records, stale tokens         |
| **Double-click submit**         | Click the action twice, fast                                         | Two orders from one intent                                 |
| **Change a setting afterwards** | Create with setting A, switch to B                                   | Existing data not migrated, or silently reinterpreted      |
| **Cancel mid-flow**             | Start a multi-step process, abandon it at each step in turn          | Partial state, orphaned records, held locks                |
| **Position**                    | Act at the beginning, middle and end of a list, a string, a sequence | Off-by-one at either end                                   |
| **Selection**                   | Choose some, none, all — especially none and all                     | Empty-set and whole-set handling                           |
| **Input method**                | Type it, paste it, import it, send it by API                         | Validation on one path only                                |
| **CRUD, re-reading each time**  | Create, read, update, **read**, delete, **read**                     | Writes that report success and persist nothing             |

The re-read in that last row is the point of it. This repo has a live example of a
create endpoint that echoes its input and stores nothing — the response was cheerful
and the record was never there.

---

## Choosing

| You are looking at            | Reach for                                 |
| ----------------------------- | ----------------------------------------- |
| A field with a declared bound | boundary values, then equivalence classes |
| A field with no bound stated  | equivalence classes, then error guessing  |
| A rule with several inputs    | decision table                            |
| Anything with modes           | state transition — go to 1-switch         |
| Several parameters at once    | pairwise                                  |
| A workflow                    | sequence probes                           |
| Code you can read             | branch coverage, to find what is untested |

Layer in that order and stop when coverage matches risk. The techniques are not a
sequence to complete; they are tools to pick from.

## Test types, so the gate has words for it

| Type               | Question                                        |
| ------------------ | ----------------------------------------------- |
| **Functional**     | Does it do what it should?                      |
| **Non-functional** | How well — performance, accessibility, security |
| **Structural**     | Have we reached the code?                       |
| **Confirmation**   | Is _this_ defect actually fixed?                |
| **Regression**     | Did the fix break something else?               |

Confirmation and regression are different activities. A fix verified only by its own
confirmation test is a fix nobody checked the blast radius of.

## Decision points

| Situation                                | Action                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A rule's outcome cannot be stated        | That is a finding. Raise it; do not invent the expected result.                                 |
| Boundaries disagree across sources       | Test all of them. Disagreement between a page, an attribute and a message is itself the defect. |
| The combination space is still too large | Pairwise, and say in the design that you did                                                    |
| A sneak path succeeds                    | Stop and report. An impossible transition that works is rarely minor.                           |
| Technique produces cases you cannot run  | Note them as deferred coverage, do not silently drop them                                       |

## Interlaying (blind spot)

Every technique here needs someone to have found the input, rule or mode first.
None of them will tell you an entire feature is missing, that a control does nothing
at all, or that the page is lying — `exploratory-session` is for that, and
`oracle-check` is how you decide whether what you saw is wrong.

These also say nothing about whether the assertions you write are worth anything.
`npm run assert-quality` is the mechanical floor; `npm run mutate` is the real check.

_Lineage and licences: `docs/sources.md`._
