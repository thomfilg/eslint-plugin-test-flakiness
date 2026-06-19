/**
 * @fileoverview Rule to flag fragile Playwright locators used in action position
 * @author eslint-plugin-test-flakiness
 */
'use strict';

const { getFilename } = require('../utils/helpers');

const DEFAULT_FRAGILE = ['getByText'];
const DEFAULT_ACTION_METHODS = [
  'click', 'dblclick', 'fill', 'type', 'press', 'check', 'uncheck',
  'selectOption', 'setInputFiles', 'hover', 'focus', 'dragTo', 'tap', 'waitFor'
];
const DEFAULT_STABLE = ['getByTestId', 'getByPlaceholder'];
const DEFAULT_FILE_PATTERN = '*.spec.ts';

/**
 * Convert a simple file glob to a bounded, anchored regex.
 *
 * Only `*` is treated as a wildcard (matching any run of non-`/` characters);
 * every other character is escaped to a literal. The result is fully anchored
 * (`^…$`) and uses only the bounded quantifier `[^/]*`, so it has no catastrophic
 * backtracking surface (ReDoS-safe) and needs no `minimatch` dependency.
 *
 * @param {string} glob - The glob pattern, e.g. `"*.spec.ts"`.
 * @returns {RegExp} An anchored, ReDoS-safe regex matching a basename.
 */
function globToRegExp(glob) {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, (ch) =>
    ch === '*' ? '[^/]*' : `\\${ch}`
  );
  return new RegExp(`^${escaped}$`);
}

/**
 * Extract the basename (final path segment) from a filename.
 *
 * @param {string} filename - Full or relative filename.
 * @returns {string} The basename.
 */
function basename(filename) {
  const normalized = String(filename).replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

/**
 * Resolve the name of the innermost locator-factory call in a member/call chain.
 *
 * Walks down the object side of a chain (e.g. `page.getByText('x')` or
 * `page.frameLocator(...).getByText('x')`) and returns the property name of the
 * first `CallExpression` whose callee is a `MemberExpression` (the factory call),
 * along with that call node so callers can inspect its arguments.
 *
 * @param {object} object - The object side of the action's MemberExpression.
 * @returns {{name: string, call: object}|null} Factory info or null.
 */
function resolveFactory(object) {
  let current = object;
  while (current) {
    if (current.type === 'CallExpression' &&
        current.callee && current.callee.type === 'MemberExpression') {
      return { name: current.callee.property.name, call: current };
    }
    if (current.type === 'CallExpression') {
      current = current.callee;
    } else if (current.type === 'MemberExpression') {
      current = current.object;
    } else {
      break;
    }
  }
  return null;
}

/**
 * Determine whether a `getByRole(...)` factory call carries a `{ name }` option.
 *
 * @param {object} callNode - The factory CallExpression node.
 * @returns {boolean} True when a second-argument object has a `name` property.
 */
function hasNameOption(callNode) {
  const arg = callNode.arguments && callNode.arguments[1];
  if (!arg || arg.type !== 'ObjectExpression') {
    return false;
  }
  return arg.properties.some((prop) =>
    prop.type === 'Property' &&
    ((prop.key.type === 'Identifier' && prop.key.name === 'name') ||
     (prop.key.type === 'Literal' && prop.key.value === 'name'))
  );
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Flag fragile Playwright locators (e.g. getByText) when they drive an action',
      category: 'Best Practices',
      recommended: false,
      url: 'https://github.com/tigredonorte/eslint-plugin-test-flakiness/blob/main/docs/rules/no-fragile-locators.md'
    },
    schema: [
      {
        type: 'object',
        properties: {
          fragile: {
            type: 'array',
            items: { type: 'string' }
          },
          actionMethods: {
            type: 'array',
            items: { type: 'string' }
          },
          stable: {
            type: 'array',
            items: { type: 'string' }
          },
          flagRoleWithoutName: {
            type: 'boolean'
          },
          filePattern: {
            type: 'string'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      fragileAction: 'Avoid driving `{{method}}` off a fragile locator (`{{factory}}`); use getByTestId instead.'
    }
  },

  create(context) {
    const options = (context.options && context.options[0]) || {};
    const fragile = options.fragile || DEFAULT_FRAGILE;
    const actionMethods = options.actionMethods || DEFAULT_ACTION_METHODS;
    const stable = options.stable || DEFAULT_STABLE;
    const flagRoleWithoutName = options.flagRoleWithoutName !== false;
    const filePattern = options.filePattern || DEFAULT_FILE_PATTERN;

    // E2E-spec-scoped only: bail early when the basename does not match filePattern.
    const fileRegex = globToRegExp(filePattern);
    if (!fileRegex.test(basename(getFilename(context)))) {
      return {};
    }

    /**
     * Resolve an Identifier action-receiver to its originating factory call by
     * locating its most recent variable declaration in the current scope chain.
     *
     * @param {object} identifier - The Identifier node used as the action receiver.
     * @returns {object|null} The originating factory info, or null.
     */
    function resolveIdentifierFactory(identifier) {
      // ESLint 9 exposes scope via sourceCode.getScope(node); v7/v8 use context.getScope().
      const sourceCode = context.sourceCode || context.getSourceCode();
      let scope = (sourceCode && sourceCode.getScope)
        ? sourceCode.getScope(identifier)
        : context.getScope();
      while (scope) {
        const variable = scope.variables.find((v) => v.name === identifier.name);
        if (variable) {
          for (const def of variable.defs) {
            if (def.node && def.node.type === 'VariableDeclarator' && def.node.init) {
              return resolveFactory(def.node.init);
            }
          }
        }
        scope = scope.upper;
      }
      return null;
    }

    /**
     * Decide whether a resolved factory is fragile under the current options.
     *
     * @param {{name: string, call: object}} factory - Resolved factory info.
     * @returns {boolean} True when the factory should be flagged.
     */
    function isFragileFactory(factory) {
      if (!factory) {
        return false;
      }
      if (stable.includes(factory.name)) {
        return false;
      }
      if (factory.name === 'getByRole') {
        return flagRoleWithoutName && !hasNameOption(factory.call);
      }
      return fragile.includes(factory.name);
    }

    return {
      // Assertion immunity holds by construction: we only ever report on an
      // action CallExpression, never on a bare locator passed to expect(...).
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }
        const method = node.callee.property.name;
        if (!actionMethods.includes(method)) {
          return;
        }

        const receiver = node.callee.object;
        const factory = receiver.type === 'Identifier'
          ? resolveIdentifierFactory(receiver)
          : resolveFactory(receiver);

        if (isFragileFactory(factory)) {
          context.report({
            node,
            messageId: 'fragileAction',
            data: { method, factory: factory.name }
          });
        }
      }
    };
  }
};
