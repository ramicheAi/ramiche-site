# Bambu Lab A1 — Live Monitor

Real-time printer status dashboard for the Bambu Lab A1. Connects via MQTT over LAN to display print progress, temperatures, speed, fan status, layer info, and machine state — all in a single self-contained HTML file.

## How to Run

Open `index.html` in any browser.

### Demo Mode
Click **Demo Mode** to see a simulated print job (Galactik Antics phone case) with realistic heating → leveling → printing → complete lifecycle.

### Live Connection
For real printer telemetry, you need:
1. A WebSocket MQTT proxy (e.g., `websockify` or Mosquitto with WS listener) bridging port 8884 to the A1's MQTT on port 8883
2. The Paho MQTT JavaScript library loaded in the page
3. Your printer's LAN access code and serial number

The dashboard parses the standard Bambu Lab MQTT `device/{serial}/report` topic with all known telemetry fields.

## Features

- Live print progress with percentage, ETA, elapsed time, layer count
- Nozzle & bed temperature with target tracking and color-coded gauges
- Print speed with Bambu speed profiles (Silent/Standard/Sport/Ludicrous)
- Part cooling & aux fan monitoring
- Machine state detection (Idle/Heating/Leveling/Printing/Paused/Complete/Error)
- Event log with timestamped entries
- Ambient particle background (Living Experience philosophy)
- Fully responsive (desktop/tablet/mobile)
- Zero dependencies — single HTML file, no build step

## What's Missing / Next Steps

- **WebSocket proxy setup** — need `websockify` or similar to bridge browser WS to A1's raw MQTT
- **Paho MQTT bundle** — inline the Paho library for zero-config live connection
- **Print history** — log completed prints to localStorage
- **Camera feed** — A1 streams JPEG over RTSP; could embed as img refresh
- **Integration with PrintQueue** — link to the production queue manager for job lifecycle
- **Notifications** — browser push when print completes or errors

## Tech

- Vanilla HTML/CSS/JS, zero dependencies
- MQTT protocol handler ready for Paho MQTT.js
- Bambu Lab A1 report topic parser (nozzle_temper, bed_temper, mc_percent, layer_num, spd_lvl, etc.)
- ~450 lines
