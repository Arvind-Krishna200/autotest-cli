// runner.js
const chalk    = require('chalk');
const ora      = require('ora');
const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const { chromium, firefox, webkit } = require('playwright');

// ── Constants ──────────────────────────────────────────────────
const BLOCKED_TERMS = [
  'logout','log out','sign out','signout',
  'delete','remove','deactivate',
  'cancel','close','exit',
  'unsubscribe','suspend','terminate'
];

const ANALYTICS_DOMAINS = [
  'google-analytics.com','googletagmanager.com',
  'newrelic.com','nr-data.net',
  'omtrdc.net','demdex.net',
  'hotjar.com','mixpanel.com',
  'segment.com','amplitude.com',
  'clarity.ms','doubleclick.net',
  'fdp.api',
];

const CDP_CONCURRENCY = 20;

// ── Helpers ────────────────────────────────────────────────────
function isSafeText(text) {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return lower.length > 0 && !BLOCKED_TERMS.some(t => lower.includes(t));
}

function cleanText(raw) {
  return (raw || '').replace(/\.[\w-]+\{[^}]+\}/g, '').trim().slice(0, 100);
}

function waitForEnter(prompt = '  ⏎  Press Enter when ready... ') {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

function getBrowserEngine(name) {
  if (name === 'firefox') return firefox;
  if (name === 'safari')  return webkit;
  return chromium;
}

function statusColor(code) {
  if (code >= 500) return chalk.red(`${code}`);
  if (code >= 400) return chalk.yellow(`${code}`);
  if (code >= 300) return chalk.cyan(`${code}`);
  return chalk.green(`${code}`);
}

function normalizeHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function isAnalyticsDomain(url) {
  try {
    const host = new URL(url).hostname;
    return ANALYTICS_DOMAINS.some(d => host.includes(d));
  } catch { return false; }
}

function isAnalyticsError(msg) {
  return ANALYTICS_DOMAINS.some(k => msg.toLowerCase().includes(k));
}

// ── Scoring ────────────────────────────────────────────────────
function scoreElement(el) {
  const text = (el.text || '').toLowerCase();
  const href = el.href || '';

  if (['button','input','select','textarea'].includes(el.tag))                                              return 100;
  if (['login','cart','checkout','search','submit','signup','register','add to'].some(k => text.includes(k))) return 95;
  if (['button','menuitem','tab','link'].includes(el.role))                                                 return 90;
  if (el.tag === 'a' && href && !href.includes('?') && el.text.length < 40)                                return 80;
  if (el.tag === 'a' && el.text.length > 2 && el.text.length < 60)                                        return 60;
  if (el.cursor === 'pointer')                                                                             return 40;
  if (el.tag === 'a' && el.text.length >= 60)                                                             return 20;
  if (/₹|min\.|% off|under|from ₹/.test(text))                                                           return 10;
  if (href.includes('ctx=ey') || href.includes('facets') || href.includes('hpid='))                       return 5;
  return 30;
}

function filterByMode(elements, options) {
  // Filter multiline container divs — not real clickable elements
  const clean = elements.filter(el =>
    !(el.text.includes('\n') && el.text.length > 60)
  );

  const scored = clean.map(el => ({ ...el, score: scoreElement(el) }));

  if (options.thorough) {
    return scored
      .filter(el => el.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(options.limit) || 150);
  }

  // Default: basic
  return scored
    .filter(el => el.score >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, parseInt(options.limit) || 60);
}

function getModeName(options) {
  if (options.thorough) return 'thorough';
  return 'basic';
}

// ── Browser launch ─────────────────────────────────────────────
async function launchBrowser(browserName, options) {
  const engine = getBrowserEngine(browserName);

  if (options.login) {
    const userDataDir = path.join(process.cwd(), '.autotest-session');
    const context = await engine.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
    });
    return { context, persistent: true };
  }

  const browser = await engine.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  return { browser, context, persistent: false };
}

// ── Resource blocking ──────────────────────────────────────────
async function blockHeavyResources(context, options) {
  // Skip blocking in --login mode so user sees the full site
  if (options.login) return;

  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'font', 'media', 'stylesheet'].includes(type)) return route.abort();
    return route.continue();
  });
}

