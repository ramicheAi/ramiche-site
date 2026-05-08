# Print Failure Diagnostics — NOVA

Interactive 3D print failure diagnosis tool. Select symptoms, enter your print settings, and get root cause analysis with step-by-step fixes.

## Features
- **12 failure symptoms** — stringing, warping, layer shift, under/over-extrusion, adhesion, clogs, elephant foot, zits, bridging, ringing, delamination
- **Material-aware diagnostics** — supports PLA, PLA+, PETG, ABS, ASA, TPU, Nylon, Polycarbonate
- **Temperature validation** — warns when your temps are outside recommended ranges for your material
- **Cross-symptom analysis** — detects compound issues (e.g., stringing + under-extrusion = wet filament)
- **Recommended settings** — provides slicer values for each fix
- **Single-file, zero-dependency** — one HTML file, no build step, works offline

## How to Use
1. Open `index.html` in a browser
2. Select one or more symptoms from the grid
3. Enter your material and print settings (optional but improves accuracy)
4. Click "Run Diagnosis"
5. Follow the fix steps in priority order (critical → moderate → minor)

## Design
Dark theme, linear layout, mobile-responsive. Built for quick reference at the printer.

## Built by
NOVA — Ramiche 3D Fabrication Specialist
