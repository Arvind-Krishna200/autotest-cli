# runner.js

Main test orchestrator - coordinates all test components.

## Overview

The core entry point that orchestrates browser launch, session management, event listeners, page scanning, and result generation. Acts as the state machine for the entire test run.

## Exports

### `runTests(url, options)`

**Returns:** Promise<void> (outputs results to stdout)

**Parameters:**
- `url` (string) — URL to test
- `options` (object)
  - `json` (boolean) — JSON output mode
  - `quick` (boolean) — Quick vs deep navigation testing
  - `browser` (string) — Browser to use ('chrome', 'firefox', 'safari')
  - `onlyFailures` (boolean) — Filter report to failures only

**Example:**
```javascript
const { runTests } = require('./runner');

await runTests('https://example.com', {
  json: false,
  quick: true,
  browser: 'chrome',
  onlyFailures: false
});
```

---

## Execution Flow

```
runTests(url, options)
  ↓
1. Initialize (logging setup, spinner)
  ↓
2. Launch Browser
   └─ launchBrowser(browserName)
  ↓
3. Session Management
   ├─ sessionExists()
   │  ├─ NO  → captureSession() → recursively call runTests()
   │  └─ YES → isSessionValid()
   │           ├─ INVALID → captureSession() → recursively call runTests()
   │           └─ VALID → continue
  ↓
4. Setup Page Context & Listeners
   ├─ browser.newContext({ storageState })
   ├─ context.newPage()
   └─ setupAllListeners(page, baseDomain, { log, seenAPIs, seenErrors })
  ↓
5. Page Load
   ├─ page.goto(testUrl)
   ├─ Check status code
   ├─ Check for login redirect
   └─ Log page load result
  ↓
6. Asset Scanning
   └─ getBrokenImages(page) → add to log
  ↓
7. Navigation Testing
   └─ testNavigation(page, testUrl, baseDomain, log, options)
      ├─ Main menu items (always)
      └─ Sub-menu items (if not quick mode)
  ↓
8. Output Results
   ├─ If JSON: buildJsonResult() → stdout
   └─ If Console: printLog() → formatted output
  ↓
Cleanup (browser.close())
```

---

## Key Phases

### Phase 1: Initialization

```javascript
const startTime = Date.now();
const isJson = options.json || false;

const print = msg => { if (!isJson) console.log(msg); };
const status = msg => { if (isJson) process.stderr.write(msg + '\n'); };

const spinner = isJson ? {...} : ora('Launching browser...').start();
```

**Output:**
- Terminal: Shows spinner during browser launch
- JSON: Silent (stderr only for status)

---

### Phase 2: Browser & Session

```javascript
const browser = await launchBrowser(options.browser, options);

if (!sessionExists()) {
  await captureSession(url);
  return await runTests(url, options);  // Recursive
}

const valid = await isSessionValid(browser, url);
if (!valid) {
  await captureSession(url);
  return await runTests(url, options);  // Recursive
}
```

**Recursion Pattern:**
- First run without session → captures → runs again with session
- Invalid session → captures new → runs again
- Ensures tests always run authenticated

---

### Phase 3: Event Listeners

```javascript
const log = [];
const seenAPIs = new Set();
const seenErrors = new Set();

const sessionPath = require('./session').getSessionPath();
const context = await browser.newContext({ storageState: sessionPath });
const page = await context.newPage();

setupAllListeners(page, baseDomain, {
  print,
  log,
  seenAPIs,
  seenErrors,
});
```

**Listeners Track:**
- 📡 API requests (XHR, fetch)
- 🖼️ Broken images
- ⚠️ Console errors
- 🚫 Dialogs, downloads, new tabs

---

### Phase 4: Page Load & Assets

