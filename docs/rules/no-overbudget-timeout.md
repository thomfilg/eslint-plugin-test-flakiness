# no-overbudget-timeout

Disallow timeout options that exceed the per-category budget

## Rule Details

This rule helps prevent test flakiness by flagging `timeout` options whose resolved value exceeds
a per-category budget. Instead of a single global cap, it enforces separate budgets for
**assertions** (calls rooted in `expect(...)`) and **interactions** (everything else). A timeout
that drifts above the budget is usually a symptom of an underlying flaky wait or race condition;
papering over it with a longer timeout hides the real problem and slows the whole suite down.

The rule only runs inside test files. It inspects `timeout` properties passed as object options to
call expressions and reports when:

- An assertion timeout exceeds `maxTimeoutForAssertions`.
- An interaction timeout exceeds `maxTimeoutForInteractions`.
- A symbolic timeout tier cannot be resolved and `ignoreUnknownTiers` is `false`.

Navigation operations (such as `page.goto`) are exempt by default because they legitimately need
longer timeouts. Symbolic timeout values (e.g. `E2E_TIMEOUT_MS.unreliable`) are resolved through a
configurable `namedTiers` map so that shared timeout constants can be budgeted just like literals.

### Examples of **incorrect** code

```javascript
// Assertion timeout above the 5000ms assertion budget
await expect(page.locator(".status")).toBeVisible({ timeout: 10000 });

// Interaction timeout above the 5000ms interaction budget
await page.click(".submit", { timeout: 8000 });

// Symbolic tier resolved via namedTiers that exceeds the budget
await page.fill("#email", "a@b.com", { timeout: E2E_TIMEOUT_MS.unreliable });
```

### Examples of **correct** code

```javascript
// Within the assertion budget
await expect(page.locator(".status")).toBeVisible({ timeout: 5000 });

// Within the interaction budget
await page.click(".submit", { timeout: 3000 });

// Navigation operations are exempt by default
await page.goto("https://example.com", { timeout: 30000 });

// A symbolic tier that resolves under the budget
await page.fill("#email", "a@b.com", { timeout: E2E_TIMEOUT_MS.reliable });
```

## Options

This rule accepts an options object with the following properties:

### `maxTimeoutForAssertions`

- Type: `number`
- Default: `5000`

The maximum timeout (in milliseconds) allowed for assertion calls rooted in `expect(...)`.

```json
{
  "rules": {
    "test-flakiness/no-overbudget-timeout": [
      "error",
      { "maxTimeoutForAssertions": 3000 }
    ]
  }
}
```

### `maxTimeoutForInteractions`

- Type: `number`
- Default: `5000`

The maximum timeout (in milliseconds) allowed for interaction calls that are not assertions.

```json
{
  "rules": {
    "test-flakiness/no-overbudget-timeout": [
      "error",
      { "maxTimeoutForInteractions": 4000 }
    ]
  }
}
```

### `allowHighTimeoutFor`

- Type: `string[]`
- Default: `["page.goto", "page.reload", "page.waitForNavigation"]`

A list of dotted callee names that are exempt from the budget. Navigation operations are included
by default because they legitimately require longer timeouts. Provide your own list to override the
defaults.

```json
{
  "rules": {
    "test-flakiness/no-overbudget-timeout": [
      "error",
      {
        "allowHighTimeoutFor": [
          "page.goto",
          "page.waitForNavigation",
          "api.poll"
        ]
      }
    ]
  }
}
```

### `namedTiers`

- Type: `object` (string keys mapping to `number` values)
- Default: `{}`

Maps symbolic timeout names to their numeric millisecond values so the rule can budget timeouts
that are expressed as constants instead of literals. The key is the dotted source-text name of the
expression (for example `E2E_TIMEOUT_MS.unreliable`).

```json
{
  "rules": {
    "test-flakiness/no-overbudget-timeout": [
      "error",
      {
        "namedTiers": {
          "E2E_TIMEOUT_MS.reliable": 3000,
          "E2E_TIMEOUT_MS.unreliable": 15000
        }
      }
    ]
  }
}
```

### `ignoreUnknownTiers`

- Type: `boolean`
- Default: `true`

When `true` (the default), a symbolic timeout that cannot be resolved through `namedTiers` is
silently ignored. Set it to `false` to require every symbolic tier to be declared in `namedTiers`;
unresolvable tiers are then reported so timeouts cannot bypass the budget.

```json
{
  "rules": {
    "test-flakiness/no-overbudget-timeout": [
      "error",
      { "ignoreUnknownTiers": false }
    ]
  }
}
```

## When Not To Use It

This rule may not be suitable if:

- Your suite relies on long, intentional timeouts that cannot be expressed through
  `allowHighTimeoutFor` or `namedTiers`.
- You are testing timeout behavior itself.
- You prefer a single global timeout cap rather than separate assertion and interaction budgets.

## Related Rules

- [no-hard-coded-timeout](./no-hard-coded-timeout.md)
- [no-unconditional-wait](./no-unconditional-wait.md)

## Further Reading

- [Playwright - Timeouts](https://playwright.dev/docs/test-timeouts)
- [Testing Library - waitFor](https://testing-library.com/docs/dom-testing-library/api-async/#waitfor)
