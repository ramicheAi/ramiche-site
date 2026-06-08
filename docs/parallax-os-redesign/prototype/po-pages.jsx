/* ================================================================
   PARALLAX OS — page surfaces: Agents · Observatory · Finance ·
   holographic Scaffold. window.PageView({ id, go })
   ================================================================ */
(function () {
  const { Icon, Avatar } = window.PO;
  const { AGENTS, PAGE } = window.PO_DATA;

  // deterministic serial code per page
  function serialFor(id) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const a = (h % 9 + 1), b = (h >> 4) % 900 + 100, c = (h >> 8) % 9000 + 1000;
    return `${String(a).padStart(2, "0")}A${b}·${c}`;
  }

  function Head({ id, actions }) {
    const p = PAGE[id] || { label: id, icon: "dot", accent: "var(--c-purple)", section: "" };
    const secIndex = Object.keys(PAGE).indexOf(id) + 1;
    return (
      <div className="pg-head instrument-head">
        <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
        <span className="pg-head-ic"><Icon name={p.icon} size={24} /><span className="pg-ic-ring" /></span>
        <div className="pg-head-body">
          <div className="pg-head-meta mono">
            <span className="pg-sec">{p.section}</span>
            <span className="pg-sep" />
            <span className="pg-serial">SYS·{serialFor(id)}</span>
            <span className="pg-sep" />
            <span className="pg-live"><i />ONLINE</span>
          </div>
          <h1 className="pg-h1 echo" data-echo={p.label}>{p.label}</h1>
          <div className="pg-ruler" aria-hidden="true">{Array.from({ length: 40 }).map((_, i) => <i key={i} className={i % 5 === 0 ? "maj" : ""} />)}</div>
        </div>
        {actions && <div className="pg-head-act">{actions}</div>}
      </div>
    );
  }

  // deterministic per-agent collectible stats + flavor
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function statsFor(a) {
    const h = hash(a.id);
    const r = (shift, lo, hi) => lo + ((h >> shift) & 0xff) % (hi - lo + 1);
    return {
      level: a.lead ? 99 : 40 + ((h >> 3) & 0x3f),
      power: a.lead ? 96 : r(2, 58, 95),
      speed: r(6, 55, 97),
      intel: r(10, 60, 98),
      sync: a.status === "active" ? r(14, 82, 99) : a.status === "busy" ? r(14, 70, 90) : r(14, 40, 66),
    };
  }
  const LORE = {
    atlas: "Coordinates all twenty operatives. Never sleeps, never blinks.",
    shuri: "Turns napkin sketches into shipped apps before the coffee's cold.",
    vee: "Reads the room, then rewrites it. The fleet's voice.",
    triage: "First on the scene when something breaks. Calm under fire.",
    proximon: "Scouts the void for the next hot lead. Always three jumps ahead.",
    ledger: "Every credit accounted for. The numbers never lie to Ledger.",
    sentry: "Holds the perimeter. Nothing gets through unscanned.",
    oracle: "Sees the pattern before it forms. Forecasts in real time.",
    scribe: "Chronicles everything. If it happened, Scribe wrote it down.",
    nexus: "Bridges every system. The connective tissue of the fleet.",
    cadence: "Sets the tempo. Mixes signal from noise.",
    horizon: "Watches the far edge of the market. Tracks every faint signal.",
    closer: "Never leaves a deal on the table. Seals it, every time.",
    counsel: "Reads the fine print so you don't have to. Airtight.",
    curator: "Keeps the collection pristine. An eye for the rare.",
    pulse: "Feels the system's heartbeat. Flags the flutter before the fault.",
    warden: "Guards the fleet's wellbeing. Recovery is a discipline.",
    mason: "Builds the hardware the others run on. Forged, not printed.",
    archive: "Remembers all nine thousand notes. Forgets nothing.",
    vector: "Plots the long game. Every move three steps deep.",
  };

  function AgentCard({ a, rarity, go }) {
    const [flipped, setFlipped] = React.useState(false);
    const charSrc = "public/assets/characters/" + (a.char || 1) + ".png";
    const cardY = { 1: 8, 2: 6, 3: 16, 4: 4, 5: 7, 6: 9, 7: 5, 8: 15, 9: 3, 10: 9 }[a.char || 1];
    const s = statsFor(a);
    const bars = [["POWER", s.power], ["SPEED", s.speed], ["INTEL", s.intel], ["SYNC", s.sync]];
    return (
      <div className={"coll-card" + (flipped ? " flipped" : "")} style={{ "--fac": a.fac }} onClick={() => setFlipped((v) => !v)}>
        <div className="coll-flip">
          {/* FRONT */}
          <div className="coll-face coll-front holo-edge">
            <div className="coll-portrait">
              <div className="coll-platform" />
              <div className="coll-grid-fx" />
              <span className="coll-emblem"><Icon name={a.sigil} size={120} stroke={1} /></span>
              <img className="coll-img" src={charSrc} alt={a.name + " — Galactik Antics collectible"} loading="lazy" style={{ objectPosition: "50% " + cardY + "%" }} />
              <span className="coll-rarity">{rarity(a)}</span>
              <span className={"coll-status " + a.status}><i />{a.status}</span>
              <span className="coll-fliphint"><Icon name="spark" size={11} /> stats</span>
            </div>
            <div className="coll-plate">
              <div className="coll-name">{a.name}{a.lead && <span className="ag-lead-badge">LEAD</span>}</div>
              <div className="coll-role">{a.role}</div>
              <div className="coll-meta">
                <span className="coll-faction">{a.fac.replace("var(--c-", "").replace(")", "")}</span>
                <span className="coll-task">{a.task}</span>
              </div>
            </div>
          </div>
          {/* BACK */}
          <div className="coll-face coll-back holo-edge holo-foil">
            <div className="cb-head">
              <Avatar agent={a} size={44} bob={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="coll-name" style={{ fontSize: 16 }}>{a.name}</div>
                <div className="coll-role">{a.role}</div>
              </div>
              <div className="cb-level"><span className="cb-lvl-lab">LVL</span><span className="cb-lvl-num tnum">{s.level}</span></div>
            </div>
            <div className="cb-stats">
              {bars.map(([lab, v]) => (
                <div key={lab} className="cb-stat">
                  <span className="cb-stat-lab">{lab}</span>
                  <span className="cb-bar"><span style={{ width: v + "%" }} /></span>
                  <span className="cb-stat-num tnum">{v}</span>
                </div>
              ))}
            </div>
            <div className="cb-lore"><span className="eyebrow" style={{ color: "var(--fac)" }}>Dossier</span><p>{LORE[a.id] || a.task}</p></div>
            <button className="cb-open" onClick={(e) => { e.stopPropagation(); go("comms"); }}><Icon name="comms" size={15} /> Open direct line</button>
          </div>
        </div>
      </div>
    );
  }

  function AgentsPage({ go }) {
    const [filter, setFilter] = React.useState("all");
    const shown = AGENTS.filter((a) => filter === "all" || (filter === "online" ? a.status !== "idle" : a.status === "idle"));
    const rarity = (a) => a.lead ? "Mythic" : a.status === "active" ? "Rare" : a.status === "busy" ? "Epic" : "Common";
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-green)" }}>
        <div className="pg-inner">
          <Head id="agents" actions={<button className="pg-btn"><Icon name="plus" size={15} /> Deploy agent</button>} />
          <p className="pg-sub" style={{ marginTop: -16, marginBottom: 22 }}>Your Galactik Antics roster — twenty operatives, each matched to its character. Tap a card to flip its dossier.</p>
          <div className="ag-filter">
            {[["all", "All · 20"], ["online", "Online · 14"], ["idle", "Idle · 6"]].map(([k, l]) => (
              <button key={k} className={"cm-tab" + (filter === k ? " on" : "")} style={{ flex: "0 0 auto", padding: "0 16px", height: 30, "--accent": "var(--c-green)" }} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <div className="ag-grid">
            {shown.map((a) => <AgentCard key={a.id} a={a} rarity={rarity} go={go} />)}
          </div>
        </div>
      </div>
    );
  }

  const SIGNALS = [
    { name: "Helios Robotics · hiring surge", conf: 96, r: 0.30, a: 20 }, { name: "Vela Logistics · funding rumor", conf: 88, r: 0.40, a: 305 },
    { name: "Orbit Health · exec hire", conf: 81, r: 0.26, a: 140 }, { name: "Cobalt Studio · pricing intent", conf: 74, r: 0.42, a: 210 },
    { name: "Nimbus AI · competitor churn", conf: 67, r: 0.36, a: 80 }, { name: "Apex Foundry · RFP posted", conf: 59, r: 0.45, a: 255 },
  ];
  function ObservatoryPage() {
    const reduced = React.useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;
    const [sig, setSig] = React.useState(SIGNALS);
    const [phase, setPhase] = React.useState(0);
    const [sel, setSel] = React.useState(0);
    React.useEffect(() => {
      if (reduced) return;
      const iv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        setSig((prev) => prev.map((s) => ({ ...s, conf: Math.max(40, Math.min(99, s.conf + Math.round((Math.random() - 0.5) * 4))) })));
      }, 1700);
      let raf, start = performance.now();
      const loop = (now) => { setPhase((now - start) / 1000); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => { clearInterval(iv); cancelAnimationFrame(raf); };
    }, [reduced]);
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-violet)" }}>
        <div className="pg-inner">
          <Head id="observatory" actions={<button className="pg-btn"><Icon name="spark" size={15} /> Scan now</button>} />
          <p className="pg-sub" style={{ marginTop: -16, marginBottom: 24 }}>HORIZON is tracking {sig.length} live signals across the market. Confidence updates in real time.</p>
          <div className="ob-grid">
            <div className="ob-radar holo-edge">
              {[0.32, 0.58, 0.84].map((r, i) => <div key={i} className="ob-ring" style={{ width: `${r * 100}%`, height: `${r * 100}%` }} />)}
              <div className="ob-sweep" />
              <div className="ob-planet">
                <div className="ob-planet-glow" />
                <div className="ob-planet-body"><img src="public/assets/characters/11.png" alt="Tracked world" /></div>
                <div className="ob-planet-ring" />
              </div>
              {sig.map((s, i) => {
                const ang = (s.a + phase * (6 + i * 1.5)) * Math.PI / 180;
                const left = 50 + Math.cos(ang) * s.r * 100;
                const top = 50 + Math.sin(ang) * s.r * 100;
                return <span key={i} className={"ob-blip" + (sel === i ? " sel" : "")} onClick={() => setSel(i)}
                  style={{ left: left + "%", top: top + "%", "--bc": s.conf > 85 ? "var(--c-rose)" : "var(--c-violet)" }} title={s.name} />;
              })}
            </div>
            <section className="po-panel">
              <div className="cv-sec-head"><Icon name="observatory" size={16} style={{ color: "var(--accent)" }} /><h3>Tracked signals</h3><span className="po-pal-grp mono">HORIZON · live</span></div>
              <div style={{ padding: "2px 0" }}>
                {sig.map((s, i) => (
                  <div key={s.name} className={"ob-signal" + (sel === i ? " sel" : "")} onClick={() => setSel(i)}>
                    <span className="ob-conf tnum" style={s.conf > 85 ? { color: "var(--c-rose)" } : null}>{s.conf}%</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, marginBottom: 6 }}>{s.name}</div><div className="ob-bar"><span style={{ width: s.conf + "%", background: s.conf > 85 ? "var(--c-rose)" : "var(--c-violet)" }} /></div></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const TX = [
    ["Helios Robotics", "Annual · Scale", "+$18,000"], ["Vela Logistics", "Monthly · Pro", "+$2,400"],
    ["Orbit Health", "Annual · Pro", "+$9,600"], ["Cobalt Studio", "Monthly · Starter", "+$390"],
    ["Refund · Nimbus", "Downgrade", "−$1,200"],
  ];
  const TX_POOL = [
    ["Meridian Labs", "Annual · Scale", "+$24,000"], ["Quanta Systems", "Monthly · Pro", "+$2,400"],
    ["Northwind Co", "Monthly · Starter", "+$390"], ["Ardent Group", "Annual · Pro", "+$9,600"],
    ["Volt Mobility", "Monthly · Pro", "+$2,400"], ["Cirrus AI", "Annual · Scale", "+$31,000"],
    ["Refund · Pylon", "Downgrade", "−$890"], ["Beacon Health", "Monthly · Pro", "+$2,400"],
  ];

  function FinancePage() {
    const reduced = React.useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;
    const [mrr, setMrr] = React.useState(48200);
    const [chart, setChart] = React.useState([72, 66, 70, 50, 44, 28, 18, 8]);
    const [feed, setFeed] = React.useState(() => TX.map((t, i) => ({ t, id: i, fresh: false })));
    const nid = React.useRef(100);
    React.useEffect(() => {
      if (reduced) return;
      const iv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        setMrr((v) => v + Math.round(Math.random() * 180));
        setChart((c) => [...c.slice(1), Math.max(4, c[c.length - 1] + (Math.random() - 0.6) * 10)]);
      }, 1500);
      const feedIv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        const pick = TX_POOL[Math.floor(Math.random() * TX_POOL.length)];
        setFeed((f) => [{ t: pick, id: nid.current++, fresh: true }, ...f].slice(0, 7));
      }, 4200);
      return () => { clearInterval(iv); clearInterval(feedIv); };
    }, [reduced]);
    const mrrK = (mrr / 1000).toFixed(1);
    const arr = ((mrr * 12) / 1000).toFixed(0);
    const pts = chart.map((v, i) => `${(i / (chart.length - 1)) * 320},${v}`).join(" ");
    const lastX = 320, lastY = chart[chart.length - 1];
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-gold)" }}>
        <div className="pg-inner">
          <Head id="finance" actions={<button className="pg-btn"><Icon name="reports" size={15} /> Export</button>} />
          <div className="fn-hero po-panel holo-foil">
            <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
            <div>
              <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>Monthly recurring revenue <span className="fn-livetag mono"><i />LIVE</span></div>
              <div className="fn-big tnum">${mrrK}k</div>
              <div className="fn-delta">▲ 6.0% week-over-week · ${arr}k ARR</div>
            </div>
            <svg width="320" height="92" viewBox="0 0 320 92" style={{ flex: 1, minWidth: 0 }}>
              <defs><linearGradient id="fn-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--c-gold)" stopOpacity="0.35" /><stop offset="1" stopColor="var(--c-gold)" stopOpacity="0" /></linearGradient></defs>
              <path className="fn-area" d={`M0,${chart[0]} ${chart.map((v, i) => `L${(i / (chart.length - 1)) * 320},${v}`).join(" ")} L320,92 L0,92 Z`} fill="url(#fn-g)" />
              <polyline className="fn-line" points={pts} fill="none" stroke="var(--c-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={lastX} cy={lastY} r="3.5" fill="var(--c-gold)" /><circle className="fn-pulse" cx={lastX} cy={lastY} r="3.5" fill="none" stroke="var(--c-gold)" />
            </svg>
          </div>
          <div className="fn-tiles">
            {[["Net new MRR", "+$2.7k", 0.62], ["New logos", "6", 0.4], ["Churn", "1.2%", 0.12], ["Runway", "31 mo", 0.78]].map(([l, v, a]) => (
              <div key={l} className="fn-tile inst-mod" style={{ minHeight: 0 }}>
                <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <RingGauge v={a} size={44} />
                  <div><div className="eyebrow">{l}</div><div className="v tnum" style={{ fontSize: 24 }}>{v}</div></div>
                </div>
              </div>
            ))}
          </div>
          <section className="po-panel">
            <div className="cv-sec-head"><Icon name="finance" size={16} style={{ color: "var(--accent)" }} /><h3>Transaction stream</h3><span className="po-pal-grp">LEDGER · live sync</span></div>
            <div style={{ padding: "4px 0" }}>
              {feed.map(({ t, id, fresh }) => (
                <div key={id} className={"fn-row" + (fresh ? " fn-fresh" : "")}>
                  <div><div style={{ fontSize: 13.5, fontWeight: 500 }}>{t[0]}</div><div style={{ fontSize: 11, color: "var(--t-lo)", marginTop: 1 }}>{t[1]}</div></div>
                  <span className="fn-amt" style={{ color: t[2][0] === "−" ? "var(--c-rose)" : "var(--c-green)" }}>{t[2]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // page-specific instrument module sets (deterministic, lived-in)
  function modulesFor(id) {
    const h = hash(id);
    const labels = {
      tasks: ["QUEUE DEPTH", "THROUGHPUT", "SLA MARGIN", "RETRY RATE", "OPERATOR LOAD", "BACKLOG"],
      security: ["THREAT LEVEL", "GATEWAY", "CERT HEALTH", "INTRUSION", "ENCRYPTION", "FIREWALL"],
      health: ["CPU", "MEMORY", "DISK I/O", "NET LATENCY", "UPTIME", "ERROR BUDGET"],
      strategy: ["MARKET POS", "RUNWAY", "MOMENTUM", "RISK INDEX", "CONVICTION", "VELOCITY"],
      sales: ["PIPELINE", "WIN RATE", "DEAL SIZE", "CYCLE TIME", "QUOTA", "FORECAST"],
      proposals: ["DRAFTS", "SENT", "OPEN RATE", "WIN PROB", "AVG VALUE", "AGING"],
      arbitrage: ["SPREAD", "VOLUME", "LATENCY", "FILL RATE", "EXPOSURE", "YIELD"],
      nerve: ["SIGNAL", "BANDWIDTH", "NODES", "SYNC", "PACKET LOSS", "RELAY"],
      gallery: ["RENDERS", "STORAGE", "VIEWS", "CURATION", "EXPORTS", "QUEUE"],
      studio: ["TRACKS", "RENDER LOAD", "MIX BUS", "STEMS", "LATENCY", "OUTPUT"],
      legal: ["CONTRACTS", "REVIEW QUEUE", "RISK", "SIGNATURES", "DEADLINES", "COMPLIANCE"],
      content: ["DRAFTS", "PUBLISHED", "ENGAGEMENT", "PIPELINE", "REACH", "VELOCITY"],
      reports: ["GENERATED", "SCHEDULED", "FRESHNESS", "EXPORTS", "COVERAGE", "ACCURACY"],
      yolo: ["BUILDS", "PASS RATE", "DEPLOY", "ROLLBACK", "VELOCITY", "RISK"],
      gateway: ["UPTIME", "THROUGHPUT", "LATENCY", "ERROR RATE", "RETRIES", "LOAD"],
    };
    const set = labels[id] || ["FLUX", "CHARGE", "RESONANCE", "PHASE", "DRIFT", "YIELD"];
    return set.map((lab, i) => {
      const v = 30 + ((h >> (i * 3)) & 0xff) % 68;
      const wave = Array.from({ length: 9 }, (_, j) => 20 + ((h >> (i + j)) & 0x1f));
      return { lab, v, wave, serial: `${(i + 1).toString(16).toUpperCase()}${((h >> i) & 0xff).toString(16).toUpperCase().padStart(2, "0")}`, ok: ((h >> i) & 1) === 0 };
    });
  }

  function Scaffold({ id }) {
    const p = PAGE[id] || { label: id, icon: "dot", accent: "var(--c-purple)" };
    const base = React.useMemo(() => modulesFor(id), [id]);
    const [mods, setMods] = React.useState(base);
    React.useEffect(() => { setMods(base); }, [base]);
    React.useEffect(() => {
      const reduced = (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)
        || document.querySelector(".po-app.po-still");
      if (reduced) return;
      const iv = setInterval(() => {
        setMods((prev) => prev.map((m) => {
          const drift = (Math.random() - 0.5) * 5;
          const v = Math.max(6, Math.min(99, Math.round(m.v + drift)));
          const wave = [...m.wave.slice(1), 20 + Math.round(Math.random() * 30)];
          const crit = v >= 90;
          return { ...m, v, wave, crit, glitch: crit && !m.crit ? Date.now() : (crit ? m.glitch : 0) };
        }));
      }, 1600);
      return () => clearInterval(iv);
    }, [id, p.label]);
    // reconcile alerts/toasts from a post-render effect (never during render)
    const prevCrit = React.useRef({});
    React.useEffect(() => {
      mods.forEach((m) => {
        const akey = `${id}:${m.serial}`;
        const was = prevCrit.current[m.serial];
        if (m.crit && !was) {
          if (window.poToast) window.poToast({ text: `${m.lab} critical · ${m.v}%`, sub: `${p.label.toUpperCase()} · ${m.serial}`, kind: "alert" });
          if (window.poAlertBus) window.poAlertBus.set(akey, { label: m.lab, value: m.v + "%", page: id, pageLabel: p.label, serial: m.serial });
        } else if (!m.crit && was && window.poAlertBus) {
          window.poAlertBus.clear(akey);
        }
        prevCrit.current[m.serial] = m.crit;
      });
    }, [mods, id, p.label]);
    // clear this page's alerts when leaving the page
    React.useEffect(() => () => {
      if (!window.poAlertBus) return;
      base.forEach((m) => window.poAlertBus.clear(`${id}:${m.serial}`));
    }, [id, base]);
    return (
      <div className="pg po-scroll" style={{ "--accent": p.accent }}>
        <div className="pg-inner">
          <Head id={id} actions={<button className="pg-btn"><Icon name="command" size={15} /> Configure</button>} />
          <div className="scaf-grid">
            {mods.map((m, i) => (
              <div key={i} className={"inst-mod" + (m.crit ? " crit" : "")} data-glitch={m.glitch || undefined}>
                <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
                <div className="inst-mod-head">
                  <span className="inst-mod-lab mono" data-text={m.lab}>{m.lab}</span>
                  <span className="inst-mod-serial mono">{m.serial}</span>
                </div>
                <div className="inst-mod-body">
                  <RingGauge v={m.v / 100} crit={m.crit} />
                  <div className="inst-mod-read">
                    <div className="inst-mod-val tnum">{m.v}<small>%</small></div>
                    <div className={"inst-mod-stat " + (m.crit ? "crit" : m.ok ? "ok" : "warn")}><i />{m.crit ? "ALERT" : m.ok ? "NOMINAL" : "MONITOR"}</div>
                  </div>
                </div>
                <svg className="inst-wave" viewBox="0 0 120 24" preserveAspectRatio="none">
                  <polyline points={m.wave.map((w, j) => `${j * 15},${24 - (w / 52) * 22}`).join(" ")} fill="none" stroke={m.crit ? "var(--c-red)" : "var(--accent)"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ))}
          </div>
          <div className="scaf-note"><Icon name="atlas" size={18} style={{ color: "var(--accent)" }} /> <b style={{ color: "var(--accent)", margin: "0 4px" }}>{p.label}</b> telemetry is live. ATLAS holds the controls — reskinned instrument surface, logic untouched.</div>
        </div>
      </div>
    );
  }

  // compact ring gauge for instrument modules
  function RingGauge({ v, size = 56, crit }) {
    const R = 22, C = 2 * Math.PI * R, span = 0.75, fill = C * span * Math.max(0, Math.min(1, v));
    const col = crit ? "var(--c-red)" : "var(--accent)";
    return (
      <svg className="inst-ring" width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
        <g transform="rotate(135 28 28)">
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line-2)" strokeWidth="3" strokeDasharray={`${C * span} ${C}`} opacity="0.3" />
          <circle className="inst-ring-fill" cx="28" cy="28" r={R} fill="none" stroke={col} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${fill} ${C}`} />
        </g>
        {Array.from({ length: 7 }).map((_, i) => {
          const a = (135 + (i / 6) * 270) * Math.PI / 180;
          return <line key={i} x1={28 + Math.cos(a) * 26} y1={28 + Math.sin(a) * 26} x2={28 + Math.cos(a) * 28} y2={28 + Math.sin(a) * 28} stroke={col} strokeWidth="1" opacity="0.4" />;
        })}
        <circle cx="28" cy="28" r="2.5" fill={col} />
      </svg>
    );
  }

  // ---------- APP BUILDER (living build/deploy console) ----------
  const BUILD_STAGES = ["PULL", "INSTALL", "COMPILE", "TEST", "BUNDLE", "DEPLOY"];
  const BUILD_NAMES = ["prospector-ui", "gateway-edge", "atlas-core", "comms-relay", "ledger-sync", "nexus-bridge", "forge-api", "studio-render"];
  const DEPLOY_TARGETS = [
    { name: "edge · cloudflare", env: "PROD", status: "live", v: "v4.14.2" },
    { name: "command.parallaxvinc.com", env: "PROD", status: "live", v: "v4.14.2" },
    { name: "staging · fly.io", env: "STAGE", status: "building", v: "v4.15.0-rc1" },
    { name: "preview · vercel", env: "PREVIEW", status: "live", v: "pr-318" },
  ];

  function AppBuilderPage() {
    const reduced = React.useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;
    const [stage, setStage] = React.useState(2);
    const [pct, setPct] = React.useState(46);
    const [queue, setQueue] = React.useState(() => BUILD_NAMES.slice(0, 5).map((n, i) => ({ n, id: i, st: i === 0 ? "building" : i === 1 ? "queued" : "passed", t: (i * 3 + 2) + "m" })));
    const [logs, setLogs] = React.useState([
      "› forge: resolving dependency graph … 412 pkgs",
      "› shuri: compiling template-v2 modules",
      "✓ typecheck passed · 0 errors",
      "› bundling edge worker … tree-shaking",
    ]);
    const nid = React.useRef(50);
    React.useEffect(() => {
      if (reduced) return;
      const iv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        setPct((p) => { const np = p + 6 + Math.random() * 8; if (np >= 100) { setStage((s) => (s + 1) % BUILD_STAGES.length); return 8; } return np; });
        setLogs((l) => [...l.slice(-7), ["✓ chunk emitted · " + (40 + Math.floor(Math.random() * 200)) + "kb", "› linking modules …", "✓ test suite green · " + (20 + Math.floor(Math.random() * 80)) + " passed", "› deploying to edge …", "✓ smoke test ok"][Math.floor(Math.random() * 5)]]);
      }, 1300);
      const qiv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        const n = BUILD_NAMES[Math.floor(Math.random() * BUILD_NAMES.length)];
        setQueue((q) => [{ n, id: nid.current++, st: "building", t: "now", fresh: true }, ...q.map((x) => ({ ...x, st: x.st === "building" ? "passed" : x.st, fresh: false }))].slice(0, 5));
      }, 5200);
      return () => { clearInterval(iv); clearInterval(qiv); };
    }, [reduced]);
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-cyan)" }}>
        <div className="pg-inner">
          <Head id="builder" actions={<button className="pg-btn"><Icon name="bolt" size={15} /> New build</button>} />
          {/* live pipeline */}
          <section className="po-panel ab-pipe">
            <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
            <div className="ab-pipe-head">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--accent)" }}>BUILD PIPELINE</span>
              <span className="ab-cur mono">forge › {BUILD_STAGES[stage].toLowerCase()} · {Math.round(pct)}%</span>
              <span className="ab-livetag mono"><i />RUNNING</span>
            </div>
            <div className="ab-stages">
              {BUILD_STAGES.map((s, i) => (
                <div key={s} className={"ab-stage " + (i < stage ? "done" : i === stage ? "active" : "")}>
                  <span className="ab-stage-dot">{i < stage ? <Icon name="check" size={11} /> : i + 1}</span>
                  <span className="ab-stage-lab mono">{s}</span>
                  {i === stage && <span className="ab-stage-fill" style={{ width: pct + "%" }} />}
                  {i < BUILD_STAGES.length - 1 && <span className="ab-stage-conn" />}
                </div>
              ))}
            </div>
          </section>

          <div className="ab-grid">
            {/* build queue */}
            <section className="po-panel">
              <div className="cv-sec-head"><Icon name="forge" size={16} style={{ color: "var(--accent)" }} /><h3>Build queue</h3><span className="po-pal-grp mono">SHURI · live</span></div>
              <div style={{ padding: "4px 0" }}>
                {queue.map((b) => (
                  <div key={b.id} className={"ab-build" + (b.fresh ? " ab-fresh" : "")}>
                    <span className={"ab-bstat " + b.st} />
                    <span className="ab-bname mono">{b.n}</span>
                    <span className={"ab-bbadge " + b.st}>{b.st}</span>
                    <span className="ab-btime mono">{b.t}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* live console */}
            <section className="po-panel ab-console">
              <div className="cv-sec-head"><Icon name="command" size={16} style={{ color: "var(--accent)" }} /><h3>Console</h3><span className="po-pal-grp mono">stdout</span></div>
              <div className="ab-log mono">
                {logs.map((l, i) => <div key={i} className={"ab-logline" + (l[0] === "✓" ? " ok" : "")}>{l}</div>)}
                <div className="ab-logcaret mono">forge@parallax <span className="ab-blink">▋</span></div>
              </div>
            </section>
          </div>

          {/* deploy targets */}
          <section className="po-panel">
            <div className="cv-sec-head"><Icon name="gateway" size={16} style={{ color: "var(--accent)" }} /><h3>Deploy targets</h3><span className="po-pal-grp mono">4 environments</span></div>
            <div style={{ padding: "4px 0" }}>
              {DEPLOY_TARGETS.map((d) => (
                <div key={d.name} className="ab-deploy">
                  <span className={"ab-dstat " + d.status} />
                  <span className="ab-dname">{d.name}</span>
                  <span className="ab-denv mono">{d.env}</span>
                  <span className="ab-dver mono">{d.v}</span>
                  <span className={"ab-dbadge " + d.status}>{d.status === "building" ? "BUILDING" : "LIVE"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- GALLERY (holographic render wall) ----------
  const GALLERY = [
    { n: 1, title: "ATLAS · PROTOTYPE", tag: "Operations", rarity: "Mythic" },
    { n: 2, title: "SENTRY · WARFRAME", tag: "Security", rarity: "Epic" },
    { n: 3, title: "VEE · SIGNAL", tag: "Brand", rarity: "Rare" },
    { n: 4, title: "TRIAGE · BULWARK", tag: "Response", rarity: "Epic" },
    { n: 5, title: "LEDGER · UNIT-01", tag: "Finance", rarity: "Rare" },
    { n: 6, title: "SHURI · TINKER", tag: "Creative", rarity: "Epic" },
    { n: 7, title: "WARDEN · FORGE", tag: "Wellness", rarity: "Common" },
    { n: 8, title: "ORACLE · COMPOUND", tag: "Analytics", rarity: "Rare" },
    { n: 9, title: "PROXIMON · SCOUT", tag: "Prospecting", rarity: "Epic" },
    { n: 10, title: "CADENCE · RESONANCE", tag: "Studio", rarity: "Rare" },
    { n: 11, title: "TERMINUS · WORLD", tag: "Observatory", rarity: "Mythic" },
  ];
  function GalleryPage() {
    const [lightbox, setLightbox] = React.useState(null);
    React.useEffect(() => {
      if (lightbox == null) return;
      const onKey = (e) => { if (e.key === "Escape") setLightbox(null); if (e.key === "ArrowRight") setLightbox((i) => (i + 1) % GALLERY.length); if (e.key === "ArrowLeft") setLightbox((i) => (i - 1 + GALLERY.length) % GALLERY.length); };
      window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    }, [lightbox]);
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-pink)" }}>
        <div className="pg-inner">
          <Head id="gallery" actions={<button className="pg-btn"><Icon name="plus" size={15} /> Commission</button>} />
          <p className="pg-sub" style={{ marginTop: -16, marginBottom: 22 }}>The Galactik Antics collection — {GALLERY.length} renders curated by CURATOR. Tap any plate to view in the holo-bay.</p>
          <div className="gal-wall">
            {GALLERY.map((g, i) => (
              <figure key={g.n} className={"gal-plate holo-edge r-" + g.rarity.toLowerCase()} onClick={() => setLightbox(i)} style={{ "--fac": g.rarity === "Mythic" ? "var(--c-gold)" : g.rarity === "Epic" ? "var(--c-pink)" : g.rarity === "Rare" ? "var(--c-cyan)" : "var(--t-mid)" }}>
                <div className="gal-img-wrap"><img src={"public/assets/characters/" + g.n + ".png"} alt={g.title} loading="lazy" /><span className="gal-scan" /></div>
                <figcaption>
                  <span className="gal-rarity mono">{g.rarity}</span>
                  <span className="gal-title mono">{g.title}</span>
                  <span className="gal-tag">{g.tag}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
        {lightbox != null && (
          <div className="gal-lightbox" onClick={() => setLightbox(null)}>
            <button className="gal-lb-nav prev" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + GALLERY.length) % GALLERY.length); }}><Icon name="chevron" size={22} style={{ transform: "rotate(180deg)" }} /></button>
            <figure className="gal-lb-fig" onClick={(e) => e.stopPropagation()}>
              <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
              <div className="gal-lb-bay"><img src={"public/assets/characters/" + GALLERY[lightbox].n + ".png"} alt={GALLERY[lightbox].title} /></div>
              <figcaption className="gal-lb-cap">
                <div><div className="gal-lb-title">{GALLERY[lightbox].title}</div><div className="gal-lb-tag mono">{GALLERY[lightbox].tag} · {GALLERY[lightbox].rarity}</div></div>
                <div className="gal-lb-idx mono">{String(lightbox + 1).padStart(2, "0")} / {String(GALLERY.length).padStart(2, "0")}</div>
              </figcaption>
            </figure>
            <button className="gal-lb-nav next" onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % GALLERY.length); }}><Icon name="chevron" size={22} /></button>
            <button className="gal-lb-close" onClick={() => setLightbox(null)}><Icon name="close" size={18} /></button>
          </div>
        )}
      </div>
    );
  }

  // ---------- NERVE CENTER (live integration mesh) ----------
  const NERVE_NODES = [
    { id: "atlas", label: "ATLAS", x: 50, y: 48, fac: "var(--c-gold)", core: true },
    { id: "gateway", label: "GATEWAY", x: 50, y: 14, fac: "var(--c-green)" },
    { id: "slack", label: "SLACK", x: 84, y: 26, fac: "var(--c-fuchsia)" },
    { id: "linear", label: "LINEAR", x: 88, y: 60, fac: "var(--c-indigo)" },
    { id: "stripe", label: "STRIPE", x: 70, y: 86, fac: "var(--c-cyan)" },
    { id: "github", label: "GITHUB", x: 30, y: 86, fac: "var(--c-violet)" },
    { id: "vercel", label: "VERCEL", x: 12, y: 60, fac: "var(--c-sky)" },
    { id: "openai", label: "OPENAI", x: 16, y: 26, fac: "var(--c-teal)" },
  ];
  const NERVE_LINKS = NERVE_NODES.filter((n) => !n.core).map((n) => ({ to: n.id, fac: n.fac }));
  const NERVE_FEED = [
    ["GATEWAY", "ingress · 1.2GB/s", "var(--c-green)"], ["STRIPE", "webhook · invoice.paid", "var(--c-cyan)"],
    ["GITHUB", "push · main +147", "var(--c-violet)"], ["SLACK", "msg · #launch-room", "var(--c-fuchsia)"],
    ["LINEAR", "issue · PAR-318 done", "var(--c-indigo)"], ["OPENAI", "completion · 2.4k tok", "var(--c-teal)"],
  ];
  function NerveCenterPage() {
    const reduced = React.useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;
    const [feed, setFeed] = React.useState(NERVE_FEED.map((f, i) => ({ f, id: i })));
    const nid = React.useRef(50);
    React.useEffect(() => {
      if (reduced) return;
      const iv = setInterval(() => {
        if (document.querySelector(".po-app.po-still")) return;
        const pick = NERVE_FEED[Math.floor(Math.random() * NERVE_FEED.length)];
        setFeed((q) => [{ f: pick, id: nid.current++, fresh: true }, ...q.map((x) => ({ ...x, fresh: false }))].slice(0, 7));
      }, 2600);
      return () => clearInterval(iv);
    }, [reduced]);
    const core = NERVE_NODES[0];
    return (
      <div className="pg po-scroll" style={{ "--accent": "var(--c-purple)" }}>
        <div className="pg-inner">
          <Head id="nerve" actions={<button className="pg-btn"><Icon name="nerve" size={15} /> Add bridge</button>} />
          <div className="nv-grid">
            <div className="nv-mesh po-panel holo-edge">
              <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
              <div className="nv-mesh-head"><span className="mono" style={{ fontSize: 10, letterSpacing: ".14em", color: "var(--accent)" }}>INTEGRATION MESH</span><span className="ab-livetag mono"><i style={{ background: "var(--c-purple-l)", boxShadow: "0 0 6px var(--c-purple-l)" }} />7 BRIDGES LIVE</span></div>
              <svg className="nv-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                {NERVE_LINKS.map((l, i) => { const n = NERVE_NODES.find((x) => x.id === l.to); return (
                  <g key={l.to}>
                    <line x1={core.x} y1={core.y} x2={n.x} y2={n.y} stroke={l.fac} strokeWidth="0.3" opacity="0.3" />
                    <circle className="nv-packet" r="0.9" fill={l.fac} style={{ offsetPath: `path('M ${n.x} ${n.y} L ${core.x} ${core.y}')`, animationDelay: (i * -0.7) + "s" }} />
                  </g>
                ); })}
                {NERVE_NODES.map((n) => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r={n.core ? 5 : 3.2} fill={`color-mix(in oklab, ${n.fac} 22%, #0c0c14)`} stroke={n.fac} strokeWidth="0.4" />
                    {n.core && <circle className="nv-core-ring" cx={n.x} cy={n.y} r="6.5" fill="none" stroke={n.fac} strokeWidth="0.3" opacity="0.5" />}
                  </g>
                ))}
              </svg>
              {NERVE_NODES.map((n) => (
                <span key={n.id} className="nv-node-lab mono" style={{ left: n.x + "%", top: n.y + "%", color: n.fac }}>{n.label}</span>
              ))}
            </div>
            <section className="po-panel nv-feed-panel">
              <div className="cv-sec-head"><Icon name="nerve" size={16} style={{ color: "var(--accent)" }} /><h3>Signal traffic</h3><span className="po-pal-grp mono">live</span></div>
              <div style={{ padding: "4px 0" }}>
                {feed.map(({ f, id, fresh }) => (
                  <div key={id} className={"nv-feed" + (fresh ? " ab-fresh" : "")}>
                    <span className="nv-feed-dot" style={{ background: f[2], boxShadow: "0 0 7px " + f[2] }} />
                    <span className="nv-feed-src mono" style={{ color: f[2] }}>{f[0]}</span>
                    <span className="nv-feed-msg mono">{f[1]}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  function PageView({ id, go }) {
    if (id === "agents") return <AgentsPage go={go} />;
    if (id === "observatory") return <ObservatoryPage />;
    if (id === "finance") return <FinancePage />;
    if (id === "builder") return <AppBuilderPage />;
    if (id === "gallery") return <GalleryPage />;
    if (id === "nerve") return <NerveCenterPage />;
    return <Scaffold id={id} />;
  }
  window.PageView = PageView;
})();
