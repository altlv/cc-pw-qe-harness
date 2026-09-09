# Test design

Techniques for deciding _what_ to test before writing any code. An agent that skips
this step produces a suite that clicks every button once and finds nothing.

Pick the technique that matches the shape of the thing under test.

## Equivalence partitioning

Split inputs into classes where every member should behave the same, then test one
member per class. The value is in the classes you find, not the examples you pick.

Timer duration field: negative · zero · one · typical · very large · non-numeric ·
empty. Seven classes, seven tests — not seventy values.

## Boundary value analysis

Bugs cluster at edges. For each partition test the first, last, and the values just
outside. `0` and `1` seconds matter far more than `45`.

## Decision tables

For rules with several conditions, enumerate the combinations and mark the expected
outcome. Combinations you cannot fill in are usually unstated requirements.

## State transition testing

Best fit for anything with modes. Model states and events, then test every
transition — including the ones nobody specified, which is where the defects are.

Worked example, the countdown timer:

| State \ Event | start       | stop        | reset                       | clear  | tick to 0  |
| ------------- | ----------- | ----------- | --------------------------- | ------ | ---------- |
| **Running**   | running     | **stopped** | **running** (time reloaded) | timeup | **timeup** |
| **Stopped**   | **running** | stopped     | **stopped** (time reloaded) | timeup | —          |
| **Time Up**   | running?    | timeup      | stopped/running?            | timeup | —          |

Bold cells are covered by `apps/countdown-timer/tests/`. The two cells marked `?`
are unverified: what start and reset do _from_ the Time Up state is unknown, and
the table is what makes that gap visible. A click-through-the-happy-path suite
would never surface it.

Note the third column. The intuitive assumption is that reset also pauses; it does
not. The table forced the question and a test now pins the real behaviour.

## Applying this in the harness

Design before code. Record the model next to the tests as `coverage.md` in the app
folder, so the next person sees what was deliberately left untested rather than
guessing whether a gap is an oversight.

An agent generating tests must produce the model first and get it approved before
writing a spec — the approval step from the `pwtest` workflow exists for this reason.
