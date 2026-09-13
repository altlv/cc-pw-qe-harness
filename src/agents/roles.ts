import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { apiCoder } from './roles/api-coder.js';
import { e2eCoder } from './roles/e2e-coder.js';
import { exploratoryTester } from './roles/exploratory-tester.js';
import { failureInvestigator } from './roles/failure-investigator.js';
import { integrationCoder } from './roles/integration-coder.js';
import { testPlanner } from './roles/test-planner.js';
import { testabilityReviewer } from './roles/testability-reviewer.js';
import { unitCoder } from './roles/unit-coder.js';

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
  'unit-coder': unitCoder,
  'integration-coder': integrationCoder,
  'api-coder': apiCoder,
  'e2e-coder': e2eCoder,
  'testability-reviewer': testabilityReviewer,
  'test-planner': testPlanner,
  'exploratory-tester': exploratoryTester,
  'failure-investigator': failureInvestigator,
};

export type RoleFamily = 'coding' | 'testing';

/**
 * Which half of the work a role does.
 *
 * **coding** produces automation, or the conditions for it: specs, page objects, and
 * the testability findings that decide whether a spec can be written at all.
 * **testing** produces judgement — what deserves coverage, what the product actually
 * does, why something failed — and writes no product or test code.
 *
 * This is data rather than a naming convention because rules hang off it and are
 * enforced in `tests/unit/roles.test.ts`: no testing role holds `Edit`, and
 * `risk-assessment` and `oracle-check` reach the testing family only. A convention
 * alone permits a name that lies, and two of these did — `unit-test-engineer` and
 * `integration-tester` were both coders.
 */
export const families: Record<string, RoleFamily> = {
  'unit-coder': 'coding',
  'integration-coder': 'coding',
  'api-coder': 'coding',
  'e2e-coder': 'coding',
  'testability-reviewer': 'coding',
  'test-planner': 'testing',
  'exploratory-tester': 'testing',
  'failure-investigator': 'testing',
};

/** Role names in one family, in the order the index declares them. */
export function rolesIn(family: RoleFamily): string[] {
  return Object.keys(roles).filter((name) => families[name] === family);
}

export {
  apiCoder,
  e2eCoder,
  exploratoryTester,
  failureInvestigator,
  integrationCoder,
  testPlanner,
  testabilityReviewer,
  unitCoder,
};
