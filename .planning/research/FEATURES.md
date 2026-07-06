# Feature Research

**Domain:** Hardware recovery & bring-up workflow (weather-damaged APRS tracker) + supporting test tooling
**Researched:** 2026-07-05
**Confidence:** HIGH (grounded in the actual vendored firmware source in this repo, plus verified standard ham-radio/embedded bring-up tooling)

## Framing

This is not a consumer product. "Features" here means: (1) verification steps in the recovery workflow, and (2) small tools that support those steps. Table stakes = the minimum verification a competent bring-up engineer would insist on before calling the board "recovered." Differentiators = tooling that makes this recovery faster/more repeatable/more independently verifiable than the bare minimum. Anti-features = scope creep that turns a one-board repair into a product-development effort.

**Key grounding fact (verified by reading the vendored source):** The stock firmware (`LightAPRS-2-hab.ino`, and presumably the `pico-balloon`/`vehicle` variants) already contains a `DEVMODE` compile flag (commented out by default at line 27) that, when enabled, prints GPS sats/lat/long/alt/speed/UTC time, and BMP180 temp/pressure to `SerialUSB` once per cycle, plus warnings on GPS dynamic-model-set failure. The VHF radio (DRA818V) is driven over `Serial1` (a second UART), separate from the USB CDC debug channel. This means **a large fraction of the "self-test sketch" differentiator already exists in-tree** — it needs to be enabled and read, not built from scratch. This significantly lowers the complexity of several items below and should shift roadmap effort toward reading/using existing instrumentation before writing new sketches.

## Feature Landscape

### Table Stakes (Recovery Isn't Done Without These)

Verification steps a competent hardware bring-up would never skip. Missing any of these means "recovered" is an unverified claim.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Visual/electrical damage triage (continuity, corrosion inspection, cold-joint check) | Standard first step before applying power to any water/corrosion-exposed board — prevents shorting a marginal joint into a dead component | LOW | Multimeter continuity + visual inspection under magnification at the known corrosion site (L3 / GPS1003 antenna feed). No tools beyond a DMM and loupe/microscope. |
| Power-rail verification (USB 5V in, 3V3 rail, buck-boost "power good", VBat path) | If the rail is wrong, every downstream subsystem test is meaningless noise | LOW-MEDIUM | DMM at test points; buck-boost regulator has a documented "power good" signal per README spec. Do this **before** GPS/sensor/radio bring-up — it's a hard dependency for all of them. |
| USB enumeration + arduino-cli upload path confirmed | Firmware already compiles (validated); if the board doesn't enumerate/flash, nothing else can be tested | LOW-MEDIUM | Requires resolving WSL2 USB limitation (usbipd-win or Windows-side flash) — already flagged as a project constraint, not a research gap. |
| Successful flash of known firmware variant to SAMD21 | Table stakes for any Arduino-class recovery — "board takes new firmware" is the base-level proof of a working MCU + bootloader | LOW (once USB path resolved) | SAMD21 bootloader (UF2/BOSSA via arduino-cli) is well-documented; no custom tooling needed. |
| GPS fix confirmation (NMEA or UBX, sats > 0, valid lat/long) | Core Value in PROJECT.md explicitly requires a GPS fix — non-negotiable | MEDIUM | Depends on antenna feed repair (known corrosion site). Stock firmware already prints sats/lat/long/alt via DEVMODE — enabling that flag is the fastest path, no new tool required. Community reports (Arduino Forum) confirm "Sats: 0" is a known failure mode on this exact board/module combo — treat persistent 0-sat readings as a diagnostic signal, not just "needs more sky time." |
| BMP180 sensor read (temp + pressure over I2C) | Explicit requirement in PROJECT.md; also a cheap I2C-bus-health proxy (if I2C is dead, GPS I2C mode would be too, though this board uses UART for GPS) | LOW | Already wired into stock firmware's DEVMODE print block (`bmp.readTemperature()`, `bmp.readPressure()`). Adafruit BMP085/180 library is vendored (`LightAPRS_Adafruit_BMP085_Library`) with its own standalone `BMP085test.ino` example — usable in isolation before even touching the full tracker sketch. |
| VHF transmit into dummy load (RF present, correct frequency, no PA damage) | Core Value requires a "decodable APRS packet transmitted" — verifying RF exists at all, safely, is the prerequisite | MEDIUM | **Safety-critical**: DRA818V PA can be damaged transmitting with no load (explicit repo warning, and upstream README repeats it: never upload/power without an antenna or dummy load attached). Driven over `Serial1` UART (AT commands to DRA818V), separate from Si5351 which is used for CW/telemetry generation elsewhere in the APRS chain — confirm which chip actually drives the final PA path in the specific `.ino` variant being flashed before assuming the Si5351 is in the RF chain for voice/packet TX (it's used for oscillator/clock gen in several LightAPRS variants; the DRA818V is the actual FM PA+RX module here). |
| End-to-end pass: GPS fix + transmitted APRS packet independently received/decoded | This is the literal Core Value statement in PROJECT.md — the recovery isn't "done" without it | MEDIUM-HIGH | Depends on every item above plus the SDR receive/decode differentiator below (which becomes load-bearing, not optional, because there's no second APRS station to confirm against). |

