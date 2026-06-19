# no-cached-api-wait

Avoid waiting on cached API/network responses; assert on the visible UI outcome instead.

## Rule Details

Waiting on a GET API/network response is an unreliable test signal:

- A GET response can be served from the browser/HTTP cache, so the wait may resolve before (or without) a real
  network round-trip.
- Response-matcher predicates (e.g. `page.waitForResponse(resp => resp.url().includes('/api'))`) cannot be
  statically narrowed to a mutating method — GET is the implicit default match.
- A resolved response does not mean the UI has rendered the data, so the assertion that follows can still be
  racing the DOM update.

This rule flags waits on cached/GET responses and steers you toward asserting on the visible UI outcome
(the rendered element or text) instead.

The rule only runs on test files (`isTestFile(getFilename(context))`); non-test files are ignored.

### What gets flagged

- Bare `page.waitForResponse(...)` / `waitForResponse(...)` calls (the name is in `helperNames`), because the
  response matcher cannot be narrowed to a non-GET method.
- A configurable custom helper call whose options object has a `method` literal in `flagMethods` (default `GET`,
  case-insensitive), **or** has no `method` property at all (implicit GET default).

### What does NOT get flagged

- Waits whose `method` literal is a mutation not in `flagMethods` (`POST`/`PUT`/`DELETE`/`PATCH`).
- A non-literal `method` value (variable or template literal) that cannot be statically determined — the rule
  stays conservative and does not flag.

## Options

This rule accepts an options object with the following properties:

```json
{
  "test-flakiness/no-cached-api-wait": [
    "error",
    {
      "flagMethods": ["GET"],
      "helperNames": ["waitForApiResponse", "waitForResponse"]
    }
  ]
}
```

### `flagMethods` (default: `["GET"]`)

The HTTP methods (case-insensitive) that should be treated as cacheable/unreliable and therefore flagged. A wait
whose `method` literal is **not** in this list is allowed.

```javascript
// With flagMethods: ["GET", "HEAD"]
await waitForApiResponse({ url: "/api/users", method: "HEAD" }); // flagged

// With flagMethods: ["GET"] (default)
await waitForApiResponse({ url: "/api/users", method: "HEAD" }); // allowed
```

### `helperNames` (default: `["waitForApiResponse", "waitForResponse"]`)

The call names that this rule inspects. Both bare identifiers (`waitForResponse(...)`) and member calls
(`page.waitForResponse(...)`) are matched on the terminal name.

```javascript
// With helperNames: ["waitForXhr"]
await waitForXhr({ url: "/api/users" }); // flagged
await waitForApiResponse({ url: "/api/users" }); // allowed (not in custom list)
```

## Examples

### ❌ Incorrect

```javascript
// Bare page.waitForResponse with a URL matcher (GET is the implicit match)
await page.waitForResponse((resp) => resp.url().includes("/api/users"));

// Bare helper call
await waitForResponse("/api/users");

// Custom helper with an explicit GET method
await waitForApiResponse({ url: "/api/users", method: "GET" });

// Custom helper with no method (implicit GET default)
await waitForApiResponse({ url: "/api/users" });
```

### ✅ Correct

```javascript
// Wait on a mutation response (not cacheable)
await waitForApiResponse({ url: "/api/users", method: "POST" });
await waitForApiResponse({ url: "/api/users", method: "DELETE" });

// Non-literal method that can't be statically determined is left alone
await waitForApiResponse({ url: "/api/users", method: requestMethod });

// Assert on the visible UI outcome instead of the cached response
await page.getByRole("button", { name: "Load users" }).click();
await expect(page.getByTestId("user-list")).toBeVisible();
```

## When Not To Use It

This rule may not be suitable if:

- You are explicitly testing caching/network behavior and need to assert on the response itself.
- Your GET waits are paired with a cache-busting strategy that makes them deterministic.

In these cases, disable the rule inline or scope it via configuration:

```javascript
// eslint-disable-next-line test-flakiness/no-cached-api-wait
await page.waitForResponse((resp) => resp.url().includes("/api/users"));
```

## Related Rules

- [no-unconditional-wait](./no-unconditional-wait.md) - Encourages conditional waiting
- [no-unmocked-network](./no-unmocked-network.md) - Prevents unmocked network calls
- [no-immediate-assertions](./no-immediate-assertions.md) - Prevents timing-dependent assertions

## Further Reading

- [Playwright - Waiting for Elements](https://playwright.dev/docs/actionability)
- [HTTP caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Testing Library - Async Utilities](https://testing-library.com/docs/dom-testing-library/api-async)
