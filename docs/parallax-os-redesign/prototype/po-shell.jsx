/* ================================================================
   PARALLAX OS — shell: holographic sidebar, top HUD, palette,
   router, parallax, light/dark, tweaks, mount.
   ================================================================ */
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const { Logo, Icon } = window.PO;
  const { NAV, PAGE, AGENTS } = window.PO_DATA;
  const { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider } = window;

  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // global alert bus — any instrument can surface a critical state system-wide
  const AlertBus = (function () {
    const map = new Map(); const subs = new Set();
    const emit = () => subs.forEach((f) => f([...map.values()]));
    return {
      set(key, alert) { map.set(key, { ...alert, key, ts: Date.now() }); emit(); },
      clear(key) { if (map.delete(key)) emit(); },
      subscribe(f) { subs.add(f); f([...map.values()]); return () => subs.delete(f); },
    };
  })();
  window.poAlertBus = AlertBus;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "sound": false,
    "sanctuary": true,
    "atmosphere": true,
    "holo": true,
    "motion": true,
    "rift": true,
    "echo": 5
  }/*EDITMODE-END*/;

  function useParallax(ref) {
    useEffect(() => {
      if (reduced) return;
      const el = ref.current; if (!el) return;
      let raf = 0;
      const onMove = (e) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", (e.clientX / window.innerWidth - 0.5).toFixed(3));
        el.style.setProperty("--my", (e.clientY / window.innerHeight - 0.5).toFixed(3));
      }); };
      window.addEventListener("mousemove", onMove);
      return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
    }, [ref]);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-po-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-po-theme", cur);
    try { localStorage.setItem("po-theme", cur); } catch (e) {}
  }

  function Shell() {
    const appRef = useRef(null);
    useParallax(appRef);
    const [booting, setBooting] = useState(() => {
      try { return sessionStorage.getItem("po-booted") !== "1"; } catch (e) { return true; }
    });
    useEffect(() => {
      if (!booting) return;
      const reduced = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dur = reduced ? 600 : 3200;
      const end = () => { setBooting(false); try { sessionStorage.setItem("po-booted", "1"); } catch (e) {} };
      if (window.poSound) window.poSound.play("boot");
      const t = setTimeout(end, dur);
      const skip = () => { clearTimeout(t); end(); };
      window.addEventListener("keydown", skip); window.addEventListener("click", skip);
      return () => { clearTimeout(t); window.removeEventListener("keydown", skip); window.removeEventListener("click", skip); };
    }, [booting]);
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    useEffect(() => { if (appRef.current) appRef.current.classList.toggle("po-noholo", !t.holo); }, [t.holo]);
    useEffect(() => { if (appRef.current) appRef.current.classList.toggle("po-flat", !t.atmosphere); }, [t.atmosphere]);
    useEffect(() => { if (appRef.current) appRef.current.classList.toggle("po-still", !t.motion); }, [t.motion]);
    useEffect(() => { document.documentElement.classList.toggle("po-norift", !t.rift); }, [t.rift]);
    useEffect(() => { document.documentElement.style.setProperty("--echo", t.echo + "px"); }, [t.echo]);

    const [active, setActive] = useState("dashboard");
    const [alerts, setAlerts] = useState([]);
    useEffect(() => AlertBus.subscribe(setAlerts), []);
    // navigation: single-open accordion — only the active section is expanded
    const secOf = (id) => (NAV.find((s) => s.items.some((i) => i.id === id)) || NAV[0]).label;
    const [openSec, setOpenSec] = useState(() => secOf("dashboard"));
    useEffect(() => { setOpenSec(secOf(active)); }, [active]);
    const [clock, setClock] = useState(() => { const d = new Date(); return d; });
    useEffect(() => { const iv = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(iv); }, []);
    const hh = String(clock.getHours()).padStart(2, "0"), mm = String(clock.getMinutes()).padStart(2, "0"), ss = String(clock.getSeconds()).padStart(2, "0");
    const [pal, setPal] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const [toast, setToast] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => { if (window.poSound) window.poSound.setEnabled(t.sound); }, [t.sound]);
    const go = useCallback((id) => { setActive(id); setPal(false); if (window.poSound) window.poSound.play("nav"); }, []);
    const openPal = useCallback(() => { setPal(true); setQ(""); setSel(0); }, []);
    useEffect(() => {
      const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPal(); } };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [openPal]);
    useEffect(() => { if (pal && inputRef.current) inputRef.current.focus(); }, [pal]);
    useEffect(() => { setSel(0); }, [q]);
    const fireToast = (x) => { setToast(x); if (window.poSound) window.poSound.play(x.kind === "alert" ? "alert" : x.kind === "done" ? "success" : "dispatch"); clearTimeout(window.__poT); window.__poT = setTimeout(() => setToast(null), 3400); };
    useEffect(() => { window.poToast = fireToast; return () => { if (window.poToast === fireToast) delete window.poToast; }; });

    const accent = (PAGE[active] && PAGE[active].accent) || "var(--c-purple)";
    const sanctuary = t.sanctuary && active === "dashboard";

    // palette
    const query = q.trim().toLowerCase();
    const pages = Object.values(PAGE).filter((p) => !query || p.label.toLowerCase().includes(query)).slice(0, 8)
      .map((p) => ({ id: "pg-" + p.id, name: p.label, icon: p.icon, accent: p.accent, go: () => go(p.id) }));
    const ags = AGENTS.filter((a) => !query || a.name.toLowerCase().includes(query) || a.role.toLowerCase().includes(query)).slice(0, 6)
      .map((a) => ({ id: "ag-" + a.id, name: `Talk to ${a.name}`, sub: a.role, icon: a.sigil, fac: a.fac, go: () => go("comms") }));
    const cmds = [
      { id: "c-theme", name: "Toggle light / dark", icon: "sun", go: toggleTheme },
      { id: "c-deploy", name: "Deploy gateway", icon: "gateway", go: () => fireToast({ text: "Gateway redeploy queued", kind: "ok" }) },
    ].filter((x) => !query || x.name.toLowerCase().includes(query));
    const sections = [];
    if (query) sections.push({ head: "Dispatch", items: [{ id: "run", name: `Run as Job — “${q}”`, icon: "dispatch", run: true, go: () => fireToast({ text: `Dispatched · job #${1800 + Math.floor(Math.random()*200)} → fleet`, sub: `“${q}”`, kind: "dispatch" }) }] });
    if (pages.length) sections.push({ head: "Go to page", items: pages });
    if (ags.length) sections.push({ head: "Operatives", items: ags });
    if (cmds.length) sections.push({ head: "Commands", items: cmds });
    const flat = sections.flatMap((s) => s.items);
    const run = (it) => { if (!it) return; setPal(false); it.go && it.go(); };
    const palKey = (e) => {
      if (e.key === "Escape") setPal(false);
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); run(flat[sel]); }
    };
    let ri = -1;

    return (
      <div className={"po-app" + (sanctuary ? " sanctuary-mode" : "")} ref={appRef} style={{ "--accent": accent }}>
        <div className="po-bg"><div className="po-aurora" /><div className="po-beams" /><div className="po-layer po-stars" /><div className="po-layer po-neb" /></div>
        <div className="po-rift" />

        {/* SIDEBAR */}
        <aside className="po-side">
          <div className="po-side-head">
            <Logo size={30} />
            <div><div className="nm">PARALLAX</div><div className="ver">OS v4 · COMMAND CENTER</div></div>
          </div>
          <nav className="po-nav po-scroll">
            {NAV.map((s) => {
              const open = openSec === s.label;
              const rollup = s.items.reduce((n, i) => n + (i.badge ? parseInt(i.badge) || 0 : 0), 0);
              const hasActive = s.items.some((i) => i.id === active);
              return (
                <div key={s.label} className={"po-nav-grp" + (open ? " open" : "")}>
                  <button className={"po-nav-sec" + (hasActive ? " has-active" : "")} onClick={() => setOpenSec(open ? "" : s.label)}>
                    <span className="po-nav-sec-lbl">{s.label}</span>
                    {!open && rollup > 0 && <span className="po-nav-sec-roll">{rollup}</span>}
                    <span className="po-nav-sec-chev"><Icon name="chevdown" size={13} /></span>
                  </button>
                  <div className="po-nav-items">
                    <div className="po-nav-items-inner">
                      {s.items.map((it) => (
                        <button key={it.id} className={"po-navitem" + (active === it.id ? " on" : "")} style={{ "--accent": it.accent }} onClick={() => go(it.id)} title={it.label}>
                          <span className="ic"><Icon name={it.icon} size={16} /></span>
                          <span className="lbl">{it.label}</span>
                          {it.badge && <span className="bdg">{it.badge}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="po-side-foot"><span>ATLAS v4 // 20 AGENTS</span><span className="po-foot-dot" /></div>
        </aside>

        {/* MAIN */}
        <div className="po-main">
          <header className="po-top">
            <button className="po-cmdbar" onClick={openPal}>
              <Icon name="search" size={16} style={{ color: "var(--accent)" }} />
              <span className="txt">Jump to anything · ask ATLAS · run a command</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="po-readouts">
              <div className="po-ro"><Icon name="agents" size={15} style={{ color: "var(--t-lo)" }} /><div><div className="lab">Agents</div><div className="val" style={{ color: "var(--c-purple-l)" }}><span className="po-livedot" style={{ background: "var(--c-purple-l)" }} />19/20</div></div></div>
              <div className="po-ro"><Icon name="gateway" size={15} style={{ color: "var(--t-lo)" }} /><div><div className="lab">Gateway</div><div className="val" style={{ color: "var(--c-green)" }}><span className="po-livedot" />ONLINE</div></div></div>
              <div className="po-ro"><Icon name="finance" size={15} style={{ color: "var(--t-lo)" }} /><div><div className="lab">MRR</div><div className="val" style={{ color: "var(--gold-l)" }}>$48.2k</div></div></div>
              <span className="po-clock tnum">{hh}:{mm}<span style={{ opacity: .4 }}>:{ss}</span></span>
              <button className="po-icbtn" onClick={toggleTheme} title="Toggle light / dark"><Icon name="sun" size={16} /></button>
              <button className="po-atlasbtn" onClick={() => go("comms")}>
                <div className="holo-orb" style={{ width: 26, height: 26 }}><span className="ring2" /><span className="sheen" /><span className="core" /></div>
                <span className="lab">Ask ATLAS</span>
              </button>
            </div>
          </header>

          {alerts.length > 0 && (
            <div className="po-alertbar" onClick={() => alerts[0].page && go(alerts[0].page)} title="Jump to source">
              <span className="po-alertbar-pulse" />
              <span className="po-alertbar-tag mono">⚠ {alerts.length} CRITICAL</span>
              <div className="po-alertbar-track">
                <div className="po-alertbar-scroll">
                  {[...alerts, ...alerts].map((a, i) => (
                    <span key={i} className="po-alertbar-item mono"><b>{a.label}</b> {a.value} · <span style={{ opacity: .7 }}>{a.pageLabel} · {a.serial}</span><span className="po-alertbar-dot" /></span>
                  ))}
                </div>
              </div>
              <span className="po-alertbar-cta mono">RESOLVE →</span>
            </div>
          )}

          <div className="po-view">
            {active === "dashboard" ? (sanctuary ? <window.SanctuaryView go={go} openPal={openPal} onExpand={() => setTweak("sanctuary", false)} onTheme={toggleTheme} /> : <window.CommandView go={go} />)
              : active === "comms" ? <window.CommsView reduced={reduced} setToast={fireToast} />
              : <window.PageView id={active} go={go} />}
          </div>
        </div>

        {/* PALETTE */}
        {pal && (
          <div className="po-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) setPal(false); }}>
            <div className="po-palette" onKeyDown={palKey}>
              <div className="po-pal-in"><Icon name="command" size={18} style={{ color: "var(--accent)" }} /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type intent — it gets done…" /><span className="kbd">ESC</span></div>
              <div className="po-pal-list po-scroll">
                {sections.map((s) => (
                  <div key={s.head}>
                    <div className="eyebrow po-pal-head">{s.head}</div>
                    {s.items.map((it) => {
                      ri++; const on = ri === sel; const idx = ri;
                      return (
                        <button key={it.id} className={"po-pal-item" + (on ? " on" : "") + (it.run ? " run" : "")} onMouseEnter={() => setSel(idx)} onClick={() => run(it)}>
                          <span style={{ color: it.fac || (it.run ? "var(--accent)" : it.accent || "var(--t-mid)"), display: "grid", placeItems: "center", width: 18 }}><Icon name={it.icon} size={16} /></span>
                          <span style={{ flex: 1, textAlign: "left", fontSize: 14, color: it.run ? "var(--accent)" : "var(--t-hi)" }}>{it.name}</span>
                          {it.sub && <span className="po-pal-grp">{it.sub}</span>}
                          {it.run && <span className="kbd">↵ dispatch</span>}
                          {on && !it.run && <span className="kbd">↵</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {!flat.length && <div style={{ padding: 22, textAlign: "center", color: "var(--t-lo)" }}>Press ↵ to run “{q}” as a job.</div>}
              </div>
              <div className="po-pal-foot"><span><b style={{ color: "var(--t-mid)" }}>↑↓</b> navigate</span><span><b style={{ color: "var(--t-mid)" }}>↵</b> select</span><span style={{ marginLeft: "auto", color: "var(--c-purple-l)" }}>● ATLAS listening</span></div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div className={"po-toast" + (toast.kind === "alert" ? " alert" : "")} style={toast.kind === "done" ? { borderColor: "var(--c-green)" } : null}>
            <span className="po-wave"><i /><i /><i /><i /></span>
            <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{toast.kind === "alert" ? "⚠ " : ""}{toast.text}</div>{toast.sub && <div className="mono" style={{ fontSize: 11, color: "var(--t-mid)", marginTop: 2 }}>{toast.sub}</div>}</div>
          </div>
        )}

        {/* CANOPY — living starship visor overlay */}
        <div className="canopy" aria-hidden="true">
          <div className="cnp-sweep" />
          <div className="cnp-grain" />
          <div className="cnp-vig" />
          <div className="cnp-frame" />
          <span className="cnp-corner tl" /><span className="cnp-corner tr" /><span className="cnp-corner bl" /><span className="cnp-corner br" />
          <div className="cnp-ticks top" /><div className="cnp-ticks bot" />
          <div className="cnp-readout">PARALLAX OS · CANOPY LINK STABLE · ATLAS ONLINE</div>
        </div>

        {/* TWEAKS */}
        <TweaksPanel title="Tweaks">
          <TweakSection label="Form" />
          <TweakToggle label="Sanctuary (simplified)" value={t.sanctuary} onChange={(v) => setTweak("sanctuary", v)} />
          <TweakToggle label="Sound cues" value={t.sound} onChange={(v) => { setTweak("sound", v); if (v && window.poSound) window.poSound.play("open"); }} />
          <TweakSection label="Atmosphere" />
          <TweakToggle label="Canopy atmosphere" value={t.atmosphere} onChange={(v) => setTweak("atmosphere", v)} />
          <TweakToggle label="Iridescent foil" value={t.holo} onChange={(v) => setTweak("holo", v)} />
          <TweakSlider label="Echo displacement" value={t.echo} min={0} max={12} step={1} unit="px" onChange={(v) => setTweak("echo", v)} />
          <TweakSection label="Motion" />
          <TweakToggle label="Breathing motion" value={t.motion} onChange={(v) => setTweak("motion", v)} />
          <TweakToggle label="Diagonal rift" value={t.rift} onChange={(v) => setTweak("rift", v)} />
        </TweaksPanel>
        {/* IGNITION SEQUENCE */}
        {booting && <BootSequence />}
      </div>
    );
  }

  function BootSequence() {
    const agents = (window.PO_DATA && window.PO_DATA.AGENTS) || [];
    const online = agents.filter((a) => a.status !== "idle").length;
    const idle = agents.length - online;
    const busy = agents.filter((a) => a.status === "busy").length;
    const LINES = [
      "PARALLAX OS v4 · KERNEL HANDSHAKE … OK",
      "MOUNTING NAV-COM v4.1408 … OK",
      `SPINNING UP FLEET · ${agents.length} OPERATIVES … ${online} ONLINE`,
      `GATEWAY LINK · CLOUDFLARE TUNNEL … OK`,
      busy > 0 ? `${busy} AGENTS WORKING · ${idle} IDLE · ATLAS AWAKE` : "ATLAS ORCHESTRATOR … AWAKE",
    ];
    return (
      <div className="po-boot" role="status" aria-label="System ignition">
        <div className="po-boot-scan" />
        <div className="po-boot-core">
          <span className="po-boot-ring r1" /><span className="po-boot-ring r2" /><span className="po-boot-ring r3" />
          <span className="po-boot-orb"><Logo size={48} /></span>
          <span className="po-boot-cross h" /><span className="po-boot-cross v" />
        </div>
        <div className="po-boot-title">PARALLAX <span>OS v4</span></div>
        <div className="po-boot-sub mono">COMMAND CENTER · IGNITION SEQUENCE</div>
        <div className="po-boot-log mono">
          {LINES.map((l, i) => <div key={i} className="po-boot-line" style={{ animationDelay: (0.35 + i * 0.42) + "s" }}>{l}</div>)}
        </div>
        <div className="po-boot-bar"><span /></div>
        <div className="po-boot-skip mono">PRESS ANY KEY TO SKIP</div>
      </div>
    );
  }

  try { const s = localStorage.getItem("po-theme"); if (s) document.documentElement.setAttribute("data-po-theme", s); } catch (e) {}
  ReactDOM.createRoot(document.getElementById("root")).render(<Shell />);
})();
