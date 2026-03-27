# selectors.js

DOM traversal and interaction helpers for finding and clicking navigation elements.

## Overview

Provides functions to discover menu items, interact safely with page elements, extract page information, and identify broken images.

## Exports

### `getVisibleMenuItems(page)`

**Returns:** Promise<Array<{text, href}>>

**Parameters:**
- `page` (Playwright Page) — Current page

**Behavior:**

1. Evaluates page using `NAV_SELECTORS` from constants
2. Queries all navigation-related CSS selectors
3. Filters elements by visibility and text validity
4. Deduplicates by text (case-insensitive)
5. Blocks dangerous text labels

**Filter Criteria:**
- ✅ Text length 2-80 characters
- ✅ Not already seen (case-insensitive)
- ✅ Not in blocked list (delete, logout, etc.)
- ✅ Element is visible (width/height > 0)
- ✅ Element display ≠ 'none'
- ✅ External links excluded (unless same domain)
- ✅ Fixed position elements counted

**Returns:**
```javascript
[
  { text: 'Dashboard', href: '/dashboard' },
  { text: 'Settings', href: '/settings' },
  { text: 'Users', href: '/admin/users' }
]
```

**Use Case:** Bootstrap menu discovery for navigation testing.

---

### `getPageHeading(page)`

**Returns:** Promise<string>

**Parameters:**
- `page` (Playwright Page) — Current page

**Behavior:**
- Queries using `HEADING_SELECTORS` from constants
- Extracts first matching heading's text
- Trims whitespace
- Returns empty string if no heading found

**Selects:** `h1`, `h2`, `[class*="page-title"]`, etc.

**Example:**
```javascript
const heading = await getPageHeading(page);
// → "User Management"
```

**Use Case:** Verification that navigation succeeded, logging page context.

---

### `clickAndWait(page)`

**Returns:** Promise<void>

**Parameters:**
- `page` (Playwright Page) — Current page

**Behavior:**
1. Waits for page load state 'domcontentloaded' (max 6s)
2. Waits additional 500ms for animations
3. Errors are caught silently

**Example:**
```javascript
await safeClick(page, 'Dashboard');
await clickAndWait(page);  // Wait for page load
// Page ready for next interaction
```

**Use Case:** Ensures page is fully loaded before next click.

---

### `safeClick(page, text)`

**Returns:** Promise<boolean> — true if click succeeded

**Parameters:**
- `page` (Playwright Page) — Current page
- `text` (string) — Element text to click

**Behavior:**

**Step 1: Safety Check**
- Returns `false` if text is dangerous

**Step 2: Playwright Locator (Preferred)**
- Uses `page.getByText(text, { exact: true })`
- Gets all matching elements
- For each element:
  - Check visibility
  - Get element tag info (tagName, type, disabled, hasConfirm)
  - Skip if hidden, disabled, or has confirm dialog
  - Skip submit buttons not in nav context
  - Scroll into view if needed
  - Click with 5s timeout
  - Return `true` on success

**Step 3: DOM Fallback (if locator fails)**
- Evaluates JavaScript to find matching element
- Checks visibility: width, height, display, visibility, opacity
- Simulates click on first visible match
- Waits 500ms after click

**Returns:**
- `true` if element was clicked
- `false` if element not found or not clickable

**Example:**
```javascript
const clicked = await safeClick(page, 'Settings');
if (clicked) {
  console.log('Successfully clicked Settings');
} else {
  console.log('Settings not found or blocked');
}
```

**Safety Features:**
- Won't click delete/logout buttons
- Won't click disabled elements
- Won't click buttons with confirm dialogs
- Handles both classic and framework components

**Use Case:** Reliable element clicking with safety guardrails.

---

### `getBrokenImages(page, baseDomain)`

**Returns:** Promise<Array> — Log entries for broken images

**Parameters:**
- `page` (Playwright Page) — Current page
- `baseDomain` (string) — Base domain for internal/external marking

**Behavior:**
1. Queries all `<img>` elements on page
2. Identifies incomplete or broken images:
   - `img.complete === false` (still loading)
   - `img.naturalWidth === 0` (failed to load)
3. Creates log entry for each with:
   - type: 'image'
   - pass: false
   - status: 404
   - external: true if not from base domain

**Returns:**
```javascript
[
  {
    type: 'image',
    pass: false,
    label: 'Broken image: https://cdn.example.com/banner.png',
    status: 404,
    external: false
  }
]
```

**Use Case:** Detect broken image references without waiting for HTTP requests.

---

## DOM Selector Strategy

The module uses a layered approach:

1. **Playwright Locators** (Modern, more reliable)
   - Better error handling
   - Built-in visibility checking
   - Can retry clicks

2. **DOM Fallback** (Compatibility)
   - Direct JS evaluation
   - Works with shadow DOM edge cases
   - Manual visibility checking

---

## Example Workflow

```javascript
const { getVisibleMenuItems, safeClick, clickAndWait, getPageHeading } = require('./selectors');

// 1. Discover menu
const items = await getVisibleMenuItems(page);
console.log(items);  // [{text: 'Dashboard', ...}, ...]

// 2. Click menu item
const clicked = await safeClick(page, items[0].text);
if (!clicked) return;

// 3. Wait for page load
await clickAndWait(page);

// 4. Get result page title
const heading = await getPageHeading(page);
console.log(heading);  // 'Dashboard'

// 5. Check for broken images
const broken = await getBrokenImages(page, 'example.com');
if (broken.length > 0) {
  console.log('Found broken images:', broken);
}
```

---

## Dependencies

- Playwright Page API
- `./constants` — NAV_SELECTORS, HEADING_SELECTORS
- `./validators` — isDangerous()
