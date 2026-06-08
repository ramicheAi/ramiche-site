'use client';

/* ============================================================================
 * PARALLAX OS — AGENTS (collectible roster). Screen #4.
 * A grid of 20 collectible character cards from the AGENTS fleet (@/lib/po-data).
 * Each card: a real Galactik Antics render in a holographic "bay" (pedestal glow
 * + faction emblem), rarity ribbon, status, nameplate. Click flips the card to a
 * dossier back (level + Power/Speed/Intel/Sync stat bars derived deterministically
 * per agent, a lore line, and "Open direct line" → /command-center/comms).
 *
 * Ported from prototype/po-pages.jsx (AgentsPage / AgentCard). CSS classes
 * (.coll-card / .coll-flip / .ag-grid / .cb-stat …) already live in po-pages.css.
 * Char renders served from /assets/characters/N.png; faction color = agent.fac.
 * Live idle motion (status pip shimmer) gates on prefers-reduced-motion AND the
 * .po-still tweak (handled by the ported CSS). poPlay on flip/nav.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon, Sigil } from '@/components/command-center/po/Brand';
import { Avatar } from '@/components/command-center/po/Avatar';
import { AGENTS, PAGE, type Agent } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';
import { poPlay } from '@/lib/po-sound';

/* ── deterministic per-page serial code (matches the prototype `Head`) ─────── */
function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1;
  const b = ((h >> 4) % 900) + 100;
  const c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

/* ── deterministic collectible stats + flavor (FNV-1a hash of the agent id) ── */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Stats = { level: number; power: number; speed: number; intel: number; sync: number };
function statsFor(a: Agent): Stats {
  const h = hash(a.id);
  const r = (shift: number, lo: number, hi: number) => lo + (((h >> shift) & 0xff) % (hi - lo + 1));
  return {
    level: a.lead ? 99 : 40 + ((h >> 3) & 0x3f),
    power: a.lead ? 96 : r(2, 58, 95),
    speed: r(6, 55, 97),
    intel: r(10, 60, 98),
    sync: a.status === 'active' ? r(14, 82, 99) : a.status === 'busy' ? r(14, 70, 90) : r(14, 40, 66),
  };
}

/* ── per-agent dossier lore (falls back to the agent's live task) ──────────── */
const LORE: Record<string, string> = {
  atlas: 'Coordinates all twenty operatives. Never sleeps, never blinks.',
  shuri: "Turns napkin sketches into shipped apps before the coffee's cold.",
  vee: "Reads the room, then rewrites it. The fleet's voice.",
  triage: 'First on the scene when something breaks. Calm under fire.',
  proximon: 'Scouts the void for the next hot lead. Always three jumps ahead.',
  ledger: 'Every credit accounted for. The numbers never lie to Ledger.',
  sentry: 'Holds the perimeter. Nothing gets through unscanned.',
  oracle: 'Sees the pattern before it forms. Forecasts in real time.',
  scribe: 'Chronicles everything. If it happened, Scribe wrote it down.',
  nexus: 'Bridges every system. The connective tissue of the fleet.',
  cadence: 'Sets the tempo. Mixes signal from noise.',
  horizon: 'Watches the far edge of the market. Tracks every faint signal.',
  closer: 'Never leaves a deal on the table. Seals it, every time.',
  counsel: "Reads the fine print so you don't have to. Airtight.",
  curator: 'Keeps the collection pristine. An eye for the rare.',
  pulse: "Feels the system's heartbeat. Flags the flutter before the fault.",
  warden: 'Guards the fleet wellbeing. Recovery is a discipline.',
  mason: 'Builds the hardware the others run on. Forged, not printed.',
  archive: 'Remembers all nine thousand notes. Forgets nothing.',
  vector: 'Plots the long game. Every move three steps deep.',
};

/* rarity derived deterministically from lead/status */
type Rarity = 'Mythic' | 'Rare' | 'Epic' | 'Common';
function rarityFor(a: Agent): Rarity {
  if (a.lead) return 'Mythic';
  if (a.status === 'active') return 'Rare';
  if (a.status === 'busy') return 'Epic';
  return 'Common';
}

/* per-character vertical framing for the bay render (head sits in the bay) */
const CARD_Y: Record<number, number> = { 1: 8, 2: 6, 3: 16, 4: 4, 5: 7, 6: 9, 7: 5, 8: 15, 9: 3, 10: 9 };

/* ── instrument header (ported from the prototype `Head`) ──────────────────── */
function Head({ actions }: { actions?: ReactNode }) {
  const p = PAGE.agents;
  return (
    <div className="pg-head instrument-head">
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <span className="pg-head-ic">
        <Icon name={p.icon} size={24} />
        <span className="pg-ic-ring" />
      </span>
      <div className="pg-head-body">
        <div className="pg-head-meta mono">
          <span className="pg-sec">{p.section}</span>
          <span className="pg-sep" />
          <span className="pg-serial">SYS·{serialFor('agents')}</span>
          <span className="pg-sep" />
          <span className="pg-live">
            <i />
            ONLINE
          </span>
        </div>
        <h1 className="pg-h1 echo" data-echo={p.label}>
          {p.label}
        </h1>
        <div className="pg-ruler" aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => (
            <i key={i} className={i % 5 === 0 ? 'maj' : ''} />
          ))}
        </div>
      </div>
      {actions && <div className="pg-head-act">{actions}</div>}
    </div>
  );
}