### Differentiators (Make Recovery Faster, More Repeatable, More Independently Verifiable)

Not required to declare the board "recovered," but materially reduce risk/time and produce reusable artifacts.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Enable + extend the existing `DEVMODE` serial self-test output | Near-zero-cost win: the diagnostic output already exists in-tree, just disabled. Enabling it turns "does GPS/BMP180 work" from a guess into a one-line serial read | LOW | Just uncomment `#define DEVMODE` (line 27 in `LightAPRS-2-hab.ino`, check other variants for the same flag) and reflash. Extending it (e.g., explicit PASS/FAIL per subsystem, timestamps, boot-reason) is a small incremental change to existing code, not new architecture. |
| Scripted serial monitor/logger (Python + pyserial, or `arduino-cli monitor`) | Manual Arduino Serial Monitor is fine for one look; a script lets you capture timestamped logs across multiple power cycles/repairs, diff before/after a rework, and grep for "Sats: 0" vs a real fix | LOW-MEDIUM | Straightforward pyserial script; no protocol parsing needed if just tailing DEVMODE text output. WSL/Windows COM-port access constraint (already flagged) applies here too. |
| Standalone per-subsystem test sketches (BMP180-only, GPS-only via SparkFun u-blox library examples, Si5351-only) run *before* the full tracker sketch | Isolates a failure to one subsystem instead of debugging the full integrated stack; especially valuable given known corrosion may have degraded one path (I2C vs UART vs RF) independently | LOW | **Already vendored** — `LightAPRS_Adafruit_BMP085_Library/examples/BMP085test`, `SparkFun_Ublox_Arduino_Library-master/examples/Example1_BasicNMEARead` (and ~20 more), `ZeroSi4463/examples/Basic_Usage`, `LightAPRS_Si5351Arduino/examples/si5351_example`. These are drop-in `.ino` sketches, not something to write — just needs identifying pin/library config differences from the LightAPRS board wiring. |
| UBX-protocol inspection via u-center (or a minimal Python UBX parser) instead of NMEA-only | NMEA only tells you "fix or no fix"; UBX gives satellite CN0 (signal strength per satellite), which distinguishes "antenna feed is degraded but working" from "antenna is dead" — directly relevant to the suspected corroded GPS1003 joint | MEDIUM | u-center is Windows-native freeware from u-blox, works directly over the enumerated COM port — no WSL USB forwarding needed if run from Windows side. This is the single highest-value diagnostic tool for the specific damage observed (antenna feed corrosion) because it quantifies signal degradation rather than just fix/no-fix. |
| SDR receive-and-decode pipeline (RTL-SDR → `rtl_fm` or `direwolf` direct RTL-SDR support → AFSK1200 decode → readable APRS frame) | Independent, off-board proof that the transmitted signal is a real, standards-compliant APRS packet (not just "RF is present at some frequency") — the only way to validate TX correctness without a second APRS station or a spectrum analyzer | MEDIUM | Verified tooling: `direwolf` (has native `-r`/rtl_fm-pipe support and can also open RTL-SDR directly via `-D`), `multimon-ng` (`rtl_fm -f 144.39M | multimon-ng -t raw -a AFSK1200 -A -`) are the two standard open-source paths, both actively maintained. Frequency must match whatever the flashed firmware variant is configured for (README notes 144-146 MHz configurable in code — confirm the exact TX frequency in the specific `.ino` before tuning the SDR). This is Linux/WSL-friendly (rtl-sdr tools run natively in WSL with USB passthrough via usbipd-win, same mechanism already needed for flashing). |
| Repeatable pass/fail checklist (markdown or spreadsheet) tied to each subsystem test | Turns ad hoc "I think it works" into an auditable record — useful given this is a physical repair that may need re-verification after each rework attempt (e.g., reflow the antenna joint, retest, still fails, try again) | LOW | Pure documentation artifact; no engineering complexity. High leverage for a project with iterative physical repair (you will likely retest the same subsystem multiple times). |
| Minimal register-poke / raw AT-command scratch sketch for the DRA818V | Lets you independently confirm the DRA818V module itself (not just the integrated APRS stack) responds to AT commands and reports its own status/RSSI, isolating "radio module is dead" from "firmware TX logic is wrong" | LOW-MEDIUM | DRA818V AT command set is public/well-documented (Dorji datasheet); a ~30-line sketch sending `AT+DMOCONNECT`/`AT+DMOSETGROUP` over `Serial1` and reading the response is enough. Not currently vendored as a standalone example in this repo — would need to be written, but it's small. |

