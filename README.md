# eslint-plugin-test-flakiness

> ESLint plugin to detect and prevent flaky test patterns

[![npm version](https://img.shields.io/npm/v/eslint-plugin-test-flakiness.svg)](https://www.npmjs.com/package/eslint-plugin-test-flakiness)
[![npm downloads](https://img.shields.io/npm/dt/eslint-plugin-test-flakiness.svg)](https://www.npmjs.com/package/eslint-plugin-test-flakiness)
[![CI Status](https://github.com/tigredonorte/eslint-plugin-test-flakiness/actions/workflows/ci.yml/badge.svg)](https://github.com/tigredonorte/eslint-plugin-test-flakiness/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/codecov/c/github/tigredonorte/eslint-plugin-test-flakiness)](https://codecov.io/gh/tigredonorte/eslint-plugin-test-flakiness)
[![TypeScript](https://img.shields.io/badge/types-included-blue.svg)](https://www.typescriptlang.org/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Catch flaky test patterns before they cause intermittent failures in your CI/CD pipeline. This plugin identifies
common anti-patterns that lead to flaky tests and provides automatic fixes where possible.

**[🚀 Try it live in StackBlitz](https://stackblitz.com/github/tigredonorte/eslint-plugin-test-flakiness/tree/main/playground)**
| **[📦 View on NPM](https://www.npmjs.com/package/eslint-plugin-test-flakiness)**
| **[🎬 See it in action](docs/demo-example.md)**

## Features

- **Comprehensive Detection**: Identifies 15+ types of flaky patterns
- **Auto-fixable**: Many rules include automatic fixes
- **Framework Support**: Works with Jest, Vitest, Testing Library, Playwright, Cypress
- **Risk-based**: Rules categorized by flakiness risk (high/medium/low)
- **Fast**: Runs at lint-time, no runtime overhead
- **Configurable**: Tune rules to match your team's needs

## Compatibility

| Environment          | Version                            | Status             |
| -------------------- | ---------------------------------- | ------------------ |
| **Node.js**          | 14.x, 16.x, 18.x, 20.x, 22.x, 24.x | ✅ Tested in CI    |
| **ESLint**           | 7.x, 8.x, 9.x                      | ✅ Fully supported |
| **TypeScript**       | 4.x, 5.x                           | ✅ Types included  |
| **Package Managers** | npm, yarn, pnpm                    | ✅ All supported   |

## Installation

```bash
npm install --save-dev eslint-plugin-test-flakiness
# or
yarn add -D eslint-plugin-test-flakiness
# or
pnpm add -D eslint-plugin-test-flakiness
```

## Quick Start

**[🚀 Try it live in StackBlitz](https://stackblitz.com/github/tigredonorte/eslint-plugin-test-flakiness/tree/main/playground)**

- See the plugin in action with interactive examples

### Global Installation (No Project Changes)

For projects where adding dev dependencies is not possible, install globally:

```bash
npm install -g --ignore-scripts eslint@9 @typescript-eslint/parser eslint-plugin-test-flakiness
```

**Run with the `lint-flaky` CLI:**

```bash
# Lint all test files with all rules (default severity: warn)
lint-flaky 'tests/**/*.spec.ts'

# Treat violations as errors (non-zero exit code)
lint-flaky --severity error 'app/e2e/specs/**/*.spec.ts'

# Auto-fix where possible
lint-flaky --fix 'tests/**/*.test.ts'

# Use a specific ESLint formatter
lint-flaky --format json 'tests/**/*.spec.ts'

# Show all available rules and options
lint-flaky --help
```

> **How it works:** The `lint-flaky` command is installed automatically during `npm install -g`.
> It runs ESLint 9+ with all flaky-test rules enabled via the Node API.
> No project configuration changes are needed.

### Flat Config (ESLint 9+)

```javascript
// eslint.config.js
import testFlakiness from "eslint-plugin-test-flakiness";

export default [
  {
    plugins: {
      "test-flakiness": testFlakiness,
    },
    rules: {
      // Start with recommended rules
      ...testFlakiness.configs.recommended.rules,

      // Override specific rules as needed
      "test-flakiness/no-hard-coded-timeout": [
        "error",
        {
          maxTimeout: 100, // Allow timeouts under 100ms
        },
      ],

      // Turn off rules that don't apply to your project
      "test-flakiness/no-animation-wait": "off",
    },
  },
];
```

### Legacy Config (.eslintrc)

```json
{
  "plugins": ["test-flakiness"],
  "extends": ["plugin:test-flakiness/recommended"],
  "rules": {
    // Override specific rules
    "test-flakiness/no-hard-coded-timeout": [
      "error",
      {
        "maxTimeout": 100
      }
    ],
    "test-flakiness/no-animation-wait": "off"
  }
}
```

## Adoption Path

Gradual rollout strategy to minimize disruption while improving test quality:

### Week 1: Discovery Phase

- Install the plugin with `recommended` config
- Set all rules to `warn` to identify problem areas
- Run `npx eslint . --ext .test.js,.test.ts > flaky-patterns.txt` to audit your codebase
- Review the results with your team to prioritize fixes

### Week 2: High-Risk Mitigation

- Switch high-risk rules to `error`:
  - `no-hard-coded-timeout`
  - `await-async-events`
  - `no-immediate-assertions`
- Fix or add eslint-disable comments with justification
- Add pre-commit hooks to prevent new violations

### Week 3: CI Integration

- Enable `strict` config for CI/CD pipelines
- Use `--max-warnings 0` for high-risk rules
- Keep medium-risk rules as warnings for gradual improvement
- Track warning counts as technical debt metrics

### Week 4+: Full Adoption

- Gradually convert warnings to errors as fixes are implemented
- Consider custom configurations per test directory
- Document team-specific exceptions in your contributing guide

## Available Configurations

### `recommended`

Balanced configuration for most projects. Enables high-risk rules as errors and medium-risk as warnings.

```json
{
  "extends": ["plugin:test-flakiness/recommended"]
}
```

### `strict`

Zero-tolerance for flaky patterns. All rules enabled as errors.

```json
{
  "extends": ["plugin:test-flakiness/strict"]
}
```

### `all`

Enables all available rules as errors. Use with caution.

```json
{
  "extends": ["plugin:test-flakiness/all"]
}
```

### Configuration Risk Mapping

| Configuration | High Risk Rules | Medium Risk Rules | Low Risk Rules | Special Rules |
| ------------- | --------------- | ----------------- | -------------- | ------------- |
| `recommended` | ❌ Error        | ⚠️ Warning        | 🔕 Off         | ❌ Error      |
| `strict`      | ❌ Error        | ❌ Error          | ⚠️ Warning     | ❌ Error      |
| `all`         | ❌ Error        | ❌ Error          | ❌ Error       | ❌ Error      |

## Rules

### High Risk

Rules that frequently cause test failures in CI/CD environments.

| Rule                                                               | Why it matters                                                                       | Auto-fix | What the fixer does                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | :------: | -------------------------------------------------------------------------------------- |
| [`no-hard-coded-timeout`](docs/rules/no-hard-coded-timeout.md)     | Hard-coded timeouts like `setTimeout(fn, 1000)` are brittle and fail on slow systems |    ✅    | Converts to `waitFor` pattern when safe; suggests manual fix otherwise                 |
| [`await-async-events`](docs/rules/await-async-events.md)           | Missing awaits cause race conditions between actions and assertions                  |    ✅    | Adds `await` keyword to async Testing Library/Playwright/Cypress methods               |
| [`no-immediate-assertions`](docs/rules/no-immediate-assertions.md) | Assertions immediately after state changes miss async updates                        |    ✅    | Wraps assertion in `waitFor` with appropriate timeout                                  |
| [`no-unconditional-wait`](docs/rules/no-unconditional-wait.md)     | Fixed delays don't guarantee operations complete                                     |    ✅    | Replaces with `waitFor` condition check when assertion follows; suggests fix otherwise |
| [`no-promise-race`](docs/rules/no-promise-race.md)                 | Promise.race can produce unpredictable test results                                  |    ❌    | No auto-fix (requires manual refactoring)                                              |
| [`no-cached-api-wait`](docs/rules/no-cached-api-wait.md)           | Waiting on cached GET responses is an unreliable signal vs. the rendered UI          |    ❌    | No auto-fix (assert on the visible UI outcome instead)                                 |

### Medium Risk

Rules that cause intermittent failures or maintenance issues.

| Rule                                                                 | Why it matters                                                     | Auto-fix | What the fixer does                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ | :------: | --------------------------------------------------------- |
| [`no-index-queries`](docs/rules/no-index-queries.md)                 | Index-based queries (`:nth-child`, `[0]`) break when order changes |    ❌    | No auto-fix (requires semantic query refactoring)         |
| [`no-animation-wait`](docs/rules/no-animation-wait.md)               | Animation timing varies across environments                        |    ❌    | No auto-fix (requires animation-specific handling)        |
| [`no-global-state-mutation`](docs/rules/no-global-state-mutation.md) | Global state changes affect other tests                            |    ❌    | No auto-fix (requires architectural changes)              |
| [`no-unmocked-network`](docs/rules/no-unmocked-network.md)           | Network calls fail when services are down                          |    ❌    | No auto-fix (requires mock implementation)                |
| [`no-unmocked-fs`](docs/rules/no-unmocked-fs.md)                     | File system operations are environment-dependent                   |    ❌    | No auto-fix (requires mock implementation)                |
| [`no-database-operations`](docs/rules/no-database-operations.md)     | Database state affects test reliability                            |    ❌    | No auto-fix (requires mock/stub implementation)           |
| [`no-element-removal-check`](docs/rules/no-element-removal-check.md) | Checking element removal is timing-sensitive                       |    ✅    | Converts to `waitForElementToBeRemoved` with proper await |

### Low Risk

Rules that improve test maintainability and reduce edge-case failures.

| Rule                                                           | Why it matters                                     | Auto-fix | What the fixer does                         |
| -------------------------------------------------------------- | -------------------------------------------------- | :------: | ------------------------------------------- |
| [`no-random-data`](docs/rules/no-random-data.md)               | Random data makes tests non-reproducible           |    ❌    | No auto-fix (requires deterministic values) |
| [`no-long-text-match`](docs/rules/no-long-text-match.md)       | Long text matches break with minor content changes |    ❌    | No auto-fix (requires semantic matching)    |
| [`no-viewport-dependent`](docs/rules/no-viewport-dependent.md) | Tests fail on different screen sizes               |    ❌    | No auto-fix (requires responsive design)    |
| [`no-focus-check`](docs/rules/no-focus-check.md)               | Focus behavior varies across browsers              |    ❌    | No auto-fix (requires alternative approach) |

### Special Rules

Development and CI/CD specific rules.

| Rule                                                   | Why it matters                                   | Auto-fix | What the fixer does                       |
| ------------------------------------------------------ | ------------------------------------------------ | :------: | ----------------------------------------- |
| [`no-test-focus`](docs/rules/no-test-focus.md)         | `.only` and `.focus` skip other tests in CI      |    ✅    | Removes `.only` and `.focus` modifiers    |
| [`no-test-isolation`](docs/rules/no-test-isolation.md) | Tests without proper isolation affect each other |    ❌    | No auto-fix (requires test restructuring) |

## Rule Configuration

Each rule can be configured individually:

```javascript
{
  "rules": {
    "test-flakiness/no-hard-coded-timeout": ["error", {
      "maxTimeout": 500,        // Allow timeouts under 500ms
      "allowInSetup": true      // Allow in beforeEach/afterEach
    }],

    "test-flakiness/await-async-events": ["error", {
      "customAsyncMethods": ["myAsyncHelper", "customEvent"]
    }]
  }
}
```

## Examples

### Bad: Hard-coded timeout

```javascript
it("should show notification", async () => {
  showNotification();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect(notification).toBeVisible();
});
```

### Good: Using waitFor

```javascript
it("should show notification", async () => {
  showNotification();
  await waitFor(
    () => {
      expect(notification).toBeVisible();
    },
    { timeout: 2000 },
  );
});
```

### Bad: Missing await

```javascript
it("should update on click", () => {
  userEvent.click(button); // Missing await!
  expect(screen.getByText("Updated")).toBeInTheDocument();
});
```

### Good: Properly awaited

```javascript
it("should update on click", async () => {
  await userEvent.click(button);
  expect(await screen.findByText("Updated")).toBeInTheDocument();
});
```

### Bad: Index-based query

```javascript
const thirdItem = container.querySelectorAll(".item")[2];
const lastButton = screen.getAllByRole("button")[buttons.length - 1];
```

### Good: Specific query

```javascript
const specificItem = screen.getByTestId("item-3");
const submitButton = screen.getByRole("button", { name: /submit/i });
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx eslint . --ext .test.js,.test.ts
```

### Pre-commit Hook

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "eslint --ext .test.js,.test.ts"
    }
  }
}
```

### Custom Script for Analysis

```javascript
// analyze-flakiness.js
const {
  analyzeFileContent,
} = require("eslint-plugin-test-flakiness/lib/analyzer");
const fs = require("fs");

const content = fs.readFileSync("my-test.spec.js", "utf8");
const analysis = analyzeFileContent(content, "my-test.spec.js");

if (analysis.riskLevel === "high") {
  console.error("High flakiness risk detected!");
  process.exit(1);
}
```

## Philosophy

This plugin follows these principles:

1. **Prevention over Detection**: Catch issues at lint-time, not runtime
2. **Actionable Feedback**: Every error includes why it's a problem and how to fix it
3. **Progressive Enhancement**: Start with recommended, move to strict as your tests improve
4. **Framework Agnostic**: Core patterns apply regardless of test framework

## How It Works

The plugin uses AST (Abstract Syntax Tree) analysis to detect patterns that commonly cause test flakiness:

- **Timing Issues**: Hard-coded delays, missing awaits
- **Structural Fragility**: Index-based queries, order dependencies
- **State Management**: Global mutations, missing cleanup
- **Network/IO**: Unmocked external calls
- **Non-determinism**: Random data, time-based logic

## Framework Compatibility

| Rule                       | Jest | Vitest | Testing Library | Playwright | Cypress | Framework-Agnostic |
| -------------------------- | :--: | :----: | :-------------: | :--------: | :-----: | :----------------: |
| `no-hard-coded-timeout`    |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `await-async-events`       |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         -          |
| `no-immediate-assertions`  |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-unconditional-wait`    |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-promise-race`          |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-cached-api-wait`       |  -   |   -    |        -        |     ✅     |   ✅    |         -          |
| `no-index-queries`         |  -   |   -    |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-animation-wait`        |  -   |   -    |       ✅        |     ✅     |   ✅    |         -          |
| `no-global-state-mutation` |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-unmocked-network`      |  ✅  |   ✅   |        -        |     ✅     |   ✅    |         -          |
| `no-unmocked-fs`           |  ✅  |   ✅   |        -        |     -      |    -    |         -          |
| `no-database-operations`   |  ✅  |   ✅   |        -        |     -      |    -    |         -          |
| `no-element-removal-check` |  -   |   -    |       ✅        |     ✅     |   ✅    |         -          |
| `no-random-data`           |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |
| `no-long-text-match`       |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         -          |
| `no-viewport-dependent`    |  -   |   -    |       ✅        |     ✅     |   ✅    |         -          |
| `no-focus-check`           |  -   |   -    |       ✅        |     ✅     |   ✅    |         -          |
| `no-test-focus`            |  ✅  |   ✅   |        -        |     ✅     |   ✅    |         -          |
| `no-test-isolation`        |  ✅  |   ✅   |       ✅        |     ✅     |   ✅    |         ✅         |

**Prerequisites:**

- Testing Library rules require `@testing-library/*` packages
- Playwright rules require `@playwright/test`
- Cypress rules require `cypress` package

## Resources

- [Writing Reliable Tests](https://testing-library.com/docs/guide-disappearance)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Cypress Anti-patterns](https://docs.cypress.io/guides/references/best-practices)

## FAQ

**Q: Is this plugin performance-intensive?**
A: No, it runs during ESLint's normal AST traversal with minimal overhead.

**Q: Can I use this with TypeScript?**
A: Yes! It works with `.ts` and `.tsx` test files automatically.

**Q: Does it work with all test frameworks?**
A: It detects patterns common across frameworks. Some rules are framework-specific but will only activate when
relevant.

**Q: How do I handle false positives?**
A: You can disable rules inline with `// eslint-disable-next-line test-flakiness/rule-name` or configure rules to be
less strict.

### Handling False Positives

For high-risk rules that may trigger false positives, use inline disables with a clear rationale:

```javascript
// ❌ Bad: No explanation
// eslint-disable-next-line test-flakiness/no-hard-coded-timeout
await setTimeout(1000);

// ✅ Good: Clear rationale
// eslint-disable-next-line test-flakiness/no-hard-coded-timeout -- Required for animation completion
await setTimeout(1000);
```

**Allowed Patterns for Common False Positives:**

1. **no-hard-coded-timeout**: Allowed in test setup/teardown when documented
2. **no-unconditional-wait**: Acceptable for rate limiting or animation waits with clear comments
3. **no-index-queries**: OK when testing list ordering specifically
4. **no-random-data**: Fine when testing randomization features themselves

For more details on handling false positives, see our [False Positive Guide](docs/FALSE_POSITIVES.md).

## Who's Using This?

> Is your team using eslint-plugin-test-flakiness?
> [Add your company/project](https://github.com/tigredonorte/eslint-plugin-test-flakiness/edit/main/README.md) to this list!

- **Your Company Here** - [Submit a PR](https://github.com/tigredonorte/eslint-plugin-test-flakiness/pulls) to add
  your logo and testimonial
- Looking for early adopters! Be one of the first to showcase your commitment to test quality

### Success Stories

Share how this plugin helped reduce flaky tests in your project.
[Create an issue](https://github.com/tigredonorte/eslint-plugin-test-flakiness/issues/new) with the `success-story` label.

## Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/tigredonorte/eslint-plugin-test-flakiness/issues).

## License

MIT © [Your Name]

## Contributing

Contributions are welcome! Please read our [contributing guide](docs/CONTRIBUTING.md) for details.

### Development Setup

This project uses **pnpm 10.15.1** for package management. To contribute:

1. Install pnpm: `npm install -g pnpm@10.15.1`
2. Fork and clone the repository
3. Run `pnpm install` to install dependencies
4. Run `pnpm test:watch` for development
5. Run `pnpm lint` before committing

### Additional Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Complete setup for publishing and CI/CD
- [Commit Guidelines](docs/COMMIT_GUIDELINES.md) - Conventional commit format and examples

---

---

Made with care to reduce test flakiness everywhere
