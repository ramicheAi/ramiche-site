/**
 * CC shell harness — mounts the Command Center shell's real stylesheets over the real element
 * structure and measures it in Chromium.
 *
 * WHY THIS EXISTS. The defects the independent review found in PR #90 are stacking and sizing
 * defects: an overlay above the HUD (so the menu could not close the drawer), a drawer that covered
 * the menu button, a blanket `button { min-height: 44px }` that inflated rail dividers and clipped
 * dense rows, and a chat pane sized from the viewport while its container also gained the alert
 * ticker's 38px. None of those is visible to jsdom, which does not lay anything out.
 *
 * WHAT IT IS NOT. It is not the authenticated application. The real `/command-center` pages sit
 * behind the owner guard (Firebase session or a trusted-device PIN cookie checked against a live
 * database row), and this pass may not weaken that. So the shell's markup is reproduced here, with
 * the shell's own CSS extracted from the component at test time, and measured. Data panels are
 * absent; the shell, the HUD, the drawer, the overlay and the chat pane are not.
 *
 * USAGE: node scripts/cc-shell-harness.mjs [--shots]
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const OUT = join(ROOT, 'ops-handoff/cc-mobile-ux-remediation');

/** The two responsive <style> template blocks from the shell component, verbatim. */
function shellCss() {
  const src = readFileSync(join(ROOT, 'src/app/command-center/CommandCenterClientLayout.tsx'), 'utf8');
  const blocks = [...src.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]);
  if (!blocks.length) throw new Error('no shell <style> blocks found');
  return blocks.join('\n');
}

/** Page-scoped stylesheets that the shell depends on: the chat pane sizes itself in its own file. */
function pageCss() {
  const src = readFileSync(join(ROOT, 'src/app/command-center/chat/page.tsx'), 'utf8');
  return [...src.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]).join('\n');
}

const PO_CSS = [
  'po-theme.css', 'po-holo.css', 'po-canopy.css', 'po-ui.css', 'po-command.css',
  'po-stage.css', 'po-avatar.css', 'po-chat.css', 'po-console.css', 'po-pages.css',
  'po-sanctuary.css', 'po-boot.css', 'po-mobile.css',
].map((f) => readFileSync(join(ROOT, 'src/app/command-center/po', f), 'utf8')).join('\n');

/**
 * Markup mirrors the shipped structure: the `<aside class="po-side">` drawer with its close button
 * and quick controls, the fixed `#cc-hud` header carrying the menu button, the `#cc-content`
 * column, the `#cc-alertbar` ticker, the briefing sheet, and the chat pane.
 */
