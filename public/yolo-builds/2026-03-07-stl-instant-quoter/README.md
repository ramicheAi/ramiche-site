# STL Instant Quoter — Ramiche Fab Lab

Client-side STL file parser + real-time cost estimator for 3D print quoting. Parses binary and ASCII STL files entirely in the browser — no server, no uploads, no dependencies.

## Features
- Drag-and-drop STL upload (binary + ASCII format support)
- Full geometry analysis: triangle count, volume, surface area, bounding box
- Bambu Lab A1 build volume check (256x256x256mm)
- Rotating wireframe 3D preview
- 6-material database (PLA, PETG, ABS, TPU, ASA, Silk PLA) with real pricing
- Infill density slider (5-100%)
- Quantity selector with volume discounts (5%/10%/15%)
- Real-time cost breakdown: material + machine time + setup fee
- Print time estimation based on volumetric flow rate and material speed
- Ambient particle background, heartbeat pulse on quote (72 BPM)

## How to Run
Open `index.html` in any modern browser. That's it. No build step, no server, no installs.

## What's Missing / Next Steps
- Three.js shaded preview instead of wireframe
- Multi-part STL support
- Export quote as PDF
- Integration with Bambu Lab API for live machine status
- Save quotes to localStorage for returning customers
- Color/multi-material pricing
