# Galactik Antics — Project Memory
*Updated: Mar 25, 2026*

## Architecture
- **Framework:** Next.js 14+ (App Router)
- **Repo:** `/Users/admin/.openclaw/workspace/repos/galactik-antics/`
- **Vercel:** galactik-antics.vercel.app
- **GitHub:** connected, auto-deploys on push
- **Source:** Replit export in `projects/galactik-antics/galactik-antics-source/`
- **Design:** framer-motion + ga-* color tokens (ga-purple, ga-black, ga-red, ga-blue)
- **UI:** shadcn/radix components ported from Replit (40+)
- **State:** CartContext (local storage), no backend persist yet

## Routes (15)
about, art, art-prints, checkout, collectibles, community, lore, merch, product, shop, store + /api/products, /api/messages, /api/characters, /api/orders

## Key Decisions
- Replit Express+Vite → Next.js App Router + API routes
- wouter → next/link, tanstack-query → static data / useEffect fetch
- Cart: local storage (no backend persist — add Firebase later)
- Community posts: client-side state only (stub)
- Assets: copied from Replit source, stored in public/

## Dependencies Added (Mar 24)
framer-motion, zod, react-hook-form, @hookform/resolvers, embla-carousel-react, recharts, vaul, input-otp, react-day-picker, date-fns, drizzle-orm, drizzle-zod, 25+ @radix-ui/* packages

## Commits (16 total)
- `42cad09` feat(home): Collectibles + Storytelling sections
- `8f20e5a` feat: Layout components + enhanced CSS
- `bb266f4` merge: resolve conflict, keep 12 sections
- `b5ded7a` feat: All 12 homepage sections
- `490a2f6` feat(home): Featured Products + Limited Time Offer
- `5f6f426` feat: Port Header, Footer, Hero from Replit
- `8e7223c` feat: Complete GA storefront
- `a767a09` feat: Initial clean commit

## Known Issues
- Homepage visual QA needed — Ramon said "website looks the same" after port
- Server CWD drift caused stale builds during Mar 24 session
- Some Replit components may still reference removed dependencies
- Interactive games (wheel, missions, vault) are React wrappers but may need full interactivity verification

## Brand
- Universe: quirky, weird, cosmic characters
- Tone: playful, collectible, art-driven
- Colors: ga-purple (#7B2FBE), ga-black (#0A0A0A), ga-red (#E53E3E), ga-blue (#3182CE)
- Product lines: collectibles, art prints, merch/apparel, characters
