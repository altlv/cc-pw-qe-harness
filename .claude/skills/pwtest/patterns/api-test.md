# API test pattern

For `apps/<app>/tests/<feature>.api.spec.ts`. Import from `src/fixtures/api.js`, which
provides an `api` request context bound to the project's baseURL and launches no
browser.

```typescript
import { faker } from '@faker-js/faker';
import { test, expect } from '../../../src/fixtures/api.js';

interface Book {
  id: number;
  title: string;
  pageCount: number;
}

test.describe('Books API', () => {
  test('should return the collection with the documented shape', async ({ api }) => {
    const response = await api.get('/api/v1/Books');

    expect(response.status(), `GET returned ${response.status()}`).toBe(200);

    const books = (await response.json()) as Book[];
    expect(books.length).toBeGreaterThan(0);

    // Assert the contract, not the data. Exact values couple the test to seed data.
    expect(books[0]).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      pageCount: expect.any(Number),
    });
  });

  test('should create and persist a book', async ({ api }) => {
    const title = faker.lorem.sentence(3);

    const created = await api.post('/api/v1/Books', { data: { title, pageCount: 10 } });
    expect(created.status()).toBe(201);
    const book = (await created.json()) as Book;

    // Verify independently. An endpoint echoing its own input proves nothing about
    // whether the write landed.
    const readBack = await api.get(`/api/v1/Books/${book.id}`);
    expect(readBack.status()).toBe(200);
    expect((await readBack.json()) as Book).toMatchObject({ id: book.id, title });
  });
});
```

## Negative space — where the defects are

Drive these from equivalence partitioning, not from imagination
(`.claude/skills/test-design/SKILL.md`). Each case is a class, not an example.

```typescript
const invalid = [
  { label: 'empty string', title: '' },
  { label: 'whitespace only', title: '   ' },
  { label: 'wrong type', title: 12345 },
];

for (const { label, title } of invalid) {
  test(`should reject when the title is ${label}`, async ({ api }) => {
    const response = await api.post('/api/v1/Books', { data: { title } });
    expect(response.status()).toBe(422);
  });
}
```

Also cover: a missing required field entirely, an unknown id (expect 404 and assert the
error body's shape), and unauthorised access where auth applies.

## Documenting a known defect

When the API is genuinely wrong and will not be fixed soon, do not delete the test and
do not assert the broken behaviour as though it were correct. Mark it:

```typescript
test('should persist a created book', async ({ api }) => {
  test.fail(true, 'Known: POST returns 200 and echoes input but never persists.');
  // ... the test as it SHOULD pass
});
```

Playwright reports it as expected-to-fail, and flags it loudly if the API is ever
fixed. That is the honest record.

## Rules

- Include the status code in the failure message so a red run is readable without
  opening the trace.
- Never assume the store is empty or a fixed size — other tests share it.
- Clean up anything you create.
- Assert status first, then shape. A shape assertion against an error body is
  confusing noise.