/* ── one collectible card (flips between front render bay and dossier back) ── */
function AgentCard({ a, onOpenLine }: { a: Agent; onOpenLine: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const charSrc = `/assets/characters/${a.char || 1}.png`;
  const cardY = CARD_Y[a.char || 1] ?? 9;
  const s = statsFor(a);
  const bars: [string, number][] = [
    ['POWER', s.power],
    ['SPEED', s.speed],
    ['INTEL', s.intel],
    ['SYNC', s.sync],
  ];
  const rarity = rarityFor(a);

  const flip = () => {
    setFlipped((v) => !v);
    poPlay('blip');
  };

  return (
    <div
      className={'coll-card' + (flipped ? ' flipped' : '')}
      style={{ ['--fac' as string]: a.fac } as CSSProperties}
      onClick={flip}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${a.name} — ${a.role}. ${flipped ? 'Showing dossier' : 'Tap to flip dossier'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      }}
    >
      <div className="coll-flip">
        {/* FRONT — holographic render bay */}
        <div className="coll-face coll-front holo-edge">
          <div className="coll-portrait">
            <div className="coll-platform" />
            <div className="coll-grid-fx" />
            <span className="coll-emblem">
              <Sigil name={a.sigil} size={120} stroke={1} />
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="coll-img"
              src={charSrc}
              alt={`${a.name} — Galactik Antics collectible`}
              loading="lazy"
              style={{ objectPosition: `50% ${cardY}%` }}
            />
            <span className="coll-rarity">{rarity}</span>
            <span className={'coll-status ' + a.status}>
              <i />
              {a.status}
            </span>
            <span className="coll-fliphint">
              <Icon name="spark" size={11} /> stats
            </span>
          </div>
          <div className="coll-plate">
            <div className="coll-name">
              {a.name}
              {a.lead && <span className="ag-lead-badge">LEAD</span>}
            </div>
            <div className="coll-role">{a.role}</div>
            <div className="coll-meta">
              <span className="coll-faction">{a.fac.replace('var(--c-', '').replace(')', '')}</span>
              <span className="coll-task">{a.task}</span>
            </div>
          </div>
        </div>
        {/* BACK — dossier */}
        <div className="coll-face coll-back holo-edge holo-foil">
          <div className="cb-head">
            <Avatar agent={a} size={44} bob={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="coll-name" style={{ fontSize: 16 }}>
                {a.name}
              </div>
              <div className="coll-role">{a.role}</div>
            </div>
            <div className="cb-level">
              <span className="cb-lvl-lab">LVL</span>
              <span className="cb-lvl-num tnum">{s.level}</span>
            </div>
          </div>
          <div className="cb-stats">
            {bars.map(([lab, v]) => (
              <div key={lab} className="cb-stat">
                <span className="cb-stat-lab">{lab}</span>
                <span className="cb-bar">
                  <span style={{ width: v + '%' }} />
                </span>
                <span className="cb-stat-num tnum">{v}</span>
              </div>
            ))}
          </div>
          <div className="cb-lore">
            <span className="eyebrow" style={{ color: 'var(--fac)' }}>
              Dossier
            </span>
            <p>{LORE[a.id] || a.task}</p>
          </div>
          <button
            className="cb-open"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLine();
            }}
          >
            <Icon name="comms" size={15} /> Open direct line
          </button>
        </div>
      </div>
    </div>
  );
}

type Filter = 'all' | 'online' | 'idle';

export default function AgentsRoster() {
  const router = useRouter();
  // touch the theme context so the screen stays in sync with the cockpit shell
  // (still/reduced-motion gating is handled by the ported CSS via .po-still).
  usePoTheme();

  const [filter, setFilter] = useState<Filter>('all');
  const bootedRef = useRef(false);

  // a quiet "open" cue when the roster first mounts (autoplay-safe; no-op if muted)
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    poPlay('open');
  }, []);

  const shown = AGENTS.filter((a) =>
    filter === 'all' ? true : filter === 'online' ? a.status !== 'idle' : a.status === 'idle',
  );

  const onlineCount = AGENTS.filter((a) => a.status !== 'idle').length;
  const idleCount = AGENTS.filter((a) => a.status === 'idle').length;

  const tabs: [Filter, string][] = [
    ['all', `All · ${AGENTS.length}`],
    ['online', `Online · ${onlineCount}`],
    ['idle', `Idle · ${idleCount}`],
  ];

  const openLine = () => {
    poPlay('nav');
    router.push('/command-center/comms');
  };

  return (
    <div className="pg po-scroll" style={{ ['--accent' as string]: 'var(--c-green)' } as CSSProperties}>
      <div className="pg-inner">
        <Head
          actions={
            <Link
              href="/command-center/agents/manage"
              className="pg-btn"
              onClick={() => poPlay('nav')}
            >
              <Icon name="settings" size={15} /> Agent console
            </Link>
          }
        />
        <p className="pg-sub" style={{ marginTop: -16, marginBottom: 22 }}>
          Your Galactik Antics roster — twenty operatives, each matched to its character. Tap a card to flip its dossier.
        </p>
        <div className="ag-filter">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              className={'cm-tab' + (filter === k ? ' on' : '')}
              style={{ flex: '0 0 auto', padding: '0 16px', height: 30, ['--accent' as string]: 'var(--c-green)' } as CSSProperties}
              onClick={() => {
                setFilter(k);
                poPlay('nav');
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="ag-grid">
          {shown.map((a) => (
            <AgentCard key={a.id} a={a} onOpenLine={openLine} />
          ))}
        </div>
      </div>
    </div>
  );
}
