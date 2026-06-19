/**
 * @fileoverview Utility functions for eslint-plugin-test-flakiness
 * @author eslint-plugin-test-flakiness
 */
'use strict';

/**
 * Check if a file is a test file based on naming patterns
 * @param {string} filename - The filename to check
 * @returns {boolean} Whether the file is a test file
 */
function isTestFile(filename) {
  if (!filename) return false;
  
  const testPatterns = [
    /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/,
    /\.(test|spec)\.stories\.(js|jsx|ts|tsx)$/,
    /(^|\/)__tests__\//,
    /\/(test|tests|spec|specs)\//,
    /\.(e2e|integration|cy)\.(js|jsx|ts|tsx)$/,
    /\/cypress\//,
    /\/playwright\//,
    /\.steps?\.(js|jsx|ts|tsx)$/
  ];
  
  return testPatterns.some(pattern => pattern.test(filename));
}

/**
 * Check if a node is within a mock or stub context
 * @param {Object} node - The AST node to check
 * @param {Object} context - The ESLint context
 * @returns {boolean} Whether the node is in a mock context
 */
function isInMockContext(node, context) {
  const sourceCode = context.getSourceCode();

  // Check if the node itself is a mock call
  if (node.callee) {
    const calleeText = sourceCode.getText(node.callee);

    // Common mock patterns
    const mockPatterns = [
      /^jest\./,
      /^vi\./,
      /^sinon\./,
      /^mock/i,
      /^stub/i,
      /^spy/i,
      /^fake/i,
      /\.mock/,
      /\.spyOn/,
      /\.stub/,
      /\.fake/
    ];

    if (mockPatterns.some(pattern => pattern.test(calleeText))) {
      return true;
    }
  }

  // For ESLint RuleTester, often the entire test code is treated as one line
  // Get the entire source text and check for mocking patterns
  const entireCode = sourceCode.getText();
  if (hasMockingInStatement(entireCode, node, sourceCode)) {
    return true;
  }

  // Get the specific statement containing this node
  const statement = getContainingStatement(node);
  if (statement) {
    const statementText = sourceCode.getText(statement);

    // Check if the same statement contains mocking setup
    if (hasMockingInStatement(statementText, node, sourceCode)) {
      return true;
    }
  }

  // Check for mock assignments in the current block scope
  if (isMockedInCurrentScope(node, context)) {
    return true;
  }

  // Check parent context (look up to 5 levels)
  let parent = node.parent;
  let level = 0;

  while (parent && level < 5) {
    if (parent.type === 'CallExpression') {
      const calleeText = sourceCode.getText(parent.callee);

      // Check for mock setup functions
      if (/mock|stub|spy|fake|jest\.fn|vi\.fn|sinon\./i.test(calleeText)) {
        return true;
      }

      // Check for jest.mock() or vi.mock() module mocking
      if (parent.callee.type === 'MemberExpression' &&
          parent.callee.object &&
          parent.callee.property) {
        const object = parent.callee.object.name;
        const method = parent.callee.property.name;
        if ((object === 'jest' || object === 'vi') && method === 'mock') {
          return true;
        }
      }
    }

    parent = parent.parent;
    level++;
  }

  return false;
}

/**
 * Get the statement that contains the given node
 * @param {Object} node - The AST node
 * @returns {Object|null} The containing statement node
 */
function getContainingStatement(node) {
  let current = node;
  while (current && current.parent) {
    if (current.parent.type === 'ExpressionStatement' ||
        current.parent.type === 'VariableDeclaration' ||
        current.parent.type === 'Program' ||
        current.parent.type === 'BlockStatement') {
      return current;
    }
    current = current.parent;
  }
  return current;
}

/**
 * Check if a statement contains mocking setup for the given node
 * @param {string} statementText - The text of the entire statement
 * @param {Object} node - The AST node being checked
 * @param {Object} sourceCode - The source code object
 * @returns {boolean} Whether mocking is detected in the statement
 */
