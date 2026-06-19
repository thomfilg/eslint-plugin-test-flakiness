/**
 * @fileoverview Rule to flag timeout options whose resolved value exceeds a
 * per-category budget (assertions vs interactions), while exempting navigation
 * operations and resolving symbolic tier constants via a configurable map.
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const { isTestFile, getFilename } = require('../utils/helpers');

const DEFAULT_ALLOW_HIGH_TIMEOUT_FOR = [
  'page.goto',
  'page.reload',
  'page.waitForNavigation'
];

/**
 * Merge user options over documented defaults.
 * @param {Object} raw - context.options[0]
 * @returns {{maxTimeoutForAssertions:number, maxTimeoutForInteractions:number, allowHighTimeoutFor:string[], namedTiers:Object, ignoreUnknownTiers:boolean}}
 */
function resolveOptions(raw) {
  const options = raw || {};
  return {
    maxTimeoutForAssertions:
      typeof options.maxTimeoutForAssertions === 'number'
        ? options.maxTimeoutForAssertions
        : 5000,
    maxTimeoutForInteractions:
      typeof options.maxTimeoutForInteractions === 'number'
        ? options.maxTimeoutForInteractions
        : 5000,
    allowHighTimeoutFor: Array.isArray(options.allowHighTimeoutFor)
      ? options.allowHighTimeoutFor
      : DEFAULT_ALLOW_HIGH_TIMEOUT_FOR,
    namedTiers:
      options.namedTiers && typeof options.namedTiers === 'object'
        ? options.namedTiers
        : {},
    ignoreUnknownTiers:
      typeof options.ignoreUnknownTiers === 'boolean'
        ? options.ignoreUnknownTiers
        : true
  };
}

/**
 * Build the dotted source-text name of a MemberExpression/Identifier chain
 * (e.g. `E2E_TIMEOUT_MS.unreliable`, `page.goto`). Returns null if the chain
 * contains computed/non-identifier parts.
 * @param {Object} node - AST node
 * @returns {string|null}
 */
function dottedName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed) {
    const object = dottedName(node.object);
    const property =
      node.property && node.property.type === 'Identifier'
        ? node.property.name
        : null;
    if (object === null || property === null) return null;
    return `${object}.${property}`;
  }
  return null;
}

/**
 * Resolve a timeout option value node to a number.
 * @param {Object} node - the Property value node
 * @param {Object} opts - resolved options
 * @returns {{value:(number|null), tierName:(string|null), resolved:boolean}}
 */
function resolveTimeout(node, opts) {
  if (node && node.type === 'Literal' && typeof node.value === 'number') {
    return { value: node.value, tierName: null, resolved: true };
  }
  const tierName = dottedName(node);
  if (tierName !== null && Object.prototype.hasOwnProperty.call(opts.namedTiers, tierName)) {
    return { value: opts.namedTiers[tierName], tierName, resolved: true };
  }
  return { value: null, tierName, resolved: false };
}

/**
 * Find the `timeout` Property inside an ObjectExpression argument.
 * @param {Object} node - CallExpression
 * @returns {Object|null}
 */
function findTimeoutProperty(node) {
  for (const arg of node.arguments) {
    if (!arg || arg.type !== 'ObjectExpression') continue;
    for (const prop of arg.properties) {
      if (
        prop.type === 'Property' &&
        !prop.computed &&
        ((prop.key.type === 'Identifier' && prop.key.name === 'timeout') ||
          (prop.key.type === 'Literal' && prop.key.value === 'timeout'))
      ) {
        return prop;
      }
    }
  }
  return null;
}

/**
 * Determine whether a CallExpression's chain roots in `expect(...)`.
 * @param {Object} callee - the CallExpression's callee
 * @returns {boolean}
 */
function isExpectRooted(callee) {
  let current = callee;
  while (current && current.type === 'MemberExpression') {
    current = current.object;
  }
  return (
    current &&
    current.type === 'CallExpression' &&
    current.callee &&
    current.callee.type === 'Identifier' &&
    current.callee.name === 'expect'
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow timeout options that exceed the per-category budget',
      category: 'Best Practices',
      recommended: false,
      url: 'https://github.com/tigredonorte/eslint-plugin-test-flakiness/blob/main/docs/rules/no-overbudget-timeout.md'
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxTimeoutForAssertions: { type: 'number', default: 5000 },
          maxTimeoutForInteractions: { type: 'number', default: 5000 },
          allowHighTimeoutFor: {
            type: 'array',
            items: { type: 'string' },
            default: DEFAULT_ALLOW_HIGH_TIMEOUT_FOR
          },
          namedTiers: {
            type: 'object',
            additionalProperties: { type: 'number' },
            default: {}
          },
          ignoreUnknownTiers: { type: 'boolean', default: true }
        },
        additionalProperties: false
      }
    ],
    messages: {
      overbudgetAssertion:
        'Timeout {{value}}ms exceeds the {{max}}ms budget for assertions. Tighten the tier or fix the underlying wait/race.',
      overbudgetInteraction:
        'Timeout {{value}}ms exceeds the {{max}}ms budget for interactions. Tighten the tier or fix the underlying wait/race.',
      unresolvableTier:
        'Unresolvable timeout tier \'{{tier}}\'. Add it to `namedTiers` or set `ignoreUnknownTiers: true`.'
    }
  },

  create(context) {
    const opts = resolveOptions(context.options[0]);

    if (!isTestFile(getFilename(context))) {
      return {};
    }

    return {
      CallExpression(node) {
        const timeoutProp = findTimeoutProperty(node);
        if (!timeoutProp) return;

        // allowHighTimeoutFor exemption (callee dotted-name).
        const calleeName = dottedName(node.callee);
        if (calleeName !== null && opts.allowHighTimeoutFor.includes(calleeName)) {
          return;
        }

        const isAssertion = isExpectRooted(node.callee);
        const { value, tierName, resolved } = resolveTimeout(
          timeoutProp.value,
          opts
        );

        if (!resolved) {
          if (!opts.ignoreUnknownTiers && tierName !== null) {
            context.report({
              node: timeoutProp.value,
              messageId: 'unresolvableTier',
              data: { tier: tierName }
            });
          }
          return;
        }

        const max = isAssertion
          ? opts.maxTimeoutForAssertions
          : opts.maxTimeoutForInteractions;

        if (value > max) {
          context.report({
            node: timeoutProp.value,
            messageId: isAssertion
              ? 'overbudgetAssertion'
              : 'overbudgetInteraction',
            data: { value, max }
          });
        }
      }
    };
  }
};
