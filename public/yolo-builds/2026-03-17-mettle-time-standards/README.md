# METTLE Time Standards & Converter

Interactive swim time utility with 4 tools in one:

1. **Course Converter** — Convert times between SCY, SCM, and LCM using empirically-derived USA Swimming conversion factors. Stroke-specific, gender-aware.
2. **Time Standards Table** — Full motivational time standards (B through AAAA) for 14 events across 6 age groups, both genders, SCY and LCM. Optional athlete time input highlights achieved/next standards.
3. **Gap Analysis** — Enter a best time, see current standard, progress bar to next standard, and estimated meets needed to achieve it.
4. **Drop Tracker** — Calculate time drops between meets. Includes demo season progression for Marcus Williams (50 Free SCY) showing 1.89s total season drop.

## How to Run

Open `index.html` in any browser. No dependencies, no build step.

## What's Missing / Next Steps

- Real USA Swimming motivational times (current values are representative approximations)
- Integration with METTLE Firestore for real athlete best times
- Historical drop tracking with LocalStorage persistence
- Multi-athlete comparison mode
- Export/share time cards for social media
- Wire to METTLE athlete profiles for automatic standard detection on meet uploads

## Tech

- 44KB single HTML file, vanilla JS, zero dependencies
- METTLE v5 brand colors (purple, scarlet, gold, blue)
- 14 events × 6 age groups × 2 genders × 6 standards = full coverage
- Canvas-free — pure DOM rendering for accessibility
