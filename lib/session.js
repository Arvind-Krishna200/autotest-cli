const fs   = require('fs');
const path = require('path');
const { isLoginPage } = require('./validators');

function getSessionPath() {
  return path.join(process.cwd(), '.autotest', 'session.json');
}

function sessionExists() {
  return fs.existsSync(getSessionPath());
}

async function isSessionValid(browser, url) {
  const context = await browser.newContext({ storageState: getSessionPath() });
  const page    = await context.newPage();

  try {
    const baseUrl = `${new URL(url).protocol}//${new URL(url).hostname}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const finalUrl = page.url();
    const title    = await page.title();

    await context.close();

    // Use validators — covers normal login + SSO + OAuth + SAML
    return !isLoginPage(finalUrl, title);

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
