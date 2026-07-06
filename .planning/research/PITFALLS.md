# Pitfalls Research

**Domain:** Weather-damaged ATSAMD21 APRS tracker recovery (LightAPRS 2.0) — corrosion repair, SAMD21 bring-up, WSL2 flashing, u-blox GPS, DRA818V VHF TX, SDR RX/decode
**Researched:** 2026-07-05
**Confidence:** MEDIUM-HIGH (SAMD21/BOSSA/WSL2/Direwolf claims verified against multiple sources incl. official docs and GitHub issue trackers; DRA818V PA-damage-without-load claim is community consensus/datasheet-adjacent but not independently lab-verified — flagged LOW below)

## Critical Pitfalls

### Pitfall 1: Resoldering the antenna feed without checking ground-pad continuity

**What goes wrong:**
The visible corrosion is at the Rainsun GPS1003 chip antenna feed point / L3 area. It's tempting to just re-flow the center feed pad, declare it fixed, and move on — but chip antennas (like the GPS1003) depend on a low-resistance ground plane connection at multiple ground pads, not just the RF feed pin. Corrosion often creeps under the antenna body and attacks the ground pads too, which aren't visible without desoldering/lifting the antenna. A feed-only reflow can look successful (continuity from feed to L3) while the antenna is still detuned or intermittent because of a bad ground reference.

**Why it happens:**
The macro photo only shows the feed side; ground pads are typically underneath or on the far edge of the antenna body and get skipped because they "looked fine."

**How to avoid:**
Before resoldering, use a multimeter in continuity mode to check *both* the feed trace (antenna pin to L3/matching network) and at least two ground pad connections (antenna ground to nearby ground plane/via). Target under ~0.1 ohm on ground paths. If ground pads show corrosion or high resistance, lift the antenna, clean the pads with isopropyl alcohol (90%+) and a fiberglass pen, re-tin, then reseat and reflow all pads — not just the feed.

**Warning signs:**
GPS achieves an occasional/intermittent fix, or fix quality (satellites-in-view vs. satellites-used, HDOP) is much worse than expected for an unobstructed sky view — this points to a marginal antenna ground rather than a dead feed.

**Phase to address:**
Diagnose phase (visual + continuity assessment) and Repair phase (resolder should be "feed + all ground pads," not spot-repair).

---

### Pitfall 2: Corrosion under "invisible" fine-pitch QFN joints (Si5351, MAX-M8Q, buck-boost) missed because only the antenna area was inspected

**What goes wrong:**
Photos show corrosion concentrated at the antenna feed, but moisture damage on a board "left outdoors too long" rarely stays confined to one component. Fine-pitch QFN packages (Si5351 synthesizer, MAX-M8Q GPS module itself, power management ICs) have low standoff (roughly 0.5-1 mil) where flux/moisture can wick under the package and corrode leads or the thermal pad without any visible surface sign. Repairing only the antenna joint and reflashing can produce confusing "half-working" symptoms (e.g., Si5351 clock output flaky, intermittent I2C) that get misattributed to firmware bugs.

**Why it happens:**
Visible corrosion anchors attention; QFN corrosion underneath a package is invisible without X-ray, hot-air removal, or electrical continuity/resistance testing across each pin.

**How to avoid:**
During Diagnose phase, don't stop at the antenna macro photo — visually inspect (with magnification/loupe) every QFN and fine-pitch package on the board for tarnish, green/white residue, or lifted solder fillets at the edges. Where corrosion is suspected but not visually confirmable, do continuity/resistance spot-checks on accessible test points (e.g., Si5351 output pins, I2C SDA/SCL pull-ups) before assuming a component is good just because it's not the antenna area.

**Warning signs:**
Intermittent I2C NACKs, Si5351 producing no/weak RF output despite correct register writes, or behavior that changes when the board is flexed or tapped (classic sign of a marginal solder joint).

**Phase to address:**
Diagnose phase — expand the inspection scope beyond the one documented damage site before committing to a "spot repair" plan.

---

### Pitfall 3: Aggressive no-clean flux residue mistaken for "fixed" after a rework — corrosion resumes

**What goes wrong:**
No-clean flux is designed to be electrically benign *only if left thin and undisturbed*; after rework (desoldering/resoldering a corroded joint), leftover flux residue mixed with existing corrosion byproducts becomes hygroscopic and acidic, and can resume corroding the joint weeks later even though it tested fine right after repair.

