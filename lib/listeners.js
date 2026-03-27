/**
 * Page event listeners for security, API monitoring, and error detection
 */

const chalk = require('chalk');
const { SKIP_DOMAINS } = require('./constants');

/**
 * Setup dialog handler
 */
function setupDialogHandler(page, options = {}) {
  const print = options.print || (() => {});

  page.on('dialog', async dialog => {
    print(
      chalk.yellow(
        `  ⚠  Dialog dismissed: "${dialog.message().slice(0, 60)}"`
      )
    );
    await dialog.dismiss().catch(() => {});
  });
}

/**
 * Setup new tab blocker
 */
function setupNewTabBlocker(page, options = {}) {
  const print = options.print || (() => {});

  page.context().on('page', async newPage => {
    print(chalk.yellow(`  ⚠  New tab blocked: ${newPage.url()}`));
    await newPage.close().catch(() => {});
  });
}

/**
 * Setup download blocker
 */
function setupDownloadBlocker(page, options = {}) {
  const print = options.print || (() => {});
  const log = options.log || [];

  page.on('download', async download => {
    print(chalk.yellow(`  ⚠  Download blocked: ${download.suggestedFilename()}`));
    await download.cancel().catch(() => {});
    log.push({
      type: 'console',
      pass: false,
      label: `Unexpected download triggered: ${download.suggestedFilename()}`,
      status: null,
      external: false,
    });
  });
}

/**
 * Setup API/XHR response listener
 */
function setupResponseListener(page, baseDomain, options = {}) {
  const log = options.log || [];
  const seenAPIs = options.seenAPIs || new Set();

  page.on('response', async response => {
    const type = response.request().resourceType();
    const respStatus = response.status();
    const reqUrl = response.url();
    const method = response.request().method();
    const isExternal = !reqUrl.includes(baseDomain);

    if (SKIP_DOMAINS.some(d => reqUrl.includes(d))) return;

    // API request monitoring
    if (type === 'xhr' || type === 'fetch') {
      const pass = respStatus < 400;
      const apiKey = `${method}:${reqUrl}`;
      if (!seenAPIs.has(apiKey) || !pass) {
        seenAPIs.add(apiKey);
        log.push({
          type: 'api',
          pass,
          label: `[${method}] ${reqUrl}`,
          status: respStatus,
          external: isExternal,
        });
      }
    }

    // 404 resource detection
    if (respStatus === 404) {
      const isAsset = [
        'image',
        'stylesheet',
        'script',
        'font',
      ].includes(type);
      if (isAsset) {
        log.push({
          type: 'resource',
          pass: false,
          label: `Missing resource: ${reqUrl}`,
          status: 404,
          external: isExternal,
        });
      }
    }
  });
}

/**
 * Setup console error listener
 */
function setupConsoleListener(page, options = {}) {
  const log = options.log || [];
  const seenErrors = options.seenErrors || new Set();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const normalized = text
        .replace(/https?:\/\/[^\s'"()]*/g, '<URL>')
        .trim();
      if (!seenErrors.has(normalized)) {
        seenErrors.add(normalized);
        log.push({
          type: 'console',
          pass: false,
          label: `Console error: ${normalized}`,
          status: null,
          external: false,
        });
      }
    }
  });
}

/**
 * Setup all listeners
 */
function setupAllListeners(page, baseDomain, options = {}) {
  setupDialogHandler(page, options);
  setupNewTabBlocker(page, options);
  setupDownloadBlocker(page, options);
  setupResponseListener(page, baseDomain, options);
  setupConsoleListener(page, options);
}

module.exports = {
  setupDialogHandler,
  setupNewTabBlocker,
  setupDownloadBlocker,
  setupResponseListener,
  setupConsoleListener,
  setupAllListeners,
};
