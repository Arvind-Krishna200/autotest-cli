# loggers.js

Test result formatting and output generation (JSON and terminal).

## Overview

Formats test results into human-readable terminal output or machine-readable JSON. Provides summary statistics, detailed event logs, and status indicators.

## Exports

### `buildJsonResult(log, testUrl, elapsed, options)`

**Returns:** object

**Parameters:**
- `log` (array) — Test log entries
- `testUrl` (string) — URL that was tested
- `elapsed` (string) — Total time in seconds
- `options` (object)
  - `quick` (boolean) — Quick mode flag
  - `browser` (string) — Browser used

**Output:**
```json
{
  "meta": {
    "url": "https://example.com",
    "timestamp": "2026-03-27T20:09:57.000Z",
    "duration": 6.3,
    "mode": "quick",
    "browser": "chrome"
  },
  "summary": {
    "total": 36,
    "passed": 26,
    "failed": 1,
    "externalWarnings": 9,
    "status": "FAIL"
  },
  "breakdown": {
    "login": { "pass": 0, "fail": 0 },
    "page": { "pass": 1, "fail": 0 },
    "nav": { "pass": 2, "fail": 1 },
    "subnav": { "pass": 0, "fail": 0 },
    "api": { "pass": 24, "fail": 0 },
    "image": { "pass": 0, "fail": 9 },
    "resource": { "pass": 0, "fail": 0 },
    "console": { "pass": 0, "fail": 0 }
  },
  "events": [
    { "type": "page", "pass": true, "label": "Page Load → https://example.com", "status": 200, "external": false },
    // ... more events
  ]
}
```

**Status Logic:**
- Status: `'PASS'` if no internal failures
- Status: `'FAIL'` if any internal failures exist
- External warnings don't affect status

**Breakdown:** Counts pass/fail for each event type

**Use Case:** CI/CD integration, API responses, automated result parsing.

---

### `printLog(log, testUrl, elapsed, options)`

**Returns:** void (logs to console)

**Parameters:**
- `log` (array) — Test log entries
- `testUrl` (string) — URL tested
- `elapsed` (string) — Runtime in seconds
- `options` (object)
  - `quick` (boolean) — Quick vs deep mode
  - `onlyFailures` (boolean) — Show only failures
  - `json` (boolean) — Already handled elsewhere

**Output Format:**

```
─────────────────────────────────────────────────────────────
  🤖 AUTOTEST SESSION LOG
  URL     : https://example.com
  Date    : 3/27/2026, 8:09:57 PM
  Time    : 6.3s
  Mode    : ⚡ Quick
  Browser : chrome
─────────────────────────────────────────────────────────────

  ✔  🌐  Page Load → https://example.com → 200
  ✔  📡  [GET] https://api.example.com/users → 200
  ✘  🧭  Nav → Sign in → "Sign in" → redirected to login
  ⚠  🖼️   Broken image:  → 404 [external]

─────────────────────────────────────────────────────────────
  Summary : 26 OK / 1 FAILED / 9 external warnings / 36 total events
  Time    : 6.3s
  Status  :  1 ISSUE(S) FOUND ✗ 
─────────────────────────────────────────────────────────────
```

### Color Coding:
- ✔ 🟢 Green — Passed checks
- ✘ 🔴 Red — Internal failures
- ⚠ 🟡 Yellow — External warnings or issues
- [external] — Tag for external domain results

### Filtering:
If `onlyFailures: true`, only failed entries shown:
```
If all passed:
  ✔  All checks passed — no failures found!
```

**Use Case:** Human review, progress monitoring, status verification.

---

## Data Flow

```
Test Run
  ↓
Page Events → log array populated
  ↓
finish() called
  ↓
If JSON mode:
  buildJsonResult() → console.log(JSON.stringify(...))
Else:
  printLog() → formatted console output
```

---

## Log Entry Shape

Each entry in `log` array:
```javascript
{
  type: 'page' | 'nav' | 'subnav' | 'api' | 'image' | 'resource' | 'console' | 'login',
  pass: boolean,
  label: string,         // Human-readable
  status: number | string | null,  // HTTP status or description
  external: boolean      // Internal vs external domain
}
```

---

## Summary Calculations

```javascript
// Count passes
const passed = log.filter(l => l.pass).length;

// Count internal failures (failures on your domain)
const internalFails = log.filter(l => !l.pass && !l.external).length;

// Count external warnings (failures on external domains)
const externalFails = log.filter(l => !l.pass && l.external).length;

// Overall status
const status = internalFails === 0 ? 'PASS' : 'FAIL';
```

---

## Breakdown by Type

For each event type ('page', 'nav', 'api', etc.):
```javascript
const entries = log.filter(l => l.type === 'api');
breakdown.api = {
  pass: entries.filter(l => l.pass).length,
  fail: entries.filter(l => !l.pass).length
}
```

---

## Icon Mapping (from constants.js)

| Type | Icon |
|------|------|
| login | 🔐 |
| page | 🌐 |
| nav | 🧭 |
| subnav | ↳ |
| api | 📡 |
| image | 🖼️ |
| resource | 📦 |
| console | ⚠️ |

---

## Usage Examples

### Get JSON Results
```javascript
const { buildJsonResult } = require('./loggers');

const json = buildJsonResult(log, url, '6.3', { 
  quick: true, 
  browser: 'chrome' 
});

console.log(JSON.stringify(json, null, 2));
// Output: Valid JSON for API consumption
```

### Print Terminal Report
```javascript
const { printLog } = require('./loggers');

printLog(log, url, '6.3', { 
  quick: true,
  onlyFailures: false,
  browser: 'chrome'
});
// Output: Colorful human-readable report
```

### Filter Failures Only
```javascript
printLog(log, url, '6.3', { 
  onlyFailures: true  // ← Shows only failures
});
```

---

## Integration in runner.js

```javascript
async function finish() {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (isJson) {
    // Machine output
    process.stdout.write(
      JSON.stringify(buildJsonResult(log, testUrl, elapsed, options), null, 2)
    );
  } else {
    // Human output
    printLog(log, testUrl, elapsed, options);
  }
}
```
