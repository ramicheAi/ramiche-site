# METTLE — Sales Proposal Generator

Mercury's first YOLO build. A branded, interactive sales proposal generator for METTLE.

## What It Does
- Enter team info (name, athletes, churn, pain points, contact)
- Select recommended pricing tier with optional discount
- Auto-generates a branded, print-ready proposal with:
  - Personalized hero section with team name and contact
  - Pain points acknowledgment section
  - Team-at-a-glance stats
  - 3-tier pricing comparison with recommendation badge
  - ROI projections (retention revenue + time savings)
  - Visual cost vs. value bars
  - Next steps + CTA with pre-filled email link
- Exports CRM-ready lead capture JSON (copy to clipboard)
- Print/PDF support via browser print

## How to Run
Open `index.html` in any browser. Fill in fields, click "Generate Proposal."

## What's Missing / Next Steps
- PDF auto-generation (currently uses browser print)
- CRM webhook to push lead data directly to a pipeline
- Email template version for outbound sequences
- Multi-proposal comparison (side-by-side tiers)
- Firestore integration for lead persistence
