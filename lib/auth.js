const { chromium } = require('playwright');

// ── Login via form (DEPRECATED — replaced by capture) ─────
// Kept for reference only. Use captureSession() instead.

// async function smartFill(page, fieldName, value) {
//   const selectors = fieldName === 'username'
//     ? [
//         'input[name="UserName"]',
//         'input[name="username"]',
//         'input[name="user-name"]',
//         'input[id="user-name"]',
//         'input[id="username"]',
//         'input[id="UserName"]',
//         'input[type="text"]',
//         'input[type="email"]',
//         'input[autocomplete="username"]',
//         'input[autocomplete="email"]',
//         'input[placeholder*="user" i]',
//         'input[placeholder*="email" i]',
//         'input[placeholder*="login" i]'
//       ]
//     : [
//         'input[type="password"]',
//         'input[name="password"]',
//         'input[name="Password"]',
//         'input[id="password"]',
//         'input[id="Password"]',
//         'input[autocomplete="current-password"]',
//         'input[placeholder*="pass" i]'
//       ];
//
//   for (const selector of selectors) {
//     try {
//       const el = await page.$(selector);
//       if (el) {
//         const visible = await el.isVisible();
//         if (visible) {
//           await el.fill(value);
//           return;
//         }
//       }
//     } catch (e) {}
//   }
//   throw new Error(`❌ Could not find ${fieldName} field`);
// }

// async function smartSubmit(page) {
//   const selectors = [
//     'button[type="submit"]',
//     'input[type="submit"]',
//     'button[id*="login" i]',
//     'button[id*="signin" i]',
//     'button[class*="login" i]',
//     'button[class*="signin" i]',
//     '#login-button',
//     'button:has-text("Login")',
//     'button:has-text("Sign In")',
//     'button:has-text("Log In")',
//     'button:has-text("Submit")'
//   ];
//
//   for (const selector of selectors) {
//     try {
//       const el = await page.$(selector);
//       if (el) {
//         const visible = await el.isVisible();
//         if (visible) { await el.click(); return; }
//       }
//     } catch (e) {}
//   }
//   throw new Error('❌ Could not find submit button');
// }

// async function login(page, options) {
//   const { url, username, password } = options;
//   await page.goto(url, { waitUntil: 'networkidle' });
//   await smartFill(page, 'username', username);
//   await smartFill(page, 'password', password);
//   await smartSubmit(page);
//   await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
//   await page.waitForTimeout(1000);
// }

// module.exports = { login };

// ── Placeholder export (no-op until re-enabled) ───────────
async function login() {}
module.exports = { login };
