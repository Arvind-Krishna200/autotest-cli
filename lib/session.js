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

async function isSessionValid(browser, url) {
  const context = await browser.newContext({ storageState: getSessionPath() });
  const page    = await context.newPage();

  try {
    const baseUrl = `${new URL(url).protocol}//${new URL(url).hostname}`;
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const debug = await page.evaluate(() => {
      return {
        url:   window.location.href,
        title: document.title,
        s1_password:  !!document.querySelector('input[type="password"]'),
        s2_loginBtn:  Array.from(document.querySelectorAll('button, a, input[type="submit"]'))
                        .some(b => ['login','sign in','log in','signin','continue']
                        .includes((b.innerText || b.value || '').toLowerCase().trim())),
        s3_title:     document.title.toLowerCase().includes('login') ||
                      document.title.toLowerCase().includes('signin'),
        s4_simpleForm: document.querySelectorAll('form').length === 1 &&
                      !!document.querySelector('input[type="email"], input[type="text"]'),
      };
    });

    // ← ADD THIS
    console.log('\n  🔍 Session debug:');
    console.log(`     URL   : ${debug.url}`);
    console.log(`     Title : ${debug.title}`);
    console.log(`     s1 password field : ${debug.s1_password}`);
    console.log(`     s2 login button   : ${debug.s2_loginBtn}`);
    console.log(`     s3 title keyword  : ${debug.s3_title}`);
    console.log(`     s4 simple form    : ${debug.s4_simpleForm}`);
    const score = [debug.s1_password, debug.s2_loginBtn, debug.s3_title, debug.s4_simpleForm].filter(Boolean).length;
    console.log(`     score : ${score}/4 → ${score >= 2 ? '❌ login page' : '✅ app page'}\n`);

    await context.close();
    return score < 2;

  } catch (e) {
    console.log('  🔍 Session check error:', e.message);
    await context.close();
    return false;
  }
}


module.exports = {
  getSessionPath,
  sessionExists,
  isSessionValid,
};
