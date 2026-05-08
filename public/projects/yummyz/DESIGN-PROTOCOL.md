# Yummyz Design Protocol

## Brand Identity
- **Name:** Yummyz
- **Industry:** Cannabis (weed bags / mylar packaging)
- **Vibe:** Street + Premium + Playful
- **Logo:** 3D candy/icing style, cream letters, rainbow gradient outline, sparkles
- **Print Partner:** Beast Coast Packaging

## Compliance Rules
- No recognizable IP (cartoon characters, brand names, etc.)
- No guns, kids, violence
- No weed leaves on packaging
- Logos must color-match the strain

## Drop 1 — The Final Four
| Strain | Design | Status |
|--------|--------|--------|
| Banana Puddingz | King Kong gorilla city scene | ✅ LOCKED |
| Birthday Cakez | Bulldog chef | ✅ LOCKED |
| Mango Sorbet | Penguin on ice (tropical) | ⚠️ Text fix: remove "z" from SORBETZ |
| Jawbreakerz | 3 street characters + giant jawbreaker | ✅ LOCKED |

**Deferred:** Cereal Milkz, Kandy Applez (future drops)

## Beast Coast File Submission Requirements (MANDATORY)

### 1. Vector Only
- **Accepted:** `.ai` (Adobe Illustrator) or `.pdf` (vector PDF)
- **REJECTED:** JPEGs, PNGs, rasterized AI files
- Vectors = anchor points/paths, scalable from 1in to 1000in with no quality loss

### 2. All Text Expanded
- Convert all text to outlines/paths (Type → Create Outlines in Illustrator)
- Unexpanded fonts will show as missing on their end

### 3. All Images Embedded
- No linked images — embed everything
- If image shows an X across it, it's not embedded (click Embed in control bar)

### 4. Bleed: .25in Around Cutlines
- Safety area (yellow line) — keep all important info/logos INSIDE
- Bleed area — design extends .25in PAST the cutline
- Anything outside cutline gets trimmed

### 5. Do's and Don'ts
- DO: Review this file, ask questions, send to designer
- DON'T: Ignore specs, send rasterized AI files claiming vectors

## Vector Production Pipeline

### Current State
All 7 concepts are **raster PNGs** (AI-generated). These CANNOT be submitted to Beast Coast.

### Conversion Path
1. **Pick winning design** per strain (Ramon selects)
2. **Recreate as vector** — clean SVG with bold outlines, flat color fills, text as paths
3. **Add print specs** — .25in bleed, cutlines, safety area
4. **Export** — SVG → `.ai` or `.pdf` via Inkscape CLI
5. **QA checklist:**
   - [ ] All text expanded to outlines
   - [ ] All images embedded
   - [ ] .25in bleed around cutlines
   - [ ] Important content inside safety area
   - [ ] File opens clean in Illustrator
   - [ ] Scalable without quality loss

### Tools
- **Inkscape CLI** — SVG authoring + export to AI/PDF
- **Aetherion** — creative direction, color palettes, layout concepts
- **SVG code generation** — Claude agents write vector markup for clean geometric elements

## Design Files Location
- Raster concepts: `/Users/admin/.openclaw/media/inbound/file_738-744*.jpg`
- Vector output: `projects/yummyz/vectors/`
- Beast Coast spec PDF: `/Users/admin/.openclaw/media/inbound/Beast_Coast_Packaging_*.pdf`
