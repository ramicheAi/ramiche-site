/* ================================================================
   PARALLAX OS — SANCTUARY view. window.SanctuaryView({ go, openPal })
   One throne. A constellation of domains. The Word. Vast stillness.
   ================================================================ */
(function () {
  const { useRef, useEffect, useState } = React;
  const { Logo, Icon } = window.PO;
  const { VITALS } = window.PO_DATA;

  // six primary domains orbit the throne (everything else via the Word/⌘K)
  const STARS = [
    { id: "comms", label: "Comms", fac: "var(--c-purple-l)", x: 50, y: 23, ct: "12 unread" },
    { id: "agents", label: "Agents", fac: "var(--c-green)", x: 73, y: 33, ct: "19 online" },
    { id: "finance", label: "Finance", fac: "var(--gold)", x: 70, y: 62, ct: "$48.2k" },
    { id: "observatory", label: "Observatory", fac: "var(--c-violet)", x: 50, y: 69, ct: "6 signals" },
    { id: "tasks", label: "Tasks", fac: "var(--c-amber)", x: 30, y: 62, ct: "7 live" },
    { id: "builder", label: "App Builder", fac: "var(--c-cyan)", x: 27, y: 33, ct: "ready" },
  ];

  // the truths, woven into one quiet line (not floating boxes)
  const TRUTHS = [["19/20", "online"], ["$48.2k", "MRR"], ["7", "jobs"], ["23", "shipped"]];

  function SanctuaryView({ go, openPal, onExpand, onTheme }) {
    const ref = useRef(null);
    const reduced = useRef(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches).current;

    useEffect(() => {
      if (reduced) return;
      const el = ref.current; if (!el) return;
      let raf = 0;
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { el.style.setProperty("--sx", x.toFixed(3)); el.style.setProperty("--sy", y.toFixed(3)); });
      };
      el.addEventListener("mousemove", onMove);
      return () => { el.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
    }, [reduced]);

    return (
      <div className="sanc" ref={ref}>
        <div className="sanc-field" />

        {/* minimal corner: theme + expand to full command center */}
        <div className="sanc-corner">
          <button className="po-icbtn" onClick={onTheme} title="Toggle light / dark"><Icon name="sun" size={16} /></button>
          <button className="po-icbtn" onClick={onExpand} title="Expand to full Command Center"><Icon name="dashboard" size={16} /></button>
        </div>

        {/* DIRECTIVE — the state of all things, in one breath */}
        <div className="sanc-top">
          <div className="sanc-eyebrow">Parallax OS · Sanctuary</div>
          <div className="sanc-status"><span className="dot" /> All systems nominal · the fleet is at peace</div>
          <div className="sanc-truths">
            {TRUTHS.map(([v, l], i) => (
              <React.Fragment key={l}>
                {i > 0 && <span className="sep" />}
                <span className="t"><b className="tnum">{v}</b> {l}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* CONSTELLATION — navigation as points of light */}
        <div className="sanc-constellation">
          {STARS.map((s) => (
            <div key={s.id} className="sanc-star" style={{ left: s.x + "%", top: s.y + "%", "--fac": s.fac }} onClick={() => go(s.id)} title={s.label}>
              <span className="pt" />
              <span className="lbl">{s.label}</span>
              <span className="ct">{s.ct}</span>
            </div>
          ))}
        </div>

        {/* THE THRONE — now an Iron Man targeting reticle */}
        <div className="sanc-throne">
          <div className="sanc-rays" />
          <div className="sanc-halo" />

          {/* targeting reticle: brackets · crosshair · segmented arcs · telemetry */}
          <div className="sanc-reticle">
            <span className="sanc-cross h" /><span className="sanc-cross v" />
            <span className="sanc-brk tl" /><span className="sanc-brk tr" /><span className="sanc-brk bl" /><span className="sanc-brk br" />
            <span className="sanc-tele t">TARGET · ATLAS // LOCK</span>
            <span className="sanc-tele l">AXIS·0</span>
            <span className="sanc-tele r">AXIS·1</span>
          </div>

          <div className="sanc-ring r3" />
          <div className="sanc-ring r1" />
          <div className="sanc-arc a1" />
          <div className="sanc-arc a2" />
          <div className="sanc-ring ticks" />
          <div className="sanc-ring r2" />
          <div className="sanc-core" onClick={() => go("comms")} title="Commune with ATLAS">
            <span className="sanc-core-glint" />
          </div>
        </div>

        {/* THE WORD — speak, and it is done */}
        <div className="sanc-bottom">
          <div className="sanc-directive">
            <b>Helios Robotics</b> is hot and matches three signals — speak, and it is done.
          </div>
          <div className="sanc-word" onClick={openPal}>
            <span className="orb"><Icon name="command" size={18} /></span>
            <span className="ph">Speak intent — name a place, an operative, a command…</span>
            <span className="kbd">⌘K</span>
          </div>
        </div>
      </div>
    );
  }

  window.SanctuaryView = SanctuaryView;
})();