// ── Listeners ──────────────────────────────────────────────────
function setupAllListeners(page, log, baseUrl) {
  const baseHost = normalizeHostname(baseUrl);

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('ERR_FAILED') || text.includes('ERR_BLOCKED') || text.includes('net::')) return;
      if (isAnalyticsError(text)) return;
      log.push({ type: 'console-error', status: 'console-error', message: text, url: page.url() });
    }
  });

  page.on('pageerror', err => {
    log.push({ type: 'pageerror', status: 'failed', message: err.message, url: page.url() });
  });

  page.on('response', res => {
    const code = res.status();
    const url  = res.url();
    const host = normalizeHostname(url);
    const external = !host.endsWith(baseHost);
    log.push({ type: 'network', status: code, url, external, failed: code >= 400 });
  });

  page.on('requestfailed', req => {
    if (['image','font','media','stylesheet'].includes(req.resourceType())) return;
    log.push({ type: 'requestfailed', status: 'failed', message: `Request failed: ${req.url()}`, url: req.url() });
  });
}

// ── Scanner ────────────────────────────────────────────────────
async function getAllClickableElements(page) {
  const client = await page.context().newCDPSession(page);

  const [domRaw, { root }] = await Promise.all([
    page.evaluate(() => {
      const results = [];
      for (const el of document.querySelectorAll('*')) {
        const tag      = el.tagName.toLowerCase();
        const style    = window.getComputedStyle(el);
        const role     = el.getAttribute('role') || '';
        const onclick  = el.getAttribute('onclick') || '';
        const tabindex = el.getAttribute('tabindex');

        const isStd     = ['a','button','select','input','textarea'].includes(tag);
        const isPointer = style.cursor === 'pointer';
        const isRole    = ['button','link','menuitem','option','tab','checkbox','radio'].includes(role);

        if (!isStd && !isPointer && !isRole && !onclick && tabindex !== '0') continue;
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) continue;

        const rawText = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 100);
        results.push({ rawText, tag, role, href: el.href || '', cursor: style.cursor });
      }
      return results;
    }),
    client.send('DOM.getDocument', { depth: -1, pierce: true })
  ]);

  const domElements = domRaw.map(el => ({ ...el, text: cleanText(el.rawText) }));
  const domTextSet  = new Set(domElements.map(e => e.text.toLowerCase().trim()));

  const { nodeIds } = await client.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '*' });
  const cdpElements = [];

  for (let i = 0; i < nodeIds.length; i += CDP_CONCURRENCY) {
    const batch = nodeIds.slice(i, i + CDP_CONCURRENCY);
    await Promise.all(batch.map(async nodeId => {
      try {
        const { object } = await client.send('DOM.resolveNode', { nodeId });
        if (!object?.objectId) return;

        const { listeners } = await client.send('DOMDebugger.getEventListeners', {
          objectId: object.objectId, depth: 1, pierce: true
        });

        if (listeners.some(l => l.type === 'click')) {
          const res = await client.send('Runtime.callFunctionOn', {
            objectId: object.objectId,
            functionDeclaration: `function() {
              const raw = (this.innerText||this.textContent||this.getAttribute('aria-label')||this.getAttribute('title')||'').trim().slice(0,100);
              const text = raw.replace(/\\.[\w-]+\\{[^}]+\\}/g,'').trim().slice(0,100);
              return {
                text,
                tag:     this.tagName.toLowerCase(),
                role:    this.getAttribute('role')||'',
                href:    this.href||'',
                visible: !!(this.offsetWidth||this.offsetHeight||this.getClientRects().length),
                cursor:  window.getComputedStyle(this).cursor
              };
            }`,
            returnByValue: true
          }).catch(() => null);

          if (res?.result?.value?.visible) {
            const t = res.result.value.text.toLowerCase().trim();
            if (!domTextSet.has(t)) cdpElements.push(res.result.value);
          }
        }
        await client.send('Runtime.releaseObject', { objectId: object.objectId }).catch(() => {});
      } catch { /* skip detached */ }
    }));
  }

  const seen = new Set();
  return [...domElements, ...cdpElements].filter(el => {
    if (!isSafeText(el.text) && !el.href) return false;
    const key = el.text.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Safe evaluate ──────────────────────────────────────────────
async function safeEvaluate(page, fn, arg) {
  try {
    return await page.evaluate(fn, arg);
  } catch (e) {
    if (
      e.message.includes('browser has been closed') ||
      e.message.includes('Target page')             ||
      e.message.includes('context was destroyed')   ||
      e.message.includes('Execution context')
    ) {
      return { __navError: true, message: e.message };
    }
    throw e;
  }
}

// ── DOM change detection (SPA view change) ─────────────────────
async function domChangedSignificantly(page, previousSnapshot) {
  try {
    const current = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,button,[role=button],[role=menuitem]')]
        .map(e => e.innerText?.trim())
        .filter(Boolean)
        .slice(0, 20)
        .join('|')
    );
    const currentSet  = new Set(current.split('|').filter(Boolean));
    const previousSet = new Set(previousSnapshot.split('|').filter(Boolean));
    if (currentSet.size === 0) return false;
    const overlap     = [...currentSet].filter(t => previousSet.has(t)).length;
    const changeRatio = 1 - (overlap / Math.max(currentSet.size, 1));
    return changeRatio > 0.35;
  } catch { return false; }
}

async function getDomSnapshot(page) {
  try {
    return await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,button,[role=button],[role=menuitem]')]
        .map(e => e.innerText?.trim())
        .filter(Boolean)
        .slice(0, 20)
        .join('|')
    );
  } catch { return ''; }
}

