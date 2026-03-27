# validators.js

Security and state validation helpers for safe test execution.

## Overview

Provides validation functions to determine when elements are safe to click, check browser session status, detect login redirects, and identify external URLs.

## Exports

### `isDangerous(text)`

**Returns:** boolean

**Parameters:**
- `text` (string) — Element text label to check

**Behavior:**
- Checks against `BLOCKED_TEXTS` from constants
- Case-insensitive comparison
- Matches exact text OR text that starts with blocked phrase
- Returns `true` if dangerous

**Examples:**
```javascript
isDangerous('Delete Account')       // → true
isDangerous('delete')               // → true
isDangerous('delete this file')     // → true (starts with 'delete')
isDangerous('Export Data')          // → false
```

**Use Case:** Prevents accidental clicks on destructive actions (delete, logout, etc.)

---

### `isPageAlive(page)`

**Returns:** Promise<boolean>

**Parameters:**
- `page` (Playwright Page) — Current page instance

**Behavior:**
- Attempts to get page title
- Returns `true` if page is accessible
- Returns `false` if page context lost or crashed
- No error thrown

**Examples:**
```javascript
if (await isPageAlive(page)) {
  await page.click('button');
} else {
  console.log('Page crashed, skipping');
}
```

**Use Case:** Detects if page context is still alive before further interactions.

---

### `isLoginPage(url)`

**Returns:** boolean

**Parameters:**
- `url` (string) — Full page URL

**Behavior:**
- Case-insensitive URL check
- Returns `true` if URL contains `'login'` or `'signin'`
- Simple substring match

**Examples:**
```javascript
isLoginPage('https://example.com/login')           // → true
isLoginPage('https://example.com/sign-in')         // → true
isLoginPage('https://example.com/dashboard')       // → false
isLoginPage('https://example.com/login-help')      // → true
```

**Use Case:** Detects unexpected redirects to login page (session expiration).

---

### `isExternalUrl(url, baseDomain)`

**Returns:** boolean

**Parameters:**
- `url` (string) — Full URL to check
- `baseDomain` (string) — Base domain (e.g. `'example.com'`)

**Behavior:**
- Returns `true` if URL is external to base domain
- Excludes special URLs: `about:`, `data:`, `blob:` protocols
- Case-sensitive domain matching

**Examples:**
```javascript
isExternalUrl('https://example.com/page', 'example.com')
// → false (same domain)

isExternalUrl('https://google.com/search', 'example.com')
// → true (different domain)

isExternalUrl('about:blank', 'example.com')
// → false (special protocol, not external)

isExternalUrl('blob:https://example.com/123', 'example.com')
// → false (blob protocol, treated as internal)
```

**Use Case:** Identifies unintended external redirects during navigation testing.

---

## Summary Table

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `isDangerous()` | Text | boolean | Block destructive clicks |
| `isPageAlive()` | Page | Promise<boolean> | Check page context |
| `isLoginPage()` | URL | boolean | Detect logout/session loss |
| `isExternalUrl()` | URL, Domain | boolean | Detect external redirects |

---

## Common Patterns

**Safe Click Pattern:**
```javascript
if (!isDangerous(buttonText) && await isPageAlive(page)) {
  await safeClick(page, buttonText);
}
```

**Session Validation Pattern:**
```javascript
if (isLoginPage(currentUrl)) {
  console.log('Session expired!');
  // Trigger re-login
}
```

**Navigation Pattern:**
```javascript
if (!isExternalUrl(newUrl, baseDomain)) {
  log.push({ type: 'nav', pass: true });
} else {
  log.push({ type: 'nav', pass: false, reason: 'external redirect' });
}
```