const page = () => `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>${PO_CSS}</style>
<style>${shellCss()}</style>
<style>${pageCss()}</style>
<style>
  /* harness-only scaffolding so the shell's own rules are the ones under test */
  html,body{margin:0;background:#08080c;color:#e8e8ef;font-family:system-ui}
  .po-shell{min-height:100dvh}
  .arb{height:1200px}
</style>
</head>
<body><div class="po-shell"><div class="po-app">
  <aside class="po-side fixed left-0 top-0 z-40 transition-transform duration-200 -translate-x-full md:translate-x-0"
         id="drawer" style="position:fixed;height:100dvh">
    <button type="button" class="po-side-close" aria-label="Close navigation">✕</button>
    <div class="po-side-head"><div class="nm">PARALLAX</div><div class="ver">OS v4 · COMMAND CENTER</div></div>
    <nav class="po-nav po-scroll">
      <div class="po-nav-grp open">
        <button type="button" class="po-nav-sec" id="railDivider" aria-expanded="true"><span class="po-nav-sec-lbl">OPERATIONS</span></button>
        <div class="po-nav-items"><div class="po-nav-items-inner">
          <a class="po-navitem on" href="#"><span class="ic">◇</span><span class="lbl">Dashboard</span></a>
          <a class="po-navitem" href="#"><span class="ic">⚡</span><span class="lbl">Jobs</span></a>
        </div></div>
      </div>
    </nav>
    <div class="po-side-foot"><span>ATLAS v4 // 20 AGENTS</span></div>
    <div class="po-side-quick" role="group" aria-label="Quick controls">
      <button type="button" class="po-quick" aria-label="Show chat pulse" aria-pressed="false"><span aria-hidden>◈</span><span class="lbl">Pulse</span></button>
      <button type="button" class="po-quick" aria-label="Enable wake word" aria-pressed="false"><span aria-hidden>◉</span><span class="lbl">Wake word</span></button>
      <button type="button" class="po-quick" aria-label="Light theme" aria-pressed="false"><span aria-hidden>☀</span><span class="lbl">Theme</span></button>
    </div>
  </aside>

  <header id="cc-hud" role="banner" class="po-top" style="position:fixed;top:0;left:0;right:0;z-index:70;margin-left:0">
    <button type="button" id="menuBtn" class="po-menu-btn" aria-label="Open navigation" aria-expanded="false"><span aria-hidden>☰</span></button>
    <button type="button" class="po-cmdbar" aria-label="Open command palette"><span class="txt">Jump to anything</span></button>
    <span class="po-clock tnum">20:52</span>
    <button type="button" class="po-icbtn" aria-label="Toggle light / dark">☀</button>
    <button type="button" class="po-atlasbtn" aria-label="Ask ATLAS">ASK ATLAS</button>
  </header>

  <div id="cc-alertbar" style="position:fixed;left:0;right:0"><span class="po-alertbar-tag mono">⚠ 1 CRITICAL</span></div>

  <section class="atlas-briefing" id="briefing" style="position:fixed;right:0;top:0;width:96vw">ATLAS BRIEFING</section>

  <div id="cc-content" style="flex:1;min-width:0;min-height:100vh;padding-top:64px;overflow-x:hidden">
    <div class="chat-root" id="chatRoot" style="display:flex;flex-direction:column;height:calc(100vh - 56px)">
      <div style="flex:1;overflow-y:auto" class="chat-scroll">
        <div id="taskRow" style="display:flex;gap:6px;padding:8px">
          <button type="button" class="task-quick flex-1 text-[10px] py-1.5 rounded-lg font-medium">Start</button>
          <button type="button" class="task-quick flex-1 text-[10px] py-1.5 rounded-lg font-medium">Move</button>
        </div>
        <div id="inlineRow" style="display:flex;gap:8px;padding:8px">
          <button type="button" style="padding:2px 6px;font-size:9px">✏️ Edit</button>
        </div>
        <div class="arb"></div>
      </div>
      <div class="chat-input-area"><textarea class="chat-input-textarea" placeholder="Message"></textarea></div>
    </div>
  </div>
</div></div>
<script>
  // the shipped page toggles this class; the harness toggles it the same way
  window.__openDrawer = (open) => {
    const d = document.getElementById('drawer'), m = document.getElementById('menuBtn');
    d.classList.toggle('-translate-x-full', !open);
    d.classList.toggle('translate-x-0', open);
    m.setAttribute('aria-expanded', String(open));
    let ov = document.getElementById('overlay');
    if (open && !ov) {
      ov = document.createElement('div');
      ov.id = 'overlay'; ov.className = 'po-nav-overlay';
      // position/inset are what make z-index meaningful; the shell rule only sets z and top.
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8)';
      document.querySelector('.po-app').appendChild(ov);
    } else if (!open && ov) ov.remove();
  };
</script>
</body></html>`;

