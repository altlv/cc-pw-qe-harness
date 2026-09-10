# Definition of done — extending the harness

Applies when adding a capability to the harness itself: a tool, a rule, a role, a
skill, a policy. Not for writing tests against an app — that is `docs/conventions.md`.

Every item below was earned. Each one names the real failure that put it here, so a
reader can judge whether it still applies rather than obeying a list.

---

## 1. Proven, not merely present

A capability with no test that fails when it breaks is a claim, not a feature.

> The seven agent roles existed as data for the whole project and no entry point ever
> read them. They looked finished in every review.

- [ ] A test exists that fails if this stops working
- [ ] The test asserts an outcome, not that the code ran

## 2. Exercised against something we did not write

Fixtures agree with their author. Real systems do not.

> The stack detector called a jQuery page an SPA. It looked right on the local fixture
> and only broke on the second, third-party app.

- [ ] Run against at least one target outside this repo
- [ ] For an external target, note the date — it can change under us

## 3. Checked for false positives, if it flags anything

A detector that cries wolf is worse than no detector: it teaches everyone to ignore
the next finding, which may be real.

> Occlusion detection flagged `Reset Timer` as unreachable on a page our own suite
> clicks successfully every run. The bug was in the detector, not the app.

- [ ] Run it against a known-good page and confirm silence
- [ ] Run it against a known-bad case and confirm it fires
- [ ] Both directions verified, not just the one you expected

## 4. Everything that references it still agrees

Two sources of truth means one of them is lying.

> `testability-audit` still told agents to raise "add data-testid" findings after the
> scanner stopped raising them.

- [ ] Skills, README, CLAUDE.md and conventions updated in the same change
- [ ] No doc names a command or flag that does not exist

## 5. Blind spots declared

Silence reads as coverage. An unexamined area must say so itself.

> The scanner never crossed into iframes, so an app that framed its real content was
> reported as a nearly empty, clean page.

- [ ] What this cannot see is stated in its own output, not only in a doc
- [ ] "Not covered" appears in the artefact a reader actually looks at

## 6. Enforced, not advertised

An agent that reads a rule and promises to follow it has made a claim. A bound it
cannot exceed is evidence.

> The session rules of engagement are a checklist _and_ a policy object, because the
> checklist alone is honour-system.

- [ ] Constraints live in code, not only in prose
- [ ] A test proves the constraint actually holds

## 7. Read back by something

An artefact nothing consumes is write-only, and write-only artefacts rot unnoticed.

> Scans were produced and committed for months. No code ever read one back, so there
> was no drift detection and no baseline for healing.

- [ ] Some tool, test or gate consumes it — or it is explicitly for humans only
- [ ] If it accumulates, say how; if it overwrites, say why that is acceptable

## 8. Safety and environment considered

Ask what this does against a system that is not ours and not disposable.

> The network log writes request and response bodies to disk. Against production that
> is a file of real user data sitting in the repo.

- [ ] Behaviour on local / test / prod is decided, not accidental
- [ ] Anything irreversible is gated, and refusals are reported rather than silent

## 9. Assertions mutation-checked

A green suite proves the tests run. It does not prove they would notice a fault.

- [ ] `npm run mutate` still catches every mutation
- [ ] New rules carry a mutation if they are worth trusting

## 10. Written down where it survives the conversation

> This file's own TODO drifted twice. A finding that exists only in a chat is already
> lost.

- [ ] `.ai/state/` refreshed: what is true, what is open, what is not proven
- [ ] Anything discovered on the way recorded in `FINDINGS.md` with its evidence

---

## The two questions worth asking last

**What would make this wrong?** If nothing could, it asserts nothing.

**What does this now claim that nobody has checked?** That sentence belongs in
`STATUS.md` under "not proven", not in the README under features.
