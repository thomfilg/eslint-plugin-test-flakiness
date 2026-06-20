/**
 * @fileoverview Tests for no-cached-api-wait rule
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const rule = require('../../../lib/rules/no-cached-api-wait');
const { getRuleTester } = require('../../../lib/utils/test-helpers');

const ruleTester = getRuleTester();

// RuleTester.run() registers its own it() blocks, so it must run at module
// scope (not nested inside another it()). The cases below stand in for the
// per-scenario it()/test() blocks for this rule's suite.
ruleTester.run('no-cached-api-wait', rule, {
  valid: [
    // 1.1 — Non-test files are ignored even with a flaggable GET helper
    {
      code: 'waitForApiResponse({ method: \'GET\' })',
      filename: 'src/app.js'
    },

    // 1.3 — Mutation method literals are not flagged (POST/PUT/DELETE/PATCH)
    {
      code: 'await waitForApiResponse({ method: \'POST\', url: \'/api/users\' })',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse({ method: \'PUT\', url: \'/api/users/1\' })',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse({ method: \'DELETE\', url: \'/api/users/1\' })',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse({ method: \'PATCH\', url: \'/api/users/1\' })',
      filename: 'users.test.js'
    },

    // 1.3 — Non-literal method (variable) is not statically determinable -> skip
    {
      code: 'await waitForApiResponse({ method: someMethod, url: \'/api\' })',
      filename: 'flow.test.js'
    },
    // 1.3 — Non-literal method (template literal) -> skip
    {
      code: 'await waitForApiResponse({ method: `${verb}`, url: "/api" })',
      filename: 'flow.test.js'
    },

    // 1.3 — Positional HTTP-method literal arg is treated as explicit method;
    // mutation literals (POST/PUT/DELETE/PATCH) are not flagged.
    {
      code: 'await waitForApiResponse(\'/api/users\', \'POST\')',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse(\'/api/users\', \'PUT\')',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse(\'/api/users\', \'DELETE\')',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse(\'/api/users\', \'PATCH\')',
      filename: 'users.test.js'
    },

    // 1.3 — Computed string-literal `method` key is honored like a normal key;
    // a mutation literal is not flagged.
    {
      code: 'await waitForApiResponse({ [\'method\']: \'POST\', url: \'/api\' })',
      filename: 'users.test.js'
    },

    // 1.3 — Custom helper whose options are not an inline object literal cannot
    // be statically inspected; stay conservative and do NOT flag.
    {
      code: 'await waitForApiResponse(opts)',
      filename: 'users.test.js'
    },
    {
      code: 'await waitForApiResponse(\'/api/users\')',
      filename: 'users.test.js'
    },

    // 1.4 — Recommended UI-assertion good pattern (no API wait at all)
    {
      code: 'await page.getByTestId(\'submit\').click(); await page.getByTestId(\'result\').isVisible()',
      filename: 'flow.test.js'
    },

    // 1.4 — With a custom helperNames option, the default helper is NOT flagged
    {
      code: 'await waitForApiResponse({ method: \'GET\' })',
      filename: 'flow.test.js',
      options: [{ helperNames: ['waitForXhr'] }]
    }
  ],

  invalid: [
    // 1.2 — Bare page.waitForResponse with a URL matcher predicate (implicit GET)
    {
      code: 'await page.waitForResponse(resp => resp.url().includes(\'/api\'))',
      filename: 'page.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },
    // 1.2 — Bare waitForResponse identifier call
    {
      code: 'await waitForResponse(resp => resp.url().includes(\'/api\'))',
      filename: 'page.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },

    // 1.3 — Custom helper with explicit GET method (case-insensitive)
    {
      code: 'await waitForApiResponse({ method: \'GET\', url: \'/api/users\' })',
      filename: 'users.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },
    {
      code: 'await waitForApiResponse({ method: \'get\', url: \'/api/users\' })',
      filename: 'users.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },

    // 1.3 — Custom helper with NO method property (implicit GET default)
    {
      code: 'await waitForApiResponse({ url: \'/api/users\' })',
      filename: 'users.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },

    // 1.3 — Positional GET literal arg is treated as explicit flaggable method
    {
      code: 'await waitForApiResponse(\'/api/users\', \'GET\')',
      filename: 'users.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },
    // 1.3 — Computed string-literal `method` key with a GET literal still flags
    {
      code: 'await waitForApiResponse({ [\'method\']: \'GET\', url: \'/api\' })',
      filename: 'users.test.js',
      errors: [{ messageId: 'cachedApiWait' }]
    },

    // 1.4 — Custom helperNames option flags the configured helper name
    {
      code: 'await waitForXhr({ method: \'GET\', url: \'/api\' })',
      filename: 'flow.test.js',
      options: [{ helperNames: ['waitForXhr'] }],
      errors: [{ messageId: 'cachedApiWait' }]
    },

    // 1.4 — Custom flagMethods option flags HEAD (in addition to GET)
    {
      code: 'await waitForApiResponse({ method: \'HEAD\', url: \'/api\' })',
      filename: 'flow.test.js',
      options: [{ flagMethods: ['GET', 'HEAD'] }],
      errors: [{ messageId: 'cachedApiWait' }]
    }
  ]
});
