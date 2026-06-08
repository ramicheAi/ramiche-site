'use client';

/* ============================================================================
 * PARALLAX OS — reusable instrument chrome. Wrap any existing Command Center
 * page in these to give it the cockpit look WITHOUT touching its logic:
 *
 *   <InstrumentPage id="tasks" title="Tasks" section="Operations" icon="tasks"
 *                   accent="var(--c-amber)" live actions={<Btn/>}>
 *     <Panel title="Backlog">…existing content, restyled…</Panel>
 *   </InstrumentPage>
 *
 * Classes come from the ported po-pages.css (.pg / .pg-head / .inst-cnr /
 * .po-panel / .cv-sec-head …). Everything renders inside .po-shell already.
 * ========================================================================== */

import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/components/command-center/po/Brand';

/** deterministic serial code per page id (matches the prototype's serialFor) */
export function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1, b = ((h >> 4) % 900) + 100, c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

/** the four L-shaped accent corner brackets */
export function Corners() {
  return (
    <>
      <span className="inst-cnr tl" /><span className="inst-cnr tr" />
      <span className="inst-cnr bl" /><span className="inst-cnr br" />
    </>
  );
}

/** compact 270° ring gauge for instrument tiles */
export function RingGauge({ v, size = 44, crit }: { v: number; size?: number; crit?: boolean }) {
  const R = 22, C = 2 * Math.PI * R, span = 0.75;
  const fill = C * span * Math.max(0, Math.min(1, v));
  const col = crit ? 'var(--c-red)' : 'var(--accent)';
  return (
    <svg className="inst-ring" width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <g transform="rotate(135 28 28)">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line-2)" strokeWidth="3" strokeDasharray={`${C * span} ${C}`} opacity="0.3" />
        <circle className="inst-ring-fill" cx="28" cy="28" r={R} fill="none" stroke={col} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fill} ${C}`} />
      </g>
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (135 + (i / 6) * 270) * (Math.PI / 180);
        return <line key={i} x1={28 + Math.cos(a) * 26} y1={28 + Math.sin(a) * 26} x2={28 + Math.cos(a) * 28} y2={28 + Math.sin(a) * 28} stroke={col} strokeWidth="1" opacity="0.4" />;
      })}
      <circle cx="28" cy="28" r="2.5" fill={col} />
    </svg>
  );
}

/** instrument header: eyebrow meta (section · serial · ONLINE), echo title, tick ruler, icon ring */
export function InstHeader({
  id, title, section = 'Command', icon = 'dashboard', live = true, actions,
}: {
  id: string; title: string; section?: string; icon?: string; live?: boolean; actions?: ReactNode;
}) {
  return (
    <div className="pg-head instrument-head">
      <Corners />
      <span className="pg-head-ic">
        <Icon name={icon} size={24} />
        <span className="pg-ic-ring" />
      </span>
      <div className="pg-head-body">
        <div className="pg-head-meta mono">
          <span className="pg-sec">{section}</span>
          <span className="pg-sep" />
          <span className="pg-serial">SYS·{serialFor(id)}</span>
          {live && <><span className="pg-sep" /><span className="pg-live"><i />ONLINE</span></>}
        </div>
        <h1 className="pg-h1 echo" data-echo={title}>{title}</h1>
        <div className="pg-ruler" aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => <i key={i} className={i % 5 === 0 ? 'maj' : ''} />)}
        </div>
      </div>
      {actions && <div className="pg-head-act">{actions}</div>}
    </div>
  );
}

/** full page wrapper: scroll container + accent + instrument header + inner content */
export function InstrumentPage({
  id, title, section, icon, accent, live = true, actions, children, style,
}: {
  id: string; title: string; section?: string; icon?: string; accent?: string;
  live?: boolean; actions?: ReactNode; children: ReactNode; style?: CSSProperties;
}) {
  const s = { ...(accent ? { ['--accent' as string]: accent } : {}), ...style } as CSSProperties;
  return (
    <div className="pg po-scroll" style={s}>
      <div className="pg-inner">
        <InstHeader id={id} title={title} section={section} icon={icon} live={live} actions={actions} />
        {children}
      </div>
    </div>
  );
}

/** a framed panel with corner brackets and an optional section head */
export function Panel({
  title, icon, badge, holo, corners = true, children, className, style,
}: {
  title?: string; icon?: string; badge?: ReactNode; holo?: boolean; corners?: boolean;
  children: ReactNode; className?: string; style?: CSSProperties;
}) {
  return (
    <section className={`po-panel${holo ? ' holo-foil' : ''}${className ? ' ' + className : ''}`} style={style}>
      {corners && <Corners />}
      {title && (
        <div className="cv-sec-head">
          {icon && <Icon name={icon} size={16} style={{ color: 'var(--accent)' }} />}
          <h3>{title}</h3>
          {badge != null && <span className="po-pal-grp">{badge}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** a primary action button styled for the instrument header */
export function PgBtn({
  children, onClick, icon, type = 'button',
}: { children: ReactNode; onClick?: () => void; icon?: string; type?: 'button' | 'submit' }) {
  return (
    <button className="pg-btn" type={type} onClick={onClick}>
      {icon && <Icon name={icon} size={15} />} {children}
    </button>
  );
}
