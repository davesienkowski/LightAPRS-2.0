# Roadmap: LightAPRS 2.0 Field-Recovery (N8EPK)

## Overview

This is a hard-gated hardware bring-up of a single weather-damaged LightAPRS 2.0 board, performed at a bench and assisted by firmware/tooling. The journey follows the diagnostic dependency chain every researcher converged on: inspect the board and prove its power rails, bring the SAMD21 MCU alive and flashable, validate the non-RF peripherals on their buses (GPS raw-serial-first, then antenna rework; BMP180), and finally bring up the RF path into a dummy load and prove — via an independent SDR decode — that the tracker powers up, gets a GPS fix, and transmits a decodable APRS packet. Each phase is a gate the next depends on; failing fast and cheap at the lowest stage avoids the classic false signals (a "GPS won't fix" symptom that is really a starved 3V3 rail).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Diagnose — Inspection & Power Path** - Map all board damage and prove power rails are safe/correct before any downstream test.
- [ ] **Phase 2: MCU Bring-up & Reflash** - Boot the SAMD21, establish a reproducible flash path, and stand up the self-test/serial convention.
- [ ] **Phase 3: Non-RF Peripherals — GPS & BMP180** - Validate GPS (serial-first, then fix) and the BMP180 sensor on their buses.
- [ ] **Phase 4: RF Path & SDR End-to-End Validation** - Bring up TX safely into a dummy load and independently decode a real APRS packet (Core Value).

## Phase Details

### Phase 1: Diagnose — Inspection & Power Path
**Goal**: The board's physical condition is fully mapped and its power rails are proven safe and correct, so no downstream test is trusted on a starved rail or a hidden short.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DIAG-01, DIAG-02
**Success Criteria** (what must be TRUE):
  1. A dated inspection log maps every corrosion site, cold/oxidized joint, and suspect QFN/ground pad across the WHOLE board (not just the antenna macro), with continuity confirmed on the GPS feed AND 2+ ground pads.
  2. Under a current-limited PSU with an inline current meter, the 3V3 rail reads 3.3V ±5% under load with no current runaway (no short).
  3. Buck-boost "power good" asserts and the VBat/supercap input measures a sane voltage on a DMM.
  4. The board powers cleanly on USB-only and VBat-only independently (no backfeed / supercap brown-in false fault) before combined power is applied.
**Plans**: TBD

### Phase 2: MCU Bring-up & Reflash
**Goal**: The SAMD21 boots, accepts a reproducible reflash, and reports subsystem status over serial — establishing the self-test convention that downstream phases build on.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: FLASH-01, FLASH-02, FLASH-03, TOOL-01
**Success Criteria** (what must be TRUE):
  1. The SAMD21 enumerates over USB and its bootloader is reachable via double-tap reset, with the real unit's app-mode and bootloader-mode VID:PID recorded.
  2. Known-good firmware compiles in WSL and flashes via Windows-native `arduino-cli.exe` (SAMD core verified `1.8.12`); a minimal blink/self-test sketch confirms boot after flash.
  3. DEVMODE-enabled diagnostic firmware runs and prints per-subsystem status over USB serial.
  4. An isolated per-subsystem self-test sketch exists and emits a structured `SELFTEST:<SUBSYSTEM>:<PASS|FAIL>:<key=value>` line over serial.
**Plans**: TBD

### Phase 3: Non-RF Peripherals — GPS & BMP180
**Goal**: The GPS and pressure sensor are validated independently on their buses — GPS proven at the serial link first, then driven to a satellite fix, with antenna rework only if warranted.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: GPS-01, GPS-02, SENS-01
**Success Criteria** (what must be TRUE):
  1. The BMP180 self-test returns valid temperature and pressure over I2C (`SELFTEST:BMP180:PASS`).
  2. The MCU↔MAX-M8Q link streams raw NMEA/UBX serial (module confirmed alive) BEFORE any antenna fault is diagnosed.
  3. With a clear sky view, the GPS acquires a fix (sats > 0, valid lat/lon) — following antenna-feed/ground-pad rework if the bus is healthy but no fix appears.
**Plans**: TBD

### Phase 4: RF Path & SDR End-to-End Validation
**Goal**: The transmit chain is brought up safely into a dummy load and the recovered tracker's full APRS packet is independently decoded on the SDR — proving Core Value.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: RF-01, RF-02, TOOL-02, VALID-01
**Success Criteria** (what must be TRUE):
  1. The Si5351 clock output is confirmed present (frequency verified) BEFORE the DRA818V PA is enabled.
  2. With a 50 Ω dummy load confirmed attached, the DRA818V transmits a short burst at 144.390 MHz with RF power confirmed (never keyed bare).
  3. The `rtl_fm | direwolf` SDR pipeline captures and decodes 2 m APRS frames, validated against a known-good signal first.
  4. End-to-end: the running flight firmware produces a GPS fix + BMP180 data, transmits an APRS packet, and direwolf independently decodes that frame with the correct callsign (N8EPK) and fields. *(Core Value)*
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diagnose — Inspection & Power Path | 0/TBD | Not started | - |
| 2. MCU Bring-up & Reflash | 0/TBD | Not started | - |
| 3. Non-RF Peripherals — GPS & BMP180 | 0/TBD | Not started | - |
| 4. RF Path & SDR End-to-End Validation | 0/TBD | Not started | - |
