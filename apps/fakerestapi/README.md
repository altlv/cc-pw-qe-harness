# fakerestapi

<https://fakerestapi.azurewebsites.net> — FakeRESTApi.Web V1, a public practice REST
API. Third-party: `external: true`, so it never runs in CI.

## Why it is here

It is the **validation target for the `api-coder` role**. It has a real contract, real
error semantics, and three real defects — which makes it possible to check whether an
agent's findings are true rather than merely plausible.

## Contract

Verified by probing on 2026-09-10. Re-probe before trusting this; it is a deployed
service that can change under us.

| Endpoint                 | Behaviour                              |
| ------------------------ | -------------------------------------- |
| `GET /api/v1/Books`      | 200, array of 200 books, ids 1–200     |
| `GET /api/v1/Books/{id}` | 200 with the book, or 404              |
| `POST /api/v1/Books`     | **200** and echoes the payload         |
| `GET /api/v1/Books/abc`  | 400 with a validation problem document |

`Book`: `id` number · `title` string · `description` string · `pageCount` number ·
`excerpt` string · `publishDate` ISO string.

Errors are RFC 7807-style problem documents carrying `type`, `title`, `status` and
`traceId`.

**`publishDate` is regenerated on deploy** — the seeded books carry roughly today's
date. Never assert its value; assert that it parses.

Other collections exist — `Authors`, `Activities`, `Users`, `CoverPhotos`. They share
the same _engine_, so the three findings below apply to all of them. They do **not**
share the same record shape: `Author` is `{ id, idBook, firstName, lastName }`, nothing
like `Book`. Probe before assuming — an earlier version of this file claimed "the same
shape" and was simply wrong.

`Authors` is covered by `authors.api.spec.ts`, written by the `api-coder` role, which
found that shape by probing rather than by copying the Books spec.

## Findings

Recorded rather than asserted-as-correct. Two are pinned by `test.fail()`, so the suite
documents them and shouts if they are ever fixed.

**F1 — `POST` never persists.** Returns 200 and echoes the payload; a subsequent
`GET /api/v1/Books/{id}` returns 404. A create endpoint echoing its own input proves
nothing about storage, which is exactly why the API-test pattern in this repo insists
on reading the resource back. This API is the live demonstration of that rule.

**F2 — `POST` returns 200, not 201.** A contract smell rather than a defect: a client
branching on 201 to detect creation will never see one.

**F3 — no required-field validation.** `POST {}` returns 200 with every field
defaulted (`id: 0`, `title: null`, `publishDate: "0001-01-01T00:00:00"`). Type
validation _is_ enforced — a wrong type gives 400 — so the gap is semantic, not
structural, which is the harder kind to notice.

## Notes

No auth, no rate limit observed, no cleanup needed — nothing persists, so tests cannot
pollute it. That also means tests here can never verify a write, which caps what this
target can prove.
