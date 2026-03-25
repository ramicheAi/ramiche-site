# FD: Bambu Lab A1 Live Monitor

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-09 01:00

## Objective
Real-time MQTT telemetry dashboard for the Bambu Lab A1 printer — shows print progress, temperatures, speed, fans, layers, machine state, and event log in a single self-contained HTML file.

## Acceptance Criteria
- [x] Single HTML file, zero dependencies, opens in any browser
- [x] Demo mode with realistic heating → leveling → printing → complete lifecycle
- [x] MQTT connection handler ready for Paho MQTT.js (Bambu report topic parser)
- [x] Print progress with percentage, ETA, elapsed, layers, weight tracking
- [x] Temperature gauges (nozzle + bed) with target tracking and color-coded fills
- [x] Speed display with Bambu speed profiles (Silent/Standard/Sport/Ludicrous)
- [x] Fan monitoring (part cooling + aux)
- [x] Machine state indicator (Idle/Heating/Leveling/Printing/Paused/Complete/Error)
- [x] Event log with timestamps and severity types
- [x] Responsive layout (desktop/tablet/mobile)
- [x] Ambient particles (Living Experience philosophy)

## What Worked / What Didn't
Straightforward build — the Bambu Lab MQTT protocol is well-documented so parsing the report topic was clean. The main gap is browser-to-printer connectivity: browsers can't do raw TLS MQTT, so a WebSocket proxy (websockify on port 8884) is needed for live use. Demo mode covers this gap for now with a realistic multi-phase simulation. The dashboard fills a gap identified in the Mar 5 PrintQueue build ("next step: MQTT integration"). Key design decision: used a full-width progress card spanning the grid for visual hierarchy, with temp/speed/fan cards below in a 3-column layout. Color-coded temperature values (cold → warm → hot) give instant visual feedback without reading numbers.
