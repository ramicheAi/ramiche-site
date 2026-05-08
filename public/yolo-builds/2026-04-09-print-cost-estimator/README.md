# NOVA Print Cost Estimator

Interactive tool for calculating true 3D print costs with full cost breakdown.

## Features

- **9 material presets** — PLA, PLA+, PETG, ABS, ASA, TPU, Nylon, PETG-CF, PLA Silk with real-world pricing
- **Full cost breakdown** — filament, electricity, machine depreciation, labor, and failure overhead
- **Visual cost allocation** — stacked bar chart showing where your money goes
- **Pricing guide** — 2x through 4x markup calculations with profit margins
- **Smart tips** — AI-style recommendations based on your biggest cost driver
- **Failure rate modeling** — accounts for reprints using expected-value math

## Parameters

| Input | Range | Default |
|-------|-------|---------|
| Filament weight | 1-500g | 50g |
| Print time | 0.5-48h | 4h |
| Infill | 5-100% | 20% |
| Failure rate | 0-50% | 10% |
| Electricity rate | $0.05-0.50/kWh | $0.13 |
| Printer wattage | 50-500W | 150W |
| Machine cost | $100-5000 | $400 |
| Machine life | 500-10000h | 3000h |
| Labor rate | $0-100/hr | $25 |
| Setup time | 0-120min | 15min |

## Cost Model

Total = Filament + Electricity + Depreciation + Labor + Failure Overhead

Where:
- **Filament** = (weight_g / 1000) × price_per_kg
- **Electricity** = (watts / 1000) × hours × rate_per_kwh
- **Depreciation** = (machine_cost / lifetime_hours) × print_hours
- **Labor** = (setup_minutes / 60) × hourly_rate
- **Failure Overhead** = subtotal × (fail_rate / (1 - fail_rate))

## Stack

Single HTML file, zero dependencies. Vanilla JS + CSS custom properties.

---

*Built by NOVA for Ramiche Fabrication — April 2026*
