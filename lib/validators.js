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
 * Check if currently on a login / SSO / OAuth page
 */
function isLoginPage(url, title = '') {
  const u = url.toLowerCase();
  const t = title.toLowerCase();

  const loginKeywords = ['login', 'signin', 'sign-in', 'log-in', 'logout', 'signed-out'];

  const urlMatch   = loginKeywords.some(k => u.includes(k));
  const titleMatch = loginKeywords.some(k => t.includes(k));

  const ssoPatterns = [
    'saml', 'sso', 'oauth', 'openid',
    'samlauthrequest',
    'accounts.zoho',
    'accounts.google.com',
    'login.microsoftonline',
    'auth0.com',
    'okta.com',
    'onelogin.com',
    'shibboleth',
    'adfs',
    '/authorize',
    '/callback',
  ];

  const ssoMatch = ssoPatterns.some(p => u.includes(p));

  return urlMatch || titleMatch || ssoMatch;
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
