# Coverage — fakerestapi

Written per `test-design` and `risk-assessment`. The "not covered" half is the point.

## Risk

A third-party practice API with no data of ours, no auth and nothing at stake. Impact
of any defect is 1.

The risk that matters is **to the harness**, not the app: this is where `api-coder`
gets validated, so the tests must be ones whose truth can be checked independently.
That is why every assertion here maps to a probe recorded in README.md.

## Covered

| Behaviour                                         | Spec                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Collection returns the documented shape and types | `should return the collection with the documented shape`             |
| Single resource returns the id requested          | `should return a single book whose id matches the one requested`     |
| Unknown id gives a 404 problem document           | `should return a 404 problem document for an id that does not exist` |
| Non-numeric id gives a 400 naming the field       | `should return a 400 problem document when the id is not a number`   |
| Wrong field types are rejected                    | `should reject a payload whose field types are wrong`                |
| Create echoes the payload (200, not 201)          | `should echo the submitted book back`                                |
| **F1** create does not persist                    | `should persist a created book` — `test.fail()`                      |
| **F3** empty payload is not rejected              | `should reject a create with no fields at all` — `test.fail()`       |

`Authors` is covered by `authors.api.spec.ts` to the same depth — collection shape,
single lookup, both error contracts, echo-on-create, and the same two defects pinned
with `test.fail()`. That spec was **written by the `api-coder` role**, not by hand; it
probed the API rather than copying the Books file, which is visible in the `Author`
shape it discovered (`idBook`, `firstName`, `lastName` — different from `Book`).

## Not covered — and why

- **`PUT` and `DELETE`.** Same non-persistence applies, so a test could only confirm
  the echo. Little to learn beyond what F1 already records.
- **`Activities`, `Users`, `CoverPhotos`.** Same engine again. Two collections
  covered properly says more than five covered shallowly; the pattern is established,
  and repeating it is volume rather than information.
- **Boundary probes on `pageCount`** — zero, negative, `INT_MAX`, one past it. Still
  deliberately open: it is the headroom for the next role validation, this time of
  `test-design/references/test-data-probes.md` handling rather than contract shape.
- **Pagination, filtering, sorting.** Not offered by the API.
- **Concurrency.** Nothing persists, so there is no state to race on.
- **Auth.** None exists.

## Note for role validation

Two things left uncovered above are deliberate headroom: the boundary probes and the
sibling collections. When `api-coder` is finally run against this target, what it finds
there is checkable against README.md — which is what makes this a validation rather
than a demo.
