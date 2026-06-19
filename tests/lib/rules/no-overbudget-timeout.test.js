/**
 * @fileoverview Tests for no-overbudget-timeout rule
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const rule = require('../../../lib/rules/no-overbudget-timeout');
const { getRuleTester } = require('../../../lib/utils/test-helpers');

const ruleTester = getRuleTester();

const FILENAME = 'checkout.spec.js';

ruleTester.run('no-overbudget-timeout', rule, {
  valid: [
    // Should not trigger on non-test files
    {
      code: 'await expect(btn).toBeVisible({ timeout: 15000 })',
      filename: 'app.js'
    },
    // AC2: Numeric timeout under the assertion threshold is allowed
    {
      code: 'await expect(btn).toBeVisible({ timeout: 2000 })',
      filename: FILENAME,
      options: [{ maxTimeoutForAssertions: 5000 }]
    },
    // AC4: Symbolic GOOD tier within budget stays silent
    {
      code: 'await expect(btn).toBeVisible({ timeout: E2E_TIMEOUT_MS.long })',
      filename: FILENAME,
      options: [
        {
          maxTimeoutForAssertions: 5000,
          namedTiers: { 'E2E_TIMEOUT_MS.long': 2000 }
        }
      ]
    },
    // AC5: Navigation operation in allowHighTimeoutFor is exempt
    {
      code: 'await page.goto(\'/app\', { timeout: E2E_TIMEOUT_MS.unreliable, waitUntil: \'domcontentloaded\' })',
      filename: FILENAME,
      options: [
        {
          maxTimeoutForInteractions: 5000,
          allowHighTimeoutFor: ['page.goto'],
          namedTiers: { 'E2E_TIMEOUT_MS.unreliable': 15000 }
        }
      ]
    },
    // AC7: Unknown symbolic tier is skipped when ignoreUnknownTiers is true
    {
      code: 'await expect(btn).toBeVisible({ timeout: SOME_UNKNOWN_TIER })',
      filename: FILENAME,
      options: [{ ignoreUnknownTiers: true, namedTiers: {} }]
    }
  ],
  invalid: [
    // AC1: Numeric timeout over the assertion threshold is reported
    {
      code: 'await expect(btn).toBeVisible({ timeout: 15000 })',
      filename: FILENAME,
      options: [{ maxTimeoutForAssertions: 5000 }],
      errors: [{ messageId: 'overbudgetAssertion' }]
    },
    // AC3: Symbolic tier resolved via namedTiers, over budget
    {
      code: 'await expect(btn).toBeVisible({ timeout: E2E_TIMEOUT_MS.unreliable })',
      filename: FILENAME,
      options: [
        {
          maxTimeoutForAssertions: 5000,
          namedTiers: { 'E2E_TIMEOUT_MS.unreliable': 15000 }
        }
      ],
      errors: [{ messageId: 'overbudgetAssertion' }]
    },
    // AC6: Custom waitForApiResponse helper over budget reported as interaction
    {
      code: 'await waitForApiResponse(page, { urlPattern: \'save\', timeout: E2E_TIMEOUT_MS.unreliable })',
      filename: FILENAME,
      options: [
        {
          maxTimeoutForInteractions: 5000,
          namedTiers: { 'E2E_TIMEOUT_MS.unreliable': 15000 }
        }
      ],
      errors: [{ messageId: 'overbudgetInteraction' }]
    },
    // AC8: Unknown symbolic tier reported when ignoreUnknownTiers is false
    {
      code: 'await expect(btn).toBeVisible({ timeout: SOME_UNKNOWN_TIER })',
      filename: FILENAME,
      options: [{ ignoreUnknownTiers: false, namedTiers: {} }],
      errors: [{ messageId: 'unresolvableTier' }]
    }
  ]
});

describe('no-overbudget-timeout meta', () => {
  it('declares a problem-type rule with a docs url', () => {
    expect(rule.meta.type).toBe('problem');
    expect(rule.meta.docs.url).toMatch(/no-overbudget-timeout/);
  });

  it('locks the schema with additionalProperties: false and all five options', () => {
    const schema = rule.meta.schema[0];
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        'maxTimeoutForAssertions',
        'maxTimeoutForInteractions',
        'allowHighTimeoutFor',
        'namedTiers',
        'ignoreUnknownTiers'
      ])
    );
  });

  it('exposes the three exact message ids and texts', () => {
    expect(rule.meta.messages.overbudgetAssertion).toBe(
      'Timeout {{value}}ms exceeds the {{max}}ms budget for assertions. Tighten the tier or fix the underlying wait/race.'
    );
    expect(rule.meta.messages.overbudgetInteraction).toBe(
      'Timeout {{value}}ms exceeds the {{max}}ms budget for interactions. Tighten the tier or fix the underlying wait/race.'
    );
    expect(rule.meta.messages.unresolvableTier).toBe(
      'Unresolvable timeout tier \'{{tier}}\'. Add it to `namedTiers` or set `ignoreUnknownTiers: true`.'
    );
  });
});
