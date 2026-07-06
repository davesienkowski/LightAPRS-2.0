# Project Research Summary

**Project:** LightAPRS 2.0 Field-Recovery (N8EPK)
**Domain:** Brownfield embedded hardware recovery / bench bring-up (weather-damaged ATSAMD21 APRS tracker) with supporting WSL2 flashing and RTL-SDR verification tooling
**Researched:** 2026-07-05
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is not a greenfield build — it is a **gated hardware-recovery and bring-up job** on a single physical LightAPRS 2.0 board (ATSAMD21G18 + MAX-M8Q GPS + BMP180 + Si5351/DRA818V VHF radio) that was left outdoors and shows corrosion concentrated at the GPS1003 antenna feed. All four researchers converged on the same central artifact: a **hard-gated diagnostic pipeline** — inspect → power rails → MCU alive/flashable → non-RF peripherals (GPS, BMP180) → RF path (Si5351, then DRA818V **into a dummy load only**) → independent SDR end-to-end validation. Each stage is a precondition for the next; skipping ahead produces false signals (the classic being a "GPS won't fix" symptom that is really a starved 3V3 rail or a UART/baud mismatch). The way experts do this is to fail fast and cheap at the lowest stage, using isolated per-subsystem self-test sketches rather than debugging inside the full flight firmware.

The recommended approach leans heavily on what already exists in-tree. The stock firmware contains a `DEVMODE` compile flag (commented out at line 27) that already prints GPS sats/lat/long/alt and BMP180 temp/pressure over USB serial — enabling it is a near-zero-cost diagnostic win, not new work. The vendored library set ships standalone example sketches (BMP085test, SparkFun u-blox NMEA read, Si5351) that serve as drop-in per-subsystem tests. Firmware is pinned to `arduino:samd@1.8.12` (newer cores throw `bad CPU type in executable`), and the load-bearing external tool is the RTL-SDR receive chain (`rtl_fm | direwolf`), which is **not optional** — because there is no second APRS station, SDR decode is the only independent proof that a real, standards-compliant APRS packet was transmitted.

The key risks are concrete and well-documented. First, **flashing reality**: the board uses the Arduino M0 (`mzero_bl`) bootloader over native USB via avrdude/stk500v2, and its VID:PID changes between app and bootloader mode, so usbipd/WSL2 loses the port on every reset — the mitigation is a Windows-native `arduino-cli.exe` upload path (compile in WSL, flash from Windows) as the primary route, with double-tap reset to force bootloader mode. Second, **diagnostic tunnel vision**: the exact-board precedent traced a MAX-M8Q "Sats:0" to an L1 inductor defect plus antenna mismatch — *not* the visible feed corrosion — so inspection must widen beyond the one photo to every QFN and ground pad, and GPS debugging must verify raw serial output before blaming the antenna. Third, the **safety gate**: never key the DRA818V PA without a dummy load/antenna — an avoidable, irreversible self-inflicted failure.

## Key Findings

### Recommended Stack

Flashing, RX verification, and bench repair are the three tool tracks (firmware itself is already established and out of scope for re-research). The pinned SAMD core and the SDR decode chain are verified against current official sources; bench-repair specifics are standard electronics-repair practice rather than board-specific docs.

**Core technologies:**
- `arduino:samd@1.8.12` + arduino-cli (`mzero_bl` FQBN, avrdude/stk500v2 over native USB) — compile/flash the SAMD21 — pinned because newer cores break the upload tool; verify version before every session
- Windows-native `arduino-cli.exe` upload (compile in WSL) — primary flash path — removes the usbipd/WSL2 USB-reenumeration failure axis entirely; usbipd-win 5.3.0 `--auto-attach` is the fallback
- `rtl_fm | direwolf` (v1.8.1, Linux or native Windows) — RTL-SDR APRS receive/decode — the only independent TX proof; direwolf's multi-slicer out-decodes multimon-ng on weak bench packets
- Bench diagnosis kit — current-limited PSU, USB inline current meter, DMM (continuity + resistance), 10-40x magnification, hot-air rework, 99% IPA, no-clean flux, conformal coat, 50-ohm dummy load — safe power-up and corrosion rework
- Supporting: `multimon-ng` (decode cross-check), u-center/UBX (per-satellite CN0 to distinguish degraded-vs-dead antenna), SDR++/gqrx (waterfall carrier confirmation)

