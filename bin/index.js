#!/usr/bin/env node
const { Command }  = require('commander');
const { runTests } = require('../lib/runner');  // ← check your path
const chalk        = require('chalk');

const program = new Command();

program
  .name('autotest')
  .description('Zero-config automated web app testing CLI')
  .version('1.0.0');

program
  .command('run <url>')
  .description('Run automated tests on a URL')
  // .option('-u, --username <username>', 'Login username')   // ← commented out
  // .option('-p, --password <password>', 'Login password')   // ← commented out
  .option('--deep',          'Test all menu items including sub-menus (~90 sec) [default: quick mode ~25 sec]')
  .option('--only-failures', 'Show only failed checks in report')
  .option('--json',          'Output results as JSON instead of terminal log')
  .option('--browser <browser>', 'Browser: chrome, firefox, safari', 'chrome')
  .option('--export',        'Save report to file (results/ directory)')
  .action(async (url, options) => {
    try {
      await runTests(url, {
        // username:     options.username,   // ← commented out
        // password:     options.password,   // ← commented out
        quick:        !options.deep,       // ← Default to quick (true), unless --deep specified
        onlyFailures: options.onlyFailures || false,
        json:         options.json         || false,
        browser:      options.browser      || 'chrome',
        export:       options.export       || false,
      });
    } catch (e) {
      console.log(chalk.red(`\n  ✘  Fatal: ${e.message.split('\n')[0]}`));
      console.log(chalk.gray('  Check the site is reachable and try again.\n'));
      process.exit(1);
    }
  });

program.parse(process.argv);
