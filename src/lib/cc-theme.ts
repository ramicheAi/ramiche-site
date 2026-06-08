/* ============================================================================
 * PARALLAX OS — cc-theme.ts
 * Single source of truth for the Command Center visual system.
 * Drop into src/lib/cc-theme.ts and import the CSS-var injector once in
 * src/app/command-center/layout.tsx (see <ApplyTheme/> note at bottom).
 *
 * This mirrors the design built in the HTML prototype (Parallax OS.html):
 * purple #7c3aed primary, gold #C9A84C secondary, per-section accent colors,
 * near-black surfaces, holographic/instrument language. Light + dark.
 * ========================================================================== */

export type Theme = "dark" | "light";

/* ---- faction / section accent spectrum (stable across themes) ---- */
export const ACCENTS = {
  purple:  "#7c3aed", purpleL: "#a855f7",
  gold:    "#C9A84C", goldL:   "#e6c668",
  pink:    "#ec4899", green:   "#34d399", amber: "#f59e0b",
  cyan:    "#22d3ee", red:     "#ef4444", indigo:"#818cf8",
  teal:    "#14b8a6", rose:    "#f472b6", orange:"#f97316",
  sky:     "#38bdf8", fuchsia: "#c084fc", violet:"#9b5de5",
} as const;

/* ---- per-section accent assignment (matches the sidebar) ---- */
export const SECTION_ACCENT: Record<string, keyof typeof ACCENTS> = {
  dashboard: "gold", comms: "purple", gallery: "pink", agents: "green",
  tasks: "amber", health: "cyan", security: "red", yolo: "amber",
  nerve: "purple", settings: "indigo", finance: "gold", arbitrage: "gold",
  sales: "amber", proposals: "amber", legal: "indigo", strategy: "violet",
  observatory: "violet", reports: "amber", content: "fuchsia", studio: "amber",
  builder: "cyan", wellness: "teal", fabrication: "teal", projects: "indigo",
  memory: "violet", calendar: "sky", docs: "indigo", office: "cyan", mettle: "gold",
};

/* ---- holographic spectrum (foil / iridescence / prism edges) ---- */
export const HOLO =
  "linear-gradient(115deg,#a855f7,#38bdf8,#34d399,#C9A84C,#ec4899,#a855f7)";
export const HOLO_CONIC =
  "conic-gradient(from 210deg,#a855f7,#38bdf8,#34d399,#e6c668,#ec4899,#7c3aed,#a855f7)";

/* ---- type ---- */
export const FONTS = {
  display: "'Space Grotesk', system-ui, sans-serif",
  tech:    "'Chakra Petch', 'Space Grotesk', sans-serif",
  mono:    "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
} as const;

/* ---- radii / motion ---- */
export const RADII = { xs: 3, sm: 7, md: 11, lg: 16, xl: 24, pill: 999 } as const;
export const MOTION = {
  ease:   "cubic-bezier(0.16,1,0.3,1)",
  easeIO: "cubic-bezier(0.65,0,0.35,1)",
  fast: 140, med: 320, slow: 640,
} as const;

/* ---- surface palettes per theme ---- */
export const SURFACES: Record<Theme, Record<string, string>> = {
  dark: {
    void: "#050507", ink0: "#08080d", ink1: "#0c0c14", ink2: "#11111b", ink3: "#181824",
    line: "rgba(150,130,220,0.12)", line2: "rgba(168,130,255,0.26)", lineHot: "rgba(168,107,255,0.5)",
    tHi: "#f4f5fb", tMid: "#97a0b8", tLo: "#5e6680", tDim: "#353a4d",
    panelGlass: "rgba(14,14,24,0.62)",
  },
  light: {
    void: "#eceaf4", ink0: "#f4f2fa", ink1: "#ffffff", ink2: "#ffffff", ink3: "#f3f1fb",
    line: "rgba(80,50,140,0.13)", line2: "rgba(124,58,237,0.28)", lineHot: "rgba(124,58,237,0.45)",
    tHi: "#15121f", tMid: "#5a5274", tLo: "#8b86a3", tDim: "#c3bed6",
    panelGlass: "rgba(255,255,255,0.74)",
  },
};

/* ---- emit the full CSS-variable set for a theme ---- */
export function cssVars(theme: Theme): Record<string, string> {
  const s = SURFACES[theme];
  const v: Record<string, string> = {
    "--f-display": FONTS.display, "--f-tech": FONTS.tech, "--f-mono": FONTS.mono,
    "--holo": HOLO, "--holo-conic": HOLO_CONIC,
    "--ease": MOTION.ease, "--ease-io": MOTION.easeIO,
    "--accent": theme === "light" ? "#6d28d9" : ACCENTS.purple,
    "--gold": theme === "light" ? "#9a7b1f" : ACCENTS.gold,
  };
  for (const [k, val] of Object.entries(ACCENTS)) v[`--c-${k.toLowerCase()}`] = val;
  for (const [k, val] of Object.entries(s)) v[`--${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`] = val;
  for (const [k, val] of Object.entries(RADII)) v[`--r-${k}`] = typeof val === "number" && k !== "pill" ? `${val}px` : `${val}px`;
  return v;
}

/* ---- helper: resolve a section id to its accent hex ---- */
export const accentFor = (sectionId: string): string =>
  ACCENTS[SECTION_ACCENT[sectionId] ?? "purple"];