**Why it happens:**
Rework flux is applied liberally to get good wetting on an already-oxidized pad, then not cleaned because "it's no-clean" — but no-clean flux assumes clean, unoxidized starting conditions, not a rescue reflow over corrosion.

**How to avoid:**
After any rework near the corrosion site, clean thoroughly with 90%+ IPA and a brush/swab, then a final rinse pass so no residue re-dries as a white film (letting a board air-dry mid-clean leaves the worst residue). Consider a conformal coating (acrylic) over the repaired antenna feed area afterward, keeping the RF feed itself free of coating if using a spray without masking.

**Warning signs:**
White/hazy film reappearing around the repair after a few days, or fix reliability degrading again after initially working.

**Phase to address:**
Repair phase — cleaning/inspection step should be explicit, not implied by "used no-clean flux."

---

### Pitfall 4: Reflashing with an SAMD core version newer than 1.8.12 (bricking risk via broken BOSSA path)

**What goes wrong:**
Selecting the latest "Arduino SAMD Boards" core (rather than 1.8.12) causes the bundled `bossac` binary to fail immediately with `bin/bossac: bad CPU type in executable` on the affected platform, or otherwise mis-targets the SAMD core config for this exact board. Upstream's own README already flags this explicitly. If this happens mid-recovery on a board with unknown bootloader health, it's easy to misdiagnose a tooling problem as a hardware problem ("did I brick it?") and waste diagnostic effort.

**Why it happens:**
Arduino IDE/arduino-cli defaults to installing the newest core version; muscle memory from other SAMD21 projects (e.g. following a generic Adafruit or Arduino Zero guide) pulls in the wrong version.

**How to avoid:**
Pin `arduino:samd@1.8.12` explicitly in arduino-cli config/board manager (already captured as a project constraint). Verify the pinned version with `arduino-cli core list` before every flashing session, not just once — a `core update-index` or IDE auto-update can silently bump it.

**Warning signs:**
Upload fails immediately with a CPU-type/exec-format error before any actual serial communication with the board is attempted — this is a toolchain error, not a hardware fault, and should not trigger board-level troubleshooting.

**Phase to address:**
Reflash/Bring-up phase — verify core version as the first step of every flash attempt, before touching the physical board.

---

### Pitfall 5: Confusing the bootloader (double-tap) port with the sketch (upload) COM port, especially over usbipd

**What goes wrong:**
Native-USB SAMD21 boards (like this one, using an Arduino M0-compatible bootloader) enumerate as *two different USB devices* depending on state: the running sketch presents one COM port/VID:PID, and after a double-tap reset into the bootloader, the board disconnects and re-enumerates as a *different* COM port. If the IDE/arduino-cli is still pointed at the old port, upload silently fails to find the board, or (worse, in a semi-bricked board) times out and looks like "board is dead."

**Why it happens:**
Standard Arduino/AVR boards keep one static port across reset; SAMD21 native-USB boards don't. This trips up people coming from AVR experience, and is worse when using arduino-cli scripting (a fixed `-p` argument becomes stale after the reset-triggered port cycle).

**How to avoid:**
After every double-tap (or auto-reset-into-bootloader triggered by `1200bps touch`), re-enumerate ports (`arduino-cli board list` or `ls /dev/tty*` post-usbipd-attach) before issuing the upload command. Don't hardcode a port in scripts; resolve it fresh each run, or add a short wait+re-scan after triggering the reset.

**Warning signs:**
Upload command hangs or reports "no device found on expected port" immediately after a reset — check for a *new* port having appeared rather than assuming the board vanished.

**Phase to address:**
Reflash/Bring-up phase.

---

### Pitfall 6: usbipd attachment lost mid-upload because the board resets and re-enumerates (WSL2-specific)

**What goes wrong:**
This is the most likely WSL2-specific failure mode for this exact board. `usbipd attach` binds a specific USB device instance to WSL. When the SAMD21 board resets (auto-reset via 1200bps touch, or manual double-tap) to enter the bootloader, it physically disconnects and reconnects as a new USB device from Windows' point of view. The previous usbipd attachment does not follow the new enumeration — WSL loses the device mid-upload, and the upload fails partway through (this is a documented, known limitation of usbipd-win with boards that reset during programming, not unique to this board but guaranteed to bite here).

**Why it happens:**
usbipd forwards USB at the device level; a re-enumeration event is indistinguishable from a fresh, never-forwarded device to Windows, and Windows won't auto-forward it — the bind/attach has to be redone.

