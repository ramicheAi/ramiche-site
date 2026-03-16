# METTLE Team Recruitment Portal

Interactive recruitment and onboarding portal for swim teams evaluating METTLE. Coaches complete a 12-question readiness assessment, get a personalized score and onboarding roadmap, review competitive comparison and pricing, and submit a beta application — all in a single-page experience.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **Why METTLE** — Value propositions, 4 feature cards, competitive comparison table (vs. TeamUnify, OnDeck)
- **Readiness Assessment** — 12 questions across 4 categories (Infrastructure, Coaching, Meet Ops, Parent Engagement) with Yes/Partial/No toggle scoring
- **Personalized Roadmap** — Dynamic onboarding steps generated from assessment answers, with estimated timelines
- **Pricing Plans** — 4-tier pricing display ($149-Enterprise) matching live METTLE pricing
- **Application Form** — Full coach + team info capture with all 59 USA Swimming LSCs, team size ranges, current software, pain point, referral source
- **Score Animation** — Animated readiness percentage with tier badge (Launch Ready / Almost There / Building Foundations)
- **LocalStorage** — Applications saved client-side for demo/review
- **Header Stats** — Animated counter stats (teams, athletes, PBs, rating)

## What's Missing / Next Steps

- Backend integration (Firestore) for real application storage
- Email notification to sales team on new applications
- Calendar booking integration for onboarding calls
- Testimonial section with beta team quotes
- Video embed showing METTLE in action
- Mobile app download links
