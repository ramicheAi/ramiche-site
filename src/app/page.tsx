export default function Home() {
  const navLinks = [
    { label: "HQ", href: "/", active: true },
    { label: "Command Center", href: "/command-center", active: false },
    { label: "Apex Athlete", href: "/apex-athlete", active: false },
    { label: "Studio", href: "/studio", active: false },
  ];

  const portals = [
    {
      title: "Command Center",
      description: "Mission control for all operations",
      href: "/command-center",
      accent: "cyan" as const,
      icon: "\u25C8",
      status: "ONLINE",
    },
    {
      title: "Apex Athlete",
      description: "Gamified swim training system",
      href: "/apex-athlete",
      accent: "purple" as const,
      icon: "\u2726",
      status: "ACTIVE",
    },
    {
      title: "Ramiche Studio",
      description: "Creative direction for the bold",
      href: "/studio",
      accent: "gold" as const,
      icon: "\u2662",
      status: "LIVE",
    },
  ];

  const brands = [
    { name: "RAMICHE", role: "Operations HQ" },
    { name: "Galactik Antics", role: "Product line" },
    { name: "Parallax", role: "Music Label" },
    { name: "BabaTruNoyz", role: "Audio Division" },
    { name: "Saint Andrew\u2019s", role: "Aquatics program" },
  ];

  const stats = [
    { label: "Active Projects", value: "7", accent: "cyan" as const },
    { label: "Tasks Shipped", value: "52", accent: "purple" as const },
    { label: "Agents Online", value: "17", accent: "gold" as const },
  ];

  const accentColors = {
    cyan: {
      border: "border-[#00f0ff]/30",
      borderHover: "hover:border-[#00f0ff]/60",
      bg: "bg-[#00f0ff]/5",
      bgHover: "hover:bg-[#00f0ff]/10",
      text: "text-[#00f0ff]",
      shadow: "hover:shadow-[0_0_30px_rgba(0,240,255,0.15)]",
      glow: "rgba(0,240,255,0.4)",
      statusBg: "bg-[#00f0ff]/10",
      barBg: "bg-[#00f0ff]",
      dotBg: "bg-[#00f0ff]",
    },
    purple: {
      border: "border-[#a855f7]/30",
      borderHover: "hover:border-[#a855f7]/60",
      bg: "bg-[#a855f7]/5",
      bgHover: "hover:bg-[#a855f7]/10",
      text: "text-[#a855f7]",
      shadow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
      glow: "rgba(168,85,247,0.4)",
      statusBg: "bg-[#a855f7]/10",
      barBg: "bg-[#a855f7]",
      dotBg: "bg-[#a855f7]",
    },
    gold: {
      border: "border-[#f59e0b]/30",
      borderHover: "hover:border-[#f59e0b]/60",
      bg: "bg-[#f59e0b]/5",
      bgHover: "hover:bg-[#f59e0b]/10",
      text: "text-[#f59e0b]",
      shadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
      glow: "rgba(245,158,11,0.4)",
      statusBg: "bg-[#f59e0b]/10",
      barBg: "bg-[#f59e0b]",
      dotBg: "bg-[#f59e0b]",
    },
  };

  return (
    <main className="relative min-h-screen bg-[#06020f] text-white overflow-hidden">
      {/* ── animated background nebulae ─────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="nebula-1 absolute rounded-full blur-3xl"
          style={{
            width: "600px",
            height: "600px",
            top: "-10%",
            left: "-5%",
            background: "radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="nebula-2 absolute rounded-full blur-3xl"
          style={{
            width: "500px",
            height: "500px",
            top: "30%",
            right: "-10%",
            background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="nebula-3 absolute rounded-full blur-3xl"
          style={{
            width: "400px",
            height: "400px",
            bottom: "5%",
            left: "20%",
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
          }}
        />
        <div
          className="nebula-drift absolute rounded-full blur-3xl"
          style={{
            width: "700px",
            height: "700px",
            top: "50%",
            left: "40%",
            background: "radial-gradient(circle, rgba(0,240,255,0.04) 0%, rgba(168,85,247,0.03) 50%, transparent 70%)",
          }}
        />
        {/* scan line overlay */}
        <div
          className="scan-line absolute left-0 w-full h-px"
          style={{ background: "rgba(0,240,255,0.1)" }}
        />
        {/* data grid subtle overlay */}
        <div className="data-grid-bg absolute inset-0 opacity-30" />
      </div>

      {/* ── HUD navigation bar ─────────────────────────────────── */}
      <nav className="relative z-10 border-b border-white/5 bg-[#06020f]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="neon-text-cyan text-sm font-bold tracking-widest">RAMICHE</span>
              <span className="text-white/20 text-xs">|</span>
              <span className="text-white/30 text-[10px] tracking-wider uppercase">Systems HQ</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`game-btn px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    link.active
                      ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── hero section ───────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-24 pb-16 px-4 sm:pt-32 sm:pb-20">
        {/* top kicker */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#00f0ff]/50" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-[#00f0ff]/60 font-medium">
            Systems Online
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#00f0ff]/50" />
        </div>

        {/* massive animated gradient title */}
        <h1
          className="animated-gradient-text text-5xl sm:text-8xl md:text-9xl font-black tracking-tight text-center leading-none bg-clip-text text-transparent select-none"
          style={{
            backgroundImage: "linear-gradient(135deg, #00f0ff 0%, #a855f7 40%, #f59e0b 70%, #00f0ff 100%)",
            backgroundSize: "200% 200%",
            WebkitBackgroundClip: "text",
            filter: "drop-shadow(0 0 40px rgba(0,240,255,0.2)) drop-shadow(0 0 80px rgba(168,85,247,0.1))",
          }}
        >
          RAMICHE
        </h1>

        {/* tagline */}
        <p className="mt-6 text-lg sm:text-xl text-white/50 tracking-wide text-center font-light">
          Systems builder. Culture creator.
        </p>

        {/* decorative bar */}
        <div className="mt-8 flex items-center gap-3">
          <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-[#00f0ff]/30 to-transparent" />
          <div className="w-1.5 h-1.5 rotate-45 bg-[#00f0ff]/40" />
          <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-[#a855f7]/30 to-transparent" />
          <div className="w-1.5 h-1.5 rotate-45 bg-[#a855f7]/40" />
          <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-[#f59e0b]/30 to-transparent" />
        </div>
      </section>

      {/* ── portal cards ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
          <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">
            Mission Portals
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[#00f0ff]/20 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const colors = accentColors[portal.accent];
            return (
              <a
                key={portal.href}
                href={portal.href}
                className={`game-panel game-panel-border group relative flex flex-col ${colors.bg} ${colors.bgHover} border ${colors.border} ${colors.borderHover} ${colors.shadow} p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1`}
              >
                {/* scan sweep on hover */}
                <div className="scan-sweep absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* status badge */}
                <div className="flex items-center justify-between mb-5">
                  <span className={`${colors.text} text-2xl`}>{portal.icon}</span>
                  <span
                    className={`${colors.statusBg} ${colors.text} text-[10px] tracking-widest font-bold px-2.5 py-1 rounded-sm uppercase`}
                  >
                    {portal.status}
                  </span>
                </div>

                {/* title */}
                <h3 className={`text-xl font-bold ${colors.text} mb-2 tracking-wide`}>
                  {portal.title}
                </h3>

                {/* description */}
                <p className="text-sm text-white/40 leading-relaxed mb-6">
                  {portal.description}
                </p>

                {/* bottom bar */}
                <div className="flex items-center gap-2">
                  <div className={`h-0.5 flex-1 ${colors.barBg} opacity-20 group-hover:opacity-40 transition-opacity`} />
                  <span className={`text-[10px] ${colors.text} opacity-50 group-hover:opacity-100 tracking-widest uppercase transition-opacity`}>
                    Enter
                  </span>
                  <span className={`${colors.text} text-xs opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`}>
                    &rarr;
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* ── quick stats ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="game-panel game-panel-border bg-white/[0.02] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
            <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">
              System Telemetry
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {stats.map((stat) => {
              const colors = accentColors[stat.accent];
              return (
                <div
                  key={stat.label}
                  className={`relative border ${colors.border} ${colors.bg} rounded-sm p-5`}
                >
                  <div className="text-[10px] tracking-widest uppercase text-white/30 mb-2">
                    {stat.label}
                  </div>
                  <div className={`text-3xl sm:text-4xl font-black ${colors.text} tracking-tight tabular-nums`}>
                    {stat.value}
                  </div>
                  {/* decorative corner */}
                  <div
                    className={`absolute top-0 right-0 w-4 h-4 border-t border-r ${colors.border} opacity-50`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── brand ecosystem ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/20 to-transparent" />
          <h2 className="text-xs tracking-[0.25em] uppercase text-white/30 font-medium">
            Brand Ecosystem
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[#a855f7]/20 to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {brands.map((brand, i) => {
            const accentOrder = ["cyan", "gold", "purple", "cyan", "purple"] as const;
            const accent = accentOrder[i];
            const colors = accentColors[accent];
            return (
              <div
                key={brand.name}
                className={`game-panel-sm relative border ${colors.border} ${colors.bg} p-4 text-center transition-all duration-300 hover:border-opacity-60`}
              >
                <div className={`${colors.dotBg} w-1.5 h-1.5 rounded-full mx-auto mb-3 opacity-60`} />
                <div className="text-sm font-bold text-white/80 tracking-wide mb-1">
                  {brand.name}
                </div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">
                  {brand.role}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── XP progress bar (decorative) ───────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center gap-4">
          <span className="text-[10px] tracking-widest uppercase text-white/20">SYS</span>
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden xp-bar-segments">
            <div className="xp-shimmer h-full rounded-full" style={{ width: "71%" }} />
          </div>
          <span className="neon-text-cyan text-[10px] tracking-wider font-bold">LVL 7</span>
        </div>
      </section>

      {/* ── footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 bg-[#06020f]/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="neon-text-cyan text-xs font-bold tracking-widest">RAMICHE</span>
              <span className="text-white/10">|</span>
              <span className="text-white/20 text-[10px] tracking-wider">Operations Hub</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/command-center" className="text-[10px] text-white/20 hover:text-[#00f0ff]/60 tracking-wider uppercase transition-colors">
                Command Center
              </a>
              <a href="/apex-athlete" className="text-[10px] text-white/20 hover:text-[#a855f7]/60 tracking-wider uppercase transition-colors">
                Apex Athlete
              </a>
              <a href="/studio" className="text-[10px] text-white/20 hover:text-[#f59e0b]/60 tracking-wider uppercase transition-colors">
                Studio
              </a>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/15 tracking-widest uppercase">
              &copy; 2026 Ramiche Operations
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