**How to avoid:**
Two options, in order of reliability: (1) do the actual bootloader trigger (double-tap reset) manually *before* invoking upload, then `usbipd list` to find the new device, `usbipd bind`/`attach` it, and only then run the upload targeting the now-stable bootloader port; or (2) if using auto-reset upload flows, script a short delay + re-`usbipd attach` between the reset and the actual data transfer, or fall back to flashing from native Windows (Arduino IDE for Windows, or `bossac.exe` directly) to sidestep the WSL2 USB-forwarding fragility entirely for the upload step, while still using WSL for compiling.

**Warning signs:**
Compile succeeds, but upload consistently fails partway ("no response," "timeout," partial write) specifically after the board's LED indicates a reset happened — this is the re-enumeration race, not a bad board or bad binary.

**Phase to address:**
Reflash/Bring-up phase — this should be treated as an expected obstacle to script around, not a surprise; consider a documented fallback to Windows-native flashing as the "if WSL2 path fights back" escape hatch.

---

### Pitfall 7: Powering from both USB and VBat/supercaps simultaneously without understanding the buck-boost power-good behavior

**What goes wrong:**
The board accepts either micro-USB or VBat (2.7-6V via buck-boost with "power good"). During bring-up it's tempting to plug in USB for programming *while* supercaps are also charged/connected, assuming the buck-boost just handles arbitration cleanly. Depending on the buck-boost topology, having both sources present can cause backfeed into USB, incorrect "power good" state during the transition, or a brownout right at the moment the SAMD21 is trying to boot/enter bootloader — which is especially confusing to debug on a board with already-uncertain analog health (this board has visible corrosion, so its power path is exactly what's under suspicion).

