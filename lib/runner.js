const { chromium, firefox, webkit } = require('playwright');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora   = require('ora');
const { login } = require('./auth');


// ── Dangerous click blocklist ─────────────────────────────
const BLOCKED_TEXTS = [
  'delete', 'remove', 'reset', 'clear', 'purge', 'drop',
  'destroy', 'wipe', 'flush', 'truncate',
  'confirm delete', 'yes delete', 'permanently delete', 'are you sure',
  'sign out', 'log out', 'logout', 'signout', 'revoke',
  'disable account', 'deactivate',
  'pay now', 'charge', 'refund', 'cancel subscription',
  'export all', 'download all', 'bulk export',
];

function isDangerous(text) {
  const lower = text.toLowerCase().trim();
  return BLOCKED_TEXTS.some(b => lower === b || lower.startsWith(b));
}


// ── Skip analytics/tracking domains ──────────────────────
const SKIP_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'hotjar.com',
  'segment.com',
  'mixpanel.com',
  'doubleclick.net',
  'facebook.com/tr',
];


// ── Browser selector ──────────────────────────────────────
function getBrowserEngine(browserName) {
  switch (browserName?.toLowerCase()) {
    case 'firefox':            return firefox;
    case 'safari':
    case 'webkit':             return webkit;
    case 'chrome':
    case 'chromium':
    default:                   return chromium;
  }
}


// ── Auto-install browser if missing ──────────────────────
async function launchBrowser(browserName, options) {
  const engine = getBrowserEngine(browserName);
  const isJson = options.json || false;

  try {
    return await engine.launch({ headless: isJson });
  } catch (e) {
    if (e.message.includes("Executable doesn't exist") || e.message.includes('executable')) {
      const name = browserName === 'safari' ? 'webkit' : (browserName || 'chromium');

      if (!isJson) {
        console.log(chalk.yellow(`\n  📦 Installing ${name} browser — one time setup...\n`));
      } else {
        process.stderr.write(`📦 Installing ${name} browser — one time setup...\n`);
      }

      execSync(`npx playwright install ${name}`, {
        stdio: isJson ? 'ignore' : 'inherit'
      });

      return await engine.launch({ headless: isJson });
    }
    throw e;
  }
}


// ── Helpers ───────────────────────────────────────────────
async function clickAndWait(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function getPageHeading(page) {
  return await page.$eval(
    'h1, h2, [class*="page-title"], [class*="module-title"], [class*="header-title"]',
    el => el.innerText.trim()
  ).catch(() => '');
}


// ── Menu Collector ────────────────────────────────────────
async function getVisibleMenuItems(page) {
  return await page.evaluate(() => {
    const results    = [];
    const seen       = new Set();
    const baseDomain = window.location.hostname;

    const selectors = [
      'nav a', 'header nav a', '[role="navigation"] a',
      '.sidebar a', '.side-nav a', '.sidenav a', '#sidebar a',
      '[class*="sidebar"] a', '[class*="side-nav"] a',
      '[class*="sidemenu"] a', '[class*="sideNav"] a',
      '.menu a', '.nav a', '.navbar a',
      '[class*="menu"] a', '[class*="nav"] a',
      '[class*="nav-item"] a', '[class*="nav-link"] a',
      'nav li a', 'nav li',
      'ul[role="menu"] li a', 'ul[role="menubar"] li a',
      '[role="menuitem"]', '[role="tab"]', '[role="treeitem"]',
      '.sidebar button', 'nav button',
      '[class*="nav"] button', '[class*="menu"] button',
      '[class*="menu"] li', '[class*="nav"] li',
    ];

    const BLOCKED = [
      'sign out', 'log out', 'logout', 'signout',
      'delete', 'remove', 'reset', 'export all',
    ];

    for (const selector of selectors) {
      let elements;
      try { elements = document.querySelectorAll(selector); }
      catch (e) { continue; }

      for (const el of elements) {
        const text = el.innerText?.trim();
        const href = el.getAttribute('href') || el.href || '';

        if (!text || text.length < 2 || text.length > 80) continue;
        if (seen.has(text.toLowerCase())) continue;

        const lower = text.toLowerCase();
        if (BLOCKED.some(b => lower.includes(b))) continue;
        if (href.startsWith('http') && !href.includes(baseDomain) && href !== '') continue;

        const rect  = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (rect.width === 0 || rect.height === 0) continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.offsetParent === null && style.position !== 'fixed') continue;

        seen.add(text.toLowerCase());
        results.push({ text, href });
      }

      if (results.length >= 5 && selector.includes(' a')) break;
    }

    return results;
  });
}


