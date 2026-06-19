/**
 * @fileoverview End-to-end check that the recommended config's
 * `no-global-state-mutation` rule does not flag localStorage cleanup inside
 * Playwright browser-context callbacks (page.addInitScript / page.evaluate /
 * page.evaluateHandle), while still flagging Node-side mutations.
 *
 * Unlike the RuleTester unit suite, this lints whole Playwright-style source
 * files through ESLint's Linter using the rule at its recommended severity,
 * exercising the exemption end-to-end (gherkin G10).
 */
'use strict';

const { Linter } = require('eslint');
const rule = require('../../lib/rules/no-global-state-mutation');
const recommended = require('../../lib/configs/recommended');

const RULE_ID = 'test-flakiness/no-global-state-mutation';

function lint(code) {
  const linter = new Linter();

  // The recommended config ships this rule at 'error'; mirror that severity
  // here so the e2e exercises the rule exactly as a consumer would get it.
  const severity = recommended.rules['test-flakiness/no-global-state-mutation'];
  expect(severity).toBe('error');

  // A test-file name is required for the rule to activate (isTestFile gate);
  // a Playwright spec is exactly the consumer scenario this e2e models.
  return linter
    .verify(
      code,
      [
        {
          plugins: { 'test-flakiness': { rules: { 'no-global-state-mutation': rule } } },
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          rules: { [RULE_ID]: 'error' },
        },
      ],
      'tests/e2e/example.spec.js'
    )
    .filter((m) => m.ruleId === RULE_ID);
}

describe('e2e: no-global-state-mutation with Playwright browser-context callbacks', () => {
  it('does not flag localStorage cleanup inside page.addInitScript (ticket reproduction)', () => {
    const setupFile = `
      import { test } from '@playwright/test';

      test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
          localStorage.removeItem('my-persist-key');
          localStorage.clear();
        });
      });

      test('renders fresh state', async ({ page }) => {
        await page.evaluate(() => {
          localStorage.setItem('token', 'fake');
          delete window.__APP_STATE__;
        });
      });
    `;

    expect(lint(setupFile)).toHaveLength(0);
  });

  it('does not flag mutations inside page.evaluateHandle callbacks', () => {
    const code = `
      test('handle', async ({ page }) => {
        const handle = await page.evaluateHandle(() => {
          window.__seeded__ = true;
          return document.body;
        });
      });
    `;

    expect(lint(code)).toHaveLength(0);
  });

  it('still flags a Node-side localStorage mutation in a plain test (no regression)', () => {
    const code = `
      test('leaks node-side state', () => {
        localStorage.removeItem('my-persist-key');
      });
    `;

    expect(lint(code).length).toBeGreaterThan(0);
  });
});
