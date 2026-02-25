# METTLE — Disaster Recovery Plan

## Data Architecture
- **Primary storage:** Firebase Firestore (Google Cloud — 99.999% SLA)
- **Client cache:** localStorage (per-device, survives network outages)
- **Code:** GitHub (`ramicheAi/ramiche-site`) — full version history
- **Hosting:** Vercel (auto-failover, CDN edge caching)

## Recovery Procedures

### 1. Firestore Data Loss
- **RTO:** < 1 hour | **RPO:** < 24 hours
- Firestore has automatic daily backups (Google-managed)
- Manual export: `gcloud firestore export gs://apex-athlete-73755-backups`
- Restore: `gcloud firestore import gs://apex-athlete-73755-backups/<timestamp>`
- Fallback: Client localStorage retains recent data — can be re-synced

### 2. Vercel Deployment Failure
- **RTO:** < 15 minutes
- Previous deployments available in Vercel dashboard (instant rollback)
- `vercel rollback` from CLI
- Alternative: Deploy from any commit via `vercel --prod`

### 3. GitHub Repository Loss
- **RTO:** < 30 minutes
- Local clone on build machine (`/Users/admin/ramiche-site`)
- All 100+ commits preserved locally
- Re-push to new remote: `git remote set-url origin <new-url> && git push --all`

### 4. Domain/DNS Failure
- **RTO:** < 1 hour
- Vercel auto-provisions SSL and manages DNS for `*.vercel.app`
- Custom domain DNS records documented in Vercel dashboard
- Fallback: Direct access via `ramiche-site.vercel.app`

### 5. API Key/Secret Compromise
- **RTO:** < 30 minutes
- Rotate Stripe keys in Stripe dashboard → update Vercel env vars
- Rotate Firebase keys: create new service account → update env vars
- Force deploy: `vercel --prod --force`
- API keys encrypted at rest with AES-256-GCM (see `src/lib/api-security.ts`)

### 6. Complete Environment Loss
- **RTO:** < 2 hours
- Clone repo from GitHub
- Set env vars from documented list (stored in password manager)
- `npm install && vercel --prod`
- Re-enable Firestore security rules: `firebase deploy --only firestore:rules`

## Monitoring & Alerts
- Vercel Speed Insights + Analytics (real-time)
- Health check endpoint: `/api/health`
- GitHub Actions CI on every push (lint, type-check, build, security scan)

## Backup Schedule
- **Firestore:** Google-managed daily backups + manual weekly export
- **Code:** Every push to GitHub (100+ commits of history)
- **OpenClaw workspace:** Weekly backup via `openclaw-backup` skill (Sunday 3 AM)

## Testing
- DR procedures should be tested quarterly
- Verify Firestore export/import works
- Verify Vercel rollback works
- Verify local clone can deploy independently

---
*Last updated: Feb 24, 2026*
