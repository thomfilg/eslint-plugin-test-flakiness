/**
 * @fileoverview Verifies `no-cached-api-wait` is registered in the recommended
 * and strict configs at 'error' severity (GH-49 Task 2).
 */
'use strict';

const recommended = require('../../../lib/configs/recommended');
const strict = require('../../../lib/configs/strict');

const RULE = 'test-flakiness/no-cached-api-wait';

describe('no-cached-api-wait config registration', () => {
  it('registers the rule in the recommended config at error severity', () => {
    expect(recommended.rules).toBeDefined();
    expect(recommended.rules[RULE]).toBe('error');
  });

  it('registers the rule in the strict config at error severity', () => {
    expect(strict.rules).toBeDefined();
    const entry = strict.rules[RULE];
    const severity = Array.isArray(entry) ? entry[0] : entry;
    expect(severity).toBe('error');
  });
});
