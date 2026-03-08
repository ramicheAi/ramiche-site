# Parallax — Project Memory

## Status

- **Shipped** — 19-route site live on Vercel
- Agent marketplace operational
- White-label system deployed (first external: Derrick, Windows, Feb 21)

## Key URLs

- **Live:** https://parallax-site-ashen.vercel.app
- **Repo:** /Users/admin/parallax-site/ (NOT in repos/ folder, NOT ramiche-site)

## Audit (Feb 27)

- 9 functional routes, 7 marketing-only, 2 partial, 1 fixed
- Only /agents has real payment-to-delivery e2e

## Agents

- **Atlas** — oversight, strategy
- **Aetherion** — creative direction, visuals

## Gotchas

- This is a SEPARATE repo from ramiche-site. Different Vercel project.
- No git repo — deploys via `vercel --prod --force`
- Check `age` header after deploy to confirm fresh content
- No Firebase auth yet — planned addition
