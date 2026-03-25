const { chromium } = require('playwright');
const chalk = require('chalk');
const ora = require('ora');
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


// ── External redirect guard ───────────────────────────────
async function guardExternalRedirect(page, baseDomain, testUrl) {
  const currentUrl = page.url();
  const isExternal =
    !currentUrl.includes(baseDomain) &&
    !currentUrl.startsWith('about:') &&
    !currentUrl.startsWith('data:') &&
    !currentUrl.startsWith('blob:');

  if (isExternal) {
    console.log(chalk.yellow(`  ⚠  External redirect → ${currentUrl} — returning home`));
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    return true;
  }
  return false;
}


// ── Menu Collector ────────────────────────────────────────
async function getVisibleMenuItems(page) {
  return await page.evaluate(() => {
    const results = [];
    const seen = new Set();
    const baseDomain = window.location.hostname;

    const selectors = [
      'nav a',
      'header nav a',
      '[role="navigation"] a',
      '.sidebar a',
      '.side-nav a',
      '.sidenav a',
      '#sidebar a',
      '[class*="sidebar"] a',
      '[class*="side-nav"] a',
      '[class*="sidemenu"] a',
      '[class*="sideNav"] a',
      '.menu a',
      '.nav a',
      '.navbar a',
      '[class*="menu"] a',
      '[class*="nav"] a',
      '[class*="nav-item"] a',
      '[class*="nav-link"] a',
      'nav li a',
      'nav li',
      'ul[role="menu"] li a',
      'ul[role="menubar"] li a',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="treeitem"]',
      '.sidebar button',
      'nav button',
      '[class*="nav"] button',
      '[class*="menu"] button',
      '[class*="menu"] li',
      '[class*="nav"] li',
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

        const rect = el.getBoundingClientRect();
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
  if (isDangerous(text)) {
    console.log(chalk.yellow(`  ⚠  Blocked dangerous click → "${text}"`));
    return false;
  }

  try {
    const el = page.getByText(text, { exact: true }).first();
    await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});

    const tagInfo = await el.evaluate(node => ({
      tag:        node.tagName.toLowerCase(),
      type:       node.getAttribute('type') || '',
      disabled:   node.disabled || false,
      hasConfirm: (node.getAttribute('onclick') || '').includes('confirm'),
    })).catch(() => null);

    if (!tagInfo) return false;
    if (tagInfo.disabled) return false;
    if (tagInfo.hasConfirm) {
      console.log(chalk.yellow(`  ⚠  Blocked confirm-action → "${text}"`));
      return false;
    }

    if (tagInfo.tag === 'button' && tagInfo.type === 'submit') {
      const isNavButton = await el.evaluate(node =>
        !!node.closest('nav, [class*="sidebar"], [class*="menu"], [class*="nav"]')
      ).catch(() => false);
      if (!isNavButton) {
        console.log(chalk.yellow(`  ⚠  Blocked form submit → "${text}"`));
        return false;
      }
    }

    await el.click({ timeout: 5000 });
    return true;

  } catch (e1) {
    try {
      // ── FIX 2: Added span, div, role selectors ──────
      const clicked = await page.evaluate((text) => {
        const all = Array.from(document.querySelectorAll(
          'a, button, li, span, div[class*="nav"], div[class*="menu"], [role="menuitem"], [role="tab"], [role="treeitem"]'
        ));
        const el = all.find(a => a.innerText.trim() === text);
        if (el) { el.click(); return true; }
        return false;
      }, text);
      if (clicked) {
        await page.waitForTimeout(500);
        return true;
      }
    } catch (e2) {}
  }
  return false;
}


async function isPageAlive(page) {
  try { await page.title(); return true; }
  catch (e) { return false; }
}


