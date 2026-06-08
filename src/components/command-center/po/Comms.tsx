'use client';

/* ============================================================================
 * PARALLAX OS — COMMS (access all chats)
 * Conversation list (channels + agent DMs) | active conversation with streaming
 * agent replies, inline Job + Data cards, composer (attach / voice / Run-as-Job),
 * suggested-action chips, and a Transmissions Console view.
 *
 * Ported from prototype/po-chat.jsx + po-console.jsx (CSS already at
 * src/app/command-center/po/po-chat.css / po-console.css). REAL DATA: the live
 * bidirectional message bus (/api/command-center/ws + /api/command-center/agents)
 * is preserved and threaded into the ATLAS direct line — sending there hits the
 * real POST endpoint; the other conversations use the design's mock streaming.
 * ========================================================================== */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { Icon } from '@/components/command-center/po/Brand';
import { Avatar } from '@/components/command-center/po/Avatar';
import {
  agentById,
  CHANNELS,
  DMS,
  LEADS,
  A,
  type Agent,
  type Channel as ChannelT,
  type Lead,
} from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';
import { poPlay } from '@/lib/po-sound';

/* ── helpers ──────────────────────────────────────────────────────────────── */

let UID = 500;

const titleFrom = (t: string): string => {
  const s = t.trim().replace(/^(can you|please|hey|atlas,?)\s+/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1, 60);
};

const JOB_STEPS: Record<string, string[]> = {
  default: ['Acknowledge intent', 'Allocate compute', 'Execute', 'Report back'],
  build: ['Pull latest from main', 'Compile templates', 'Run checks + smoke tests', 'Deploy to edge'],
};

/* ── card + message types ─────────────────────────────────────────────────── */

type DataCardKind = 'leads' | 'mrr';
type JobCardData = {
  type: 'job';
  agentId: string;
  title: string;
  steps: string[];
  jobId: number;
  step: number;
  prog: number;
  done: boolean;
};
type DataCardData = { type: 'data'; kind: DataCardKind };
type CardData = JobCardData | DataCardData | null;

type Msg = {
  id: number;
  who: string; // agent id | "user" | "atlas"
  name: string;
  fac: string;
  sigil?: string;
  full: string;
  shown: number; // 999 = fully shown
  streaming: boolean;
  card: CardData;
  real?: boolean; // sourced from the live bus
};

type ConvBase = { id: string; name: string; fac: string; unread: number; last: string; t: string };
type ChannelConv = ConvBase & { kind: 'channel'; members: number };
type DmConv = ConvBase & { kind: 'dm'; agentId: string; sub: string; status: Agent['status']; sigil: string };
type Conv = ChannelConv | DmConv;

const REAL_DM_ID = 'dm-atlas'; // the ATLAS direct line is backed by the real bus

/* ── conversation list ────────────────────────────────────────────────────── */

function buildConvs(): { ch: ChannelConv[]; dm: DmConv[] } {
  const ch: ChannelConv[] = CHANNELS.map((c: ChannelT) => ({
    id: c.id,
    name: c.name,
    fac: c.accent,
    unread: c.unread,
    last: c.last,
    t: c.t,
    members: c.members,
    kind: 'channel',
  }));
  const dm: DmConv[] = DMS.map((d) => {
    const a = agentById(d.agentId);
    return {
      id: d.id,
      kind: 'dm',
      agentId: d.agentId,
      name: a?.name ?? d.agentId.toUpperCase(),
      sub: a?.role ?? '',
      fac: a?.fac ?? A.cyan,
      status: a?.status ?? 'idle',
      sigil: a?.sigil ?? 'agents',
      unread: d.unread,
      last: d.last,
      t: d.t,
    };
  });
  return { ch, dm };
}

/* ── seeded conversations (mock; the ATLAS DM is hydrated from the live bus) ── */