```javascript
try {
  const response = await page.goto(testUrl, {
    waitUntil: 'domcontentloaded',
  });
  const pageStatus = response?.status() || 200;

  if (isLoginPage(page.url())) {
    log.push({ type: 'console', pass: false, label: 'Redirected to login', ... });
    return await finish();
  }

  log.push({ type: 'page', pass: pageStatus < 400, label: '...', status: pageStatus, ... });
} catch (e) {
  log.push({ type: 'page', pass: false, label: `Load failed: ${e.message}`, ... });
}

const brokenImages = await getBrokenImages(page, baseDomain);
log.push(...brokenImages);
```

**Exit Conditions:**
- 404 on main page → log, finish
- Redirected to login → log, finish (no retry)
- Valid page → continue to navigation

---

### Phase 5: Navigation Testing

```javascript
await testNavigation(page, testUrl, baseDomain, log, {
  ...options,
  print,
  status,
});
```

**Handles:**
- ⚡ Quick mode: main items only
- 🔬 Deep mode: main + sub items
- Navigation success/failure with headings
- External redirects
- Login redirects

---

### Phase 6: Output & Cleanup

```javascript
async function finish() {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (isJson) {
    process.stdout.write(
      JSON.stringify(buildJsonResult(log, testUrl, elapsed, options), null, 2)
    );
  } else {
    printLog(log, testUrl, elapsed, options);
  }
  
  await browser.close();
}
```

---

## State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `log` | Array | All test events |
| `seenAPIs` | Set | Deduplicate API calls |
| `seenErrors` | Set | Deduplicate console errors |
| `baseDomain` | String | Extracted from URL |
| `startTime` | Number | Timer for elapsed time |

---

## Error Handling

**Uncaught Errors:**
- Browser won't launch → error in CLI
- Session capture user cancels → error in CLI
- Page goto timeout → logged as page load failure (continues)

**Logged Errors:**
- Page load 404 → logged, tests continue
- API 500 → logged, tests continue
- Login redirect → logged, tests stop for this item
- Console errors → logged, tests continue

---

## Output Modes

### Console Mode (Human-Readable)
```
─────────────────────────────────────────────────────────────
  🤖 AUTOTEST SESSION LOG
  URL     : https://example.com
  [detailed colorful output]
─────────────────────────────────────────────────────────────
```

### JSON Mode (Machine-Readable)
```json
{
  "meta": {...},
  "summary": {...},
  "breakdown": {...},
  "events": [...]
}
```

---

## Common Option Combinations

### Basic Test
```javascript
await runTests('https://example.com', {
  quick: true,
  browser: 'chrome'
});
```

### Deep Testing
```javascript
await runTests('https://example.com', {
  quick: false,
  browser: 'firefox'
});
```

### CI/CD Integration
```javascript
await runTests('https://example.com', {
  json: true,
  quick: true,
  browser: 'chrome'
});
// Output: stdouts JSON for parsing
```

### Failure Investigation
```javascript
await runTests('https://example.com', {
  json: false,
  onlyFailures: true,
  quick: false
});
// Output: Only failures highlighted
```

---

## Integration Example

```javascript
// In CLI: bin/index.js
const { runTests } = require('./lib/runner');

program.command('run <url>')
  .option('--quick', 'Quick mode')
  .option('--json', 'JSON output')
  .action(async (url, options) => {
    try {
      await runTests(url, {
        quick: options.quick || false,
        json: options.json || false,
        browser: options.browser || 'chrome'
      });
    } catch (e) {
      console.error(chalk.red(`Fatal: ${e.message}`));
      process.exit(1);
    }
  });
```

---

## Dependencies

- `./browser` — launchBrowser()
- `./session` — sessionExists(), isSessionValid(), getSessionPath()
- `./capture` — captureSession()
- `./listeners` — setupAllListeners()
- `./selectors` — getBrokenImages()
- `./validators` — isLoginPage()
- `./navigation` — testNavigation()
- `./loggers` — buildJsonResult(), printLog()
- `chalk`, `ora` — Output formatting
