import { test, expect } from '../../../src/fixtures/api.js';

/**
 * Contract verified by probing on 2026-09-10, not assumed. See ../README.md for the
 * findings. Authors shares FakeRESTApi's generic controller, so it exhibits the same
 * three defects documented there for Books (no persistence, 200 not 201, no
 * required-field validation) — verified independently below rather than assumed.
 */

interface Author {
  id: number;
  idBook: number;
  firstName: string;
  lastName: string;
}

const AUTHORS = '/api/v1/Authors';

test.describe('Authors — collection', { tag: '@read-only' }, () => {
  test('should return the collection with the documented shape', async ({ api }) => {
    const response = await api.get(AUTHORS);

    expect(response.status(), `GET ${AUTHORS} returned ${response.status()}`).toBe(200);

    const authors = (await response.json()) as Author[];
    expect(authors.length).toBeGreaterThan(0);

    // Assert types, not values. Names are seeded — asserting them would couple this
    // test to fixture data.
    const [first] = authors;
    expect(first).toMatchObject({
      id: expect.any(Number),
      idBook: expect.any(Number),
      firstName: expect.any(String),
      lastName: expect.any(String),
    });
  });

  test('should return a single author whose id matches the one requested', async ({ api }) => {
    const response = await api.get(`${AUTHORS}/1`);

    expect(response.status()).toBe(200);
    expect(
      (await response.json()) as Author,
      'the API returned a different author than the one requested — an id mix-up would corrupt any client cache',
    ).toMatchObject({ id: 1, firstName: expect.any(String) });
  });
});

test.describe('Authors — error contract', { tag: '@read-only' }, () => {
  // RFC 7807-style problem details, matching the Books contract exactly. Worth
  // pinning: a client that branches on the error body breaks silently if this
  // shape changes.
  test('should return a 404 problem document for an id that does not exist', async ({ api }) => {
    const response = await api.get(`${AUTHORS}/999999`);

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
    const response = await api.get(`${AUTHORS}/abc`);

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { status: number; errors?: unknown };
    expect(body.status).toBe(400);
    expect(body.errors, 'a validation failure should name the offending field').toBeDefined();
  });

  test('should reject a payload whose field types are wrong', async ({ api }) => {
    const response = await api.post(AUTHORS, { data: { id: 'not-a-number', firstName: 'x' } });

    expect(response.status()).toBe(400);
  });
});

test.describe('Authors — create', { tag: '@writes' }, () => {
  test('should echo the submitted author back', async ({ api }) => {
    const firstName = `probe ${Date.now()}`;

    const response = await api.post(AUTHORS, {
      data: { id: 9999, idBook: 1, firstName, lastName: 'Test' },
    });

    // Documents actual behaviour: 200, not the 201 a create conventionally returns.
    // Same contract smell as Books (F2 in ../README.md) rather than quietly asserted
    // as correct.
    expect(response.status()).toBe(200);
    expect(
      (await response.json()) as Author,
      'create did not echo the submitted firstName back, so the response cannot be trusted to describe what was sent',
    ).toMatchObject({ firstName });
  });

  test('should persist a created author so it can be read back', async ({ api }) => {
    test.fail(
      true,
      'Same defect as Books F1: POST returns 200 and echoes the payload but stores ' +
        'nothing. Verified directly against Authors (not assumed from Books) by probing ' +
        'on 2026-09-10: POST /Authors then GET the returned id came back 404. Left as an ' +
        'expected failure so it documents the defect and shouts if it is ever fixed.',
    );

    const created = await api.post(AUTHORS, {
      data: { id: 8888, idBook: 1, firstName: 'persistence', lastName: 'probe' },
    });
    const author = (await created.json()) as Author;

    const readBack = await api.get(`${AUTHORS}/${author.id}`);
    expect(readBack.status(), 'a created resource should be retrievable').toBe(200);
  });

  test('should reject a create with no fields at all', async ({ api }) => {
    test.fail(
      true,
      'Same defect as Books F3: POST {} returns 200 with every field defaulted to null ' +
        'or zero. There is no required-field validation, so a client can create an empty ' +
        'record.',
    );

    const response = await api.post(AUTHORS, { data: {} });

    expect(response.status(), 'an empty payload should be rejected').toBe(400);
  });
});
