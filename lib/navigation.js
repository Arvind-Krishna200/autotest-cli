/**
 * Navigation testing - clicking through menus and sub-menus
 */

const chalk = require('chalk');
const ora = require('ora');
const {
  getVisibleMenuItems,
  getPageHeading,
  clickAndWait,
  safeClick,
} = require('./selectors');
const { isPageAlive, isLoginPage, isExternalUrl } = require('./validators');

/**
 * Click a single main menu item and test it
 */
async function testMainMenuItem(
  page,
  mainItem,
  index,
  total,
  testUrl,
  baseDomain,
  log,
  options = {}
) {
  const isJson = options.json || false;
  const status = options.status || (() => {});

  status(`  ⏳ [${index + 1}/${total}] Testing → ${mainItem.text}...`);

  const spinner = isJson
    ? null
    : ora(
        chalk.cyan(`[${index + 1}/${total}] Testing → ${mainItem.text}...`)
      ).start();

  try {
    await page
      .goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    if (!(await isPageAlive(page))) {
      if (spinner)
        spinner.warn(
          chalk.yellow(`${mainItem.text} → page context lost, skipping`)
        );
      return null;
    }

    const clicked = await safeClick(page, mainItem.text);
    if (!clicked) {
      if (spinner)
        spinner.warn(
          chalk.yellow(`Skipped → ${mainItem.text} (blocked or not clickable)`)
        );
      return null;
    }

    await clickAndWait(page);

    const currentUrl = page.url();
    const external = isExternalUrl(currentUrl, baseDomain);

    if (external) {
      const print = options.print || (() => {});
      print(chalk.yellow(`  ⚠  External redirect → ${currentUrl} — returning home`));
      await page
        .goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 })
        .catch(() => {});
      log.push({
        type: 'nav',
        pass: false,
        label: `Nav → ${mainItem.text} → external domain redirect`,
        status: 'external redirect',
        external: true,
      });
      if (spinner)
        spinner.warn(chalk.yellow(`${mainItem.text} → external redirect`));
      return null;
    }

    const loggedOut = isLoginPage(currentUrl);
    const heading = await getPageHeading(page);

    log.push({
      type: 'nav',
      pass: !loggedOut,
      label: `Nav → ${mainItem.text}${
        heading ? ' → "' + heading + '"' : ''
      }`,
      status: loggedOut ? 'redirected to login' : 200,
      external: false,
    });

    if (loggedOut) {
      if (spinner)
        spinner.fail(chalk.red(`${mainItem.text} → redirected to login!`));
      return null;
    }

    return { mainItem, heading, spinner };
  } catch (e) {
    if (spinner)
      spinner.fail(
        chalk.red(`${mainItem.text} → ${e.message.split('\n')[0]}`)
      );
    log.push({
      type: 'nav',
      pass: false,
      label: `Nav → ${mainItem.text}`,
      status: 'click failed',
      external: false,
    });
    return null;
  }
}

/**
 * Test sub-menu items for a main menu item (deep mode)
 */
async function testSubMenuItems(
  page,
  mainItem,
  testUrl,
  baseDomain,
  log,
  options = {}
) {
  const allVisibleNow = await getVisibleMenuItems(page);
  const uniqueMainItems = options.uniqueMainItems || [];
  const subItems = allVisibleNow.filter(
    s =>
      !uniqueMainItems.find(m => m.text === s.text) &&
      s.text !== mainItem.text
  );
  const uniqueSubItems = subItems.filter(
    (item, index, self) =>
      index === self.findIndex(i => i.text === item.text)
  );

  for (const subItem of uniqueSubItems) {
    try {
      if (!(await isPageAlive(page))) break;

      const subClicked = await safeClick(page, subItem.text);
      if (!subClicked) {
        log.push({
          type: 'subnav',
          pass: false,
          label: `Sub → ${subItem.text}`,
          status: 'blocked or not clickable',
          external: false,
        });
        continue;
      }

      await clickAndWait(page);

      const subUrl = page.url();
      const subExternal = isExternalUrl(subUrl, baseDomain);

      if (subExternal) {
        log.push({
          type: 'subnav',
          pass: false,
          label: `Sub → ${subItem.text} → external redirect`,
          status: 'external redirect',
          external: true,
        });
        await page
          .goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 })
          .catch(() => {});
        await safeClick(page, mainItem.text);
        await clickAndWait(page);
        continue;
      }

      const subLoggedOut = isLoginPage(subUrl);
      const subHeading = await getPageHeading(page);

      log.push({
        type: 'subnav',
        pass: !subLoggedOut,
        label: `Sub → ${subItem.text}${
          subHeading ? ' → "' + subHeading + '"' : ''
        }`,
        status: subLoggedOut ? 'redirected to login' : 200,
        external: false,
      });

      await page
        .goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 8000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      await safeClick(page, mainItem.text);
      await clickAndWait(page);
    } catch (e) {
      log.push({
        type: 'subnav',
        pass: false,
        label: `Sub → ${subItem.text}`,
        status: 'click failed',
        external: false,
      });
    }
  }

  return uniqueSubItems;
}

/**
 * Test all navigation items (main and optionally sub)
 */
async function testNavigation(
  page,
  testUrl,
  baseDomain,
  log,
  options = {}
) {
  const isJson = options.json || false;
  const print = options.print || (() => {});
  const status = options.status || (() => {});

  // Collect main menu items
  const mainMenuItems = await getVisibleMenuItems(page);
  const uniqueMainItems = mainMenuItems.filter(
    (item, index, self) =>
      index === self.findIndex(i => i.text === item.text)
  );

  status(
    `🧭 Found ${uniqueMainItems.length} menu items — running ${
      options.quick ? 'quick' : 'deep'
    } test...`
  );
  print(
    chalk.gray(
      `\n  Found ${uniqueMainItems.length} main menu items` +
        ` — ${options.quick ? '⚡ quick mode' : '🔬 deep mode'}\n`
    )
  );

  // Test each main menu item
  for (let i = 0; i < uniqueMainItems.length; i++) {
    const mainItem = uniqueMainItems[i];

    const result = await testMainMenuItem(
      page,
      mainItem,
      i,
      uniqueMainItems.length,
      testUrl,
      baseDomain,
      log,
      { ...options, status, print }
    );

    if (!result) continue;

    const { spinner } = result;

    // Quick mode — only main items
    if (options.quick) {
      if (spinner) spinner.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(' → ⚡ quick'));
      continue;
    }

    // Deep mode — test sub-items
    if (spinner) {
      spinner.text = chalk.cyan(
        `[${i + 1}/${uniqueMainItems.length}] ${mainItem.text} → testing sub items...`
      );
    }

    const uniqueSubItems = await testSubMenuItems(
      page,
      mainItem,
      testUrl,
      baseDomain,
      log,
      { ...options, uniqueMainItems }
    );

    const subInfo =
      uniqueSubItems.length > 0
        ? `${uniqueSubItems.length} sub items tested`
        : 'no sub items found';
    if (spinner)
      spinner.succeed(chalk.green(`${mainItem.text}`) + chalk.gray(` → ${subInfo}`));
  }
}

module.exports = {
  testNavigation,
};
