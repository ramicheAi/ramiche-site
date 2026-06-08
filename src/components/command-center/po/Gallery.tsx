'use client';

/* ============================================================================
 * PARALLAX OS — GALLERY (holographic render wall). Screen #9.
 * A 4-col render wall of the 11 Galactik Antics character renders
 * (/assets/characters/1..11.png) as rarity-framed plates. Click a plate → a
 * lightbox holo-bay: large render, caption, "01 / 11" index, and ←/→/Esc nav.
 *
 * Ported from prototype/po-pages.jsx (GalleryPage). CSS classes (.gal-wall /
 * .gal-plate / .gal-lightbox / .gal-lb-*) already live in po-pages.css. #11 is
 * the planet/world render (TERMINUS). Live scan-line motion gates on
 * prefers-reduced-motion AND the .po-still tweak (handled by the ported CSS).
 * poPlay on open/nav.
 * ========================================================================== */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/command-center/po/Brand';
import { PAGE } from '@/lib/po-data';
import { usePoTheme } from '@/components/command-center/PoShell';
import { poPlay } from '@/lib/po-sound';

/* ── deterministic per-page serial code (matches the prototype `Head`) ─────── */
function serialFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (h % 9) + 1;
  const b = ((h >> 4) % 900) + 100;
  const c = ((h >> 8) % 9000) + 1000;
  return `${String(a).padStart(2, '0')}A${b}·${c}`;
}

type Rarity = 'Mythic' | 'Epic' | 'Rare' | 'Common';
type Plate = { n: number; title: string; tag: string; rarity: Rarity };

/* the 11-render Galactik Antics collection (#11 = the world, TERMINUS) */
const GALLERY: Plate[] = [
  { n: 1, title: 'ATLAS · PROTOTYPE', tag: 'Operations', rarity: 'Mythic' },
  { n: 2, title: 'SENTRY · WARFRAME', tag: 'Security', rarity: 'Epic' },
  { n: 3, title: 'VEE · SIGNAL', tag: 'Brand', rarity: 'Rare' },
  { n: 4, title: 'TRIAGE · BULWARK', tag: 'Response', rarity: 'Epic' },
  { n: 5, title: 'LEDGER · UNIT-01', tag: 'Finance', rarity: 'Rare' },
  { n: 6, title: 'SHURI · TINKER', tag: 'Creative', rarity: 'Epic' },
  { n: 7, title: 'WARDEN · FORGE', tag: 'Wellness', rarity: 'Common' },
  { n: 8, title: 'ORACLE · COMPOUND', tag: 'Analytics', rarity: 'Rare' },
  { n: 9, title: 'PROXIMON · SCOUT', tag: 'Prospecting', rarity: 'Epic' },
  { n: 10, title: 'CADENCE · RESONANCE', tag: 'Studio', rarity: 'Rare' },
  { n: 11, title: 'TERMINUS · WORLD', tag: 'Observatory', rarity: 'Mythic' },
];

/* rarity → frame faction color */
function frameFac(r: Rarity): string {
  if (r === 'Mythic') return 'var(--c-gold)';
  if (r === 'Epic') return 'var(--c-pink)';
  if (r === 'Rare') return 'var(--c-cyan)';
  return 'var(--t-mid)';
}

/* ── instrument header (ported from the prototype `Head`) ──────────────────── */
function Head({ actions }: { actions?: ReactNode }) {
  const p = PAGE.gallery;
  return (
    <div className="pg-head instrument-head">
      <span className="inst-cnr tl" />
      <span className="inst-cnr tr" />
      <span className="inst-cnr bl" />
      <span className="inst-cnr br" />
      <span className="pg-head-ic">
        <Icon name={p.icon} size={24} />
        <span className="pg-ic-ring" />
      </span>
      <div className="pg-head-body">
        <div className="pg-head-meta mono">
          <span className="pg-sec">{p.section}</span>
          <span className="pg-sep" />
          <span className="pg-serial">SYS·{serialFor('gallery')}</span>
          <span className="pg-sep" />
          <span className="pg-live">
            <i />
            ONLINE
          </span>
        </div>
        <h1 className="pg-h1 echo" data-echo={p.label}>
          {p.label}
        </h1>
        <div className="pg-ruler" aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => (
            <i key={i} className={i % 5 === 0 ? 'maj' : ''} />
          ))}
        </div>
      </div>
      {actions && <div className="pg-head-act">{actions}</div>}
    </div>
  );
}

