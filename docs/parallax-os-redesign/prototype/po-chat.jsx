/* ================================================================
   PARALLAX OS — COMMS HUB. Access all chats: channels + agent DMs.
   ================================================================ */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const { Icon, Avatar } = window.PO;
  const { AGENTS, agentById, CHANNELS, DMS, LEADS } = window.PO_DATA;

  let UID = 500;
  const titleFrom = (t) => { const s = t.trim().replace(/^(can you|please|hey|atlas,?)\s+/i, ""); return s.charAt(0).toUpperCase() + s.slice(1, 60); };
  const JOB_STEPS = { default: ["Acknowledge intent", "Allocate compute", "Execute", "Report back"], build: ["Pull latest from main", "Compile templates", "Run checks + smoke tests", "Deploy to edge"] };

  // conversation list: channels + DMs
  function buildConvs() {
    const ch = CHANNELS.map((c) => ({ ...c, fac: c.accent, kind: "channel" }));
    const dm = DMS.map((d) => { const a = agentById(d.agentId); return { id: d.id, kind: "dm", agentId: d.agentId, name: a.name, sub: a.role, fac: a.fac, status: a.status, sigil: a.sigil, unread: d.unread, last: d.last, t: d.t }; });
    return { ch, dm };
  }

  // seeded conversations
  const SEED = {
    "dm-atlas": [
      { id: 1, who: "atlas", name: "ATLAS", fac: "var(--c-gold)", sigil: "atlas", full: "Morning. While you slept — SHURI shipped template v2, PROXIMON scored 412 leads (18 hot), TRIAGE healed a retry storm at 03:14. Everything's green. What do you want to move first?", shown: 999, streaming: false, card: null },
    ],
    "general": [
      { id: 2, who: "atlas", name: "ATLAS", fac: "var(--c-gold)", sigil: "atlas", full: "Standup posted. 7 jobs in motion, all SLAs green. Highlight: landing page is live.", shown: 999, streaming: false, card: null },
      { id: 3, who: "shuri", name: "SHURI", fac: "var(--c-green)", sigil: "builder", full: "Shipped the v2 compiler — build times down <b>40%</b>. Watching heap on big graphs.", shown: 999, streaming: false, card: null },
      { id: 4, who: "vee", name: "VEE", fac: "var(--c-pink)", sigil: "content", full: "Launch copy is drafted for the Helios push. Need a sign-off before I schedule.", shown: 999, streaming: false, card: null },
    ],
    "dm-proximon": [
      { id: 5, who: "proximon", name: "PROXIMON", fac: "var(--c-orange)", sigil: "sales", full: "412 leads scored overnight. 18 hot. Top four below — want me to draft outreach to the hot three?", shown: 999, streaming: false, card: { type: "data", kind: "leads" } },
    ],
  };

  function engine(text, conv, runJob) {
    const t = text.toLowerCase();
    const responderId = conv.kind === "dm" ? conv.agentId : "atlas";
    const a = agentById(responderId);
    const mk = (msg, card) => ({ who: responderId, name: a.name, fac: a.fac, sigil: a.sigil, text: msg, card: card || null });
    const jobCard = (agentId, title, kind) => ({ type: "job", agentId, title, steps: JOB_STEPS[kind] || JOB_STEPS.default, jobId: 1800 + Math.floor(Math.random() * 200), step: -1, prog: 0, done: false });

    if (runJob) {
      const ag = /lead|prospect|outreach/.test(t) ? "proximon" : /doc|write|copy|note/.test(t) ? "vee" : "shuri";
      return mk(`Dispatching to ${agentById(ag).name} as a job — tracking it live below.`, jobCard(ag, titleFrom(text), "build"));
    }
    if (/build|ship|deploy|compile|landing|page|site|launch|app/.test(t)) return mk("On it — routing to SHURI. Spinning up the build now; I'll track every step right here.", jobCard("shuri", titleFrom(text), "build"));
    if (/lead|prospect|hot|outreach|pipeline|customer|deal/.test(t)) return mk("PROXIMON surfaced today's hottest leads — top four below. Want outreach drafts for the hot three?", { type: "data", kind: "leads" });
    if (/mrr|revenue|arr|churn|grew|moved|money|sales|why|growth/.test(t)) return mk("MRR is $48.2k, up 6% week-over-week — two annual upgrades drove most of it, churn held flat. Breakdown below.", { type: "data", kind: "mrr" });
    if (/status|health|gateway|nominal|alert|ok|safe|down|broke/.test(t)) return mk("All systems nominal. Gateway's healthy — one retry storm at 03:14 auto-healed. Nothing needs you right now.", null);
    return mk("Got it. I can dispatch that to the fleet, surface data, or hand it to a specialist — say the word and I'll run it as a job.", null);
  }

  const CHIPS = [
    { t: "Ship the new landing page", icon: "bolt" },
    { t: "Show today's hot leads", icon: "pulse" },
    { t: "Why did MRR move?", icon: "spark" },
    { t: "Are we all green?", icon: "gateway" },
  ];

  function CommsView({ reduced, setToast }) {
    const convs = useRef(buildConvs()).current;
    const [activeId, setActiveId] = useState("dm-atlas");
    const [tab, setTab] = useState("all");
    const [search, setSearch] = useState("");
    const [store, setStore] = useState(SEED);
    const [unread, setUnread] = useState(() => { const u = {}; [...convs.ch, ...convs.dm].forEach((c) => (u[c.id] = c.unread || 0)); return u; });
    const [input, setInput] = useState("");
    const [view, setView] = useState("thread");
    const [runJob, setRunJob] = useState(false);
    const [mic, setMic] = useState(false);
    const threadRef = useRef(null);
    const taRef = useRef(null);
    const timers = useRef([]);
    useEffect(() => () => timers.current.forEach(clearInterval), []);
    useEffect(() => { const el = threadRef.current; if (el) el.scrollTop = el.scrollHeight; });

    const active = [...convs.ch, ...convs.dm].find((c) => c.id === activeId);
    const msgs = store[activeId] || [];

    const open = (id) => { setActiveId(id); setUnread((u) => ({ ...u, [id]: 0 })); };

    const patch = useCallback((cid, mid, fn) => setStore((s) => ({ ...s, [cid]: (s[cid] || []).map((m) => (m.id === mid ? fn(m) : m)) })), []);

    const runJobProgress = useCallback((cid, mid) => {
      patch(cid, mid, (m) => ({ ...m, card: { ...m.card, step: 0, prog: 6 } }));
      let i = 0;
      const tick = setInterval(() => {
        i++;
        patch(cid, mid, (m) => {
          if (!m.card) return m;
          const n = m.card.steps.length; const prog = Math.min(100, Math.round((i / n) * 100)); const done = i >= n;
          if (done) { clearInterval(tick); setToast && setToast({ text: `Job #${m.card.jobId} complete`, sub: m.card.title, kind: "done" }); }
          return { ...m, card: { ...m.card, step: Math.min(i, n - 1), prog, done } };
        });
      }, reduced ? 50 : 950);
      timers.current.push(tick);
    }, [patch, setToast, reduced]);

    const stream = useCallback((cid, mid, full, card) => {
      if (reduced) { patch(cid, mid, (m) => ({ ...m, shown: 999, streaming: false, card })); if (card && card.type === "job") runJobProgress(cid, mid); return; }
      let shown = 0;
      const iv = setInterval(() => {
        shown += 2;
        if (shown >= full.length) { clearInterval(iv); patch(cid, mid, (m) => ({ ...m, shown: 999, streaming: false, card })); if (card && card.type === "job") setTimeout(() => runJobProgress(cid, mid), 350); }
        else patch(cid, mid, (m) => ({ ...m, shown }));
      }, 14);
      timers.current.push(iv);
    }, [patch, reduced, runJobProgress]);

    const send = useCallback((textArg) => {
      const text = (textArg != null ? textArg : input).trim();
      if (!text || !active) return;
      const cid = activeId;
      const userMsg = { id: ++UID, who: "user", name: "RAMON", fac: "var(--c-purple-l)", full: text, shown: 999, streaming: false, card: null };
      const reply = engine(text, active, runJob);
      const replyMsg = { id: ++UID, who: reply.who, name: reply.name, fac: reply.fac, sigil: reply.sigil, full: reply.text, shown: 0, streaming: true, card: null };
      setStore((s) => ({ ...s, [cid]: [...(s[cid] || []), userMsg, replyMsg] }));
      setInput(""); if (taRef.current) taRef.current.style.height = "auto"; setRunJob(false);
      const to = setTimeout(() => stream(cid, replyMsg.id, reply.text, reply.card), reduced ? 60 : 520);
      timers.current.push(to);
    }, [input, active, activeId, runJob, reduced, stream]);

    const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
    const grow = (e) => { const el = e.target; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; setInput(el.value); };

    const q = search.trim().toLowerCase();
    const showCh = tab !== "direct";
    const showDm = tab !== "channels";
    const fch = convs.ch.filter((c) => !q || c.name.toLowerCase().includes(q));
    const fdm = convs.dm.filter((c) => !q || c.name.toLowerCase().includes(q));

    return (
      <div className="cm-wrap">
        {/* CONVERSATION LIST */}
        <aside className="cm-list">
          <div className="cm-list-head">
            <span className="cm-list-title">Comms</span>
            <button className="cm-newbtn" title="New conversation"><Icon name="plus" size={17} /></button>
          </div>
          <div className="cm-search"><Icon name="search" size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" /></div>
          <div className="cm-tabs">
            {["all", "channels", "direct"].map((x) => <button key={x} className={"cm-tab" + (tab === x ? " on" : "")} onClick={() => setTab(x)}>{x}</button>)}
          </div>
          <div className="cm-convs po-scroll">
            {showCh && fch.length > 0 && <div className="cm-grp-lbl eyebrow">Channels</div>}
            {showCh && fch.map((c) => <ConvRow key={c.id} c={c} on={activeId === c.id} unread={unread[c.id]} onClick={() => open(c.id)} channel />)}
            {showDm && fdm.length > 0 && <div className="cm-grp-lbl eyebrow">Direct · Agents</div>}
            {showDm && fdm.map((c) => <ConvRow key={c.id} c={c} on={activeId === c.id} unread={unread[c.id]} onClick={() => open(c.id)} />)}
          </div>
        </aside>

        {/* ACTIVE CONVERSATION */}
        <div className="cm-main">
          <header className="cm-chead" style={{ "--fac": active.fac }}>
            <span className="cm-chead-av" style={active.kind === "channel" ? null : { background: "none", border: "none" }}>{active.kind === "channel" ? <Icon name="hash" size={18} /> : <Avatar agent={agentById(active.agentId)} size={38} bob={false} />}</span>
            <div>
              <div className="cm-chead-name">{active.name}</div>
              <div className="cm-chead-sub">
                {active.kind === "channel"
                  ? <><span>{active.members} members</span><span className="slash" style={{ color: active.fac, height: 11 }} /><span>group channel</span></>
                  : <><span className="po-livedot" style={{ background: active.status === "idle" ? "var(--t-dim)" : active.status === "busy" ? "var(--c-amber)" : "var(--c-green)", animation: active.status === "idle" ? "none" : undefined }} /><span>{active.sub} · {active.status}</span></>}
              </div>
            </div>
            <div className="cm-chead-acts">
              <div className="cm-viewtog">
                <button className={view === "thread" ? "on" : ""} onClick={() => setView("thread")}>Thread</button>
                <button className={view === "console" ? "on" : ""} onClick={() => setView("console")}>Console</button>
              </div>
              <button className="po-icbtn" title="Call"><Icon name="mic" size={16} /></button>
              <button className="po-icbtn" title="Pin"><Icon name="pin" size={16} /></button>
            </div>
          </header>

          {view === "console"
            ? <window.TransmissionsConsole active={active} />
            : <React.Fragment>
          <div className="cm-thread po-scroll" ref={threadRef}>
            <div className="cm-thread-inner">
              <div className="cm-daystamp">Today · 23:47</div>
              {msgs.map((m) => <Message key={m.id} m={m} />)}
            </div>
          </div>

          <div className="cm-chips">
            {CHIPS.map((c) => <button key={c.t} className="cm-chip" onClick={() => send(c.t)}><Icon name={c.icon} size={14} />{c.t}</button>)}
          </div>

          <div className="cm-composer">
            <div className="cm-composer-inner">
              <div className="cm-box">
                <button className="cm-tool" title="Attach"><Icon name="attach" size={18} /></button>
                {mic
                  ? <div className="cm-voice">{[10,18,7,15,12,20,9,16,11,18,8,14].map((h, i) => <i key={i} style={{ height: h, animationDelay: (i * 0.06) + "s" }} />)}</div>
                  : <textarea ref={taRef} rows={1} value={input} onChange={grow} onKeyDown={onKey} placeholder={active.kind === "channel" ? `Message ${active.name}…` : `Message ${active.name} — ${active.sub}…`} />}
                <button className={"cm-tool" + (mic ? " on" : "")} title="Voice" onClick={() => setMic((v) => !v)}><Icon name="mic" size={18} /></button>
                <button className="cm-send" disabled={!input.trim() && !mic} onClick={() => (mic ? (setMic(false), send("Are we all green?")) : send())}><Icon name="send" size={18} /></button>
              </div>
              <div className="cm-composer-row">
                <button className={"cm-runjob" + (runJob ? " on" : "")} onClick={() => setRunJob((v) => !v)}><span className="sw" /> Run as Job</button>
                <span className="cm-hint">↵ send · ⇧↵ newline</span>
              </div>
            </div>
          </div>
            </React.Fragment>}
        </div>
      </div>
    );
  }

  function ConvRow({ c, on, unread, onClick, channel }) {
    return (
      <div className={"cm-conv" + (on ? " on" : "")} style={{ "--fac": c.fac }} onClick={onClick}>
        <span className="cm-conv-av" style={channel ? null : { background: "none", border: "none", clipPath: "none" }}>
          {channel ? <Icon name="hash" size={17} /> : <Avatar agent={agentById(c.agentId)} size={38} bob={false} pip />}
        </span>
        <div className="cm-conv-main">
          <div className="cm-conv-top"><span className="cm-conv-name">{c.name}</span><span className="cm-conv-t">{c.t}</span></div>
          <div className="cm-conv-prev">{c.last}</div>
        </div>
        {unread > 0 && <span className="cm-unread">{unread}</span>}
      </div>
    );
  }

  const fmt = (t) => t.replace(/&(?!amp;|lt;)/g, "&amp;").replace(/<(?!\/?b>)/g, "&lt;").replace(/\b(ATLAS|SHURI|VEE|PROXIMON|TRIAGE|SENTRY|LEDGER|MRR|\$48\.2k|412 leads|template v2|18 hot|40%)\b/g, "<b>$1</b>");

  function Avatar2({ m }) {
    if (m.who === "user") return <div className="cm-av" style={{ "--fac": "var(--c-purple-l)" }}><span className="slash" style={{ width: 16 }} /></div>;
    const ag = agentById(m.who);
    if (ag) return <div className="cm-av" style={{ "--fac": m.fac, background: "none", border: "none" }}><Avatar agent={ag} size={40} bob={false} /></div>;
    return <div className="cm-av" style={{ "--fac": m.fac }}><Icon name={m.sigil || "agents"} size={20} /></div>;
  }

  function Message({ m }) {
    const text = m.shown >= 999 ? m.full : m.full.slice(0, m.shown);
    const a = m.who !== "user" && m.who !== "atlas" ? agentById(m.who) : null;
    return (
      <div className={"cm-msg " + (m.who === "user" ? "user" : "agent")} style={{ "--fac": m.fac }}>
        <Avatar2 m={m} />
        <div className="cm-body">
          <div className="cm-from">
            <span className="nm" style={{ color: m.fac }}>{m.name}</span>
            {a && <span className="cl">{a.role.toLowerCase()}</span>}
            {m.who === "atlas" && <span className="cl">operations lead</span>}
          </div>
          <div className="cm-bubble" dangerouslySetInnerHTML={{ __html: fmt(text) + (m.streaming ? '<span class="cm-caret"></span>' : "") }} />
          {m.card && m.card.type === "job" && <JobCard c={m.card} />}
          {m.card && m.card.type === "data" && <DataCard c={m.card} />}
        </div>
      </div>
    );
  }

  function JobCard({ c }) {
    const o = agentById(c.agentId);
    return (
      <div className="cm-job holo-edge" style={{ "--fac": o.fac }}>
        <div className="cm-job-head">
          <span className="cm-job-sig"><Icon name={o.sigil} size={17} /></span>
          <div><div className="cm-job-title">{c.title}</div><div style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, color: "var(--t-lo)", marginTop: 2 }}>dispatched to {o.name}</div></div>
          <span className="cm-job-id">#{c.jobId}</span>
        </div>
        <div className="cm-job-body">
          <div className="cm-job-steps">
            {c.steps.map((s, i) => {
              const state = c.done || i < c.step ? "done" : i === c.step ? "active" : "";
              return <div key={i} className={"cm-step " + state}><span className="dot">{(c.done || i < c.step) ? <Icon name="check" size={10} /> : null}</span>{s}</div>;
            })}
          </div>
          <div className="cm-prog"><span style={{ width: (c.done ? 100 : c.prog) + "%" }} /></div>
        </div>
        <div className="cm-job-foot">
          {c.done
            ? <><span className="po-livedot" style={{ background: "var(--c-green)" }} /><span style={{ color: "var(--c-green)" }}>Complete</span><span style={{ color: "var(--t-lo)", marginLeft: "auto" }}>shipped · 1m 12s</span></>
            : <><span className="po-livedot" style={{ background: "var(--accent)" }} /><span style={{ color: "var(--accent)" }}>Running</span><span style={{ color: "var(--t-lo)", marginLeft: "auto" }}>live · streaming logs</span></>}
        </div>
      </div>
    );
  }

  function DataCard({ c }) {
    if (c.kind === "leads") return (
      <div className="cm-data" style={{ "--fac": "var(--c-orange)" }}>
        <div className="cm-data-head"><Icon name="sales" size={15} style={{ color: "var(--c-orange)" }} /> Hot leads · scored 23:31</div>
        {LEADS.map((l) => (
          <div key={l.name} className="cm-lead">
            <span className={"cm-lead-score " + l.tier}>{l.score}</span>
            <div style={{ flex: 1 }}><div className="cm-lead-name">{l.name}</div><div className="cm-lead-meta">{l.meta}</div></div>
          </div>
        ))}
      </div>
    );
    return (
      <div className="cm-data" style={{ "--fac": "var(--c-gold)" }}>
        <div className="cm-data-head"><Icon name="finance" size={15} style={{ color: "var(--c-gold)" }} /> MRR · trailing 7 days</div>
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "flex-end", gap: 18 }}>
          <div><div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.02em" }}>$48.2k</div><div style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--c-green)", marginTop: 3 }}>▲ 6.0% w/w</div></div>
          <svg width="200" height="56" viewBox="0 0 200 56" style={{ flex: 1 }}>
            <polyline points="0,44 33,40 66,42 100,30 133,26 166,18 200,8" fill="none" stroke="var(--c-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="200" cy="8" r="3" fill="var(--c-gold)" />
          </svg>
        </div>
      </div>
    );
  }

  window.CommsView = CommsView;
})();
