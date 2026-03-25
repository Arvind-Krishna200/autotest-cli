#!/usr/bin/env node
const { Command } = require('commander');
const { runTests } = require('../lib/runner');

const program = new Command();

program
  .name('autotest')
  .description('Zero-config automated web testing CLI')
  .version('1.0.0');

program
  .command('run <url>')
  .description('Run automated tests on a URL')
  .option('-u, --username <username>', 'Login username')
  .option('-p, --password <password>', 'Login password')
  .option('--quick', 'Test main menu items only (~25 sec)')
  .option('--deep', 'Test main + all sub menu items (~90 sec)')
  .option('--only-failures', 'Show only failed checks in report')
  .action(async (url, options) => {
    await runTests(url, {
      username: options.username,
      password: options.password,
      quick: options.quick || false,
      onlyFailures: options.onlyFailures || false
    });
  });

program.parse(process.argv);
