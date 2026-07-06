# LightAPRS 2.0 Recovery Log — N8EPK

**Board:** QRP-Labs LightAPRS 2.0 · ATSAMD21G18 · u-blox MAX-M8Q · BMP180 · Si5351 + Dorji DRA818V
**Problem:** left outdoors too long — suspected moisture/corrosion damage.
**Core Value / "done":** board powers up → gets a GPS fix → transmits an APRS packet decoded independently on the SDR.

> **How to use this doc:** Work top-to-bottom. Each phase is a *gate* — don't start the next until the current one passes. Fill in the **Measured** columns as you go, tick the checkboxes, and add a dated line to the **Running Log** at the bottom each session. This file is the source of truth for "where are we." Full research is in `.planning/research/`; the plan is in `.planning/ROADMAP.md`.

**Status legend:** ⬜ not started · 🔄 in progress · ✅ pass · ❌ fail/blocked · ⏭️ deferred

---

## 🚦 Safety gates (never skip)

1. **Cold-check before power.** Measure rail-to-ground resistance with power OFF. Near 0 Ω = short → do **not** apply power.
2. **Never key the radio without a load.** The DRA818V PA can be destroyed in milliseconds with no antenna/dummy load. No 50 Ω load = no TX. (Wirewound resistors are **not** valid at 144 MHz — metal-film/carbon only.)
3. **Verify raw serial before blaming the antenna.** The known "Sats: 0" failure on this exact board was an L1 inductor + antenna mismatch, not the visible feed. Confirm the GPS *bus* talks before reworking the joint.
4. **Licensed TX only.** On-air 2 m transmit requires the amateur license (N8EPK — held). Dummy-load bench tests are fine regardless.

---

## 📊 Progress dashboard

| Phase | Goal (gate) | Status |
|------|-------------|--------|
| **1 — Diagnose** | Damage mapped; power rails proven safe | 🔄 in progress |
| **2 — MCU Bring-up & Reflash** | SAMD21 boots; reproducible flash path; DEVMODE + self-test | ⬜ |
| **3 — Non-RF Peripherals** | GPS validated serial-first → fix; BMP180 reads | ⬜ |
| **4 — RF Path & SDR Validation** | TX into dummy load; APRS packet decoded (Core Value) | ⬜ |

**Requirement tracker**

| REQ | What | Phase | Status |
|-----|------|-------|--------|
| DIAG-01 | Whole-board visual inspection logged | 1 | ✅ (2026-07-05, from photos; back side pending) |
| DIAG-02 | Power rails proven safe/correct | 1 | 🔄 |
| FLASH-01 | SAMD21 enumerates; bootloader reachable; VID:PIDs recorded | 2 | ⬜ |
| FLASH-02 | Reproducible flash path (WSL compile / Windows upload) | 2 | ⬜ |
| FLASH-03 | DEVMODE diagnostic firmware flashed | 2 | ⬜ |
| TOOL-01 | `SELFTEST:` per-subsystem sketch convention | 2 | ⬜ |
| GPS-01 | MCU↔MAX-M8Q bus streams raw NMEA/UBX | 3 | ⬜ |
| GPS-02 | GPS acquires a fix (sats>0); antenna reworked if needed | 3 | ⬜ |
| SENS-01 | BMP180 valid temp/pressure over I2C | 3 | ⬜ |
| RF-01 | Si5351 clock output confirmed before PA enable | 4 | ⬜ |
| RF-02 | DRA818V TX into 50 Ω dummy load at 2 m | 4 | ⬜ |
| TOOL-02 | `rtl_fm \| direwolf` SDR decode pipeline up | 4 | ⬜ |
| VALID-01 | End-to-end: fix + sensor → TX → decoded as N8EPK | 4 | ⬜ |

---

## 🧰 Equipment on hand (as of 2026-07-05)

