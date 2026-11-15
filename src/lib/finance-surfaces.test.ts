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