// ── Back recovery ──────────────────────────────────────────────
async function recoverBack(page, baseUrl, goBackWorks) {
  if (goBackWorks) {
    const back = await page.goBack({ waitUntil: 'domcontentloaded', timeout: 3000 })
      .then(() => true).catch(() => false);
    if (back) { await page.waitForTimeout(200); return true; }
  }
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(200);
  return false;
}

// ── Should skip ────────────────────────────────────────────────
function shouldSkip(el, baseUrl) {
  const href = el.href || '';
  if (!href) return null;
  if (href.startsWith('tel:') || href.startsWith('mailto:')) return 'tel/email';
  if (href.startsWith('#')) return null;

  try {
    const linkHost = new URL(href).hostname.replace(/^www\./, '');
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    if (linkHost && linkHost !== baseHost) return 'external';
  } catch { return null; }

  return null;
}

// ── Single page clicker ────────────────────────────────────────
async function clickAndCollect(page, elements, log, print, options, urlQueue, visitedUrls, pageUrl) {
  let goBackWorks    = true;
  const baseUrl      = pageUrl || page.url();
  const visitedHrefs = new Set();
  const maxDepth     = parseInt(options.depth) || 2;

  for (const el of elements) {
    const label      = el.text || el.href || `<${el.tag}>`;
    const currentUrl = page.url();

    // Skip external / tel / email
    const skipReason = shouldSkip(el, baseUrl);
    if (skipReason) {
      log.push({ type: 'interaction', status: 'skipped', label, reason: skipReason, page: baseUrl });
      continue;
    }

    // Skip duplicate hrefs
    if (el.href && visitedHrefs.has(el.href)) {
      log.push({ type: 'interaction', status: 'skipped', label, reason: 'duplicate href', page: baseUrl });
      continue;
    }
    if (el.href) visitedHrefs.add(el.href);

    // Snapshot DOM before click (SPA detection)
    const snapBefore = await getDomSnapshot(page);

    // Click
    const result = await safeEvaluate(page, (text) => {
      const target = [...document.querySelectorAll('*')].find(e =>
        (e.innerText || e.textContent || '')
          .trim().slice(0, 100)
          .replace(/\.[\w-]+\{[^}]+\}/g, '')
          .trim() === text
      );
      if (target) target.click();
      return { __ok: true };
    }, el.text);

    // Stale context recovery
    if (result?.__navError) {
      await page.waitForTimeout(300);
      const newUrl = page.url();
      if (newUrl !== currentUrl) {
        log.push({ type: 'interaction', status: 'navigated', label, from: currentUrl, to: newUrl, page: baseUrl });
        if (!options.live) print(chalk.cyan(`  ↪  Navigated  "${label}" → ${newUrl}`));
        if (options.crawl && urlQueue && !visitedUrls.has(newUrl)) {
          const depth = (visitedUrls.get?.(currentUrl) || 0) + 1;
          if (depth < maxDepth) urlQueue.push({ url: newUrl, depth });
        }
        goBackWorks = await recoverBack(page, baseUrl, goBackWorks);
      } else {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        log.push({ type: 'interaction', status: 'skipped', label, reason: 'stale context — recovered', page: baseUrl });
      }
      await page.waitForTimeout(200);
      continue;
    }

    // Smart wait
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: 1000 }),
      page.waitForTimeout(300),
    ]).catch(() => {});

    const newUrl = page.url();

    // ── MPA: URL changed ──────────────────────────────────────
    if (newUrl !== currentUrl) {
      log.push({ type: 'interaction', status: 'navigated', label, from: currentUrl, to: newUrl, page: baseUrl });
      if (!options.live) print(chalk.cyan(`  ↪  Navigated  "${label}" → ${newUrl}`));

      // Queue new page for crawl
      if (options.crawl && urlQueue && !visitedUrls.has(newUrl)) {
        const currentDepth = visitedUrls.get ? (visitedUrls.get(currentUrl) || 0) : 0;
        if (currentDepth + 1 < maxDepth) urlQueue.push({ url: newUrl, depth: currentDepth + 1 });
      }

      goBackWorks = await recoverBack(page, baseUrl, goBackWorks);

    // ── SPA: DOM changed significantly ────────────────────────
    } else if (options.crawl && await domChangedSignificantly(page, snapBefore)) {
      log.push({ type: 'interaction', status: 'view-changed', label, page: baseUrl });
      if (!options.live) print(chalk.magenta(`  ⟳  View changed  "${label}"`));

      // Re-scan new elements in this SPA view
      const newAllElements = await getAllClickableElements(page);
      const newElements    = filterByMode(newAllElements, options)
        .filter(e => !elements.some(old => old.text === e.text)); // only truly new ones

      if (newElements.length > 0) {
        if (!options.live) print(chalk.blue(`     ↳ Found ${newElements.length} new elements in this view`));
        await clickAndCollect(page, newElements, log, print, options, urlQueue, visitedUrls, baseUrl);
      }

      // Restore original view
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(200);

    // ── Normal click ──────────────────────────────────────────
    } else {
      log.push({ type: 'interaction', status: 'clicked', label, page: baseUrl });
      if (!options.live) print(chalk.green(`  ✔  Clicked    "${label}"`));
    }
  }
}

