# Session start checklist

Run this before touching the system. Not paperwork — it decides what you are
allowed to do, and it is the difference between exploration and an incident.

The rules are agreed **per session**, because the same click means different
things on different systems. Deleting a record on a local fixture is a test. The
same click on production is an outage someone gets paged for.

Print the agreed rules at the top of the session report. A reader has to be able
to tell a thin session from a tightly constrained one, and only the rules make
that visible.

---

## 1. Where am I pointed? — answer first, no default

|                        | **local** | **test / staging**     | **prod**        |
| ---------------------- | --------- | ---------------------- | --------------- |
| Whose data             | nobody's  | colleagues'            | **real users'** |
| Recoverable            | reset it  | ask someone            | **no**          |
| Change server state    | yes       | yes                    | **no**          |
| Submit forms           | yes       | yes                    | **no**          |
| Destructive controls   | yes       | no                     | **no**          |
| Credential attempts    | yes       | no — lockouts are real | **no**          |
| Bodies written to disk | yes       | no                     | **no**          |

If you cannot say which of the three it is, **stop and ask.** A guess here is the
expensive kind of wrong.

Declare it with `EXPLORE_ENV=local|test|prod`. `npm run scan` reads it and, on
anything but local, withholds request and response bodies from the log it writes
to disk — otherwise that file is a copy of real payloads sitting in the repo.

## 2. The definite NOs — never, on any environment

These hold even locally, because their effects leave the system:

- **Anything that sends** — email, SMS, invite, notify, share, publish, post
- **Anything that pays** — checkout, purchase, order, subscribe, transfer
- **Anything off the starting origin** — a link out is someone else's system, and
  your rules of engagement do not cover it
- **Bot-detection and CAPTCHAs** — do not attempt to defeat them
- **Load** — exploration is not a stress test; hammering a shared box is a denial
  of service to your colleagues

## 3. What am I hunting? — the charter

```
Explore     <target>
With        <resources: data, roles, tools, network conditions>
To discover <what class of information>
Timebox     <15 / 45 / 90 minutes>
Persona     <first-time user / keyboard-only / admin / hostile>
Constraint  <what you are deliberately excluding>
```

A charter without a persona and a constraint is a to-do list. The persona decides
what you notice; the constraint is what stops the session sprawling.

## 4. What does "wrong" mean here? — the oracle, before you look

Name the oracles you will judge against, now, while you are still honest:

- **Consistency with itself** — same input, same result; the state it claims
- **Consistency with the product** — does this screen behave like its siblings
- **Consistency with the docs** — README, API contract, `coverage.md`
- **Consistency with a standard** — HTTP semantics, ARIA, the platform's norms

If a finding matches no oracle, it is a **question**, not a defect. Deciding this
afterwards is how confirmation bias gets in.

## 5. Bounds — set before, not discovered during

States · actions · wall-clock. Whichever trips first ends the session. Being
stopped by a bound is a normal outcome and gets reported, not hidden.

## 6. What will I do with what I find?

- Observation → the report
- Question → the report, addressed to a named person
- Defect → `bug-report`, with its oracle
- Anything worth keeping → a regression test, or the finding dies with the session

---

## The honesty clause

**Every control skipped under these rules is reported as unexplored.**

A clean session under a narrow policy is not evidence of a clean system — it is
evidence of a narrow policy. A read-only production session that finds nothing
has established almost nothing, and the report must say so rather than reading
like a pass.

Silent skipping is worse than not exploring: it produces a report that claims
coverage nobody actually has.