// ── Safe Click ────────────────────────────────────────────
async function safeClick(page, text) {
  if (isDangerous(text)) return false;

  try {
    const allEls = await page.getByText(text, { exact: true }).all();

    for (const el of allEls) {
      const isVisible = await el.isVisible().catch(() => false);
      if (!isVisible) continue;

      const tagInfo = await el.evaluate(node => ({
        tag:        node.tagName.toLowerCase(),
        type:       node.getAttribute('type') || '',
        disabled:   node.disabled || false,
        hasConfirm: (node.getAttribute('onclick') || '').includes('confirm'),
      })).catch(() => null);

      if (!tagInfo)           continue;
      if (tagInfo.disabled)   continue;
      if (tagInfo.hasConfirm) continue;

      if (tagInfo.tag === 'button' && tagInfo.type === 'submit') {
        const isNavButton = await el.evaluate(node =>
          !!node.closest('nav, [class*="sidebar"], [class*="menu"], [class*="nav"]')
        ).catch(() => false);
        if (!isNavButton) continue;
      }

      await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await el.click({ timeout: 5000 });
      return true;
    }
  } catch (e1) {}

  // ── DOM fallback — visible only ───────────────────
  try {
    const clicked = await page.evaluate((text) => {
      const all = Array.from(document.querySelectorAll(
        'a, button, li, span, div[class*="nav"], div[class*="menu"], [role="menuitem"], [role="tab"], [role="treeitem"]'
      ));
      const el = all.find(a => {
        if (a.innerText.trim() !== text) return false;
        const rect  = a.getBoundingClientRect();
        const style = window.getComputedStyle(a);
        return (
          rect.width  > 0 &&
          rect.height > 0 &&
          style.display    !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity    !== '0'
        );
      });
      if (el) { el.click(); return true; }
      return false;
    }, text);

    if (clicked) {
      await page.waitForTimeout(500);
      return true;
    }
  } catch (e2) {}

  return false;
}


async function isPageAlive(page) {
  try { await page.title(); return true; }
  catch (e) { return false; }
}


// ── Build JSON Result ─────────────────────────────────────
function buildJsonResult(log, testUrl, elapsed, options) {
  const passed        = log.filter(l =>  l.pass).length;
  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass &&  l.external).length;

  const types = ['login', 'page', 'nav', 'subnav', 'api', 'image', 'resource', 'console'];
  const breakdown = {};
  types.forEach(type => {
    const entries = log.filter(l => l.type === type);
    breakdown[type] = {
      pass: entries.filter(l =>  l.pass).length,
      fail: entries.filter(l => !l.pass).length,
    };
  });

  return {
    meta: {
      url:       testUrl,
      timestamp: new Date().toISOString(),
      duration:  parseFloat(elapsed),
      mode:      options.quick ? 'quick' : 'deep',
      browser:   options.browser || 'chrome',
    },
    summary: {
      total:            log.length,
      passed,
      failed:           internalFails,
      externalWarnings: externalFails,
      status:           internalFails === 0 ? 'PASS' : 'FAIL',
    },
    breakdown,
    events: log,
  };
}


