const chalk = require('chalk');
const ora = require('ora');

const { launchBrowser } = require('./browser');
const { sessionExists, isSessionValid, getSessionPath } = require('./session');
const { captureSession } = require('./capture');
const { setupAllListeners } = require('./listeners');
const { getBrokenImages } = require('./selectors');
const { isLoginPage } = require('./validators');
const { testNavigation } = require('./navigation');
const { buildJsonResult, printLog, exportConsoleReport, exportJsonReport } = require('./loggers');


async function runTests(url, options = {}, liveBrowser = null, liveContext = null) {
  const startTime = Date.now();
  const isJson    = options.json || false;
  const baseUrl   = `${new URL(url).protocol}//${new URL(url).hostname}`;

  const print  = msg => { if (!isJson) console.log(msg); };
  const status = msg => { if (isJson) process.stderr.write(msg + '\n'); };

  const spinner = isJson
    ? { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {}, warn: () => {}, text: '' }
    : ora('Launching browser...').start();


  // ─────────────────────────────────────────────────────
  // Browser — reuse live instance or launch fresh
  // ─────────────────────────────────────────────────────

  let browser, context, page;

  if (liveBrowser && liveContext) {
    // Reuse same browser from captureSession ✅
    browser = liveBrowser;
    context = liveContext;
    page    = options._livePage || await context.newPage();

    // If page is blank navigate to baseUrl
    if (!page.url || page.url() === 'about:blank') {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    }

    if (!isJson) {
      console.log(chalk.gray(`\n  🌐 Browser : ${options.browser || 'chrome'}`));
      console.log(chalk.green('  🔐 Session loaded ✅'));
    }

  } else {
    // Normal run — launch fresh browser
    if (!isJson) {
      spinner.stop();
      console.log(chalk.gray(`\n  🌐 Browser : ${options.browser || 'chrome'}`));
      spinner.start('Launching browser...');
    }

    status(`🚀 Launching ${options.browser || 'chrome'} browser...`);
    browser = await launchBrowser(options.browser, options);
    if (!isJson) spinner.stop();

    // ── No session → capture ──────────────────────────
    if (!sessionExists()) {
      if (!isJson) {
        console.log(chalk.yellow('\n  ⚠️  No session found.'));
        console.log(chalk.cyan('  🔐 A browser will open — please login, then press Enter.\n'));
      }
      await browser.close();
      const { browser: lb, context: lc, page: lp } = await captureSession(url);
      return await runTests(baseUrl, { ...options, _livePage: lp }, lb, lc);
    }

    // ── Session exists → validate ─────────────────────
    const valid = await isSessionValid(browser, url);
    if (!valid) {
      if (!isJson) {
        console.log(chalk.yellow('\n  ⚠️  Session expired.'));
        console.log(chalk.cyan('  🔐 A browser will open — please re-login, then press Enter.\n'));
      }
      await browser.close();
      const { browser: lb, context: lc, page: lp } = await captureSession(url);
      return await runTests(baseUrl, { ...options, _livePage: lp }, lb, lc);
    }

    if (!isJson) console.log(chalk.green('  🔐 Session loaded ✅\n'));

    // Session valid — create context with saved session
    context = await browser.newContext({ storageState: getSessionPath() });
    page    = await context.newPage();
  }


  // ─────────────────────────────────────────────────────
  // Shared state
  // ─────────────────────────────────────────────────────

  const log        = [];
  const baseDomain = new URL(url).hostname;
  const seenAPIs   = new Set();
  const seenErrors = new Set();

  // Use current page URL — wherever app landed after login ✅
  let testUrl = (page.url && page.url() !== 'about:blank')
    ? page.url()
    : baseUrl;

  if (!isJson) console.log(chalk.gray(`  📍 Testing : ${testUrl}\n`));


  // ─────────────────────────────────────────────────────
  // Finish helper
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
  // Event listeners
  // ─────────────────────────────────────────────────────

  setupAllListeners(page, baseDomain, { print, log, seenAPIs, seenErrors });


  // ─────────────────────────────────────────────────────
  // Page load
  // ─────────────────────────────────────────────────────

  status('🌐 Loading page...');
  if (!isJson) spinner.start('Checking page...');

  try {
    const response   = await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
    const pageStatus = response?.status() || 200;
    const currentUrl = page.url();

    if (isLoginPage(currentUrl)) {
      if (!isJson) spinner.stop();
      log.push({
        type: 'console', pass: false,
        label: 'Session invalid — redirected to login page',
        status: null, external: false,
      });
      return await finish();
    }

    log.push({
      type: 'page', pass: pageStatus < 400,
      label: `Page Load → ${testUrl}`,
      status: pageStatus, external: false,
    });
  } catch (e) {
    log.push({
      type: 'page', pass: false,
      label: `Page Load failed: ${e.message}`,
      status: null, external: false,
    });
  }

  if (!isJson) spinner.stop();
  status('🌐 Page loaded — scanning...');


  // ─────────────────────────────────────────────────────
  // Broken images
  // ─────────────────────────────────────────────────────

  const brokenImageLogs = await getBrokenImages(page, baseDomain);
  log.push(...brokenImageLogs);


  // ─────────────────────────────────────────────────────
  // Navigation tests
  // ─────────────────────────────────────────────────────

  await testNavigation(page, testUrl, baseDomain, log, {
    ...options,
    print,
    status,
  });

  return await finish();
}

module.exports = { runTests };
