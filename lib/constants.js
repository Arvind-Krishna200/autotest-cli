/**
 * Constants used across the test runner
 */

// Dangerous button/link text that should not be clicked
const BLOCKED_TEXTS = [
  // Data destruction
  'delete', 'remove', 'reset', 'clear', 'purge', 'drop',
  'destroy', 'wipe', 'flush', 'truncate', 'erase',
  'confirm delete', 'yes delete', 'permanently delete', 'are you sure',
  'delete account', 'delete user', 'delete permanently',
  
  // Authentication/Session
  'sign out', 'log out', 'logout', 'signout', 'revoke',
  'disable account', 'deactivate', 'suspend', 'ban',
  
  // Financial operations
  'pay now', 'charge', 'refund', 'cancel subscription',
  'unsubscribe', 'close account', 'downgrade',
  'process payment', 'complete payment', 'submit payment',
  
  // Bulk operations (risky)
  'export all', 'download all', 'bulk export', 'bulk delete',
  'delete all', 'remove all', 'clear all', 'reset all',
  
  // Admin actions
  'shutdown', 'restart', 'force restart', 'power off',
  'terminate', 'cancel', 'abort', 'stop',
  
  // Irreversible actions
  'archive', 'unpublish', 'publish live', 'go live',
  'submit', 'finalize', 'lock', 'unlock',
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
  // Standard semantic nav elements
  'nav a', 'header nav a', '[role="navigation"] a',
  'nav button', 'header button', '[role="navigation"] button',
  
  // Sidebar/Side navigation
  '.sidebar a', '.side-nav a', '.sidenav a', '#sidebar a',
  '[class*="sidebar"] a', '[class*="side-nav"] a',
  '[class*="sidemenu"] a', '[class*="sideNav"] a',
  '.sidebar button', '[class*="sidebar"] button',
  
  // Menu patterns (class-based)
  '.menu a', '.nav a', '.navbar a', '.navigation a',
  '[class*="menu"] a', '[class*="nav"] a', '[class*="navbar"] a',
  '[class*="nav-item"] a', '[class*="nav-link"] a',
  '[class*="menu-item"] a', '[class*="menu-link"] a',
  
  // Menu patterns (button variants)
  '.menu button', '.nav button', '.navbar button',
  '[class*="menu"] button', '[class*="nav"] button', '[class*="navbar"] button',
  
  // List-based navigation
  'nav li a', 'nav li', 'nav li button',
  'ul[role="menu"] li a', 'ul[role="menubar"] li a',
  '[class*="menu"] li', '[class*="nav"] li', '[class*="menu"] li button',
  
  // ARIA role-based (keyboard accessible)
  '[role="menuitem"]', '[role="menuitemradio"]', '[role="menuitemcheckbox"]',
  '[role="tab"]', '[role="tablist"] a', '[role="tablist"] button',
  '[role="treeitem"]', '[role="link"]', '[role="button"]',
  '[role="navigation"] li', '[role="navigation"] li a',
  
  // Data attributes (custom nav)
  '[data-nav]', '[data-nav] a', '[data-nav] button',
  '[data-menu]', '[data-menu] a', '[data-menu] button',
  '[data-nav-item]', '[data-nav-link]', '[data-menu-item]',
  
  // Divs with tabindex (keyboard accessible divs)
  'div[tabindex] a', 'div[tabindex] button',
  '[class*="nav"] [tabindex]', '[class*="menu"] [tabindex]',
  'nav [tabindex]', '[role="navigation"] [tabindex]',
  
  // Semantic header elements
  'header a', 'header li', 'header li a', 'header li button',
  
  // Common utility classes
  '[class*="nav-"] a', '[class*="nav-"] button',
  '[class*="menu-"] a', '[class*="menu-"] button',
  
  // Footer navigation (sometimes has links)
  'footer nav a', 'footer [role="navigation"] a',
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
