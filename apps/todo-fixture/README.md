# todo-fixture

A deliberately small todo app bundled with the harness (`app/server.mjs` plus
`app/index.html`, no build step). Playwright starts it automatically.

## Why it is here

The suite and the network capture need something real to exercise that does not
depend on an external environment or an API key, so `npm test` works on a fresh
clone and in CI.

## API

| Method | Path           | Behaviour                                                                      |
| ------ | -------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/api/todos`   | `{ todos: [...] }`                                                             |
| `POST` | `/api/todos`   | `201` with the created todo, or `422` when the title is empty                  |
| `GET`  | `/favicon.ico` | `204`, so incidental browser traffic cannot fail a "no failed calls" assertion |

## Fault mode

`/?optimistic=1` renders the new row **before** the write is confirmed and never
rolls back — the real-world bug class where the UI shows success over a failed
request. The harness self-tests in `tests/harness/` use it to prove that network
capture catches what a DOM-only assertion misses.

State is in memory and grows during a run, so tests must not assume a fixed
initial count.
