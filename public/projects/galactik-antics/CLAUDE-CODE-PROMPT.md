# Galactik Antics — Full Audit + Fix Prompt

## Project
- Repo: /Users/admin/GALACTIK-ANTICS 2
- Framework: Next.js 15.5.15, React 19.2.4, Tailwind CSS 4, Zustand 5, Framer Motion 12
- Deploy: galactik-antics.vercel.app
- Commerce: Stripe + Printful (NO Shopify)
- Auth/DB: Firebase Auth + Firestore
- Origin: Migrated from Replit vanilla JS site (April 12-13, 2026)

## Scope
Fix all visual issues, complete pending implementation phases, and prepare for launch.

---

## PHASE 1: CRITICAL VISUAL FIXES (IMPLEMENTATION-V2.md — never completed)

These were documented April 15 but never executed. The app looks broken visually because opacity/contrast values are too low.

### 1A. BrandEnergyLayer — Crank Visibility
**File:** `src/components/shared/BrandEnergyLayer.tsx`
- Line 54: `opacity-[0.35]` → `opacity-[0.70]`
- Line 63: `bg-ga-slime/35` → `bg-ga-slime/60`
- Line 72: opacity keyframes `[0.12, 0.45, 0.15]` → `[0.35, 0.75, 0.40]`
- Line 85: `bg-ga-cyan/50` → `bg-ga-cyan/70`
- Line 93: twinkle keyframes `[0.08, 0.85, 0.1]` → `[0.30, 0.95, 0.35]`

### 1B. Neon Card Borders — Boost Contrast
**File:** `src/app/globals.css`
- `.ga-neon-card` border: `rgba(128,237,153,0.15)` → `rgba(128,237,153,0.40)`
- `.ga-neon-card` box-shadow: `rgba(128,237,153,0.08)` → `rgba(128,237,153,0.25)`
- `.ga-neon-card:hover` border-color: `rgba(128,237,153,0.35)` → `rgba(128,237,153,0.65)`
- `.ga-neon-card-toxic` border: `rgba(255,109,0,0.15)` → `rgba(255,109,0,0.40)`
- `.ga-neon-card-toxic` box-shadow: `rgba(255,109,0,0.08)` → `rgba(255,109,0,0.25)`
- `.ga-neon-card-toxic:hover` border-color: `rgba(255,109,0,0.35)` → `rgba(255,109,0,0.65)`

### 1C. Text Contrast Check
After 1A+1B:
- If brand layer washes out text, bump `--color-ga-muted` from `#b4c0d4` to `#d0d8e8`
- Add `text-shadow: 0 1px 4px rgba(0,0,0,0.6)` to headings if needed

---

## PHASE 2: GALACTIC MAP — Make It Visible

**File:** `src/components/views/GalacticMap.tsx`

### 2A. Constellation Lines (around line 289)
- Change `text-white/10` → `text-ga-cyan/60`
- All `<line>` elements: `strokeWidth="1"` → `strokeWidth="2"`
- Add `strokeDasharray="8 4"` for animated network feel
- Add `opacity="0.7"` on each line

### 2B. Pulse Animation
Add to `globals.css`:
```css
@keyframes ga-constellation-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}
```
Apply to SVG container: `style={{ animation: 'ga-constellation-pulse 4s ease-in-out infinite' }}`

### 2C. Mobile Map
- SVG has `hidden md:block` — desktop only
- Add simplified mobile version or make responsive by removing `hidden` and adding mobile-friendly planet positioning

---

## PHASE 3: SHOP PRODUCT VISIBILITY

**Files:** `src/components/views/Shop.tsx`, related product card components

### Problems:
- Product images are SVG mockups on near-black background → appear blank
- Product cards blend into the dark background
- No visible price/CTA contrast

### Fixes:
- Add card backgrounds: `bg-ga-dark-800/80` with `border border-ga-slime/30`
- Product image containers: add `bg-gradient-to-br from-ga-dark-700 to-ga-dark-900` backdrop
- Price text: ensure `text-ga-slime font-bold text-lg`
- "Add to Cart" button: ensure high contrast `bg-ga-slime text-black font-bold hover:bg-ga-slime/80`
- Add hover glow effect: `hover:shadow-[0_0_20px_rgba(128,237,153,0.3)]`

---

## PHASE 4: SQUAD BUILDER VISIBILITY

**File:** `src/components/views/SquadBuilder.tsx`

### Problems:
- Character roster items are dark-on-dark → invisible
- Synergy indicators lack contrast

### Fixes:
- Roster item cards: add `bg-ga-dark-800/60 border border-ga-cyan/20 hover:border-ga-cyan/50`
- Character names in roster: ensure `text-white font-medium`
- Synergy badges: bold color (`bg-ga-slime/20 text-ga-slime` or `bg-ga-toxic/20 text-ga-toxic`)
- Empty squad slots: dashed border `border-2 border-dashed border-ga-muted/30` with "Drag character here" text

---

## PHASE 5: LEADERBOARD POLISH

**File:** `src/components/views/Leaderboard.tsx`

### Problems:
- Shows "Firebase not configured" error if env vars missing
- No graceful degradation

### Fixes:
- If Firebase unconfigured: show a stylish "Leaderboard coming soon — connect to see rankings" message instead of error
- Add mock/demo data for preview mode (top 10 placeholder entries with character names from the roster)
- Ensure leaderboard rows have proper contrast: alternating `bg-ga-dark-800/40` and `bg-ga-dark-900/40`
- Top 3: gold/silver/bronze accent borders and rank badges

---

## PHASE 6: EVENTS PAGE POLISH

**File:** `src/components/views/Events.tsx`

