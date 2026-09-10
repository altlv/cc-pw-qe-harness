# Apps — the subjects under test

**Everything here is a subject under test, not part of the harness.** The harness is
`src/`; the harness's own tests are `tests/`. Nothing in `src/` imports from `apps/`,
so deleting a folder here removes a target and changes nothing about the tool.

One folder per subject. Nothing in an app folder is shared with another, so adding a
new target cannot disturb an existing one.

```
apps/
  <app-name>/
    app.config.ts     name, baseURL, scan scope, web server, external flag
    tests/            specs written against this subject only
    pages/            page objects for this subject only (create when needed)
    scans/            page-scanner output, committed as a testability record
    coverage.md       what is covered, and what is deliberately not
    README.md         what the subject is, and what was learned about testing it
```

A subject may be code we ship (`todo-fixture`), or a site we merely point at
(`countdown-timer`, `fakerestapi`). Either way the harness only ever observes it — the
tests live here, the tooling does not.

## Adding a subject

1. `mkdir -p apps/<name>/tests`
2. Write `apps/<name>/app.config.ts` (see `apps/app-config.ts` for the contract)
3. Register it in `apps/registry.ts`

That is all. `playwright.config.ts` derives the project, test directory, base URL and
web server from the registry, so no other file needs editing.

## Local vs external

A subject with `external: true` is a third-party site. Those are excluded from
`npm test` and from CI, and run only via `npm run test:external`. A suite that goes red
because someone else's site is down trains people to ignore red.

External subjects also cannot be fixed. Testability findings against them are recorded
in the app's README so nobody re-audits them expecting action.

| Subject           | Kind     | What it is for                                                                                                                                                                 |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `todo-fixture`    | local    | Bundled todo app. Gives the suite and the network capture something real to exercise with no external dependency and no API key.                                               |
| `countdown-timer` | external | Practice app at testpages.eviltester.com. Time-based UI, used to prove the no-arbitrary-waits rule and as the `testability-reviewer` role's validation target.                 |
| `fakerestapi`     | external | Public practice REST API. The `api-coder` role's validation target: a real contract with three real defects, so an agent's findings can be checked rather than taken on trust. |
