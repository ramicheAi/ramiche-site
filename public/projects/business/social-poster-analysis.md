# Social Media Poster Tool — Competitive Analysis & Build Plan

## Upload-Post Analysis

**What they do well:**
- Simple API — one call, multiple platforms
- 10 platforms (TikTok, IG, YouTube, LinkedIn, FB, X, Threads, Pinterest, Reddit, Bluesky)
- Auto-adapts content to platform requirements
- White-label option for agencies
- Zapier/Make/n8n integrations

**Where they fall short (our opportunity):**
1. **No AI content generation** — just posts what you give it. No content optimization, no A/B testing, no auto-hashtags
2. **No scheduling intelligence** — no "best time to post" optimization per platform
3. **No engagement tracking loop** — posts go out, analytics come back, but nothing connects them. No "this worked, do more of this"
4. **No brand voice enforcement** — can't ensure every post matches your brand guidelines
5. **No image generation** — you bring your own media. No auto-created graphics
6. **10 posts/mo on free tier** — restrictive. We burned through it in 1 day
7. **No content calendar** — no visual schedule of what's coming
8. **No team collaboration** — no approval workflows for agencies
9. **No platform-specific optimization** — doesn't auto-trim for X, expand for LinkedIn, add hashtags for IG
10. **No AI repurposing** — can't turn one blog post into 10 platform-specific posts

## Our Competitive Advantage (Parallax Social Engine)

We build this as an **AI-native social media engine** — not just a poster, but a content intelligence system:

### Core Features (MVP)
1. **One-click multi-platform posting** — same as Upload-Post but free for Parallax users
2. **AI content generation** — describe what you want, get platform-optimized posts for X, LinkedIn, IG, Reddit
3. **Auto-adaptation** — auto-trims X to 280 chars, expands LinkedIn to 3000, adds IG hashtags, formats Reddit markdown
4. **Brand voice enforcement** — SOUL file for your brand's tone, style, vocabulary. Every post sounds like YOU
5. **Image generation** — auto-create on-brand graphics with Gemini/DALL-E for every post
6. **Scheduling** — queue posts, set optimal times per platform, batch scheduling

### Advanced Features (v2)
7. **Content repurposing** — turn a blog post/thread into 10 platform-specific posts
8. **A/B testing** — post variations, track which performs better, learn
9. **Engagement analytics** — what worked, what didn't, recommendations
10. **Content calendar** — visual weekly/monthly view of scheduled posts
11. **Approval workflow** — team members draft, manager approves, system posts
12. **Competitor monitoring** — track what competitors post, when, engagement

### Pricing (undercut Upload-Post)
- **Free tier:** 50 posts/month (5x Upload-Post's 10)
- **Pro:** $19/month — unlimited posts, AI generation, scheduling
- **Agency:** $49/month — white-label, team collaboration, analytics
- **Enterprise:** $149/month — custom integrations, priority support

### Tech Stack
- Next.js frontend (consistent with our other products)
- Platform APIs: X v2, LinkedIn Marketing API, Meta Graph API, Reddit API, Bluesky AT Protocol
- AI: Claude for content generation, Gemini/DALL-E for images
- Database: Vercel KV or Supabase for scheduling queue
- Cron: scheduled post delivery

### Revenue Model
- SaaS subscriptions
- Add-on: AI image credits
- White-label licensing for agencies

## Build Priority
Phase 1 (MVP, 1 week): X + LinkedIn + IG posting with AI content generation
Phase 2 (v1, 2 weeks): Scheduling, content calendar, analytics
Phase 3 (v2, 1 month): Reddit, Bluesky, repurposing, A/B testing

## Why We Win
Upload-Post is a **pipe** — content goes in, posts come out. We build an **engine** — content is generated, optimized, scheduled, posted, analyzed, and improved. The AI-native advantage means every post gets smarter over time.
