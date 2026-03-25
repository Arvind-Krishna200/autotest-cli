const { chromium } = require('playwright');

// ── Smart field finder ────────────────────────────────────
async function smartFill(page, fieldName, value) {
  const selectors = fieldName === 'username'
    ? [
        'input[name="UserName"]',
        'input[name="username"]',
        'input[name="user-name"]',
        'input[id="user-name"]',
        'input[id="username"]',
        'input[id="UserName"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
        'input[placeholder*="user" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="login" i]'
      ]
    : [
        'input[type="password"]',
        'input[name="password"]',
        'input[name="Password"]',
        'input[id="password"]',
        'input[id="Password"]',
        'input[autocomplete="current-password"]',
        'input[placeholder*="pass" i]'
      ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const visible = await el.isVisible();
        if (visible) {
          console.log(`✅ Found ${fieldName} field: ${selector}`);
          await el.fill(value);
          return;
        }
      }
    } catch (e) {}
  }

  throw new Error(
    `❌ Could not find ${fieldName} field — run debug-login.js to inspect your login page`
  );
}

// ── Smart submit finder ───────────────────────────────────
async function smartSubmit(page) {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button[id*="login" i]',
    'button[id*="signin" i]',
    'button[class*="login" i]',
    'button[class*="signin" i]',
    '#login-button',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'button:has-text("Submit")'
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const visible = await el.isVisible();
        if (visible) {
          console.log(`✅ Clicked submit: ${selector}`);
          await el.click();
          return;
        }
      }
    } catch (e) {}
  }

  throw new Error('❌ Could not find submit button');
}

// ── Main login ────────────────────────────────────────────
async function login(page, options) {
  const { url, username, password } = options;

  console.log('🔐 Navigating to login page...');
  await page.goto(url, { waitUntil: 'networkidle' });

  // If already logged in — skip
  const currentUrl = page.url();
  if (!currentUrl.toLowerCase().includes('login') &&
      !currentUrl.toLowerCase().includes('signin') &&
      currentUrl !== url &&
      currentUrl !== url + '/') {
    console.log(`✅ Already logged in — at: ${currentUrl}`);
    return;
  }

  await smartFill(page, 'username', username);
  await smartFill(page, 'password', password);

  console.log('🔐 Submitting login form...');
  await smartSubmit(page);

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const afterUrl = page.url();
  console.log(`✅ Logged in — redirected to: ${afterUrl}`);
}

module.exports = { login };
