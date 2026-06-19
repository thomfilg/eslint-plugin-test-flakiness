/**
 * @fileoverview Recommended configuration for eslint-plugin-test-flakiness
 */
'use strict';

module.exports = {
  plugins: ['test-flakiness'],
  rules: {
    // Critical - Prevent race conditions
    'test-flakiness/await-async-events': 'error',
    'test-flakiness/no-test-focus': 'error',
    'test-flakiness/no-immediate-assertions': 'error',

    // High - Ensure test reliability
    'test-flakiness/no-unconditional-wait': 'error',
    'test-flakiness/no-global-state-mutation': 'error',
    'test-flakiness/no-test-isolation': 'error',
    'test-flakiness/no-random-data': 'error',
    'test-flakiness/no-unmocked-network': 'error',
    'test-flakiness/no-cached-api-wait': 'error'
  }
};