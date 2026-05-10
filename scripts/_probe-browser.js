// Headless browser probe: load critical pages, capture console errors/warnings.
const { chromium } = require('playwright');

const PAGES = [
  '/command-center',
  '/command-center/activity',
  '/command-center/agents',
  '/command-center/app-builder',
  '/command-center/calendar',
  '/command-center/chat',
  '/command-center/comms',
  '/command-center/content',
  '/command-center/docs',
  '/command-center/fabrication',
  '/command-center/finance',
  '/command-center/finance/arbitrage',
  '/command-center/health',
  '/command-center/legal',
  '/command-center/memory',
  '/command-center/missions',
  '/command-center/nerve-center',
  '/command-center/nexus',
  '/command-center/observatory',
  '/command-center/observatory/live',
  '/command-center/office',
  '/command-center/projects',
  '/command-center/reports',
  '/command-center/revenue',
  '/command-center/sales',
  '/command-center/sales/agent-pricing',
  '/command-center/sales/pricing',
  '/command-center/sales/proposals',
  '/command-center/security',
  '/command-center/settings',
  '/command-center/signal-wire',
  '/command-center/strategy',
  '/command-center/studio',
  '/command-center/tasks',
  '/command-center/terminal',
  '/command-center/vitals',
  '/command-center/wellness',
  '/command-center/yolo',
  '/command-center/yolo/nerve-center',
  '/command-center/yolo/signal-wire',
  '/apex-athlete/coach',
  '/apex-athlete/portal',
  '/apex-athlete/parent',
  '/apex-athlete/login',
  '/apex-athlete/landing',
  '/apex-athlete/billing',
  '/apex-athlete/guide',
  '/apex-athlete/onboard',
  '/apex-athlete/meet-tracker',
  '/apex-athlete/football-demo',
  '/apex-athlete/demo',
  '/clawguard',
  '/agents',
  '/financial',
  '/forge',
  '/studio',
  '/publish',
  '/pricing/modeler',
  '/power-challenge',
  '/power-challenge/admin',
  '/power-challenge/register',
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Pre-set the CC PIN session storage so we land directly on the gated pages.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem(
        'cc-pin-auth',
        JSON.stringify({ ok: true, ts: Date.now(), lastActivity: Date.now() })
      );
    } catch {}
  });

  const summary = {};
  for (const route of PAGES) {
    const errors = [];
    const warns = [];
    const failed = [];
    const responses = [];
    const onConsole = (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') errors.push(text);
      else if (msg.type() === 'warning') warns.push(text);
    };
    const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
    const onRequestFailed = (req) => {
      failed.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || ''}`);
    };
    const onResponse = (resp) => {
      const s = resp.status();
      if (s >= 400) responses.push(`${s} ${resp.request().method()} ${resp.url()}`);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    let status = 'ok';
    try {
      const resp = await page.goto(`http://localhost:4007${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      status = resp ? `${resp.status()}` : 'no-response';
    } catch (e) {
      status = `nav-error: ${e.message.slice(0, 80)}`;
    }
    // Give async effects (Supabase, fetch polls) a moment to settle.
    await page.waitForTimeout(2500);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);

    // Dedupe noisy repeats so the report stays useful.
    const dedupe = (arr) => {
      const counts = new Map();
      for (const m of arr) {
        const key = m.length > 200 ? m.slice(0, 200) : m;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${n}× ${m}`);
    };
    summary[route] = {
      status,
      errors: dedupe(errors),
      warns: dedupe(warns),
      bad_responses: dedupe(responses),
      failed_requests: dedupe(failed.filter((f) => !/chrome-extension|va\.vercel-scripts|vitals\.vercel-insights|favicon|service.?worker/i.test(f))),
    };
  }
  await browser.close();
  // Filter to only routes with real issues (after stripping the well-known
  // external-resolution failures that depend on internet to supabase.co).
  const issues = {};
  for (const [route, info] of Object.entries(summary)) {
    const reportableErrors = info.errors.filter(
      (e) => !/qkbkfsjkysdsfmhgfdoc\.supabase\.co|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|WebSocket connection.*supabase/i.test(e),
    );
    const reportableFailed = info.failed_requests.filter(
      (f) => !/qkbkfsjkysdsfmhgfdoc\.supabase\.co|firestore\.googleapis\.com|ERR_NAME_NOT_RESOLVED/i.test(f),
    );
    if (
      info.status !== '200' ||
      reportableErrors.length > 0 ||
      info.bad_responses.length > 0 ||
      reportableFailed.length > 0
    ) {
      issues[route] = {
        status: info.status,
        errors: reportableErrors,
        warns: info.warns,
        bad_responses: info.bad_responses,
        failed_requests: reportableFailed,
      };
    }
  }
  console.log('=== ROUTES WITH ISSUES ===');
  console.log(JSON.stringify(issues, null, 2));
  console.log('=== ROUTES TESTED:', Object.keys(summary).length, ' WITH ISSUES:', Object.keys(issues).length, '===');
})();
