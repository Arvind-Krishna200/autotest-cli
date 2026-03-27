/**
 * Constants used across the test runner
 */

// Dangerous button/link text that should not be clicked
const BLOCKED_TEXTS = [
  'delete', 'remove', 'reset', 'clear', 'purge', 'drop',
  'destroy', 'wipe', 'flush', 'truncate',
  'confirm delete', 'yes delete', 'permanently delete', 'are you sure',
  'sign out', 'log out', 'logout', 'signout', 'revoke',
  'disable account', 'deactivate',
  'pay now', 'charge', 'refund', 'cancel subscription',
  'export all', 'download all', 'bulk export',
];

// Domains to ignore in API monitoring
const SKIP_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'hotjar.com',
  'segment.com',
  'mixpanel.com',
  'doubleclick.net',
  'facebook.com/tr',
];

// DOM selectors for finding navigation items
const NAV_SELECTORS = [
  'nav a', 'header nav a', '[role="navigation"] a',
  '.sidebar a', '.side-nav a', '.sidenav a', '#sidebar a',
  '[class*="sidebar"] a', '[class*="side-nav"] a',
  '[class*="sidemenu"] a', '[class*="sideNav"] a',
  '.menu a', '.nav a', '.navbar a',
  '[class*="menu"] a', '[class*="nav"] a',
  '[class*="nav-item"] a', '[class*="nav-link"] a',
  'nav li a', 'nav li',
  'ul[role="menu"] li a', 'ul[role="menubar"] li a',
  '[role="menuitem"]', '[role="tab"]', '[role="treeitem"]',
  '.sidebar button', 'nav button',
  '[class*="nav"] button', '[class*="menu"] button',
  '[class*="menu"] li', '[class*="nav"] li',
];

// Page heading selectors
const HEADING_SELECTORS = 'h1, h2, [class*="page-title"], [class*="module-title"], [class*="header-title"]';

// Icons for console output
const ICONS = {
  login:    '🔐',
  page:     '🌐',
  nav:      '🧭',
  subnav:   '↳ ',
  api:      '📡',
  image:    '🖼️ ',
  resource: '📦',
  console:  '⚠️ ',
};

module.exports = {
  BLOCKED_TEXTS,
  SKIP_DOMAINS,
  NAV_SELECTORS,
  HEADING_SELECTORS,
  ICONS,
};
