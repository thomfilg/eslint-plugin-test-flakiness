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
 * Resolve the fragility-determining locator-factory call in a member/call chain.
 *
 * Walks the entire object side of a chain (e.g. `page.getByText('x').first()`,
 * `page.frameLocator(...).getByText('x')` or `page.getByText('x').locator('button')`)
 * collecting every `CallExpression` whose callee is a `MemberExpression`. Both
 * scoping methods (`frameLocator()`/`locator()`) and refinement methods
 * (`.first()`/`.last()`/`.nth()`/`.filter()`/`.locator()`) merely wrap a base
 * locator, so neither the outermost nor the innermost call reliably identifies
 * fragility on its own: `getByText('x').first()` needs the inner `getByText`,
 * while `frameLocator('#f').getByText('x')` needs the outer `getByText`.
 *
 * Resolution therefore classifies each factory and selects the relevant one:
 *   1. the first fragile candidate (a `fragile` factory or `getByRole`) found
 *      walking inward — a fragile sub-locator is never rescued by a stable or
 *      scoping wrapper;
 *   2. otherwise the first stable factory — so a genuinely stable chain is not
 *      flagged;
 *   3. otherwise the innermost call as a fallback, preserving prior behavior for
 *      refinement-only chains (`page.locator('x').click()`).
 *
 * When the chain bottoms out at an Identifier (a stored locator such as
 * `const tgt = page.getByText('x'); tgt.first().click()`), the optional
 * `resolveIdentifier` resolver ties that base variable back to its originating
 * factory so refinements on a stored fragile locator are flagged just like the
 * inlined form.
 *
 * @param {object} object - The object side of the action's MemberExpression.
 * @param {(name: string) => ('fragile'|'stable'|null)} classify - Factory classifier.
 * @param {(id: object) => ({name: string, call: object}|null)} [resolveIdentifier] - Resolves an Identifier base to its factory.
 * @returns {{name: string, call: object}|null} Factory info or null.
 */
function resolveFactory(object, classify, resolveIdentifier) {
  let current = object;
  let firstCandidate = null;
  let firstStable = null;
  let innermost = null;
  while (current) {
    if (current.type === 'CallExpression' &&
        current.callee && current.callee.type === 'MemberExpression') {
      const factory = { name: current.callee.property.name, call: current };
      const kind = classify(factory.name);
      if (kind === 'fragile' && !firstCandidate) {
        firstCandidate = factory;
      } else if (kind === 'stable' && !firstStable) {
        firstStable = factory;
      }
      // Each iteration moves inward, so the last one recorded is the innermost.
      innermost = factory;
      current = current.callee.object;
    } else if (current.type === 'CallExpression') {
      current = current.callee;
    } else if (current.type === 'MemberExpression') {
      current = current.object;
    } else if (current.type === 'Identifier' && resolveIdentifier) {
      // Stored-locator base: resolve the variable to its originating factory and
      // fold it in as the innermost call so `tgt.first().click()` is treated the
      // same as `page.getByText('x').first().click()`.
      const resolved = resolveIdentifier(current);
      if (resolved) {
        const kind = classify(resolved.name);
        if (kind === 'fragile' && !firstCandidate) {
          firstCandidate = resolved;
        } else if (kind === 'stable' && !firstStable) {
          firstStable = resolved;
        }
        innermost = resolved;
      }
      break;
    } else {
      break;
    }
  }
  return firstCandidate || firstStable || innermost;
}

/**
 * Determine whether a `getByRole(...)` factory call carries a `{ name }` option.
 *
 * When the options argument is not a statically-analyzable object literal (e.g.
 * `getByRole('button', opts)` or `getByRole('button', { ...defaults })`), the
 * rule cannot prove that `name` is absent, so it conservatively reports a name as
 * present to avoid false positives.
 *
 * @param {object} callNode - The factory CallExpression node.
 * @returns {boolean} True when a second-argument object has (or may have) a `name` property.
 */
