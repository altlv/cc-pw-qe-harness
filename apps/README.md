# Apps under test

One folder per application. Nothing in an app folder is shared with another app,
so adding a new target cannot disturb an existing one.

```
apps/
  <app-name>/
    app.config.ts     name, baseURL, scan scope, web server, external flag
    tests/            specs for this app only
    pages/            page objects for this app only (create when needed)
    scans/            page-scanner output, committed as a testability record
    README.md         what the app is and anything odd about testing it
```

## Adding an app

1. `mkdir -p apps/<name>/tests`
2. Write `apps/<name>/app.config.ts` (see `apps/app-config.ts` for the contract)
3. Register it in `apps/registry.ts`

That is all. `playwright.config.ts` derives the project, test directory, base URL
and web server from the registry, so no other file needs editing.

## Local vs external

An app with `external: true` targets a third-party site. Those are excluded from
`npm test` and from CI, and run only via `npm run test:external`. A suite that goes
red because someone else's site is down trains people to ignore red.

| App               | Kind     | What it is                                                                                          |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `todo-fixture`    | local    | Bundled todo app; gives the suite and the network capture something real to exercise offline.       |
| `countdown-timer` | external | Practice app at testpages.eviltester.com. Time-based UI, used to prove the no-arbitrary-waits rule. |
