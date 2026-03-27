# Module Documentation Index

Complete reference for all library modules in `autotest-cli/lib/`.

---

## Quick Reference

| Module | Purpose | Type | Status |
|--------|---------|------|--------|
| [RUNNER.md](./RUNNER.md) | Main orchestrator | Core | ✅ Active |
| [BROWSER.md](./BROWSER.md) | Browser initialization | Core | ✅ Active |
| [SESSION.md](./SESSION.md) | Auth state persistence | Core | ✅ Active |
| [NAVIGATION.md](./NAVIGATION.md) | Menu testing | Core | ✅ Active |
| [LISTENERS.md](./LISTENERS.md) | Event monitoring | Core | ✅ Active |
| [SELECTORS.md](./SELECTORS.md) | DOM interaction | Core | ✅ Active |
| [VALIDATORS.md](./VALIDATORS.md) | Safety checks | Utility | ✅ Active |
| [CONSTANTS.md](./CONSTANTS.md) | Configuration | Utility | ✅ Active |
| [LOGGERS.md](./LOGGERS.md) | Output formatting | Utility | ✅ Active |
| [CAPTURE.md](./CAPTURE.md) | Manual login | Core | ✅ Active |
| [AUTH.md](./AUTH.md) | Legacy login code | Reference | ⚠️ Deprecated |

---

## Module Dependency Graph

```
runner.js (Main)
├── browser.js
│   └── constants.js (for logging)
├── session.js
│   └── validators.isLoginPage()
├── capture.js
├── listeners.js
│   └── constants.SKIP_DOMAINS
├── selectors.js
│   ├── constants.NAV_SELECTORS
│   └── validators.isDangerous()
├── navigation.js
│   ├── selectors.*
│   ├── validators.*
│   └── chalk, ora (UI)
├── loggers.js
│   └── constants.ICONS
└── validators.js
    └── constants.BLOCKED_TEXTS
```

---

## Core Workflow

### 1. Entry Point: CLI (bin/index.js)

```
node bin/index.js run "https://example.com" --quick
  ↓
Commander parses arguments
  ↓
Calls runTests(url, options)
```

---

### 2. Main Orchestration: runner.js

```
runTests()
├─ 1. Setup (spinner, logging)
├─ 2. Launch Browser
│  └─ browser.launchBrowser()
├─ 3. Session Management
│  ├─ session.sessionExists()
│  ├─ session.isSessionValid()
│  └─ capture.captureSession() [if needed]
├─ 4. Setup Listeners
│  └─ listeners.setupAllListeners()
├─ 5. Page Load
│  └─ page.goto()
├─ 6. Asset Scan
│  └─ selectors.getBrokenImages()
├─ 7. Navigation Test
│  └─ navigation.testNavigation()
└─ 8. Output Results
   └─ loggers.buildJsonResult() or printLog()
```

---

### 3. Navigation Testing: navigation.js

```
testNavigation()
├─ Get Main Menu Items
│  └─ selectors.getVisibleMenuItems()
│
└─ For Each Main Item:
   ├─ testMainMenuItem()
   │  ├─ safeClick()
   │  ├─ clickAndWait()
   │  └─ getPageHeading()
   │
   └─ [If Deep Mode]
      └─ testSubMenuItems()
         ├─ Get Sub Items
         ├─ For Each Sub:
         │  ├─ safeClick()
         │  ├─ clickAndWait()
         │  └─ Log Result
         └─ Return Home
```

---

### 4. Page Interaction: selectors.js + validators.js

```
User clicks Menu Item
  ↓
safeClick(page, "Dashboard")
├─ validators.isDangerous() → Check safety
├─ Playwright Locator → Try click
├─ DOM Fallback → Try JS click
└─ Confirm visibility
  ↓
clickAndWait()
├─ Wait for page load
└─ Wait for animations
  ↓
getPageHeading()
└─ Extract page title
```

---

### 5. Event Capture: listeners.js

During and after navigation:

```
Page Events
├─ page.on('dialog') → setupDialogHandler()
├─ context.on('page') → setupNewTabBlocker()
├─ page.on('download') → setupDownloadBlocker()
├─ page.on('response') → setupResponseListener()
│  └─ Monitor XHR/fetch/images
└─ page.on('console') → setupConsoleListener()
   └─ Capture console.error()

↓ All collected in 'log' array
```

---

### 6. Results Generation: loggers.js

```
log array (test events)
├─ JSON Mode:
│  └─ buildJsonResult() → stringify → stdout
└─ Console Mode:
   └─ printLog() → colorized → terminal
```

---

## Data Flow Example

