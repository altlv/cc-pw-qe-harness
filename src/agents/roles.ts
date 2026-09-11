import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { apiCoder } from './roles/api-coder.js';
import { e2eCoder } from './roles/e2e-coder.js';
import { exploratoryTester } from './roles/exploratory-tester.js';
import { integrationTester } from './roles/integration-tester.js';
import { investigator } from './roles/investigator.js';
import { testabilityReviewer } from './roles/testability-reviewer.js';
import { unitTestEngineer } from './roles/unit-test-engineer.js';

/**
 * Every agent role, one file each under `roles/`.
 *
 * Split out of a single 350-line file that grew by fifty lines per role and made
 * every prompt harder to find than the last. The shared blocks live in
 * `common.ts`; each role file carries its own contract — mission, loads, method,
 * boundaries, output — and nothing else.
 *
 * This index is the only place that knows the full set, which is what the role
 * validation tests read.
 */
export const roles: Record<string, AgentDefinition> = {
  'unit-test-engineer': unitTestEngineer,
  'integration-tester': integrationTester,
  'api-coder': apiCoder,
  'e2e-coder': e2eCoder,
  'exploratory-tester': exploratoryTester,
  'testability-reviewer': testabilityReviewer,
  investigator,
};

export {
  apiCoder,
  e2eCoder,
  exploratoryTester,
  integrationTester,
  investigator,
  testabilityReviewer,
  unitTestEngineer,
};