function seed(): Record<string, Msg[]> {
  const g = A.gold;
  const grn = A.green;
  const pnk = A.pink;
  const org = A.orange;
  return {
    [REAL_DM_ID]: [
      {
        id: 1, who: 'atlas', name: 'ATLAS', fac: g, sigil: 'atlas', shown: 999, streaming: false, card: null,
        full:
          "Morning. While you slept — SHURI shipped template v2, PROXIMON scored 412 leads (18 hot), TRIAGE healed a retry storm at 03:14. Everything's green. What do you want to move first?",
      },
    ],
    general: [
      {
        id: 2, who: 'atlas', name: 'ATLAS', fac: g, sigil: 'atlas', shown: 999, streaming: false, card: null,
        full: 'Standup posted. 7 jobs in motion, all SLAs green. Highlight: landing page is live.',
      },
      {
        id: 3, who: 'shuri', name: 'SHURI', fac: grn, sigil: 'builder', shown: 999, streaming: false, card: null,
        full: 'Shipped the v2 compiler — build times down <b>40%</b>. Watching heap on big graphs.',
      },
      {
        id: 4, who: 'vee', name: 'VEE', fac: pnk, sigil: 'content', shown: 999, streaming: false, card: null,
        full: 'Launch copy is drafted for the Helios push. Need a sign-off before I schedule.',
      },
    ],
    'dm-proximon': [
      {
        id: 5, who: 'proximon', name: 'PROXIMON', fac: org, sigil: 'sales', shown: 999, streaming: false,
        card: { type: 'data', kind: 'leads' },
        full: '412 leads scored overnight. 18 hot. Top four below — want me to draft outreach to the hot three?',
      },
    ],
  };
}

/* ── reply engine (mock conversations) ────────────────────────────────────── */

function jobCard(agentId: string, title: string, kind: string): JobCardData {
  return {
    type: 'job',
    agentId,
    title,
    steps: JOB_STEPS[kind] || JOB_STEPS.default,
    jobId: 1800 + Math.floor(Math.random() * 200),
    step: -1,
    prog: 0,
    done: false,
  };
}

function engine(
  text: string,
  conv: Conv,
  runJob: boolean,
): { who: string; name: string; fac: string; sigil?: string; text: string; card: CardData } {
  const t = text.toLowerCase();
  const responderId = conv.kind === 'dm' ? conv.agentId : 'atlas';
  const a = agentById(responderId);
  const name = a?.name ?? responderId.toUpperCase();
  const fac = a?.fac ?? A.gold;
  const sigil = a?.sigil ?? 'atlas';
  const mk = (msg: string, card: CardData = null) => ({ who: responderId, name, fac, sigil, text: msg, card });

  if (runJob) {
    const ag = /lead|prospect|outreach/.test(t) ? 'proximon' : /doc|write|copy|note/.test(t) ? 'vee' : 'shuri';
    return mk(
      `Dispatching to ${agentById(ag)?.name ?? ag.toUpperCase()} as a job — tracking it live below.`,
      jobCard(ag, titleFrom(text), 'build'),
    );
  }
  if (/build|ship|deploy|compile|landing|page|site|launch|app/.test(t))
    return mk(
      "On it — routing to SHURI. Spinning up the build now; I'll track every step right here.",
      jobCard('shuri', titleFrom(text), 'build'),
    );
  if (/lead|prospect|hot|outreach|pipeline|customer|deal/.test(t))
    return mk('PROXIMON surfaced today’s hottest leads — top four below. Want outreach drafts for the hot three?', {
      type: 'data',
      kind: 'leads',
    });
  if (/mrr|revenue|arr|churn|grew|moved|money|sales|why|growth/.test(t))
    return mk(
      'MRR is $48.2k, up 6% week-over-week — two annual upgrades drove most of it, churn held flat. Breakdown below.',
      { type: 'data', kind: 'mrr' },
    );
  if (/status|health|gateway|nominal|alert|ok|safe|down|broke/.test(t))
    return mk(
      "All systems nominal. Gateway's healthy — one retry storm at 03:14 auto-healed. Nothing needs you right now.",
      null,
    );
  return mk(
    'Got it. I can dispatch that to the fleet, surface data, or hand it to a specialist — say the word and I’ll run it as a job.',
    null,
  );
}

const CHIPS: { t: string; icon: string }[] = [
  { t: 'Ship the new landing page', icon: 'bolt' },
  { t: "Show today's hot leads", icon: 'pulse' },
  { t: 'Why did MRR move?', icon: 'spark' },
  { t: 'Are we all green?', icon: 'gateway' },
];

/* ── live message bus (real backend, preserved) ──────────────────────────────
   Threaded into the ATLAS direct line. Shape mirrors the prior comms page. */
type BusMessage = {
  id: string;
  from: string;
  to: string;
  type: 'command' | 'query' | 'response' | 'broadcast';
  payload: string;
  timestamp: number;
};

function busToMsg(b: BusMessage): Msg {
  const isOwn = b.from === 'ramon';
  if (isOwn) {
    return {
      id: hashId(b.id), who: 'user', name: 'RAMON', fac: A.violet,
      full: b.payload, shown: 999, streaming: false, card: null, real: true,
    };
  }
  const a = agentById(b.from);
  return {
    id: hashId(b.id),
    who: a ? a.id : 'atlas',
    name: a?.name ?? b.from.toUpperCase(),
    fac: a?.fac ?? A.gold,
    sigil: a?.sigil ?? 'atlas',
    full: b.payload, shown: 999, streaming: false, card: null, real: true,
  };
}

