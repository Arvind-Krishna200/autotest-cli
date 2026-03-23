async function login(page, options) {
  const loginUrl = options.loginUrl || options.url;

  console.log('🔐 Navigating to login page...');
  await page.goto(loginUrl, { waitUntil: 'networkidle' });
  
  // Wait for page to fully settle
  await page.waitForTimeout(1000);

  // ALL common username/email selectors across any framework
  const usernameSelectors = [
    'input[name="username"]',
    'input[name="Username"]',
    'input[name="UserName"]',
    'input[name="email"]',
    'input[name="Email"]',
    'input[name="Input.Email"]',
    'input[name="Input.Username"]',
    'input[name="user"]',
    'input[name="login"]',
    'input[name="Login"]',
    'input[type="email"]',
    'input[id="username"]',
    'input[id="Username"]',
    'input[id="UserName"]',
    'input[id="email"]',
    'input[id="Email"]',
    'input[id="user"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="user" i]',
  ];

  // ALL common password selectors
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="Password"]',
    'input[name="Input.Password"]',
    'input[id="password"]',
    'input[id="Password"]',
    'input[placeholder*="password" i]',
  ];

  // ALL common submit button selectors
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
    'button:has-text("Sign in")',
    'button:has-text("Sign In")',
    'button:has-text("Signin")',
    'button:has-text("Submit")',
    '[id*="login" i][type="submit"]',
    '[id*="signin" i][type="submit"]',
    '[class*="login-btn"]',
    '[class*="btn-login"]',
  ];

  // Smart fill — try each selector until one works
  async function smartFill(selectors, value, fieldName) {
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.fill(selector, value);
        console.log(`✅ Found ${fieldName} field: ${selector}`);
        return true;
      } catch { continue; }
    }
    throw new Error(`❌ Could not find ${fieldName} field — run debug-login.js to inspect your login page`);
  }

  // Smart click — try each selector until one works
  async function smartClick(selectors) {
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          page.click(selector)
        ]);
        console.log(`✅ Clicked submit: ${selector}`);
        return true;
      } catch { continue; }
    }
    throw new Error('❌ Could not find submit button — run debug-login.js to inspect your login page');
  }

  await smartFill(usernameSelectors, options.username, 'username');
  await smartFill(passwordSelectors, options.password, 'password');

  console.log('🔐 Submitting login form...');
  await smartClick(submitSelectors);

  // Verify login succeeded
  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('signin')) {
    throw new Error('❌ Login failed — still on login page. Check your credentials.');
  }

  console.log('✅ Logged in — redirected to:', currentUrl);
}

module.exports = { login };
