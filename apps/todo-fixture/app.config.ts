import type { AppConfig } from '../app-config.js';

const config: AppConfig = {
  name: 'todo-fixture',
  description:
    'Tiny todo app bundled with the harness. Exists so the suite and the network capture have something real to exercise with no external dependency.',
  baseURL: 'http://127.0.0.1:4173',
  scanScope: 'body',
  webServer: { command: 'node apps/todo-fixture/app/server.mjs', port: 4173 },
};

export default config;
