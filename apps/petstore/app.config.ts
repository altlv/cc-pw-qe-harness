import type { AppConfig } from '../app-config.js';

/**
 * Swagger Petstore — the canonical OpenAPI example service.
 *
 * Every other API subject lets us *build* a data dictionary from captured traffic.
 * This one lets us **check** one: it publishes an OpenAPI document, so what we infer
 * from real responses can be compared against what the service claims. Either the
 * inference is wrong or the API does not match its own spec, and both are findings.
 *
 * Used read-only. The service does accept writes, but nothing here needs to create a
 * pet to learn what a pet looks like.
 */
const config: AppConfig = {
  name: 'petstore',
  description:
    'Swagger Petstore, the canonical OpenAPI example. The one API subject with a declared contract, so the inferred data dictionary can be checked rather than trusted.',
  environments: {
    test: {
      baseURL: 'https://petstore.swagger.io',
      note: 'spec at /v2/swagger.json — read-only use; the service accepts writes but we do not need them',
    },
  },
  defaultEnvironment: 'test',
  external: true,
};

export default config;
