/* ============================================================================
 * PARALLAX OS — Avatar: Galactik Antics character face token.
 * Pixar-style face crop, per-character framing, faction ring, glint, status pip.
 * Ported from prototype/po-avatar.jsx. CSS classes (.av3d/.av-token/…) live in
 * the ported po-avatar.css. Renders served from /assets/characters/N.png.
 * ========================================================================== */
import type { CSSProperties } from 'react';
import type { Agent } from '@/lib/po-data';

// per-character face framing: [ posX%, posY% (head center), zoom ]
const FRAME: Record<number, [number, number, number]> = {
  1: [50, 23, 1.7],
  2: [50, 21, 1.7],
  3: [50, 30, 1.7],
  4: [50, 17, 1.75],
  5: [50, 21, 1.7],
  6: [50, 23, 1.7],
  7: [50, 19, 1.7],
  8: [50, 29, 1.7],
  9: [50, 15, 1.8],
  10: [52, 23, 1.7],
};

export function Avatar({
  agent, size = 44, bob = true, pip = false,
}: {
  agent: Agent | null | undefined; size?: number; bob?: boolean; pip?: boolean;
}) {
  if (!agent) return null;
  const fac = agent.fac || 'var(--c-cyan)';
  const n = agent.char || 1;
  const [fx, fy, zoom] = FRAME[n] || [50, 20, 1.7];
  const src = `/assets/characters/${n}.png`;
  return (
    <span className={'av3d' + (bob ? ' bob' : '')} style={{ fontSize: size + 'px', ['--fac' as string]: fac } as CSSProperties}>
      <span className="av-aura" />
      <span className="av-token">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="av-photo" src={src} alt={agent.name} loading="lazy"
          style={{ objectPosition: `${fx}% ${fy}%`, transform: `scale(${zoom})`, transformOrigin: `${fx}% ${fy}%` }} />
        <span className="av-sheen" />
        <span className="av-glint" />
      </span>
      {pip && agent.status && <span className={'av-pip ' + agent.status} />}
    </span>
  );
}
