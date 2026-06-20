# no-fragile-locators

Flag fragile Playwright locators (e.g. `getByText`, ambiguous `getByRole`) when they drive an interaction
or wait in E2E spec files.

This rule is **not enabled** in the `recommended` or `strict` configs. It encodes a stricter, opinionated
stance than community defaults and must be opted into explicitly.

## Rule Details

In Playwright E2E specs, fragile locators break when DOM structure, copy text, or ARIA roles change — and,
more importantly for flakiness, they **race** when used to drive interactions. `data-testid` selectors are
deterministic and immune to these issues.

The key insight is that flakiness lives in **actions**, not **assertions**:

- A fragile locator in an **assertion** (`expect(...)`) that is wrong fails loudly and deterministically —
  it is not flaky.
- A fragile locator driving an **interaction or wait** (`.click()`, `.fill()`, `.waitFor()`, `.hover()`, …)
  races against DOM/copy/role changes and ambiguous matches — this is what flakes.

So this rule targets fragile locators in **action/wait position** and leaves **assertion position**
unrestricted. This keeps the readable, accessibility-aligned assertions that Playwright and Testing Library
encourage, while forcing the lines that actually flake onto stable hooks.

### What counts as "fragile"

- `getByText` — copy-coupled, always treated as fragile.
- `getByRole` **without a `{ name }` option** — ambiguous matches cause strict-mode races.
  `getByRole(role, { name })` is **not** flagged by default.
- `getByLabel` is **not** flagged by default (stable for form fields).

### What counts as an "action/wait"

A fragile locator is flagged only when it is the receiver of one of these methods:
`click`, `dblclick`, `fill`, `type`, `press`, `check`, `uncheck`, `selectOption`, `setInputFiles`, `hover`,
`focus`, `dragTo`, `tap`, `waitFor`.

### Scope

The rule applies only to E2E spec files (default `*.spec.ts`). It never applies to unit/component tests,
where `getByRole` is the recommended primary locator.

## Examples

### Incorrect

```ts
// fragile locator drives an interaction (races on copy/role/DOM change)
await page.getByText("Add field").click();

// getByRole without a {name} option is ambiguous in action position
await page.getByRole("button").click();

// applies to all action/wait methods
await page.getByText("x").fill("y");
await page.getByText("x").waitFor();

// stored-variable chains are resolved too
const target = page.getByText("Add field");
await target.click();
```

### Correct

```ts
// stable locator drives the interaction
await page.getByTestId("add-field-btn").click();
await page.getByPlaceholder("Search").fill("hello");

// getByRole with a {name} option is disambiguated
await page.getByRole("button", { name: "Save" }).click();

// getByLabel is stable for form fields
await page.getByLabel("Email").fill("a@b.com");

// fragile locator only asserts — deterministic failure, not flaky
await expect(page.getByText("Field added")).toBeVisible();
await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
```

## Options

This rule accepts an options object with the following properties:

```json
{
  "test-flakiness/no-fragile-locators": [
    "warn",
    {
      "fragile": ["getByText"],
      "actionMethods": [
        "click",
        "dblclick",
        "fill",
        "type",
        "press",
        "check",
        "uncheck",
        "selectOption",
        "setInputFiles",
        "hover",
        "focus",
        "dragTo",
        "tap",
        "waitFor"
      ],
      "stable": ["getByTestId", "getByPlaceholder"],
      "flagRoleWithoutName": true,
      "filePattern": "*.spec.ts"
    }
  ]
}
```

| Option                | Type       | Default                               | Description                                                                          |
| --------------------- | ---------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `fragile`             | `string[]` | `["getByText"]`                       | Locator factories treated as fragile when in action position.                        |
| `actionMethods`       | `string[]` | (list above)                          | Methods whose receiver is checked for a fragile locator.                             |
| `stable`              | `string[]` | `["getByTestId", "getByPlaceholder"]` | Locators considered safe — never flagged.                                            |
| `flagRoleWithoutName` | `boolean`  | `true`                                | Also flag `getByRole(...)` used in action position when it has no `{ name }` option. |
| `filePattern`         | `string`   | `"*.spec.ts"`                         | Only apply to files whose basename matches this glob (E2E spec files).               |

## When Not To Use It

- You do not write Playwright E2E specs, or your project standard is to drive interactions off user-facing
  locators rather than `data-testid`.
- Your team intentionally follows the Playwright/Testing Library default priority that ranks
  `getByRole`/`getByText` above `getByTestId` even for actions.
- You rely on a different file-naming convention for E2E specs and do not want to configure `filePattern`.

For one-off exceptions, disable the rule inline:

```ts
// eslint-disable-next-line test-flakiness/no-fragile-locators
await page.getByText("Add field").click();
```

## Related Rules

- [no-index-queries](./no-index-queries.md) - Prevents fragile index-based (`.nth()`/`.eq()`) locator selection.
- [no-long-text-match](./no-long-text-match.md) - Encourages partial text matching over brittle full-string matches.

## Further Reading

- [Playwright - Locators](https://playwright.dev/docs/locators)
- [Playwright - Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library - Priority](https://testing-library.com/docs/queries/about#priority)
