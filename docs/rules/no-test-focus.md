# no-test-focus

Prevent focused or skipped tests that can cause incomplete test runs.

## Rule Details

This rule helps prevent accidentally committing focused or skipped tests to your codebase. When tests are focused
(using `.only`, `fit`, `fdescribe`, etc.), only those tests run, potentially hiding failures in other tests. When
tests are skipped (using `.skip`, `xit`, `xdescribe`, etc.), they don't run at all, which can lead to untested code.

## Why This Causes Flakiness

While focused and skipped tests don't directly cause flakiness, they create significant issues:

1. **Hidden Failures**: When `.only` is left in code, other tests don't run, potentially hiding real failures
2. **False Confidence**: CI might pass with focused tests while actual failures exist in skipped tests
3. **Incomplete Coverage**: Skipped tests mean code paths aren't being tested
4. **Inconsistent Results**: Different test runs might have different focus/skip states

## Examples

**Incorrect** (violations):

```javascript
// Focused tests - only these will run
test.only("should work", () => {
  expect(true).toBe(true);
});

it.only("runs exclusively", () => {
  // Other tests won't run
});

describe.only("focused suite", () => {
  // Only tests in this suite will run
});

fit("focused test", () => {
  // Jasmine focused test
});

fdescribe("focused describe", () => {
  // Jasmine focused describe
});

// Skipped tests - these won't run
test.skip("skipped test", () => {
  // This test is skipped
});

it.skip("not running", () => {
  // This won't execute
});

describe.skip("skipped suite", () => {
  // All tests in this suite are skipped
});

// Unconditional .skip - a literal or no argument is not a runtime condition
test.skip(true);
test.skip(false);
test.skip();
test.skip("just a string");

// Constants masquerading as conditions are still unconditional
const alwaysSkip = true;
it.skip(alwaysSkip);

const getFlag = () => true;
it.skip(getFlag()); // resolves to a constant -> blocked

xit("skipped test", () => {
  // Jasmine skipped test
});

xdescribe("skipped describe", () => {
  // Jasmine skipped describe
});

test.todo("implement later");

// Bracket notation (also detected)
test["only"]("focused via bracket", () => {});
describe["skip"]("skipped via bracket", () => {});

// Template literals (also detected)
fit`template literal focused test`;
xdescribe`template literal skipped suite`;
```

**Correct**:

```javascript
// Normal tests that always run
test("should work", () => {
  expect(true).toBe(true);
});

it("runs normally", () => {
  // This test runs with all others
});

describe("normal suite", () => {
  test("nested test", () => {
    // All tests run normally
  });
});

// If you need to temporarily disable a test, use comments
// test('temporarily disabled', () => {
//   // TODO: Fix this test
// });

// Or use conditional logic for environment-specific tests
if (process.env.RUN_SLOW_TESTS) {
  test("slow integration test", () => {
    // Only runs when explicitly enabled
  });
}

// A conditional skip whose argument is a genuine runtime expression is allowed
// ONLY when you opt in with `allowConditionalSkip: true` (see below)
test.skip(isDeployedEnv, "only relevant in deployed environments");
test.skip(process.env.CI === "true");
test.skip(!supportsFeature);
test.skip(getFlag()); // unknown function -> treated as a runtime condition
```

## Conditional skip (opt-in)

By default **every** `.skip` is blocked. If you set `allowConditionalSkip: true`,
the rule allows one exception: a conditional skip whose first argument is a
runtime expression — a variable, property access, comparison, negation, or call
that is resolved at run time:

```javascript
// Allowed ONLY with { "allowConditionalSkip": true } - the skip decision is made at runtime
test.skip(isDeployedEnv, "reason");
test.skip(process.env.CI === "true");
test.skip(!supportsFeature);
```

Everything else is always blocked because it unconditionally disables the test:

- `test.skip(true)` / `test.skip(false)` — a literal is not a condition
- `test.skip()` — no argument at all
- `test.skip("just a string")` — a literal first argument
- `test.skip("name", () => {})` / `it.skip(...)` / `describe.skip(...)` — a
  declared-disabled test or suite
- A first argument that statically resolves to a constant (e.g. `const a = true;
it.skip(a)` or `const getCond = () => true; it.skip(getCond())`)

To remove a declared-disabled test, drop the `.skip` (the auto-fix does this) or
replace it with a real runtime condition.