// ── Print Log ─────────────────────────────────────────────
function printLog(log, testUrl, elapsed, options = {}) {
  const divider = chalk.gray('─'.repeat(65));

  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass && l.external).length;
  const passed        = log.filter(l => l.pass).length;

  console.log('\n' + divider);
  console.log(chalk.bold.cyan('  🤖 AUTOTEST SESSION LOG'));
  console.log(chalk.gray(`  URL  : ${testUrl}`));
  console.log(chalk.gray(`  Date : ${new Date().toLocaleString()}`));
  console.log(chalk.gray(`  Time : ${elapsed}s`));
  console.log(chalk.gray(`  Mode : ${options.quick ? '⚡ Quick' : '🔬 Deep'}${options.onlyFailures ? ' | Failures Only' : ''}`));
  console.log(divider + '\n');

  const icons = {
    login:    '🔐',
    page:     '🌐',
    nav:      '🧭',
    subnav:   '↳ ',
    api:      '📡',
    image:    '🖼️ ',
    resource: '📦',
    console:  '⚠️ '
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
async function runTests(url, options) {
  const startTime  = Date.now();
  const spinner    = ora('Launching browser...').start();
  const browser    = await chromium.launch({ headless: false });
  const page       = await browser.newPage();
  const log        = [];
  const baseDomain = new URL(url).hostname;

  // ── FIX 3: Deduplicate API logs ──────────────────────
  const seenAPIs = new Set();


  // ── SECURITY: Auto-dismiss dialogs ───────────────────
  page.on('dialog', async dialog => {
    console.log(chalk.yellow(`  ⚠  Dialog dismissed: "${dialog.message().slice(0, 60)}"`));
    await dialog.dismiss().catch(() => {});
  });


  // ── SECURITY: Close new tabs ──────────────────────────
  page.context().on('page', async newPage => {
    console.log(chalk.yellow(`  ⚠  New tab blocked: ${newPage.url()}`));
    await newPage.close().catch(() => {});
  });


  // ── SECURITY: Cancel downloads ────────────────────────
  page.on('download', async download => {
    console.log(chalk.yellow(`  ⚠  Download blocked: ${download.suggestedFilename()}`));
    await download.cancel().catch(() => {});
    log.push({
      type: 'console', pass: false,
      label: `Unexpected download triggered: ${download.suggestedFilename()}`,
      status: null, external: false
    });
  });


  // ── Response listener ────────────────────────────────
  page.on('response', async response => {
    const type       = response.request().resourceType();
    const status     = response.status();
    const reqUrl     = response.url();
    const method     = response.request().method();
    const isExternal = !reqUrl.includes(baseDomain);

    if (type === 'xhr' || type === 'fetch') {
      const pass   = status < 400;
      const apiKey = `${method}:${reqUrl}`;

      // ── FIX 3: Only log unique APIs, always log failures ──
      if (!seenAPIs.has(apiKey) || !pass) {
        seenAPIs.add(apiKey);
        log.push({
          type: 'api',
          pass,
          label: `[${method}] ${reqUrl}`,
          status,
          external: isExternal
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


  // ── Console errors ───────────────────────────────────
  const seenErrors = new Set();
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


  // ── LOGIN ────────────────────────────────────────────
  let testUrl = url;
  spinner.stop();

  if (options.username && options.password) {
    await login(page, { ...options, url });
    testUrl = page.url();
    log.push({
      type: 'login', pass: true,
      label: `Login → ${testUrl}`,
      status: 200, external: false
    });
  }


  // ── PAGE LOAD ────────────────────────────────────────
  spinner.start('Checking page...');
  try {
    let status = 200;

    if (!options.username && !options.password) {
      // ── FIX 1: domcontentloaded instead of networkidle ──
      const response = await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
      status = response.status();

      const currentUrl  = page.url();
      const isLoginPage =
        currentUrl.toLowerCase().includes('login') ||
        currentUrl.toLowerCase().includes('signin');

      if (isLoginPage) {
        spinner.stop();
        log.push({
          type: 'console', pass: false,
          label: 'Page requires login — use -u and -p flags to authenticate',
          status: null, external: false
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        printLog(log, testUrl, elapsed, options);
        await browser.close();
        return;
      }
    } else {
      const currentUrl  = page.url();
      const isLoginPage =
        currentUrl.toLowerCase().includes('login') ||
        currentUrl.toLowerCase().includes('signin');

      if (isLoginPage) {
        spinner.stop();
        log.push({
          type: 'console', pass: false,
          label: 'Login failed — still on login page. Check credentials.',
          status: null, external: false
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        printLog(log, testUrl, elapsed, options);
        await browser.close();
        return;
      }
    }

    log.push({
      type: 'page', pass: status < 400,
      label: `Page Load → ${testUrl}`,
      status, external: false
    });
  } catch (e) {
    log.push({
      type: 'page', pass: false,
      label: `Page Load failed: ${e.message}`,
      status: null, external: false
    });
  }
  spinner.stop();


  // ── BROKEN IMAGES ────────────────────────────────────
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


  // ── COLLECT MAIN MENU ────────────────────────────────
  const mainMenuItems   = await getVisibleMenuItems(page);
  const uniqueMainItems = mainMenuItems.filter((item, index, self) =>
    index === self.findIndex(i => i.text === item.text)
  );

  console.log(chalk.gray(
    `\n  Found ${uniqueMainItems.length} main menu items` +
    ` — ${options.quick ? '⚡ quick mode' : '🔬 deep mode'}\n`
  ));


  // ── CLICK EACH MAIN MENU ITEM ─────────────────────────
  for (let i = 0; i < uniqueMainItems.length; i++) {
    const mainItem = uniqueMainItems[i];
    const spinner2 = ora(
      chalk.cyan(`[${i + 1}/${uniqueMainItems.length}] Testing → ${mainItem.text}...`)
    ).start();

    try {
      // ── FIX 1: domcontentloaded ──────────────────────
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);

      if (!await isPageAlive(page)) {
        spinner2.warn(chalk.yellow(`${mainItem.text} → page context lost, skipping`));
        continue;
      }

      const clicked = await safeClick(page, mainItem.text);
      if (!clicked) {
        spinner2.warn(chalk.yellow(`Skipped → ${mainItem.text} (blocked or not clickable)`));
        continue;
      }

      await clickAndWait(page);

      // ── Guard external redirect ──────────────────────
      const wasRedirected = await guardExternalRedirect(page, baseDomain, testUrl);
      if (wasRedirected) {
        log.push({
          type: 'nav', pass: false,
          label: `Nav → ${mainItem.text} → external domain redirect`,
          status: 'external redirect', external: true
        });
        spinner2.warn(chalk.yellow(`${mainItem.text} → external redirect — returned home`));
        continue;
      }

      const currentUrl = page.url();
      const loggedOut  = currentUrl.toLowerCase().includes('login');
      const heading    = await getPageHeading(page);

      log.push({
        type: 'nav', pass: !loggedOut,
        label: `Nav → ${mainItem.text}${heading ? ' → "' + heading + '"' : ''}`,
        status: loggedOut ? 'redirected to login' : 200,
        external: false
      });

      if (loggedOut) {
        spinner2.fail(chalk.red(`${mainItem.text} → redirected to login!`));
        continue;
      }

      // ── QUICK MODE ─────────────────────────────────
      if (options.quick) {
        spinner2.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(' → ⚡ quick'));
        continue;
      }

      // ── DEEP MODE — sub items ──────────────────────
      const allVisibleNow  = await getVisibleMenuItems(page);
      const subItems       = allVisibleNow.filter(s =>
        !uniqueMainItems.find(m => m.text === s.text) &&
        s.text !== mainItem.text
      );
      const uniqueSubItems = subItems.filter((item, index, self) =>
        index === self.findIndex(i => i.text === item.text)
      );

      spinner2.text = chalk.cyan(
        `[${i + 1}/${uniqueMainItems.length}] ${mainItem.text}` +
        ` → ${uniqueSubItems.length} sub items...`
      );

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

          const subRedirected = await guardExternalRedirect(page, baseDomain, testUrl);
          if (subRedirected) {
            log.push({
              type: 'subnav', pass: false,
              label: `Sub → ${subItem.text} → external domain redirect`,
              status: 'external redirect', external: true
            });
            await safeClick(page, mainItem.text);
            await clickAndWait(page);
            continue;
          }

          const subUrl       = page.url();
          const subLoggedOut = subUrl.toLowerCase().includes('login');
          const subHeading   = await getPageHeading(page);

          log.push({
            type: 'subnav', pass: !subLoggedOut,
            label: `Sub → ${subItem.text}${subHeading ? ' → "' + subHeading + '"' : ''}`,
            status: subLoggedOut ? 'redirected to login' : 200,
            external: false
          });

          // ── FIX 1: domcontentloaded ────────────────
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
      spinner2.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(` → ${subInfo}`));

    } catch (e) {
      spinner2.fail(chalk.red(`${mainItem.text} → ${e.message.split('\n')[0]}`));
      log.push({
        type: 'nav', pass: false,
        label: `Nav → ${mainItem.text}`,
        status: 'click failed', external: false
      });
    }
  }

  await browser.close();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  printLog(log, testUrl, elapsed, options);
}


module.exports = { runTests };
