# listeners.js

Event listeners for browser security, API monitoring, and error capture.

## Overview

Sets up Playwright page event listeners to monitor network activity, capture console errors, block downloads/tabs, and dismiss dialogs. This provides visibility into what the application does during navigation.

## Exports

### `setupDialogHandler(page, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `options.print` (function) — Function to log output

**Behavior:**
- Listens for alert/confirm/prompt dialogs
- Automatically dismisses them
- Logs first 60 characters of message

**Example:**
```javascript
setupDialogHandler(page, { 
  print: msg => console.log(msg) 
});

// When dialog appears:
// ⚠  Dialog dismissed: "Are you sure you want to delete?"
```

**Use Case:** Prevents test halting from unexpected dialogs.

---

### `setupNewTabBlocker(page, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `options.print` (function) — Function to log output

**Behavior:**
- Listens for new page/tab creation
- Automatically closes new tabs
- Logs blocked tab URL

**Example:**
```javascript
⚠  New tab blocked: https://ads.example.com/click
```

**Use Case:** Prevents unexpected link opens from derailing tests.

---

### `setupDownloadBlocker(page, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `options.print` (function) — Function to log output
- `options.log` (array) — Test log array to record events

**Behavior:**
- Listens for file download attempts
- Cancels downloads
- Logs blocked download filename
- Adds entry to test log

**Example:**
```javascript
setupDownloadBlocker(page, { 
  print: msg => console.log(msg),
  log: testLog 
});

// When download triggered:
// ⚠  Download blocked: report.pdf

// Added to log:
// {
//   type: 'console',
//   pass: false,
//   label: 'Unexpected download triggered: report.pdf',
//   status: null,
//   external: false
// }
```

**Use Case:** Prevents files downloaded during testing.

---

### `setupResponseListener(page, baseDomain, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `baseDomain` (string) — App domain (e.g. `'example.com'`)
- `options.log` (array) — Test log array
- `options.seenAPIs` (Set) — Track seen API calls to avoid duplicates

**Behavior:**
- Listens for all network responses
- Filters tracking domains (Google Analytics, etc.)
- Captures XHR/fetch requests:
  - Status < 400 = pass
  - Status ≥ 400 = fail
- Captures 404 resources (images, CSS, JS):
  - Marks external vs internal
- Deduplicates by `{method}:{url}`

**Logged Info:**
```javascript
{
  type: 'api',
  pass: true,
  label: '[GET] https://api.example.com/users',
  status: 200,
  external: false
}
```

**Example:**
```javascript
setupResponseListener(page, 'example.com', {
  log: testLog,
  seenAPIs: new Set()
});

// Captures:
// ✔ [GET] /api/users → 200
// ✘ [POST] /api/create → 500
// ⚠️ Missing resource: /images/logo.png → 404
```

**Filtered Out:**
- Requests to `google-analytics.com`, `hotjar.com`, etc.
- Only first failure of each API logged

**Use Case:** Detects API errors and missing resources.

---

### `setupConsoleListener(page, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `options.log` (array) — Test log array
- `options.seenErrors` (Set) — Track seen errors

**Behavior:**
- Listens for console messages
- Captures `console.error()` calls only
- Normalizes URLs (replaces with `<URL>`) to avoid duplicates
- Deduplicates by normalized message
- Adds entry to test log

**Example:**
```javascript
// In browser console:
console.error('Failed to load from https://cdn.example.com/file.js');

// Logged as:
{
  type: 'console',
  pass: false,
  label: 'Console error: Failed to load from <URL>',
  status: null,
  external: false
}
```

**Normalization:**
```
Original:  "Failed to fetch https://api.example.com/data"
Normalized: "Failed to fetch <URL>"
```

**Use Case:** Captures JavaScript errors on page.

---

### `setupAllListeners(page, baseDomain, options)`

**Parameters:**
- `page` (Playwright Page) — Page instance
- `baseDomain` (string) — App domain
- `options` (object) — Options passed to all handlers

**Behavior:**
Convenience function that calls all listener setup functions:
1. `setupDialogHandler()`
2. `setupNewTabBlocker()`
3. `setupDownloadBlocker()`
4. `setupResponseListener()`
5. `setupConsoleListener()`

**Example:**
```javascript
setupAllListeners(page, 'example.com', {
  print: msg => console.log(msg),
  log: testLog,
  seenAPIs: new Set(),
  seenErrors: new Set()
});
```

---

## Event Summary Table

| Listener | Event | Action | Logged |
|----------|-------|--------|--------|
| Dialog | alert/confirm/prompt | Dismiss | Yes |
| New Tab | window.open() | Close | Yes |
| Download | download | Cancel | Yes (in log) |
| Response | XHR/fetch/image | Capture | Yes (API/resource) |
| Console | console.error() | Capture | Yes (error) |

---

## Test Log Entry Format

All listeners add to log array with this shape:
```javascript
{
  type: 'api' | 'console' | 'image' | 'resource',
  pass: true | false,
  label: string,      // Human-readable description
  status: number | string | null,  // HTTP status or description
  external: boolean   // true if external to base domain
}
```

---

## Usage Example

```javascript
const { setupAllListeners } = require('./listeners');

const page = await context.newPage();
const log = [];
const seenAPIs = new Set();
const seenErrors = new Set();

setupAllListeners(page, 'example.com', {
  print: console.log,
  log,
  seenAPIs,
  seenErrors
});

await page.goto('https://example.com');
// Now all events are automatically captured in 'log'
```

---

## Notes

- Listeners persist for lifetime of page (until browser closes)
- Some events are suppressible (dialogs), others just logged (errors)
- External URL detection uses `baseDomain` parameter
- Set deduplication prevents duplicate log entries
