# auth.js

⚠️ **DEPRECATED** — Replaced by session capture flow

## Overview

Contains legacy automated login code that attempted to find and fill username/password fields. This approach is no longer used due to unreliability and multiple failure modes.

## Why Deprecated?

**Problems with Automated Login:**
1. **Selector Hell** — Different sites use completely different field naming
2. **Multi-factor Auth** — Can't handle SMS codes, authenticators, etc.
3. **JavaScript Forms** — Custom form frameworks defeat simple selectors
4. **Rate Limiting** — Can trigger security blocks on repeated attempts
5. **OAuth/SSO** — Third-party auth flows are impossible to automate
6. **Maintenance Burden** — Every site change broke tests

**Current Approach:**
Manual login via `captureSession()` is more reliable because:
- Browser handles all auth complexity
- Works with any authentication method
- No selector maintenance needed
- Credentials never in code

---

## Replaced By

**New Flow:**
```
First Run:
  captureSession() → User logs in manually → session.json saved

Subsequent Runs:
  runTests() → loads session.json → authenticated tests run
```

---

## Legacy Code Reference

The deprecated functions (commented out) were:
- `smartFill()` — Tried to find username/password fields
- `smartSubmit()` — Tried to find submit button

These used selector chains like:
```javascript
[
  'input[name="UserName"]',
  'input[name="username"]',
  'input[type="text"]',
  'input[placeholder*="user" i]',
  // ... 10+ more selectors
]
```

Even with all these selectors, it failed on:
- Custom web components
- Shadow DOM fields
- Hidden input fields
- Multi-step forms

---

## Lessons Learned

**Rule: Don't Automate Authentication**

Better approaches:
1. ✅ **Manual Capture** (current) — Interactive login once per session
2. ✅ **API Login** — POST to auth endpoint if exposed
3. ✅ **Token Injection** — Inject auth token directly into cookies
4. ❌ **Selector-Based** (old) — Too brittle and unreliable

---

## If You Need Login Help

**For specific apps with APIs:**
Consider direct token injection:
```javascript
// Example: Get token via API, inject into page
const token = await getAuthToken(username, password);
await page.context().addCookies([{
  name: 'auth_token',
  value: token,
  domain: 'example.com',
  path: '/'
}]);
```

**For all other cases:**
Use `captureSession()` — it's simpler and more reliable.

---

## File Kept For Reference

This file is kept in the codebase as:
- Historical record
- Reference for what NOT to do
- Legacy code if someone needs it

If truly unneeded, can be safely deleted.
