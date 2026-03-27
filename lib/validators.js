/**
 * Validation helpers for security and checks
 */

const { BLOCKED_TEXTS } = require('./constants');

/**
 * Check if text is dangerous (delete, logout, etc.)
 */
function isDangerous(text) {
  const lower = text.toLowerCase().trim();
  return BLOCKED_TEXTS.some(b => lower === b || lower.startsWith(b));
}

/**
 * Check if page is still alive
 */
async function isPageAlive(page) {
  try {
    await page.title();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if currently on login page
 */
function isLoginPage(url) {
  const lower = url.toLowerCase();
  return lower.includes('login') || lower.includes('signin');
}

/**
 * Check if URL is external to the base domain
 */
function isExternalUrl(url, baseDomain) {
  return (
    !url.includes(baseDomain) &&
    !url.startsWith('about:') &&
    !url.startsWith('data:') &&
    !url.startsWith('blob:')
  );
}

module.exports = {
  isDangerous,
  isPageAlive,
  isLoginPage,
  isExternalUrl,
};
