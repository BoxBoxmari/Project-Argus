/**
 * Project Argus - Compat helpers for Puppeteer/Playwright-like surface
 * Works on Puppeteer 24.x and shields scraper from API drift.
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Default blocker for noisy requests and large media files */
function shouldBlockRequest(url) {
  try { 
    return /\/gen_204\b/.test(url) || 
           /\/vt\/stream\b/.test(url) ||
           /(\.mp4|\.webm|\.m3u8|\.ts|\.m4v|\.avi|\.mov)\b/i.test(url);
  }
  catch { /* ignore errors */ return false; }
}

/** Bind interception in a way that works across Puppeteer versions */
async function bindRoutingCompat(page, blocker = shouldBlockRequest) {
  if (!page) return;
  const handled = new WeakSet();
  if (typeof page.setRequestInterception === 'function') {
    await page.setRequestInterception(true);
    page.removeAllListeners('request');
    page.on('request', req => {
      try {
        if (handled.has(req)) return;
        handled.add(req);
        const url = req.url();
        if (blocker && blocker(url)) return req.abort();
        return req.continue();
      } catch {
        try { req.continue(); } catch { /* ignore errors */ } // best effort
      }
    });
  }
}

/** Wait helper: prefer native, fallback to sleep */
async function pageWait(page, ms) {
  if (page && typeof page.waitForTimeout === 'function') return page.waitForTimeout(ms);
  return sleep(ms);
}

/** Init-script injector: Playwright (addInitScript) vs Puppeteer (evaluateOnNewDocument) */
async function injectInitScript(page, scriptOrFn, arg) {
  if (page && typeof page.addInitScript === 'function') {
    // Playwright-style
    return arg !== undefined ? page.addInitScript(scriptOrFn, arg) : page.addInitScript(scriptOrFn);
  }
  if (page && typeof page.evaluateOnNewDocument === 'function') {
    // Puppeteer-style
    if (typeof scriptOrFn === 'function') return page.evaluateOnNewDocument(scriptOrFn, arg);
    return page.evaluateOnNewDocument(scriptOrFn);
  }
  throw new Error('[compat] No init-script API available on page');
}

/** Alias for injectInitScript for backward compatibility */
async function addInitScriptCompat(page, scriptOrFn, arg) {
  return injectInitScript(page, scriptOrFn, arg);
}

/** Browser context factory across engines */
async function createIsolatedContext(browser, opts = {}) {
  if (browser?.newContext) {
    // Playwright
    return browser.newContext(opts);
  }
  if (browser?.createBrowserContext) {
    // Puppeteer >= v22
    return browser.createBrowserContext();
  }
  if (browser?.createIncognitoBrowserContext) {
    // Puppeteer legacy
    return browser.createIncognitoBrowserContext();
  }
  throw new Error('[compat] No context factory on browser');
}

/** Create new page in isolated context with fallback */
async function newPageCompat(browser) {
  try {
    const ctx = await createIsolatedContext(browser);
    return await ctx.newPage();
  } catch (e) {
    console.warn('newPageCompat fallback:', e?.message || e);
    return await browser.newPage();
  }
}

/** Alias for newPageCompat for backward compatibility */
async function newIsolatedPage(browser) {
  return newPageCompat(browser);
}

/** Compute exponential backoff with jitter */
function computeBackoffMs(attempt, baseMs = 800, capMs = 8000) {
  const exp = Math.min(baseMs * Math.pow(2, attempt), capMs);
  const jitter = Math.floor(Math.random() * 200);
  return exp + jitter;
}

/** Safe evaluate that retries on context-destroyed during nav */
async function safeEvaluate(page, fn, ...args) {
  try {
    return await page.evaluate(fn, ...args);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('Execution context was destroyed') || msg.includes('Cannot find context')) {
      await pageWait(page, 250);
      return page.evaluate(fn, ...args);
    }
    throw e;
  }
}

/**
 * routeAll: unify request interception. If page.route exists we use it (PW-like),
 * else fallback to Puppeteer request interception. Prevent double-handle by WeakSet.
 */
async function routeAll(page, predicateOrHandler, maybeHandler) {
  const handled = new WeakSet();

  const handler = (routeOrReq) => {
    // Normalize to { url, method, resourceType, headers, continue, abort }
    let url, method, resourceType, headers, _continue, _abort, key;

    if (routeOrReq.request) {
      // Playwright route
      const req = routeOrReq.request();
      url = req.url(); method = req.method(); resourceType = req.resourceType?.(); headers = req.headers?.();
      key = req;
      _continue = (over = {}) => {
        if (handled.has(key)) return;
        handled.add(key);
        return routeOrReq.continue(over);
      };
      _abort = (code = 'blockedbyclient') => {
        if (handled.has(key)) return;
        handled.add(key);
        return routeOrReq.abort(code);
      };
    } else {
      // Puppeteer request
      const req = routeOrReq;
      url = req.url(); method = req.method(); resourceType = req.resourceType(); headers = req.headers();
      key = req;
      _continue = (over = {}) => {
        if (handled.has(key)) return;
        handled.add(key);
        return req.continue(over);
      };
      _abort = (code = 'blockedbyclient') => {
        if (handled.has(key)) return;
        handled.add(key);
        return req.abort(code);
      };
    }

    if (typeof predicateOrHandler === 'function' && maybeHandler === undefined) {
      return predicateOrHandler({ url, method, resourceType, headers, continue: _continue, abort: _abort });
    }

    const predicate = predicateOrHandler || (() => true);
    const userHandler = maybeHandler || (() => _continue());
    if (predicate({ url, method, resourceType, headers })) return userHandler({ url, method, resourceType, headers, continue: _continue, abort: _abort });
    return _continue();
  };

  if (typeof page.route === 'function') {
    // PW-like
    await page.route('**/*', handler);
    return;
  }

  // Puppeteer fallback
  if (!page._argusInterceptionOn) {
    await page.setRequestInterception(true);
    page._argusInterceptionOn = true;
  }
  page.removeAllListeners('request'); // ensure single handler
  page.on('request', handler);
}

// eslint-disable-next-line no-undef
module.exports = {
  sleep,
  pageWait,
  injectInitScript,
  addInitScriptCompat,
  createIsolatedContext,
  newIsolatedPage,
  newPageCompat,
  computeBackoffMs,
  shouldBlockRequest,
  bindRoutingCompat,
  routeAll,
  safeEvaluate,
};
