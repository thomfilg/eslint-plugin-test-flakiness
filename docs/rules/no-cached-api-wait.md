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

- **Opaque response matchers** — any call (for a name in `helperNames`) whose argument is a **predicate
  function**, e.g. `waitForResponse(resp => resp.url().includes('/api'))`. The matcher has no method filter, so a
  cache-served GET can satisfy it. This is detected by shape, so it also applies to custom `helperNames`.
- The built-in `waitForResponse` / `page.waitForResponse` is additionally flagged when called with a **URL string
  or RegExp** (e.g. `waitForResponse('/api/users')`) — also a matcher with no method filter. (This URL-string form
  is keyed to the built-in name; see the note under [`helperNames`](#helpernames-default-waitforapiresponse-waitforresponse).)
- A custom helper call with an **inline options object** whose `method` literal is in `flagMethods` (default
  `GET`, case-insensitive), **or** that omits `method` entirely (implicit GET default).
- A custom helper with the HTTP method passed **positionally** as a string literal that is in `flagMethods`
  (e.g. `waitForApiResponse('/api/users', 'GET')`).

The report message names the matched method (e.g. `GET`, or `HEAD` under a custom `flagMethods`).

### What does NOT get flagged

- Waits whose method is a mutation not in `flagMethods` (`POST`/`PUT`/`DELETE`/`PATCH`), whether the method is in
  an options object or passed positionally.
- A non-literal `method` value (variable or template literal) that cannot be statically determined — the rule
  stays conservative and does not flag.
- A custom helper whose options are **not an inline object literal** — passed via a variable
  (`waitForApiResponse(opts)`) or as only a URL string (`waitForApiResponse('/api/users')`) — because the method
  cannot be statically inspected. (The built-in `waitForResponse` is the exception above: a bare URL-string
  matcher is flagged since it carries no method filter.)

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

> **Note — opaque-matcher coupling:** predicate-style matchers (a function argument) are flagged for **any** name
> in `helperNames`. The extra URL-string matcher form (`waitForResponse('/api/users')`) is keyed specifically to
> the built-in name `waitForResponse`. If you replace the defaults (e.g. `helperNames: ["awaitResponse"]`), a
> predicate call like `awaitResponse(resp => …)` is still flagged, but a bare URL-string call
> `awaitResponse('/api/users')` is treated as a custom helper (no inline options → not flagged).

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

// Method passed positionally as a mutation literal is allowed
await waitForApiResponse("/api/users", "POST");

// Custom helper whose options are not an inline object literal can't be
// inspected, so the rule stays conservative and does not flag
await waitForApiResponse(requestOptions);
await waitForApiResponse("/api/users");

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
