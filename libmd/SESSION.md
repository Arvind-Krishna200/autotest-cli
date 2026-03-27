# session.js

Session management - cookie persistence and authentication state validation.

## Overview

Handles saving and validating Playwright browser context storage state (cookies, localStorage, sessionStorage) to enable authenticated test runs without requiring login each time.

## Exports

### `getSessionPath()`

**Returns:** string — Full path to session file

**Behavior:**
- Returns: `{cwd}/.autotest/session.json`
- Uses `process.cwd()` for working directory
- Path does not need to exist yet

**Example:**
```javascript
const path = getSessionPath();
// → '/Users/ahamed-14827/testingtool/autotest-cli/.autotest/session.json'
```

**Use Case:** Consistent session file location across runs.

---

### `sessionExists()`

**Returns:** boolean

**Behavior:**
- Checks if session file exists and is readable
- Uses `fs.existsSync()`
- Returns immediately

**Example:**
```javascript
if (sessionExists()) {
  console.log('Session found, reusing...');
} else {
  console.log('No session, capturing new one...');
  await captureSession(url);
}
```

**Use Case:** Determines if new login capture is needed.

---

### `isSessionValid(browser, url)`

**Returns:** Promise<boolean>

**Parameters:**
- `browser` (Playwright Browser) — Browser instance
- `url` (string) — URL to validate against

**Behavior:**

1. Creates browser context with saved session storage
2. Loads the target URL with 10s timeout
3. Checks if page redirected to login page
4. Closes context
5. Returns `true` only if session is still valid

**Example:**
```javascript
const valid = await isSessionValid(browser, 'https://example.com');
if (!valid) {
  console.log('Session expired, need re-login');
  await captureSession(url);
}
```

**What is Validated:**
- ✅ Session cookies still present
- ✅ Page loads without redirect
- ✅ Not redirected to login page
- ✅ URL does not contain 'login' or 'signin'

**What is NOT Validated:**
- ❌ API permissions (endpoint-level auth)
- ❌ Session expiry time
- ❌ User permissions/roles

---

## Session File Format

Created by `capture.js` using `context.storageState()`:

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123...",
      "domain": "example.com",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true
    }
  ],
  "origins": [
    {
      "origin": "https://example.com",
      "localStorage": [
        {
          "name": "auth_token",
          "value": "xyz789..."
        }
      ],
      "sessionStorage": []
    }
  ]
}
```

---

## Workflow

### First Run (No Session)
```
runTests() 
  → sessionExists() returns false
  → captureSession() opens browser for manual login
  → Saves session.json
  → Recursively calls runTests() again
  → Now sessionExists() returns true
```

### Subsequent Runs (Session Exists)
```
runTests()
  → sessionExists() returns true
  → isSessionValid() checks if still logged in
    → If valid: continues with tests
    → If invalid: calls captureSession() → re-runs tests
```

---

## Error Handling

**Navigation Error:**
```javascript
// If page.goto() throws error:
catch (e) {
  await context.close();
  return false;  // Treat as invalid session
}
```

**Context Creation Error:**
- Thrown immediately (not caught)
- Usually means corrupt session file

---

## Usage Example

```javascript
const { sessionExists, isSessionValid, getSessionPath } = require('./session');

async function runTests(url, browser) {
  if (!sessionExists()) {
    await captureSession(url);
    return runTests(url, browser);
  }

  const valid = await isSessionValid(browser, url);
  if (!valid) {
    await captureSession(url);
    return runTests(url, browser);
  }

  // Now authenticated, run tests
  const context = await browser.newContext({ 
    storageState: getSessionPath() 
  });
  // ...
}
```

---

## Dependencies

- `fs` — Check file existence
- `path` — Build file paths
- `./validators` — `isLoginPage()` to detect redirects
