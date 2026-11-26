/**
 * @vitest-environment node
 *
 * Shell invariants for the Command Center mobile shell.
 *
 * Each assertion here reproduces a defect the independent review of PR #90 found, so the fix
 * fails these tests when it is reverted. Several of them are read from source because the shell's
 * responsive rules are a CSS-in-JS template string that no jsdom layout engine evaluates; the
 * behavioural half of the drawer lives in Sidebar.mobile.test.tsx instead.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** vitest runs from the repository root */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const rootLayout = read('src/app/layout.tsx');
const ccLayout = read('src/app/command-center/layout.tsx');
const shell = read('src/app/command-center/CommandCenterClientLayout.tsx');
const hud = read('src/components/command-center/CommandHUD.tsx');
const sidebar = read('src/components/command-center/Sidebar.tsx');
const chat = read('src/app/command-center/chat/page.tsx');

/** the two responsive <style> blocks in the shell, joined */
const shellCss = [...shell.matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]).join('\n');

describe('safe-area scope', () => {
  it('does not put viewport-fit on the marketing root layout', () => {
    expect(rootLayout).not.toMatch(/viewportFit/);
  });

  it('keeps viewport-fit on the Command Center layout', () => {
    expect(ccLayout).toMatch(/viewportFit:\s*["']cover["']/);
  });

  it('handles safe-area insets nowhere outside the Command Center', () => {
    // viewportFit:cover without a matching inset is how a layout slides under the notch, so if the
    // inset handling ever spreads into marketing code the two must arrive together.
    const outside = execSync(
      "grep -rl 'safe-area-inset' src/app src/components src/lib 2>/dev/null | grep -v command-center || true",
      { cwd: process.cwd(), encoding: 'utf8' }
    ).trim();
    expect(outside, `safe-area handling leaked outside Command Center: ${outside}`).toBe('');
  });
});

describe('chat height against the alert ticker', () => {
  it('reserves the ticker in the phone chat height', () => {
    // #cc-content gains 38px of top padding when the ticker is mounted, so a chat pane sized from
    // 100dvh alone overflows by exactly that much and pushes the composer under the fold.
    // #93 replaced the literal 100dvh with the visible-viewport variable so the composer follows
    // the iOS keyboard. Accept either form; the 94px ticker allowance is still required.
    expect(chat).toMatch(/body:has\(#cc-alertbar\)\s+\.chat-root\s*\{[^}]*(?:100dvh|--cc-vvh)[^}]*-\s*94px/);
  });

  it('reserves the ticker in the tablet and desktop chat height', () => {
    expect(shellCss).toMatch(/body:has\(#cc-alertbar\)\s+#cc-content\s+\.chat-root\s*\{[^}]*(?:100dvh|--cc-vvh)[^}]*-\s*102px/);
  });

  it('scopes the pane height to the content column rather than every page', () => {
    // An unqualified `.chat-root` rule on a shell that wraps every route would stomp any future
    // page that reuses the class, with nothing local to explain it.
    expect(shellCss).toMatch(/#cc-content\s+\.chat-root/);
    expect(shellCss).not.toMatch(/^\s*\.chat-root\s*\{/m);
  });
});

describe('header actions keep the phone floor', () => {
  it('sizes links and buttons in the page header, not only .pg-btn', () => {
    // Replacing the blanket button rule dropped these: the leads filter toggle is a plain button
    // and the calendar crons link is an anchor, both inside .pg-head-act.
    expect(shell).toMatch(/\.pg-head-act\s+a[^{]*\{[^}]*min-height:\s*44px/);
    expect(shell).toMatch(/\.pg-head-act\s+button/);
  });
});

describe('touch targets are targeted, not blanket', () => {
  it('no rule sizes every button in the shell', () => {
    // A blanket `button { min-height: 44px }` inflates the 26px rail dividers and turns dense
    // inline clusters (chat message actions) into 44px squares that clip.
    expect(shellCss).not.toMatch(/\.po-shell\s+button\s*\{/);
  });

  it('still sizes the icon controls and nav rows it means to', () => {
    expect(shellCss).toMatch(/\.po-shell\s+\.po-icbtn/);
    expect(shellCss).toMatch(/\.po-shell\s+\.po-navitem/);
    expect(shellCss).toMatch(/\.po-menu-btn/);
    // The task board's quick actions were 17px before the blanket rule hid the problem; they need
    // a floor of their own now that the blanket rule is gone.
    expect(shellCss).toMatch(/\.po-shell\s+\.task-quick/);
    expect(shellCss).toMatch(/\.po-shell\s+\.pg-btn/);
  });

  it('names only classes that exist, so the floor is not decorative', () => {
    // `.task-actions` was invented by an earlier draft and exists in no page; `.pg-head-act` is
    // real (po/Instrument.tsx renders it), so only the invented one is forbidden.
    expect(shellCss).not.toMatch(/task-actions/);
    // the component stopped emitting data-theme-state when Theme became a real aria-pressed toggle
    expect(shellCss).not.toMatch(/data-theme-state/);
    expect(shellCss).toMatch(/\.pg-head-act/);
  });
});

describe('HUD, overlay and drawer stacking', () => {
  const hudZ = Number((hud.match(/zIndex:\s*(\d+)/) || [])[1]);

  it('keeps the HUD above the drawer overlay so the menu can be reached', () => {
    const overlayZ = Number((shellCss.match(/\.po-nav-overlay\s*\{\s*z-index:\s*(\d+)/) || [])[1]);
    expect(hudZ).toBeGreaterThan(0);
    expect(overlayZ).toBeLessThan(hudZ);
  });

  it('starts the drawer below the phone HUD so the menu button stays clickable', () => {
    // If the drawer covers the HUD, the HUD menu cannot close it: the button opens the drawer and
    // can never close it, which is the regression the review found.
    expect(shellCss).toMatch(/\.po-side\s*\{[^}]*top:\s*calc\(56px \+ env\(safe-area-inset-top\)\)/);
  });

  it('labels the menu button as a toggle', () => {
    expect(hud).toMatch(/aria-expanded=\{/);
    expect(hud).toMatch(/aria-label=\{[\s\S]{0,120}Close navigation/);
  });
});

describe('drawer keyboard behaviour', () => {
  it('removes the closed drawer from interaction and the tab order', () => {
    expect(sidebar).toMatch(/inert=\{/);
  });

  it('closes on Escape', () => {
    expect(sidebar).toMatch(/["']Escape["']|key\s*===\s*["']Esc/);
  });

  it('restores focus to the menu button when it closes', () => {
    // The close branch specifically: the open branch also calls .focus(), so a loose match would
    // stay green with the restoration deleted.
    expect(sidebar).toMatch(/const target = usable \? from : document\.getElementById\('cc-menu-btn'\)/);
    expect(sidebar).toMatch(/if \(target\) target\.focus\(\)/);
  });

  it('treats <body> as "no opener", because mobile Safari does not focus buttons on tap', () => {
    expect(sidebar).toMatch(/from !== document\.body/);
  });
});

describe('secondary controls stay reachable on mobile and tablet', () => {
  const quick = sidebar.match(/po-side-quick[\s\S]*?<\/div>/);

  it('shows the quick controls across the whole range the HUD hides its copies', () => {
    // The HUD hides pulse/wake/theme at <=1024. If the drawer only restores them <=767, every
    // iPad width has no path to any of the three.
    const flat = shellCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    expect(flat, 'the quick row is not shown in the <=1024 range the HUD hides its copies')
      .toMatch(/@media \(max-width: 1024px\) \{ \.po-side-quick \{ display: grid/);
  });

  it('offers pulse, wake word and theme from the drawer', () => {
    expect(quick, 'the drawer has no quick-controls block').toBeTruthy();
    expect(quick ? quick[0] : '').toMatch(/Pulse/i);
    expect(quick ? quick[0] : '').toMatch(/Wake/i);
    expect(quick ? quick[0] : '').toMatch(/Theme|Appearance/i);
  });

  it('does not hide those controls behind the HUD-only class', () => {
    // The HUD may hide its own copies for density; the drawer copies must not carry the class that
    // hides them.
    const drawerCopy = quick ? quick[0] : '';
    expect(drawerCopy).not.toMatch(/po-hud-secondary/);
  });
});


describe('tablet header actions keep a finger-sized floor', () => {
  it('sizes raw header buttons and links in the 768-1024 band', () => {
    // Slice the band so the identical phone rule cannot satisfy this assertion.
    const start = shellCss.indexOf('@media (min-width: 768px) and (max-width: 1024px)');
    expect(start).toBeGreaterThan(-1);
    const band = shellCss.slice(start, shellCss.indexOf('@media', start + 10));
    expect(band).toMatch(/\.pg-head-act\s+a,\s*\.po-shell\s+\.pg-head-act\s+button\s*\{[^}]*min-height:\s*44px/);
  });
});
