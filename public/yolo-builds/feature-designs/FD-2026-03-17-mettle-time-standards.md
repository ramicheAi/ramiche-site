# FD: METTLE Time Standards & Converter

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-17 01:00
**Lane:** Product prototypes

## Objective
Four-tab utility for coaches and parents: course time conversion (SCY/SCM/LCM), motivational time standards lookup (B–AAAA), gap-to-next-standard analysis, and time drop tracking with season progression visualization.

## Acceptance Criteria
- [x] Convert times between SCY, SCM, LCM with stroke/gender-specific factors
- [x] Display motivational time standards for 14 events × 6 age groups × 2 genders
- [x] Highlight achieved and next-target standards when athlete time entered
- [x] Gap analysis with progress bar and estimated meets to next standard
- [x] Time drop calculator with visual comparison
- [x] Demo season progression data (Marcus Williams, 50 Free)
- [x] METTLE v5 branding (purple/scarlet/gold/blue)
- [x] Zero dependencies, single HTML file

## A/B Context
Previous build this improves on: METTLE Athlete Check-In (2026-03-16)
Variable changed: utility tool (standards/conversion) vs. engagement tool (check-in)
Expected improvement: daily-use frequency — coaches look up standards and conversions constantly, especially mid-season

## What Worked / What Didn't
Conversion factor approach (SCY→LCM/SCM multipliers per stroke/gender) is clean and extensible. Standards data was the largest effort — populating 14 events × 6 age groups × 2 genders × 6 standards manually. Used representative values since actual USA Swimming standards change yearly and are distributed as PDFs. The gap analysis with estimated meets-to-next-standard gives coaches actionable planning data. Key decision: pure DOM rendering instead of canvas — faster to build, more accessible, but limits export options.
