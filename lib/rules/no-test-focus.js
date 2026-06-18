/**
 * @fileoverview Rule to prevent focused or skipped tests that can cause incomplete test runs
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const { isTestFile, getFilename } = require('../utils/helpers');

// Standard test method names
const TEST_METHODS = ['test', 'it', 'describe', 'suite', 'context'];
const FOCUSED_METHODS = ['fdescribe', 'fit', 'ftest', 'fcontext', 'fsuite'];
const SKIPPED_METHODS = ['xdescribe', 'xit', 'xtest', 'xcontext', 'xsuite'];

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent focused or skipped tests that can cause incomplete test runs',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/tigredonorte/eslint-plugin-test-flakiness/blob/main/docs/rules/no-test-focus.md'
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          allowSkip: {
            type: 'boolean',
            default: false,
            description: 'Allow skip methods (test.skip, describe.skip, etc.)'
          },
          allowConditionalSkip: {
            type: 'boolean',
            default: false,
            description: 'Allow a conditional skip whose first argument is a runtime expression (e.g. test.skip(isDeployedEnv, reason)). Disabled by default — every .skip is blocked.'
          },
          allowOnly: {
            type: 'boolean',
            default: false,
            description: 'Allow only/focus methods (test.only, describe.only, etc.)'
          },
          customFocusPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Additional patterns to detect as focused tests'
          },
          customSkipPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Additional patterns to detect as skipped tests'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      noTestOnly: 'Unexpected {{method}}.only - this will cause other tests to be skipped',
      noTestSkip: 'Unexpected {{method}}.skip - this test will not run',
      noUnconditionalSkip: '{{method}}.skip must take a runtime condition (e.g. {{method}}.skip(condition, reason)); {{method}}.skip(), {{method}}.skip(true), {{method}}.skip(false) and other literal/constant first arguments unconditionally disable the test.',
      noFocusedTest: 'Unexpected focused test ({{method}}) - this will cause other tests to be skipped',
      noSkippedTest: 'Unexpected skipped test ({{method}}) - this test will not run'
    }
  },

  create(context) {
    const filename = getFilename(context);
    if (!isTestFile(filename)) {
      return {};
    }

    const options = context.options ? (context.options[0] || {}) : {};
    const allowSkip = options.allowSkip || false;
    const allowConditionalSkip = options.allowConditionalSkip || false;
    const allowOnly = options.allowOnly || false;
    const customFocusPatterns = options.customFocusPatterns || [];
    const customSkipPatterns = options.customSkipPatterns || [];

    // Helper function to match wildcard patterns
    function matchPattern(str, pattern) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*/g, '.*'); // Replace * with .*
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(str);
    }

    // Helper to robustly extract object name from MemberExpression
    function getObjectName(node) {
      if (!node) return undefined;
      if (node.type === 'Identifier') {
        return node.name;
      }
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      if (node.type === 'TemplateLiteral' &&
          node.quasis.length === 1 &&
          node.expressions.length === 0) {
        return node.quasis[0].value.raw;
      }
      if (node.type === 'MemberExpression') {
        // Recursively build the object name
        const object = getObjectName(node.object);
        let property;
        if (node.computed) {
          property = getObjectName(node.property);
        } else {
          property = node.property && node.property.name;
        }
        if (object && property) {
          return object + '.' + property;
        }
        return object || property;
      }
      return undefined;
    }

    // Helper to check if node looks like a test function call
    function isTestFunctionCall(node) {
      if (!node.arguments || node.arguments.length === 0) {
        return false;
      }
      const firstArg = node.arguments[0];
      return firstArg && (firstArg.type === 'Literal' || firstArg.type === 'TemplateLiteral');
    }

    // Helper to generate auto-fix for custom patterns
    function getCustomPatternFix(calleeName, type, fixer, node) {
      const prefixToRemove = type === 'focus' ? 'f' : 'x';
      const suffixToRemove = type === 'focus' ? 'Only' : 'Skip';
      const modifierToRemove = type === 'focus' ? '.only' : '.skip';

      // If pattern starts with prefix (f/x), try removing it
      if (calleeName.startsWith(prefixToRemove) && calleeName.length > 1) {
        const modified = calleeName.substring(1);
        // Check if modified version is a known test method
        if (TEST_METHODS.includes(modified)) {
          return fixer.replaceText(node.callee, modified);
        }
      }

      // If pattern ends with suffix (Only/Skip), try removing it
      if (calleeName.endsWith(suffixToRemove) && calleeName.length > suffixToRemove.length) {
        const modified = calleeName.slice(0, -suffixToRemove.length);
        return fixer.replaceText(node.callee, modified);
      }

      // If pattern contains modifier (.only/.skip), try removing it
      if (calleeName.includes(modifierToRemove)) {
        const modified = calleeName.replace(modifierToRemove, '');
        return fixer.replaceText(node.callee, modified);
      }

      // No auto-fix available for this pattern
      return null;
    }

    // Resolve a variable by name walking up the scope chain
    function findVariable(scope, name) {
      let s = scope;
      while (s) {
        const variable = s.variables.find(v => v.name === name);
        if (variable) return variable;
        s = s.upper;
      }
      return null;
    }

    // Does a function node always return a constant literal value?
    function functionReturnsConstant(fn, scope, depth) {
      if (!fn || depth > 5) return false;
      // Expression-bodied arrow: () => true
      if (fn.body && fn.body.type !== 'BlockStatement') {
        return isConstantNode(fn.body, scope, depth + 1);
      }
      // Block body: only constant if it is a single `return <const>` statement
      const body = fn.body && fn.body.body ? fn.body.body : [];
      if (body.length !== 1 || body[0].type !== 'ReturnStatement') return false;
      return isConstantNode(body[0].argument, scope, depth + 1);
    }

    // Is `node` statically resolvable to a constant value (literal, constant
    // variable, or call to a function that only returns a literal)?
    function isConstantNode(node, scope, depth = 0) {
      if (!node || depth > 5) return false;
      switch (node.type) {
        case 'Literal':
          return true;
        case 'TemplateLiteral':
          return node.expressions.length === 0;
        case 'UnaryExpression':
          // e.g. !true, -1, void 0
          return isConstantNode(node.argument, scope, depth + 1);
        case 'LogicalExpression':
        case 'BinaryExpression':
          // e.g. true && false, 1 === 1
          return isConstantNode(node.left, scope, depth + 1) &&
                 isConstantNode(node.right, scope, depth + 1);
        case 'ConditionalExpression':
          // e.g. true ? false : true
          return isConstantNode(node.test, scope, depth + 1) &&
                 isConstantNode(node.consequent, scope, depth + 1) &&
                 isConstantNode(node.alternate, scope, depth + 1);
        case 'Identifier': {
          // Global constants like undefined / NaN / Infinity
          const variable = findVariable(scope, node.name);
          if (!variable) {
            return ['undefined', 'NaN', 'Infinity'].includes(node.name);
          }
          if (variable.defs.length !== 1) return false;
          const def = variable.defs[0];
          if (def.type !== 'Variable' || !def.node || def.node.type !== 'VariableDeclarator') {
            return false;
          }
          // Reassigned somewhere beyond its initialization → not constant
          const writes = variable.references.filter(ref => ref.isWrite());
          if (writes.length > 1) return false;
          return isConstantNode(def.node.init, scope, depth + 1);
        }
        case 'CallExpression': {
          if (node.callee.type !== 'Identifier') return false;
          const variable = findVariable(scope, node.callee.name);
          if (!variable || variable.defs.length !== 1) return false;
          const def = variable.defs[0];
          let fn = null;
          if (def.node && def.node.type === 'FunctionDeclaration') {
            fn = def.node;
          } else if (def.type === 'Variable' && def.node && def.node.init &&
                     (def.node.init.type === 'ArrowFunctionExpression' ||
                      def.node.init.type === 'FunctionExpression')) {
            fn = def.node.init;
          }
          return functionReturnsConstant(fn, scope, depth + 1);
        }
        default:
          return false;
      }
    }

    function getScopeFor(node) {
      const sourceCode = context.sourceCode || context.getSourceCode();
      if (sourceCode && typeof sourceCode.getScope === 'function') {
        return sourceCode.getScope(node);
      }
      return context.getScope();
    }

    function checkMemberExpression(node) {
      if (node.object && node.property) {
        const objectName = getObjectName(node.object);

        // Handle both dot notation and bracket notation
        let propertyName;
        if (node.computed) {
          // Handle bracket notation like test['only'] or test[`only`]
          if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
            propertyName = node.property.value;
          } else if (node.property.type === 'TemplateLiteral' &&
                     node.property.quasis.length === 1 &&
                     node.property.expressions.length === 0) {
            // Handle simple template literals without expressions
            propertyName = node.property.quasis[0].value.raw;
          }
        } else {
          // Standard dot notation
          propertyName = node.property.name;
        }

        // Check for .only or ['only']
        if (!allowOnly && propertyName === 'only' && TEST_METHODS.includes(objectName)) {
          context.report({
            node,
            messageId: 'noTestOnly',
            data: { method: objectName },
            fix(fixer) {
              const sourceCode = context.getSourceCode();
              if (node.computed) {
                // For bracket notation, replace entire member expression with just the object
                return fixer.replaceText(node, objectName);
              } else {
                // For dot notation, remove .only
                const dotToken = sourceCode.getTokenBefore(node.property);
                return fixer.removeRange([dotToken.range[0], node.property.range[1]]);
              }
            }
          });
        }

        // Check for .skip or ['skip']
        if (!allowSkip && propertyName === 'skip' && TEST_METHODS.includes(objectName)) {
          const call = node.parent;
          const isCall = call && call.type === 'CallExpression' && call.callee === node;
          const args = isCall ? call.arguments : [];

          const FN = ['ArrowFunctionExpression', 'FunctionExpression'];
          const hasTestBody = args.some(a => FN.includes(a.type));

          const first = args[0];
          const LITERALS = ['Literal', 'TemplateLiteral'];
          // A real condition = present, not a test body, not a literal, and not
          // statically resolvable to a constant value.
          const isRuntimeCondition =
            !!first &&
            !FN.includes(first.type) &&
            !LITERALS.includes(first.type) &&
            !isConstantNode(first, getScopeFor(node));

          // A conditional skip driven by a runtime expression. This is the ONLY
          // form that can be allowed, and only when the consumer opts in via
          // `allowConditionalSkip`. By default every .skip is blocked.
          const isConditionalSkip = isCall && !hasTestBody && isRuntimeCondition;
          if (isConditionalSkip && allowConditionalSkip) {
            return;
          }

          // Declaration form (test.skip('name', fn) / describe.skip(...) / tagged
          // template) → strip the .skip modifier to re-enable the test.
          // A runtime-conditional skip with the opt-in disabled is reported but
          // not auto-fixed (stripping .skip would change the call semantics).
          // Unconditional skip (test.skip(), test.skip(true), test.skip(constant))
          // → reported, no auto-fix (manual decision).
          const isDeclarationForm = !isCall || hasTestBody;
          let messageId;
          let canFix;
          if (isDeclarationForm) {
            messageId = 'noTestSkip';
            canFix = true;
          } else if (isConditionalSkip) {
            messageId = 'noTestSkip';
            canFix = false;
          } else {
            messageId = 'noUnconditionalSkip';
            canFix = false;
          }

          context.report({
            node,
            messageId,
            data: { method: objectName },
            fix: canFix
              ? function(fixer) {
                  const sourceCode = context.getSourceCode();
                  if (node.computed) {
                    // For bracket notation, replace entire member expression with just the object
                    return fixer.replaceText(node, objectName);
                  } else {
                    // For dot notation, remove .skip
                    const dotToken = sourceCode.getTokenBefore(node.property);
                    return fixer.removeRange([dotToken.range[0], node.property.range[1]]);
                  }
                }
              : undefined
          });
        }

        // Check for .todo or ['todo']
        if (!allowSkip && propertyName === 'todo' && TEST_METHODS.includes(objectName)) {
          context.report({
            node,
            messageId: 'noTestSkip',
            data: { method: objectName },
            fix(fixer) {
              const sourceCode = context.getSourceCode();
              if (node.computed) {
                // For bracket notation, replace entire member expression with just the object
                return fixer.replaceText(node, objectName);
              } else {
                // For dot notation, remove .todo
                const dotToken = sourceCode.getTokenBefore(node.property);
                return fixer.removeRange([dotToken.range[0], node.property.range[1]]);
              }
            }
          });
        }
      }
    }

    function checkCallExpression(node) {
      if (!node.callee) return;

      const calleeName = node.callee.name;

      // Check for focused test methods (fdescribe, fit, ftest)
      if (!allowOnly && calleeName) {
        if (FOCUSED_METHODS.includes(calleeName)) {
          // Check if this looks like a test function call (has arguments)
          // and is not a local variable/function definition
          if (isTestFunctionCall(node)) {
            context.report({
                node,
                messageId: 'noFocusedTest',
                data: { method: calleeName },
                fix(fixer) {
                  // Remove 'f' prefix
                  return fixer.replaceText(node.callee, calleeName.substring(1));
                }
              });
          }
        }

        // Check custom focus patterns
        for (const pattern of customFocusPatterns) {
          if (calleeName === pattern || (pattern.includes('*') && matchPattern(calleeName, pattern))) {
            context.report({
              node,
              messageId: 'noFocusedTest',
              data: { method: calleeName },
              fix(fixer) {
                return getCustomPatternFix(calleeName, 'focus', fixer, node);
              }
            });
            break;
          }
        }
      }

      // Check for skipped test methods (xdescribe, xit, xtest)
      if (!allowSkip && calleeName) {
        if (SKIPPED_METHODS.includes(calleeName)) {
          // Check if this looks like a test function call (has arguments)
          // and is not a local variable/function definition
          if (isTestFunctionCall(node)) {
            context.report({
                node,
                messageId: 'noSkippedTest',
                data: { method: calleeName },
                fix(fixer) {
                  // Remove 'x' prefix
                  return fixer.replaceText(node.callee, calleeName.substring(1));
                }
              });
          }
        }

        // Check custom skip patterns
        for (const pattern of customSkipPatterns) {
          if (calleeName === pattern || (pattern.includes('*') && matchPattern(calleeName, pattern))) {
            context.report({
              node,
              messageId: 'noSkippedTest',
              data: { method: calleeName },
              fix(fixer) {
                return getCustomPatternFix(calleeName, 'skip', fixer, node);
              }
            });
            break;
          }
        }
      }

      // Check for member expressions like test.only, describe.skip, test['only'], test[`skip`]
      if (node.callee.type === 'MemberExpression') {
        checkMemberExpression(node.callee);
      }
    }

    return {
      CallExpression: checkCallExpression,
      TaggedTemplateExpression: function(node) {
        // Handle template literal test calls like fit`test` or test.only`test`
        const tag = node.tag;

        if (tag.type === 'Identifier') {
          // Handle fit`test`, xdescribe`test`
          const tagName = tag.name;
          if (!allowOnly) {
            if (FOCUSED_METHODS.includes(tagName)) {
              context.report({
                node,
                messageId: 'noFocusedTest',
                data: { method: tagName },
                fix(fixer) {
                  // Remove 'f' prefix
                  return fixer.replaceText(tag, tagName.substring(1));
                }
              });
            }
          }
          if (!allowSkip) {
            if (SKIPPED_METHODS.includes(tagName)) {
              context.report({
                node,
                messageId: 'noSkippedTest',
                data: { method: tagName },
                fix(fixer) {
                  // Remove 'x' prefix
                  return fixer.replaceText(tag, tagName.substring(1));
                }
              });
            }
          }
        } else if (tag.type === 'MemberExpression') {
          // Handle test.only`test`, describe.skip`test`
          checkMemberExpression(tag);
        }
      }
    };
  }
};