### Expected Features

"Features" here = verification steps in the recovery workflow plus small supporting tools. HIGH confidence — grounded in the actual vendored firmware source.

**Must have (table stakes — recovery isn't "done" without these):**
- Visual/electrical damage triage (continuity, corrosion, cold joints)
- Power-rail verification (USB 5V, 3V3, buck-boost power-good, VBat path) — first gate
- USB enumeration + resolved flash path + successful reflash — proves MCU + bootloader alive
- GPS fix confirmed (sats > 0, valid coordinates) — Core Value, gated on antenna repair
- BMP180 temp/pressure read over I2C
- VHF transmit into dummy load (RF present, correct frequency, safety-gated)
- End-to-end: GPS fix + APRS packet independently decoded via SDR

**Should have (differentiators, low cost / high leverage):**
- Enable existing `DEVMODE` serial self-test — already in-tree, just uncomment + reflash
- Standalone per-subsystem test sketches — already vendored as library examples
- u-center/UBX signal-quality inspection — quantifies antenna degradation vs. fix/no-fix
- Scripted serial logger (pyserial) + repeatable pass/fail checklist — audit trail across rework iterations

**Defer (v2+ / explicitly out of scope):**
- Custom GUI/dashboard, reusable multi-board test framework, custom APRS decoder, CI harness
- DRA818V raw AT-command scratch sketch (only if integrated TX fails and needs isolation)
- Flight/field test and RF range tuning — separate future milestone

### Architecture Approach

The architecture is a **gated diagnostic pipeline**, not a runtime software design. Work lives in new `self-test/` sketch folders (one isolated subsystem each, emitting a structured `SELFTEST:<SUBSYSTEM>:<PASS|FAIL>` serial line), a host-side `sdr-verify/` directory kept deliberately decoupled from the tracker's own output, and a dated `hardware-diagnostics/notes.md` log that maps 1:1 to the gating stages. Vendored firmware and libraries are reused, never restructured.

**Major components / stages:**
1. Power subsystem — buck-boost → stable 3V3, power-good; verified with meter, no firmware
2. MCU (ATSAMD21G18) — boot + flashability via `mzero_bl` bootloader; the base proof before any peripheral read is trusted
3. Non-RF peripherals — GPS (MAX-M8Q over UART/I2C) and BMP180 (I2C), each validated independently over its bus
4. RF path — Si5351 frequency verified *before* DRA818V is keyed, DRA818V always into a load
5. Independent SDR verifier — RTL-SDR + direwolf on the PC, never sharing clock/power/code with the tracker

### Critical Pitfalls

1. **Diagnostic tunnel vision on the visible corrosion** — the exact-board precedent found "Sats:0" caused by an L1 inductor defect + antenna mismatch, not the feed corrosion in the photo. Widen Stage-0 inspection to every QFN/fine-pitch package and ground pad; check feed *and* 2+ ground pads for continuity, not just the one joint.
2. **Assuming "no GPS fix" is an antenna/RF problem** — verify raw serial first: a healthy module streams NMEA/UBX continuously even at 0 sats. Total silence = power/UART/baud/protocol issue; sentences-but-zero-sats with clear sky = RF/antenna. Structure GPS tests as "confirm serial link, then confirm acquisition."
3. **Keying the DRA818V PA with no load** — irreversible, silent, self-inflicted. Make "load attached, confirmed" a hard scripted pre-check gating *any* TX-capable code, including ad hoc test sketches.
4. **SAMD core drift + bootloader/COM-port confusion over usbipd** — pin/verify `arduino:samd@1.8.12` every session; the board re-enumerates to a different port in bootloader mode and usbipd/WSL2 drops the attachment mid-upload. Prefer Windows-native flashing; double-tap into bootloader before invoking upload; never hardcode a stale `-p` port.
5. **Rework that looks fixed but re-corrodes / power-path phantoms** — clean no-clean flux with 99% IPA + conformal coat; test USB-only and VBat-only power independently before combined (backfeed / brown-in from supercap inrush mimics peripheral faults). Config-review callsign (N8EPK) and 144.390 MHz before first TX; validate the SDR RX chain against a known-good external signal before trusting a negative result.

## Implications for Roadmap

Based on research, the suggested phase structure follows the gated bring-up order directly — the architecture *is* the roadmap. Coarse granularity matches PROJECT.md's diagnose → repair → reflash → validate intent.

### Phase 1: Diagnose (inspect + power path)
**Rationale:** No power may be applied to a downstream test until inspection and the power rail are proven — a "dead MCU" is very often a starved 3V3 rail, and moisture damage is rarely confined to the visible site.
**Delivers:** Corrosion/continuity map (widened beyond the antenna photo to all QFNs + ground pads), verified 3V3/power-good, current-limited power-up, single-source-then-combined power validation.
**Addresses:** Damage triage + power-rail verification (table stakes).
**Avoids:** Tunnel vision on visible corrosion; USB+VBat backfeed and supercap brown-in false faults.

### Phase 2: Reflash / MCU bring-up
**Rationale:** MCU must boot and take firmware before any peripheral read counts as a "real" failure.
**Delivers:** Resolved flash path (Windows-native arduino-cli primary, usbipd fallback), verified `arduino:samd@1.8.12`, a minimal blink self-test proving flash + boot, DEVMODE enabled, and the structured `SELFTEST:` serial convention established.
**Uses:** arduino-cli / `mzero_bl` (avrdude/stk500v2), double-tap reset, DEVMODE enable.
**Implements:** MCU stage; establishes `self-test/` structure.
**Avoids:** Core-version `bad CPU type`; bootloader/COM-port confusion; usbipd mid-upload drop.

### Phase 3: Non-RF peripheral validation (GPS + BMP180)
**Rationale:** Independent bus-level validation before trusting integrated firmware; GPS gated behind antenna-feed repair but preceded by a raw-serial link check.
**Delivers:** BMP180 read, GPS raw-serial confirmation → satellite acquisition (outdoors, 10+ min), optional UBX/CN0 diagnosis; antenna feed + ground-pad rework if needed.
**Addresses:** GPS fix + BMP180 read (table stakes); DEVMODE + per-subsystem sketches + u-center (differentiators).
**Avoids:** Misattributing no-fix to antenna; impatient cold-start judgment; feed-only resolder; re-corroding flux residue.

### Phase 4: RF path + SDR end-to-end validation
**Rationale:** Highest-risk stage last; Si5351 frequency confirmed before the DRA818V is keyed, always into a dummy load; end-to-end proof requires the SDR because there is no second station.
**Delivers:** Si5351 tone verification, DRA818V short low-power burst into 50-ohm load, config review (144.390 MHz + N8EPK), full flight firmware run, and independent `rtl_fm | direwolf` decode of a real APRS frame with correct fields.
**Addresses:** VHF TX + SDR receive/decode + end-to-end (table stakes / load-bearing differentiator).
**Avoids:** Keying PA with no load; wrong region frequency / stale config; RTL-SDR sample-rate/gain/de-emphasis misconfiguration false negatives.

### Phase Ordering Rationale

- Order is dictated by the hard-gated dependency chain all four researchers converged on — each stage front-loads cheap, low-risk checks (meter, visual) before expensive/destructive ones (keying a PA).
- Grouping GPS + BMP180 into one non-RF phase reflects the shared-bus architecture and lets a self-test isolate bus-level contention from a single sensor fault.
- SDR is placed in the final phase (not as separate tooling) because it is the substitute for a second APRS station — load-bearing for Core Value, not optional.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Reflash):** the WSL2/usbipd vs. Windows-native flashing decision has real, board-specific re-enumeration timing failure modes — worth a `--research-phase` pass to lock the exact upload procedure before executing.
- **Phase 3 (GPS):** the exact GPS bus wiring (UART vs I2C) and the L1-inductor precedent warrant verifying pinout against the physical board and the "Sats:0" forum thread before committing to a repair plan.

