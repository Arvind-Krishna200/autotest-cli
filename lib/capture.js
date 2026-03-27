const { chromium } = require('playwright');
const fs           = require('fs');
const path         = require('path');
const readline     = require('readline');
const chalk        = require('chalk');

function waitForEnter() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });
    rl.question('  ⏎  Press Enter to continue... ', () => {
      rl.close();
      resolve();
    });
  });
}

async function captureSession(url) {
  const sessionDir  = path.join(process.cwd(), '.autotest');
  const sessionPath = path.join(sessionDir, 'session.json');

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page    = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.error(chalk.red(`\n  ❌ Could not open URL: ${url}`));
    await browser.close();
    process.exit(1);
  }

  console.log(chalk.yellow('\n  ⏳ Browser is open.'));
  console.log(chalk.cyan('  → If you are not logged in, please login now.'));
  console.log(chalk.cyan('  → If you are already in, just press Enter.\n'));

  await waitForEnter();

  // Save session state
  const state = await context.storageState();

  // Fix session cookies that die on browser close (expires: -1)
  const oneWeekFromNow = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  state.cookies = state.cookies.map(cookie => ({
    ...cookie,
    expires: cookie.expires === -1 ? oneWeekFromNow : cookie.expires,
  }));

  fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));

  console.log(chalk.green(`\n  ✅ Session saved!`));
  console.log(chalk.gray(`  📁 Saved to : ${sessionPath}`));
  console.log(chalk.gray(`  🍪 Cookies  : ${state.cookies.length}`));
  console.log(chalk.gray(`  💾 Origins  : ${state.origins.length}\n`));

  // Don't close browser — return live instance to runner
  return { browser, context, page };
}

module.exports = { captureSession };
