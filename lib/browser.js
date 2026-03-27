/**
 * Browser initialization and management
 */

const { chromium, firefox, webkit } = require('playwright');
const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Get the appropriate browser engine based on browser name
 */
function getBrowserEngine(browserName) {
  switch (browserName?.toLowerCase()) {
    case 'firefox':
      return firefox;
    case 'safari':
    case 'webkit':
      return webkit;
    case 'chrome':
    case 'chromium':
    default:
      return chromium;
  }
}

/**
 * Launch browser with auto-installation fallback
 */
async function launchBrowser(browserName, options = {}) {
  const engine = getBrowserEngine(browserName);
  const isJson = options.json || false;

  try {
    return await engine.launch({ headless: false });
  } catch (e) {
    // Auto-install browser if missing
    if (
      e.message.includes("Executable doesn't exist") ||
      e.message.includes('executable')
    ) {
      const name = browserName === 'safari' ? 'webkit' : browserName || 'chromium';

      if (!isJson) {
        console.log(
          chalk.yellow(`\n  📦 Installing ${name} browser — one time setup...\n`)
        );
      } else {
        process.stderr.write(
          `📦 Installing ${name} browser — one time setup...\n`
        );
      }

      execSync(`npx playwright install ${name}`, {
        stdio: isJson ? 'ignore' : 'inherit',
      });

      return await engine.launch({ headless: false });
    }

    throw e;
  }
}

module.exports = {
  getBrowserEngine,
  launchBrowser,
};