export default function Gallery() {
  // keep in sync with the cockpit shell (still/reduced-motion handled by CSS)
  usePoTheme();

  const [lightbox, setLightbox] = useState<number | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    poPlay('open');
  }, []);

  // keyboard nav for the lightbox (Esc closes, ←/→ cycle)
  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        poPlay('blip');
      } else if (e.key === 'ArrowRight') {
        setLightbox((i) => (i == null ? i : (i + 1) % GALLERY.length));
        poPlay('nav');
      } else if (e.key === 'ArrowLeft') {
        setLightbox((i) => (i == null ? i : (i - 1 + GALLERY.length) % GALLERY.length));
        poPlay('nav');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const open = (i: number) => {
    setLightbox(i);
    poPlay('open');
  };
  const step = (dir: 1 | -1) => {
    setLightbox((i) => (i == null ? i : (i + dir + GALLERY.length) % GALLERY.length));
    poPlay('nav');
  };

  const lb = lightbox != null ? GALLERY[lightbox] : null;

  return (
    <div className="pg po-scroll" style={{ ['--accent' as string]: 'var(--c-pink)' } as CSSProperties}>
      <div className="pg-inner">
        <Head
          actions={
            <Link
              href="/command-center/gallery/outputs"
              className="pg-btn"
              onClick={() => poPlay('nav')}
            >
              <Icon name="gallery" size={15} /> Output archive
            </Link>
          }
        />
        <p className="pg-sub" style={{ marginTop: -16, marginBottom: 22 }}>
          The Galactik Antics collection — {GALLERY.length} renders curated by CURATOR. Tap any plate to view in the holo-bay.
        </p>
        <div className="gal-wall">
          {GALLERY.map((g, i) => (
            <figure
              key={g.n}
              className={'gal-plate holo-edge r-' + g.rarity.toLowerCase()}
              onClick={() => open(i)}
              role="button"
              tabIndex={0}
              aria-label={`${g.title} — ${g.rarity}. Open in holo-bay.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open(i);
                }
              }}
              style={{ ['--fac' as string]: frameFac(g.rarity) } as CSSProperties}
            >
              <div className="gal-img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/characters/${g.n}.png`} alt={g.title} loading="lazy" />
                <span className="gal-scan" />
              </div>
              <figcaption>
                <span className="gal-rarity mono">{g.rarity}</span>
                <span className="gal-title mono">{g.title}</span>
                <span className="gal-tag">{g.tag}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {lb != null && lightbox != null && (
        <div
          className="gal-lightbox"
          onClick={() => {
            setLightbox(null);
            poPlay('blip');
          }}
        >
          <button
            className="gal-lb-nav prev"
            aria-label="Previous render"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
          >
            <Icon name="chevron" size={22} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <figure className="gal-lb-fig" onClick={(e) => e.stopPropagation()}>
            <span className="inst-cnr tl" />
            <span className="inst-cnr tr" />
            <span className="inst-cnr bl" />
            <span className="inst-cnr br" />
            <div className="gal-lb-bay">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/assets/characters/${lb.n}.png`} alt={lb.title} />
            </div>
            <figcaption className="gal-lb-cap">
              <div>
                <div className="gal-lb-title">{lb.title}</div>
                <div className="gal-lb-tag mono">
                  {lb.tag} · {lb.rarity}
                </div>
              </div>
              <div className="gal-lb-idx mono">
                {String(lightbox + 1).padStart(2, '0')} / {String(GALLERY.length).padStart(2, '0')}
              </div>
            </figcaption>
          </figure>
          <button
            className="gal-lb-nav next"
            aria-label="Next render"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
          >
            <Icon name="chevron" size={22} />
          </button>
          <button
            className="gal-lb-close"
            aria-label="Close holo-bay"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
              poPlay('blip');
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