// ── Print Log ─────────────────────────────────────────────
function printLog(log, testUrl, elapsed, options = {}) {
  const divider = chalk.gray('─'.repeat(65));

  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass &&  l.external).length;
  const passed        = log.filter(l =>  l.pass).length;

  console.log('\n' + divider);
  console.log(chalk.bold.cyan('  🤖 AUTOTEST SESSION LOG'));
  console.log(chalk.gray(`  URL     : ${testUrl}`));
  console.log(chalk.gray(`  Date    : ${new Date().toLocaleString()}`));
  console.log(chalk.gray(`  Time    : ${elapsed}s`));
  console.log(chalk.gray(`  Mode    : ${options.quick ? '⚡ Quick' : '🔬 Deep'}${options.onlyFailures ? ' | Failures Only' : ''}`));
  console.log(chalk.gray(`  Browser : ${options.browser || 'chrome'}`));
  console.log(divider + '\n');

  const icons = {
    login:    '🔐',
    page:     '🌐',
    nav:      '🧭',
    subnav:   '↳ ',
    api:      '📡',
    image:    '🖼️ ',
    resource: '📦',
    console:  '⚠️ ',
  };

  let printed = 0;
  log.forEach(entry => {
    if (options.onlyFailures && entry.pass) return;
    printed++;

    const icon        = icons[entry.type] || '•';
    const statusText  = entry.status !== null ? chalk.gray(` → ${entry.status}`) : '';
    const externalTag = entry.external ? chalk.yellow(' [external]') : '';
    const indent      = entry.type === 'subnav' ? '      ' : '  ';

    const line = entry.pass
      ? chalk.green(`${indent}✔  ${icon}  ${entry.label}`) + statusText + externalTag
      : entry.external
        ? chalk.yellow(`${indent}⚠  ${icon}  ${entry.label}`) + statusText + externalTag
        : chalk.red(`${indent}✘  ${icon}  ${entry.label}`) + statusText + externalTag;

    console.log(line);
  });

  if (options.onlyFailures && printed === 0) {
    console.log(chalk.green('  ✔  All checks passed — no failures found!'));
  }

  console.log('\n' + divider);
  console.log(
    `  ${chalk.bold('Summary :')} ` +
    chalk.green(`${passed} OK`) + chalk.gray(' / ') +
    (internalFails > 0 ? chalk.red(`${internalFails} FAILED`) : chalk.green('0 FAILED')) +
    (externalFails > 0 ? chalk.yellow(` / ${externalFails} external warnings`) : '') +
    chalk.gray(` / ${log.length} total events`)
  );
  console.log(`  ${chalk.bold('Time    :')} ` + chalk.gray(`${elapsed}s`));
  console.log(
    `  ${chalk.bold('Status  :')} ` +
    (internalFails === 0
      ? chalk.bgGreen.black(' ALL CLEAR ✓ ')
      : chalk.bgRed.white(` ${internalFails} ISSUE(S) FOUND ✗ `))
  );
  console.log(divider + '\n');
}


