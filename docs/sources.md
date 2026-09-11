# Sources

Where the thinking in `.claude/skills/` came from, and what each licence lets us do
with it.

One file rather than a paragraph per skill. Credit is owed and has to live somewhere;
it does not have to live inline, where it grows every file it touches and pushes the
useful part further from the top.

## How to read the "we may" column

| Term      | Meaning                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **adapt** | The licence permits derivative work. We may rewrite it into a skill, with attribution.                                                                            |
| **cite**  | The licence forbids derivatives, or the source is a book we do not hold rights to. We may reference it, link it and build from its own upstream — not rewrite it. |
| **idea**  | General practice with no single owner. Attribution is courtesy and accuracy, not obligation.                                                                      |

Ideas and facts are not copyrightable; the selection, arrangement and expression of a
list can be. When in doubt this repo cites rather than adapts — it costs nothing,
since most of this material descends from shared upstream anyway.

## Practice this repo's skills are built on

| Source                                                                        | We may | Where it shows up                                                                                                                                         |
| ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cem Kaner, James Bach, Bret Pettichord** — context-driven testing           | idea   | `test-design` risk-driven design and product-dimension decomposition; `bug-report` advocacy                                                               |
| **James Bach, Michael Bolton** — FEW HICCUPPS consistency oracles             | idea   | `oracle-check`. Ours runs to eleven oracles: theirs plus Comparable features, Explainability and World                                                    |
| **James Bach, Michael Bolton, Maaret Pyhäjärvi** — session-based testing      | idea   | `exploratory-session` charter-and-debrief                                                                                                                 |
| **Egbert Marselis** (product-dimension thinking), **Mike Cohn** (the pyramid) | idea   | `test-design` decomposition and level allocation                                                                                                          |
| **ISTQB Foundation** test design techniques                                   | idea   | `test-design` §5 today; `test-techniques` when it lands. The techniques themselves are public practice — the syllabus wording is not, so we write our own |

## Specific works consulted

| Work                                                                                                                             | Licence                          | We may | What we took                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trowser** — testing browser and `trowserkit`, Rikard Edgren. `github.com/Trowser/Trowser`                                      | MIT with Commons Clause          | adapt  | `testheuristics.md` is the source for the follow-up moves and time-sequence probes we lacked. Commons Clause restricts **selling**; this harness is not sold. Rewrite in our own words, credited here                                             |
| **The Little Black Book on Test Design** — Rikard Edgren, thetesteye. `thetesteye.com/papers/TheLittleBlackBookOnTestDesign.pdf` | CC Attribution-**NoDerivatives** | cite   | Read it; do not rewrite it. Its 37 Sources for Test Ideas, quality-characteristics set and the ongoing/classic/combinatorial/visual split informed our thinking. Build from the upstream **it** names — Sabourin's 10 Sources, HICCUPPS(F), Kaner |
| **Software Quality Characteristics** — Edgren, Emilsson, Jansson, thetesteye                                                     | CC Attribution-NoDerivatives     | cite   | The characteristic set `test-design` §3 should widen toward, **charisma** included                                                                                                                                                                |
| **Elisabeth Hendrickson** — Test Heuristics Cheat Sheet                                                                          | published freely, author's own   | cite   | Data-attack vocabulary                                                                                                                                                                                                                            |
| **Brian Marick** — the term "test idea"                                                                                          | —                                | idea   | Terminology                                                                                                                                                                                                                                       |

## Provenance of this repo

Seeded from the maintainer's own earlier local projects (`b530114`) and from a
predecessor "goose-harness" whose agent-contract shape — mission, loads, method,
boundaries, output — this repo's roles still follow.

A large share of the 183 heuristic items across `.claude/skills/` originated there
rather than from any external source. The maintainer has declined personal credit; it
is recorded because provenance is a fact about the work, not a favour to anyone.

## Things we wrote ourselves

Not everything here descends from somewhere. These came out of failures in this repo
and are original to it:

- **`honesty-check`** — no external antecedent. Twenty-three rules about not
  overclaiming, written because agents overclaim.
- **`work-discipline`**, **`flaky-test-detection`**'s cause rows, **`testability-audit`**'s
  grading, and every rule in `docs/definition-of-done.md` — each traced to a specific
  failure that happened here.
- **Mutation testing as verification-of-verification** (`npm run mutate`) — the idea is
  old; hand-writing one mutation per enforced rule, and treating a survivor as proof a
  rule is untested, is this repo's own discipline.
