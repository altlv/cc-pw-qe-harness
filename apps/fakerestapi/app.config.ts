import type { AppConfig } from '../app-config.js';

const config: AppConfig = {
  name: 'fakerestapi',
  description:
    'FakeRESTApi.Web V1 — a public practice REST API. Used as the api-coder role\u2019s validation target: it has a real contract and several real contract defects to write tests against.',
  baseURL: 'https://fakerestapi.azurewebsites.net',
  external: true,
};

export default config;
