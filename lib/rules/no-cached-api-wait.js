/**
 * @fileoverview Rule to avoid asserting on cached API responses instead of the visible UI outcome
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const { isTestFile, getFilename } = require('../utils/helpers');

const DEFAULT_FLAG_METHODS = ['GET'];
const DEFAULT_HELPER_NAMES = ['waitForApiResponse', 'waitForResponse'];
const KNOWN_HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options'
]);

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Avoid waiting on cached API/network responses; assert on the visible UI outcome instead',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/tigredonorte/eslint-plugin-test-flakiness/blob/main/docs/rules/no-cached-api-wait.md'
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          flagMethods: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_FLAG_METHODS
          },
          helperNames: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_HELPER_NAMES
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      cachedApiWait:
        'Avoid waiting on the cached API response; a GET response can be served from cache and is not a reliable signal. Assert on the visible UI outcome (e.g. the rendered element/text) instead.'
    }
  },

  create(context) {
    if (!isTestFile(getFilename(context))) {
      return {};
    }

    const options = context.options[0] || {};
    const flagMethods = (options.flagMethods || DEFAULT_FLAG_METHODS).map(m =>
      String(m).toLowerCase()
    );
    const helperNames = options.helperNames || DEFAULT_HELPER_NAMES;

    /**
     * Resolve the terminal callee name for a CallExpression.
     * Handles both `helper(...)` (Identifier) and `page.helper(...)` (MemberExpression).
     * @param {object} callee The callee node.
     * @returns {string|null} The terminal name, or null when not statically known.
     */
    function getCalleeName(callee) {
      if (callee.type === 'Identifier') {
        return callee.name;
      }
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        return callee.property.name;
      }
      return null;
    }

    /**
     * Find the `method` property value from an options-object argument.
     * @param {object} node The CallExpression node.
     * @returns {{found: boolean, methodNode: (object|null)}} Lookup result.
     */
    function findMethodProperty(node) {
      const objectArg = node.arguments.find(arg => arg && arg.type === 'ObjectExpression');
      if (!objectArg) {
        return { found: false, methodNode: null };
      }
      const methodProp = objectArg.properties.find(
        prop =>
          prop.type === 'Property' &&
          !prop.computed &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'method') ||
            (prop.key.type === 'Literal' && prop.key.value === 'method'))
      );
      if (!methodProp) {
        return { found: false, methodNode: null };
      }
      return { found: true, methodNode: methodProp.value };
    }

    /**
     * Find an HTTP method passed as a positional string-literal argument, used
     * when no options-object `method` property is present (e.g.
     * `waitForApiResponse('/api/users', 'POST')`).
     * @param {object} node The CallExpression node.
     * @returns {{found: boolean, method: (string|null)}} Lookup result.
     */
    function findPositionalMethod(node) {
      const methodArg = node.arguments.find(
        arg =>
          arg &&
          arg.type === 'Literal' &&
          typeof arg.value === 'string' &&
          KNOWN_HTTP_METHODS.has(arg.value.toLowerCase())
      );
      if (!methodArg) {
        return { found: false, method: null };
      }
      return { found: true, method: methodArg.value.toLowerCase() };
    }

    /**
     * Decide whether a matched helper call should be reported.
     * @param {object} node The CallExpression node.
     * @returns {boolean} True when the call waits on a flaggable (e.g. GET) response.
     */
    function shouldFlag(node) {
      const { found, methodNode } = findMethodProperty(node);

      // No options-object `method` property present. Before falling back to the
      // implicit-GET default, check for an HTTP method passed positionally as a
      // string literal (e.g. `waitForApiResponse('/api/users', 'POST')`); treat
      // it as an explicit method so mutation literals are not flagged.
      if (!found) {
        const positional = findPositionalMethod(node);
        if (positional.found) {
          return flagMethods.includes(positional.method);
        }
        // Truly no static method anywhere -> implicit GET default -> flag.
        return true;
      }

      // Non-literal method (variable / template literal) is not statically
      // determinable; stay conservative and do not flag.
      if (methodNode.type !== 'Literal' || typeof methodNode.value !== 'string') {
        return false;
      }

      return flagMethods.includes(methodNode.value.toLowerCase());
    }

    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (!name || !helperNames.includes(name)) {
          return;
        }

        if (shouldFlag(node)) {
          context.report({
            node,
            messageId: 'cachedApiWait'
          });
        }
      }
    };
  }
};
