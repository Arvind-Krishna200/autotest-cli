# constants.js

Centralized configuration and constants used throughout the test runner.

## Overview

This module exports all the static constants, selectors, and configuration values used across the application. It provides a single source of truth for blocked actions, analytics domains, DOM selectors, and UI icons.

## Exports

### `BLOCKED_TEXTS` (Array)
List of dangerous button/link text labels that should never be clicked during testing.

**Examples:**
- Delete operations: `'delete'`, `'remove'`, `'reset'`
- Logout actions: `'sign out'`, `'log out'`, `'logout'`
- Financial actions: `'pay now'`, `'charge'`, `'refund'`
- Account actions: `'disable account'`, `'deactivate'`

**Usage:** Checked before clicking any element to prevent data loss.

---

### `SKIP_DOMAINS` (Array)
Third-party analytics and tracking domains to exclude from API monitoring.

**Included domains:**
- `google-analytics.com`
- `googletagmanager.com`
- `hotjar.com`
- `segment.com`
- `mixpanel.com`
- `doubleclick.net`
- `facebook.com/tr`

**Usage:** API responses from these domains are filtered out to reduce noise in test reports.

---

### `NAV_SELECTORS` (Array)
CSS selectors for locating navigation items on the page.

**Covers:**
- Standard nav elements: `nav a`, `nav button`
- Sidebar components: `.sidebar a`, `[class*="sidebar"] a`
- Menu patterns: `.menu a`, `[class*="menu"] a`
- ARIA roles: `[role="navigation"]`, `[role="menuitem"]`, `[role="tab"]`
- Framework-specific classes: `[class*="nav-item"]`, `[class*="nav-link"]`

**Usage:** Used in `getVisibleMenuItems()` to discover clickable navigation elements.

---

### `HEADING_SELECTORS` (String)
CSS selector for finding page headings.

**Matches:**
- Standard headings: `h1`, `h2`
- Custom heading classes: `[class*="page-title"]`, `[class*="module-title"]`

**Usage:** Extracts page titles for logging and tracking navigation success.

---

### `ICONS` (Object)
Console output emoji icons mapped to event types.

**Mapping:**
```javascript
{
  login:    '🔐',
  page:     '🌐',
  nav:      '🧭',
  subnav:   '↳ ',
  api:      '📡',
  image:    '🖼️ ',
  resource: '📦',
  console:  '⚠️ ',
}
```

**Usage:** Displays appropriate emoji in terminal output for each event type.

---

## Why This Module?

Centralizing constants provides:
- **Maintainability** — Update blocked actions, selectors, or domains in one place
- **Consistency** — Same values used everywhere in the codebase
- **Reusability** — Easy to import and use in other projects
- **Scalability** — Add new selectors or domains without code refactoring
