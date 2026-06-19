/**
 * @fileoverview Tests for no-global-state-mutation rule
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const rule = require('../../../lib/rules/no-global-state-mutation');
const { getRuleTester } = require('../../../lib/utils/test-helpers');

const ruleTester = getRuleTester();

ruleTester.run('no-global-state-mutation', rule, {
  valid: [
    // Non-test files should be ignored
    {
      code: 'window.globalVar = "value"',
      filename: 'src/app.js'
    },
    {
      code: 'global.config = {}',
      filename: 'src/config.js'
    },

    // Local variables are fine
    {
      code: 'const localVar = "value"',
      filename: 'Local.test.js'
    },
    {
      code: 'let testData = { key: "value" }',
      filename: 'TestData.test.js'
    },
    {
      code: 'function test() { const x = 1; }',
      filename: 'Function.test.js'
    },

    // Reading global state is okay
    {
      code: 'const value = window.location.href',
      filename: 'Read.test.js'
    },
    {
      code: 'if (global.DEBUG) { console.log("debug") }',
      filename: 'ReadGlobal.test.js'
    },
    {
      code: 'expect(window.innerWidth).toBeGreaterThan(0)',
      filename: 'Expect.test.js'
    },

    // Mocking is allowed
    {
      code: 'jest.spyOn(window, "alert").mockImplementation(() => {})',
      filename: 'Mock.test.js'
    },
    {
      code: 'vi.stubGlobal("fetch", mockFetch)',
      filename: 'Stub.test.js'
    },
    {
      code: 'sinon.stub(global, "setTimeout")',
      filename: 'Sinon.test.js'
    },

    // In beforeEach/afterEach for cleanup
    {
      code: 'beforeEach(() => { window.testState = {}; })',
      filename: 'Setup.test.js'
    },
    {
      code: 'afterEach(() => { delete window.testState; })',
      filename: 'Cleanup.test.js'
    },

    // localStorage/sessionStorage with proper cleanup
    {
      code: 'afterEach(() => { localStorage.clear(); })',
      filename: 'LocalStorageClear.test.js'
    },
    {
      code: 'beforeEach(() => { sessionStorage.clear(); })',
      filename: 'SessionStorageClear.test.js'
    },

    // Module-scoped variables in test files (debatable but often needed)
    {
      code: 'let testHelper; beforeEach(() => { testHelper = new TestHelper(); })',
      filename: 'TestHelper.test.js'
    },

    // allowInHooks: true (default) - global mutations allowed in hooks
    {
      code: 'beforeEach(() => { window.testData = "value"; })',
      filename: 'HooksAllowed.test.js',
      options: [{ allowInHooks: true }]
    },
    {
      code: 'afterEach(() => { delete global.testVar; })',
      filename: 'HooksGlobalDelete.test.js',
      options: [{ allowInHooks: true }]
    },
    {
      code: 'beforeEach(() => { localStorage.clear(); })',
      filename: 'HooksLocalStorage.test.js',
      options: [{ allowInHooks: true }]
    },

    // Browser-context callbacks are exempt — mutations run in the page, not Node.
    // G1 — localStorage method call inside page.evaluate not reported
    {
      code: 'test("t", async () => { await page.evaluate(() => localStorage.setItem("k", "v")); })',
      filename: 'EvaluateMethod.test.js'
    },
    // G2 — localStorage method call inside page.addInitScript not reported (reproduction snippet)
    {
      code: 'page.addInitScript(() => localStorage.removeItem("my-persist-key"))',
      filename: 'AddInitScriptRepro.test.js'
    },
    // G3 — localStorage method call inside page.evaluateHandle not reported
    {
      code: 'test("t", async () => { await page.evaluateHandle(() => localStorage.setItem("k", "v")); })',
      filename: 'EvaluateHandleMethod.test.js'
    },
    // G4 — localStorage property assignment inside page.evaluate not reported
    {
      code: 'page.evaluate(() => { localStorage.key = "value"; })',
      filename: 'EvaluateAssignment.test.js'
    },
    // G5 — window member assignment inside page.addInitScript not reported
    {
      code: 'page.addInitScript(() => { window.testData = "value"; })',
      filename: 'AddInitScriptAssignment.test.js'
    },
    // G6 — delete operation inside page.evaluate not reported
    {
      code: 'page.evaluate(() => { delete window.myProperty; })',
      filename: 'EvaluateDelete.test.js'
    },
    // G7 — async arrow + function-expression callbacks both exempted
    {
      code: 'page.evaluate(async () => { localStorage.setItem("k", "v"); })',
      filename: 'EvaluateAsyncArrow.test.js'
    },
    {
      code: 'page.addInitScript(function () { localStorage.removeItem("k"); })',
      filename: 'AddInitScriptFunctionExpr.test.js'
    },
    {
      code: 'page.evaluateHandle(async function () { delete window.foo; })',
      filename: 'EvaluateHandleAsyncFn.test.js'
    },
    // Bare global-variable creation inside a browser callback is a BROWSER global,
    // not a Node one — must be exempt too (covers the checkGlobalVariableDeclaration
    // path, which the AssignmentExpression visitor also runs).
    {
      code: 'page.evaluate(() => { someGlobal = 5; })',
      filename: 'EvaluateBareGlobalAssign.test.js'
    },
    // G9 — localStorage mutation inside beforeEach follows existing hook behavior
    // (storage method calls in beforeEach/afterEach are exempt — unchanged by this task)
    {
      code: 'beforeEach(() => { localStorage.setItem("k", "v"); })',
      filename: 'BeforeEachStorageBehavior.test.js'
    }
  ],

  invalid: [
    // Direct window property mutation
    {
      code: 'window.testData = "value"',
      filename: 'Window.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'window.config = { key: "value" }',
      filename: 'WindowConfig.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'window.location.href = "http://example.com"',
      filename: 'WindowLocation.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },

    // Direct global property mutation
    {
      code: 'global.testVar = 123',
      filename: 'Global.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },
    {
      code: 'global.config = {}',
      filename: 'GlobalConfig.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },
    {
      code: 'global.process.env.TEST = "value"',
      filename: 'GlobalProcess.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },

    // process.env mutations
    {
      code: 'process.env.NODE_ENV = "test"',
      filename: 'ProcessEnv.test.js',
      errors: [{
        messageId: 'avoidProcessEnv'
      }]
    },
    {
      code: 'process.env.API_KEY = "secret"',
      filename: 'ApiKey.test.js',
      errors: [{
        messageId: 'avoidProcessEnv'
      }]
    },
    {
      code: 'delete process.env.DEBUG',
      filename: 'DeleteEnv.test.js',
      errors: [{
        messageId: 'avoidProcessEnv'
      }]
    },

    // localStorage mutations without cleanup
    {
      code: 'localStorage.setItem("key", "value")',
      filename: 'LocalStorage.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    },
    {
      code: 'localStorage.removeItem("key")',
      filename: 'LocalStorageRemove.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    },
    {
      code: 'localStorage.key = "value"',
      filename: 'LocalStorageDirect.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    },

    // sessionStorage mutations without cleanup
    {
      code: 'sessionStorage.setItem("key", "value")',
      filename: 'SessionStorage.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'sessionStorage' }
      }]
    },
    {
      code: 'sessionStorage.removeItem("key")',
      filename: 'SessionStorageRemove.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'sessionStorage' }
      }]
    },

    // document mutations
    {
      code: 'document.title = "New Title"',
      filename: 'DocumentTitle.test.js',
      errors: [{
        messageId: 'avoidDocumentMutation'
      }]
    },
    {
      code: 'document.body.innerHTML = "<div>test</div>"',
      filename: 'DocumentBody.test.js',
      errors: [{
        messageId: 'avoidDocumentMutation'
      }]
    },
    {
      code: 'document.cookie = "test=value"',
      filename: 'DocumentCookie.test.js',
      errors: [{
        messageId: 'avoidDocumentMutation'
      }]
    },

    // Global function overrides
    {
      code: 'window.alert = () => {}',
      filename: 'OverrideAlert.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'console.log = jest.fn()',
      filename: 'ConsoleOverride.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'console' }
      }]
    },
    {
      code: 'Math.random = () => 0.5',
      filename: 'MathOverride.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'Math' }
      }]
    },
    {
      code: 'Date.now = () => 1234567890',
      filename: 'DateOverride.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'Date' }
      }]
    },

    // Multiple violations
    {
      code: `
        window.testVar = "test";
        global.config = {};
        localStorage.setItem("key", "value");
        process.env.TEST = "1";
      `,
      filename: 'Multiple.test.js',
      errors: [
        { messageId: 'avoidGlobalMutation', data: { object: 'window' } },
        { messageId: 'avoidGlobalMutation', data: { object: 'global' } },
        { messageId: 'needsCleanup', data: { storage: 'localStorage' } },
        { messageId: 'avoidProcessEnv' }
      ]
    },

    // Nested mutations
    {
      code: 'window.myApp.config = {}',
      filename: 'NestedWindow.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'global.myLib.state = "new"',
      filename: 'NestedGlobal.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },

    // Delete operations
    {
      code: 'delete window.myProperty',
      filename: 'DeleteWindow.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'delete global.myVar',
      filename: 'DeleteGlobal.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },

    // allowInHooks: false - global mutations not allowed even in hooks
    {
      code: 'beforeEach(() => { window.testData = "value"; })',
      filename: 'HooksNotAllowed.test.js',
      options: [{ allowInHooks: false }],
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'afterEach(() => { global.config = {}; })',
      filename: 'HooksGlobalNotAllowed.test.js',
      options: [{ allowInHooks: false }],
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },
    {
      code: 'beforeAll(() => { document.title = "Test"; })',
      filename: 'HooksDocumentNotAllowed.test.js',
      options: [{ allowInHooks: false }],
      errors: [{
        messageId: 'avoidDocumentMutation'
      }]
    },
    {
      code: 'afterAll(() => { delete window.customProp; })',
      filename: 'HooksDeleteNotAllowed.test.js',
      options: [{ allowInHooks: false }],
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },
    {
      code: 'beforeAll(() => { localStorage.setItem("key", "value"); })',
      filename: 'HooksStorageNotAllowed.test.js',
      options: [{ allowInHooks: false }],
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    },

    // beforeAll hook with global mutation (line 87 coverage)
    {
      code: 'beforeAll(() => { window.config = {}; })',
      filename: 'BeforeAllGlobal.test.js',
      options: [{ allowInHooks: true }],
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'window' }
      }]
    },

    // process.env assignment not to be double-reported (line 98 coverage)
    {
      code: 'global.process.env.NODE_ENV = "test"',
      filename: 'GlobalProcessEnvSpecific.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },

    // Nested global assignment (line 144 coverage)
    {
      code: 'global.app.process.env.NODE_ENV = "test"',
      filename: 'NestedGlobalProcessEnv.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'global' }
      }]
    },

    // Global variable creation without declaration (line 244 coverage)
    {
      code: 'globalTestVar = "some value"',
      filename: 'GlobalVarCreation.test.js',
      errors: [{
        messageId: 'useLocalVariable'
      }]
    },

    // test.only usage (line 262 coverage)
    {
      code: 'test.only("should do something", () => {})',
      filename: 'TestOnly.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'test execution order' }
      }]
    },

    // describe.only usage
    {
      code: 'describe.only("test suite", () => {})',
      filename: 'DescribeOnly.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'test execution order' }
      }]
    },

    // it.only usage
    {
      code: 'it.only("should do something", () => {})',
      filename: 'ItOnly.test.js',
      errors: [{
        messageId: 'avoidGlobalMutation',
        data: { object: 'test execution order' }
      }]
    },

    // Global variable assignment without let/const (covers line 216)
    {
      code: 'someGlobalVar = "test"',
      filename: 'GlobalAssignment.test.js',
      errors: [{
        messageId: 'useLocalVariable'
      }]
    },

    // G8 — direct Node-side localStorage mutation (not in a browser-context callback) still reported
    {
      code: 'test("t", () => { localStorage.removeItem("k"); })',
      filename: 'NodeSideStorage.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    },

    // Sibling (non-callback) argument to page.evaluate runs in Node before
    // serialization, so it must still be reported (not exempted by the guard).
    {
      code: 'test("t", () => { page.evaluate(() => {}, localStorage.clear()); })',
      filename: 'SiblingArg.test.js',
      errors: [{
        messageId: 'needsCleanup',
        data: { storage: 'localStorage' }
      }]
    }
  ]
});

// Test rule schema
describe('no-global-state-mutation schema', () => {
  it('should have correct schema properties', () => {
    expect(rule.meta.schema).toHaveLength(1);
    expect(rule.meta.schema[0].type).toBe('object');
    expect(rule.meta.schema[0].properties).toHaveProperty('allowInHooks');
    expect(rule.meta.schema[0].properties.allowInHooks.type).toBe('boolean');
    expect(rule.meta.schema[0].properties.allowInHooks.default).toBe(true);
    expect(rule.meta.schema[0].additionalProperties).toBe(false);
  });
});