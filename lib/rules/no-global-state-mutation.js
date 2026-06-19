/**
 * @fileoverview Rule to prevent global state mutations in tests
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const { isTestFile, isInHook, isInsideBrowserContext } = require('../utils/helpers');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent global state mutations that can cause test interdependencies',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/tigredonorte/eslint-plugin-test-flakiness/blob/main/docs/rules/no-global-state-mutation.md'
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          allowInHooks: {
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      avoidGlobalMutation: 'Avoid mutating {{object}} in tests. Use beforeEach/afterEach for proper cleanup.',
      useLocalVariable: 'Use local variables instead of modifying global state.',
      needsCleanup: '{{storage}} changes need cleanup in afterEach hook.',
      avoidProcessEnv: 'Modifying process.env can affect other tests. Store original value and restore it.',
      avoidDocumentMutation: 'Document mutations can affect other tests. Use test-specific containers.'
    }
  },

  create(context) {
    if (!isTestFile(context.getFilename())) {
      return {};
    }

    const options = context.options[0] || {};
    const allowInHooks = options.allowInHooks !== false;
    const sourceCode = context.getSourceCode();

    function checkGlobalAssignment(node) {
      // Mutations inside browser-context callbacks (page.evaluate/addInitScript/
      // evaluateHandle) run in the page, not Node — never flaky in the test process.
      if (isInsideBrowserContext(node)) return;
      if (node.type === 'AssignmentExpression') {
        const left = node.left;

        // Check for global object mutations
        if (left.type === 'MemberExpression') {
          // Check for direct process.env.VARIABLE assignments first (process.env.NODE_ENV = "test")
          if (isProcessEnvAssignment(left)) {
            if (!isInHook(node, ['beforeEach', 'afterEach'])) {
              context.report({
                node,
                messageId: 'avoidProcessEnv'
              });
            }
            return; // Don't double-report as avoidGlobalMutation
          }

          const object = left.object;

          // List of global objects to check
          const globalObjects = [
            'global',
            'window',
            'document',
            'process',
            'console',
            'localStorage',
            'sessionStorage',
            'navigator',
            'Math',
            'Date'
          ];

          if (object.type === 'Identifier' && globalObjects.includes(object.name)) {
            // Allow in setup/teardown hooks if configured
            if (allowInHooks && isInHook(node, ['beforeEach', 'afterEach', 'beforeAll', 'afterAll'])) {
              // Still warn for beforeAll without afterAll cleanup
              if (isInHook(node, ['beforeAll'])) {
                context.report({
                  node,
                  messageId: 'avoidGlobalMutation',
                  data: { object: object.name }
                });
              }
              return;
            }

            // Don't flag process.env assignments here - they're handled separately below
            if (object.name === 'process' && isProcessEnvAssignment(left)) {
              return; // Skip general process mutation reporting
            }

            // Special handling for document mutations
            if (object.name === 'document') {
              context.report({
                node,
                messageId: 'avoidDocumentMutation'
              });
              return;
            }

            // Special handling for localStorage/sessionStorage property assignment
            if ((object.name === 'localStorage' || object.name === 'sessionStorage') &&
                !isInHook(node, ['beforeEach', 'afterEach'])) {
              context.report({
                node,
                messageId: 'needsCleanup',
                data: { storage: object.name }
              });
              return;
            }

            // Special handling for Math and Date
            if (object.name === 'Math' || object.name === 'Date') {
              context.report({
                node,
                messageId: 'avoidGlobalMutation',
                data: { object: object.name }
              });
              return;
            }

            context.report({
              node,
              messageId: 'avoidGlobalMutation',
              data: { object: object.name }
            });
          }

          // Check for nested assignments like window.myApp.config = {} or document.body.innerHTML
          if (object.type === 'MemberExpression') {
            const rootObject = getRootObject(object);
            if (rootObject && globalObjects.includes(rootObject.name)) {
              // Skip process.env assignments - they're handled specifically below
              if (rootObject.name === 'process' && isProcessEnvAssignment(left)) {
                return;
              }

              // Special handling for document properties
              if (rootObject.name === 'document') {
                context.report({
                  node,
                  messageId: 'avoidDocumentMutation'
                });
                return;
              }

              context.report({
                node,
                messageId: 'avoidGlobalMutation',
                data: { object: rootObject.name }
              });
            }
          }

        }
      }
    }

    function getRootObject(memberExpr) {
      let current = memberExpr;
      while (current.object && current.object.type === 'MemberExpression') {
        current = current.object;
      }
      return current.object;
    }

    function isProcessEnvAssignment(left) {
      // Check if assignment is to process.env.* (left is process.env.VARNAME)
      return left.type === 'MemberExpression' &&
             left.object.type === 'MemberExpression' &&
             left.object.object.type === 'Identifier' &&
             left.object.object.name === 'process' &&
             left.object.property.name === 'env';
    }

    function checkGlobalMethodCalls(node) {
      // Browser-context callbacks run in the page — exempt from mutation reporting.
      if (isInsideBrowserContext(node)) return;
      if (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression') {

        const obj = node.callee.object;
        const method = node.callee.property.name;

        // Check for methods that modify global state
        const dangerousMethods = {
          'localStorage': ['setItem', 'removeItem', 'clear'],
          'sessionStorage': ['setItem', 'removeItem', 'clear'],
          'document': ['write', 'writeln'],
          'console': ['log', 'error', 'warn'], // Tracked for completeness; these are explicitly allowed and not reported
          'window': ['addEventListener', 'removeEventListener']
        };

        if (obj.type === 'Identifier' && dangerousMethods[obj.name]) {
          if (dangerousMethods[obj.name].includes(method)) {
            // Allow console calls for debugging (they don't really mutate global state)
            if (obj.name === 'console') {
              return;
            }

            if (!isInHook(node, ['beforeEach', 'afterEach'])) {
              if (obj.name === 'localStorage' || obj.name === 'sessionStorage') {
                context.report({
                  node,
                  messageId: 'needsCleanup',
                  data: { storage: obj.name }
                });
              } else {
                context.report({
                  node,
                  messageId: 'useLocalVariable'
                });
              }
            }
          }
        }
      }
    }

    function checkGlobalVariableDeclaration(node) {
      // Check for global variable declarations without var/let/const
      if (node.type === 'AssignmentExpression' &&
          node.left.type === 'Identifier') {

        const varName = node.left.name;

        // Check if this assignment is to a declared variable
        const scope = sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();
        const variable = scope.set.get(varName);

        // Allow assignments to declared variables (like testHelper)
        if (variable || isInHook(node, ['beforeEach', 'afterEach', 'beforeAll', 'afterAll'])) {
          return;
        }

        // This creates a global variable
        context.report({
          node,
          messageId: 'useLocalVariable'
        });
      }
    }

    function checkTestOnly(node) {
      // Check for test.only or it.only (covered by separate rule but impacts global state)
      if (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression') {

        const obj = node.callee.object;
        const prop = node.callee.property;

        if ((obj.name === 'test' || obj.name === 'it' || obj.name === 'describe') &&
            prop.name === 'only') {
          // This affects global test execution state
          context.report({
            node,
            messageId: 'avoidGlobalMutation',
            data: { object: 'test execution order' }
          });
        }
      }
    }

    function checkDeleteOperations(node) {
      // Browser-context callbacks run in the page — exempt from mutation reporting.
      if (isInsideBrowserContext(node)) return;
      // Check for delete operations on global objects
      if (node.type === 'UnaryExpression' && node.operator === 'delete') {
        if (node.argument.type === 'MemberExpression') {
          const object = node.argument.object;

          const globalObjects = ['global', 'window', 'document', 'process'];

          if (object.type === 'Identifier' && globalObjects.includes(object.name)) {
            // Allow delete in hooks for cleanup
            if (allowInHooks && isInHook(node, ['beforeEach', 'afterEach', 'beforeAll', 'afterAll'])) {
              return;
            }

            context.report({
              node,
              messageId: 'avoidGlobalMutation',
              data: { object: object.name }
            });
          }

          // Check for process.env deletions
          if (object.type === 'MemberExpression' &&
              object.object.name === 'process' &&
              object.property.name === 'env') {
            context.report({
              node,
              messageId: 'avoidProcessEnv'
            });
          }
        }
      }
    }

    return {
      AssignmentExpression(node) {
        checkGlobalAssignment(node);
        checkGlobalVariableDeclaration(node);
      },
      CallExpression(node) {
        checkGlobalMethodCalls(node);
        checkTestOnly(node);
      },
      UnaryExpression(node) {
        checkDeleteOperations(node);
      }
    };
  }
};