## Options

```json
{
  "test-flakiness/no-test-focus": [
    "error",
    {
      "allowSkip": false,
      "allowConditionalSkip": false,
      "allowOnly": false,
      "customFocusPatterns": [],
      "customSkipPatterns": []
    }
  ]
}
```

- `allowSkip` (default: `false`): Allow all skip methods like `test.skip`, `xit`
- `allowConditionalSkip` (default: `false`): Allow a conditional skip whose first argument is a runtime expression
  (e.g. `test.skip(isDeployedEnv, reason)`). When `false`, every `.skip` is blocked. Has no additional effect when
  `allowSkip` is `true`
- `allowOnly` (default: `false`): Allow only/focus methods like `test.only`, `fit`
- `customFocusPatterns`: Array of additional function names to treat as focused tests (supports wildcards with `*`)
- `customSkipPatterns`: Array of additional function names to treat as skipped tests (supports wildcards with `*`)

### Example Configuration

```json
{
  "rules": {
    "test-flakiness/no-test-focus": [
      "error",
      {
        "allowSkip": false,
        "allowOnly": false,
        "customFocusPatterns": [
          "ftest", // Exact match
          "focusTest", // Exact match
          "*Only", // Matches testOnly, describeOnly, etc.
          "focus*" // Matches focusTest, focusedDescribe, etc.
        ],
        "customSkipPatterns": [
          "skipTest", // Exact match
          "pendingTest", // Exact match
          "*Skip", // Matches testSkip, describeSkip, etc.
          "skip*" // Matches skipTest, skipDescribe, etc.
        ]
      }
    ]
  }
}
```

## Advanced Detection

This rule detects focused/skipped tests in various formats:

1. **Standard notation**: `test.only()`, `describe.skip()`
2. **Prefixed notation**: `fit()`, `xdescribe()`
3. **Bracket notation**: `test['only']()`, `describe["skip"]()`
4. **Template literals**: `fit\`test\``,`test.only\`test\``
5. **Custom patterns with wildcards**: Configure patterns like `*Only` or `focus*`

## Best Practices

1. **Never commit focused tests**: Use `.only` during development but remove before committing
2. **Remove skipped tests**: Either fix them or delete them instead of keeping skipped tests
3. **Use CI checks**: Ensure this rule runs in CI to catch accidental commits
4. **Use feature flags**: For environment-specific tests, use feature flags instead of skip
5. **Document why**: If you must skip a test temporarily, add a comment explaining why and when it will be fixed

## Auto-fix

This rule provides comprehensive auto-fix support:

- Removes `.only` modifiers (including bracket notation like `test['only']`)
- Removes `.skip` modifiers for the declaration form (`test.skip('name', fn)`); an unconditional `test.skip(true)` /
  `test.skip()` is reported without an auto-fix so the removal stays a manual decision
- Converts `fit` → `it`, `fdescribe` → `describe`
- Converts `xit` → `it`, `xdescribe` → `describe`
- Removes `.todo` modifier
- Auto-fixes custom patterns:
  - Methods ending with `Only` → removes `Only` suffix
  - Methods ending with `Skip` → removes `Skip` suffix
  - Methods starting with `f` (if matches known test method) → removes `f` prefix
  - Methods starting with `x` (if matches known test method) → removes `x` prefix

## When Not To Use It

You might want to disable this rule if:

- You're in a development environment where focused tests are acceptable
- You have a workflow that requires keeping skipped tests as documentation
- You use a custom test runner with different focusing mechanisms

## Related Rules

- [no-test-isolation](./no-test-isolation.md) - Prevent test isolation issues
- [no-conditional-test](./no-conditional-test.md) - Prevent conditional test execution

## Further Reading

- [Jest - Focusing and Skipping Tests](https://jestjs.io/docs/api#testonlyname-fn-timeout)
- [Vitest - Skipping Suites and Tests](https://vitest.dev/guide/filtering.html#skipping-suites-and-tests)
- [Playwright - Test Annotations](https://playwright.dev/docs/test-annotations#focus-a-test)
- [Cypress - Excluding and Including Tests](https://docs.cypress.io/guides/core-concepts/writing-and-organizing-tests#Excluding-and-Including-Tests)
- [Why .only() is Dangerous in CI](https://kentcdodds.com/blog/test-isolation-with-react)