function hasMockingInStatement(statementText, node, sourceCode) {
  // Extract the object and method being called
  if (node.callee && node.callee.type === 'MemberExpression') {
    const objectText = sourceCode.getText(node.callee.object);
    const methodText = node.callee.property ? node.callee.property.name : '';

    // For single-line statements like: jest.spyOn(User, "create").mockResolvedValue({}); User.create(...)
    // We need to be more flexible with the patterns

    // Check for jest.spyOn patterns
    const patterns = [
      // jest.spyOn(User, "create") - flexible spacing and quotes
      new RegExp(`jest\\.spyOn\\s*\\(\\s*${escapeRegex(objectText)}\\s*,\\s*["']${methodText}["']\\s*\\)`, 'i'),
      // vi.spyOn(object, "method")
      new RegExp(`vi\\.spyOn\\s*\\(\\s*${escapeRegex(objectText)}\\s*,\\s*["']${methodText}["']\\s*\\)`, 'i'),
      // sinon.stub(object, "method")
      new RegExp(`sinon\\.stub\\s*\\(\\s*${escapeRegex(objectText)}\\s*,\\s*["']${methodText}["']\\s*\\)`, 'i'),
      // td.replace(object, "method")
      new RegExp(`td\\.replace\\s*\\(\\s*${escapeRegex(objectText)}\\s*,\\s*["']${methodText}["']\\s*\\)`, 'i'),
      // object.method = jest.fn() or similar
      new RegExp(`${escapeRegex(objectText)}\\.${methodText}\\s*=\\s*(jest\\.fn|vi\\.fn|\\w*[mM]ock\\w*)`, 'i'),
      // const mockMethod = jest.fn(); object.method = mockMethod
      new RegExp(`const\\s+\\w*[mM]ock\\w*\\s*=\\s*\\w+\\.fn\\(\\);\\s*${escapeRegex(objectText)}\\.${methodText}\\s*=`, 'i')
    ];

    return patterns.some(pattern => pattern.test(statementText));
  }

  return false;
}

/**
 * Check if a method has been mocked in the current scope
 * @param {Object} node - The AST node being checked
 * @param {Object} context - The ESLint context
 * @returns {boolean} Whether the method is mocked in current scope
 */
function isMockedInCurrentScope(node, context) {
  if (!node.callee || node.callee.type !== 'MemberExpression') {
    return false;
  }

  const sourceCode = context.getSourceCode();
  const objectText = sourceCode.getText(node.callee.object);
  const methodText = node.callee.property ? node.callee.property.name : '';

  // Find the current function/block scope
  let current = node.parent;
  while (current) {
    if (current.type === 'FunctionExpression' ||
        current.type === 'ArrowFunctionExpression' ||
        current.type === 'FunctionDeclaration' ||
        current.type === 'BlockStatement') {
      break;
    }
    current = current.parent;
  }

  if (!current) return false;

  // Check if there's a mock assignment before this call in the same scope
  const scopeText = sourceCode.getText(current);
  const mockPatterns = [
    new RegExp(`${escapeRegex(objectText)}\\.${methodText}\\s*=\\s*jest\\.fn`),
    new RegExp(`${escapeRegex(objectText)}\\.${methodText}\\s*=\\s*vi\\.fn`),
    new RegExp(`${escapeRegex(objectText)}\\.${methodText}\\s*=\\s*\\w*[mM]ock\\w*`),
    new RegExp(`const\\s+\\w*[mM]ock\\w*\\s*=\\s*\\w+\\.fn\\(\\);\\s*${escapeRegex(objectText)}\\.${methodText}\\s*=`)
  ];

  return mockPatterns.some(pattern => pattern.test(scopeText));
}

/**
 * Escape special regex characters in a string
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a node is within a specific test hook
 * @param {Object} node - The AST node to check
 * @param {Array<string>} hookNames - Hook names to check for
 * @returns {boolean} Whether the node is in one of the specified hooks
 */
function isInHook(node, hookNames) {
  let parent = node.parent;
  
  while (parent) {
    if (parent.type === 'CallExpression' && 
        parent.callee.type === 'Identifier' &&
        hookNames.includes(parent.callee.name)) {
      return true;
    }
    parent = parent.parent;
  }
  
  return false;
}

