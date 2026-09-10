import { test, expect } from '@playwright/test';
import {
  actionAllowed,
  formatChecklist,
  isEnvironment,
  policyFor,
  ENVIRONMENTS,
} from '../../src/qe/exploration-policy.js';

/**
 * The policy exists to be enforced rather than promised. These tests are the
 * enforcement: each one pins a rule that, if it silently regressed, would let a
 * session do something on production that nobody agreed to.
 */

const control = (
  overrides: Partial<{
    label: string | null;
    tag: string;
    type: string | null;
    isSubmit: boolean;
  }> = {},
) => ({ label: 'Open', tag: 'button', type: null, isSubmit: false, ...overrides });

test.describe('environment presets', () => {
  test('should forbid every state-changing action on prod', () => {
    const policy = policyFor('prod');

    expect(policy.allowWrites, 'a production session must be read-only').toBe(false);
    expect(policy.allowFormSubmit, 'submitting a real form is the highest-risk click').toBe(false);
    expect(policy.allowDestructive, 'destructive controls are never permitted on prod').toBe(false);
    expect(
      policy.allowAuthAttempts,
      'repeated credential attempts lock real users out of real accounts',
    ).toBe(false);
  });

  test('should not write payload bodies to disk on anything but local', () => {
    expect(
      policyFor('prod').captureBodies,
      'the network log holds real request and response bodies; on prod that is user data written to disk',
    ).toBe(false);
    expect(
      policyFor('test').captureBodies,
      'a shared environment carries other people data too, so bodies stay out of the log',
    ).toBe(false);
    expect(
      policyFor('local').captureBodies,
      'on a disposable local fixture the bodies are the whole value of the log',
    ).toBe(true);
  });

  test('should give every environment a finite bound so no session can run open-ended', () => {
    for (const environment of ENVIRONMENTS) {
      const policy = policyFor(environment);
      expect(
        policy.maxActions,
        `${environment} must cap actions, or a session can loop until someone notices`,
      ).toBeGreaterThan(0);
      expect(policy.timeoutMs, `${environment} must cap wall-clock time`).toBeGreaterThan(0);
    }
  });

  test('should tighten monotonically from local to prod', () => {
    expect(
      policyFor('prod').maxActions,
      'prod must not permit more interaction than a disposable local app',
    ).toBeLessThan(policyFor('local').maxActions);
  });
});

test.describe('actionAllowed', () => {
  test('should refuse a control whose label reads destructive, and say why', () => {
    const verdict = actionAllowed(policyFor('test'), control({ label: 'Delete account' }));

    expect(verdict.allowed, 'a Delete control must not be clicked on a shared environment').toBe(
      false,
    );
    expect(
      verdict.allowed === false ? verdict.reason : '',
      'a refusal must carry a reason, because every skipped control is reported as unexplored',
    ).toContain('delete');
  });

  test('should refuse outbound actions even on local, because the effect leaves the system', () => {
    const verdict = actionAllowed(policyFor('local'), control({ label: 'Send invite' }));

    expect(
      verdict.allowed,
      'local is disposable but a real email is not — outbound actions are denied everywhere',
    ).toBe(false);
  });

  test('should refuse form submission on prod but permit it locally', () => {
    const submit = control({ label: 'Save', tag: 'button', isSubmit: true });

    expect(actionAllowed(policyFor('prod'), submit).allowed, 'prod sessions never submit').toBe(
      false,
    );
    expect(
      actionAllowed(policyFor('local'), submit).allowed,
      'a local session that cannot submit a form cannot explore anything interesting',
    ).toBe(true);
  });

  test('should refuse a submit on the form-submit rule alone, with writes otherwise allowed', () => {
    // Deliberately isolates the rule. Testing this on prod proves nothing: there
    // allowWrites is already false and catches the submit anyway, so the
    // form-submit rule could be deleted and the suite would stay green. A
    // surviving mutation is what exposed that.
    const policy = policyFor('local', { allowFormSubmit: false });
    const verdict = actionAllowed(policy, control({ label: 'Save', isSubmit: true }));

    expect(
      verdict.allowed,
      'the form-submit rule must refuse on its own, not rely on the read-only rule behind it',
    ).toBe(false);
    expect(
      verdict.allowed === false ? verdict.reason : '',
      'the refusal must be attributed to form submission, not to a read-only session',
    ).toContain('form submission');
  });

  test('should refuse credential entry where a lockout is possible', () => {
    const verdict = actionAllowed(
      policyFor('test'),
      control({ label: 'Password', tag: 'input', type: 'password' }),
    );

    expect(verdict.allowed, 'credential attempts are barred on shared environments').toBe(false);
    expect(
      verdict.allowed === false ? verdict.reason : '',
      'the reason must name the lockout risk so the skip is understandable in the report',
    ).toContain('lock');
  });

  test('should permit an ordinary navigation control on prod', () => {
    expect(
      actionAllowed(policyFor('prod'), control({ label: 'View details', tag: 'a' })).allowed,
      'a read-only session must still be able to look around, or prod exploration is pointless',
    ).toBe(true);
  });

  test('should match a denied label case-insensitively and inside a longer label', () => {
    expect(
      actionAllowed(policyFor('prod'), control({ label: '  Remove This Item  ' })).allowed,
      'label matching must survive casing and padding, or the guard is trivially bypassed',
    ).toBe(false);
  });
});

test.describe('isEnvironment', () => {
  test('should reject an undeclared or unknown environment so a session cannot default into one', () => {
    expect(isEnvironment(undefined), 'there is deliberately no default environment').toBe(false);
    expect(isEnvironment('production'), 'only the three known names are accepted').toBe(false);
    expect(isEnvironment('prod'), 'a declared known environment is accepted').toBe(true);
  });
});

test.describe('formatChecklist', () => {
  test('should state the environment, the definite NOs and the honesty clause', () => {
    const rendered = formatChecklist(policyFor('prod'), 'https://app.example.com');

    expect(rendered, 'the checklist must name the environment it was rendered for').toContain(
      'PROD',
    );
    expect(rendered, 'the checklist must name the target').toContain('https://app.example.com');
    expect(rendered, 'the definite NOs must be listed, not implied').toContain('Definite NOs');
    expect(
      rendered,
      'the report must carry the warning that a constrained clean session proves little',
    ).toContain('not evidence of a clean system');
  });
});
