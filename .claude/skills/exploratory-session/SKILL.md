---
name: exploratory-session
description: Run a chartered, time-boxed exploratory session against a running app and report observations, questions and defects separately. Use when asked to explore a feature, find what nobody specified, or investigate an area before designing tests. Not for executing a known checklist.
---

Scripted tests check what someone already thought of. This finds what nobody did. It
is structured work, not clicking around — the structure is the charter and the notes.

## When to use

- A new app or feature has landed and nobody knows its edges yet
- Before `test-design`, to learn what is worth designing for
- After a fix, to check what else the change disturbed
- The state model in `apps/<app>/coverage.md` has cells nobody has verified

## When NOT to use

- You already know what to test → `test-design`
- You are verifying a known list → run the suite
- You have a specific defect to write up → `bug-report`

## Operating rules

- **Charter before exploring.** No charter is ad-hoc clicking with better branding.
- **Observe, then conclude.** Record "I saw X", not "X is broken". The conclusion is
  a separate step and needs an oracle.
- **Absence of findings is a finding**, but only within the charter's scope. "No
  issues found" is coverage evidence for what you explored, not for the feature.

## Procedure

### 1. Write the charter (2 min)

```
Explore    <target>
With       <resources: data, roles, tools, network conditions>
To discover <what class of information you are hunting>
Timebox    <15 / 45 / 90 minutes>
```

Add a **persona** — different personas find different bugs. A first-time user finds
discoverability problems; a keyboard-only user finds barriers; an admin finds
permission leaks.

Add a **constraint** to sharpen focus by deliberately excluding something: "without
touching the UI", "only error paths", "only with the clock skewed".

### 2. Set the box and start (decide before starting)

Set a timer. First impressions happen once — the early minutes are the most valuable
and the least repeatable.

### 3. Explore (the session)

Cycle: **test** (interact, observe) · **investigate** (reproduce, isolate) ·
**setup** (data, state) · **record**.

Watch the split. If setup consistently eats more than a fifth of the session, the
environment is the finding. If investigation dominates, the area may be too broken for
exploration — switch to structured work.

Apply `oracle-check` continuously — "is this consistent with the docs? with the rest
of the product? with itself?"

Useful moves in this harness:

- Drive `page.clock` to reach states real time makes expensive — expiry, timeout,
  midnight rollover, long idle.
- Watch the network capture, not just the page. A silent 4xx behind a cheerful UI is
  the defect class this repo exists to catch.
- Compare state before and after an action, not just the end state. Transitions hide
  more than destinations.

When stuck: ask someone, read the source, or reason from a system you already know.

### 4. Debrief (5 min)

Report four things, kept apart:

- **Observations** — what happened, with steps and data
- **Questions** — looked odd, unconfirmed, needs a decision from someone
- **Defects** — reproducible, with a named oracle
- **Not reached** — what the charter did not cover, and why

Then: which findings deserve permanent automated coverage? A session that yields no
candidate regression test probably explored well-covered ground.

## Decision points

| Situation                       | Action                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Nothing seems wrong             | Record that, scoped to the charter. It is coverage evidence.                        |
| Session drifts off charter      | Note the drift as a finding, then either return or consciously rewrite the charter. |
| Found something big mid-session | Note it, keep exploring. Full write-up after, via `bug-report`.                     |
| No oracle applies to a finding  | Raise it as a question, not a defect.                                               |
| Timebox expires mid-thread      | Stop. Record where you were. Unfinished is fine; unrecorded is not.                 |

## Interlaying (blind spot)

One session, one charter, one perspective. It gives no coverage confidence beyond its
own scope, and it does not produce regression protection — findings have to be turned
into tests to keep their value. It also relies on noticing, which is exactly what an
agent is weakest at: an agent will happily report a clean session because it never
tried anything surprising. Assign hostile charters deliberately.

_Charter-and-debrief exploratory practice follows session-based testing as developed
by Bach, Bolton and Pyhäjärvi. Recreated in our own words for this harness._
