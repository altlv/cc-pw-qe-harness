import { test, expect } from '@playwright/test';
import type { CapturedCall } from '../../src/capture/types.js';
import {
  buildDataDictionary,
  formatDictionary,
  inferShape,
  templatePath,
} from '../../src/tools/schema.js';

/**
 * The data dictionary is the half of exploration a DOM scan cannot produce: the
 * field names, types and samples an author needs in order to assert on values
 * rather than on visibility. These tests pin the inferences that claim is built
 * on.
 */

function call(overrides: Partial<CapturedCall> = {}): CapturedCall {
  return {
    method: 'GET',
    url: 'http://app.test/api/items',
    path: '/api/items',
    status: 200,
    failure: null,
    durationMs: 10,
    resourceType: 'fetch',
    requestBody: null,
    responseBody: null,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

test.describe('templatePath', () => {
  test('should collapse numeric id segments so repeated calls group as one endpoint', () => {
    expect(
      templatePath('/api/v1/Books/42'),
      'a numeric segment must become {id}, or a list page of fifty rows reports fifty endpoints',
    ).toBe('/api/v1/Books/{id}');
  });

  test('should collapse uuid segments', () => {
    expect(
      templatePath('/users/3f2504e0-4f89-11d3-9a0c-0305e82c3301/profile'),
      'uuid segments must be templated the same way numeric ids are',
    ).toBe('/users/{uuid}/profile');
  });

  test('should leave a path with no id-shaped segment untouched', () => {
    expect(
      templatePath('/api/v1/Books'),
      'templating must not rewrite ordinary resource names, or endpoints stop being identifiable',
    ).toBe('/api/v1/Books');
  });

  test('should not treat a version segment as an id', () => {
    expect(
      templatePath('/api/v2/status'),
      'v2 is part of the route, not a parameter; collapsing it would merge unrelated endpoints',
    ).toBe('/api/v2/status');
  });
});

test.describe('inferShape', () => {
  test('should report the type and a real sample for each field', () => {
    const fields = inferShape([{ id: 1, title: 'Write a test' }]);
    const title = fields.find((field) => field.path === 'title');

    expect(title, 'a top-level field must appear in the inferred shape').toBeDefined();
    expect(title?.types, 'the type is what lets an author assert rather than guess').toEqual([
      'string',
    ]);
    expect(
      title?.sample,
      'a real sample teaches more than a type name, which is the whole point of probing over reading docs',
    ).toBe('Write a test');
  });

  test('should merge array elements into one shape so a field missing from later rows is still seen', () => {
    const fields = inferShape([[{ id: 1, note: 'first' }, { id: 2 }]]);
    const paths = fields.map((field) => field.path);

    expect(
      paths,
      'array elements must merge into a single [] shape rather than one entry per index',
    ).toContain('[].note');
    expect(
      fields.find((field) => field.path === '[].id')?.seen,
      'both elements carry id, so it must be counted twice',
    ).toBe(2);
  });

  test('should mark a field nullable when any payload carried null', () => {
    const fields = inferShape([{ due: '2026-01-01' }, { due: null }]);
    const due = fields.find((field) => field.path === 'due');

    expect(
      due?.nullable,
      'nullability is the difference between a safe assertion and an intermittent failure',
    ).toBe(true);
    expect(due?.types, 'both observed types must be recorded, not just the last one').toEqual([
      'null',
      'string',
    ]);
  });

  test('should mark a top-level field optional when some payloads omit it', () => {
    const fields = inferShape([{ id: 1, note: 'has one' }, { id: 2 }]);

    expect(
      fields.find((field) => field.path === 'note')?.optional,
      'a field present in one payload and absent in another is optional; asserting it always exists would flake',
    ).toBe(true);
    expect(
      fields.find((field) => field.path === 'id')?.optional,
      'a field present in every payload must not be reported as optional',
    ).toBe(false);
  });

  test('should return nothing when no payload could be parsed', () => {
    expect(
      inferShape([undefined, undefined]),
      'unparseable bodies must yield no fields rather than a fabricated shape',
    ).toEqual([]);
  });
});

test.describe('buildDataDictionary', () => {
  test('should group calls that differ only by id and keep both statuses', () => {
    const dictionary = buildDataDictionary([
      call({ path: '/api/items/1', responseBody: '{"id":1}' }),
      call({ path: '/api/items/2', status: 404, responseBody: '{"error":"nope"}' }),
    ]);

    expect(dictionary, 'two calls to the same templated route are one endpoint').toHaveLength(1);
    expect(dictionary[0]?.template, 'the grouped route must be the templated form').toBe(
      '/api/items/{id}',
    );
    expect(
      dictionary[0]?.statuses,
      'every observed status must survive grouping — a 404 seen once is exactly what a test author needs',
    ).toEqual([200, 404]);
  });

  test('should keep different methods on the same path apart', () => {
    const dictionary = buildDataDictionary([
      call({ method: 'GET', path: '/api/items' }),
      call({ method: 'POST', path: '/api/items', requestBody: '{"title":"new"}' }),
    ]);

    expect(
      dictionary,
      'GET and POST on one path are different contracts and must not be merged',
    ).toHaveLength(2);
  });

  test('should ignore document and asset traffic so the dictionary stays about the API', () => {
    const dictionary = buildDataDictionary([
      call({ resourceType: 'document', path: '/' }),
      call({ resourceType: 'script', path: '/app.js' }),
    ]);

    expect(
      dictionary,
      'only xhr/fetch traffic describes the data contract; page and script loads are noise here',
    ).toEqual([]);
  });

  test('should infer the request shape from a POST body', () => {
    const dictionary = buildDataDictionary([
      call({ method: 'POST', path: '/api/items', requestBody: '{"title":"new","done":false}' }),
    ]);

    expect(
      dictionary[0]?.request.map((field) => field.path).sort(),
      'the request shape is what tells an author which fields a create accepts',
    ).toEqual(['done', 'title']);
  });
});

test.describe('formatDictionary', () => {
  test('should say why nothing was captured rather than printing an empty section', () => {
    expect(
      formatDictionary([]),
      'an empty result must explain itself, or a reader concludes the app has no API',
    ).toContain('behind an interaction');
  });

  test('should render the method, route and status line for an endpoint', () => {
    const rendered = formatDictionary(
      buildDataDictionary([call({ path: '/api/items', responseBody: '{"id":1}' })]),
    );

    expect(rendered, 'the digest must name the route it describes').toContain('GET /api/items');
    expect(rendered, 'the digest must carry the observed status').toContain('[200]');
    expect(rendered, 'the digest must list the fields, which is the reason it exists').toContain(
      'id',
    );
  });
});
