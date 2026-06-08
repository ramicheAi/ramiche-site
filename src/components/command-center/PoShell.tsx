'use client';

/* ============================================================================
 * PoShell — Parallax OS theme + font wrapper for the Command Center.
 * - Applies data-po-theme (dark|light) + the live --accent for the route.
 * - Persists theme to localStorage("po-theme") (spec: po-theme key).
 * - Loads the three house fonts (Space Grotesk / Chakra Petch / JetBrains Mono).
 * - Exposes usePoTheme() so the HUD toggle can flip themes.
 * Scoped entirely under .po-shell so the public marketing site is untouched.
 * ========================================================================== */

import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
  type ReactNode, type CSSProperties,
} from 'react';
import { usePathname } from 'next/navigation';
import { accentFor, ACCENTS, type Theme } from '@/lib/cc-theme';

type PoThemeCtx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** the live accent hex for the current route */
  accent: string;
  still: boolean;
  setStill: (v: boolean) => void;
};

const Ctx = createContext<PoThemeCtx | null>(null);

export function usePoTheme(): PoThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePoTheme must be used within <PoShell>');
  return c;
}

const THEME_KEY = 'po-theme';
const STILL_KEY = 'po-still';

/** map a command-center pathname to a SECTION_ACCENT key */
function sectionKey(pathname: string | null): string {
  if (!pathname) return 'dashboard';
  const parts = pathname.split('/').filter(Boolean); // ["command-center", seg, ...]
  const seg = parts[1] ?? '';
  if (!seg) return 'dashboard';
  // normalize a few multi-word routes to the token keys in cc-theme
  const norm: Record<string, string> = {
    'nerve-center': 'nerve',
    'app-builder': 'builder',
  };
  return norm[seg] ?? seg;
}

export default function PoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [still, setStillState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // restore persisted prefs post-mount (avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
    try {
      const t = window.localStorage.getItem(THEME_KEY);
      if (t === 'light' || t === 'dark') setThemeState(t);
      if (window.localStorage.getItem(STILL_KEY) === '1') setStillState(true);
    } catch { /* ignore */ }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { window.localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try { window.localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setStill = useCallback((v: boolean) => {
    setStillState(v);
    try { window.localStorage.setItem(STILL_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const accent = accentFor(sectionKey(pathname));

  const ctx = useMemo<PoThemeCtx>(
    () => ({ theme, setTheme, toggleTheme, accent, still, setStill }),
    [theme, setTheme, toggleTheme, accent, still, setStill],
  );

  // live accent on the wrapper; everything inside inherits via var(--accent)
  const style = {
    '--accent': accent,
    '--accent-l': theme === 'light' ? accent : ACCENTS.purpleL,
  } as CSSProperties;

  return (
    <Ctx.Provider value={ctx}>
      {/* House fonts — React 19 hoists these <link>s into <head>. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <div
        className={`po-shell${still ? ' po-still' : ''}`}
        data-po-theme={mounted ? theme : 'dark'}
        style={style}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}