### Anti-Features (Do Not Build These for a One-Board Recovery)

Things that look like reasonable engineering investment but are disproportionate for a single-board repair-and-validate effort.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Custom GUI/dashboard for telemetry or test results | "Would be nice to see it visually" | Full UI development is out of proportion to a single-board bring-up; PROJECT.md's Core Value is fix-and-prove, not build-a-tool-product | Read `DEVMODE` serial text directly, or pipe to a plain-text log file. A spreadsheet/markdown checklist covers the record-keeping need. |
| General-purpose reusable APRS test framework / library | "This could be useful for future boards" | Scope creep — turns a repair job into a tooling product; also risks becoming a distraction from the actual physical repair, which is the hard/uncertain part | Write throwaway or minimally-reusable scripts scoped to this board; if a genuine reusable need emerges later, that's a separate future project. |
| PCB rework beyond the identified damage (full reflow, new antenna, board respin) | "While we're in there, why not improve it" | PROJECT.md explicitly scopes this as repair-not-redesign; broader rework introduces new unknowns and risks turning a diagnosable failure into an undiagnosable one | Repair only the identified corrosion/damage sites; if a second failure is found during testing, diagnose and repair that specifically, don't preemptively rework untested areas. |
| Field/flight test (balloon launch, long-range RF test) | "The real proof is a flight" | PROJECT.md explicitly puts flight mission out of scope for this milestone — bench validation is the deliverable | Bench-top GPS fix + dummy-load TX + SDR decode is the defined "done." Flight is a separate future milestone. |
| Custom APRS decoder written from scratch | "Full control over the decode pipeline" | Reinventing AFSK1200/AX.25 decoding is a multi-week project on its own and adds no diagnostic value over mature, verified open-source decoders | Use `direwolf` or `multimon-ng` — both are the de facto standard tools for exactly this validation use case. |
| Automated CI/regression test harness for firmware changes | "Good practice for any firmware project" | This is a one-time recovery of one physical board, not an ongoing firmware product with a team and repeated releases; CI investment has no payoff here | Manual build + flash + serial-check cycle is appropriate at this scale. Revisit if this becomes a multi-board or ongoing maintenance effort. |
| Replacing NMEA/UBX GPS parsing with a custom parser | "More control / less library dependency" | The vendored SparkFun u-blox library already has 20+ working examples and is what the stock firmware uses — reimplementing risks introducing new bugs into a path you're trying to validate, not exercise | Use the vendored library and its example sketches as-is for isolated GPS testing. |

## Feature Dependencies

