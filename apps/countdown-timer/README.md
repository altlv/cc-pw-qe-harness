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
