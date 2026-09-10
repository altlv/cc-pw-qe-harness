# HANDOFF — how to work here

The recovery packet. Read this first after a context loss, then `PLAN.md` for where
the work actually stands.

Deliberately durable: working agreements, traps and orientation. **No counts, no test
results, no "what is proven"** — that is `PLAN.md`, and duplicating it here is what
previously let this file claim a role was unvalidated after it had been validated. If
something here needs updating every session, it is in the wrong file.

## What this is

`cc-pw-qe-harness` — Claude + Playwright + QA/QE practice, public at
`altlv/cc-pw-qe-harness`. Three parts, all meant to be real: **cc** agent roles and
skills, **pw** the Playwright stack, **qe** the quality practice that decides whether a
test proves anything.

Apps under `apps/` are **subjects under test**, one folder each, so a new app never
collides with an existing one.

## Working agreements

- **The user owns every commit and push.** Do not commit unprompted, never push
  unasked. Reach a coherent point, say what it would contain, let them decide.
- **mcpa-bot is its own repository.** It may be read as a benchmark; nothing from it is
  copied in.
- **Do not put inventory counts in documentation.** Name the command that produces the
  number instead. `docs/conventions.md` carries the rule and the reasoning.
- **Every test must prove something** — expectations met or failed, and if failed, why.
  Enforced, not aspirational: `npm run assert-quality`.
- **Extending the harness has its own bar:** `docs/definition-of-done.md`. Ten items,
  each earned by a real failure here.

## The definitions this project runs on

**Testability** — the ability to **identify** and **interact with** the available
elements and objects, _easily enough_. Test ids are one way to satisfy the first half
and were inherited from the tooling, not the definition. Most apps have none and are
testable anyway, so their absence is not a finding. What is: ambiguous, unaddressable,
unreachable, unlabelled input, no observable state.

**Exploration** — interaction, observation and hypothesis testing. Scan logging and
page-structure understanding are tooling that supports it; session reports and
heuristics are separate tools that also support it. All are needed.

## Traps found the hard way

Curated, not appended. Delete anything that stops being true.

- **A detector that cries wolf is worse than none.** Two of ours did. Run a new rule
  against a known-good page and confirm silence, not only against the case you built it
  for.
- **A green suite is not evidence the assertions are good.** Run `npm run mutate`.
- **`document.elementFromPoint` only answers inside the viewport.** Clamping an
  off-screen centre onto the edge samples a different element and invents an overlay.
  Off-screen is not a blocker anyway — Playwright scrolls before acting.
- **No named or const-assigned functions inside `page.evaluate`.** tsx/esbuild rewrites
  them to call a `__name` helper that does not exist in the page; the failure is an
  opaque `ReferenceError`.
- **A static value can be a decoy.** The countdown display ships in the HTML already
  reading `01:01:12` — exactly what the init script sets — so asserting it proves
  nothing about whether the app is alive.
- **Use a script file, not a shell heredoc**, for anything containing escapes. Heredocs
  have corrupted files three times here.
- **Do not share an output path between parallel tests**, and do not assert on the size
  of a shared collection. Both have caused flakes here.
- **`--reporter=line` on the CLI replaces the reporters configured in
  `playwright.config.ts`**, which silently starves the gate of its JSON results.

## Credentials

A 3-hour API key was supplied on 2026-09-10 and written to `.env` — gitignored, and
verified absent from every tracked file. **It is in the chat transcript and should be
revoked.** `.env` also holds deliberately empty keys for other providers; the user set
those to observe how bad keys are handled. Do not "fix" them.

`src/env.ts` loads `.env` via Node's own loader.

## Where things live

| Kind of knowledge             | Home                                               |
| ----------------------------- | -------------------------------------------------- |
| Where the work stands         | `.ai/state/PLAN.md`                                |
| Working agreements, traps     | this file                                          |
| How an app under test behaves | `apps/<app>/README.md` and `coverage.md`           |
| Why a line of code exists     | a comment next to it, and the commit that added it |
| Test conventions              | `docs/conventions.md`                              |
| Bar for extending the harness | `docs/definition-of-done.md`                       |

## Still missing from the goose inheritance

Recipes: 0 of 9 — the orchestration layer; format in
`goose-harness/recipes/new-feature.yaml`. Agent contracts: 7 of 22, though the seven
cover every test level. Schemas: verdict ported; requirements-analysis and
triage-report not.
