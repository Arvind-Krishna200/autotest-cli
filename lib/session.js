/**
 * Session management (cookies, storage state)
 */

const fs = require('fs');
const path = require('path');
const { isLoginPage } = require('./validators');

/**
 * Get path to session file
 */
function getSessionPath() {
  return path.join(process.cwd(), '.autotest', 'session.json');
}

/**
 * Check if session file exists
 */
function sessionExists() {
  return fs.existsSync(getSessionPath());
}

/**
 * Validate if session is still valid
 */
async function isSessionValid(browser, url) {
  const context = await browser.newContext({
    storageState: getSessionPath(),
  });
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    const currentUrl = page.url();
    await context.close();
    return !isLoginPage(currentUrl);
  } catch (e) {
    await context.close();
    return false;
  }
}

module.exports = {
  getSessionPath,
  sessionExists,
  isSessionValid,
};
