---
name: bug-report
description: Investigate a defect and write it up so it gets fixed — reproduce, isolate, find the worst honest case, name the oracle, state impact. Use when writing up a finding, or when a bug was deferred and needs a stronger case. Not for deciding whether something is a bug (oracle-check).
---

A bug report is an argument that something deserves someone's time. Reports are
rejected for being unclear far more often than for being wrong.

## When to use

- You have a finding and need it filed
- A defect was deferred and you think that was the wrong call
- A test failed and triage says `product-bug`

## When NOT to use

- You are not yet sure it is a defect → `oracle-check`
- You do not yet know what the bug _is_, only that something is off → investigate first
- The failure is a test bug or infrastructure → fix it, do not file it against the product

## Operating rules

- **"I observed", not "I think".** Every claim traces to something you saw.
- **Harshest honest version.** Maximise real impact; never invent it. An exaggerated
  report buys one fix and spends credibility the next report needs.
- **The report advocates; the team decides.** Recommend a severity, do not declare one.

## Procedure

### 1. Reproduce and reduce

Find the simplest reliable reproduction. Change one variable at a time until you know
the actual trigger. The minimal case that still reproduces **is** the regression test
you will write afterwards.

If it is intermittent, do not discard it — record conditions and a frequency ("3 runs
in 10"). An intermittent bug reported as consistent gets closed as unreproducible, and
is much harder to raise a second time.

### 2. Find the worst honest case

Push it: larger inputs, longer sequences, a different role, a slower network. Does it
lose data? Affect other users? Cross a permission boundary? The worst _real_ version is
the most persuasive, and you must find it before someone else does.

### 3. Generalise

Does it affect other features, other data, other environments? Scope is what turns
"an edge case" into "a pattern".

### 4. Name the oracle

Run `oracle-check`. State what the behaviour is inconsistent _with_. Lead with the
strongest available:

- **Claims** — the spec, the docs, the UI's own label says otherwise
- **History** — this worked before (a regression is the easiest case to make)
- **Internal consistency** — the product contradicts itself
- **Comparable behaviour** — a sibling feature handles it correctly
- **Standards** — it violates a protocol, accessibility guidance, or law

Stack them. One violation is an opinion; three is a pattern.

### 5. Assess impact in their terms

User consequence · data at risk · business consequence · how often this happens in
real use · how many users or flows are affected. Say it the way the person who
prioritises it thinks, not the way you debugged it.

### 6. Write it

```
Title: <observable effect + the condition that triggers it>

Steps:
1. <exact step, with the actual data used>
2. ...

Expected: <what should happen — and which oracle says so>
Actual:   <what happens>

Impact:   <user and business consequence>
Frequency: <always | N in M runs>
Scope:    <where it reproduces, and where it does not>

Evidence: <network capture, trace, screenshot — artifacts/ after a failed run>

Oracle:   <named, with the specific inconsistency>
Severity recommendation: <level> — because <reason>
```

Put the most important information first. A reader who stops after two lines should
still have the point.

**Separate fact from theory.** "The POST returns 403 after ten minutes idle" is an
observation. "The session expires too early" is a hypothesis. Label which is which — a
wrong theory attached to a correct observation gets the whole report dismissed.

## Handling pushback

| Pushback               | Response                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- |
| "No customer impact"   | Find evidence — support tickets, logs, the workflow that triggers it             |
| "Edge case"            | Show how common the trigger conditions actually are                              |
| "Works as designed"    | Apply the purpose oracle: does the design serve what the feature is for?         |
| "Too expensive to fix" | Reframe: what does not fixing cost — support load, workarounds, reputation?      |
| "Low priority"         | Return to step 2. Show the harsher version, stack more oracles, widen the scope. |

## Decision points

| Situation                        | Action                                                              |
| -------------------------------- | ------------------------------------------------------------------- |
| Cannot reproduce                 | File as intermittent with conditions and frequency. Do not discard. |
| Only weak oracles apply          | Look for corroboration before filing, or raise it as a question.    |
| Impact seems minor               | Run step 2 before accepting that.                                   |
| Developer says "can't reproduce" | Supply exact environment, data and role. Offer to pair.             |

## Interlaying (blind spot)

This produces a strong report for **one** defect. It does not surface the pattern when
several bugs share a cause, and it is inherently biased toward what reproduces easily —
"not reproducible" is very often premature. It is also reactive: preventing the next
one is `test-design`'s job.

_Reproduce–isolate–maximise–generalise–evidence–advocate, and oracle-backed argument,
follow long-established bug advocacy practice (Kaner, Bach, Bolton). Recreated in our
own words._
