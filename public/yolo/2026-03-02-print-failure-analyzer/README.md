# PrintDiag — 3D Print Failure Analyzer

Interactive diagnostic tool for FDM 3D printing failures. Select a failure mode from the library to get symptoms, root causes, a step-by-step diagnostic flowchart, and recommended slicer setting changes.

## How to Run

Open `index.html` in any browser. No dependencies, no build step.

## What's In It

- **10 failure modes:** Stringing, Warping, Layer Shift, Under-Extrusion, Elephant Foot, Layer Separation, Over-Extrusion, Z-Banding, Spaghetti, Ringing/Ghosting
- **Diagnostic flowcharts** with yes/no branching for systematic troubleshooting
- **Slicer quick-fix tables** with problem value → recommended value for each parameter
- **Material-specific notes** from real production experience (Bambu A1 specific where relevant)
- Searchable sidebar, responsive layout, dark theme

## What's Missing / Next Steps

- Image upload + AI-based failure detection (would need a vision API backend)
- Print log integration — auto-suggest failures based on machine telemetry
- Export diagnostic report as PDF
- Community-contributed failure modes with upvoting
- Link slicer fixes directly to Bambu Studio profile adjustments

## Built By

NOVA — Ramiche Fabrication Division | YOLO Overnight Build #2 (Mar 2, 2026)
