/* ================================================================
   PARALLAX OS — brand: real logo (holographic mask) + bespoke
   geometric icon family covering every page & agent. window.PO
   ================================================================ */
(function () {
  // real Parallax mark, rendered as a holographic mask (ratio ~0.88)
  function Logo({ size = 30, style }) {
    return <div className="po-logomark" style={{ width: Math.round(size * 0.88), height: size, ...style }} aria-label="Parallax" role="img" />;
  }

  const I = {
    // operations
    dashboard: <g><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><circle cx="17" cy="17" r="3.6"/></g>,
    comms: <g><path d="M4 5.5h16v10H11l-4 3.5V15.5H4z"/><path d="M8 9h8M8 12h5"/></g>,
    gallery: <g><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="M4 17l5-4 4 3 3-2.5 4 3.5"/></g>,
    agents: <g><circle cx="8" cy="8.5" r="3"/><path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="7" r="2.2"/><path d="M15 18.5c0-2.4 1.4-4 3.5-4 1.3 0 2.4.6 3 1.6"/></g>,
    tasks: <g><path d="M4 6.5h12M4 12h12M4 17.5h7"/><path d="M19.5 5.5 21 7l-2.5 2.5"/><circle cx="20" cy="16.5" r="2"/></g>,
    health: <g><path d="M2.5 12h4l2.5-6 4 13 2.5-7H21.5"/></g>,
    security: <g><path d="M12 2.5 20 5.5v6c0 4.2-3 7-8 9-5-2-8-4.8-8-9v-6z"/><path d="M9 11.5l2 2 4-4.5"/></g>,
    shield: <g><path d="M12 2.5 20 5.5v6c0 4.2-3 7-8 9-5-2-8-4.8-8-9v-6z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3.5"/></g>,
    bolt: <g><path d="M13 2.5 5 13h5l-1 8.5L17 11h-5z"/></g>,
    nerve: <g><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="M6.3 7.1 10 10.5M17.7 7.1 14 10.5M6.3 16.9 10 13.5M17.7 16.9 14 13.5"/></g>,
    settings: <g><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6"/></g>,
    // business
    finance: <g><path d="M12 4v16M9 7.5h4.2a2.3 2.3 0 0 1 0 4.6H10a2.3 2.3 0 0 0 0 4.6h4.6"/></g>,
    arbitrage: <g><path d="M5 7h10l-3-3M19 17H9l3 3"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></g>,
    sales: <g><path d="M4 17l5-5 3.2 3.2L20 8"/><path d="M20 8h-3.4M20 8v3.4"/></g>,
    proposals: <g><path d="M6 3.5h8L18 7.5V20.5H6z"/><path d="M14 3.5V7.5h4M9 12h6M9 15.5h4"/></g>,
    legal: <g><path d="M12 3.5v17M5 8.5h14"/><path d="M5 8.5 3 14h4zM19 8.5 17 14h4z"/><path d="M3 14a2 2 0 0 0 4 0M17 14a2 2 0 0 0 4 0"/></g>,
    strategy: <g><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></g>,
    observatory: <g><circle cx="12" cy="11" r="7"/><circle cx="12" cy="11" r="2.6"/><path d="M7 18.5 5 22M17 18.5 19 22"/></g>,
    reports: <g><path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="2.6" height="5"/><rect x="12" y="8" width="2.6" height="9"/><rect x="17" y="5" width="2.6" height="12"/></g>,
    // creative
    content: <g><path d="M5 19.5 4 21l1.5-1M5.5 19 16 8.5l-2.5-2.5L3 16.5 4.5 18.5z"/><path d="M14.5 6 17 3.5 19.5 6 17 8.5z"/></g>,
    studio: <g><circle cx="8" cy="17" r="2.5"/><path d="M10.5 17V6l9-2v9"/><circle cx="17" cy="13" r="2.5"/></g>,
    builder: <g><path d="M12 3.5 20 8v8l-8 4.5L4 16V8z"/><path d="M4 8l8 4.5L20 8M12 12.5V20"/></g>,
    // specialist
    wellness: <g><path d="M12 20s-7-4.3-7-9.5A3.7 3.7 0 0 1 12 7a3.7 3.7 0 0 1 7 3.5C19 15.7 12 20 12 20z"/></g>,
    fabrication: <g><path d="M5 19h14M7 19v-4.5M17 19v-4.5"/><path d="M6 9.5 12 5l6 4.5-6 3z"/></g>,
    // workspace
    projects: <g><path d="M4 7.5a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></g>,
    memory: <g><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3.5v2.5M15 3.5v2.5M9 18v2.5M15 18v2.5M3.5 9H6M3.5 15H6M18 9h2.5M18 15h2.5"/><rect x="10" y="10" width="4" height="4" rx="1"/></g>,
    calendar: <g><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8 3.5v3M16 3.5v3"/></g>,
    docs: <g><path d="M5 4.5h9L19 9V19.5H5z"/><path d="M14 4.5V9h5M8 12.5h8M8 15.5h5"/></g>,
    office: <g><rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8 7h3M13 7h3M8 11h3M13 11h3M8 15h3M13 15h3"/></g>,
    mettle: <g><path d="M12 2.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16l-5.3 2.9 1.2-6L3.4 8.8l6-.7z"/></g>,
    nexus: <g><circle cx="12" cy="12" r="2"/><circle cx="5" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/><path d="m6 6 4.6 4.6M18 6l-4.6 4.6M6 18l4.6-4.6M18 18l-4.6-4.6"/></g>,
    atlas: <g><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></g>,
    // ui
    command: <g><path d="M9 6.5a2.5 2.5 0 1 0-2.5 2.5H9zm0 0v11m0-11h6m-6 11a2.5 2.5 0 1 1-2.5-2.5H9zm6-11a2.5 2.5 0 1 1 2.5 2.5H15zm0 0v11m0 0a2.5 2.5 0 1 0 2.5-2.5H15z" transform="translate(2.4 2.4) scale(0.8)"/></g>,
    search: <g><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></g>,
    send: <g><path d="M4 11.5 20 4l-7 16-2.5-6.5z"/><path d="M10.5 13.5 20 4"/></g>,
    mic: <g><rect x="9.5" y="3" width="5" height="11" rx="2.5"/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3.5M9 21h6"/></g>,
    attach: <g><path d="M19 11.5 12.5 18a4 4 0 0 1-5.7-5.7l7-7a2.6 2.6 0 0 1 3.7 3.7l-7 7a1.2 1.2 0 0 1-1.7-1.7l6.3-6.3"/></g>,
    plus: <g><path d="M12 5v14M5 12h14"/></g>,
    close: <g><path d="M6 6l12 12M18 6 6 18"/></g>,
    chevron: <g><path d="M9 6l6 6-6 6"/></g>,
    chevdown: <g><path d="M6 9l6 6 6-6"/></g>,
    sun: <g><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></g>,
    clock: <g><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></g>,
    gateway: <g><path d="M5 9a7 7 0 0 1 14 0"/><path d="M8 11.5a4 4 0 0 1 8 0"/><circle cx="12" cy="14.5" r="1.3" fill="currentColor" stroke="none"/></g>,
    pulse: <g><path d="M2 12h4l2.5-6 4 13 2.5-7H22"/></g>,
    check: <g><path d="M4 12.5 9.5 18 20 6.5"/></g>,
    spark: <g><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></g>,
    dispatch: <g><path d="M4 12 20 5l-3.4 15-4-6z"/><path d="M12.6 14 20 5"/></g>,
    hash: <g><path d="M6 9h13M5 15h13M10 4 8 20M16 4l-2 16"/></g>,
    pin: <g><path d="M9 3.5h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 14.5V21"/></g>,
    dot: <g><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></g>,
  };

  function Icon({ name, size = 20, stroke = 1.6, style, className }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
        {I[name] || I.dot}
      </svg>
    );
  }
  const Sigil = (p) => Icon(p); // agents reference icon names

  window.PO = { Logo, Icon, Sigil };
})();