```
Power-rail verification (table stakes)
    └──requires──> nothing (first gate)

USB enumeration + flash path (table stakes)
    └──requires──> Power-rail verification

Successful flash of firmware (table stakes)
    └──requires──> USB enumeration + flash path

Enable DEVMODE serial self-test (differentiator)
    └──requires──> Successful flash of firmware

GPS fix confirmation (table stakes)
    └──requires──> Power-rail verification
    └──requires──> Antenna feed repair (physical repair, not a "feature" but a hard blocker)
    └──enhances──> Enable DEVMODE serial self-test (fastest way to observe the fix)

BMP180 sensor read (table stakes)
    └──requires──> Power-rail verification
    └──enhances──> Enable DEVMODE serial self-test

VHF transmit into dummy load (table stakes)
    └──requires──> Power-rail verification
    └──requires──> Successful flash of firmware
    └──conflicts with──> transmitting without dummy load/antenna (physically damages PA — hard safety constraint, not a feature tradeoff)

SDR receive-and-decode pipeline (differentiator)
    └──requires──> VHF transmit into dummy load/antenna (needs an actual signal to receive)
    └──enhances──> End-to-end validation (becomes the *substitute* for a second APRS station)

UBX/u-center inspection (differentiator)
    └──requires──> GPS UART enumerated (same USB/COM-port dependency as flashing)
    └──enhances──> GPS fix confirmation (adds signal-quality diagnosis beyond fix/no-fix)

Standalone per-subsystem test sketches (differentiator)
    └──requires──> Successful flash of firmware (need a working upload path to run any sketch)
    └──enhances──> GPS fix confirmation, BMP180 read, VHF transmit (isolates failures faster than the integrated sketch)

Repeatable pass/fail checklist (differentiator)
    └──requires──> nothing structurally, but only has value once ──> table-stakes tests are defined

End-to-end validation: GPS fix + decodable APRS packet (table stakes, = Core Value)
    └──requires──> GPS fix confirmation
    └──requires──> VHF transmit into dummy load
    └──requires──> SDR receive-and-decode pipeline (the only independent proof path available, given no second APRS station)
```

### Dependency Notes

