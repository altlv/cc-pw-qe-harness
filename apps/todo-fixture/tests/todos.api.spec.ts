import { faker } from '@faker-js/faker';
import { test, expect } from '../../../src/fixtures/api.js';

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

test.describe('Todos API', () => {
  test('should return the todo collection with the documented shape', async ({ api }) => {
    const response = await api.get('/api/todos');

    expect(response.status(), `GET /api/todos returned ${response.status()}`).toBe(200);

    const body = (await response.json()) as { todos: Todo[] };
    expect(Array.isArray(body.todos)).toBe(true);
    expect(body.todos.length).toBeGreaterThan(0);

    // Assert the contract, not the data. Asserting exact titles would couple the
    // test to seed data and break on any content change.
    const [first] = body.todos;
    expect(first).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      done: expect.any(Boolean),
    });
  });

  test('should create a todo and return it when the title is valid', async ({ api }) => {
    const title = faker.lorem.sentence(3);

    const response = await api.post('/api/todos', { data: { title } });

    expect(response.status()).toBe(201);
    const { todo } = (await response.json()) as { todo: Todo };
    expect(todo.title).toBe(title);
    expect(todo.done).toBe(false);

    // Verify persistence independently — a create endpoint echoing its own input
    // proves nothing about whether the write landed.
    const after = await api.get('/api/todos');
    const { todos } = (await after.json()) as { todos: Todo[] };
    expect(todos.some((item) => item.id === todo.id && item.title === title)).toBe(true);
  });

  test.describe('title validation', () => {
    // Equivalence partitioning: each case is a distinct class of invalid input,
    // not an arbitrary example. See docs/practices/test-design.md.
    const invalid = [
      { label: 'empty string', title: '' },
      { label: 'whitespace only', title: '   ' },
    ];

    for (const { label, title } of invalid) {
      test(`should reject a todo when the title is ${label}`, async ({ api }) => {
        const response = await api.post('/api/todos', { data: { title } });

        expect(response.status()).toBe(422);
        expect((await response.json()) as { error: string }).toMatchObject({
          error: expect.any(String),
        });

        // Asserting on collection *size* would couple this test to every other
        // test writing to the same in-memory store, and fail under parallelism.
        // Assert the specific absence instead — true regardless of neighbours.
        const after = await api.get('/api/todos');
        const { todos } = (await after.json()) as { todos: Todo[] };
        expect(todos.some((item) => item.title.trim() === '')).toBe(false);
      });
    }
  });

  test('should reject a request with no title field at all', async ({ api }) => {
    const response = await api.post('/api/todos', { data: {} });

    expect(response.status()).toBe(422);
  });
});
