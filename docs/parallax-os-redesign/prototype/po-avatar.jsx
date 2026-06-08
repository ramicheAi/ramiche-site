/* ================================================================
   PARALLAX OS — Avatar: Galactik Antics character face token.
   Pixar-style face crop, per-character framing. Faction ring,
   cyan glint, status pip. window.PO.Avatar({ agent, size, bob, pip })
   ================================================================ */
(function () {
  // per-character face framing: [ posX%, posY% (head center), zoom ]
  const FRAME = {
    1:  [50, 23, 1.7],
    2:  [50, 21, 1.7],
    3:  [50, 30, 1.7],
    4:  [50, 17, 1.75],
    5:  [50, 21, 1.7],
    6:  [50, 23, 1.7],
    7:  [50, 19, 1.7],
    8:  [50, 29, 1.7],
    9:  [50, 15, 1.8],
    10: [52, 23, 1.7],
  };

  function Avatar({ agent, size = 44, bob = true, pip = false }) {
    if (!agent) return null;
    const fac = agent.fac || "var(--c-cyan)";
    const n = agent.char || 1;
    const [fx, fy, zoom] = FRAME[n] || [50, 20, 1.7];
    const src = "public/assets/characters/" + n + ".png";
    return (
      <span className={"av3d" + (bob ? " bob" : "")} style={{ fontSize: size + "px", "--fac": fac }}>
        <span className="av-aura" />
        <span className="av-token">
          <img className="av-photo" src={src} alt={agent.name} loading="lazy"
            style={{ objectPosition: fx + "% " + fy + "%", transform: "scale(" + zoom + ")", transformOrigin: fx + "% " + fy + "%" }} />
          <span className="av-sheen" />
          <span className="av-glint" />
        </span>
        {pip && agent.status && <span className={"av-pip " + agent.status} />}
      </span>
    );
  }

  window.PO.Avatar = Avatar;
})();