const html = page();
const server = createServer((req, res) => {
  if (req.url && req.url.startsWith('/po/')) {
    try {
      const f = readFileSync(join(ROOT, 'src/app/command-center/po', req.url.slice(4)), 'utf8');
      res.writeHead(200, { 'content-type': 'text/css' });
      return res.end(f);
    } catch {
      res.writeHead(404);
      return res.end();
    }
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}/`;

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/homebrew/lib/node_modules/playwright/index.mjs');
const browser = await chromium.launch();
const failures = [];
const results = [];
const check = (ok, msg) => (ok ? results.push(`  ok   ${msg}`) : failures.push(msg));

// 667 is deliberate: the drawer's section-header floor had a gap only in 641-767, and a sweep that
// skips that band cannot see it.
const WIDTHS = [320, 375, 390, 430, 667, 768, 1024, 1440];
if (SHOTS) mkdirSync(OUT, { recursive: true });

for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
  const pageEl = await context.newPage();
  await pageEl.goto(BASE, { waitUntil: 'load' });

  const m = await pageEl.evaluate(() => {
    const cs = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    };
    const menu = document.querySelector('#menuBtn');
    const mr = menu.getBoundingClientRect();
    const hitEl = document.elementFromPoint(mr.x + mr.width / 2, mr.y + mr.height / 2);
    const hit = hitEl ? (hitEl.closest('#menuBtn') ? { id: 'menuBtn', className: '', tagName: 'BUTTON' } : hitEl) : null;
    const alertbar = document.getElementById('cc-alertbar');
    return {
      hudZ: Number(getComputedStyle(document.getElementById('cc-hud')).zIndex),
      drawerZ: Number(cs('#drawer', 'zIndex')),
      drawerTop: rect('#drawer').y,
      drawerBottom: rect('#drawer').bottom,
      drawerW: rect('#drawer').width,
      menu: rect('#menuBtn'),
      menuHit: hit ? (hit.id || hit.className || hit.tagName) : null,
      menuVisible: getComputedStyle(menu).display !== 'none',
      railH: rect('#railDivider') ? rect('#railDivider').h : null,
      quick: rect('.po-side-quick') ? rect('.po-side-quick').h : null,
      quickDisplay: cs('.po-side-quick', 'display'),
      // "visible" is not "display:grid": a blank, unnamed box satisfies that. Measure the control.
      quickButtons: [...document.querySelectorAll('.po-side-quick .po-quick')].map((b) => {
        const st = getComputedStyle(b);
        const icon = b.querySelector('span[aria-hidden]');
        const ics = icon ? getComputedStyle(icon) : null;
        const r = b.getBoundingClientRect();
        const alpha = (c) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return 1;
          const parts = m[1].split(',').map((x) => parseFloat(x));
          return parts.length === 4 ? parts[3] : 1;
        };
        return {
          name: b.getAttribute('aria-label') || (b.textContent || '').trim(),
          labelled: !!b.getAttribute('aria-label'),
          w: r.width,
          h: r.height,
          border: st.borderTopStyle !== 'none' && parseFloat(st.borderTopWidth) > 0,
          background: st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent',
          // a rectangle, a border and a background all still compute "painted" on an invisible box
          visible: st.visibility === 'visible' && parseFloat(st.opacity) > 0,
          iconSize: ics ? parseFloat(ics.fontSize) : 0,
          iconInk: ics ? alpha(ics.color) : 0,
          iconText: icon ? (icon.textContent || '').trim().length > 0 : false,
        };
      }),
      hudSecondary: cs('.po-hud-secondary', 'display'),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      chatH: rect('#chatRoot') ? rect('#chatRoot').h : null,
      chatBottom: rect('#chatRoot') ? rect('#chatRoot').bottom : null,
      composerBottom: rect('.chat-input-area') ? rect('.chat-input-area').bottom : null,
      contentPadTop: Number(getComputedStyle(document.getElementById('cc-content')).paddingTop.replace('px', '')),
      alertTop: rect('#cc-alertbar') ? rect('#cc-alertbar').y : null,
      actionH: rect('#taskRow button') ? rect('#taskRow button').h : null,
      actionW: rect('#taskRow button') ? rect('#taskRow button').w : null,
      inlineH: rect('#inlineRow button') ? rect('#inlineRow button').h : null,
      vh: window.innerHeight,
      alertExists: !!alertbar,
    };
  });

  // ── stacking: overlay under the HUD, drawer over both but below the menu button's plane ──
  const narrow = width <= 767;
  const wide = width >= 768;
  if (wide) {
    check(m.drawerTop === 0, `${width}px: the permanent rail still starts at the top (${m.drawerTop})`);
    check(!m.menuVisible, `${width}px: the HUD menu button is hidden where the rail shows`);
    check(m.railH !== null && m.railH < 44, `${width}px: the rail divider is not inflated (${m.railH}px)`);
  }
  if (width >= 1025) {
    check(m.quickDisplay === 'none', `${width}px: quick controls hidden where the HUD shows its own`);
  }
  if (width <= 1024) {
    check(m.quickDisplay !== 'none', `${width}px: quick controls present in the band the HUD hides them`);
    check(m.quickButtons.length === 3, `${width}px: three quick controls (${m.quickButtons.length})`);
    for (const b of m.quickButtons) {
      check(b.labelled, `${width}px: quick control "${b.name}" has an aria-label`);
      check(b.w >= 44 && b.h >= 44, `${width}px: quick control "${b.name}" is ${b.w}x${b.h}, expected >=44`);
      check(b.visible, `${width}px: quick control "${b.name}" is actually visible (visibility/opacity)`);
      check(b.border && b.background, `${width}px: quick control "${b.name}" paints chrome (border=${b.border} bg=${b.background})`);
      check(b.iconSize >= 14 && b.iconInk > 0 && b.iconText,
        `${width}px: quick control "${b.name}" has a drawn, inked glyph (${b.iconSize}px, ink ${b.iconInk})`);
    }
  }
  if (narrow) {
    check(m.menuVisible, `${width}px: the menu button is visible on a phone`);
    check(m.menu.w >= 44 && m.menu.h >= 44, `${width}px: menu target is ${m.menu.w}x${m.menu.h}, expected >=44`);
    check(m.menuHit === 'menuBtn', `${width}px: the menu button is the topmost element at its own centre (got ${m.menuHit})`);
    check(m.drawerTop >= 55 && m.drawerTop <= 57, `${width}px: drawer starts below the HUD (${m.drawerTop})`);
    check(m.drawerBottom <= m.vh + 1, `${width}px: drawer ends at the viewport (${m.drawerBottom} <= ${m.vh})`);
    check(m.quick !== null && m.quick >= 44, `${width}px: quick-control row is ${m.quick}px tall`);
    check(m.actionH >= 43, `${width}px: task quick actions get a 44px floor (${m.actionH}px)`);
    check(m.actionW !== undefined && m.inlineH < 44,
      `${width}px: a deliberately compact inline control stays compact (${m.inlineH}px)`);
  }
  check(!m.docOverflow, `${width}px: no horizontal document overflow`);

  // ── the drawer, open: geometry, then the menu must still be the topmost hit target ──
  if (narrow) {
    await pageEl.evaluate(() => window.__openDrawer(true));
    const o = await pageEl.evaluate(() => {
      const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
      const menu = document.querySelector('#menuBtn');
      const r = menu.getBoundingClientRect();
      const hitEl = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const hit = hitEl ? (hitEl.closest('#menuBtn') ? { id: 'menuBtn', className: '', tagName: 'BUTTON' } : hitEl) : null;
      const drawer = document.querySelector('#drawer').getBoundingClientRect();
      const ov = document.getElementById('overlay');
      return {
        overlayZ: ov ? Number(getComputedStyle(ov).zIndex) : null,
        hudZ: Number(getComputedStyle(document.getElementById('cc-hud')).zIndex),
        drawerZ: Number(cs('#drawer', 'zIndex')),
        hit: hit ? (hit.id || hit.className || hit.tagName) : null,
        drawerLeft: drawer.x,
        expanded: menu.getAttribute('aria-expanded'),
      };
    });
    check(o.overlayZ !== null && o.overlayZ < o.hudZ, `${width}px: overlay z ${o.overlayZ} is below HUD z ${o.hudZ}`);
    check(o.hit === 'menuBtn', `${width}px: with the drawer open the menu is still clickable (got ${o.hit})`);
    check(o.expanded === 'true', `${width}px: the menu reports aria-expanded=true while open`);
    check(o.drawerLeft === 0, `${width}px: the open drawer is flush left (${o.drawerLeft})`);

    if (SHOTS) {
      await pageEl.screenshot({ path: join(OUT, `drawer-open-${width}.png`) });
      await pageEl.evaluate(() => window.__openDrawer(false));
      await pageEl.screenshot({ path: join(OUT, `shell-${width}.png`) });
    }
  }

  // ── chat with the alert ticker present: the composer must stay on screen ──
  {
    check(m.alertExists, `${width}px: the harness has the alert ticker mounted`);
    // The pane occupies everything the content box has left: viewport minus the HUD and ticker
    // inset. (Subtracting 56 as well double-counts the HUD, which the inset already contains.)
    const expected = m.vh - m.contentPadTop;
    check(Math.abs(m.chatH - expected) <= 1,
      `${width}px: chat pane is ${m.chatH}px, expected ${expected} to clear the ${m.contentPadTop}px content inset`);
    check(m.composerBottom !== null && m.composerBottom <= m.vh + 1,
      `${width}px: composer bottom ${m.composerBottom} <= viewport ${m.vh}`);
  }

  // ── the same pane with no alert: the 38px must be given back, not left as dead space ──
  {
    const noAlert = await pageEl.evaluate(() => {
      document.getElementById('cc-alertbar')?.remove();
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { h: b.height, bottom: b.bottom };
      };
      return {
        padTop: Number(getComputedStyle(document.getElementById('cc-content')).paddingTop.replace('px', '')),
        chat: r('#chatRoot'),
        composer: r('.chat-input-area'),
        vh: window.innerHeight,
      };
    });
    check(Math.abs(noAlert.chat.h - (noAlert.vh - noAlert.padTop)) <= 1,
      `${width}px (no alert): chat pane ${noAlert.chat.h} fills the ${noAlert.padTop}px inset`);
    check(noAlert.composer.bottom <= noAlert.vh + 1,
      `${width}px (no alert): composer bottom ${noAlert.composer.bottom} <= ${noAlert.vh}`);
    results.push(`  --   ${width}px (no alert): paddingTop=${noAlert.padTop} chatH=${noAlert.chat.h} composerBottom=${noAlert.composer.bottom}`);
  }

  if (SHOTS && width >= 768) {
    await pageEl.screenshot({ path: join(OUT, `rail-${width}.png`) });
  }
  results.push(`  --   ${width}px: paddingTop=${m.contentPadTop} chatH=${m.chatH} composerBottom=${m.composerBottom} rail=${m.railH} actions=${m.actionW}x${m.actionH}`);
  await context.close();
}

await browser.close();
server.close();

console.log(results.join('\n'));
if (failures.length) {
  console.log(`\nCC shell harness: ${failures.length} failed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`\nCC shell harness: all ${results.filter((r) => r.startsWith('  ok')).length} checks passed`);
