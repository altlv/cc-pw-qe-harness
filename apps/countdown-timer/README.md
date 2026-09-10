# countdown-timer

<https://testpages.eviltester.com/apps/countdown-timer/> — Alan Richardson's
synchronisation practice app. Third-party: `external: true`, so it never runs in CI.

## Why it is here

A countdown is the honest test of "no arbitrary waits". The naive suite sleeps for
the duration: slow, and racy on a loaded machine. These specs drive Playwright's
virtual clock instead, so a 30-second countdown and a 60-second hold are both
asserted in milliseconds.

## Controls

| Element                      | Selector                     | Notes                             |
| ---------------------------- | ---------------------------- | --------------------------------- |
| Remaining time               | `#javascript_countdown_time` | `HH:MM:SS`, or `Time Up!` at zero |
| Duration                     | `#timer-seconds`             | number input, defaults to 3672    |
| Start / Stop / Clear / Reset | `#start-timer` etc.          | plain ids                         |

No `data-testid` anywhere, so every selector falls to the id tier. Ids here are
hand-written and stable, which is why the scan reports them as stable rather than
fragile.

## Behaviour, verified rather than assumed

- The timer **auto-starts on load**.
- `stop` pauses and holds the remaining time.
- `clear` jumps straight to `Time Up!`.
- `reset` loads the seconds input **but does not change running state** — reset
  while running keeps running. The obvious assumption is that reset also pauses;
  a test written on that assumption fails against correct behaviour.
- Reaching zero shows `Time Up!` and stays there.

## Clock control

The app schedules its tick with a recursive `setTimeout`. `clock.fastForward()`
jumps time and fires each pending timer once, so it advances the display by a
single second no matter how far you jump. Use **`clock.runFor()`**, which advances
tick by tick and fires every scheduled timeout.

`page.clock.install()` must run before `page.goto()`, or the app captures the real
clock first.

## Testability

Audited 2026-09-10 by the `testability-reviewer` role; every claim below was verified
independently against the live page. Third-party, so none of it is fixable — recorded
so nobody audits it again expecting action.

Scan (`SCAN_WITHIN=main`, committed at `scans/timer.json`): no element carries a
`data-testid`. The app's own controls all have hand-authored ids, which is why the
scanner grades them stable rather than fragile. The text-dependent elements are all
site navigation, not timer controls — not worth raising.

Two things the scan cannot see, both confirmed in the page source:

**No accessible announcement of the countdown.** `#javascript_countdown_time` is a bare
`<p>` with no `aria-live` and no `role`. A screen-reader user gets no announcement as
the time ticks, and none when it reaches `Time Up!`.

**No control reflects run state.** No button carries `disabled`, `aria-pressed`, or a
state-dependent class — the markup is identical whether the timer is running or
stopped. So the only way for a test to detect state is to sample the display text
across elapsed time, which is exactly the flake this app exists to provoke. It is the
concrete reason the specs here drive `page.clock` rather than waiting: without a state
attribute there is nothing else to assert on.
