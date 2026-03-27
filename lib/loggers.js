/**
 * Logging and output formatting
 */

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { ICONS } = require('./constants');

/**
 * Build JSON result object
 */
function buildJsonResult(log, testUrl, elapsed, options) {
  const passed = log.filter(l => l.pass).length;
  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass && l.external).length;

  const types = [
    'login',
    'page',
    'nav',
    'subnav',
    'api',
    'image',
    'resource',
    'console',
  ];
  const breakdown = {};
  types.forEach(type => {
    const entries = log.filter(l => l.type === type);
    breakdown[type] = {
      pass: entries.filter(l => l.pass).length,
      fail: entries.filter(l => !l.pass).length,
    };
  });

  return {
    meta: {
      url: testUrl,
      timestamp: new Date().toISOString(),
      duration: parseFloat(elapsed),
      mode: options.quick ? 'quick' : 'deep',
      browser: options.browser || 'chrome',
    },
    summary: {
      total: log.length,
      passed,
      failed: internalFails,
      externalWarnings: externalFails,
      status: internalFails === 0 ? 'PASS' : 'FAIL',
    },
    breakdown,
    events: log,
  };
}

/**
 * Print formatted test report to console
 */
function printLog(log, testUrl, elapsed, options = {}) {
  const divider = chalk.gray('─'.repeat(65));

  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass && l.external).length;
  const passed = log.filter(l => l.pass).length;

  console.log('\n' + divider);
  console.log(chalk.bold.cyan('  🤖 AUTOTEST SESSION LOG'));
  console.log(chalk.gray(`  URL     : ${testUrl}`));
  console.log(chalk.gray(`  Date    : ${new Date().toLocaleString()}`));
  console.log(chalk.gray(`  Time    : ${elapsed}s`));
  console.log(
    chalk.gray(
      `  Mode    : ${options.quick ? '⚡ Quick' : '🔬 Deep'}${
        options.onlyFailures ? ' | Failures Only' : ''
      }`
    )
  );
  console.log(chalk.gray(`  Browser : ${options.browser || 'chrome'}`));
  console.log(divider + '\n');

  let printed = 0;
  log.forEach(entry => {
    if (options.onlyFailures && entry.pass) return;
    printed++;

    const icon = ICONS[entry.type] || '•';
    const statusText =
      entry.status !== null ? chalk.gray(` → ${entry.status}`) : '';
    const externalTag = entry.external ? chalk.yellow(' [external]') : '';
    const indent = entry.type === 'subnav' ? '      ' : '  ';

    const line = entry.pass
      ? chalk.green(`${indent}✔  ${icon}  ${entry.label}`) +
        statusText +
        externalTag
      : entry.external
        ? chalk.yellow(`${indent}⚠  ${icon}  ${entry.label}`) +
          statusText +
          externalTag
        : chalk.red(`${indent}✘  ${icon}  ${entry.label}`) +
          statusText +
          externalTag;

    console.log(line);
  });

  if (options.onlyFailures && printed === 0) {
    console.log(chalk.green('  ✔  All checks passed — no failures found!'));
  }

  console.log('\n' + divider);
  console.log(
    `  ${chalk.bold('Summary :')} ` +
      chalk.green(`${passed} OK`) +
      chalk.gray(' / ') +
      (internalFails > 0
        ? chalk.red(`${internalFails} FAILED`)
        : chalk.green('0 FAILED')) +
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

/**
 * Export console report to text file
 */
function exportConsoleReport(log, testUrl, elapsed, options) {
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `autotest-${timestamp}.txt`;
  const filepath = path.join('results', filename);

  // Build console-style text (without color codes)
  const divider = '─'.repeat(65);
  const internalFails = log.filter(l => !l.pass && !l.external).length;
  const externalFails = log.filter(l => !l.pass && l.external).length;
  const passed = log.filter(l => l.pass).length;

  let output = '\n' + divider + '\n';
  output += '  🤖 AUTOTEST SESSION LOG\n';
  output += `  URL     : ${testUrl}\n`;
  output += `  Date    : ${new Date().toLocaleString()}\n`;
  output += `  Time    : ${elapsed}s\n`;
  output += `  Mode    : ${options.quick ? '⚡ Quick' : '🔬 Deep'}${options.onlyFailures ? ' | Failures Only' : ''}\n`;
  output += `  Browser : ${options.browser || 'chrome'}\n`;
  output += divider + '\n\n';

  let printed = 0;
  log.forEach(entry => {
    if (options.onlyFailures && entry.pass) return;
    printed++;

    const icon = ICONS[entry.type] || '•';
    const statusText = entry.status !== null ? ` → ${entry.status}` : '';
    const externalTag = entry.external ? ' [external]' : '';
    const indent = entry.type === 'subnav' ? '      ' : '  ';

    const line = entry.pass
      ? `${indent}✔  ${icon}  ${entry.label}` + statusText + externalTag
      : entry.external
        ? `${indent}⚠  ${icon}  ${entry.label}` + statusText + externalTag
        : `${indent}✘  ${icon}  ${entry.label}` + statusText + externalTag;

    output += line + '\n';
  });

  if (options.onlyFailures && printed === 0) {
    output += '  ✔  All checks passed — no failures found!\n';
  }

  output += '\n' + divider + '\n';
  output += `  Summary : ${passed} OK / ${internalFails} FAILED`;
  output += externalFails > 0 ? ` / ${externalFails} external warnings` : '';
  output += ` / ${log.length} total events\n`;
  output += `  Time    : ${elapsed}s\n`;
  output += `  Status  : ${internalFails === 0 ? ' ALL CLEAR ✓ ' : ` ${internalFails} ISSUE(S) FOUND ✗ `}\n`;
  output += divider + '\n\n';

  fs.writeFileSync(filepath, output);
  return filepath;
}

/**
 * Export JSON report to file
 */
function exportJsonReport(log, testUrl, elapsed, options) {
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `autotest-${timestamp}.json`;
  const filepath = path.join('results', filename);

  const result = buildJsonResult(log, testUrl, elapsed, options);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

module.exports = {
  buildJsonResult,
  printLog,
  exportConsoleReport,
  exportJsonReport,
};
