# capture.js

Session capture - interactive login flow with cookie/storage persistence.

## Overview

Opens a browser window where user manually logs in, then captures the resulting authentication cookies and localStorage to enable automated test runs without requiring credentials in code.

## Exports

### `captureSession(url)`

**Returns:** Promise<string> — Path to saved session file

**Parameters:**
- `url` (string) — Application URL to open

**Behavior:**

1. **Create Directory**
   - Creates `.autotest/` directory in cwd if missing

2. **Launch Browser**
   - Opens browser window (not headless)
   - Maximized to full screen
   - Non-headless = user can interact

3. **Navigate & Wait**
   - Loads target URL
   - Displays instructions:
     ```
     🌐 Opening browser for: https://example.com
     ────────────────────────────
     👆 Login in the browser window that opens.
     ✅ Come back here and press Enter when done...
     ```
   - Blocks in terminal waiting for Enter key

4. **Capture Storage State**
   - Gets context storage state (cookies, localStorage, sessionStorage)
   - Saves to `.autotest/session.json`
   - Displays capture summary:
     ```
     ✅ Session captured!
     📁 Saved to: .autotest/session.json
     🍪 Cookies : 5
     💾 Origins : 2
     ```

5. **Close Browser**
   - Closes browser window
   - Keeps session.json for future runs

---

## Example Usage

```javascript
const { captureSession } = require('./capture');

// Manual login flow
await captureSession('https://example.com');

// Browser opens, user logs in, presses Enter
// → session.json saved with auth cookies

// Later:
const { runTests } = require('./runner');
await runTests('https://example.com', options);
// Uses saved session, no login needed
```

---

## Saved Session Format

```json
{
  "cookies": [
    {
      "name": "auth_session",
      "value": "eyJhbGc...",
      "domain": ".example.com",
      "path": "/",
      "expires": 1704067200,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://example.com",
      "localStorage": [
        {
          "name": "user_id",
          "value": "12345"
        }
      ],
      "sessionStorage": []
    }
  ]
}
```

---

## Why Manual Capture?

**Security:** 
- Credentials never in code
- No password storage
- Uses browser's native auth mechanisms (2FA, OAuth, etc.)

**Flexibility:**
- Supports any authentication method
- Works with JavaScript-based login flows
- Handles multi-step auth

**Reliability:**
- Browser automation handles all auth nuances
- No need to reverse-engineer login APIs

---

## Workflow Integration

```
First run of runTests():
  ├─ sessionExists() → false
  ├─ User sees message: "A browser will open — please login"
  ├─ captureSession() opens browser
  ├─ User logs in manually, presses Enter
  ├─ session.json saved
  └─ runTests() called recursively with session
      └─ All subsequent runs use saved session
```

---

## Dependencies

- Playwright chromium
- `fs`, `path` — File operations
- `readline` — Terminal input (waiting for Enter)

---

## Related Functions

- `session.sessionExists()` — Check if session file exists
- `session.isSessionValid()` — Validate session still works
- `session.getSessionPath()` — Get path to session file
