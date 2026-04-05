#!/usr/bin/env node
//IMPORTANT none the files are being used only index.js and runner_new.js, the rest are just for future use.
const { Command } = require('commander');
const { runTests } = require('../lib/runner_new');
const chalk = require('chalk');


const program = new Command();


program
  .name('dosmoketest')
  .description('Zero-config automated web app testing CLI')
  .version('1.0.0');


program
  .command('run <url>')
  .description('Run automated tests on a URL')


  // ── Scan Depth ─────────────────────────────────────────────────────────────
  .option('--basic',             'Test essential elements only: buttons, nav, forms (default)')
  .option('--thorough',          'Test all interactive elements: includes filters, dropdowns, cards')


  // ── Crawl Options ──────────────────────────────────────────────────────────
  .option('--crawl',             'Follow navigations and test each discovered page (MPA + SPA aware)')
  .option('--depth <n>',         'Max crawl depth from starting URL (default: 2)', '2')


  // ── Output Format ──────────────────────────────────────────────────────────
  .option('--flat',              'Show full numbered interaction flow after run')
  .option('--live',              'Print each interaction inline as it happens')
  .option('--only-failures',     'Only include failed interactions in export/json output')


  // ── Auth ───────────────────────────────────────────────────────────────────
  .option('--login',             'Open browser for manual login before testing starts')


  // ── Browser ────────────────────────────────────────────────────────────────
  .option('--browser <browser>', 'Browser engine: chrome | firefox | safari (default: chrome)', 'chrome')


  // ── Overrides ──────────────────────────────────────────────────────────────
  .option('--limit <n>',         'Override max elements to test per page')


  // ── Config ─────────────────────────────────────────────────────────────────
  // --config <file> : Path to a JSON config file with blocklist and clicklist.
  //   blocklist : Array of selectors/text/regex to skip (merged with defaults).
  //   clicklist : Array of selectors/text to test exclusively.
  //   Example:  autotest run https://myapp.com --config config.json
  //   config.json:
  //   {
  //     "blocklist": ["logout", "#delete-btn", ".btn-danger", "/danger/i"],
  //     "clicklist": []
  //   }
  .option('--config <file>',     'Path to JSON config file with blocklist/clicklist')


  // ── Export ─────────────────────────────────────────────────────────────────
  .option('--export',            'Save plain text report to results/ folder')
  .option('--json',              'Save structured JSON report to results/ folder')


  .action(async (url, options) => {
    try {
      await runTests(url, {
        // Scan mode
        basic:        !options.thorough,
        thorough:     options.thorough || false,

        // Crawl
        crawl:        options.crawl   || false,
        depth:        options.depth   || '2',

        // Output
        flat:         options.flat         || false,
        live:         options.live         || false,
        onlyFailures: options.onlyFailures || false,

        // Auth
        login:        options.login   || false,

        // Browser
        browser:      options.browser || 'chrome',

        // Overrides
        limit:        options.limit   || null,

        // Config file
        config:       options.config  || null,

        // Export
        export:       options.export  || false,
        json:         options.json    || false,
      });
    } catch (e) {
      console.log(chalk.red(`\n  ✘  Fatal: ${e.message.split('\n')[0]}`));
      console.log(chalk.gray('  Check the site is reachable and try again.\n'));
      process.exit(1);
    }
  });


program.parse(process.argv);