Phases with standard patterns (can skip research-phase):
- **Phase 1 (Diagnose):** standard bench bring-up (current-limited power, continuity) — well-documented, though the widened-inspection emphasis must carry through.
- **Phase 4 (SDR decode):** `rtl_fm | direwolf` AFSK1200 recipe is a well-established pattern; just apply the documented APRS-specific settings.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Flashing + RX chain verified against official sources (ArduinoCore-samd 1.8.12 boards.txt, direwolf/usbipd releases); bench-repair specifics are general best practice, no GPS1003-specific guide found |
| Features | HIGH | Grounded in the actual vendored firmware source (DEVMODE, Serial1/DRA818V, vendored example sketches) + PROJECT.md |
| Architecture | HIGH (ordering) / MEDIUM (board specifics) | Gated bring-up + RF-into-load are multi-source standard; exact GPS bus/pin mapping inferred from repo, not bench-verified |
| Pitfalls | MEDIUM-HIGH | SAMD/BOSSA/WSL2/direwolf claims verified incl. official docs + GitHub issues; DRA818V PA-damage-without-load is vendor/community consensus, not lab-measured |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GPS bus wiring (UART vs I2C) and exact pin mapping:** documentation-level inference only — verify against the physical board + `images/lightaprs-2-0-pinout.png` during Phase 3.
- **L1 inductor / antenna-mismatch precedent:** the "Sats:0" root cause on this exact board may not be the visible corrosion — hold this hypothesis open during Phase 1/3 inspection rather than assuming the feed joint is the whole story.
- **usbipd high-rate RTL-SDR stability + PowerShell binary-pipe integrity:** flagged LOW — prefer native-Windows or `rtl_tcp` bridging and run pipes from `cmd.exe`; validate empirically in Phase 4.
- **Bench-repair procedure specifics (hot-air on GPS1003, conformal coat masking):** best-practice guidance, not a board-specific procedure — validate against the actual joint under magnification before rework.
- **SWD/JTAG recoverability if bootloader itself is corrupted:** confirm debug pads exist/are accessible on this board revision before assuming a full-brick is recoverable.

