#!/usr/bin/env node

const { program } = require('commander');

program
  .name('autotest')
  .description('Automated testing CLI powered by Playwright')
  .version('0.1.0');

program
  .command('run <url>')
  .description('Run basic tests against a URL')
  .option('-b, --browser <type>', 'Browser (chromium|firefox|webkit)', 'chromium')
  .option('-u, --username <username>', 'Login username')
  .option('-p, --password <password>', 'Login password')
  .option('--login-url <loginUrl>', 'Login page URL if different from main URL')
  .action(async (url, options) => {
    const { runTests } = require('../lib/runner');
    await runTests(url, options);
  });


program.parse(process.argv);
