# Coverage — countdown-timer

What is tested, what is deliberately not, and why. Written per `test-design` and
`risk-assessment`; the "not covered" half is the point.

## Risk

Third-party practice app, no data, no auth, no money. Impact of any defect is 1 —
nothing is at stake. It is here to exercise the harness, not to be assured.

The one risk that matters is **to our own suite**, not to the app: time-based UI is
where sleeps and flake normally enter. Likelihood 3, because it is the failure mode
this app is designed to provoke. That is why the specs drive `page.clock` and why the
suite asserts a 30-second countdown and a 60-second hold in about three seconds.

## State model

Verified by probing, not assumed. Bold cells have a test.

| State \ Event | start       | stop        | reset                      | clear      | tick to zero |
| ------------- | ----------- | ----------- | -------------------------- | ---------- | ------------ |
| **Running**   | running     | **stopped** | **running**, time reloaded | **timeup** | **timeup**   |
| **Stopped**   | **running** | stopped     | **stopped**, time reloaded | timeup     | —            |
| **Time Up**   | ?           | ?           | ?                          | timeup     | —            |

Two findings came out of building this table:

- **`reset` does not change running state.** It reloads the duration and leaves the
  timer running if it was running. The intuitive assumption is that reset also pauses,
  and a test written on that assumption fails against correct behaviour. It did.
- **The app auto-starts on load**, so a fresh page is already in Running.

## Covered

| Behaviour                               | Spec                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Counts down to `Time Up!` past zero     | `should reach Time Up when the countdown runs past zero`                        |
| `stop` holds the remaining time         | `should hold the remaining time while stopped`                                  |
| `start` resumes from the held value     | `should resume from the held value when started again after a stop`             |
| `reset` reloads duration, keeps running | `should load the configured duration but keep running when reset mid-countdown` |
| `reset` while stopped stays paused      | `should load the configured duration and stay paused when reset while stopped`  |
| `clear` jumps straight to `Time Up!`    | `should jump straight to Time Up when cleared mid-countdown`                    |

## Not covered — and why

- **The whole `Time Up` row.** What `start` and `reset` do _from_ the Time Up state is
  unknown. This is a real gap, not an oversight: the table is what made it visible, and
  it is the obvious next charter for `exploratory-session`.
- **Duration input validation.** Negative, zero, non-numeric, very large, empty. Worth
  probing (`test-design/references/test-data-probes.md`) but low value here — it is a
  practice app and nothing depends on the outcome.
- **Accessibility.** No keyboard-only or screen-reader pass. The app has no test ids
  and six text-dependent controls; see `scans/timer.json`.
- **Cross-browser and mobile.** Desktop Chrome only.
- **Network behaviour.** There is none — the app makes zero requests, which is itself
  worth recording: the harness's network capture adds nothing for this app.

## Notes

Selectors are all `#id`, because the app exposes no `data-testid`. The ids are
hand-authored and stable, which is the one case where a CSS id selector is the right
answer rather than a compromise. Third-party, so no testability fixes are possible —
recorded so nobody re-audits it.
