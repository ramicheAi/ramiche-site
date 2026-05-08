# EventFlyer Generator

## One-Line Idea
Auto-generates senior-friendly tournament flyers from simple text inputs — think "New Year digital card" style with one-click simplicity.

## Status
✅ Working Prototype — Core generator functional

## How to Run
```bash
cd /Users/admin/.openclaw/workspace-echo/yolo-builds/event-flyer-generator
open flyer-generator.html
```

## What I Built
Single HTML file that transforms basic event details into a clean, printable flyer:
- Input: Event name, date, location, contact info
- Output: Professional PDF-ready flyer
- Features: Large text (senior-friendly), clean layout, one-page format

## Key Files
- `flyer-generator.html` — Main generator tool
- `templates/` — Pre-built styles (classic, modern, elegant)
- `examples/lina-tournament.html` — Sample ITF Ljubljana flyer

## What to Change
Edit the HTML variables section to customize:
- Colors: Update CSS variables in `:root`
- Fonts: Change Google Fonts import
- Logo: Replace placeholder with actual tournament logo

## Next Steps to Finish
1. Add image upload for tournament logos
2. Export to PDF functionality
3. Mobile-responsive adjustments
4. More template styles

## Build Notes
Time: ~2 hours
Approach: Pure HTML/CSS/JS — no backend needed
Challenge: Balancing simplicity vs. customization options

---
Built: 2026-03-02
Builder: ECHO
