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
        'Avoid waiting on the cached API response; a {{method}} response can be served from cache and is not a reliable signal. Assert on the visible UI outcome (e.g. the rendered element/text) instead.'
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
     * Collect every statically-known HTTP-method signal from a call's
     * arguments: a `method` property on ANY inline options object, plus any
     * positional method-string literal. Order-independent, so a method hint in
     * a later argument can't be hidden by an earlier one.
     * @param {object} node The CallExpression node.
     * @returns {{literals: string[], hasNonLiteral: boolean}} Lowercased method
     *   literals found across all arguments, and whether any `method` value was
     *   a non-literal (variable / template) that can't be read statically.
     */
    function collectMethodSignals(node) {
      const literals = [];
      let hasNonLiteral = false;
      for (let index = 0; index < node.arguments.length; index += 1) {
        const arg = node.arguments[index];
        if (!arg) {
          continue;
        }
        if (arg.type === 'ObjectExpression') {
          const methodProp = arg.properties.find(
            prop =>
              prop.type === 'Property' &&
              // A string-literal key matches whether or not it is computed, so
              // `{ ['method']: ... }` is treated the same as `{ 'method': ... }`.
              // A computed identifier key (`{ [methodKey]: ... }`) stays excluded
              // since its resolved name is not statically known.
              ((prop.key.type === 'Literal' && prop.key.value === 'method') ||
                (!prop.computed && prop.key.type === 'Identifier' && prop.key.name === 'method'))
          );
          if (methodProp) {
            const value = methodProp.value;
            if (value.type === 'Literal' && typeof value.value === 'string') {
              literals.push(value.value.toLowerCase());
            } else {
              hasNonLiteral = true;
            }
          }
        } else if (
          // The FIRST argument is the URL / RegExp / predicate matcher, never a
          // method — so a method-looking first arg (e.g. `waitForResponse('POST')`)
          // must not suppress reporting. Only later positional string literals
          // count as method hints.
          index > 0 &&
          arg.type === 'Literal' &&
          typeof arg.value === 'string' &&
          KNOWN_HTTP_METHODS.has(arg.value.toLowerCase())
        ) {
          literals.push(arg.value.toLowerCase());
        }
      }
      return { literals, hasNonLiteral };
    }

    /**
     * Determine the effective HTTP method a matched helper call waits on, when
     * that method is one the rule should flag. Returns the upper-cased method
     * string to report (e.g. `'GET'`, `'HEAD'`), or `null` when the call should
     * not be flagged. The returned method is interpolated into the report
     * message so it stays accurate under a custom `flagMethods`.
     * @param {object} node The CallExpression node.
     * @param {string} name The resolved terminal callee name.
     * @returns {string|null} The flaggable method, or null to skip.
     */
    function matchedMethod(node, name) {
      const { literals, hasNonLiteral } = collectMethodSignals(node);

      // An explicit mutation literal anywhere (a method NOT in `flagMethods`)
      // means a real network request fires, so the wait is reliable — never
      // flag, even if another argument also carries a flaggable literal.
      if (literals.some(method => !flagMethods.includes(method))) {
        return null;
      }

      // Any explicit flaggable literal (e.g. GET) — report it.
      const flaggable = literals.find(method => flagMethods.includes(method));
      if (flaggable) {
        return flaggable.toUpperCase();
      }

      // A `method` we couldn't read statically (variable / template literal) is
      // not determinable; stay conservative and do not flag.
      if (hasNonLiteral) {
        return null;
      }

      // No explicit method anywhere. Every remaining branch represents an
      // IMPLICIT GET (an opaque matcher, a bare URL matcher, or an inline
      // options object that omits `method`). Honor `flagMethods`: when GET is
      // excluded from it, none of these implicit-GET waits should be flagged.
      if (!flagMethods.includes('get')) {
        return null;
      }

      // No statically determinable method anywhere. An opaque response matcher
      // — a call whose argument is a predicate function (e.g.
      // `waitForResponse(resp => resp.url().includes('/api'))`) — has no method
      // filter, so a cache-served GET can satisfy it. This is detected by shape
      // (predicate arg), so it applies to custom `helperNames` too.
      const hasPredicateArg = node.arguments.some(
        arg =>
          arg &&
          (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')
      );
      if (hasPredicateArg) {
        return 'GET';
      }

      // The built-in `waitForResponse` / `page.waitForResponse` matcher also
      // accepts a URL string/RegExp with no method filter. NOTE: this URL-string
      // form is keyed to the built-in name; a consumer who renames it via
      // `helperNames` gets only the predicate/options detection above. See the
      // rule docs ("opaque matcher") for this coupling.
      if (name === 'waitForResponse') {
        return 'GET';
      }

      // A custom helper called with an inline options object that simply omits
      // `method` defaults to an implicit GET -> flag.
      const hasInlineOptions = node.arguments.some(arg => arg && arg.type === 'ObjectExpression');
      if (hasInlineOptions) {
        return 'GET';
      }

      // Otherwise the options are not statically inspectable (passed via a
      // variable, or only a URL string) -> stay conservative and do not flag.
      return null;
    }

    return {
      CallExpression(node) {
        const name = getCalleeName(node.callee);
        if (!name || !helperNames.includes(name)) {
          return;
        }

        const method = matchedMethod(node, name);
        if (method) {
          context.report({
            node,
            messageId: 'cachedApiWait',
            data: { method }
          });
        }
      }
    };
  }
};
