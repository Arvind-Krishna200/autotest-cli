const { chromium } = require('playwright');
const chalk = require('chalk');
const ora = require('ora');
const { login } = require('./auth');

async function runTests(url, options) {
  const spinner = ora('Launching browser...').start();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const log = []; // ← single chronological log

  // ── Intercept ALL responses ───────────────────────────────
  page.on('response', async response => {
    const type = response.request().resourceType();
    const status = response.status();
    const reqUrl = response.url();
    const method = response.request().method();

    if (type === 'xhr' || type === 'fetch') {
      const pass = status < 400;
      log.push({
        type: 'api',
        pass,
        label: `[${method}] ${reqUrl}`,
        status
      });
    }

    if (status === 404) {
      const isAsset = ['image', 'stylesheet', 'script', 'font'].includes(type);
      if (isAsset) {
        log.push({
          type: 'resource',
          pass: false,
          label: `Missing resource: ${reqUrl}`,
          status: 404
        });
      }
    }
  });

  // ── Console errors ────────────────────────────────────────
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log.push({
        type: 'console',
        pass: false,
        label: `Console error: ${msg.text()}`,
        status: null
      });
    }
  });

  // ── LOGIN ─────────────────────────────────────────────────
  let testUrl = url;
  spinner.stop();
  if (options.username && options.password) {
    await login(page, { ...options, url });
    testUrl = page.url();
    log.push({
      type: 'login',
      pass: true,
      label: `Login → ${testUrl}`,
      status: 200
    });
  }

  // ── PAGE LOAD ─────────────────────────────────────────────
  try {
    const response = await page.goto(testUrl, { waitUntil: 'networkidle' });
    const status = response.status();
    log.push({
      type: 'page',
      pass: status < 400,
      label: `Page Load → ${testUrl}`,
      status
    });
  } catch (e) {
    log.push({ type: 'page', pass: false, label: `Page Load failed: ${e.message}`, status: null });
  }

  // ── IMAGES ────────────────────────────────────────────────
  const brokenImages = await page.$$eval('img', imgs =>
    imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)
  );
  brokenImages.forEach(src => {
    log.push({ type: 'image', pass: false, label: `Broken image: ${src}`, status: 404 });
  });

  // ── NAVIGATION CLICKS ─────────────────────────────────────
  const baseDomain = new URL(testUrl).hostname;

  const navLinks = (await page.$$eval('a[href]', els =>
    els.map(el => ({ href: el.href, text: el.innerText.trim() }))
  ))
  .filter(link =>
    link.href.includes(baseDomain) &&
    !link.href.includes('login') &&
    !link.href.includes('logout') &&
    !link.href.includes('signin') &&
    !link.href.includes('signout') &&
    !link.text.toLowerCase().includes('sign out') &&
    !link.text.toLowerCase().includes('log out') &&
    !link.text.toLowerCase().includes('logout') &&
    !link.href.endsWith('#') &&
    link.text.trim() !== ''
  )
  .filter((link, index, self) =>
    index === self.findIndex(l => l.href === link.href)
  )
  .slice(0, 10);

  for (const link of navLinks) {
    // snapshot API log count before nav
    const apiBefore = log.filter(l => l.type === 'api').length;

    try {
      const response = await page.goto(link.href, {
        waitUntil: 'networkidle',
        timeout: 10000
      });
      const status = response ? response.status() : 0;
      const landed = page.url();
      const loggedOut = landed.toLowerCase().includes('login');

      log.push({
        type: 'nav',
        pass: status < 400 && !loggedOut,
        label: `Nav → ${link.text}`,
        status: loggedOut ? 'redirected to login' : status
      });

    } catch (e) {
      log.push({ type: 'nav', pass: false, label: `Nav → ${link.text}`, status: 'timeout' });
    }

    // Mark APIs that fired AFTER this nav with context
    const apiAfter = log.filter(l => l.type === 'api').length;
    const newApiCount = apiAfter - apiBefore;
    if (newApiCount > 0) {
      // Tag the new ones with nav context
      let tagged = 0;
      for (let i = log.length - 1; i >= 0 && tagged < newApiCount; i--) {
        if (log[i].type === 'api' && !log[i].navContext) {
          log[i].navContext = link.text;
          tagged++;
        }
      }
    }
  }

  // ── Return home ───────────────────────────────────────────
  await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});

  await browser.close();

  // ── PRINT CHRONOLOGICAL LOG ───────────────────────────────
  const divider = chalk.gray('─'.repeat(60));
  const passed = log.filter(l => l.pass).length;
  const failed = log.filter(l => !l.pass).length;

  console.log('\n' + divider);
  console.log(chalk.bold.cyan('  🤖 AUTOTEST SESSION LOG'));
  console.log(chalk.gray(`  URL  : ${testUrl}`));
  console.log(chalk.gray(`  Date : ${new Date().toLocaleString()}`));
  console.log(divider + '\n');

  const icons = {
    login:    '🔐',
    page:     '🌐',
    nav:      '🧭',
    api:      '📡',
    image:    '🖼️ ',
    resource: '📦',
    console:  '⚠️ '
  };

  log.forEach((entry, i) => {
    const icon = icons[entry.type] || '•';
    const statusText = entry.status !== null
      ? chalk.gray(` → ${entry.status}`)
      : '';
    const line = entry.pass
      ? chalk.green(`  ✔  ${icon}  ${entry.label}`) + statusText
      : chalk.red(`  ✘  ${icon}  ${entry.label}`) + statusText;
    console.log(line);
  });

  console.log('\n' + divider);
  console.log(
    `  ${chalk.bold('Summary :')} ` +
    chalk.green(`${passed} OK`) +
    chalk.gray(' / ') +
    (failed > 0 ? chalk.red(`${failed} FAILED`) : chalk.green('0 FAILED')) +
    chalk.gray(` / ${log.length} total events`)
  );
  console.log(
    `  ${chalk.bold('Status  :')} ` +
    (failed === 0
      ? chalk.bgGreen.black(' ALL CLEAR ✓ ')
      : chalk.bgRed.white(` ${failed} ISSUE(S) FOUND ✗ `))
  );
  console.log(divider + '\n');
}

module.exports = { runTests };
