/**
 * @fileoverview Tests for no-test-focus rule
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const rule = require('../../../lib/rules/no-test-focus');
const { getRuleTester } = require('../../../lib/utils/test-helpers');

const ruleTester = getRuleTester();

ruleTester.run('no-test-focus', rule, {
  valid: [
    // Normal test cases without focus/skip
    {
      code: 'test(\'should work\', () => {});',
      filename: 'test.spec.js'
    },
    {
      code: 'it(\'should work\', () => {});',
      filename: 'test.spec.js'
    },
    {
      code: 'describe(\'suite\', () => {});',
      filename: 'test.spec.js'
    },
    // Non-test file should not trigger
    {
      code: 'test.only(\'should work\', () => {});',
      filename: 'index.js'
    },
    // Allow skip when configured
    {
      code: 'test.skip(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowSkip: true }]
    },
    {
      code: 'describe.skip(\'suite\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowSkip: true }]
    },
    {
      code: 'xit(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowSkip: true }]
    },
    // Allow only when configured
    {
      code: 'test.only(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowOnly: true }]
    },
    {
      code: 'describe.only(\'suite\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowOnly: true }]
    },
    {
      code: 'fit(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ allowOnly: true }]
    },
    // Normal function calls that happen to have similar names
    {
      code: 'myTest.only(\'should work\', () => {});',
      filename: 'test.spec.js'
    },
    {
      code: 'const fit = () => {}; fit();',
      filename: 'test.spec.js'
    },
    // Custom patterns that should NOT trigger
    {
      code: 'regularTest("should work", () => {});',
      options: [{ customFocusPatterns: ['testFocus'] }],
      filename: 'test.spec.js'
    },
    {
      code: 'normalTest("should work", () => {});',
      options: [{ customSkipPatterns: ['skipThisTest'] }],
      filename: 'test.spec.js'
    },
    // Conditional skip driven by a runtime expression is allowed only when the
    // consumer opts in via allowConditionalSkip
    {
      code: 'test.skip(isDeployedEnv, \'reason\');',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }]
    },
    {
      code: 'test.skip(process.env.CI === \'true\');',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }]
    },
    {
      code: 'test.skip(!supportsFeature);',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }]
    },
    {
      code: 'test.skip(getFlag());',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }]
    }
  ],

  invalid: [
    // test.only
    {
      code: 'test.only(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'test' } }],
      output: 'test(\'should work\', () => {});'
    },
    // it.only
    {
      code: 'it.only(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'it' } }],
      output: 'it(\'should work\', () => {});'
    },
    // describe.only
    {
      code: 'describe.only(\'suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'describe' } }],
      output: 'describe(\'suite\', () => {});'
    },
    // test.skip
    {
      code: 'test.skip(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }],
      output: 'test(\'should work\', () => {});'
    },
    // it.skip
    {
      code: 'it.skip(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'it' } }],
      output: 'it(\'should work\', () => {});'
    },
    // describe.skip
    {
      code: 'describe.skip(\'suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'describe' } }],
      output: 'describe(\'suite\', () => {});'
    },
    // test.todo
    {
      code: 'test.todo(\'should implement later\');',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }],
      output: 'test(\'should implement later\');'
    },
    // fit (focused it)
    {
      code: 'fit(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'fit' } }],
      output: 'it(\'should work\', () => {});'
    },
    // fdescribe (focused describe)
    {
      code: 'fdescribe(\'suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'fdescribe' } }],
      output: 'describe(\'suite\', () => {});'
    },
    // ftest (focused test)
    {
      code: 'ftest(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'ftest' } }],
      output: 'test(\'should work\', () => {});'
    },
    // xit (skipped it)
    {
      code: 'xit(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'xit' } }],
      output: 'it(\'should work\', () => {});'
    },
    // xdescribe (skipped describe)
    {
      code: 'xdescribe(\'suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'xdescribe' } }],
      output: 'describe(\'suite\', () => {});'
    },
    // xtest (skipped test)
    {
      code: 'xtest(\'should work\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'xtest' } }],
      output: 'test(\'should work\', () => {});'
    },
    // Multiple violations
    {
      code: `
        describe.only('suite', () => {
          test.skip('test 1', () => {});
          fit('test 2', () => {});
          xit('test 3', () => {});
        });
      `,
      filename: 'test.spec.js',
      errors: [
        { messageId: 'noTestOnly', data: { method: 'describe' } },
        { messageId: 'noTestSkip', data: { method: 'test' } },
        { messageId: 'noFocusedTest', data: { method: 'fit' } },
        { messageId: 'noSkippedTest', data: { method: 'xit' } }
      ],
      output: `
        describe('suite', () => {
          test('test 1', () => {});
          it('test 2', () => {});
          it('test 3', () => {});
        });
      `
    },
    // Custom focus patterns
    {
      code: 'myFocusTest(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ customFocusPatterns: ['myFocusTest'] }],
      errors: [{ messageId: 'noFocusedTest', data: { method: 'myFocusTest' } }]
    },
    // Custom skip patterns
    {
      code: 'mySkipTest(\'should work\', () => {});',
      filename: 'test.spec.js',
      options: [{ customSkipPatterns: ['mySkipTest'] }],
      errors: [{ messageId: 'noSkippedTest', data: { method: 'mySkipTest' } }]
    },
    // context.only (Mocha)
    {
      code: 'context.only(\'when something\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'context' } }],
      output: 'context(\'when something\', () => {});'
    },
    // suite.skip (Mocha)
    {
      code: 'suite.skip(\'suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'suite' } }],
      output: 'suite(\'suite\', () => {});'
    },
    // Bracket notation tests
    {
      code: 'test["only"](\'focused test\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'test' } }],
      output: 'test(\'focused test\', () => {});'
    },
    {
      code: 'describe[\'skip\'](\'skipped suite\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'describe' } }],
      output: 'describe(\'skipped suite\', () => {});'
    },
    {
      code: 'it[`only`]("focused test with template", () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'it' } }],
      output: 'it("focused test with template", () => {});'
    },
    {
      code: 'test[\'todo\'](\'todo test\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }],
      output: 'test(\'todo test\', () => {});'
    },
    // Template literal tests
    {
      code: 'fit`test description`',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'fit' } }],
      output: 'it`test description`'
    },
    {
      code: 'xdescribe`suite description`',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'xdescribe' } }],
      output: 'describe`suite description`'
    },
    {
      code: 'test.only`tagged template test`',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestOnly', data: { method: 'test' } }],
      output: 'test`tagged template test`'
    },
    // Custom patterns with auto-fix
    {
      code: 'testOnly("should work", () => {});',
      options: [{ customFocusPatterns: ['testOnly'] }],
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'testOnly' } }],
      output: 'test("should work", () => {});'
    },
    {
      code: 'describeSkip("should be skipped", () => {});',
      options: [{ customSkipPatterns: ['describeSkip'] }],
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'describeSkip' } }],
      output: 'describe("should be skipped", () => {});'
    },
    // Wildcard pattern tests
    {
      code: 'focusTest("should work", () => {});',
      options: [{ customFocusPatterns: ['focus*'] }],
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'focusTest' } }]
    },
    {
      code: 'testWithOnly("should work", () => {});',
      options: [{ customFocusPatterns: ['*Only'] }],
      filename: 'test.spec.js',
      errors: [{ messageId: 'noFocusedTest', data: { method: 'testWithOnly' } }],
      output: 'testWith("should work", () => {});'
    },
    {
      code: 'anythingSkip("should be skipped", () => {});',
      options: [{ customSkipPatterns: ['*Skip'] }],
      filename: 'test.spec.js',
      errors: [{ messageId: 'noSkippedTest', data: { method: 'anythingSkip' } }],
      output: 'anything("should be skipped", () => {});'
    },
    // Unconditional skip — literal / no-arg first argument is not a runtime condition
    {
      code: 'test.skip(true);',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    {
      code: 'test.skip(false);',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    {
      code: 'test.skip();',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    {
      code: 'test.skip(\'just a string\');',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    // Declaration form — disabled test/suite is stripped to re-enable it
    {
      code: 'it.skip(\'name\', () => {});',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'it' } }],
      output: 'it(\'name\', () => {});'
    },
    // Constant-folded conditions are still unconditional skips
    {
      code: 'const a = true;\nit.skip(a);',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    {
      code: 'const getCond = () => true;\nit.skip(getCond());',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noUnconditionalSkip' }]
    },
    // Compile-time-constant expressions are unconditional even with the opt-in
    {
      code: 'test.skip(true && false);',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }],
      errors: [{ messageId: 'noUnconditionalSkip', data: { method: 'test' } }]
    },
    {
      code: 'test.skip(1 === 1);',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }],
      errors: [{ messageId: 'noUnconditionalSkip', data: { method: 'test' } }]
    },
    {
      code: 'test.skip(true ? false : true);',
      filename: 'test.spec.js',
      options: [{ allowConditionalSkip: true }],
      errors: [{ messageId: 'noUnconditionalSkip', data: { method: 'test' } }]
    },
    // Conditional skip is blocked by default (no allowConditionalSkip opt-in);
    // not auto-fixed because stripping .skip would change call semantics
    {
      code: 'test.skip(isDeployedEnv, \'reason\');',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }]
    },
    {
      code: 'test.skip(process.env.CI === \'true\');',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }]
    },
    {
      code: 'test.skip(!supportsFeature);',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }]
    },
    {
      code: 'test.skip(getFlag());',
      filename: 'test.spec.js',
      errors: [{ messageId: 'noTestSkip', data: { method: 'test' } }]
    }
  ]
});