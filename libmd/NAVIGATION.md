# navigation.js

Navigation testing logic - clicking through menus and sub-menus.

## Overview

Contains the core state machine for testing navigation: clicking menu items, waiting for pages, collecting sub-menus, and logging results in both quick and deep modes.

## Exports

### `testNavigation(page, testUrl, baseDomain, log, options)`

**Returns:** Promise<void>

**Parameters:**
- `page` (Playwright Page) — Current page
- `testUrl` (string) — Base URL to return to between clicks
- `baseDomain` (string) — Domain for internal/external detection
- `log` (array) — Test log to append results
- `options` (object)
  - `quick` (boolean) — Quick mode (main menu only) vs deep (with sub-menus)
  - `json` (boolean) — Suppress spinner output
  - `print` (function) — Print function for output
  - `status` (function) — Status reporter function

**Behavior:**

1. **Collect Main Menu**
   - Gets all visible menu items
   - Deduplicates by text
   - Reports count

2. **For Each Main Item:**
   - Calls `testMainMenuItem()`
   - Returns null if failed/skipped
   - If passed and QUICK mode: log and continue
   - If passed and DEEP mode: test sub-items

3. **For Each Sub-Item (Deep Mode):**
   - Calls `testSubMenuItems()`
   - Collects items not in main menu
   - Tests each sub-item similarly
   - Returns to main menu between tests

**Example:**
```javascript
await testNavigation(page, 'https://example.com', 'example.com', log, {
  quick: false,
  json: false,
  print: console.log,
  status: msg => console.error(msg)
});
// log now populated with nav results
```

---

### `testMainMenuItem(page, mainItem, index, total, testUrl, baseDomain, log, options)`

**Returns:** Promise<Object | null>

**Parameters:**
- `page` (Playwright Page) — Current page
- `mainItem` (object) — {text, href}
- `index` (number) — Current item index (0-based)
- `total` (number) — Total items
- `testUrl` (string) — Home URL
- `baseDomain` (string) — Domain name
- `log` (array) — Test log
- `options` (object) — {json, status, print}

**Returns:**
```javascript
null  // If failed, skipped, or logged out

{
  mainItem: {...},
  heading: 'Page Title',
  spinner: oraInstance  // For logging results
}
```

**Process:**

1. **Reset to Home**
   - Navigate back to `testUrl`
   - Wait 500ms
   - Check page is alive

2. **Click Item**
   - Calls `safeClick(page, text)`
   - If blocked/not found, warn and skip
   - Wait for page load

3. **Check Results**
   - Get current URL
   - If external redirect: warn, return to home, log failure, skip
   - If redirected to login: log failure, skip
   - Get page heading for context

4. **Log Success**
   ```javascript
   {
     type: 'nav',
     pass: true,
     label: 'Nav → Settings → "Settings Page"',
     status: 200,
     external: false
   }
   ```

**Error Handling:**
- Page crash → skip item
- Navigation timeout → logged as failure
- Click failed → logged as failure

---

### `testSubMenuItems(page, mainItem, testUrl, baseDomain, log, options)`

**Returns:** Promise<Array> — Unique sub-items tested

**Parameters:**
- Similar to main item testing
- `options.uniqueMainItems` — Main items to exclude from sub-menu

**Behavior:**

1. **Get New Menu Items**
   - Re-queries menu after main item click
   - Excludes main menu items
   - Excludes current main item
   - Deduplicates

2. **For Each Sub-Item:**
   - Calls `safeClick(page, subText)`
   - If external redirect: log, return home, re-click main, continue
   - Check for logout redirect
   - Get page heading
   - Return home → re-click main → reset
   - Continue to next sub-item

3. **Error Handling:**
   - Page crash between items: break loop
   - Click failed: log and continue
   - Navigate timeout: log and continue

4. **Log Format:**
   ```javascript
   {
     type: 'subnav',
     pass: true,
     label: 'Sub → User List → "Active Users"',
     status: 200,
     external: false
   }
   ```

---

## Test Flow Diagram

```
testNavigation()
  ↓
getVisibleMenuItems() → [item1, item2, item3]
  ↓
For each mainItem:
  ├→ testMainMenuItem()
  │   ├→ Reset to home
  │   ├→ safeClick(mainItem)
  │   ├→ clickAndWait()
  │   ├→ Check URL (external? login?)
  │   ├→ getPageHeading()
  │   └→ Log result
  │
  └→ If DEEP mode and passed:
      ├→ testSubMenuItems()
      │   ├→ getVisibleMenuItems()
      │   ├→ Filter to exclude main items
      │   │
      │   └→ For each subItem:
      │       ├→ safeClick(subItem)
      │       ├→ clickAndWait()
      │       ├→ Check URL (external? login?)
      │       ├→ getPageHeading()
      │       ├→ Log result
      │       │
      │       └→ Reset home → re-click main
      │
      └→ Report sub-item count
```

---

## Quick vs Deep Mode

| Aspect | Quick (⚡) | Deep (🔬) |
|--------|-----------|-----------|
| Main items | ✅ Tested | ✅ Tested |
| Sub-items | ❌ Skipped | ✅ Tested |
| Time | ~25 seconds | ~90 seconds |
| Depth | 1 level | 2 levels |

---

## Logging Strategy

Each navigation action results in one log entry:

```javascript
{
  type: 'nav' | 'subnav',
  pass: boolean,
  label: string,        // 'Nav → Dashboard' or 'Sub → Users'
  status: number | string,  // 200, 'external redirect', 'redirected to login'
  external: boolean     // true if navigated to different domain
}
```

**Why Separate nav/subnav:**
- Easy to filter by depth
- Shows navigation structure in reports
- Easier debugging

---

## Error Scenarios Handled

| Scenario | Behavior |
|----------|----------|
| Click blocked | Logged as failure, continue |
| External redirect | Return home, log failure, continue |
| Login redirect | Stop testing item, log failure |
| Page crash | Skip item, continue |
| 404 on click | Caught as failure |
| Timeout | Caught as failure |

---

## Example Output

```
Found 3 main menu items — 🔬 deep mode

[1/3] Testing → Dashboard...     ✔ Dashboard → no sub items found
[2/3] Testing → Settings...      ✔ Settings → 4 sub items tested
  - Sub → Profile            ✔
  - Sub → Security           ✔
  - Sub → Notifications      ✘ redirected to login
  - Sub → Advanced           ✔
[3/3] Testing → Users...       ✘ external redirect
```

---

## Dependencies

- `./selectors` — getVisibleMenuItems(), getPageHeading(), clickAndWait(), safeClick()
- `./validators` — isPageAlive(), isLoginPage(), isExternalUrl()
- `ora` — Spinner display
- `chalk` — Color output