// stable numeric id from the bus's string id (kept distinct from mock UIDs)
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 1_000_000 + (h >>> 0) % 8_000_000;
}

/* ════════════════════════════════════════════════════════════════════════════
   COMMS VIEW
   ══════════════════════════════════════════════════════════════════════════ */

export default function Comms() {
  const { still } = usePoTheme();
  const reduced = still;

  const convsRef = useRef(buildConvs());
  const convs = convsRef.current;

  const [activeId, setActiveId] = useState<string>(REAL_DM_ID);
  const [tab, setTab] = useState<'all' | 'channels' | 'direct'>('all');
  const [search, setSearch] = useState('');
  const [store, setStore] = useState<Record<string, Msg[]>>(seed);
  const [unread, setUnread] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    [...convs.ch, ...convs.dm].forEach((c) => (u[c.id] = c.unread || 0));
    return u;
  });
  const [input, setInput] = useState('');
  const [view, setView] = useState<'thread' | 'console'>('thread');
  const [runJob, setRunJob] = useState(false);
  const [mic, setMic] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const lastTs = useRef(0);
  const seenBusIds = useRef<Set<string>>(new Set());

  // clear all timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearInterval(x));
  }, []);

  // auto-scroll thread to bottom on new content
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const active = [...convs.ch, ...convs.dm].find((c) => c.id === activeId) as Conv;
  const msgs = store[activeId] || [];

  const open = useCallback((id: string) => {
    setActiveId(id);
    setUnread((u) => ({ ...u, [id]: 0 }));
    poPlay('blip');
  }, []);

  const patch = useCallback(
    (cid: string, mid: number, fn: (m: Msg) => Msg) =>
      setStore((s) => ({ ...s, [cid]: (s[cid] || []).map((m) => (m.id === mid ? fn(m) : m)) })),
    [],
  );

  /* ── live bus: poll real incoming messages into the ATLAS direct line ──── */
  const mergeBus = useCallback((incoming: BusMessage[]) => {
    const fresh = incoming.filter((m) => !seenBusIds.current.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seenBusIds.current.add(m.id));
    const newest = Math.max(lastTs.current, ...fresh.map((m) => m.timestamp));
    lastTs.current = newest;
    const mapped = fresh.map(busToMsg);
    setStore((s) => ({ ...s, [REAL_DM_ID]: [...(s[REAL_DM_ID] || []), ...mapped] }));
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/command-center/ws?recipient=ramon&since=${lastTs.current}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data.messages?.length > 0) mergeBus(data.messages as BusMessage[]);
      } catch {
        /* retry next cycle */
      }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [mergeBus]);

  /* ── job progress animation ─────────────────────────────────────────────── */
  const runJobProgress = useCallback(
    (cid: string, mid: number) => {
      patch(cid, mid, (m) =>
        m.card && m.card.type === 'job' ? { ...m, card: { ...m.card, step: 0, prog: 6 } } : m,
      );
      let i = 0;
      const tick = setInterval(() => {
        i++;
        patch(cid, mid, (m) => {
          if (!m.card || m.card.type !== 'job') return m;
          const n = m.card.steps.length;
          const prog = Math.min(100, Math.round((i / n) * 100));
          const done = i >= n;
          if (done) {
            clearInterval(tick);
            poPlay('success');
          }
          return { ...m, card: { ...m.card, step: Math.min(i, n - 1), prog, done } };
        });
      }, reduced ? 50 : 950);
      timers.current.push(tick);
    },
    [patch, reduced],
  );

  /* ── typewriter streaming ───────────────────────────────────────────────── */
  const stream = useCallback(
    (cid: string, mid: number, full: string, card: CardData) => {
      if (reduced) {
        patch(cid, mid, (m) => ({ ...m, shown: 999, streaming: false, card }));
        if (card && card.type === 'job') runJobProgress(cid, mid);
        return;
      }
      let shown = 0;
      const iv = setInterval(() => {
        shown += 2;
        if (shown >= full.length) {
          clearInterval(iv);
          patch(cid, mid, (m) => ({ ...m, shown: 999, streaming: false, card }));
          if (card && card.type === 'job') setTimeout(() => runJobProgress(cid, mid), 350);
        } else {
          patch(cid, mid, (m) => ({ ...m, shown }));
        }
      }, 14);
      timers.current.push(iv);
    },
    [patch, reduced, runJobProgress],
  );

  /* ── send (real for ATLAS DM, mock-streamed elsewhere) ──────────────────── */
  const sendReal = useCallback(
    async (text: string) => {
      // optimistic local echo so the thread feels live
      const echo: Msg = {
        id: ++UID, who: 'user', name: 'RAMON', fac: A.violet,
        full: text, shown: 999, streaming: false, card: null,
      };
      setStore((s) => ({ ...s, [REAL_DM_ID]: [...(s[REAL_DM_ID] || []), echo] }));
      try {
        const res = await fetch('/api/command-center/ws', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'ramon', to: 'atlas', type: 'command', payload: text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            const b = data.message as BusMessage;
            seenBusIds.current.add(b.id);
            lastTs.current = Math.max(lastTs.current, b.timestamp);
          }
        }
      } catch {
        /* the next poll will reconcile */
      }
    },
    [],
  );

  const send = useCallback(
    (textArg?: string) => {
      const text = (textArg != null ? textArg : input).trim();
      if (!text || !active) return;
      poPlay('dispatch');
      setInput('');
      if (taRef.current) taRef.current.style.height = 'auto';

      // ATLAS direct line → real bus
      if (activeId === REAL_DM_ID && !runJob) {
        sendReal(text);
        return;
      }

      // every other conversation → mock streamed reply
      const cid = activeId;
      const userMsg: Msg = {
        id: ++UID, who: 'user', name: 'RAMON', fac: A.violet,
        full: text, shown: 999, streaming: false, card: null,
      };
      const reply = engine(text, active, runJob);
      const replyMsg: Msg = {
        id: ++UID, who: reply.who, name: reply.name, fac: reply.fac, sigil: reply.sigil,
        full: reply.text, shown: 0, streaming: true, card: null,
      };
      setStore((s) => ({ ...s, [cid]: [...(s[cid] || []), userMsg, replyMsg] }));
      setRunJob(false);
      const to = setTimeout(() => stream(cid, replyMsg.id, reply.text, reply.card), reduced ? 60 : 520);
      timers.current.push(to as unknown as ReturnType<typeof setInterval>);
    },
    [input, active, activeId, runJob, reduced, stream, sendReal],
  );

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    setInput(el.value);
  };

  /* ── filtered lists ─────────────────────────────────────────────────────── */
  const q = search.trim().toLowerCase();
  const showCh = tab !== 'direct';
  const showDm = tab !== 'channels';
  const fch = convs.ch.filter((c) => !q || c.name.toLowerCase().includes(q));
  const fdm = convs.dm.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <div className="cm-wrap">
      {/* CONVERSATION LIST */}
      <aside className="cm-list">
        <div className="cm-list-head">
          <span className="cm-list-title">Comms</span>
          <button className="cm-newbtn" title="New conversation" type="button">
            <Icon name="plus" size={17} />
          </button>
        </div>
        <div className="cm-search">
          <Icon name="search" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
          />
        </div>
        <div className="cm-tabs">
          {(['all', 'channels', 'direct'] as const).map((x) => (
            <button
              key={x}
              type="button"
              className={'cm-tab' + (tab === x ? ' on' : '')}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="cm-convs po-scroll">
          {showCh && fch.length > 0 && <div className="cm-grp-lbl eyebrow">Channels</div>}
          {showCh &&
            fch.map((c) => (
              <ConvRow key={c.id} c={c} on={activeId === c.id} unread={unread[c.id]} onClick={() => open(c.id)} channel />
            ))}
          {showDm && fdm.length > 0 && <div className="cm-grp-lbl eyebrow">Direct · Agents</div>}
          {showDm &&
            fdm.map((c) => (
              <ConvRow key={c.id} c={c} on={activeId === c.id} unread={unread[c.id]} onClick={() => open(c.id)} />
            ))}
        </div>
      </aside>

      {/* ACTIVE CONVERSATION */}
      <div className="cm-main">
        <header className="cm-chead" style={{ ['--fac' as string]: active.fac } as CSSProperties}>
          <span
            className="cm-chead-av"
            style={active.kind === 'channel' ? undefined : { background: 'none', border: 'none' }}
          >
            {active.kind === 'channel' ? (
              <Icon name="hash" size={18} />
            ) : (
              <Avatar agent={agentById(active.agentId)} size={38} bob={false} />
            )}
          </span>
          <div>
            <div className="cm-chead-name">{active.name}</div>
            <div className="cm-chead-sub">
              {active.kind === 'channel' ? (
                <>
                  <span>{active.members} members</span>
                  <span className="slash" style={{ color: active.fac, height: 11 }} />
                  <span>group channel</span>
                </>
              ) : (
                <>
                  <span
                    className="po-livedot"
                    style={{
                      background:
                        active.status === 'idle'
                          ? 'var(--t-dim)'
                          : active.status === 'busy'
                            ? 'var(--c-amber)'
                            : 'var(--c-green)',
                      animation: active.status === 'idle' ? 'none' : undefined,
                    }}
                  />
                  <span>
                    {active.sub} · {active.status}
                    {activeId === REAL_DM_ID && (
                      <span style={{ color: 'var(--accent)', marginLeft: 8, fontFamily: 'var(--f-mono)', fontSize: 10 }}>
                        · LIVE
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="cm-chead-acts">
            <div className="cm-viewtog">
              <button type="button" className={view === 'thread' ? 'on' : ''} onClick={() => setView('thread')}>
                Thread
              </button>
              <button type="button" className={view === 'console' ? 'on' : ''} onClick={() => setView('console')}>
                Console
              </button>
            </div>
            <button className="po-icbtn" title="Call" type="button">
              <Icon name="mic" size={16} />
            </button>
            <button className="po-icbtn" title="Pin" type="button">
              <Icon name="pin" size={16} />
            </button>
          </div>
        </header>

        {view === 'console' ? (
          <TransmissionsConsole active={active} />
        ) : (
          <>
            <div className="cm-thread po-scroll" ref={threadRef}>
              <div className="cm-thread-inner">
                <div className="cm-daystamp">Today · 23:47</div>
                {msgs.map((m) => (
                  <Message key={m.id} m={m} />
                ))}
              </div>
            </div>

            <div className="cm-chips">
              {CHIPS.map((c) => (
                <button key={c.t} type="button" className="cm-chip" onClick={() => send(c.t)}>
                  <Icon name={c.icon} size={14} />
                  {c.t}
                </button>
              ))}
            </div>

            <div className="cm-composer">
              <div className="cm-composer-inner">
                <div className="cm-box">
                  <button className="cm-tool" title="Attach" type="button">
                    <Icon name="attach" size={18} />
                  </button>
                  {mic ? (
                    <div className="cm-voice">
                      {[10, 18, 7, 15, 12, 20, 9, 16, 11, 18, 8, 14].map((h, i) => (
                        <i key={i} style={{ height: h, animationDelay: i * 0.06 + 's' }} />
                      ))}
                    </div>
                  ) : (
                    <textarea
                      ref={taRef}
                      rows={1}
                      value={input}
                      onChange={grow}
                      onKeyDown={onKey}
                      placeholder={
                        active.kind === 'channel'
                          ? `Message ${active.name}…`
                          : `Message ${active.name} — ${active.sub}…`
                      }
                    />
                  )}
                  <button
                    className={'cm-tool' + (mic ? ' on' : '')}
                    title="Voice"
                    type="button"
                    onClick={() => setMic((v) => !v)}
                  >
                    <Icon name="mic" size={18} />
                  </button>
                  <button
                    className="cm-send"
                    type="button"
                    disabled={!input.trim() && !mic}
                    onClick={() => {
                      if (mic) {
                        setMic(false);
                        send('Are we all green?');
                      } else {
                        send();
                      }
                    }}
                  >
                    <Icon name="send" size={18} />
                  </button>
                </div>
                <div className="cm-composer-row">
                  <button
                    type="button"
                    className={'cm-runjob' + (runJob ? ' on' : '')}
                    onClick={() => setRunJob((v) => !v)}
                  >
                    <span className="sw" /> Run as Job
                  </button>
                  <span className="cm-hint">↵ send · ⇧↵ newline</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── conversation row ─────────────────────────────────────────────────────── */

function ConvRow({
  c,
  on,
  unread,
  onClick,
  channel,
}: {
  c: Conv;
  on: boolean;
  unread: number;
  onClick: () => void;
  channel?: boolean;
}) {
  return (
    <div
      className={'cm-conv' + (on ? ' on' : '')}
      style={{ ['--fac' as string]: c.fac } as CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span
        className="cm-conv-av"
        style={channel ? undefined : { background: 'none', border: 'none', clipPath: 'none' }}
      >
        {channel ? <Icon name="hash" size={17} /> : <Avatar agent={agentById((c as DmConv).agentId)} size={38} bob={false} pip />}
      </span>
      <div className="cm-conv-main">
        <div className="cm-conv-top">
          <span className="cm-conv-name">{c.name}</span>
          <span className="cm-conv-t">{c.t}</span>
        </div>
        <div className="cm-conv-prev">{c.last}</div>
      </div>
      {unread > 0 && <span className="cm-unread">{unread}</span>}
    </div>
  );
}

/* ── message rendering ────────────────────────────────────────────────────── */

const BOLD_RE = /\b(ATLAS|SHURI|VEE|PROXIMON|TRIAGE|SENTRY|LEDGER|MRR|\$48\.2k|412 leads|template v2|18 hot|40%)\b/g;

function fmt(t: string): string {
  return t
    .replace(/&(?!amp;|lt;)/g, '&amp;')
    .replace(/<(?!\/?b>)/g, '&lt;')
    .replace(BOLD_RE, '<b>$1</b>');
}

function MsgAvatar({ m }: { m: Msg }) {
  if (m.who === 'user')
    return (
      <div className="cm-av" style={{ ['--fac' as string]: A.violet } as CSSProperties}>
        <span className="slash" style={{ width: 16 }} />
      </div>
    );
  const ag = agentById(m.who);
  if (ag)
    return (
      <div className="cm-av" style={{ ['--fac' as string]: m.fac, background: 'none', border: 'none' } as CSSProperties}>
        <Avatar agent={ag} size={40} bob={false} />
      </div>
    );
  return (
    <div className="cm-av" style={{ ['--fac' as string]: m.fac } as CSSProperties}>
      <Icon name={m.sigil || 'agents'} size={20} />
    </div>
  );
}

function Message({ m }: { m: Msg }) {
  const text = m.shown >= 999 ? m.full : m.full.slice(0, m.shown);
  const a = m.who !== 'user' && m.who !== 'atlas' ? agentById(m.who) : null;
  return (
    <div className={'cm-msg ' + (m.who === 'user' ? 'user' : 'agent')} style={{ ['--fac' as string]: m.fac } as CSSProperties}>
      <MsgAvatar m={m} />
      <div className="cm-body">
        <div className="cm-from">
          <span className="nm" style={{ color: m.fac }}>
            {m.name}
          </span>
          {a && <span className="cl">{a.role.toLowerCase()}</span>}
          {m.who === 'atlas' && <span className="cl">operations lead</span>}
        </div>
        <div
          className="cm-bubble"
          dangerouslySetInnerHTML={{ __html: fmt(text) + (m.streaming ? '<span class="cm-caret"></span>' : '') }}
        />
        {m.card && m.card.type === 'job' && <JobCard c={m.card} />}
        {m.card && m.card.type === 'data' && <DataCard c={m.card} />}
      </div>
    </div>
  );
}

/* ── inline Job card ──────────────────────────────────────────────────────── */

function JobCard({ c }: { c: JobCardData }) {
  const o = agentById(c.agentId);
  const name = o?.name ?? c.agentId.toUpperCase();
  const sigil = o?.sigil ?? 'agents';
  const fac = o?.fac ?? A.cyan;
  return (
    <div className="cm-job holo-edge" style={{ ['--fac' as string]: fac } as CSSProperties}>
      <div className="cm-job-head">
        <span className="cm-job-sig">
          <Icon name={sigil} size={17} />
        </span>
        <div>
          <div className="cm-job-title">{c.title}</div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--t-lo)', marginTop: 2 }}>
            dispatched to {name}
          </div>
        </div>
        <span className="cm-job-id">#{c.jobId}</span>
      </div>
      <div className="cm-job-body">
        <div className="cm-job-steps">
          {c.steps.map((s, i) => {
            const state = c.done || i < c.step ? 'done' : i === c.step ? 'active' : '';
            return (
              <div key={i} className={'cm-step ' + state}>
                <span className="dot">{c.done || i < c.step ? <Icon name="check" size={10} /> : null}</span>
                {s}
              </div>
            );
          })}
        </div>
        <div className="cm-prog">
          <span style={{ width: (c.done ? 100 : c.prog) + '%' }} />
        </div>
      </div>
      <div className="cm-job-foot">
        {c.done ? (
          <>
            <span className="po-livedot" style={{ background: 'var(--c-green)' }} />
            <span style={{ color: 'var(--c-green)' }}>Complete</span>
            <span style={{ color: 'var(--t-lo)', marginLeft: 'auto' }}>shipped · 1m 12s</span>
          </>
        ) : (
          <>
            <span className="po-livedot" style={{ background: 'var(--accent)' }} />
            <span style={{ color: 'var(--accent)' }}>Running</span>
            <span style={{ color: 'var(--t-lo)', marginLeft: 'auto' }}>live · streaming logs</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── inline Data card ─────────────────────────────────────────────────────── */

function DataCard({ c }: { c: DataCardData }) {
  if (c.kind === 'leads')
    return (
      <div className="cm-data" style={{ ['--fac' as string]: A.orange } as CSSProperties}>
        <div className="cm-data-head">
          <Icon name="sales" size={15} style={{ color: 'var(--c-orange)' }} /> Hot leads · scored 23:31
        </div>
        {LEADS.map((l: Lead) => (
          <div key={l.name} className="cm-lead">
            <span className={'cm-lead-score ' + l.tier}>{l.score}</span>
            <div style={{ flex: 1 }}>
              <div className="cm-lead-name">{l.name}</div>
              <div className="cm-lead-meta">{l.meta}</div>
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="cm-data" style={{ ['--fac' as string]: A.gold } as CSSProperties}>
      <div className="cm-data-head">
        <Icon name="finance" size={15} style={{ color: 'var(--c-gold)' }} /> MRR · trailing 7 days
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-end', gap: 18 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-.02em' }}>$48.2k</div>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--c-green)', marginTop: 3 }}>
            ▲ 6.0% w/w
          </div>
        </div>
        <svg width="200" height="56" viewBox="0 0 200 56" style={{ flex: 1 }}>
          <polyline
            points="0,44 33,40 66,42 100,30 133,26 166,18 200,8"
            fill="none"
            stroke="var(--c-gold)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="200" cy="8" r="3" fill="var(--c-gold)" />
        </svg>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRANSMISSIONS CONSOLE — channel strip + priority message tables
   Ported from prototype/po-console.jsx (CSS at po-console.css).
   ══════════════════════════════════════════════════════════════════════════ */

const PRI: Record<string, { lab: string; c: string }> = {
  flash: { lab: 'FLASH', c: 'var(--c-rose)' },
  urgent: { lab: 'URGENT', c: 'var(--c-amber)' },
  routine: { lab: 'ROUTINE', c: 'var(--c-cyan)' },
  archive: { lab: 'ARCHIVE', c: 'var(--t-lo)' },
};

type TxRow = { pri: keyof typeof PRI; sender: string; id: string; desc: string; t: string };

const INCOMING: TxRow[] = [
  { pri: 'flash', sender: 'PROXIMON', id: '014.688.4642.45', desc: '412 leads scored — 18 hot, action requested', t: '23:31' },
  { pri: 'urgent', sender: 'TRIAGE', id: '012.277.9659.44', desc: 'Retry storm 03:14 — auto-healed, log attached', t: '23:18' },
  { pri: 'routine', sender: 'LEDGER', id: '012.538.4234.45', desc: 'MRR reconciled — $48.2k, +6% w/w', t: '22:40' },
  { pri: 'routine', sender: 'SHURI', id: '012.538.2069.42', desc: 'Template compiler v2 shipped to edge', t: '22:05' },
  { pri: 'urgent', sender: 'SENTRY', id: '014.659.2445.41', desc: '3 agent certs re-signed — review queue', t: '21:50' },
  { pri: 'routine', sender: 'NEXUS', id: '006.546.4745.40', desc: 'Linear + Slack bridges online (12 total)', t: '20:32' },
  { pri: 'routine', sender: 'VEE', id: '014.678.2867.39', desc: 'Helios launch copy drafted — sign-off?', t: '19:46' },
  { pri: 'archive', sender: 'ORACLE', id: '006.345.3463.38', desc: 'Weekly signal forecast — nominal', t: '18:03' },
];
const OUTGOING: TxRow[] = [
  { pri: 'flash', sender: 'ATLAS → PROXIMON', id: '014.688.4642.45', desc: 'Draft outreach to Helios — brief the play', t: '23:33' },
  { pri: 'routine', sender: 'ATLAS → VEE', id: '014.688.4642.45', desc: 'Approve launch copy, schedule for 09:00', t: '23:34' },
  { pri: 'urgent', sender: 'ATLAS → SENTRY', id: '014.688.4642.45', desc: 'Confirm cert review before deploy window', t: '23:35' },
  { pri: 'routine', sender: 'ATLAS → LEDGER', id: '014.688.4642.45', desc: 'Lock the week — push board summary', t: '23:36' },
];

const TX_CHANNELS: [string, string, boolean][] = [
  ['F1', '#general', true],
  ['F2', '#mettle', true],
  ['F3', '#verified', false],
  ['F4', '#launch', true],
  ['F5', 'TIGHT-BEAM', true],
  ['F6', 'RELAY-A', false],
  ['F7', 'WIDE-BEAM', true],
  ['F8', 'EMERGENCY', false],
];

function TxTable({
  title,
  serial,
  rows,
  actions,
}: {
  title: string;
  serial: string;
  rows: TxRow[];
  actions: string[];
}) {
  const [sel, setSel] = useState(0);
  return (
    <section className="tx-panel">
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <div className="tx-seg-head">
        <span className="tx-seg-id">{serial}</span>
        <span className="tx-seg-title">{title}</span>
        <span className="tx-seg-count">{rows.length} REC</span>
      </div>
      <div className="tx-table">
        <div className="tx-thead">
          <span className="c-pri">PRI</span>
          <span className="c-snd">SENDER ID</span>
          <span className="c-id">COMM ID</span>
          <span className="c-desc">DESCRIPTION</span>
          <span className="c-t">TIME</span>
        </div>
        <div className="tx-rows po-scroll">
          {rows.map((r, i) => (
            <div
              key={i}
              className={'tx-row' + (sel === i ? ' on' : '')}
              onClick={() => setSel(i)}
              style={{ ['--pc' as string]: PRI[r.pri].c } as CSSProperties}
            >
              <span className="c-pri">
                <i className="tx-dot" />
              </span>
              <span className="c-snd">{r.sender}</span>
              <span className="c-id mono">{r.id}</span>
              <span className="c-desc">{r.desc}</span>
              <span className="c-t mono">{r.t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tx-actions">
        {actions.map((a) => (
          <button key={a} className="tx-act" type="button">
            {a}
          </button>
        ))}
        <span className="tx-act-status">
          CH READY <i />
        </span>
      </div>
    </section>
  );
}

function TransmissionsConsole({ active }: { active: Conv }): ReactNode {
  const detail = INCOMING[0];
  return (
    <div className="tx-console">
      <div className="tx-statusbar mono">
        <span>PARALLAX NAV-COM v4.1408</span>
        <span className="sep" />
        <span style={{ color: 'var(--c-green)' }}>SYSTEM READY</span>
        <span className="sep" />
        <span>LINK · {active && active.name ? active.name.toUpperCase() : 'ALL'}</span>
        <span style={{ marginLeft: 'auto' }}>0x150B4A : 0x0A6AFC</span>
      </div>

      <div className="tx-grid">
        {/* LEFT — channel strip + detail */}
        <div className="tx-left">
          <section className="tx-panel tx-strip">
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="tx-seg-head">
              <span className="tx-seg-id">UFCC·01A0405</span>
              <span className="tx-seg-title">CHANNELS</span>
            </div>
            <div className="tx-chgrid">
              {TX_CHANNELS.map(([f, n, on]) => (
                <button key={f} type="button" className={'tx-ch' + (on ? ' on' : '')}>
                  <span className="tx-ch-f mono">{f}</span>
                  <span className="tx-ch-n">{n}</span>
                  <span className="tx-ch-led" />
                </button>
              ))}
            </div>
            <div className="tx-scan">
              <span className="mono">SCAN</span>
              <div className="tx-scanbar">
                <i />
              </div>
            </div>
          </section>

          <section className="tx-panel tx-detail">
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="tx-detail-head mono">INCOMING TRANSMISSION</div>
            <div className="tx-detail-grid mono">
              <span className="k">PRIORITY</span>
              <span className="v" style={{ color: PRI[detail.pri].c }}>
                {PRI[detail.pri].lab}
              </span>
              <span className="k">SENDER</span>
              <span className="v">{detail.sender}</span>
              <span className="k">COMM ID</span>
              <span className="v">{detail.id}</span>
              <span className="k">RECEIVED</span>
              <span className="v">TODAY · {detail.t}</span>
            </div>
            <div className="tx-detail-body">{detail.desc}.</div>
            <div className="tx-detail-acts">
              <button className="tx-act primary" type="button">
                RESPOND
              </button>
              <button className="tx-act" type="button">
                FLAG
              </button>
              <button className="tx-act" type="button">
                ARCHIVE
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT — incoming + outgoing tables */}
        <div className="tx-right">
          <TxTable title="INCOMING MESSAGES" serial="USCM·01A0032" rows={INCOMING} actions={['FLAG', 'EDIT', 'ARCHIVE']} />
          <TxTable title="OUTGOING MESSAGES" serial="USCM·01A0032" rows={OUTGOING} actions={['RESEND', 'EDIT', 'ARCHIVE']} />
        </div>
      </div>
    </div>
  );
}
