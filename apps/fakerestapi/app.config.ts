import type { AppConfig } from '../app-config.js';

const config: AppConfig = {
  name: 'fakerestapi',
  description:
    'FakeRESTApi.Web V1 — a public practice REST API. Used as the api-coder role’s validation target: it has a real contract and several real contract defects to write tests against.',
  environments: {
    // A public practice API, offered for exactly this. `test` is the honest
    // label: writes are expected here, and its data is nobody's real data.
    test: { baseURL: 'https://fakerestapi.azurewebsites.net' },
  },
  defaultEnvironment: 'test',
  external: true,
};

export default config;
