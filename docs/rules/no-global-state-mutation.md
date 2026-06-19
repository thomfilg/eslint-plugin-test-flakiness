# no-global-state-mutation

Prevent global state mutations that can cause test interdependencies.

## Rule Details

Global state mutations in tests can cause tests to depend on each other, leading to flaky behavior:

- Tests may pass when run individually but fail when run together
- Test execution order can affect results
- Parallel test execution can cause race conditions
- State changes in one test can leak into subsequent tests
- Environment variables and global objects can be modified unexpectedly

This rule helps prevent test flakiness by detecting mutations to global state that could affect other tests.

## Options

This rule accepts an options object with the following properties:

```json
{
  "test-flakiness/no-global-state-mutation": [
    "error",
    {
      "allowInHooks": true
    }
  ]
}
```

### `allowInHooks` (default: `true`)

When set to `true`, allows global state mutations in setup and teardown hooks (`beforeEach`, `afterEach`, `beforeAll`, `afterAll`).

```javascript
// With allowInHooks: true (default)
beforeEach(() => {
  window.location.href = "http://localhost"; // Allowed
});

// With allowInHooks: false
beforeEach(() => {
  window.location.href = "http://localhost"; // Not allowed
});
```

## Examples

### Incorrect

```javascript
// Direct global object mutations
window.location.href = "http://example.com";
document.title = "Test Page";
global.fetch = mockFetch;
process.env.NODE_ENV = "test";

// Local/Session storage mutations
localStorage.setItem("token", "fake-token");
sessionStorage.clear();

// Console pollution
console.log("Debug info");
console.error("Test error");

// Navigator modifications
navigator.userAgent = "fake-agent";

// Global variable creation
globalTestVar = "some value"; // Creates global without declaration

// Event listener modifications
window.addEventListener("resize", handler);
document.addEventListener("click", handler);

// Test execution state changes
test.only("should do something", () => {
  // This affects global test execution
});

// Process environment mutations
process.env.API_URL = "http://localhost:3000";
delete process.env.NODE_ENV;

// Document structure changes
document.write("<div>Test content</div>");
document.body.innerHTML = "<p>Test</p>";
```

### Correct

```javascript
// Use proper setup/teardown hooks
beforeEach(() => {
  // Setup is allowed in hooks
  window.location.href = "http://localhost";
  localStorage.setItem("token", "test-token");
});

afterEach(() => {
  // Cleanup in teardown
  localStorage.clear();
  delete window.customProperty;
});

// Use local variables instead
test("should handle data", () => {
  const mockData = { id: 1, name: "test" };
  const result = processData(mockData);
  expect(result).toBe(expected);
});

// Mock globals properly with cleanup
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// Use environment variable mocking with restore
beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

// Use proper test utilities
test("should render correctly", () => {
  render(<Component />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
});

// Use local scope for test data
test("should calculate total", () => {
  const items = [{ price: 10 }, { price: 20 }];
  expect(calculateTotal(items)).toBe(30);
});
```

## Best Practices

### 1. Use Setup and Teardown Hooks

Always use proper setup and teardown hooks for global state changes:

```javascript
describe("Component with global state", () => {
  let originalLocation;

  beforeEach(() => {
    // Store original state
    originalLocation = window.location.href;
    // Set test state
    window.location.href = "http://localhost:3000/test";
  });

  afterEach(() => {
    // Restore original state
    window.location.href = originalLocation;
    // Clear any other changes
    localStorage.clear();
  });

  test("should work with mocked location", () => {
    // Test implementation
  });
});
```

### 2. Mock Globals Properly

Use proper mocking techniques that include cleanup:

```javascript
describe("API tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });
});
```

### 3. Use Test Utilities for Environment Variables

Use testing utilities for environment variable management:

```javascript
// Using jest-environment-node
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.NODE_ENV = "test";
  process.env.API_URL = "http://localhost:3000";
});

afterEach(() => {
  process.env = originalEnv;
});
```

### 4. Prefer Local Test Data

Keep test data local to avoid global state pollution:

```javascript
// Instead of global test data
globalTestData = { users: [...] };

// Use local data in each test
test('should handle users', () => {
  const testData = { users: [{ id: 1, name: 'John' }] };
  const result = processUsers(testData.users);
  expect(result).toEqual(expected);
});
```

### 5. Use Proper DOM Testing

Use testing utilities that handle DOM state properly:

```javascript
// Instead of manipulating document directly
document.body.innerHTML = "<div>test</div>";

// Use testing library utilities
test("should render component", () => {
  render(<Component />);
  expect(screen.getByRole("button")).toBeInTheDocument();
});
```

