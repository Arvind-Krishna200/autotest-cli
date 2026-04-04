#!/usr/bin/env node
//IMPORTANT none the files are being used only index.js and runner_new.js, the rest are just for future use.
const { Command } = require('commander');
const { runTests } = require('../lib/runner_new');
const chalk = require('chalk');

const program = new Command();

program
  .name('autotest')
  .description('Zero-config automated web app testing CLI')
  .version('1.0.0');

program
  .command('run <url>')
  .description('Run automated tests on a URL')

  // ── Scan Depth ─────────────────────────────────────────────────────────────
  // Controls which elements to test on each page.
  // --basic    : Only high-priority elements — buttons, inputs, nav links, forms.
  //              Fast (8–15s). Best for CI pipelines and quick smoke tests.
  // --thorough : All interactive elements — includes dropdowns, filters, cards.
  //              Slower (20–40s). Best for pre-release QA and dev testing.
  //              Defaults to --basic if neither is specified.
  .option('--basic',             'Test essential elements only: buttons, nav, forms (default)')
  .option('--thorough',          'Test all interactive elements: includes filters, dropdowns, cards')

  // ── Crawl Options ──────────────────────────────────────────────────────────
  // Controls how many pages to test.
  // --crawl       : Follow navigations and test each page found.
  //                 Also detects SPA view changes and re-scans new DOM elements.
  //                 Without --crawl, only the starting URL is tested.
  // --depth <n>   : How many levels deep to crawl from the starting page.
  //                 depth 1 = starting page only
  //                 depth 2 = starting page + all pages it links to (default)
  //                 depth 3 = starting page + linked pages + their linked pages
  .option('--crawl',             'Follow navigations and test each discovered page (MPA + SPA aware)')
  .option('--depth <n>',         'Max crawl depth from starting URL (default: 2)', '2')

  // ── Output Format ──────────────────────────────────────────────────────────
  // Controls how results are displayed after the test run.
  // Default (no flag) : Rich summary dashboard — totals, network stats, status
  // --flat            : Full numbered interaction flow — every click/skip/navigate
  // --live            : Print each click inline as it happens (no final report)
  .option('--flat',              'Show full numbered interaction flow after run')
  .option('--live',              'Print each interaction inline as it happens')
  .option('--only-failures',     'Only include failed interactions in export/json output')

  // ── Auth ───────────────────────────────────────────────────────────────────
  // --login : Opens a real visible browser window so you can log in manually.
  //           After login, press Enter and the tool resumes testing with your
  //           authenticated session. Session is saved in .autotest-session/
  //           so subsequent runs reuse it automatically.
  .option('--login',             'Open browser for manual login before testing starts')

  // ── Browser ────────────────────────────────────────────────────────────────
  // Which browser engine to use. All are headless except during --login.
  // chrome  : Chromium (default) — fastest, most compatible
  // firefox : Firefox engine — useful for cross-browser checks
  // safari  : WebKit engine — closest to Safari behaviour
  .option('--browser <browser>', 'Browser engine: chrome | firefox | safari (default: chrome)', 'chrome')

  // ── Overrides ──────────────────────────────────────────────────────────────
  // --limit <n> : Override the max elements to test per page.
  //               Useful when --thorough finds too many elements on large sites.
  //               Example: --thorough --limit 80
  .option('--limit <n>',         'Override max elements to test per page')

  // ── Export ─────────────────────────────────────────────────────────────────
  // --export : Save a plain text report to results/ directory after the run.
  // --json   : Save a structured JSON report to results/ directory after the run.
  //            Useful for CI pipelines — parse pass/fail programmatically.
  .option('--export',            'Save plain text report to results/ folder')
  .option('--json',              'Save structured JSON report to results/ folder')

  .action(async (url, options) => {
    try {
      await runTests(url, {
        // Scan mode
        basic:        !options.thorough,        // basic is default unless --thorough passed
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