import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'artifacts/',
      'fixtures-app/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  {
    // Anti-patterns carried over from the pwtest conventions: these make suites
    // slow and flaky, and agents copy whatever they find in the repo.
    files: ['tests/**/*.ts', 'src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: 'waitForTimeout() is banned. Use web-first assertions or locator.waitFor().',
        },
        {
          selector: "CallExpression[callee.property.name='waitForSelector']",
          message: 'waitForSelector() is banned. Use locator auto-waiting or locator.waitFor().',
        },
        {
          selector: "MemberExpression[object.name='test'][property.name='only']",
          message: 'test.only() must not be committed.',
        },
      ],
    },
  },
);