## Sources

### Primary (HIGH confidence)
- Vendored firmware source (`LightAPRS-2-hab.ino`, library example sketches) — DEVMODE flag, Serial1/DRA818V UART, vendored BMP085/u-blox/Si5351 examples
- `ArduinoCore-samd` @ tag 1.8.12 `boards.txt`/`platform.txt` — `mzero_bl` FQBN, upload tool/protocol, dual app-vs-bootloader VID:PID
- PROJECT.md / repo README — Core Value, active requirements, hardware spec, dummy-load safety, SAMD 1.8.12 constraint
- u-blox MAX-M8 datasheets / receiver protocol spec — RF_IN/antenna feed, cold-start TTFF, NMEA/UBX/baud config
- direwolf, usbipd-win, Microsoft WSL-USB official docs/releases

### Secondary (MEDIUM confidence)
- Arduino Forum "Sats:0 on LightAPRS 2.0 / MAX-M8Q" — exact-board L1-inductor + antenna-mismatch precedent
- arduino-cli #1943, arduino-ide #1648, Adafruit ATSAMD21 bootloader-restore, avdweb — double-tap recovery, port cycling
- jj1bdx gist + Kevin Hooke — canonical `rtl_fm | direwolf` AFSK1200 recipe; RTL-SDR Blog quick-start
- Thea Flowers / Microchip — SAMD21 BOD33 default-disabled / brown-in risk
- Board bring-up references (Circuit Cellar, Cadence, embeddedprep, Hubble)

### Tertiary (LOW confidence)
- General PCB-cleaning/rework guides (Chemtronics, CircuitNet, Kinghelm) — 99% IPA, no-clean flux, chip-antenna resolder — no GPS1003-specific source
- DRA818V datasheet — PA-damage-without-load is vendor/community consensus, not independently lab-verified
- PowerShell raw-binary-pipe integrity concern — not re-confirmed this pass; cheap to avoid via cmd.exe/SDR++

---
*Research completed: 2026-07-05*
*Ready for roadmap: yes*
