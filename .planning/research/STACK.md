# Stack Research

**Domain:** Bench recovery/repair tooling for a brownfield ATSAMD21 (LightAPRS 2.0) tracker — WSL2 flashing, RTL-SDR APRS receive/decode, physical corrosion diagnosis/rework
**Researched:** 2026-07-05
**Confidence:** MEDIUM-HIGH (flashing & RX chain verified against current official sources; bench-repair guidance is standard electronics-repair practice, not project-specific docs)

This file does **not** re-research firmware. It answers: how do I get bits onto this specific board from WSL2, how do I prove the radio transmitted using the RTL-SDR already on hand, and what bench process/tools diagnose and fix the corrosion.

---

## Recommended Stack

### Core Technologies — Flashing (WSL2 → ATSAMD21G18)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `arduino:samd` core | **1.8.12** (pinned) | Board package providing the "Arduino M0" FQBN `arduino:samd:mzero_bl` used by LightAPRS 2.0 | Already pinned by upstream README/repo constraint; newer versions ship a bossac binary that triggers `bad CPU type in executable`. Confirmed via `boards.txt`/`platform.txt` for this exact tag — the "Arduino M0" board (`mzero_bl`) uploads via the **`avrdude`**-named tool wrapper using `stk500v2` protocol at 57600 baud over the native-USB CDC port, **not** bossac directly (bossac 1.7.0-arduino3 is bundled but only used by sibling boards like `mzero_pro_bl`/MKR). HIGH confidence (read directly from `ArduinoCore-samd` repo at tag 1.8.12). |
| arduino-cli | **1.5.1** (latest, June 2026) or any 0.35+ | CLI compiler/uploader already used to build the firmware in WSL2 | Already established in this repo per PROJECT.md. Same binary works for `compile` and `upload`; no separate tool needed. HIGH confidence. |
| usbipd-win | **5.3.0** (Oct 2025) or latest | Shares a Windows-attached USB device (Arduino M0 in bootloader, or the RTL-SDR) into the WSL2 VM over USB/IP | The only supported way to give WSL2 direct USB access; required if you want to run `arduino-cli upload` or `rtl_fm`/`direwolf` fully inside WSL2. HIGH confidence (Microsoft's own WSL docs recommend it). |
| 1200-bps-touch auto-reset (built into the SAMD core, no separate tool) | n/a | Normal upload path: arduino-cli briefly opens the port at 1200 baud to ask the running sketch to reset into the bootloader | This is what `arduino-cli upload -p <port> --fqbn arduino:samd:mzero_bl` does automatically — **works only if the currently-flashed firmware is alive enough to honor the touch.** On a brownfield/corroded board this is not guaranteed. HIGH confidence (verified against `boards.txt`: `mzero_bl.upload.use_1200bps_touch=true`). |
| Manual double-tap reset (physical button, no software) | n/a | Recovery path: force the SAM-BA/bootloader to stay resident regardless of firmware state | Standard SAMD21 recovery procedure (Adafruit, Arduino forums) for a board whose sketch is hung, corrupted, or simply unknown-state — exactly this project's situation. Do this *before* invoking `arduino-cli upload` so the port is already in bootloader mode and the 1200bps touch becomes a harmless no-op. MEDIUM-HIGH confidence. |

### Core Technologies — RTL-SDR APRS Receive/Decode

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `rtl-sdr` (librtlsdr + `rtl_fm`) | Debian/Ubuntu package (WSL2) or Windows build from the RTL-SDR Blog / osmocom fork | Tunes the NooElec dongle to 144.39 MHz, FM-demodulates to a raw audio stream | Standard, minimal-dependency way to get from RF to an AFSK1200 audio stream. `apt install rtl-sdr` on the WSL2 side is one command. HIGH confidence, multiple independent sources agree on the canonical pipe: `rtl_fm -f 144.39M -` \| `direwolf -r 24000 -D 1 -`. |
| **Direwolf** | **1.8.1** (Nov 13 2025; 1.8 added CM108 PTT for Mac, 1.7 added IL2P/DNS-SD) | AX.25/APRS soft-TNC — decodes the AFSK1200 audio into a parsed, human-readable APRS packet (callsign, position, comment, telemetry) | Purpose-built for exactly this validation task, not a generic multi-protocol demod. Its multi-slicer/multi-decoder approach gives materially better AFSK1200 decode rate on a single weak bench-range packet than `multimon-ng`. Ships **native Windows binaries** (`direwolf.exe`) as well as Linux/WSL2 builds — same tool either side of the USB boundary. HIGH confidence (GitHub releases page, official docs). |
| NooElec RTL-SDR + Zadig (Windows) or default kernel driver (WSL2/Linux) | Zadig latest (any recent 2.x) | Driver layer so `rtl_fm`/`gqrx`/SDR++ can claim the dongle | All RTL2832U-based dongles (NooElec included) need the WinUSB driver via Zadig on native Windows; on Linux/WSL2, `rtl-sdr` package + a udev rule (or just running as root inside WSL2, which has no udev by default) is sufficient. MEDIUM confidence (RTL-SDR Blog quick-start guide; NooElec-specific confirmation not separately verified, but it is a standard RTL2832U+R820T2 dongle with no unusual driver requirement). |

### Core Technologies — Bench Diagnosis (Physical Board)

| Technology/Tool | Spec | Purpose | Why Recommended |
|-----------------|------|---------|-----------------|
| Digital multimeter with continuity beep + diode mode | Any auto-ranging DMM (e.g. Klein MM325, Fluke 101/115-class) | Trace 3V3 rail, VBat/supercap path, buck-boost "power good", continuity across the corroded GPS antenna feed | Table-stakes bench tool; continuity beep is the fastest way to find a corrosion-opened trace vs. a still-continuous-but-high-resistance joint (measure resistance, not just beep, on suspect joints). |
| USB inline power/current meter (pass-through, e.g. generic "USB safety tester" or a logging meter like RIDEN UM24C/UM25C) | USB-A pass-through, V/A/mAh display | Verify safe current draw at power-up *before* trusting the board on a bench PSU or laptop USB port; catch a dead short without letting it cook a trace | A corroded board is a candidate for shorts; a $10-15 inline meter (or better, a logging one) tells you current draw in real time so you can pull power the instant it exceeds expectations (LightAPRS idle draw is ~7 mA per README — anything wildly higher is a red flag). |
| Bench PSU with adjustable current limit | Any 0–30V/0–3A linear/switching bench supply | Power the board via VBat pin with a hard current limit while probing, instead of relying on USB host over-current protection (which is often slow/absent) | Strongly preferred over "just plug it into a USB port and see what happens" for a board with known corrosion — lets you set the limit at ~50-100 mA above expected idle draw and walk it up deliberately. |
| Isopropyl alcohol, **99%** (not 70/91%) | — | Dissolve flux residue and loosen light oxidation/corrosion crust before/after rework | 90%+ IPA is the standard for electronics; lower concentrations carry more water, which can *promote* further corrosion rather than clean it up. Apply with a soft brush (anti-static / ESD-safe bristle) and lint-free swabs, not a soaked paper towel. MEDIUM confidence (general electronics-repair consensus, not a single canonical doc). |
| No-clean flux (paste or pen), e.g. any RMA-223-equivalent | — | Re-flow the corroded GPS antenna feed pad and any tarnished joints without needing an aggressive post-clean | No-clean flux residue is safe to leave in place in normal environments, but for a board that will go back outdoors, still wipe it down with IPA afterward — residual flux + humidity is exactly the failure mode that got this board here. |
| Hot-air rework station, adjustable temp/airflow, small (~5mm) nozzle | ~300-320°C nozzle temp, low-medium airflow | Rework/reflow the Rainsun GPS1003 ceramic chip antenna feed and ground pads at L3 | Small ceramic chip antennas and their feed traces are easily lifted by an iron dragged across a corroded pad; hot air with a small nozzle and Kapton-tape masking of the adjacent MAX-M8Q and passives gives more even, lower-mechanical-stress reflow. Use a fine-tip iron only for touch-up after hot-air reflow, not as the primary tool on this joint. LOW-MEDIUM confidence (standard SMD rework practice, not sourced from a GPS1003-specific repair guide — none was found). |
| USB microscope or head loupe (10-40x) | — | Inspect the antenna feed joint and surrounding pads before and after rework for hairline cracks / lifted pads | Corrosion damage at this scale is frequently invisible to the naked eye; a $20-30 USB microscope pays for itself the first time it catches a hairline crack a multimeter's continuity beep missed (intermittent contact still "beeps"). |
| Conformal coating (e.g. MG Chemicals 422B acrylic), applied post-repair | — | Prevent recurrence of the moisture-driven corrosion that damaged this board originally | Since the device's purpose is outdoor flight, repairing the joint without addressing the root cause (moisture ingress) just resets the clock. Mask the GPS antenna, programming header/USB connector, and any connectors before coating. |

### Supporting Libraries / Packages

| Library/Package | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `multimon-ng` | latest apt/build | Lightweight alternative AFSK1200/POCSAG decoder | Useful as a quick cross-check ("did direwolf mis-decode, or is there really no signal") but not the primary tool — its APRS decode is less robust than Direwolf's multi-slicer approach. |
| `sox`/`gqrx` (Linux) | latest | Visual spectrum/waterfall confirmation that the DRA818V is actually transmitting a carrier at 144.39 MHz before worrying about audio-layer decode | Use when you're not sure the radio is transmitting at all — a waterfall trace is a faster sanity check than iterating on decoder settings blind. gqrx has a documented UDP/audio-streaming integration with direwolf if you want to stay in one GUI tool. |
| SDR++ | latest (cross-platform, actively maintained) | Windows/Linux/Mac GUI SDR receiver with waterfall + audio routing | Recommended over SDR# or gqrx-on-Windows if doing the RX chain **natively on Windows** (see Alternatives below) — same UI on both OSes, actively maintained, native RTL-SDR source. |
| VB-Audio Virtual Cable | latest free version | Routes SDR++'s demodulated audio into direwolf.exe on Windows without a physical audio loopback cable | Only needed if using SDR++'s GUI audio output rather than `rtl_fm.exe \| direwolf.exe` piping. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `usbipd list` / `usbipd bind` / `usbipd attach --wsl --busid=<id> --auto-attach` | Share + attach a Windows USB device into WSL2, with automatic re-attach on disconnect/reconnect | `bind` is a one-time, persists across reboots; `attach` is per-session; `--auto-attach` runs a foreground watcher that re-attaches whenever the device disappears and reappears — **this is the specific fix for SAMD21's bootloader re-enumeration** (the board presents a different VID:PID pair in bootloader mode: confirmed `0x2a03:0x004d/0x804d` app vs `0x2a03:0x004e/0x804e` in `boards.txt`, so Windows/WSL sees it as a "new" device each reset). |
| Zadig | Replace Windows' default RTL2832U driver with WinUSB | Only needed if running the SDR chain natively on Windows, not through WSL2/usbipd. Use "List All Devices", select the Bulk-In Interface 0 (not composite parent), install WinUSB. |
| `arduino-cli.exe` (Windows-native install, parallel to the WSL2 one) | Upload-only fallback that avoids WSL2 USB-forwarding entirely | See "What NOT to Use" below — recommended as the primary upload path for *this* board given its unknown/corroded state, not just a fallback. |

---

## Installation

```bash
# --- WSL2 side: flashing toolchain (already partially established per PROJECT.md) ---
arduino-cli core install arduino:samd@1.8.12
arduino-cli compile --fqbn arduino:samd:mzero_bl LightAPRS-2-pico-balloon
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:samd:mzero_bl LightAPRS-2-pico-balloon

# --- WSL2 side: RTL-SDR receive/decode ---
sudo apt update
sudo apt install -y rtl-sdr direwolf multimon-ng
rtl_fm -f 144.39M -           | direwolf -r 24000 -D 1 -
# Quick alternative cross-check:
rtl_fm -f 144.39M -s 22050 - | multimon-ng -t raw -a AFSK1200 -A -

# --- Windows side (usbipd, run in an elevated PowerShell) ---
winget install usbipd
usbipd list
usbipd bind   --busid <BUSID>              # one-time
usbipd attach --wsl --busid <BUSID> --auto-attach   # keeps re-attaching across board resets

# --- Windows-native flashing fallback (recommended primary path for this board — see below) ---
# Install arduino-cli for Windows (same version, no WSL/usbipd involved):
choco install arduino-cli   # or download the win64 zip from arduino-cli releases
arduino-cli.exe core install arduino:samd@1.8.12
arduino-cli.exe compile --fqbn arduino:samd:mzero_bl C:\path\to\LightAPRS-2-pico-balloon
arduino-cli.exe upload -p COM5 --fqbn arduino:samd:mzero_bl C:\path\to\LightAPRS-2-pico-balloon

# --- Windows-native RTL-SDR/direwolf (avoids usbipd throughput risk entirely) ---
# Download direwolf-*-win64.zip from https://github.com/wb2osz/direwolf/releases
# Download rtl_fm.exe from the RTL-SDR Blog / osmocom Windows release
rtl_fm.exe -f 144.39M -o 4 - | direwolf.exe -r 24000 -b 16 -D 1 -
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Flash from **Windows-native arduino-cli/Arduino IDE**, compile in WSL2 | Flash entirely inside WSL2 via usbipd-win | Use full-WSL2 if you want a single-terminal workflow and are willing to babysit `usbipd attach --auto-attach` through every bootloader reset. Given this board's state is unknown (may not honor the 1200bps touch cleanly), the Windows-native path removes one entire failure axis (USB/IP re-enumeration timing) while you're still diagnosing the board. |
| **Direwolf** for APRS decode | `multimon-ng` | Use multimon-ng only as a quick second opinion or if you also want to decode other digital modes (POCSAG, DTMF) at the same time — its APRS/AFSK1200 decode is materially weaker than direwolf's. |
| **rtl_fm \| direwolf** headless pipe (Linux or Windows) | gqrx + direwolf via UDP/PulseAudio, or SDR++ + VB-Cable + direwolf | Use a GUI SDR (gqrx on Linux, SDR++ cross-platform) when you need to *see* the signal (confirm a carrier exists, check frequency offset/drift, gauge signal strength) before or in addition to decoding it — valuable early in bring-up when you don't yet know if the DRA818V is transmitting at all. |
| WinUSB (Zadig) for native-Windows RTL-SDR | Windows' default Realtek DVB-T driver | Never use the stock driver for SDR use — it will not expose the dongle to `rtl_fm`/SDR++/gqrx at all; Zadig replacement is mandatory, not optional, on Windows. |
| 99% isopropyl alcohol + no-clean flux for corrosion cleanup | Aggressive contact cleaners / abrasive brass brushing of solder mask | Only escalate to mechanical abrasion (fiberglass pen) on visibly crusted corrosion, and re-seal with conformal coating afterward — bare fiberglass-penned copper corrodes faster than it did before if left uncoated. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| SAMD core version newer than 1.8.12 | Confirmed upstream: throws `bad CPU type in executable` on the bundled upload tool for this project's environment (repo README explicitly warns on this; matches known cross-arch bossac binary issues in the Arduino/Adafruit SAMD board packages). Already validated by this repo's own build. | Keep `arduino:samd@1.8.12` pinned in **both** the WSL2 and any Windows-native arduino-cli install, so compile and flash agree on toolchain. |
| Relying solely on `arduino-cli upload`'s automatic 1200bps-touch reset over usbipd-forwarded WSL2, with no fallback | Two independent failure modes stack here: (1) a brownfield board's firmware may be too damaged/hung to honor the touch at all (confirmed general SAMD21 issue — "soft-bricked native USB boards" need double-tap, not touch); (2) even if the touch works, the board's bootloader-mode VID:PID differs from run-mode, so Windows/WSL sees a "new" USB device, and usbipd does **not** auto-follow that without `--auto-attach` explicitly set. Silent failure looks like "port not found" with no clear cause. | Manually double-tap the physical reset button to force bootloader mode *before* invoking upload (bypasses reliance on firmware health entirely), and/or run `usbipd attach --auto-attach`, and/or flash from Windows-native arduino-cli where there's no USB/IP hop to desync. |
| Piping `rtl_fm.exe | direwolf.exe` through **PowerShell** without testing | PowerShell's pipeline is object-based and has known historical issues mangling raw binary stdout/stdin streams for native executables (vs. `cmd.exe`'s byte-transparent pipes). Not independently re-confirmed for the current PowerShell version in this research pass — flag as LOW confidence, but cheap to avoid. | Run the Windows-native `rtl_fm.exe | direwolf.exe` pipe from `cmd.exe`, not PowerShell, or use SDR++ + VB-Cable (avoids piping raw audio through any shell) if a decode failure is suspected to be pipe corruption rather than a real RF/decode problem. |
| RTL-SDR streaming continuously through WSL2/usbipd for extended sessions | RTL-SDR dongles use a high-throughput USB bulk stream (~2.4 MS/s default in most rtl_fm recipes); USB/IP adds a virtualization hop that has documented dropped-sample/stability reports for high-bandwidth devices, distinct from and in addition to the RTL2832U's own known sample-rate ceiling (~2.56 MS/s before drops even on bare metal). | For quick one-off validation, WSL2/usbipd is fine. For any extended RX session, either run the SDR chain natively on Windows (see Alternatives), or run `rtl_tcp` on the Windows side and connect an SDR client from WSL2 over the network loopback — this avoids forwarding the raw high-rate USB stream through USB/IP at all. |
| 70% or 91% isopropyl alcohol for corrosion/flux cleanup | Higher water content vs. 99% — can leave moisture behind in exactly the corrosion-prone joints you're trying to fix. | 99% (or as close to it as available) isopropyl alcohol. |
| Bare fine-tip soldering iron dragged across the corroded GPS antenna feed pad as the primary rework tool | High risk of lifting the small ceramic chip-antenna pad or an adjacent trace when the joint is already compromised by corrosion (weaker copper-to-pad adhesion). | Hot-air rework (small nozzle, masked neighbors) as primary tool; fine-tip iron only for touch-up after. |
| Keying the DRA818V into anything but a dummy load/antenna, "just to see if it transmits" | Already a hard constraint in PROJECT.md — the PA can be damaged with no load; this is not new information but worth restating as a stack-adjacent tool decision. | QRP Labs' own 50-ohm 20W dummy load kit (shop.qrp-labs.com/dummy) — same manufacturer as the tracker, cheap, rated well above the DRA818V's 0.5-1 W output, and gives you an RF detector/DC sample output for a rough power-present check with just a multimeter. |

---

## Stack Patterns by Variant

**If the board's firmware is confirmed dead/unresponsive (does not honor 1200bps touch at all):**
- Use manual double-tap reset + Windows-native `arduino-cli.exe upload` (no usbipd, no WSL involved for this step)
- Because this removes both unknowns (firmware health, USB/IP re-enumeration) at once, isolating whether upload itself is the problem

**If validating RX only (confirming the DRA818V transmits, GPS not yet working):**
- Use `rtl_fm | direwolf` (Linux or Windows-native) with `-t` (text-only) mode or just watch console output for a raw AX.25 frame
- Because you don't need APRS-IS/KISS/iGate features yet — the goal is "did we get any decoded packet at all", not a full station setup

**If doing extended/overnight RX logging (e.g., multiple GPS-fix TX cycles):**
- Use the Windows-native `rtl_fm.exe | direwolf.exe` pipe, or `rtl_tcp` bridging into WSL2
- Because sustained high-rate USB/IP forwarding of the RTL-SDR stream is the one part of this stack with a real (if not project-specific-confirmed) stability question mark

**If corrosion is found beyond the GPS antenna feed (e.g., under the Si5351/DRA818V or supercap pads):**
- Escalate from IPA+brush cleaning to full component removal, pad cleanup, and reflow rather than spot-repair
- Because corrosion under a component is very likely to recur or hide a second failure (lifted pad, resistive short) that a single visible joint repair won't catch

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `arduino:samd@1.8.12` | arduino-cli 1.5.1 (or any recent 0.35+) | Core version pin is independent of arduino-cli version; verified core version is what matters for the `bad CPU type` issue, not the CLI itself. |
| `arduino:samd@1.8.12` | bossac 1.7.0-arduino3 (bundled, transitive dependency) | Bundled but not the default upload tool for `mzero_bl` ("Arduino M0"); relevant only if you manually invoke bossac as a last-resort recovery tool. |
| Direwolf 1.8.1 | rtl_fm from any current `rtl-sdr`/librtlsdr build | No known version coupling; Direwolf just consumes a raw audio pipe, format-agnostic to the RTL-SDR tool version. |
| usbipd-win 5.3.0 | WSL2 (`wsl --update` current kernel) | Requires Windows 10 1809+ or Server 2019+; keep `wsl --update`'d for broadest device support per Microsoft's own docs. |

---

## Sources

- `https://raw.githubusercontent.com/arduino/ArduinoCore-samd/1.8.12/boards.txt` and `.../platform.txt` — fetched directly (HIGH confidence): confirmed `mzero_bl` = "Arduino M0" FQBN, upload tool/protocol, dual VID:PID (app vs bootloader), bundled bossac version.
- https://github.com/wb2osz/direwolf/releases — Direwolf 1.8.1 (Nov 2025), 1.8 (Oct 2025), 1.7 (Oct 2023) — version/date confirmed via fetch.
- https://github.com/dorssel/usbipd-win — usbipd-win 5.3.0 (Oct 2025), OS requirements, non-persistent attach behavior — confirmed via fetch.
- https://learn.microsoft.com/en-us/windows/wsl/connect-usb — official Microsoft WSL2 USB passthrough guidance.
- https://github.com/dorssel/usbipd-win/issues/158 ("Pro Micro bootloader timing woes") and related usbipd-win issues — MEDIUM confidence, community-reported re-enumeration/timing problems specific to boards using 1200bps-touch/double-tap reset over USB/IP.
- https://github.com/arduino/arduino-cli/issues/1943 ("Recovery of soft bricked native USB boards w/o double-tap impossible without port selection") — MEDIUM confidence, confirms double-tap as the standard recovery path for unresponsive SAMD/native-USB boards.
- Gist: jj1bdx "APRS with rtl_fm, direwolf, and multimon-ng" — MEDIUM confidence, community reference for the canonical pipe command and multimon-ng comparison.
- rtl-sdr.com — RTL-SDR Blog V4 user guide, Windows quick-start (Zadig steps), forum note on ~2.56 MS/s practical sample-rate ceiling before dropped samples — MEDIUM confidence.
- QRP Labs shop (shop.qrp-labs.com/dummy) — same-manufacturer 50-ohm 20W dummy load kit, MEDIUM confidence (product listing, not independently bench-verified by this research pass).
- General electronics-repair practice (99% IPA, no-clean flux, hot-air for chip antennas, conformal coating) — LOW-MEDIUM confidence; consensus across several PCB-cleaning guides (allpcb.com, chemtronics.com, pcbtry.com) rather than a single authoritative source, and no GPS1003-specific repair guide was found. Treat bench-repair specifics as best-practice guidance to validate against the actual joint once inspected under magnification, not as a rigid procedure.

---
*Stack research for: Weather-damaged LightAPRS 2.0 (ATSAMD21) recovery — WSL2 flashing, RTL-SDR APRS RX validation, bench corrosion repair*
*Researched: 2026-07-05*
