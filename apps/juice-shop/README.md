# juice-shop

OWASP Juice Shop — <https://github.com/juice-shop/juice-shop>, v20.2.0 as cloned.

**The source is not vendored.** It lives in its own checkout at
`C:/Users/User/owasp-juice-shop`; only this config and our own tests live here.

## Why it is in the harness

Every other subject sits at exactly one environment: `todo-fixture` is local-only,
`countdown-timer` and `fakerestapi` are remote-only. So the environment machinery had
nothing to actually exercise — the same suite could never be pointed at two
deployments of one app and behave differently.

Juice Shop is the first subject with **two**: a local clone we control, and a public
demo we must not touch. That is what makes `@writes` runs locally and refused on prod
a demonstration rather than an assertion.

It is also an **Angular** application, which matters for a second reason: framework
detection in `src/tools/stack.ts` ships thirteen detectors and only jQuery has ever
been confirmed against a live app. This is the target that closes the first of them.

## Environments

|         | URL                             | State                                                                                                            |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `local` | `http://127.0.0.1:3000`         | Default. Needs `npm install && npm start` in the clone; the first Angular build is slow                          |
| `prod`  | <https://demo.owasp-juice.shop> | Public shared demo. **Returned "Application Error" when probed 2026-09-10**, so treat availability as unreliable |

The demo being down is the argument for `external: true` in one line: a suite that
reddens because somebody else's free demo is having a bad day teaches the team to
ignore red.

## What it is, and the care that follows

Juice Shop is **deliberately vulnerable** — that is its purpose, as OWASP's training
target. Two consequences worth stating rather than assuming:

- Its defects are _security_ defects. As a QE subject that makes it unusual: most of
  what is wrong with it is wrong on purpose, so "found a bug" is not a finding here
  unless it is a bug the app did not intend.
- Nothing learned here transfers to attacking anything else. It is a practice range.

For functional-defect practice, `practice-software-testing` (parked in
`apps/README.md`) is the better-shaped subject; this one earns its place on the
environment and Angular questions.

## Coverage

None yet. No spec has been written, and the local instance has not been built or run —
so nothing in this folder has been verified against a running application. That is the
next step, not a gap someone forgot.