### 6. Handle Storage APIs Correctly

Mock storage APIs with proper cleanup:

```javascript
beforeEach(() => {
  // Mock localStorage
  const mockStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
  });
});
```

## Framework-Specific Examples

### Jest

```javascript
// ❌ Avoid global mutations
global.API_URL = "http://localhost";

// ✅ Use proper Jest patterns
beforeAll(() => {
  process.env.API_URL = "http://localhost";
});

afterAll(() => {
  delete process.env.API_URL;
});

// ✅ Use Jest's environment variables
// In jest.config.js
module.exports = {
  setupFilesAfterEnv: ["<rootDir>/test-setup.js"],
  testEnvironment: "jsdom",
};
```

### Vitest

```javascript
// ✅ Use Vitest's environment handling
import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

### Cypress

```javascript
// ❌ Avoid global mutations in test files
window.localStorage.setItem("token", "fake");

// ✅ Use Cypress commands and hooks
beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.setItem("token", "fake");
  });
});

// ✅ Use Cypress utilities
cy.clearLocalStorage();
cy.clearCookies();
```

### Playwright

```javascript
// ✅ Use Playwright's context isolation
test("should work with storage", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("token", "fake");
  });

  // Test implementation
});
```

#### Browser-context callbacks are exempt

Callbacks passed to `page.evaluate`, `page.addInitScript`, and
`page.evaluateHandle` run in the **browser context**, not in the Node test
process. Global-state mutations inside them (e.g. `localStorage` cleanup) are
isolated browser-side operations, not Node-side global-state leaks, so the rule
does **not** flag them — no `eslint-disable` comment is needed:

```javascript
// ✅ Not flagged — runs in the browser, not Node
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("my-persist-key");
  });
});

// ✅ Also not flagged — page.evaluate / page.evaluateHandle callbacks
await page.evaluate(() => {
  localStorage.clear();
  delete window.__APP_STATE__;
});
```

> **Note (Cypress):** the `cy.window().then((win) => win.localStorage...)`
> form is out of scope — it mutates `win.localStorage` (a member-object
> reference), not the bare `localStorage` global, so the rule already does not
> flag it.

**Limitations of the exemption:**

- Only **inline** callbacks are exempt. A reference passed by name —
  `page.addInitScript(myNamedFn)` where `myNamedFn` mutates storage — is still
  flagged, because the rule cannot follow the reference to its body.
- The exemption keys off the callback method **name**
  (`evaluate`/`addInitScript`/`evaluateHandle`), not the receiver object, so any
  unrelated `.evaluate(fn)` (e.g. mathjs `math.evaluate(...)`) is also exempted.
  This is a deliberate trade-off that keeps all Playwright receivers
  (`page`/`frame`/`locator`/`elementHandle`) working without hard-coding `page`.

## Common Global Objects to Avoid Mutating

### Process Environment

```javascript
// ❌ Avoid
process.env.NODE_ENV = "production";

// ✅ Better
beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});
```

### Window Object

```javascript
// ❌ Avoid
window.customProperty = "value";

// ✅ Better
beforeEach(() => {
  window.customProperty = "value";
});

afterEach(() => {
  delete window.customProperty;
});
```

### Document

```javascript
// ❌ Avoid
document.title = "Test Page";

// ✅ Better
beforeEach(() => {
  originalTitle = document.title;
  document.title = "Test Page";
});

afterEach(() => {
  document.title = originalTitle;
});
```

## When Not To Use It

This rule may not be suitable if:

- You're testing global state management specifically
- Your application architecture requires global state modifications
- You're testing browser APIs that require global mutations
- You're using test utilities that handle cleanup automatically

In these cases, you can:

```javascript
// Disable for specific lines
// eslint-disable-next-line test-flakiness/no-global-state-mutation
window.customAPI = mockAPI;

// Disable for test files that specifically test global behavior
/* eslint-disable test-flakiness/no-global-state-mutation */
```

## Related Rules

- [no-test-isolation](./no-test-isolation.md) - Prevents test interdependencies
- [no-random-data](./no-random-data.md) - Prevents non-deterministic test data
- [no-unconditional-wait](./no-unconditional-wait.md) - Encourages proper test timing

## Further Reading

- [Jest - Setup and Teardown](https://jestjs.io/docs/setup-teardown)
- [Testing Library - Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Vitest - Mocking](https://vitest.dev/guide/mocking.html)
- [Playwright - Test Isolation](https://playwright.dev/docs/browser-contexts)
- [Clean Code - Test Isolation Principles](https://blog.cleancoder.com/uncle-bob/2017/05/05/TestDefinitions.html)