function hasNameOption(callNode) {
  const arg = callNode.arguments && callNode.arguments[1];
  if (!arg) {
    return false;
  }
  // Non-object-literal options (identifier, call, etc.) are opaque — assume name.
  if (arg.type !== 'ObjectExpression') {
    return true;
  }
  return arg.properties.some((prop) => {
    // A spread (`{ ...opts }`) may contribute `name`; treat it as present.
    if (prop.type === 'SpreadElement' || prop.type === 'ExperimentalSpreadProperty') {
      return true;
    }
    // A computed key cannot be statically resolved; treat it as a possible name.
    if (prop.type === 'Property' && prop.computed) {
      return true;
    }
    return prop.type === 'Property' &&
      ((prop.key.type === 'Identifier' && prop.key.name === 'name') ||
       (prop.key.type === 'Literal' && prop.key.value === 'name'));
  });
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
      fragileAction: 'Avoid driving `{{method}}` off a fragile locator (`{{factory}}`); prefer a stable locator ({{suggestion}}) instead.'
    }
  },

  create(context) {
    const options = (context.options && context.options[0]) || {};
    const fragile = options.fragile || DEFAULT_FRAGILE;
    const actionMethods = options.actionMethods || DEFAULT_ACTION_METHODS;
    const stable = options.stable || DEFAULT_STABLE;
    // Build the human-readable list of preferred stable locators for the report
    // message, instead of hard-coding `getByTestId`, so configured/custom stable
    // factories are reflected accurately. Falls back to `getByTestId` when empty.
    const stableSuggestion = (stable.length ? stable : ['getByTestId'])
      .map((name) => `\`${name}\``)
      .join(' or ');
    const flagRoleWithoutName = options.flagRoleWithoutName !== false;
    const filePattern = options.filePattern || DEFAULT_FILE_PATTERN;

    // E2E-spec-scoped only: bail early when the basename does not match filePattern.
    const fileRegex = globToRegExp(filePattern);
    if (!fileRegex.test(basename(getFilename(context)))) {
      return {};
    }

    /**
     * Classify a factory name so resolveFactory can pick the fragility-relevant
     * call in a chain. `getByRole` is always a candidate (its fragility depends
     * on the presence of a `name` option, decided later by isFragileFactory).
     *
     * @param {string} name - The factory method name.
     * @returns {'fragile'|'stable'|null} Its classification.
     */
    function classifyFactory(name) {
      if (name === 'getByRole') {
        return 'fragile';
      }
      if (fragile.includes(name)) {
        return 'fragile';
      }
      if (stable.includes(name)) {
        return 'stable';
      }
      return null;
    }

    /**
     * Resolve an Identifier action-receiver to its originating factory call by
     * locating its most recent variable declaration in the current scope chain.
     *
     * Follows alias inits (`const b = a`) by threading itself back into
     * resolveFactory as the identifier resolver, while a `seen` set of resolved
     * variables guards against infinite recursion on self-referential writes
     * (e.g. `t = t.filter(...)`).
     *
     * @param {object} identifier - The Identifier node used as the action receiver.
     * @param {Set<object>} [seen] - Variables already being resolved (cycle guard).
     * @returns {object|null} The originating factory info, or null.
     */
    function resolveIdentifierFactory(identifier, seen) {
      seen = seen || new Set();
      // ESLint 9 exposes scope via sourceCode.getScope(node); v7/v8 use context.getScope().
      const sourceCode = context.sourceCode || context.getSourceCode();
      let scope = (sourceCode && sourceCode.getScope)
        ? sourceCode.getScope(identifier)
        : context.getScope();
      const useStart = identifier.range ? identifier.range[0] : Infinity;
      while (scope) {
        const variable = scope.variables.find((v) => v.name === identifier.name);
        if (variable) {
          // Cycle guard: a self-referential write (`t = t.filter(...)`) would
          // otherwise recurse forever through the resolver threaded below.
          if (seen.has(variable)) {
            return null;
          }
          seen.add(variable);
          // Collect every write to the binding — the declarator initializer and
          // any later AssignmentExpression updates — then pick the most recent
          // one that precedes the action-receiver usage. This avoids tying the
          // receiver to a stale declaration `init` when the locator is reassigned.
          let latestWrite = null;
          let latestWriteStart = -Infinity;

          for (const def of variable.defs) {
            if (
              def.node &&
              def.node.type === 'VariableDeclarator' &&
              def.node.init &&
              def.node.range &&
              def.node.range[0] < useStart &&
              def.node.range[0] > latestWriteStart
            ) {
              latestWrite = def.node.init;
              latestWriteStart = def.node.range[0];
            }
          }

          for (const ref of variable.references) {
            if (!ref.isWrite() || !ref.writeExpr || !ref.writeExpr.range) {
              continue;
            }
            const writeStart = ref.writeExpr.range[0];
            if (writeStart < useStart && writeStart > latestWriteStart) {
              latestWrite = ref.writeExpr;
              latestWriteStart = writeStart;
            }
          }

          if (latestWrite) {
            // Pass the resolver so an alias init (`const b = a`) follows `a` back
            // to its factory; the shared `seen` set keeps the walk acyclic.
            return resolveFactory(latestWrite, classifyFactory, (id) =>
              resolveIdentifierFactory(id, seen));
          }
          // Binding found but no resolvable write before the usage (e.g. declared
          // without initializer); stop walking outer scopes — it is shadowed here.
          return null;
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
          : resolveFactory(receiver, classifyFactory, resolveIdentifierFactory);

        if (isFragileFactory(factory)) {
          context.report({
            node,
            messageId: 'fragileAction',
            data: { method, factory: factory.name, suggestion: stableSuggestion }
          });
        }
      }
    };
  }
};
