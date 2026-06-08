/* ================================================================
   PARALLAX OS — TRANSMISSIONS CONSOLE (The Expanse / Agatha King)
   Channel strip · priority message tables · FLAG/EDIT/ARCHIVE ·
   transmission detail. window.TransmissionsConsole({ active })
   ================================================================ */
(function () {
  const { useState } = React;
  const { Icon } = window.PO;

  const PRI = {
    flash:   { lab: "FLASH",   c: "var(--c-rose)" },
    urgent:  { lab: "URGENT",  c: "var(--c-amber)" },
    routine: { lab: "ROUTINE", c: "var(--c-cyan)" },
    archive: { lab: "ARCHIVE", c: "var(--t-lo)" },
  };

  const INCOMING = [
    { pri: "flash",   sender: "PROXIMON", id: "014.688.4642.45", desc: "412 leads scored — 18 hot, action requested", t: "23:31" },
    { pri: "urgent",  sender: "TRIAGE",   id: "012.277.9659.44", desc: "Retry storm 03:14 — auto-healed, log attached", t: "23:18" },
    { pri: "routine", sender: "LEDGER",   id: "012.538.4234.45", desc: "MRR reconciled — $48.2k, +6% w/w", t: "22:40" },
    { pri: "routine", sender: "SHURI",    id: "012.538.2069.42", desc: "Template compiler v2 shipped to edge", t: "22:05" },
    { pri: "urgent",  sender: "SENTRY",   id: "014.659.2445.41", desc: "3 agent certs re-signed — review queue", t: "21:50" },
    { pri: "routine", sender: "NEXUS",    id: "006.546.4745.40", desc: "Linear + Slack bridges online (12 total)", t: "20:32" },
    { pri: "routine", sender: "VEE",      id: "014.678.2867.39", desc: "Helios launch copy drafted — sign-off?", t: "19:46" },
    { pri: "archive", sender: "ORACLE",   id: "006.345.3463.38", desc: "Weekly signal forecast — nominal", t: "18:03" },
  ];
  const OUTGOING = [
    { pri: "flash",   sender: "ATLAS → PROXIMON", id: "014.688.4642.45", desc: "Draft outreach to Helios — brief the play", t: "23:33" },
    { pri: "routine", sender: "ATLAS → VEE",      id: "014.688.4642.45", desc: "Approve launch copy, schedule for 09:00", t: "23:34" },
    { pri: "urgent",  sender: "ATLAS → SENTRY",   id: "014.688.4642.45", desc: "Confirm cert review before deploy window", t: "23:35" },
    { pri: "routine", sender: "ATLAS → LEDGER",   id: "014.688.4642.45", desc: "Lock the week — push board summary", t: "23:36" },
  ];

  const CHANNELS = [
    ["F1", "#general", true], ["F2", "#mettle", true], ["F3", "#verified", false], ["F4", "#launch", true],
    ["F5", "TIGHT-BEAM", true], ["F6", "RELAY-A", false], ["F7", "WIDE-BEAM", true], ["F8", "EMERGENCY", false],
  ];

  function Table({ title, serial, rows, actions }) {
    const [sel, setSel] = useState(0);
    return (
      <section className="tx-panel">
        <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
        <div className="tx-seg-head">
          <span className="tx-seg-id">{serial}</span>
          <span className="tx-seg-title">{title}</span>
          <span className="tx-seg-count">{rows.length} REC</span>
        </div>
        <div className="tx-table">
          <div className="tx-thead">
            <span className="c-pri">PRI</span><span className="c-snd">SENDER ID</span><span className="c-id">COMM ID</span><span className="c-desc">DESCRIPTION</span><span className="c-t">TIME</span>
          </div>
          <div className="tx-rows po-scroll">
            {rows.map((r, i) => (
              <div key={i} className={"tx-row" + (sel === i ? " on" : "")} onClick={() => setSel(i)} style={{ "--pc": PRI[r.pri].c }}>
                <span className="c-pri"><i className="tx-dot" /></span>
                <span className="c-snd">{r.sender}</span>
                <span className="c-id mono">{r.id}</span>
                <span className="c-desc">{r.desc}</span>
                <span className="c-t mono">{r.t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tx-actions">
          {actions.map((a) => <button key={a} className="tx-act">{a}</button>)}
          <span className="tx-act-status">CH READY <i /></span>
        </div>
      </section>
    );
  }

  function TransmissionsConsole({ active }) {
    const detail = INCOMING[0];
    return (
      <div className="tx-console">
        <div className="tx-statusbar mono">
          <span>PARALLAX NAV-COM v4.1408</span>
          <span className="sep" />
          <span style={{ color: "var(--c-green)" }}>SYSTEM READY</span>
          <span className="sep" />
          <span>LINK · {active && active.name ? active.name.toUpperCase() : "ALL"}</span>
          <span style={{ marginLeft: "auto" }}>0x150B4A : 0x0A6AFC</span>
        </div>

        <div className="tx-grid">
          {/* LEFT — channel strip + detail */}
          <div className="tx-left">
            <section className="tx-panel tx-strip">
              <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
              <div className="tx-seg-head"><span className="tx-seg-id">UFCC·01A0405</span><span className="tx-seg-title">CHANNELS</span></div>
              <div className="tx-chgrid">
                {CHANNELS.map(([f, n, on]) => (
                  <button key={f} className={"tx-ch" + (on ? " on" : "")}>
                    <span className="tx-ch-f mono">{f}</span>
                    <span className="tx-ch-n">{n}</span>
                    <span className="tx-ch-led" />
                  </button>
                ))}
              </div>
              <div className="tx-scan"><span className="mono">SCAN</span><div className="tx-scanbar"><i /></div></div>
            </section>

            <section className="tx-panel tx-detail">
              <span className="inst-cnr tl" /><span className="inst-cnr tr" /><span className="inst-cnr bl" /><span className="inst-cnr br" />
              <div className="tx-detail-head mono">INCOMING TRANSMISSION</div>
              <div className="tx-detail-grid mono">
                <span className="k">PRIORITY</span><span className="v" style={{ color: PRI[detail.pri].c }}>{PRI[detail.pri].lab}</span>
                <span className="k">SENDER</span><span className="v">{detail.sender}</span>
                <span className="k">COMM ID</span><span className="v">{detail.id}</span>
                <span className="k">RECEIVED</span><span className="v">TODAY · {detail.t}</span>
              </div>
              <div className="tx-detail-body">{detail.desc}.</div>
              <div className="tx-detail-acts">
                <button className="tx-act primary">RESPOND</button>
                <button className="tx-act">FLAG</button>
                <button className="tx-act">ARCHIVE</button>
              </div>
            </section>
          </div>

          {/* RIGHT — incoming + outgoing tables */}
          <div className="tx-right">
            <Table title="INCOMING MESSAGES" serial="USCM·01A0032" rows={INCOMING} actions={["FLAG", "EDIT", "ARCHIVE"]} />
            <Table title="OUTGOING MESSAGES" serial="USCM·01A0032" rows={OUTGOING} actions={["RESEND", "EDIT", "ARCHIVE"]} />
          </div>
        </div>
      </div>
    );
  }

  window.TransmissionsConsole = TransmissionsConsole;
})();