- **End-to-end validation requires the SDR pipeline, not just "transmit succeeded":** Because there is no second APRS station and PROJECT.md defers antenna/range tuning, the SDR decode is the *only* available independent confirmation that a real, correct APRS frame went out. This elevates the SDR pipeline from "nice differentiator" to a de facto hard dependency of the Core Value, even though it's not literally required to physically flash/power/transmit.
- **GPS fix confirmation requires the antenna feed repair**, which is a physical/mechanical task outside "features" per se, but it gates every GPS-related verification step, including the differentiator UBX inspection. Sequence repair before software-level GPS debugging — don't spend time tuning firmware GPS config before confirming the antenna path is physically sound.
- **DEVMODE enable enhances (doesn't gate) GPS/BMP180 verification:** these table-stakes checks could technically be confirmed via the Arduino Serial Monitor manually watching for the existing print statements, or even via a logic analyzer/multimeter on I2C/UART lines as a fallback if firmware is suspect — DEVMODE is just the cheapest, already-built path.
- **VHF transmit and SDR decode conflict with skipping the dummy load:** this is a hard safety constraint (PA damage), not a design tradeoff — never sequence "quick test without antenna" as a shortcut.
- **Per-subsystem test sketches enhance but don't replace the integrated firmware test:** isolating GPS/BMP180/radio individually is valuable for fault localization, but the Core Value requires the full integrated `.ino` (hab/pico-balloon/vehicle variant) to actually run correctly end-to-end, since that's what will eventually fly.

## MVP Definition

### Launch With (Recovery "Done" Definition)

- [ ] Power-rail verification (USB 5V, 3V3, buck-boost power-good) — first gate, nothing else is trustworthy without it
- [ ] USB enumeration + resolved WSL flashing path — required to get any firmware onto the board at all
- [ ] Successful reflash of a firmware variant — proves MCU + bootloader are alive
- [ ] Enable `DEVMODE` and read GPS/BMP180 serial output — cheapest possible verification of two of three remaining subsystems, already built into the firmware
- [ ] GPS fix confirmed (sats > 0, valid coordinates) — Core Value requirement, gated on antenna feed repair
- [ ] BMP180 read confirmed (plausible temp/pressure values) — Core Value requirement (implicit via telemetry)
- [ ] VHF transmit into dummy load confirmed — Core Value requirement, safety-gated
- [ ] SDR receive + decode of a real APRS frame (direwolf or multimon-ng) — the only available independent proof of correct TX, effectively load-bearing for Core Value

### Add After Validation (Once Core Recovery Is Proven)

- [ ] Scripted serial logger (pyserial) — add once you're doing repeated power-cycle/rework iterations and manual serial-monitor babysitting becomes tedious
- [ ] u-center/UBX signal-quality inspection — add if fix confirmation is flaky or marginal and you need per-satellite CN0 to distinguish "antenna feed is degraded" from "no fix yet"
- [ ] Standalone per-subsystem sketches — add if the integrated firmware test fails and you need to isolate which subsystem is at fault (they're already vendored, so "adding" this is near-zero cost when needed)
- [ ] Repeatable pass/fail checklist — worth writing once table-stakes tests are defined, so every repair iteration produces a comparable result

### Future Consideration (Explicitly Deferred)

- [ ] DRA818V raw AT-command scratch sketch — only needed if integrated radio TX fails and DEVMODE/serial logging can't localize whether the fault is in the Si5351/AFSK generation path vs. the DRA818V module itself
- [ ] Flight/field test — explicitly out of scope per PROJECT.md; a separate future milestone
- [ ] Any reusable multi-board test framework — defer until/unless a second board or ongoing maintenance need materializes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Power-rail verification | HIGH | LOW | P1 |
| USB enumeration/flash path | HIGH | LOW-MEDIUM | P1 |
| Successful firmware flash | HIGH | LOW | P1 |
| Enable DEVMODE serial self-test | HIGH | LOW | P1 |
| GPS fix confirmation | HIGH | MEDIUM | P1 |
| BMP180 sensor read | HIGH | LOW | P1 |
| VHF transmit into dummy load | HIGH | MEDIUM | P1 |
| SDR receive-and-decode pipeline | HIGH | MEDIUM | P1 (effectively required for Core Value, not optional) |
| Scripted serial monitor/logger | MEDIUM | LOW-MEDIUM | P2 |
| u-center/UBX signal-quality inspection | MEDIUM | MEDIUM | P2 |
| Standalone per-subsystem test sketches | MEDIUM | LOW (vendored already) | P2 |
| Repeatable pass/fail checklist | MEDIUM | LOW | P2 |
| DRA818V raw AT-command scratch sketch | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Custom GUI/dashboard | LOW | HIGH | Anti-feature |
| Reusable multi-board test framework | LOW (for this milestone) | HIGH | Anti-feature |
| Field/flight test | N/A (out of scope) | HIGH | Anti-feature (deferred) |

**Priority key:**
- P1: Must have to declare the recovery complete (maps to PROJECT.md Core Value + Active requirements)
- P2: Should have — meaningfully de-risks or speeds the recovery, low enough cost to include readily
- P3: Nice to have — only pull in if a P1 item fails and needs deeper isolation

## Sources

- Local vendored firmware source, read directly: `/mnt/c/Users/dave/LightAPRS-2.0/LightAPRS-2-hab/LightAPRS-2-hab.ino` (DEVMODE flag, SerialUSB debug prints, Serial1/DRA818V UART wiring, sendStatus/setupUBloxDynamicModel functions) — HIGH confidence, primary source
- Local vendored library examples: `libraries/LightAPRS_Adafruit_BMP085_Library/examples/BMP085test`, `libraries/SparkFun_Ublox_Arduino_Library-master/examples/*`, `libraries/ZeroSi4463/examples/Basic_Usage`, `libraries/LightAPRS_Si5351Arduino/examples/*` — HIGH confidence, confirmed present in this repo
- `/mnt/c/Users/dave/LightAPRS-2.0/README.md` — hardware spec table (buck-boost power-good, MAX-M8Q, BMP180, DRA818V, 144-146 MHz configurable) — HIGH confidence, project's own documentation
- `/mnt/c/Users/dave/LightAPRS-2.0/.planning/PROJECT.md` — Core Value, Active requirements, constraints (dummy-load safety, WSL USB limitation) — HIGH confidence, project's own documentation
- [APRS with rtl_fm, direwolf, and multimon-ng (gist)](https://gist.github.com/jj1bdx/8ab103e774c81d2c068d455ab862b72e) — MEDIUM confidence, community reference confirming standard `rtl_fm | direwolf` and `rtl_fm | multimon-ng -a AFSK1200` pipelines for 144.39 MHz APRS decode
- [GPS "Sats: 0" on LightAPRS 2.0 (Arduino Forum)](https://forum.arduino.cc/t/gps-sats-0-on-lightaprs-2-0-u-blox-max-m8q-samd21-board/1436763) — MEDIUM confidence, community-reported known failure mode on this exact board/GPS combo, relevant to expecting/diagnosing GPS issues beyond just antenna repair
- u-blox u-center (Windows GUI tool for UBX protocol inspection) — MEDIUM confidence (training-data knowledge of a long-standing, widely-used u-blox tool; not independently re-verified via official docs in this pass — recommend confirming current download/version at u-blox.com before relying on it)

---
*Feature research for: hardware recovery & bring-up workflow (LightAPRS 2.0 tracker)*
*Researched: 2026-07-05*
