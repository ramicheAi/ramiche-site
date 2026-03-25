# FD: STL Instant Quoter

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-07 01:00

## Objective
Client-side STL file parser with real-time 3D print cost estimation — drag-drop an STL, get geometry analysis + instant quote across 6 materials.

## Acceptance Criteria
- [x] Binary and ASCII STL parsing in-browser (no server)
- [x] Geometry analysis: triangle count, volume (signed tetrahedron method), surface area, bounding box
- [x] Bambu A1 build volume fit check
- [x] 6-material database with real density/pricing
- [x] Infill density slider affects cost calculation
- [x] Quantity selector with volume discounts
- [x] Rotating wireframe 3D preview
- [x] Real-time cost breakdown (material + machine time + setup fee)
- [x] Print time estimation based on volumetric flow rate
- [x] Ambient particles + 72 BPM heartbeat on quote panel

## What Worked / What Didn't
Binary STL parsing via DataView is straightforward — the format is well-documented (80-byte header, 4-byte triangle count, then 50 bytes per triangle). The tricky part is distinguishing binary vs ASCII when a binary file's header starts with "solid" — solved by checking if the binary triangle count produces an expected file size. Volume calculation uses the signed tetrahedron method (vertex-to-origin), which handles arbitrary meshes correctly. The wireframe renderer samples max 2000 triangles for performance — a proper Three.js integration would be better but adds a dependency. Cost model uses a shell + infill interior approach: surface area * wall thickness for shell, remaining volume * infill% for interior, then material density for weight. Machine time is estimated via volumetric flow rate (15 mm3/s base) with per-material speed factors.