/**
 * Check if a node is inside a browser-context callback (e.g. Playwright's
 * page.evaluate / page.addInitScript / page.evaluateHandle), where code runs
 * in the browser and global-state mutations are not test flakiness.
 *
 * Heuristic trade-off: matches on the callee's method NAME only, not the
 * receiver object. This is deliberate — it correctly exempts all Playwright
 * receivers (page/frame/locator/elementHandle .evaluate), which is why we
 * don't hard-pin the object to `page`. The cost is a false-negative on
 * unrelated APIs that share the name, e.g. mathjs `math.evaluate(() => {
 * localStorage.clear() })` would be exempted; accepted as low practical impact.
 * Only INLINE function callbacks are matched — `page.addInitScript(namedFn)`
 * where `namedFn` mutates storage is NOT exempted (references aren't followed).
 *
 * @param {Object} node - The AST node to check
 * @returns {boolean} Whether the node is inside a browser-context call
 */
function isInsideBrowserContext(node) {
  const BROWSER_CONTEXT_METHODS = ['evaluate', 'addInitScript', 'evaluateHandle'];
  let current = node;
  let parent = node.parent;

  while (parent) {
    if (parent.type === 'CallExpression' &&
        parent.callee?.type === 'MemberExpression' &&
        parent.callee.property?.type === 'Identifier' &&
        BROWSER_CONTEXT_METHODS.includes(parent.callee.property.name) &&
        (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') &&
        Array.isArray(parent.arguments) && parent.arguments.includes(current)) {
      // Only the browser-side callback (a function argument) executes in the browser.
      // Sibling arguments are evaluated in Node before serialization, so a node is
      // browser-side only when we reach the call THROUGH its callback function — not
      // via the callee or a non-function argument.
      return true;
    }
    current = parent;
    parent = parent.parent;
  }

  return false;
}

/**
 * Check if a node is within a describe block
 * @param {Object} node - The AST node to check
 * @returns {boolean} Whether the node is in a describe block
 */
function isInDescribe(node) {
  let parent = node.parent;
  
  while (parent) {
    if (parent.type === 'CallExpression' && 
        parent.callee.type === 'Identifier' &&
        (parent.callee.name === 'describe' || 
         parent.callee.name === 'context' ||
         parent.callee.name === 'suite')) {
      return true;
    }
    parent = parent.parent;
  }
  
  return false;
}

/**
 * Check if a node is within a test case
 * @param {Object} node - The AST node to check
 * @returns {boolean} Whether the node is in a test case
 */
function isInTest(node) {
  let parent = node.parent;
  
  while (parent) {
    if (parent.type === 'CallExpression' && 
        parent.callee.type === 'Identifier') {
      const name = parent.callee.name;
      if (name === 'it' || name === 'test' || name === 'specify') {
        return true;
      }
    }
    parent = parent.parent;
  }
  
  return false;
}

/**
 * Get the filename from ESLint context (compatible with v7, v8, and v9)
 * @param {Object} context - The ESLint context
 * @returns {string} The filename
 */
function getFilename(context) {
  // ESLint 9+ uses context.filename
  if (context.filename) return context.filename;
  // ESLint 8 uses getPhysicalFilename() or getFilename()
  if (context.getPhysicalFilename) return context.getPhysicalFilename();
  // ESLint 7 uses getFilename()
  if (context.getFilename) return context.getFilename();
  return '';
}

/**
 * Get the test framework being used
 * @param {Object} context - The ESLint context
 * @returns {string|null} The test framework name or null
 */
function getTestFramework(context) {
  const filename = getFilename(context);
  const sourceCode = context.getSourceCode();
  const text = sourceCode.getText();
  
  // Check imports/requires
  if (/from ['"]@testing-library/.test(text)) {
    return 'testing-library';
  }
  if (/from ['"]@playwright/.test(text)) {
    return 'playwright';
  }
  if (/from ['"]cypress/.test(text)) {
    return 'cypress';
  }
  if (/from ['"]vitest/.test(text)) {
    return 'vitest';
  }
  if (/from ['"]jest/.test(text)) {
    return 'jest';
  }
  
  // Check global usage
  if (/\b(describe|it|expect)\s*\(/.test(text)) {
    if (/\bvi\./.test(text)) return 'vitest';
    if (/\bjest\./.test(text)) return 'jest';
    if (/\bcy\./.test(text)) return 'cypress';
  }
  
  // Check file path
  if (/\/cypress\//i.test(filename)) return 'cypress';
  if (/\/playwright\//i.test(filename)) return 'playwright';
  if (/\.cy\./i.test(filename)) return 'cypress';
  if (/\.spec\./i.test(filename)) return 'jest'; // Default assumption
  
  return null;
}

/**
 * Check if an expression is a promise or async function
 * @param {Object} node - The AST node to check
 * @returns {boolean} Whether the node returns a promise
 */
function isPromise(node) {
  if (!node) return false;
  
  // Async function
  if (node.async) return true;
  
  // Promise constructor
  if (node.type === 'NewExpression' && node.callee.name === 'Promise') {
    return true;
  }
  
  // Method that typically returns promises
  if (node.type !== 'CallExpression') {
    return false;
  }
  
  if (node.callee.type === 'MemberExpression') {
    const method = node.callee.property.name;
    const promiseMethods = [
      'then', 'catch', 'finally',
      'all', 'race', 'allSettled', 'any',
      'resolve', 'reject'
    ];
    if (promiseMethods.includes(method)) {
      return true;
    }
  }
  
  // Common async method patterns
  const calleeText = node.callee.name || '';
  if (/^(fetch|axios|request|get|post|put|delete|patch)/i.test(calleeText)) {
    return true;
  }
  return false;
}

/**
 * Get the indentation string for a node
 * @param {Object} node - The AST node
 * @param {Object} context - The ESLint context
 * @returns {string} The indentation string
 */
function getIndentation(node, context) {
  const sourceCode = context.getSourceCode();
  const token = sourceCode.getFirstToken(node);
  if (!token) {
    return '';
  }

  const line = sourceCode.lines[token.loc.start.line - 1];
  if (!line) {
    return '';
  }

  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Check if a string is likely a URL
 * @param {string} str - The string to check
 * @returns {boolean} Whether the string looks like a URL
 */
function isUrl(str) {
  return /^(https?:\/\/|wss?:\/\/|\/\/)/.test(str);
}

/**
 * Check if a string is a data URL
 * @param {string} str - The string to check
 * @returns {boolean} Whether the string is a data URL
 */
function isDataUrl(str) {
  return /^(data:|blob:|file:)/.test(str);
}

/**
 * Find the nearest enclosing function node (FunctionExpression, ArrowFunctionExpression, or FunctionDeclaration)
 * @param {Object} node - The AST node to start from
 * @returns {Object|null} The enclosing function node, or null if none found
 */
function findEnclosingFunction(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'FunctionExpression' ||
        current.type === 'ArrowFunctionExpression' ||
        current.type === 'FunctionDeclaration') {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Return fixer operations to make the given function node async, if it isn't already.
 * Handles class methods, object method shorthand, and regular functions correctly.
 * @param {Object} fixer - The ESLint fixer object
 * @param {Object|null} funcNode - The function node to make async
 * @returns {Array|null} Array of fixer operations (empty if already async),
 *   or null if the function cannot be made async (getter, setter, constructor)
 */
function ensureAsyncFunction(fixer, funcNode) {
  if (!funcNode || funcNode.async) return [];

  const parent = funcNode.parent;

  // Class method: class A { foo() {} } → class A { async foo() {} }
  // Object method shorthand: { foo() {} } → { async foo() {} }
  if (parent && (parent.type === 'MethodDefinition' || (parent.type === 'Property' && parent.method))) {
    // Getters, setters, and constructors cannot be async — signal callers to skip the fix
    if (parent.kind === 'get' || parent.kind === 'set' || parent.kind === 'constructor') return null;
    // Insert 'async ' before the method key (handles static methods correctly)
    return [fixer.insertTextBefore(parent.key, 'async ')];
  }

  return [fixer.insertTextBefore(funcNode, 'async ')];
}

/**
 * Return fixer operations to add a waitFor import if needed
 * @param {Object} fixer - The ESLint fixer object
 * @param {Object} context - The ESLint rule context
 * @returns {Array|null} Array of fixer operations, empty array if already imported, or null if framework incompatible
 */
// Modules known to export waitFor — only these should be augmented
const WAITFOR_MODULES = new Set([
  '@testing-library/react',
  '@testing-library/dom',
  '@testing-library/vue',
  '@testing-library/angular',
  '@testing-library/svelte',
  '@testing-library/preact',
]);

function addWaitForImport(fixer, context) {
  const framework = getTestFramework(context);
  if (framework === 'playwright' || framework === 'cypress') {
    return null;
  }

  const sourceCode = context.getSourceCode();
  const ast = sourceCode.ast;

  // AST-based check: is waitFor already imported/available?
  if (ast && ast.body) {
    for (const node of ast.body) {
      // import { waitFor } / import waitFor / import { x as waitFor }
      if (node.type === 'ImportDeclaration') {
        if (node.specifiers.some(s => s.local && s.local.name === 'waitFor')) {
          return [];
        }
      }
      // const { waitFor } = require(...) / const waitFor = require(...).waitFor
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (!decl.init) continue;
          const init = decl.init;
          const isRequire = init.type === 'CallExpression' && init.callee && init.callee.name === 'require';
          const isRequireMember = init.type === 'MemberExpression' && init.object &&
            init.object.type === 'CallExpression' && init.object.callee && init.object.callee.name === 'require';
          if (!isRequire && !isRequireMember) continue;
          if (decl.id.type === 'Identifier' && decl.id.name === 'waitFor') return [];
          if (decl.id.type === 'ObjectPattern') {
            if (decl.id.properties.some(p => p.type === 'Property' &&
              ((p.key && p.key.name === 'waitFor') || (p.value && p.value.name === 'waitFor')))) {
              return [];
            }
          }
        }
      }
    }
  }

  // Try to augment an existing @testing-library import that actually exports waitFor
  if (ast && ast.body) {
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration' &&
          node.source && node.source.value &&
          WAITFOR_MODULES.has(node.source.value)) {
        const namedSpecifiers = node.specifiers.filter(s => s.type === 'ImportSpecifier');
        if (namedSpecifiers.length > 0) {
          const lastNamed = namedSpecifiers[namedSpecifiers.length - 1];
          return [fixer.insertTextAfter(lastNamed, ', waitFor')];
        }
        // Namespace/default — add a separate named import on the next line
        return [fixer.insertTextAfter(node, '\nimport { waitFor } from \'' + node.source.value + '\';')];
      }
    }
  }

  // Try to augment an existing @testing-library require that actually exports waitFor
  if (ast && ast.body) {
    for (const node of ast.body) {
      if (node.type === 'VariableDeclaration') {
        for (const decl of node.declarations) {
          if (!decl.init) continue;
          const init = decl.init;
          const isRequire = init.type === 'CallExpression' && init.callee && init.callee.name === 'require';
          if (!isRequire) continue;
          const requireArg = init.arguments && init.arguments[0];
          if (!requireArg || !WAITFOR_MODULES.has(requireArg.value)) continue;
          if (decl.id.type === 'ObjectPattern' && decl.id.properties.length > 0) {
            const lastProp = decl.id.properties[decl.id.properties.length - 1];
            return [fixer.insertTextAfter(lastProp, ', waitFor')];
          }
        }
      }
    }
  }

  // No suitable import/require found — add a new one at the top of the file.
  // Default to @testing-library/react since it's the most common testing-library package.
  // Detect CJS by looking for top-level require() calls; default to ESM otherwise.
  const firstNode = ast && ast.body && ast.body[0];
  if (firstNode) {
    const isCJS = ast.body.some(n =>
      n.type === 'VariableDeclaration' && n.declarations.some(d =>
        d.init && d.init.type === 'CallExpression' && d.init.callee && d.init.callee.name === 'require'
      )
    );
    if (isCJS) {
      return [fixer.insertTextBefore(firstNode, 'const { waitFor } = require(\'@testing-library/react\');\n')];
    }
    return [fixer.insertTextBefore(firstNode, 'import { waitFor } from \'@testing-library/react\';\n')];
  }

  return [];
}

module.exports = {
  isTestFile,
  isInMockContext,
  isInHook,
  isInsideBrowserContext,
  isInDescribe,
  isInTest,
  getTestFramework,
  isPromise,
  getIndentation,
  isUrl,
  isDataUrl,
  getFilename,
  getContainingStatement,
  hasMockingInStatement,
  isMockedInCurrentScope,
  escapeRegex,
  findEnclosingFunction,
  ensureAsyncFunction,
  addWaitForImport
};