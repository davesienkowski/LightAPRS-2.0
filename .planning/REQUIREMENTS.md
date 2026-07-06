# Requirements — LightAPRS 2.0 Field-Recovery (N8EPK)

Derived from PROJECT.md Active requirements + research SUMMARY.md. All v1 items are hypotheses until confirmed on the physical board.

## v1 Requirements

### Diagnosis (DIAG)
- [ ] **DIAG-01**: Bench operator can see a documented visual inspection of the whole board — corrosion sites, cold/oxidized joints, and hidden-risk areas beyond the antenna feed (ground pads, Si5351, MAX-M8Q package, power ICs) — not just the one macro photo.
- [ ] **DIAG-02**: Power-rail integrity is verified before full power-up — 3V3 rail present and stable, VBat/supercap input sane, buck-boost "power good" — using a current-limited PSU and a current meter to avoid driving a short.

### Flash / MCU Bring-up (FLASH)
- [ ] **FLASH-01**: The SAMD21 enumerates over USB and its bootloader is reachable (double-tap reset), with the real unit's app-mode and bootloader-mode VID:PID identified.
- [ ] **FLASH-02**: A reproducible flash path is established (compile in WSL, upload via Windows-native `arduino-cli.exe`, SAMD core pinned 1.8.12) and known-good firmware is written to the board.
- [ ] **FLASH-03**: DEVMODE-enabled diagnostic firmware is built and flashed, printing per-subsystem status over USB serial.

### GPS (GPS)
- [ ] **GPS-01**: The MCU↔MAX-M8Q bus (UART or I2C — TBD on real board) is confirmed working via raw serial/NMEA output, before attributing any fault to the antenna.
- [ ] **GPS-02**: The GPS acquires a fix (sats > 0, valid lat/lon) with clear sky view; if the bus is good but no fix, the antenna feed / L1 area is reworked and re-tested.

### Sensor (SENS)
- [ ] **SENS-01**: The BMP180 returns valid temperature and pressure over I2C.

### RF / Transmit (RF)
- [ ] **RF-01**: The Si5351 clock output is verified present before the PA is enabled.
- [ ] **RF-02**: The DRA818V transmits into a 50 Ω dummy load (never bare) at the configured 2 m frequency, with power confirmed.

### Test Tooling (TOOL)
- [ ] **TOOL-01**: Isolated per-subsystem self-test sketches exist, emitting structured `SELFTEST:<SUBSYSTEM>:<PASS|FAIL>:<key=value>` serial lines for fault localization.
- [ ] **TOOL-02**: An SDR receive+decode pipeline (`rtl_fm | direwolf`) is set up to capture and decode 2 m APRS frames independently of the tracker.

### End-to-End Validation (VALID)
- [ ] **VALID-01**: The recovered tracker produces a GPS fix + BMP180 data, assembles and transmits an APRS packet, and that packet is independently decoded on the SDR. *(Core Value)*

## v2 Requirements (Deferred)

- [ ] Serial logging/parsing scripts beyond a basic monitor
- [ ] u-center-based GPS configuration tuning
- [ ] DRA818V AT-command interrogation tooling
- [ ] Conformal re-coat / weatherproofing for a future re-flight
- [ ] SWD/JTAG hard-brick recovery path (only if a bricking event occurs)

## Out of Scope

- WSPR / LightAPRS-W variant — different board and firmware; not the recovery target.
- Board redesign or PCB respin — this is a repair, not a new build.
- Actual balloon flight mission — recovery proves bench function; flight is a separate future effort.
- RF range / antenna optimization — bench validation only, not field-range tuning.

## Traceability

<!-- Filled by roadmapper: maps each REQ-ID to its phase. -->

| REQ-ID | Phase |
|--------|-------|
| (pending roadmap) | — |