### Check:
- Roctar Uprising event countdown timer working
- Faction leaderboard renders (may be placeholder)
- Event missions list renders with completion tracking
- If event has ended (countdown < 0), show "Event concluded" state instead of negative countdown

---

## PHASE 7: MOBILE RESPONSIVENESS AUDIT

Check ALL pages on mobile viewport (375px width):
- Navigation dropdown works on mobile (hamburger menu)
- Cards/products don't overflow horizontally
- Modals (CharacterModal, TradingCardModal) are scrollable on mobile
- Galaxy wheel spinner works on touch
- Mystery box selection works on touch
- Squad builder drag-and-drop works on touch (or has tap alternative)
- Shop cart sidebar doesn't overflow
- Text is readable (min 14px body text)

Fix any overflow, truncation, or interaction issues found.

---

## PHASE 8: PERFORMANCE + QUALITY

### 8A. Image Optimization
- Check all images in `/public/character_images/` — ensure they're optimized (not oversized PNGs)
- Use Next.js `<Image>` component with proper `width`/`height`/`priority` attributes
- Add `loading="lazy"` for below-fold images

### 8B. Loading States
- Verify `LoadingScreen.tsx` renders on initial page load
- Add skeleton loaders for: shop products grid, leaderboard table, character cards
- Ensure transitions between pages use `WarpTransition` consistently

### 8C. Error Boundaries
- Verify error.tsx exists and renders gracefully
- Test: what happens if Firebase is unreachable? App should still work (all game features are local/Zustand)

### 8D. SEO Basics
- Verify `metadata` export in `layout.tsx` has: title, description, og:image, og:title, og:description
- Each page should have unique metadata where possible
- Sitemap accessible via `/api/health` endpoint

---

## PHASE 9: BUG AUDIT — EVERY PAGE

Audit each page file for:
- Runtime errors (missing imports, undefined references)
- Broken navigation links
- Console errors on load
- State management issues (stale Zustand state, missing hydration guards)
- Hardcoded values that should use data files
- Missing loading/error states

### Pages to audit:
- `src/app/page.tsx` — Homepage
- `src/app/characters/page.tsx`
- `src/app/trading-cards/page.tsx`
- `src/app/shop/page.tsx` + `shop/merch/page.tsx` + `shop/drops/page.tsx` + `shop/success/page.tsx`
- `src/app/missions/page.tsx`
- `src/app/squad-builder/page.tsx`
- `src/app/vault/page.tsx`
- `src/app/galaxy-wheel/page.tsx`
- `src/app/mystery-box/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/events/page.tsx`
- `src/app/lore/page.tsx` + `lore/galactic-map/page.tsx` + `lore/[planet]/page.tsx`
- `src/app/cards/page.tsx`
- `src/app/dev/page.tsx`

### Components to audit (44 total under src/components/):
- All view components in `src/components/views/`
- Shared components in `src/components/shared/`
- Layout components in `src/components/layout/`

### API routes to audit:
- `src/app/api/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/health/route.ts`

### Stores to audit (15 Zustand stores in src/lib/):
- Check for hydration issues (SSR vs client mismatch)
- Check localStorage persistence works
- Check no circular dependencies between stores

---

## PHASE 10: PRE-LAUNCH CHECKLIST VERIFICATION

After all fixes, verify:

1. [ ] `npm run build` passes with 0 errors
2. [ ] `npm run lint` passes with 0 errors
3. [ ] All 18 routes render without console errors
4. [ ] Brand energy particles visible and animated
5. [ ] Neon card borders visible on all card types
6. [ ] Galactic map constellation lines visible + planets clickable
7. [ ] Shop products clearly visible with prices and CTA buttons
8. [ ] Squad builder roster items visible and draggable
9. [ ] Leaderboard gracefully handles missing Firebase
10. [ ] Mobile: all pages work at 375px width
11. [ ] Cart → Checkout flow works (Stripe test mode)
12. [ ] Profile page loads with user stats
13. [ ] Vault codes can be redeemed
14. [ ] Galaxy wheel spins and awards prizes
15. [ ] Mystery box opens with tier selection
16. [ ] Missions show completion state
17. [ ] Events countdown displays correctly
18. [ ] Lore pages navigate between planets smoothly

---

## DELIVERABLES

1. Execute Phases 1-2 (visual contrast fixes) — these are the most impactful
2. Execute Phases 3-4 (shop + squad builder visibility)
3. Execute Phase 5-6 (leaderboard + events polish)
4. Execute Phase 7 (mobile audit)
5. Execute Phase 8 (performance + quality)
6. Execute Phase 9 (full bug audit with report)
7. Verify Phase 10 checklist
8. Run `npm run build` + `npm run lint` — fix any issues
9. Document any remaining items that need manual action (Stripe IDs, Printful IDs, Firebase deploy)

## Key Data References
- Characters: `src/data/characters.ts` (20 characters + Wanda legendary)
- Products: `src/data/products.ts` (27 products — phone cases, art prints, card packs, merch)
- Trading Cards: `src/data/tradingCards.ts` (20 cards)
- Missions: `src/data/missions.ts`
- Planets: `src/data/planets.ts` (5 planets)
- Event Missions: `src/data/eventMissions.ts`

## Key Files
- `IMPLEMENTATION-V2.md` — original visual fix spec (read for exact line numbers)
- `MANUAL-LAUNCH.md` — manual launch tasks (Stripe IDs, Firebase deploy, etc.)
- `src/app/globals.css` — brand color variables and card styles
- `src/components/shared/BrandEnergyLayer.tsx` — particle overlay
- `src/components/views/GalacticMap.tsx` — constellation lines
- `tailwind.config.ts` — custom GA color palette
