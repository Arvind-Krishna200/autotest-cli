const { chromium } = require('playwright');
const fs           = require('fs');
const path         = require('path');
const readline     = require('readline');

function waitForEnter() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout
    });
    rl.question('', () => {
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

  console.log(`\n  🌐 Opening browser for: ${url}`);
  console.log('  ─────────────────────────────────────');
  console.log('  👆 Login in the browser window that opens.');
  console.log('  ✅ Come back here and press Enter when done...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page    = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.error(`  ❌ Could not open URL: ${url}`);
    await browser.close();
    process.exit(1);
  }

  await waitForEnter();

  const state = await context.storageState();
  fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));

  console.log(`\n  ✅ Session captured!`);
  console.log(`  📁 Saved to: ${sessionPath}`);
  console.log(`  🍪 Cookies : ${state.cookies.length}`);
  console.log(`  💾 Origins : ${state.origins.length}\n`);

  await browser.close();
  return sessionPath;
}

module.exports = { captureSession };