- ✅ Digital multimeter
- ✅ Soldering iron, 99% IPA, no-clean flux
- ✅ Through-hole resistors & caps, assorted wire
- ✅ NooElec RTL-SDR + antenna (→ SDR validation, Phase 4)
- ❌ Current-limited bench PSU → **power via USB, after cold checks**
- ❌ Hot-air → not needed unless lifting the MAX-M8Q (avoid)
- ❌ 50 Ω dummy load → **needed before Phase 4** (build from metal-film R's or buy QRP Labs 50 Ω/20 W)

**Build environment (ready):** arduino-cli + `arduino:samd@1.8.12`; all 3 sketches compile in WSL. Upload path TBD (Windows-native `arduino-cli.exe` recommended — see Phase 2).

---

## 🛒 Materials & shopping list

### Have ✅
| Item | Use |
|------|-----|
| Digital multimeter | DIAG-02 continuity/resistance/voltage |
| Soldering iron | Joint rework, feed-joint repair |
| 99% isopropyl alcohol (IPA) | Clean flux residue / surface film / corrosion |
| No-clean flux | Rework the corroded GPS feed joint |
| Assorted through-hole resistors & caps, wire | Probing, DIY dummy load, jumpers |
| NooElec RTL-SDR + antenna | Phase 4 APRS receive/decode validation |

### Required before proceeding
| Item | Spec / detail | Blocks | Have? |
|------|---------------|--------|-------|
| **Micro-USB (type-B) DATA cable** | Must be a *data* cable, not charge-only | Phase 2 flashing & serial | ⬜ |
| **50 Ω dummy load** | See DIY recipe below, or QRP Labs 50 Ω/20 W kit | Phase 4 TX (RF-02) — **hard gate** | ⬜ |
| **Solder wick / desoldering braid** | 2–2.5 mm | Cleaning the corroded feed joint well | ⬜ |
| **Fresh thin solder** | 0.5–0.8 mm, 60/40 or SAC | Feed-joint rework | ⬜ |
| **Magnification** | Loupe 10× or cheap USB microscope | Inspect QFN/LGA joints, corrosion under parts | ⬜ |

### DIY 50 Ω dummy load (for the 0.5–1 W VHF test)
- **Target:** ~50 Ω, non-inductive, ≥2 W, for **short key-downs only**.
- **Recipe A:** 2× **100 Ω metal-film 2 W** in parallel = 50 Ω / 4 W.
- **Recipe B:** 5× **10 Ω metal-film** in series, or mix to hit ~50 Ω, spreading wattage.
- **CRITICAL:** **metal-film or carbon-film only — NEVER wirewound** (wirewound is highly inductive and useless/misleading at 144 MHz).
- Keep **all leads as short as possible**; connect from the board's VHF antenna feed point to ground. Measure it reads ~50 Ω on the meter before use.
- A commercial QRP Labs 50 Ω/20 W dummy-load kit is the same-manufacturer, no-guesswork alternative.

### Optional / nice-to-have
| Item | Why |
|------|-----|
| USB inline power/current meter | You have no bench PSU — this lets you watch inrush current on USB power-up safely |
| Fiberglass scratch pen or soft brass brush | Mechanical corrosion removal on pads/joints |
| Conformal coating | Re-weatherproof after repair (v2, for re-flight) |
| Hot-air rework station | Only if the MAX-M8Q LGA must be lifted (trying to avoid) |
| Isopropyl-safe swabs / small brush | Precise cleaning around the GPS feed |
| Proper 2 m antenna + coax w/ connector | Eventual on-air test after dummy-load validation |
| Known-good APRS reference (2nd radio / online RX) | Sanity-check the direwolf decode chain before trusting it |

---

## Phase 1 — Diagnose (Inspection & Power Path)  🔄

**Gate:** damage fully mapped and power rails proven safe before any downstream test.

### DIAG-01 — Visual inspection ✅
Summary (full detail in `notes.md`):
- 🔴 **GPS antenna feed** joint (by `L3`): dark/grainy — oxidized flux and/or corrosion. **Primary suspect.**
- 🟡 Whitish surface film near USB / lower-left passives → clean with IPA, re-inspect.
- 🟡 Micro-USB shell dulled/spotted → watch enumeration.
- 🟡 Supercaps: joints OK; ESR possibly degraded if wetted.
- 🟢 Wire terminations sound; no cracks/burns/lifted pads visible.
- ⬜ **Back side not yet photographed** — add photos to `photos/`.

### DIAG-02 — Power-path checks  🔄
**Probe points:** right header pins `3V3` and `GND`; `VBAT` pads by the supercaps.

**A. Cold checks — power OFF, USB unplugged, supercaps discharged.** Meter on Ω (~20 kΩ).

| # | Measurement | Expected | Measured | Pass? |
|---|-------------|----------|----------|-------|
| 1 | VBAT → GND resistance | ⚠️ **Supercaps** make this read LOW then climb slowly as they charge — that's normal, not a short. A *persistent* ~0 Ω that **never climbs** = short → STOP | _____ | ⬜ |
| 2 | 3V3 → GND resistance | Climbs toward kΩ+ as smaller caps charge. Persistent ~0 Ω (no climb) = short → STOP | _____ | ⬜ |

> **Reading resistance across charged capacitors:** a DMM sources a tiny current; big caps (esp. the supercaps on VBAT) soak it up and the displayed resistance *rises* as they charge. Judge by the **trend**, not the first number — a real short is flat at ~0 Ω; a healthy rail starts low and keeps climbing. Discharge caps between retries for a consistent read.
| 3 | GPS feed joint (probe antenna base ↔ its pad, **wiggle antenna**) | Steady low/continuity; **intermittent/jumpy = cracked/corroded joint** | _____ | ⬜ |

**B. Powered checks — only if #1 and #2 are both HIGH (no short).** Plug in USB, meter on DC V.

| # | Measurement | Expected | Measured | Pass? |
|---|-------------|----------|----------|-------|
| 4 | 3V3 → GND voltage | 3.13–3.47 V (3.3 V ±5%) | _____ | ⬜ |
| 5 | Any component hot to touch? | No — hot part = power off NOW | _____ | ⬜ |
| 6 | USB enumerates? (Win "connected" sound / new COM port / `lsusb`) | Device appears (preview of Phase 2) | _____ | ⬜ |

**DIAG-02 verdict:** ⬜ pass / ❌ fault found → _______________________

---

## Phase 2 — MCU Bring-up & Reflash  ⬜
**Gate:** SAMD21 boots, reproducible flash path, DEVMODE + self-test convention up.

- [ ] **FLASH-01** — Record app-mode & bootloader-mode VID:PID (`usbipd list` / Device Manager). Double-tap RESET enters bootloader.
- [ ] **FLASH-02** — Compile in WSL; upload via **Windows-native `arduino-cli.exe`** (core 1.8.12, FQBN `arduino:samd:mzero_bl`). *(Sidesteps the usbipd re-enumeration race — see PITFALLS.)* Blink/boot self-test confirms.
- [ ] **FLASH-03** — Enable DEVMODE (uncomment line ~27 in the chosen sketch); confirm per-subsystem serial prints.
- [ ] **TOOL-01** — Establish `SELFTEST:<SUBSYSTEM>:<PASS|FAIL>:<key=value>` serial convention.

Notes / VID:PID / port:
```
app-mode  VID:PID = ________   port = ________
boot-mode VID:PID = ________   port = ________
```

---

## Phase 3 — Non-RF Peripherals (GPS & BMP180)  ⬜
**Gate:** GPS validated serial-first then to a fix; BMP180 reads.

- [ ] **SENS-01** — BMP180 returns valid temp/pressure over I2C (`SELFTEST:BMP180:PASS`).
- [ ] **GPS-01** — MCU↔MAX-M8Q link streams raw NMEA/UBX (module alive) **before** touching the antenna. Confirm bus type (UART vs I2C) on this board rev.
- [ ] **GPS-02** — Acquire a fix (sats>0, valid lat/lon) with clear sky. **If bus good but no fix → rework the feed joint / inspect L1**, then re-test.

Readings:
```
GPS bus type = ______   raw NMEA seen? ______   sats = ____   fix = ____
BMP180 temp = ______   pressure = ______
```

---

## Phase 4 — RF Path & SDR End-to-End Validation  ⬜
**Gate (Core Value):** TX into a dummy load only; a real APRS packet decoded on the SDR.

- [ ] **Dummy load ready** (50 Ω, metal-film — build or buy). **Do not TX without it.**
- [ ] **RF-01** — Si5351 clock output present before enabling the PA.
- [ ] **RF-02** — DRA818V transmits a short burst at 144.390 MHz into the 50 Ω load; power confirmed.
- [ ] **TOOL-02** — `rtl_fm | direwolf` (v1.8.1) decoding 2 m APRS; validate against a known-good signal first.
- [ ] **VALID-01** — End-to-end: firmware makes GPS fix + BMP180 data → transmits → **direwolf decodes the frame as N8EPK**. 🎉

Decode capture / notes:
```
TX freq = ______   direwolf decoded? ______   callsign in frame = ______
```

---

## 📓 Running log

| Date | Phase | What happened / decided |
|------|-------|-------------------------|
| 2026-07-05 | setup | Cloned & forked repos; arduino-cli + SAMD 1.8.12 build env verified (all 3 sketches compile). GSD project initialized (4-phase roadmap). Fixed WSL hook errors. |
| 2026-07-05 | 1 | DIAG-01 visual inspection from 5 photos — GPS feed corrosion is primary suspect; surface film + USB spotting secondary. Back side not yet photographed. DIAG-02 procedure prepared; awaiting bench readings. |
|  |  |  |

---

## ❓ Open questions / parking lot
- Back-side photos of the board (extend DIAG-01).
- MAX-M8Q bus wiring on this board rev: UART or I2C? (both libs vendored — resolve in Phase 3.)
- Which firmware variant to flash (hab / pico-balloon / vehicle) and its configured TX frequency.
- Dummy load: build from metal-film resistors vs. buy QRP Labs 50 Ω/20 W.
- Does this board rev expose SWD pads (hard-brick recovery insurance)?