```
User clicks "Settings" menu item

safeClick() clicks it
  ↓
listeners capture:
  ✔ [GET] https://api.example.com/settings → 200
  ✔ [GET] https://cdn.example.com/app.css → 200
  ⚠️ Broken image: /images/header.png → 404
  ✔ navigated to /settings
  ↓
selectors extracts:
  Page heading: "Settings Page"
  ↓
validators check:
  - Not logged out
  - Not external domain
  ✓ Valid navigation
  ↓
navigation logs:
  {
    type: 'nav',
    pass: true,
    label: 'Nav → Settings → "Settings Page"',
    status: 200,
    external: false
  }
  ↓
Finally output in report:
  ✔ 🧭 Nav → Settings → "Settings Page" → 200
```

---

## Configuration: constants.js

All static values centralized:

```javascript
BLOCKED_TEXTS        → Don't click these
SKIP_DOMAINS         → Ignore these in API monitoring
NAV_SELECTORS        → Where to find menus
HEADING_SELECTORS    → How to find page titles
ICONS                → Emoji for output
```

Change these to adapt to different app patterns.

---

## Session Flow

### First Run
```
1. User runs: node bin/index.js run "https://example.com"
2. runner.js checks: sessionExists() → false
3. capture.js opens browser, user logs in
4. session.json saved with cookies
5. runner.js recursively restarts with session
6. Tests run authenticated
```

### Second Run
```
1. User runs: node bin/index.js run "https://example.com"
2. runner.js checks: sessionExists() → true
3. runner.js validates: isSessionValid() → true
4. Reuses session.json, tests run immediately
```

### Session Expired
```
1. Tests start, session.json exists
2. isSessionValid() checks: page redirects to /login
3. Returns false (expired)
4. capture.js opens browser for re-login
5. runner.js restarts with fresh session
```

---

## Testing Modes

### Quick Mode (⚡)
- Tests main navigation items only
- ~25 seconds
- Finds obvious navigation issues
- Command: `--quick`

### Deep Mode (🔬)
- Tests main items + all sub-items
- ~90 seconds
- Comprehensive menu coverage
- Default (no flag needed)

---

## Common Use Cases

### 1. Local Development Testing
```bash
node bin/index.js run "http://localhost:3000" --quick
```
- Quick feedback on nav
- Tests current build
- Quick iteration

### 2. Staging Validation
```bash
node bin/index.js run "https://staging.example.com"
```
- Deep test of all menus
- Catch nav bugs before prod
- Default deep mode

### 3. CI/CD Integration
```bash
node bin/index.js run "https://prod.example.com" --json --quick
```
- Headless browser
- JSON output for parsing
- Quick mode for speed
- Exit code reflects pass/fail

### 4. Failure Investigation
```bash
node bin/index.js run "https://example.com" --only-failures
```
- Show only failures
- Focus on issues
- Ignore passing checks

---

## Error Scenarios

| Error | Source | Handling |
|-------|--------|----------|
| Browser missing | browser.js | Auto-install |
| Session expired | session.js | Re-capture |
| Click not found | selectors.js | Log & skip |
| External redirect | navigation.js | Log & return home |
| Login redirect | validators.js | Log & stop |
| API 500 | listeners.js | Log as failure |
| Console error | listeners.js | Log as error |
| Page crash | validators.isPageAlive() | Skip item |

---

## Extending the Codebase

### Add New Menu Selector
Edit `constants.NAV_SELECTORS`:
```javascript
// Add your custom selector
NAV_SELECTORS.push('[data-role="navigation"] a');
```

### Add New Blocked Action
Edit `constants.BLOCKED_TEXTS`:
```javascript
BLOCKED_TEXTS.push('purge database');
```

### Add New Event Listener
Edit `listeners.setupAllListeners()`:
```javascript
page.on('request', (request) => {
  // Your custom logic
});
```

### Change Output Format
Edit `loggers.printLog()`:
```javascript
// Modify formatting for custom output
```

---

## Testing the Modules

### Test Browser Launch
```bash
node -e "const b = require('./lib/browser'); b.launchBrowser('chrome').then(br => br.close())"
```

### Test Selectors
```bash
node -e "const s = require('./lib/selectors'); s.getPageHeading(page).then(h => console.log(h))"
```

### Test Validators
```bash
node -e "const v = require('./lib/validators'); console.log(v.isDangerous('delete'))"
```

---

## File Structure

```
lib/
├── runner.js           ← Main entry point
├── browser.js          ← Browser mgmt
├── session.js          ← Auth persistence
├── capture.js          ← Manual login
├── navigation.js       ← Menu testing
├── listeners.js        ← Event monitoring
├── selectors.js        ← DOM interaction
├── validators.js       ← Safety checks
├── constants.js        ← Configuration
├── loggers.js          ← Output formatting
└── auth.js             ← Deprecated
```

---

## Summary

**Architecture:**
- Modular design with clear separation of concerns
- Reusable components
- Single responsibility principle

**Workflow:**
- Sequential test phases
- Recursive session management
- Event-driven result capture

**Extensibility:**
- Constants-driven configuration
- Plugin-like listener architecture
- Custom selector/blocking support

**Reliability:**
- Multiple click fallback strategies
- Automatic browser installation
- Session validation
- Error handling at each phase
