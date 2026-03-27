# browser.js

Browser initialization, detection, and management with automatic installation fallback.

## Overview

This module handles browser engine selection and launching using Playwright. It supports Chrome, Firefox, and Safari with automatic browser installation if the required executable is missing.

## Exports

### `getBrowserEngine(browserName)`

**Returns:** Playwright browser engine (chromium, firefox, or webkit)

**Parameters:**
- `browserName` (string) — Browser name: `'chrome'`, `'chromium'`, `'firefox'`, `'safari'`, `'webkit'`

**Behavior:**
- Case-insensitive matching
- Defaults to `chromium` for unknown values
- `safari` maps to `webkit` engine

**Example:**
```javascript
const { getBrowserEngine } = require('./browser');

const engine = getBrowserEngine('firefox');
// Returns: firefox engine from Playwright
```

---

### `launchBrowser(browserName, options)`

**Returns:** Promise<Browser> — Running Playwright browser instance

**Parameters:**
- `browserName` (string) — Browser to launch
- `options` (object, optional)
  - `json` (boolean) — Suppress console output if true

**Behavior:**

1. **First Attempt:** Tries to launch the browser with `headless: false`
2. **Auto-Install:** If browser executable is missing:
   - Displays installation prompt (unless JSON mode)
   - Runs `npx playwright install <name>`
   - Retries launch after installation
3. **Error Handling:** Throws error if installation fails

**Example:**
```javascript
const { launchBrowser } = require('./browser');

const browser = await launchBrowser('chrome', { json: false });
// Browser window opens, ready for automation
```

---

## Features

✅ **Multi-browser Support**
- Chrome/Chromium (default)
- Firefox
- Safari (via webkit)

✅ **Automatic Installation**
- Detects missing browser
- Installs via `playwright install`
- One-time setup per browser

✅ **JSON Mode**
- Silent output for CI/CD pipelines
- Errors logged to stderr

✅ **Error Handling**
- Clear error messages
- Distinction between missing executable and other errors

---

## Usage Example

```javascript
const { launchBrowser } = require('./browser');

async function runTest() {
  const browser = await launchBrowser('firefox');
  const page = await browser.newPage();
  
  // ... your test code ...
  
  await browser.close();
}

runTest().catch(console.error);
```

---

## Implementation Details

### Browser Engine Mapping
```
'chrome'/'chromium' → chromium (Chromium engine)
'firefox'           → firefox (Gecko engine)
'safari'/'webkit'   → webkit (WebKit engine)
(default)           → chromium
```

### Launch Options
- `headless: false` — Shows browser window during test
- Playwright auto-detects platform (Windows/macOS/Linux)

### Installation Process
Uses `npx playwright install <browser-name>` which:
- Downloads appropriate browser build for OS
- Stores in `~/.cache/ms-playwright/`
- One-time execution per fresh install