**Why it happens:**
The datasheet describes each input path but bring-up documentation (including this project's own README) doesn't spell out expected behavior for both being present at once; people default to "just leave the battery/supercaps connected, it's easier."

**How to avoid:**
During power-path verification (this project's own Active requirement), test USB-only and VBat-only power-up independently before testing both together. Confirm "power good" indication in each single-source case first. Only test combined-source behavior once each path is independently verified good, so a combined-source anomaly can be attributed correctly.

**Warning signs:**
Board resets or brownouts specifically when USB is plugged in while supercaps are already charged (or vice versa), but is stable when only one source is present at a time.

**Phase to address:**
Diagnose phase (power path verification, already an Active requirement) — sequence single-source tests before combined-source tests.

---

### Pitfall 8: Supercap inrush current causing a brown-in / partial-boot state at first power-up after repair

**What goes wrong:**
Discharged supercaps present a near-short at the instant power is applied, causing a slow, non-monotonic voltage rise on the rail as the caps charge. The SAMD21's power-on-reset threshold (~1.45V) is well below its functional operating voltage, so the core can start executing before the supply has actually stabilized at 3.3V — a "brown-in" condition. On a freshly repaired board, this can produce bizarre, non-reproducible behavior (partial boot, GPS UART garbage, random resets) that looks like a leftover hardware fault rather than a power-sequencing artifact.

**Why it happens:**
BOD33 (brown-out detector) is disabled by default on SAMD21/Arduino cores; nothing forces the chip to wait for the rail to actually settle before running code.

**How to avoid:**
When first powering the repaired board from VBat/supercaps, allow a slow charge-up (don't assume instant stability) and if repeated random resets/garbage are seen only on cold power-up (not on USB power, which has a controlled current limit), suspect BOD/inrush rather than a repair defect. If persistent, consider enabling BOD33 in the fuse/firmware config so the chip holds reset until the rail is genuinely stable, rather than chasing a phantom hardware bug.

**Warning signs:**
Symptoms appear only on cold power-up from VBat/supercap, and specifically go away on repeated resets once the rail is already charged (i.e., only the very first power-up after being fully discharged is affected).

**Phase to address:**
Diagnose/bring-up phase — attribute correctly before spending repair effort on a non-issue.

---

### Pitfall 9: Assuming "no GPS fix" is purely an antenna-feed hardware problem and missing a UART/baud/protocol mismatch

**What goes wrong:**
Because there's already visible, confirmed damage at the antenna feed, it's natural to assume any GPS "no fix" symptom is caused by that. But a real-world report from this exact board/GPS combination (LightAPRS 2.0 + MAX-M8Q) documented a case where "Sats: 0" persisted for hours with a clear sky and was ultimately traced to hardware issues elsewhere (a known L1 inductor defect on some board batches blocking the GPS, and separately, using the wrong antenna model for GPS frequency) — not the obvious suspect. Equally, u-blox M8 modules are UBX/NMEA over UART (and I2C/SPI) with a configurable baud rate; a corrupted/reset config (e.g., baud mismatch, or protocol set to UBX-only when the firmware expects NMEA) after power interruption or a botched re-flash of GPS config would look identical to "the antenna is still dead" — 0 sats, no fix — while being a completely different fault.

**Why it happens:**
Confirmation bias from the one visible damage photo; GPS modules also silently retain or lose configuration across power cycles depending on backup-battery/VBAT_RTC wiring, which isn't obvious from the outside.

**How to avoid:**
Before concluding "antenna repair didn't work," get raw serial output directly from the GPS module (bypass the main firmware with a simple pass-through/echo sketch) at the module's actual configured baud rate and confirm whether NMEA/UBX sentences are being produced at all (even with 0 satellites, a healthy module streams sentences continuously — silence means a communication-layer problem, not an RF problem). Only escalate to "still an RF/antenna issue" if sentences are flowing but satellite count stays at zero indefinitely with a genuinely clear sky view.

**Warning signs:**
Total silence on the GPS UART (no sentences at all) points to power/UART/baud, not antenna. Sentences flowing but perpetually 0 satellites with clear sky, even after the ~30s average cold-start TTFF window, points to antenna/RF.

**Phase to address:**
GPS validation phase — structure the test as "confirm serial link first, then confirm satellite acquisition," not a single pass/fail check.

---

### Pitfall 10: Judging GPS "cold start" failure too early (impatience) vs. genuinely dead antenna

**What goes wrong:**
u-blox M8-series cold start averages ~18-36 seconds to first fix under good signal, but that assumes a clear sky view and a fully healthy RF front end. On a board with known antenna feed damage, expecting a fix within the "normal" cold-start window and concluding "still broken" after 1-2 minutes indoors or with partial sky obstruction produces false negatives — either because normal cold start legitimately took longer under degraded (but working) antenna gain, or because the location genuinely didn't have adequate sky view (indoors near a window is not sufficient).

**Why it happens:**
People test wherever is convenient (a desk near a window) rather than moving outdoors with unobstructed sky, and then don't wait long enough given a compromised RF path.

**How to avoid:**
Test outdoors with genuinely unobstructed sky (no roof overhang, no metal desk, no nearby large structures), and give a repaired-but-uncertain antenna significantly longer than the textbook ~30s (10+ minutes) before concluding it's a hardware failure, since gain/mismatch can extend acquisition time without preventing it entirely.

**Warning signs:**
Fix eventually acquired, just slower than the spec sheet number — this indicates a working but degraded (not dead) antenna path, useful signal that the repair helped even if imperfectly.

**Phase to address:**
GPS validation phase.

---

### Pitfall 11: Keying the DRA818V PA with no antenna or dummy load attached — permanent transmitter damage

**What goes wrong:**
Transmitting into an open or missing antenna load presents a highly reflective (near-infinite VSWR) load to the PA output. RF power amplifiers driving into a severe mismatch see greatly increased peak voltages/currents at the output stage, and can suffer permanent damage (the LightAPRS README states plainly that the radio module may be damaged when not attaching an antenna, "since power has nowhere to go"). This is an entirely avoidable, irreversible mistake that would set the whole recovery back to needing another salvaged/replacement RF module.

**Why it happens:**
During bring-up it's easy to focus on "does it power on / does firmware run" and key up the transmitter for a quick test before physically attaching an antenna or dummy load, especially if testing indoors on a bench without a convenient antenna nearby.

**How to avoid:**
Physically verify a 50-ohm dummy load or a real antenna (at minimum the ~50cm monopole the README specifies) is connected and mechanically secure *before* any firmware path that keys the PA is exercised — including quick test sketches, not just the "official" flight firmware. Treat "TX capability" as gated behind "load attached, confirmed," as a hard precondition in the test procedure, not a step that can be skipped for convenience during a quick bench check.

**Warning signs:**
None after the fact — this failure mode is typically silent/immediate rather than gradually degrading, which is exactly why it needs a procedural gate rather than reactive detection.

**Phase to address:**
RF/TX validation phase — make "load attached" a scripted pre-check/checklist item before any keying, including ad hoc test sketches written for troubleshooting.

---

### Pitfall 12: Wrong TX frequency for region (144.390 vs 144.800) or leftover test frequency from firmware defaults

**What goes wrong:**
North America uses 144.390 MHz for APRS; IARU Region 1 (Europe) uses 144.800 MHz. The DRA818V frequency is set entirely in firmware/config (144-146 MHz configurable range), so a firmware variant, example config, or previously-flashed sketch intended for a different region (or simply a leftover test value) could have the tracker transmitting on the wrong frequency for its intended operating region. Since this project's operator is confirmed US-licensed (N8EPK), 144.390 MHz is correct — but any config carried over from upstream examples, forks, or the pre-damage flash should be explicitly re-verified rather than assumed.

**Why it happens:**
Frequency is a firmware constant buried in a config header, not something visually obvious from the board or a quick smoke test; it's easy to flash "known-good" firmware without re-checking every regional constant matches the operator's actual regulatory region.

**How to avoid:**
Before first TX test, explicitly grep/verify the configured TX frequency in the firmware source against 144.390 MHz (US) as the expected value, as part of the same review pass that checks callsign/SSID. Cross-check with the SDR RX validation step, which should independently confirm signal appears where expected.

**Warning signs:**
SDR RX validation (tuned to 144.390 MHz) shows nothing, even though the tracker appears to transmit (current draw spikes, TX LED if present) — check actual configured frequency before assuming a decode-side problem.

**Phase to address:**
Reflash phase (config review) and RF/TX validation phase (cross-check via SDR).

---

### Pitfall 13: Wrong RTL-SDR sample rate/gain settings producing "no signal" false negatives on the RX validation path

**What goes wrong:**
APRS is 1200-baud AFSK over narrowband FM. A too-low sample rate (direwolf/rtl_fm need enough to represent the 1200-baud tones — 24 kHz output rate is the commonly used value after FM demod) or leaving RTL-SDR's automatic gain control on (rather than manually setting gain, commonly cited around 34) frequently produces weak/garbled decodes and gets misread as "the tracker isn't transmitting" rather than "the RX chain is misconfigured." Since the whole point of the SDR path in this project is to independently prove TX works, a bad RX setup directly undermines the one validation method meant to be trustworthy.

**Why it happens:**
Default rtl_fm/AGC settings are tuned for general listening, not narrowband 1200-baud decode; people copy a generic "listen to FM radio" SDR command rather than an APRS-specific rtl_fm+direwolf recipe.

**How to avoid:**
Use an APRS-specific, tested command chain (e.g., `rtl_fm -f 144.390M -M fm -o 4 -g <manual gain> -s 24000 | direwolf -r 24000 -D 1 -t 0 -`), disable AGC and set gain manually, and validate the RX chain itself first against a *known-good* signal (a nearby commercial APRS station, an HT transmitting a test packet, or a second known-working tracker) before relying on it to validate this board's uncertain TX path — otherwise a bad RX chain and a bad TX chain are indistinguishable.

**Warning signs:**
RX chain never decodes anything, even from other known-active APRS stations in range — this proves the RX chain itself is broken, decoupled from whether this tracker's TX works.

**Phase to address:**
SDR RX validation phase — validate the RX chain against a known-good external signal before using it to judge this board's TX.

---

### Pitfall 14: Assuming de-emphasis is needed/missing for AFSK1200 the way it would be for voice audio

**What goes wrong:**
People familiar with FM voice repeater audio chains know de-emphasis matters a lot for flat, decodable audio, and may over-engineer a de-emphasis filter stage into the rtl_fm→direwolf pipeline, or conversely assume decode failures are due to *missing* de-emphasis when the actual issue is elsewhere (gain, sample rate, squelch). Direwolf is specifically designed to work with the raw FM-discriminator-style ("flat") audio typical of rtl_fm's output and internally compensates as needed for AFSK1200; adding an unnecessary external de-emphasis stage, or debugging in the wrong direction assuming de-emphasis is the missing piece, wastes time chasing the wrong variable.

**Why it happens:**
De-emphasis terminology and its importance for voice FM audio quality carries over incorrectly into packet/APRS troubleshooting mental models.

**How to avoid:**
Start with the standard, well-tested rtl_fm + direwolf recipe as-is (flat/discriminator audio piped directly into direwolf, no extra de-emphasis filter inserted) and only add signal-processing stages if decode is proven to be failing for level/clipping reasons specifically — verified by looking at direwolf's own audio level diagnostics (it reports whether input levels are in a good decode range) rather than by assumption.

**Warning signs:**
Decode succeeds against a known-good test signal with the plain rtl_fm+direwolf pipeline — that confirms no extra de-emphasis stage is needed for this setup.

**Phase to address:**
SDR RX validation phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Spot-reflow only the visibly corroded antenna feed pad, skip ground pads and other QFNs | Faster repair, board looks "fixed" | Intermittent GPS fix or hidden failures resurface later, hard to diagnose after firmware is already reflashed | Never for the primary damage site; acceptable only as a first triage pass before committing to full repair |
| Leave board on USB power for all testing, never validate VBat/supercap path | Simpler test setup, avoids power-path debugging early | Power-path defects (already an Active project requirement) go unnoticed until field/flight use, when USB isn't available | Acceptable only for firmware/GPS/RF bring-up steps that are explicitly power-source-agnostic; not acceptable before declaring the board "recovered" |
| Flash firmware and immediately attempt full TX test instead of a staged bring-up (power → GPS → sensor → RF) | Faster path to the "exciting" milestone | Compounds root-cause ambiguity if TX test fails — no way to know which subsystem is at fault | Never — this project's own staged Active requirements (power, then GPS, then sensor, then RF) already reflect the correct order; don't skip stages under time pressure |
| Reuse upstream example firmware defaults (callsign, frequency, TX interval) without reviewing every constant | Saves time re-deriving config | Risk of transmitting under wrong callsign/SSID or wrong frequency, an FCC Part 97 compliance issue, not just a bug | Never acceptable before first TX — config review is mandatory, not optional |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|-------------------|
| WSL2 + usbipd-win | Assume one `usbipd attach` persists across board resets/reboots | Re-`attach` after every reset-triggered re-enumeration and after every Windows/WSL reboot (bindings are not persistent across host reboot; attachments are not persistent across device re-enumeration) |
| arduino-cli + SAMD core | Let core auto-update to "latest" | Pin `arduino:samd@1.8.12` explicitly and re-check the pinned version before each session |
| u-blox MAX-M8Q + main firmware | Assume firmware's expected baud/protocol matches module's actual current config (which can persist across power loss if backed up, or reset to defaults if not) | Independently query/verify the GPS module's live baud rate and protocol (NMEA vs UBX) before assuming a firmware-side bug when "no data" is seen |
| DRA818V + LightAPRS firmware | Trust that "compiles and runs" implies "safe to key up" | Explicitly confirm load (dummy or antenna) attached as a separate, scripted pre-flight check independent of firmware logic |
| RTL-SDR + Direwolf | Copy a generic SDR listening command and expect APRS decode to "just work" | Use the specific, validated rtl_fm+direwolf AFSK1200 recipe (manual gain, 24kHz decimated rate, correct frequency for region) and validate against a known-good external signal first |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Testing GPS acquisition indoors/near a window | "No fix" reported when the real cause is inadequate sky view, not hardware | Always test outdoors with unobstructed sky, allow the full realistic cold-start window (open sky can still take longer than spec on a degraded antenna) | Every time — GPS testing indoors is close to guaranteed to look like a failure even on a perfectly healthy module |
| Relying on RX validation via a marginal/cheap SDR antenna at long range from the tracker | Weak/absent decode blamed on tracker TX, when it's actually RX-side signal budget | Test RX chain at short range (same room/building) for the first pass, only test at realistic field range once short-range decode is proven | As soon as distance/obstructions exceed what the (likely low-gain, indoor) SDR antenna and low-cost dongle can handle |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Transmitting with default/placeholder callsign or SSID left over from example firmware | FCC Part 97 violation (unidentified or misidentified transmission), even though the operator is licensed | Explicitly verify callsign/SSID fields in firmware config match N8EPK before first TX, as part of the same review pass as frequency verification |
| Leaving a repaired-but-unverified transmitter unattended while testing with real antenna outdoors | Uncontrolled emissions if firmware bug causes runaway/continuous TX | Keep TX tests attended and time-boxed; verify firmware TX interval/duty cycle logic before unattended field-style testing |

## UX Pitfalls

Not directly applicable — this is a hardware recovery project without an end-user-facing interface. The closest analog is the researcher's own troubleshooting workflow, covered under Technical Debt Patterns and Integration Gotchas above (e.g., staged bring-up order, config review checklist).

## "Looks Done But Isn't" Checklist

- [ ] **Antenna feed repair:** Often missing ground-pad continuity check — verify with multimeter continuity on feed *and* at least two ground pads, not just the visibly corroded joint
- [ ] **Firmware reflash:** Often missing a config review pass — verify callsign, SSID, TX frequency, and TX interval against expected values, not just "it compiles and uploads"
- [ ] **GPS fix declared working:** Often missing a raw-serial sanity check — verify NMEA/UBX sentences are streaming continuously at the expected baud before trusting a "fix acquired" result from the main firmware alone
- [ ] **RF TX validated:** Often missing an independent confirmation the *decoded* packet content is correct (callsign, comment, position) via the SDR path — a decoded packet with garbage/wrong fields is not the same as "TX works"
- [ ] **SDR RX chain "working":** Often missing validation against a known-good external signal — confirm the RX chain itself decodes something real before trusting a negative result against this board's TX
- [ ] **Power path "verified":** Often missing the combined-source (USB + VBat/supercap simultaneously) test — single-source success doesn't guarantee combined-source safety

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| DRA818V PA damaged from keying without load | HIGH | Likely requires sourcing/salvaging a replacement DRA818V module and redoing the RF section's assembly and LPF alignment — treat as a hard-stop failure mode to prevent, not one to casually recover from |
| Board fully bricked (bootloader itself corrupted, no COM port ever appears, no LED activity on reset) | HIGH | Requires SWD/JTAG reprogramming of the bootloader via the board's debug pads (if present/accessible) using an external programmer (e.g., a J-Link, Atmel-ICE, or similar SWD adapter) — verify these pads exist and are accessible on this board revision before assuming recoverability |
| Antenna feed repair still marginal (intermittent fix) after first resolder | LOW-MEDIUM | Redo with full ground-pad continuity verification (Pitfall 1) rather than repeatedly reflowing just the feed pin |
| Wrong SAMD core version causes upload failures | LOW | Re-pin to 1.8.12 via Boards Manager/arduino-cli and retry — no hardware risk, purely a toolchain fix |
| usbipd attachment lost mid-upload | LOW | Re-run `usbipd list` / `usbipd attach` for the newly-enumerated device and retry upload; fall back to Windows-native flashing if this recurs persistently |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Feed-only resolder missing ground pads | Diagnose + Repair | Continuity check (<0.1 ohm) on feed and 2+ ground pads post-repair |
| Hidden QFN corrosion elsewhere on board | Diagnose | Magnified visual inspection of every QFN/fine-pitch package, not just the antenna area |
| No-clean flux residue re-corroding | Repair | Visual re-check for white/hazy film a few days after repair, before considering repair final |
| SAMD core version drift (bad CPU type) | Reflash/Bring-up | `arduino-cli core list` shows exactly 1.8.12 before every flash session |
| Bootloader vs. sketch COM port confusion | Reflash/Bring-up | Port list re-scanned after every reset event, never hardcoded stale |
| usbipd attachment lost on board reset | Reflash/Bring-up | Successful full upload completing without a mid-transfer timeout; documented Windows-native fallback if WSL2 path fails twice |
| USB+VBat combined power fault | Diagnose (power path) | Each power source tested independently first, combined-source tested only after |
| Supercap inrush / brown-in on cold power-up | Diagnose (power path) | Repeated cold power-up from fully discharged supercaps shows no random resets/garbage |
| Misattributing GPS "no fix" to antenna when it's UART/baud/protocol | GPS validation | Raw serial pass-through shows continuous NMEA/UBX sentences before judging satellite acquisition |
| Impatience on GPS cold-start judged too early | GPS validation | Outdoor test with clear sky, minimum 10-minute wait before declaring antenna dead |
| Keying DRA818V with no load | RF/TX validation | Scripted/checklist pre-flight confirms dummy load or antenna physically attached before any TX-capable code runs |
| Wrong TX frequency/region or stale config | Reflash + RF/TX validation | Firmware config reviewed against 144.390 MHz (US) and N8EPK callsign/SSID before first TX; cross-checked via SDR |
| RTL-SDR/direwolf misconfiguration (sample rate/gain) | SDR RX validation | RX chain proven against a known-good external APRS signal before trusting it against this board's TX |
| Unneeded/misapplied de-emphasis assumption | SDR RX validation | Standard rtl_fm+direwolf flat-audio recipe decodes a known-good test signal without added filtering |

## Sources

- [LightAPRS 2.0 README (this repo)](file:///mnt/c/Users/dave/LightAPRS-2.0/README.md) — official "bad CPU type in executable" / SAMD core 1.8.12 warning, antenna-before-upload warning
- [Arduino Forum: GPS "Sats: 0" on LightAPRS 2.0 (u-blox MAX-M8Q)](https://forum.arduino.cc/t/gps-sats-0-on-lightaprs-2-0-u-blox-max-m8q-samd21-board/1436763) — real-world case on this exact board/GPS combo; hardware root causes (L1 inductor defect, wrong antenna type) rather than obvious suspects
- [Arduino Help Center: "bad CPU type in executable"](https://support.arduino.cc/hc/en-us/articles/7765785712156-Error-bad-CPU-type-in-executable-on-macOS)
- [arduino/arduino-cli #1943: Recovery of soft-bricked native USB boards without double-tap impossible without port selection](https://github.com/arduino/arduino-cli/issues/1943)
- [arduino/arduino-ide #1648: port address cycles after reset on native USB boards](https://github.com/arduino/arduino-ide/issues/1648)
- [Adafruit Learning System: Restoring Bootloader / Proper Debugging of ATSAMD21 Processors](https://learn.adafruit.com/proper-step-debugging-atsamd21-arduino-zero-m0/restoring-bootloader)
- [avdweb.nl: Arduino Zero COM port detection and upload problems](https://avdweb.nl/arduino/samd21/virus)
- [dorssel/usbipd-win GitHub repo and issues (#300, #605, #645, #798, #448, #1030)](https://github.com/dorssel/usbipd-win) — non-persistent attachment across reset/reboot, connection drops on device reset
- [Nick McCleery: How to program an Arduino from WSL2](https://nickmccleery.com/posts/09-programming-an-arduino-wsl2/)
- [Microsoft Learn: Connect USB devices to WSL](https://learn.microsoft.com/en-us/windows/wsl/connect-usb)
- [u-blox 8 / u-blox M8 Receiver Description Including Protocol Specification](https://cdn.sparkfun.com/assets/learn_tutorials/8/6/9/u-blox8-M8_ReceiverDescrProtSpec__UBX-13003221__Public.pdf) — cold-start TTFF (~30s), NMEA/UBX/baud config
- [MAX-M8 series u-blox M8 datasheet](https://content.u-blox.com/sites/default/files/documents/MAX-M8-FW3_DataSheet_UBX-15031506.pdf)
- [Stargirl (Thea) Flowers: Using the SAM D21's brown-out detector](https://blog.thea.codes/sam-d21-brown-out-detector/) — BOD33 default-disabled, brown-in risk
- [Microchip: SAM D21 Power Manager (PM) / Brown-out detector](https://developerhelp.microchip.com/xwiki/bin/view/products/mcu-mpu/32bit-mcu/sam/samd21-mcu-overview/peripherals/pm/)
- [Dorji DRA818V datasheet](https://www.dorji.com/docs/data/DRA818V.pdf) — 50-ohm antenna port spec (PA-damage-without-load risk is community/vendor-guidance consensus, e.g. reflected in this project's own README, not independently lab-measured in sources reviewed — MEDIUM confidence)
- [rtl-sdr.com: Setting up a Raspberry Pi based APRS RX IGate with an RTL-SDR](https://www.rtl-sdr.com/setting-up-a-raspberry-pi-based-aprs-rx-igate-with-an-rtl-sdr/)
- [Kevin Hooke: Configuring rtl_fm and Direwolf for decoding Amateur Radio Packet](https://www.kevinhooke.com/2015/07/26/configuring-rtl_fm-and-direwolf-for-decoding-amateur-radio-packet-on-the-raspberry-pi/)
- [wb2osz/direwolf GitHub repo and docs](https://github.com/wb2osz/direwolf)
- [repeater-builder.com: An Explanation of "Flat Audio", "Pre-Emphasis" and "De-Emphasis"](https://www.repeater-builder.com/tech-info/flat-audio.html)
- [aprsisce wiki: APRS Frequencies](http://aprsisce.wikidot.com/doc:frequencies) — 144.390 MHz (North America) vs 144.800 MHz (Europe/IARU Region 1)
- [Chemtronics: Ultimate Guide to Cleaning Electronics](https://www.chemtronics.com/ultimate-guide-to-cleaning-electronics) — QFN low-standoff cleaning difficulty, no-clean flux residue risk
- [CircuitNet: QFN Rework — No-Clean or Water Soluble Flux?](https://www.circuitnet.com/programs/51625.html)
- [Kinghelm: What to Do If Your Bluetooth SMD Antenna Breaks? A 3-Step Repair Guide](https://www.kinghelm.net/newDetail/16432) — chip antenna feed/ground pad resolder guidance

---
*Pitfalls research for: LightAPRS 2.0 weather-damage recovery*
*Researched: 2026-07-05*
