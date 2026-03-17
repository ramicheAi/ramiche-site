# METTLE Coach Proposal Generator

Sales tool that generates customized pitch proposals for swim teams considering METTLE. Coach enters team info → tool generates a branded proposal with ROI projections, pain-to-solution mapping, pricing recommendation, competitive comparison, and onboarding timeline.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- 8-field team intake form (name, size, fees, churn, LSC, software, type)
- 10 selectable pain points with mapped solutions
- Auto-recommended pricing tier based on athlete count
- ROI calculator (saved revenue, ROI %, payback period)
- Competitive comparison table (METTLE vs. TeamUnify vs. OnDeck)
- 4-week onboarding timeline
- Print/PDF export with print-optimized styles
- METTLE brand colors (purple, scarlet, gold)

## What's Missing

- Lead capture (email/form submission to CRM)
- PDF generation without browser print dialog
- Saved proposals (LocalStorage or backend)
- Email delivery of proposal to prospect
- Dynamic case study insertion based on team type/LSC