// ── Crawl runner ───────────────────────────────────────────────
async function crawlAndTest(page, startUrl, options, log, print) {
  const maxDepth   = parseInt(options.depth) || 2;
  const visitedUrls = new Map(); // url → depth
  const urlQueue   = [{ url: startUrl, depth: 0 }];
  const pageStats  = [];

  visitedUrls.set(startUrl, 0);

  while (urlQueue.length > 0) {
    const { url, depth } = urlQueue.shift();

    if (depth >= maxDepth) continue;
    if (visitedUrls.has(url) && url !== startUrl) continue;
    visitedUrls.set(url, depth);

    // Navigate to page
    print(chalk.bold.blue(`\n  ┌─ Page [${depth + 1}/${maxDepth}] → ${url}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(300);

    // Scan + filter
    const allElements = await getAllClickableElements(page);
    const elements    = filterByMode(allElements, options);

    print(chalk.blue(`  │  Found ${allElements.length} elements → testing ${elements.length}`));

    const countBefore = log.filter(l => l.type === 'interaction').length;

    await clickAndCollect(page, elements, log, print, options, urlQueue, visitedUrls, url);

    const tested = log.filter(l => l.type === 'interaction').length - countBefore;
    pageStats.push({ url, depth, tested });

    print(chalk.gray(`  └─ Done (${tested} interactions)\n`));
  }

  return pageStats;
}

// ── Network dedup helpers ──────────────────────────────────────
function uniqueFailedDomains(networkLog, minStatus, maxStatus) {
  return [...new Set(
    networkLog
      .filter(n => n.status >= minStatus && n.status < maxStatus)
      .filter(n => !isAnalyticsDomain(n.url))
      .map(n => { try { return new URL(n.url).hostname; } catch { return n.url; } })
  )];
}

function deduplicateConsoleErrors(consoleErrs) {
  const seen = new Set();
  return consoleErrs.filter(e => {
    const normalized = e.message
      .replace(/https?:\/\/[^\s]+/g, '<url>')
      .replace(/\d+/g, 'N')
      .slice(0, 80);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

// ── Flat Report ────────────────────────────────────────────────
function printFlatReport(log, testUrl, elapsed, mode, pageStats) {
  const interactions = log.filter(l => l.type === 'interaction');
  const network      = log.filter(l => l.type === 'network');
  const consoleErrs  = log.filter(l => l.type === 'console-error');

  console.log(chalk.bold.white('\n  ══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.white(`  FLAT FLOW REPORT  ${chalk.gray(`[${mode}]`)}`));
  console.log(chalk.bold.white('  ══════════════════════════════════════════════════════════════'));
  console.log(chalk.gray(`  URL     : ${testUrl}`));
  console.log(chalk.gray(`  Time    : ${elapsed}s\n`));

  // Page summary if crawled
  if (pageStats && pageStats.length > 1) {
    console.log(chalk.bold.cyan('  📄 Pages Tested'));
    console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
    pageStats.forEach(p => {
      console.log(`  ${'  '.repeat(p.depth)}${chalk.cyan('→')} ${p.url}  ${chalk.gray(`(${p.tested} interactions)`)}`);
    });
    console.log('');
  }

  console.log(chalk.bold.cyan('  🖱️  Interaction Flow'));
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));

  interactions.forEach((l, i) => {
    const idx = String(i + 1).padStart(3, ' ');
    if (l.status === 'clicked') {
      console.log(chalk.green(`  ${idx}. ✔  CLICKED      "${l.label}"`));
    } else if (l.status === 'navigated') {
      console.log(chalk.cyan(`  ${idx}. ↪  NAVIGATED   "${l.label}"`));
      console.log(chalk.gray(`        from : ${l.from}`));
      console.log(chalk.gray(`        to   : ${l.to}`));
    } else if (l.status === 'view-changed') {
      console.log(chalk.magenta(`  ${idx}. ⟳  VIEW CHANGE "${l.label}"`));
    } else if (l.status === 'skipped') {
      console.log(chalk.gray(`  ${idx}. ⊘  SKIPPED     "${l.label}"  (${l.reason})`));
    } else {
      console.log(chalk.red(`  ${idx}. ✘  FAILED      "${l.label}"`));
      console.log(chalk.gray(`        error: ${(l.message || '').split('\n')[0]}`));
    }
  });

  // Failed network — deduped
  const failed4xx = log.filter(l => l.type === 'network' && l.status >= 400 && l.status < 500 && !isAnalyticsDomain(l.url));
  const failed5xx = log.filter(l => l.type === 'network' && l.status >= 500 && !isAnalyticsDomain(l.url));

  if (failed4xx.length > 0 || failed5xx.length > 0) {
    console.log(chalk.bold.yellow('\n  🌐 Failed Network Requests'));
    console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
    const urlCounts = {};
    [...failed4xx, ...failed5xx].forEach(n => {
      urlCounts[n.url] = urlCounts[n.url] || { status: n.status, count: 0 };
      urlCounts[n.url].count++;
    });
    Object.entries(urlCounts).forEach(([url, { status, count }]) => {
      const countLabel = count > 1 ? chalk.gray(` ×${count}`) : '';
      console.log(`  ${statusColor(status)}  ${chalk.gray(url.slice(0, 80))}${countLabel}`);
    });
  }

  if (consoleErrs.length > 0) {
    const unique = deduplicateConsoleErrors(consoleErrs.filter(e => !isAnalyticsError(e.message)));
    if (unique.length > 0) {
      console.log(chalk.bold.red('\n  🖥️  Console Errors'));
      console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
      unique.forEach(e => console.log(chalk.red(`  • ${e.message.slice(0, 120)}`)));
    }
  }

  console.log(chalk.bold.white('\n  ══════════════════════════════════════════════════════════════\n'));
}

// ── Summary Report ─────────────────────────────────────────────
function printSummaryReport(log, testUrl, elapsed, perfTiming, browserName, mode, pageStats) {
  const interactions = log.filter(l => l.type === 'interaction');
  const network      = log.filter(l => l.type === 'network');
  const consoleErrs  = log.filter(l => l.type === 'console-error');

  const clicked      = interactions.filter(l => l.status === 'clicked');
  const navigated    = interactions.filter(l => l.status === 'navigated');
  const viewChanged  = interactions.filter(l => l.status === 'view-changed');
  const skipped      = interactions.filter(l => l.status === 'skipped');
  const intFailed    = interactions.filter(l => l.status === 'failed');

  const skipDupes    = skipped.filter(l => l.reason === 'duplicate href');
  const skipExternal = skipped.filter(l => l.reason === 'external');
  const skipStale    = skipped.filter(l => l.reason?.includes('stale'));

  const s2xx = network.filter(n => n.status >= 200 && n.status < 300);
  const s3xx = network.filter(n => n.status >= 300 && n.status < 400);
  const s4xx = network.filter(n => n.status >= 400 && n.status < 500);
  const s5xx = network.filter(n => n.status >= 500);
  const external = network.filter(n => n.external);

  const s404 = network.filter(n => n.status === 404);
  const s403 = network.filter(n => n.status === 403);
  const s400 = network.filter(n => n.status === 400);

  const unique4xxDomains  = uniqueFailedDomains(network, 400, 500);
  const unique5xxDomains  = uniqueFailedDomains(network, 500, 600);
  const filteredConsoleErrs = deduplicateConsoleErrors(
    consoleErrs.filter(e => !isAnalyticsError(e.message))
  );
  const realIssues = intFailed.length + unique4xxDomains.length + unique5xxDomains.length + filteredConsoleErrs.length;

  const extDomains = [...new Set(
    external.map(n => { try { return new URL(n.url).hostname; } catch { return null; } }).filter(Boolean)
  )].slice(0, 6).join(', ');

  const modeColors = { basic: chalk.green, thorough: chalk.yellow };
  const modeLabel  = (modeColors[mode] || chalk.white)(`[${mode.toUpperCase()}]`);

  console.log(chalk.bold.white('\n  ══════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.white(`  TEST SUMMARY  ${modeLabel}`));
  console.log(chalk.bold.white('  ══════════════════════════════════════════════════════════════'));
  console.log(chalk.gray(`  URL      : ${testUrl}`));
  console.log(chalk.gray(`  Browser  : ${browserName || 'chrome'}`));
  console.log(chalk.gray(`  Time     : ${elapsed}s\n`));

  // Pages crawled
  if (pageStats && pageStats.length > 1) {
    console.log(chalk.bold.blue('  📄 Pages Tested'));
    console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
    pageStats.forEach(p => {
      console.log(`  ${'  '.repeat(p.depth)}${chalk.cyan('→')} ${p.url}  ${chalk.gray(`(${p.tested} interactions)`)}`);
    });
    console.log('');
  }

  // Page Load
  console.log(chalk.bold.blue('  📦 Page Load'));
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
  if (perfTiming) {
    const loadSec = (perfTiming.loadTime / 1000).toFixed(2);
    const domSec  = (perfTiming.domReady  / 1000).toFixed(2);
    console.log(`     Load time   : ${perfTiming.loadTime > 3000 ? chalk.red(loadSec + 's') : perfTiming.loadTime > 2000 ? chalk.yellow(loadSec + 's') : chalk.green(loadSec + 's')}`);
    console.log(`     DOM ready   : ${perfTiming.domReady  > 1500 ? chalk.yellow(domSec + 's') : chalk.green(domSec + 's')}`);
  } else {
    console.log(chalk.gray('     Timing unavailable'));
  }

  // Network
  console.log(chalk.bold.blue('\n  🌐 Network Requests'));
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
  console.log(`     Total        : ${chalk.white(network.length)}`);
  console.log(`     ✔  2xx       : ${chalk.green(s2xx.length)}`);
  console.log(`     ↪  3xx       : ${chalk.cyan(s3xx.length)}`);
  if (s4xx.length > 0) {
    console.log(`     ✘  4xx       : ${chalk.yellow(s4xx.length)} requests  ${chalk.gray(`(404: ${s404.length}, 403: ${s403.length}, 400: ${s400.length})  across ${unique4xxDomains.length} domain(s)`)}`);
    const unique4xxUrls = [...new Set(s4xx.filter(n => !isAnalyticsDomain(n.url)).map(n => n.url))].slice(0, 5);
    unique4xxUrls.forEach(url => console.log(chalk.yellow(`        → ${url.slice(0, 85)}`)));
  } else {
    console.log(`     ✔  4xx       : ${chalk.green('0')}`);
  }
  if (s5xx.length > 0) {
    console.log(`     ✘  5xx       : ${chalk.red(s5xx.length)} requests  ${chalk.gray(`across ${unique5xxDomains.length} domain(s)`)}`);
    const unique5xxUrls = [...new Set(s5xx.map(n => n.url))].slice(0, 5);
    unique5xxUrls.forEach(url => console.log(chalk.red(`        → ${url.slice(0, 85)}`)));
  } else {
    console.log(`     ✔  5xx       : ${chalk.green('0')}`);
  }
  console.log(`     🌍 External  : ${chalk.gray(external.length)}  ${chalk.gray(extDomains ? `(${extDomains})` : '')}`);

  // Interactions
  console.log(chalk.bold.blue('\n  🖱️  Interactions'));
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
  console.log(`     Scanned      : ${chalk.white(interactions.length)}`);
  console.log(`     ✔  Clicked   : ${chalk.green(clicked.length)}`);
  console.log(`     ↪  Navigated : ${chalk.cyan(navigated.length)}`);
  if (viewChanged.length > 0)
    console.log(`     ⟳  SPA Views : ${chalk.magenta(viewChanged.length)}`);
  console.log(`     ⊘  Skipped   : ${chalk.gray(skipped.length)}`);
  if (skipDupes.length)    console.log(chalk.gray(`        → ${skipDupes.length} duplicate hrefs`));
  if (skipExternal.length) console.log(chalk.gray(`        → ${skipExternal.length} external links`));
  if (skipStale.length)    console.log(chalk.gray(`        → ${skipStale.length} stale context`));
  console.log(`     ✘  Failed    : ${intFailed.length > 0 ? chalk.red(intFailed.length) : chalk.green('0')}`);
  if (intFailed.length > 0) {
    intFailed.slice(0, 5).forEach(l =>
      console.log(chalk.red(`        → "${l.label}": ${(l.message || '').split('\n')[0].slice(0, 60)}`))
    );
  }

  // Console Errors
  console.log(chalk.bold.blue('\n  🖥️  Console Errors'));
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────────'));
  if (filteredConsoleErrs.length === 0) {
    console.log(`     ${chalk.green('✔  None')}`);
  } else {
    filteredConsoleErrs.slice(0, 5).forEach(e =>
      console.log(chalk.red(`     • ${e.message.slice(0, 100)}`))
    );
  }

  // Status
  console.log(chalk.bold.white('\n  ══════════════════════════════════════════════════════════════'));
  console.log(realIssues > 0
    ? chalk.red(`  Status  :  ${realIssues} REAL ISSUE(S) FOUND ✗`)
    : chalk.green('  Status  :  ALL CLEAR ✓'));
  console.log(chalk.bold.white('  ══════════════════════════════════════════════════════════════\n'));
}

// ── Export ─────────────────────────────────────────────────────
function exportConsoleReport(log, testUrl, elapsed, options, mode) {
  const dir   = path.join(process.cwd(), 'results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file  = path.join(dir, `report-${stamp}.txt`);
  const interactions = log.filter(l => l.type === 'interaction');
  const lines = interactions
    .filter(l => !options.onlyFailures || l.status === 'failed')
    .map(l => `[${l.status.toUpperCase()}] ${l.label || l.message || ''}`);
  fs.writeFileSync(file, [`URL: ${testUrl}`, `Mode: ${mode}`, `Time: ${elapsed}s`, '', ...lines].join('\n'));
  return file;
}

function exportJsonReport(data) {
  const dir   = path.join(process.cwd(), 'results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file  = path.join(dir, `report-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(chalk.green(`\n  ✅ JSON report saved to: ${file}`));
}

function buildJsonResult(log, testUrl, elapsed, options, mode, pageStats) {
  const interactions = log.filter(l => l.type === 'interaction');
  const network      = log.filter(l => l.type === 'network');
  return {
    url: testUrl, mode, elapsed, pageStats,
    summary: {
      clicked:          interactions.filter(l => l.status === 'clicked').length,
      navigated:        interactions.filter(l => l.status === 'navigated').length,
      viewChanged:      interactions.filter(l => l.status === 'view-changed').length,
      skipped:          interactions.filter(l => l.status === 'skipped').length,
      failed:           interactions.filter(l => l.status === 'failed').length,
      network4xx:       network.filter(n => n.status >= 400 && n.status < 500).length,
      network5xx:       network.filter(n => n.status >= 500).length,
      unique4xxDomains: uniqueFailedDomains(network, 400, 500),
      unique5xxDomains: uniqueFailedDomains(network, 500, 600),
    },
    events: options.onlyFailures ? log.filter(l => l.status === 'failed') : log,
  };
}

// ── Main runner ────────────────────────────────────────────────
async function runTests(baseUrl, options = {}) {
  const log   = [];
  const spin  = ora({ spinner: 'dots' });
  const print = msg => console.log(msg);
  const mode  = getModeName(options);

  const modeColors = { basic: chalk.green, thorough: chalk.yellow };
  const crawlLabel = options.crawl ? chalk.blue(` +crawl(depth:${options.depth || 2})`) : '';
  console.log(chalk.cyan(`\n  🌐 Browser : ${options.browser || 'chrome'}  ${chalk.gray(`[${mode}]`)}${crawlLabel}\n`));

  const { browser, context } = await launchBrowser(options.browser, options);
  await blockHeavyResources(context, options);

  const page = await context.newPage();
  setupAllListeners(page, log, baseUrl);

  // Navigate
  spin.start('Loading page...');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {});
  spin.stop();

  const testUrl = page.url();
  print(chalk.green(`  ✔  Page loaded → ${testUrl}`));

  // Perf timing
  const perfTiming = await page.evaluate(() => {
    const t = performance.timing;
    if (!t) return null;
    return {
      loadTime: t.loadEventEnd             - t.navigationStart,
      domReady: t.domContentLoadedEventEnd - t.navigationStart,
    };
  }).catch(() => null);

  // --login
  if (options.login) {
    console.log(chalk.yellow('\n  ⏳ Browser is open. Log in to the app.'));
    console.log(chalk.cyan('  → When done, press Enter to start testing.\n'));
    await waitForEnter();
    await page.waitForTimeout(500);
    print(chalk.green(`  ✔  Resuming test from: ${page.url()}`));
  }

  let pageStats = null;
  const startTime = Date.now();

  if (options.crawl) {
    // ── Crawl mode — multi-page ────────────────────────────────
    pageStats = await crawlAndTest(page, page.url(), options, log, print);
  } else {
    // ── Single page mode ───────────────────────────────────────
    spin.start('Scanning clickable elements...');
    const allElements = await getAllClickableElements(page);
    spin.stop();

    const elements = filterByMode(allElements, options);
    const modeTag  = (modeColors[mode] || chalk.white)(`[${mode}]`);
    print(chalk.blue(`\n  🔍 Found ${allElements.length} elements → testing ${chalk.bold(elements.length)} ${modeTag}\n`));

    if (elements.length === 0) {
      print(chalk.yellow('  ⚠️  No elements to test after filtering.\n'));
      if (browser) await browser.close(); else await context.close();
      return;
    }

    await clickAndCollect(page, elements, log, print, options, null, null, page.url());
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Output
  if (options.flat) {
    printFlatReport(log, testUrl, elapsed, mode, pageStats);
  } else {
    printSummaryReport(log, testUrl, elapsed, perfTiming, options.browser || 'chrome', mode, pageStats);
  }

  // Export
  if (options.export) {
    const filePath = exportConsoleReport(log, testUrl, elapsed, options, mode);
    print(chalk.green(`\n  ✅ Report saved to: ${filePath}`));
  }
  if (options.json) {
    exportJsonReport(buildJsonResult(log, testUrl, elapsed, options, mode, pageStats));
  }

  if (browser) await browser.close(); else await context.close();
}

module.exports = { runTests };