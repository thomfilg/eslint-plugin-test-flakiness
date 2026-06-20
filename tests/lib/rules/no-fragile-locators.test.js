/**
 * @fileoverview Tests for no-fragile-locators rule
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const rule = require('../../../lib/rules/no-fragile-locators');
const { getRuleTester } = require('../../../lib/utils/test-helpers');

const ruleTester = getRuleTester();

// Wrap action code in an async function so `await` is valid across ESLint 7/8/9.
const spec = (body) => `async function t() { ${body} }`;

describe('no-fragile-locators', () => {
  test('rule module exposes the standard ESLint shape', () => {
    expect(rule).toBeDefined();
    expect(rule.meta).toBeDefined();
    expect(typeof rule.create).toBe('function');
  });
});

ruleTester.run('no-fragile-locators', rule, {
  valid: [
    // 1.1 filePattern scoping: identical fragile-in-action source in a non-spec file is not flagged.
    {
      code: spec('await page.getByText(\'Add field\').click()'),
      filename: 'button.test.ts'
    },

    // 1.2 stable locators driving an action are allowed.
    {
      code: spec('await page.getByTestId(\'add-field-btn\').click()'),
      filename: 'login.spec.ts'
    },
    {
      code: spec('await page.getByPlaceholder(\'Search\').fill(\'hi\')'),
      filename: 'login.spec.ts'
    },
    // 1.2 fragile factory followed by a non-action method is allowed.
    {
      code: spec('await page.getByText(\'x\').textContent()'),
      filename: 'login.spec.ts'
    },

    // 1.3 getByRole with a {name} option driving an action is allowed.
    {
      code: spec('await page.getByRole(\'button\', { name: \'Save\' }).click()'),
      filename: 'login.spec.ts'
    },
    // 1.3 getByRole without a name is allowed when flagRoleWithoutName is false.
    {
      code: spec('await page.getByRole(\'button\').click()'),
      filename: 'login.spec.ts',
      options: [{ flagRoleWithoutName: false }]
    },
    // 1.3 getByLabel driving an action is allowed by default.
    {
      code: spec('await page.getByLabel(\'Email\').fill(\'a@b.com\')'),
      filename: 'login.spec.ts'
    },

    // 1.4 assertion immunity: fragile locator only passed to expect(...) is allowed.
    {
      code: spec('await expect(page.getByText(\'Field added\')).toBeVisible()'),
      filename: 'login.spec.ts'
    },
    {
      code: spec('await expect(page.getByRole(\'heading\', { name: \'Settings\' })).toBeVisible()'),
      filename: 'login.spec.ts'
    },

    // 1.4 reassignment: a let initialised fragile then reassigned to a stable
    // locator before the action resolves to the latest (stable) write.
    {
      code: spec('let tgt = page.getByText(\'x\'); tgt = page.getByTestId(\'y\'); await tgt.click();'),
      filename: 'login.spec.ts'
    },

    // 1.5 refinement chain off a stable factory stays allowed.
    {
      code: spec('await page.getByTestId(\'row\').first().click()'),
      filename: 'login.spec.ts'
    },

    // 1.6 getByRole with an opaque (non-literal) options object is not flagged:
    // the rule cannot prove the absence of a { name } option.
    {
      code: spec('await page.getByRole(\'button\', opts).click()'),
      filename: 'login.spec.ts'
    },
    // 1.6 getByRole whose options spread an external object is not flagged.
    {
      code: spec('await page.getByRole(\'button\', { ...defaults }).click()'),
      filename: 'login.spec.ts'
    },

    // 1.5 a stable factory scoped within frameLocator() stays allowed: scoping
    // must not turn a stable locator into a false positive.
    {
      code: spec('await page.frameLocator(\'#f\').getByTestId(\'x\').click()'),
      filename: 'login.spec.ts'
    },

    // 1.5 stored stable locator refined before the action stays allowed.
    {
      code: spec('const tgt = page.getByTestId(\'x\'); await tgt.first().click();'),
      filename: 'login.spec.ts'
    }
  ],
  invalid: [
    // 1.1 / 1.2 getByText driving a click in a spec file is flagged.
    {
      code: spec('await page.getByText(\'Add field\').click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },
    // 1.2 getByText driving fill is flagged.
    {
      code: spec('await page.getByText(\'x\').fill(\'y\')'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'fill', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },
    // 1.2 getByText driving waitFor is flagged.
    {
      code: spec('await page.getByText(\'x\').waitFor()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'waitFor', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.3 getByRole without a {name} option driving an action is flagged (default).
    {
      code: spec('await page.getByRole(\'button\').click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByRole', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.4 stored-variable chain: fragile locator stored then driven via an action is flagged.
    {
      code: spec('const tgt = page.getByText(\'x\'); await tgt.click();'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.4 reassignment: a let initialised stable then reassigned to a fragile
    // locator before the action resolves to the latest (fragile) write.
    {
      code: spec('let tgt = page.getByTestId(\'y\'); tgt = page.getByText(\'x\'); await tgt.click();'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.5 fragile factory behind .first() refinement is still flagged.
    {
      code: spec('await page.getByText(\'x\').first().click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.5 fragile factory behind .locator() refinement is still flagged.
    {
      code: spec('await page.getByText(\'x\').locator(\'button\').click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.5 fragile factory inside a frameLocator() scope is still flagged: the
    // scoping call must not mask the underlying fragile getByText.
    {
      code: spec('await page.frameLocator(\'#f\').getByText(\'x\').click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.5 fragile factory inside a locator() scope is still flagged.
    {
      code: spec('await page.locator(\'.scope\').getByText(\'x\').click()'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.5 stored fragile locator refined before the action is still flagged: the
    // refinement on a stored variable must resolve back to getByText.
    {
      code: spec('const tgt = page.getByText(\'x\'); await tgt.first().click();'),
      filename: 'login.spec.ts',
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByTestId` or `getByPlaceholder`' }
        }
      ]
    },

    // 1.6 the suggested stable alternative reflects a custom `stable` option
    // rather than a hard-coded getByTestId.
    {
      code: spec('await page.getByText(\'x\').click()'),
      filename: 'login.spec.ts',
      options: [{ stable: ['getByLabel'] }],
      errors: [
        {
          messageId: 'fragileAction',
          data: { method: 'click', factory: 'getByText', suggestion: '`getByLabel`' }
        }
      ]
    }
  ]
});
