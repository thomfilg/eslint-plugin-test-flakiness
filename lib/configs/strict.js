/**
 * @fileoverview Strict configuration for eslint-plugin-test-flakiness
 */
'use strict';

module.exports = {
  plugins: ['test-flakiness'],
  rules: {
    // Critical - Prevent race conditions (strict settings)
    'test-flakiness/await-async-events': ['error', { enforceForAllAsyncUtils: true }],
    'test-flakiness/no-test-focus': ['error', { allowSkip: false, allowOnly: false }],
    'test-flakiness/no-immediate-assertions': ['error', { maxWaitTime: 0 }],

    // High - Ensure test reliability (strict settings)
    'test-flakiness/no-unconditional-wait': ['error', { maxWaitTime: 1000 }],
    'test-flakiness/no-global-state-mutation': ['error', { checkNestedObjects: true }],
    'test-flakiness/no-test-isolation': ['error', { enforceCleanup: true }],
    'test-flakiness/no-random-data': ['error', { allowSeededRandom: false }],
    'test-flakiness/no-unmocked-network': ['error', { allowLocalhost: false }],
    'test-flakiness/no-cached-api-wait': 'error',

    // Medium - Additional safety rules
    'test-flakiness/no-promise-race': 'error',
    'test-flakiness/no-element-removal-check': 'error',
    'test-flakiness/no-animation-wait': 'error',
    'test-flakiness/no-viewport-dependent': 'error',
    'test-flakiness/no-long-text-match': ['error', { maxLength: 50 }],
    'test-flakiness/no-index-queries': 'error',
    'test-flakiness/no-focus-check': 'error',
    'test-flakiness/no-hard-coded-timeout': ['error', { maxTimeout: 500, allowInSetup: false }],

    // Low - Opinionated rules for maximum safety
    'test-flakiness/no-database-operations': 'error',
    'test-flakiness/no-unmocked-fs': 'error'
  }
};