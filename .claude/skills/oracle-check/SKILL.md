---
name: oracle-check
description: Decide whether observed behaviour is actually a bug, by walking a checklist of consistency oracles. Use when asked "is this a bug?", when something looks wrong but there is no spec, or before filing a defect.
---

An oracle is the basis on which you call something wrong. "It looks broken" is not an
oracle. Without naming one, a bug report is an opinion and gets closed as such.

Walk the list. For each, ask: is the observed behaviour inconsistent with this? Most
findings violate more than one — the strongest report names the clearest.

## Consistency oracles

| Oracle                     | The question                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **History**                | Did it behave differently before? A regression is the easiest bug to justify.                                           |
| **Comparable products**    | Do similar products behave differently? Strong when the difference is stark, weak on taste.                             |
| **Claims**                 | Does it contradict docs, a story, the UI's own labels, or something support told a customer?                            |
| **User expectations**      | Would a reasonable user be surprised or harmed? Weakest alone, strongest with evidence of actual confusion.             |
| **Internal consistency**   | Does the product contradict _itself_ — two screens disagreeing, a total not matching its rows? Very hard to argue with. |
| **Comparable features**    | Does a sibling feature handle this case differently?                                                                    |
| **Purpose**                | Does it defeat what the feature is for, even while meeting its stated requirements?                                     |
| **Statutes and standards** | Does it violate law, accessibility guidance, or a protocol spec?                                                        |
| **Familiar problems**      | Does it resemble a known failure class — off-by-one, timezone, encoding, race, unbounded input?                         |
| **Explainability**         | Can you explain the behaviour to a colleague without saying "it just does that"?                                        |
| **World**                  | Does it contradict reality — a negative duration, a future birth date?                                                  |

## Procedure

1. State the observation precisely. Inputs, steps, environment, what actually happened.
2. Walk the oracles. Note every one violated, not just the first.
3. Pick the strongest for the report. Internal consistency and claims beat expectation.
4. Rate confidence: is this definitely wrong, probably wrong, or merely surprising?
5. **If no oracle applies, do not file a bug.** Raise a question to the product owner
   instead. That is a legitimate and useful output.

## Output

```markdown
Observation: <what happened, with exact steps and data>
Oracles violated: <named, with the specific inconsistency>
Strongest basis: <one, and why>
Confidence: definitely wrong | probably wrong | surprising, needs a decision
Recommendation: file defect | raise question | no action
```

## Notes

- Two oracles disagreeing is itself a finding: the spec says one thing and the UI says
  another means someone has to decide which is right.
- Beware the expectation oracle on its own. "I wouldn't have designed it that way" is
  a preference, and filing it as a defect spends credibility you need for real ones.

The consistency-heuristic framing here is a long-standing idea in exploratory testing
practice (Bach and Bolton's FEW HICCUPPS); this is our own wording of it.
