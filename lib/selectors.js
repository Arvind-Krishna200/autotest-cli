/**
 * Page traversal and DOM interaction helpers
 */

const { NAV_SELECTORS, HEADING_SELECTORS } = require('./constants');
const { isDangerous, isPageAlive } = require('./validators');

/**
 * Collect visible menu items from the page
 */
async function getVisibleMenuItems(page) {
  return await page.evaluate((navSelectors) => {
    const results = [];
    const seen = new Set();
    const baseDomain = window.location.hostname;

    const BLOCKED = [
      'sign out', 'log out', 'logout', 'signout',
      'delete', 'remove', 'reset', 'export all',
    ];

    for (const selector of navSelectors) {
      let elements;
      try {
        elements = document.querySelectorAll(selector);
      } catch (e) {
        continue;
      }

      for (const el of elements) {
        const text = el.innerText?.trim();
        const href = el.getAttribute('href') || el.href || '';

        if (!text || text.length < 2 || text.length > 80) continue;
        if (seen.has(text.toLowerCase())) continue;

        const lower = text.toLowerCase();
        if (BLOCKED.some(b => lower.includes(b))) continue;
        if (href.startsWith('http') && !href.includes(baseDomain) && href !== '')
          continue;

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
  }, NAV_SELECTORS);
}

/**
 * Get page heading
 */
async function getPageHeading(page) {
  return await page
    .$eval(HEADING_SELECTORS, el => el.innerText.trim())
    .catch(() => '');
}

/**
 * Wait for page load and animations
 */
async function clickAndWait(page) {
  await page
    .waitForLoadState('domcontentloaded', { timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * Safely click a menu item
 */
async function safeClick(page, text) {
  if (isDangerous(text)) return false;

  try {
    const allEls = await page.getByText(text, { exact: true }).all();

    for (const el of allEls) {
      const isVisible = await el.isVisible().catch(() => false);
      if (!isVisible) continue;

      const tagInfo = await el
        .evaluate(node => ({
          tag: node.tagName.toLowerCase(),
          type: node.getAttribute('type') || '',
          disabled: node.disabled || false,
          hasConfirm: (node.getAttribute('onclick') || '').includes('confirm'),
        }))
        .catch(() => null);

      if (!tagInfo) continue;
      if (tagInfo.disabled) continue;
      if (tagInfo.hasConfirm) continue;

      if (tagInfo.tag === 'button' && tagInfo.type === 'submit') {
        const isNavButton = await el
          .evaluate(node =>
            !!node.closest(
              'nav, [class*="sidebar"], [class*="menu"], [class*="nav"]'
            )
          )
          .catch(() => false);
        if (!isNavButton) continue;
      }

      await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await el.click({ timeout: 5000 });
      return true;
    }
  } catch (e) {
    // Continue to DOM fallback
  }

  // DOM fallback — visible only
  try {
    const clicked = await page.evaluate(text => {
      const all = Array.from(
        document.querySelectorAll(
          'a, button, li, span, div[class*="nav"], div[class*="menu"], [role="menuitem"], [role="tab"], [role="treeitem"]'
        )
      );
      const el = all.find(a => {
        if (a.innerText.trim() !== text) return false;
        const rect = a.getBoundingClientRect();
        const style = window.getComputedStyle(a);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        );
      });
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, text);

    if (clicked) {
      await page.waitForTimeout(500);
      return true;
    }
  } catch (e) {
    // Navigation didn't work
  }

  return false;
}

/**
 * Find broken images on page
 */
async function getBrokenImages(page, baseDomain) {
  const brokenImages = await page.$$eval('img', imgs =>
    imgs
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => img.src)
  );

  return brokenImages.map(src => ({
    type: 'image',
    pass: false,
    label: `Broken image: ${src}`,
    status: 404,
    external: !src.includes(baseDomain),
  }));
}

module.exports = {
  getVisibleMenuItems,
  getPageHeading,
  clickAndWait,
  safeClick,
  getBrokenImages,
};
