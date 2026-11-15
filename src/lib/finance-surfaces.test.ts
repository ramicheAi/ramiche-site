import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard for every production surface that can show money.
 *
 * The Finance HQ failure was not one bad component. It was four surfaces that each carried their
 * own invented figure, so fixing one left the others lying. This test reads the source of each
 * surface and fails if an invented money literal reappears, or if a surface stops reading the
 * shared truth model.
 *
 * Comments are stripped before scanning so an explanation of the old bug is still allowed.
 */

const ROOT = join(__dirname, '..', '..');

const SURFACES: { file: string; label: string }[] = [
  { file: 'src/components/command-center/po/FinanceHQ.tsx', label: 'Finance HQ' },
  { file: 'src/components/command-center/CommandHUD.tsx', label: 'HUD' },
  { file: 'src/components/command-center/po/Sanctuary.tsx', label: 'Sanctuary' },
  { file: 'src/components/command-center/po/Stage.tsx', label: 'Stage' },
  { file: 'src/components/command-center/po/CommandView.tsx', label: 'CommandView vitals' },
  { file: 'src/components/command-center/StatusDock.tsx', label: 'HUD revenue dock' },
];

// Screens that show money but are not yet migrated to the shared hook. They still must not carry
// an invented figure or a permanent claim of live data.
const BANNED_ONLY: { file: string; label: string }[] = [
  { file: 'src/app/command-center/revenue/page.tsx', label: 'Revenue page' },
  { file: 'src/app/command-center/reports/page.tsx', label: 'Reports page' },
  { file: 'src/lib/po-data.ts', label: 'Demo data module' },
];

// Money figures that were invented in the original shell. Each one is tied to a real observed
// screenshot: $48.2k (HUD/Sanctuary/Stage), $49.4k and $593k (Finance HQ), the Cirrus AI / Quanta
// Systems transactions, and the +6% week-over-week claim.
const BANNED = [/\$48\.2k/, /48200/, /\$49\.4k/, /\$593k/, /Cirrus AI/, /Quanta Systems/, /\+6%/];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('no production surface can show invented money', () => {
  for (const surface of SURFACES) {
    it(`${surface.label} carries no hardcoded revenue figures`, () => {
      const raw = readFileSync(join(ROOT, surface.file), 'utf8');
      const code = stripComments(raw);
      for (const pattern of BANNED) {
        expect(code, `${surface.file} contains ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  for (const surface of BANNED_ONLY) {
    it(`${surface.label} carries no hardcoded revenue figures`, () => {
      const code = stripComments(readFileSync(join(ROOT, surface.file), 'utf8'));
      for (const pattern of BANNED) {
        expect(code, `${surface.file} contains ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it('an unavailable feed is never rendered as a measured zero', () => {
    // The revenue endpoint answers 200 with subscriptions {0,0,0} and source "unavailable".
    // Both surfaces must gate on the source, not on the number.
    for (const file of [
      'src/app/command-center/revenue/page.tsx',
      'src/app/command-center/reports/page.tsx',
      'src/components/command-center/StatusDock.tsx',
    ]) {
      const code = stripComments(readFileSync(join(ROOT, file), 'utf8'));
      expect(code, `${file} prints money without checking the source`).toMatch(
        /source === "live"|state === "ok"|revenueLabel\(/,
      );
    }
  });

  it('reports does not invent a loss from an unmeasured zero', () => {
    // The P&L panel subtracts a real expense figure from revenue. If revenue is an unmeasured 0,
    // that arithmetic produces a fabricated loss, so both must be null-gated, not just the tiles.
    const code = stripComments(readFileSync(join(ROOT, 'src/app/command-center/reports/page.tsx'), 'utf8'));
    expect(code).toMatch(/revenue30d === null/);
    expect(code).toMatch(/netPL === null/);
  });

  it('every money surface reads the shared truth model', () => {
    for (const surface of SURFACES) {
      const raw = readFileSync(join(ROOT, surface.file), 'utf8');
      const importsTruth =
        /from ['"]@\/lib\/finance-truth['"]/.test(raw) ||
        /from ['"]@\/hooks\/useFinanceTruth['"]/.test(raw);
      expect(importsTruth, `${surface.file} does not import the finance truth model`).toBe(true);
    }
  });

  it('never reaches demo data without an explicit request', () => {
    // A surface may only touch demo fixtures behind isDemoRequested. FinanceHQ used to assign
    // DEMO_STATE directly, which would have made invented revenue reachable without ?demo=1.
    for (const surface of SURFACES) {
      const code = stripComments(readFileSync(join(ROOT, surface.file), 'utf8'));
      if (/DEMO_STATE/.test(code)) {
        expect(code, `${surface.file} touches demo data without a demo guard`).toMatch(/isDemoRequested/);
      }
    }
  });
});
