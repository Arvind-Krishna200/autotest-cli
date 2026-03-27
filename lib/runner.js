/**
 * Main test runner - orchestrates all test components
 */

const chalk = require('chalk');
const ora = require('ora');

const { launchBrowser } = require('./browser');
const { sessionExists, isSessionValid } = require('./session');
const { captureSession } = require('./capture');
const { setupAllListeners } = require('./listeners');
const { getBrokenImages } = require('./selectors');
const { isLoginPage } = require('./validators');
const { testNavigation } = require('./navigation');
const { buildJsonResult, printLog, exportConsoleReport, exportJsonReport } = require('./loggers');

/**
 * Main test runner function
 */
async function runTests(url, options = {}) {
  const startTime = Date.now();
  const isJson = options.json || false;

  // Utility functions for logging
  const print = msg => {
    if (!isJson) console.log(msg);
  };

  const status = msg => {
    if (isJson) process.stderr.write(msg + '\n');
  };

  // Setup spinner
  const spinner = isJson
    ? { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {}, warn: () => {}, text: '' }
    : ora('Launching browser...').start();

  // Launch browser
  if (!isJson) {
    spinner.stop();
    console.log(chalk.gray(`\n  🌐 Browser : ${options.browser || 'chrome'}`));
    spinner.start('Launching browser...');
  }

  status(`🚀 Launching ${options.browser || 'chrome'} browser...`);

  const browser = await launchBrowser(options.browser, options);
  const log = [];
  const baseDomain = new URL(url).hostname;
  const seenAPIs = new Set();
  const seenErrors = new Set();

  if (!isJson) spinner.stop();

  // ─────────────────────────────────────────────────────
  // Session management
  // ─────────────────────────────────────────────────────

  let testUrl = url;

  // Check if session exists
  if (!sessionExists()) {
    if (!isJson) {
      console.log(chalk.yellow('\n  ⚠️  No session found.'));
      console.log(
        chalk.cyan(
          '  🔐 A browser will open — please login, then press Enter.\n'
        )
      );
    }
    await browser.close();
    await captureSession(url);
    return await runTests(url, options);
  }

  // Validate session
  const valid = await isSessionValid(browser, url);
  if (!valid) {
    if (!isJson) {
      console.log(chalk.yellow('\n  ⚠️  Session expired.'));
      console.log(
        chalk.cyan(
          '  🔐 A browser will open — please re-login, then press Enter.\n'
        )
      );
    }
    await browser.close();
    await captureSession(url);
    return await runTests(url, options);
  }

  if (!isJson) console.log(chalk.green('  🔐 Session loaded ✅\n'));

  // ─────────────────────────────────────────────────────
  // Create page context with session
  // ─────────────────────────────────────────────────────

  const sessionPath = require('./session').getSessionPath();
  const context = await browser.newContext({ storageState: sessionPath });
  const page = await context.newPage();

  // ─────────────────────────────────────────────────────
  // Setup cleanup function
  // ─────────────────────────────────────────────────────

  async function finish() {
    status('✅ Tests complete — building report...');
    await browser.close();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (isJson) {
      const result = buildJsonResult(log, testUrl, elapsed, options);
      process.stdout.write(JSON.stringify(result, null, 2));
      if (options.export) {
        const filePath = exportJsonReport(log, testUrl, elapsed, options);
        process.stderr.write(chalk.green(`\n  ✅ Report saved to: ${filePath}\n`));
      }
    } else {
      printLog(log, testUrl, elapsed, options);
      if (options.export) {
        const filePath = exportConsoleReport(log, testUrl, elapsed, options);
        console.log(chalk.green(`\n  ✅ Report saved to: ${filePath}`));
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // Setup event listeners
  // ─────────────────────────────────────────────────────

  setupAllListeners(page, baseDomain, {
    print,
    log,
    seenAPIs,
    seenErrors,
  });

  // ─────────────────────────────────────────────────────
  // Page load
  // ─────────────────────────────────────────────────────

  status('🌐 Loading page...');
  if (!isJson) spinner.start('Checking page...');

  try {
    const response = await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
    });
    const pageStatus = response?.status() || 200;

    const currentUrl = page.url();

    if (isLoginPage(currentUrl)) {
      if (!isJson) spinner.stop();
      log.push({
        type: 'console',
        pass: false,
        label: 'Session invalid — redirected to login page',
        status: null,
        external: false,
      });
      return await finish();
    }

    log.push({
      type: 'page',
      pass: pageStatus < 400,
      label: `Page Load → ${testUrl}`,
      status: pageStatus,
      external: false,
    });
  } catch (e) {
    log.push({
      type: 'page',
      pass: false,
      label: `Page Load failed: ${e.message}`,
      status: null,
      external: false,
    });
  }

  if (!isJson) spinner.stop();
  status('🌐 Page loaded — scanning...');

  // ─────────────────────────────────────────────────────
  // Check for broken images
  // ─────────────────────────────────────────────────────

  const brokenImageLogs = await getBrokenImages(page, baseDomain);
  log.push(...brokenImageLogs);

  // ─────────────────────────────────────────────────────
  // Test navigation
  // ─────────────────────────────────────────────────────

  await testNavigation(page, testUrl, baseDomain, log, {
    ...options,
    print,
    status,
  });

  return await finish();
}

module.exports = { runTests };
