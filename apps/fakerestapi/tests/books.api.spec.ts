import { test, expect } from '../../../src/fixtures/api.js';

/**
 * Contract verified by probing on 2026-09-10, not assumed. See ../README.md for the
 * findings, including three places where this API does not behave the way its shape
 * suggests.
 */

interface Book {
  id: number;
  title: string;
  description: string;
  pageCount: number;
  excerpt: string;
  publishDate: string;
}

const BOOKS = '/api/v1/Books';

test.describe('Books — collection', () => {
  test('should return the collection with the documented shape', async ({ api }) => {
    const response = await api.get(BOOKS);

    expect(response.status(), `GET ${BOOKS} returned ${response.status()}`).toBe(200);

    const books = (await response.json()) as Book[];
    expect(books.length).toBeGreaterThan(0);

    // Assert types, not values. `publishDate` is regenerated on every deploy and the
    // titles are seeded — asserting either would couple this test to fixture data.
    const [first] = books;
    expect(first).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      description: expect.any(String),
      pageCount: expect.any(Number),
      excerpt: expect.any(String),
      publishDate: expect.any(String),
    });
    expect(
      Number.isNaN(Date.parse(first?.publishDate ?? '')),
      'publishDate must be a parseable date',
    ).toBe(false);
  });

  test('should return a single book whose id matches the one requested', async ({ api }) => {
    const response = await api.get(`${BOOKS}/1`);

    expect(response.status()).toBe(200);
    expect(
      (await response.json()) as Book,
      'the API returned a different book than the one requested — an id mix-up would corrupt any client cache',
    ).toMatchObject({ id: 1, title: expect.any(String) });
  });
});

test.describe('Books — error contract', () => {
  // RFC 7807-style problem details. Worth pinning: a client that branches on the
  // error body breaks silently if this shape changes.
  test('should return a 404 problem document for an id that does not exist', async ({ api }) => {
    const response = await api.get(`${BOOKS}/999999`);

    expect(response.status()).toBe(404);
    expect(
      (await response.json()) as Record<string, unknown>,
      'the 404 body is not a problem document — a client branching on its shape breaks silently',
    ).toMatchObject({
      title: 'Not Found',
      status: 404,
      type: expect.any(String),
    });
  });

  test('should return a 400 problem document when the id is not a number', async ({ api }) => {
    const response = await api.get(`${BOOKS}/abc`);

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { status: number; errors?: unknown };
    expect(body.status).toBe(400);
    expect(body.errors, 'a validation failure should name the offending field').toBeDefined();
  });

  test('should reject a payload whose field types are wrong', async ({ api }) => {
    const response = await api.post(BOOKS, { data: { id: 'not-a-number', title: 'x' } });

    expect(response.status()).toBe(400);
  });
});

test.describe('Books — create', () => {
  test('should echo the submitted book back', async ({ api }) => {
    const title = `probe ${Date.now()}`;

    const response = await api.post(BOOKS, {
      data: {
        id: 9999,
        title,
        description: 'd',
        pageCount: 10,
        excerpt: 'e',
        publishDate: '2026-01-01T00:00:00Z',
      },
    });

    // Documents actual behaviour: 200, not the 201 a create conventionally returns.
    // Recorded as finding F2 in ../README.md rather than quietly asserted as correct.
    expect(response.status()).toBe(200);
    expect(
      (await response.json()) as Book,
      'create did not echo the submitted title back, so the response cannot be trusted to describe what was sent',
    ).toMatchObject({ title });
  });

  test('should persist a created book so it can be read back', async ({ api }) => {
    test.fail(
      true,
      'Known defect F1: POST returns 200 and echoes the payload but stores nothing. ' +
        'Left as an expected failure so it documents the defect and shouts if it is ever fixed.',
    );

    const created = await api.post(BOOKS, {
      data: {
        id: 8888,
        title: 'persistence probe',
        description: 'd',
        pageCount: 1,
        excerpt: 'e',
        publishDate: '2026-01-01T00:00:00Z',
      },
    });
    const book = (await created.json()) as Book;

    const readBack = await api.get(`${BOOKS}/${book.id}`);
    expect(readBack.status(), 'a created resource should be retrievable').toBe(200);
  });

  test('should reject a create with no fields at all', async ({ api }) => {
    test.fail(
      true,
      'Known defect F3: POST {} returns 200 with every field defaulted to null or zero. ' +
        'There is no required-field validation, so a client can create an empty record.',
    );

    const response = await api.post(BOOKS, { data: {} });

    expect(response.status(), 'an empty payload should be rejected').toBe(400);
  });
});