// ── Main ──────────────────────────────────────────────────
async function runTests(url, options = {}) {
  const startTime = Date.now();
  const isJson    = options.json || false;
  const print     = (msg) => { if (!isJson) console.log(msg); };

  // ── JSON progress messages → stderr ──────────────
  // stdout = pure JSON (for SaaS)
  // stderr = human progress (for user)
  const status = (msg) => {
    if (isJson) process.stderr.write(msg + '\n');
  };

  // ── Spinner — silent in JSON mode ────────────────
  const spinner = isJson
    ? { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {}, warn: () => {}, text: '' }
    : ora('Launching browser...').start();

  if (!isJson) {
    spinner.stop();
    console.log(chalk.gray(`\n  🌐 Browser : ${options.browser || 'chrome'}`));
    spinner.start('Launching browser...');
  }

  status(`🚀 Launching ${options.browser || 'chrome'} browser...`);
  const browser    = await launchBrowser(options.browser, options);
  const page       = await browser.newPage();
  const log        = [];
  const baseDomain = new URL(url).hostname;
  const seenAPIs   = new Set();
  const seenErrors = new Set();

  if (!isJson) spinner.stop();


  // ── Helper — finish and output ───────────────────
  async function finish() {
    status('✅ Tests complete — building report...');
    await browser.close();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (isJson) {
      process.stdout.write(JSON.stringify(buildJsonResult(log, testUrl, elapsed, options), null, 2));
    } else {
      printLog(log, testUrl, elapsed, options);
    }
  }


  // ── SECURITY: Dialogs ────────────────────────────
  page.on('dialog', async dialog => {
    print(chalk.yellow(`  ⚠  Dialog dismissed: "${dialog.message().slice(0, 60)}"`));
    await dialog.dismiss().catch(() => {});
  });

  // ── SECURITY: New tabs ───────────────────────────
  page.context().on('page', async newPage => {
    print(chalk.yellow(`  ⚠  New tab blocked: ${newPage.url()}`));
    await newPage.close().catch(() => {});
  });

  // ── SECURITY: Downloads ──────────────────────────
  page.on('download', async download => {
    print(chalk.yellow(`  ⚠  Download blocked: ${download.suggestedFilename()}`));
    await download.cancel().catch(() => {});
    log.push({
      type: 'console', pass: false,
      label: `Unexpected download triggered: ${download.suggestedFilename()}`,
      status: null, external: false
    });
  });


  // ── Response listener ────────────────────────────
  page.on('response', async response => {
    const type       = response.request().resourceType();
    const status     = response.status();
    const reqUrl     = response.url();
    const method     = response.request().method();
    const isExternal = !reqUrl.includes(baseDomain);

    if (SKIP_DOMAINS.some(d => reqUrl.includes(d))) return;

    if (type === 'xhr' || type === 'fetch') {
      const pass   = status < 400;
      const apiKey = `${method}:${reqUrl}`;
      if (!seenAPIs.has(apiKey) || !pass) {
        seenAPIs.add(apiKey);
        log.push({
          type: 'api', pass,
          label: `[${method}] ${reqUrl}`,
          status, external: isExternal
        });
      }
    }

    if (status === 404) {
      const isAsset = ['image', 'stylesheet', 'script', 'font'].includes(type);
      if (isAsset) {
        log.push({
          type: 'resource', pass: false,
          label: `Missing resource: ${reqUrl}`,
          status: 404, external: isExternal
        });
      }
    }
  });


  // ── Console errors ───────────────────────────────
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text       = msg.text();
      const normalized = text.replace(/https?:\/\/[^\s'"()]*/g, '<URL>').trim();
      if (!seenErrors.has(normalized)) {
        seenErrors.add(normalized);
        log.push({
          type: 'console', pass: false,
          label: `Console error: ${normalized}`,
          status: null, external: false
        });
      }
    }
  });


  // ── LOGIN ────────────────────────────────────────
  let testUrl = url;

  if (options.username && options.password) {
    status('🔐 Logging in...');
    await login(page, { ...options, url });
    testUrl = page.url();
    status('🔐 Login successful...');
    log.push({
      type: 'login', pass: true,
      label: `Login → ${testUrl}`,
      status: 200, external: false
    });
  }


  // ── PAGE LOAD ────────────────────────────────────
  status('🌐 Loading page...');
  if (!isJson) spinner.start('Checking page...');

  try {
    let pageStatus = 200;

    if (!options.username && !options.password) {
      const response = await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
      pageStatus = response.status();

      const currentUrl  = page.url();
      const isLoginPage =
        currentUrl.toLowerCase().includes('login') ||
        currentUrl.toLowerCase().includes('signin');

      if (isLoginPage) {
        if (!isJson) spinner.stop();
        log.push({
          type: 'console', pass: false,
          label: 'Page requires login — use -u and -p flags to authenticate',
          status: null, external: false
        });
        return await finish();
      }
    } else {
      const currentUrl  = page.url();
      const isLoginPage =
        currentUrl.toLowerCase().includes('login') ||
        currentUrl.toLowerCase().includes('signin');

      if (isLoginPage) {
        if (!isJson) spinner.stop();
        log.push({
          type: 'console', pass: false,
          label: 'Login failed — still on login page. Check credentials.',
          status: null, external: false
        });
        return await finish();
      }
    }

    log.push({
      type: 'page', pass: pageStatus < 400,
      label: `Page Load → ${testUrl}`,
      status: pageStatus, external: false
    });
  } catch (e) {
    log.push({
      type: 'page', pass: false,
      label: `Page Load failed: ${e.message}`,
      status: null, external: false
    });
  }
  if (!isJson) spinner.stop();
  status('🌐 Page loaded — scanning...');


  // ── BROKEN IMAGES ────────────────────────────────
  const brokenImages = await page.$$eval('img', imgs =>
    imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)
  );
  brokenImages.forEach(src => {
    log.push({
      type: 'image', pass: false,
      label: `Broken image: ${src}`,
      status: 404, external: !src.includes(baseDomain)
    });
  });


  // ── COLLECT MAIN MENU ────────────────────────────
  const mainMenuItems   = await getVisibleMenuItems(page);
  const uniqueMainItems = mainMenuItems.filter((item, index, self) =>
    index === self.findIndex(i => i.text === item.text)
  );

  status(`🧭 Found ${uniqueMainItems.length} menu items — running ${options.quick ? 'quick' : 'deep'} test...`);
  print(chalk.gray(
    `\n  Found ${uniqueMainItems.length} main menu items` +
    ` — ${options.quick ? '⚡ quick mode' : '🔬 deep mode'}\n`
  ));


  // ── CLICK EACH MAIN MENU ITEM ─────────────────────
  for (let i = 0; i < uniqueMainItems.length; i++) {
    const mainItem = uniqueMainItems[i];

    status(`  ⏳ [${i + 1}/${uniqueMainItems.length}] Testing → ${mainItem.text}...`);

    const spinner2 = isJson ? null : ora(
      chalk.cyan(`[${i + 1}/${uniqueMainItems.length}] Testing → ${mainItem.text}...`)
    ).start();

    try {
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);

      if (!await isPageAlive(page)) {
        if (spinner2) spinner2.warn(chalk.yellow(`${mainItem.text} → page context lost, skipping`));
        continue;
      }

      const clicked = await safeClick(page, mainItem.text);
      if (!clicked) {
        if (spinner2) spinner2.warn(chalk.yellow(`Skipped → ${mainItem.text} (blocked or not clickable)`));
        continue;
      }

      await clickAndWait(page);

      // ── External redirect guard ──────────────
      const currentUrl = page.url();
      const isExternal =
        !currentUrl.includes(baseDomain) &&
        !currentUrl.startsWith('about:') &&
        !currentUrl.startsWith('data:') &&
        !currentUrl.startsWith('blob:');

      if (isExternal) {
        print(chalk.yellow(`  ⚠  External redirect → ${currentUrl} — returning home`));
        await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
        log.push({
          type: 'nav', pass: false,
          label: `Nav → ${mainItem.text} → external domain redirect`,
          status: 'external redirect', external: true
        });
        if (spinner2) spinner2.warn(chalk.yellow(`${mainItem.text} → external redirect`));
        continue;
      }

      const loggedOut = currentUrl.toLowerCase().includes('login');
      const heading   = await getPageHeading(page);

      log.push({
        type: 'nav', pass: !loggedOut,
        label: `Nav → ${mainItem.text}${heading ? ' → "' + heading + '"' : ''}`,
        status: loggedOut ? 'redirected to login' : 200,
        external: false
      });

      if (loggedOut) {
        if (spinner2) spinner2.fail(chalk.red(`${mainItem.text} → redirected to login!`));
        continue;
      }

      // ── QUICK MODE ───────────────────────────
      if (options.quick) {
        if (spinner2) spinner2.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(' → ⚡ quick'));
        continue;
      }

      // ── DEEP MODE — sub items ────────────────
      const allVisibleNow  = await getVisibleMenuItems(page);
      const subItems       = allVisibleNow.filter(s =>
        !uniqueMainItems.find(m => m.text === s.text) &&
        s.text !== mainItem.text
      );
      const uniqueSubItems = subItems.filter((item, index, self) =>
        index === self.findIndex(i => i.text === item.text)
      );

      if (spinner2) {
        spinner2.text = chalk.cyan(
          `[${i + 1}/${uniqueMainItems.length}] ${mainItem.text}` +
          ` → ${uniqueSubItems.length} sub items...`
        );
      }

      for (const subItem of uniqueSubItems) {
        try {
          if (!await isPageAlive(page)) break;

          const subClicked = await safeClick(page, subItem.text);
          if (!subClicked) {
            log.push({
              type: 'subnav', pass: false,
              label: `Sub → ${subItem.text}`,
              status: 'blocked or not clickable', external: false
            });
            continue;
          }

          await clickAndWait(page);

          const subUrl      = page.url();
          const subExternal =
            !subUrl.includes(baseDomain) &&
            !subUrl.startsWith('about:') &&
            !subUrl.startsWith('blob:');

          if (subExternal) {
            log.push({
              type: 'subnav', pass: false,
              label: `Sub → ${subItem.text} → external redirect`,
              status: 'external redirect', external: true
            });
            await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
            await safeClick(page, mainItem.text);
            await clickAndWait(page);
            continue;
          }

          const subLoggedOut = subUrl.toLowerCase().includes('login');
          const subHeading   = await getPageHeading(page);

          log.push({
            type: 'subnav', pass: !subLoggedOut,
            label: `Sub → ${subItem.text}${subHeading ? ' → "' + subHeading + '"' : ''}`,
            status: subLoggedOut ? 'redirected to login' : 200,
            external: false
          });

          await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(400);
          await safeClick(page, mainItem.text);
          await clickAndWait(page);

        } catch (e) {
          log.push({
            type: 'subnav', pass: false,
            label: `Sub → ${subItem.text}`,
            status: 'click failed', external: false
          });
        }
      }

      const subInfo = uniqueSubItems.length > 0
        ? `${uniqueSubItems.length} sub items tested`
        : 'no sub items found';
      if (spinner2) spinner2.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(` → ${subInfo}`));

    } catch (e) {
      if (spinner2) spinner2.fail(chalk.red(`${mainItem.text} → ${e.message.split('\n')[0]}`));
      log.push({
        type: 'nav', pass: false,
        label: `Nav → ${mainItem.text}`,
        status: 'click failed', external: false
      });
    }
  }

  return await finish();
}


module.exports = { runTests };
