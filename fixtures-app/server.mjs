// Minimal app under test. Exists so the example spec and the network capture
// have something real to exercise in CI without depending on an external env.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.FIXTURE_PORT ?? 4173);

const todos = [
  { id: 1, title: 'Write a test that proves behaviour', done: false },
  { id: 2, title: 'Capture the network tab', done: true },
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  // Without this the browser's own favicon request 404s and shows up as a failed
  // call, which is noise no test asked for.
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/todos' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ todos }));
    return;
  }

  if (url.pathname === '/api/todos' && req.method === 'POST') {
    const body = await new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => resolve(raw));
    });
    const title = String(JSON.parse(body || '{}').title ?? '').trim();
    if (!title) {
      res.writeHead(422, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'title is required' }));
      return;
    }
    const todo = { id: todos.length + 1, title, done: false };
    todos.push(todo);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ todo }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = await readFile(join(here, 'index.html'), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, () => console.log(`fixture app on http://127.0.0.1:${port}`));
