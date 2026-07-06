# Architecture Research

**Domain:** Embedded hardware recovery/bring-up (damaged APRS tracker, ATSAMD21G18 + MAX-M8Q GPS + BMP180 + Si5351/DRA818V VHF radio)
**Researched:** 2026-07-05
**Confidence:** HIGH (bring-up ordering, RF-into-load rule — standard, multi-source verified) / MEDIUM (LightAPRS-specific pin/library mapping — inferred from repo, not bench-verified)

## Standard Architecture

### System Overview

This is not a runtime software architecture — it is a **gated diagnostic pipeline**. Each stage is a precondition for the next; skipping ahead produces false signals (e.g., a "GPS won't fix" symptom that is actually a starved 3V3 rail). The pipeline below is the core architectural artifact for this project.

```
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 0 — VISUAL / STATIC INSPECTION  (no power applied)            │
│  Corrosion mapping, joint integrity, continuity/short checks         │
│  Gate: no visible short across VBat/3V3/GND before first power-up   │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 1 — POWER RAIL INTEGRITY  (current-limited supply)            │
│  USB 5V in → buck-boost → 3V3 rail; VBat/supercap path; power-good  │
│  Gate: 3V3 stable within spec, current draw in idle-range, no       │
│        power-good fault, before touching MCU or peripherals          │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 2 — MCU ALIVE / PROGRAMMING PATH                               │
│  USB enumeration (CDC/native port), bootloader double-tap-reset,    │
│  arduino-cli detects port, blink/self-test sketch runs               │
│  Gate: MCU boots and is flashable before trusting any peripheral    │
│        read as a "real" failure vs. a dead/unflashed MCU             │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 3 — PERIPHERAL BRING-UP (non-RF)                               │
│  ┌────────────────────┐        ┌────────────────────┐               │
│  │ GPS (MAX-M8Q)       │        │ Sensor (BMP180)     │               │
│  │ UART/I2C comms →    │        │ I2C comms → chip-id │               │
│  │ NMEA/UBX parse →    │        │ read → pressure/temp │               │
│  │ antenna feed → fix  │        │ sanity check         │               │
│  └────────────────────┘        └────────────────────┘               │
│  Gate: each peripheral validated independently over its bus before  │
│        being trusted inside integrated flight firmware               │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 4 — RF PATH (highest-risk stage, always into a load)          │
│  Si5351 clock synth (VFO) → DRA818V transceiver module → 7-elem LPF │
│  → dummy load (bench) or antenna                                     │
│  Gate: dummy load / antenna physically connected and confirmed      │
│        BEFORE any key-up; Si5351 frequency verified before DRA818V   │
│        is keyed; DRA818V keyed at low power/short burst first        │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STAGE 5 — END-TO-END VALIDATION (independent verifier)               │
│  Flight firmware (GPS fix + BMP180 + AFSK/APRS encode) → DRA818V TX │
│  → RF into air → NooElec RTL-SDR (independent PC) → direwolf/ APRS  │
│  decoder → decoded callsign/position/telemetry confirms full chain  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Power subsystem | Convert USB 5V / VBat (2.7–6V) to stable 3V3, expose power-good | Buck-boost regulator IC + supercaps; verified with multimeter/scope, no firmware needed |
| MCU (ATSAMD21G18) | Boot, run self-test or flight firmware, arbitrate all buses | Arduino M0 core via arduino-cli, SAMD-D21 bootloader (double-tap reset for UF2/BOSSA) |
| GPS (MAX-M8Q) | Acquire satellites, output NMEA/UBX fix data | UART (primary) or I2C (DDC) to MCU; SparkFun u-blox library or TinyGPSPlus already vendored in repo |
| Sensor (BMP180) | Report pressure + temperature | I2C, Adafruit BMP085-compatible driver (vendored as `LightAPRS_Adafruit_BMP085_Library`) |
| RF synth (Si5351) | Generate the VHF carrier/clock feeding the DRA818V or direct FSK/AFSK | I2C-controlled clock generator; vendored `LightAPRS_Si5351Arduino` |
| RF transceiver (DRA818V) | Amplify/transmit the modulated carrier at 144-146 MHz | UART-configured Dorji module; requires antenna/dummy load before key-up |
| LPF (7-element) | Suppress harmonics/spurs from PA output | Passive, no firmware; verify by continuity/visual only, not independently testable without RF gear |
| Self-test firmware | Isolate and report on one subsystem at a time without flight logic | Separate `.ino` sketch(es), not the flight firmware |
| Flight firmware | Full integrated behavior: GPS → APRS encode → RF TX on schedule | Existing vendored sketches (`LightAPRS-2-pico-balloon`, `-hab`, `-vehicle`) |
| SDR verifier (RTL-SDR + PC) | Independent, out-of-band proof that RF+APRS chain works | NooElec dongle + `rtl_fm`/`direwolf` or similar APRS decoder on the host PC, decoupled from the tracker itself |

## Recommended Project Structure

```
LightAPRS-2.0/                          # existing repo root (do not restructure vendored dirs)
├── LightAPRS-2-pico-balloon/           # existing flight firmware (leave as-is until Stage 4/5)
├── LightAPRS-2-hab/                    # existing flight firmware variant
├── LightAPRS-2-vehicle/                # existing flight firmware variant
├── libraries/                          # existing vendored libs — reuse, do not fork unless forced
├── hardware-diagnostics/               # existing — visual evidence, expand as recovery log
│   ├── photos/                         # existing corrosion/board photos
│   └── notes.md                        # NEW: dated diagnosis log, one entry per bring-up stage
├── self-test/                          # NEW: isolated bring-up sketches, one per stage/peripheral
│   ├── 00_power_check/                 # NEW: reads power-good pin, prints 3V3 rail health if MCU can run
│   ├── 01_mcu_blink/                   # NEW: minimal sketch — onboard LED blink, proves flash+boot
│   ├── 02_gps_passthrough/             # NEW: relays raw NMEA/UBX bytes to USB serial for u-center/inspection
│   ├── 03_bmp180_read/                 # NEW: I2C chip-id + pressure/temp read, no other subsystem touched
│   ├── 04_si5351_tone/                 # NEW: sets a fixed test frequency, no DRA818V key-up
│   └── 05_dra818v_dummyload_tx/        # NEW: short, low-power keyed burst into dummy load only
├── sdr-verify/                         # NEW: host-side (Windows or WSL) SDR decode tooling
│   ├── capture.sh                      # NEW: rtl_fm/rtl_sdr capture wrapper for 144.39 MHz
│   └── decode-notes.md                 # NEW: direwolf/multimon-ng config + expected decoded output
└── .planning/                          # gsd planning artifacts (already present)
```

### Structure Rationale

- **`self-test/`:** Each numbered sketch touches exactly one subsystem and prints a pass/fail report over serial. Keeping them as separate `.ino` folders (Arduino requires sketch folder name == file name) means each is independently compilable/flashable without dragging in the full flight firmware's GPS/APRS/RF stack — a bad BMP180 read shouldn't require the Si5351 library to even link.
- **`hardware-diagnostics/notes.md`:** A running log tied to the gating stages (Stage 0 → 5) gives the roadmap phases a natural 1:1 mapping and creates an audit trail of what was verified before what was repaired.
- **`sdr-verify/`:** Lives outside the Arduino sketch tree entirely — it runs on the PC (or Windows side, since RTL-SDR drivers are commonly easier under Windows/Zadig than WSL USB passthrough), and its whole purpose is to be an *independent* verifier uncoupled from the tracker's own serial output. Coupling it into the same tree as the firmware would defeat the "prove it two ways" principle.

## Architectural Patterns

### Pattern 1: Gated Bring-Up (fail fast at the cheapest stage)

**What:** Never debug a "higher" stage until the stage below it is confirmed good. Power → MCU → peripherals (non-RF) → RF → end-to-end.
**When to use:** Any time hardware has unknown/suspected damage. Always start here for the LightAPRS recovery — moisture damage can plausibly hit any layer (corrosion was already observed at the GPS antenna feed, and general solder tarnish suggests power-path joints are equally suspect).
**Trade-offs:** Slower to reach "the exciting part" (RF/GPS), but every hour spent chasing a GPS symptom that's actually a marginal 3V3 rail is wasted; the gated order front-loads the cheap, low-risk checks (multimeter, visual) before the expensive/destructive ones (keying a PA).

**Example (conceptual, not code):**
```
if not power_rail_ok(): stop, repair power path
if not mcu_flashable(): stop, repair/reseat MCU or bootloader
if not gps_responds_on_bus(): stop before blaming "antenna" — confirm bus first
if not bmp180_responds_on_bus(): stop, isolate I2C bus fault vs. sensor fault
if not dummy_load_attached(): refuse to key DRA818V
```

### Pattern 2: Self-Test Sketch, Separate from Flight Firmware

**What:** A minimal Arduino sketch per subsystem that does nothing except initialize one peripheral, read/exercise it, and report a structured pass/fail line over USB serial. It is not a subset of the flight firmware — it's a parallel, disposable artifact.
**When to use:** During recovery/bring-up, before trusting the peripheral inside the full flight firmware's interrupt/timer/power-management stack (SleepyDog watchdog, ZeroTimer, low-power sleep between transmissions all vendored in this repo can mask or alter peripheral behavior).
**Trade-offs:** Extra sketches to maintain temporarily, but isolates the variable. If BMP180 fails inside flight firmware but passes in `03_bmp180_read`, the bug is in firmware integration (I2C bus contention, power sequencing, timing), not the sensor itself.

**Example:**
```cpp
// self-test/03_bmp180_read/03_bmp180_read.ino
#include <Wire.h>
#include <Adafruit_BMP085.h> // vendored LightAPRS_Adafruit_BMP085_Library

Adafruit_BMP085 bmp;

void setup() {
  Serial.begin(9600);
  while (!Serial) {}
  Serial.println("SELFTEST:BMP180:START");
  if (!bmp.begin()) {
    Serial.println("SELFTEST:BMP180:FAIL:no_ack");
    return;
  }
  Serial.print("SELFTEST:BMP180:PASS:temp_C=");
  Serial.print(bmp.readTemperature());
  Serial.print(",pressure_Pa=");
  Serial.println(bmp.readPressure());
}
void loop() {}
```

### Pattern 3: Structured Serial Report Protocol

**What:** Every self-test sketch emits a single-line, prefixed, machine-parseable status: `SELFTEST:<SUBSYSTEM>:<PASS|FAIL>[:<key=value,...>]`. A human reads it directly in a serial monitor; a script can `grep`/parse it just as easily.
**When to use:** From the very first self-test sketch onward — establishing the convention early means later stages (GPS, Si5351, DRA818V) all report consistently, and the `hardware-diagnostics/notes.md` log can just be a chronological paste of these lines with dates.
**Trade-offs:** Slightly more ceremony than `Serial.println("it works")`, but pays off the moment there's more than one subsystem to track, and makes it trivial to tell a genuinely new failure from a previously-seen one.

**Example:**
```
SELFTEST:POWER:PASS:vbat_present=1,pgood=1
SELFTEST:MCU:PASS:bootloader=v1.8.12,port=/dev/ttyACM0
SELFTEST:GPS:FAIL:no_nmea_after_60s
SELFTEST:BMP180:PASS:temp_C=22.4,pressure_Pa=101325
SELFTEST:SI5351:PASS:freq_hz=144390000
SELFTEST:DRA818V:PASS:tx_burst_ms=500,load=dummy_50ohm
```

## Data Flow

### Diagnosis-to-Repair Flow

```
[Visual inspection] → [photo/note in hardware-diagnostics/]
        ↓
[Power-on with current-limited supply] → [multimeter/scope on 3V3, VBat]
        ↓ (pass)
[Flash self-test/01_mcu_blink] → [USB enumerates, LED blinks] → confirms MCU+bootloader+flash path
        ↓ (pass)
[Flash self-test/02_gps_passthrough] → [raw NMEA visible?] 
        ↓                                   ↓ no
   yes → GPS module/bus OK,           → suspect antenna feed corrosion (Stage 0 finding)
         proceed to fix quality              → repair joint → retest passthrough
        ↓
[Flash self-test/03_bmp180_read] → [chip responds on I2C?]
        ↓ (pass, independent of GPS result)
[Flash self-test/04_si5351_tone] → [frequency confirmed on a receiver/SDR, no PA keyed]
        ↓ (pass)
[Attach dummy load] → [Flash self-test/05_dra818v_dummyload_tx] → [short keyed burst, verify current draw ~450-750mA, no damage]
        ↓ (pass)
[Flash real flight firmware variant] → [attach antenna] → [full GPS fix + APRS TX]
        ↓
[NooElec RTL-SDR on PC, 144.39 MHz] → [direwolf/APRS decode] → decoded packet = end-to-end proof
```

### Key Data Flows

1. **Diagnosis flow (this doc's core artifact):** Physical evidence → power verification → MCU verification → per-peripheral verification → RF-into-load verification → integrated flight-firmware verification → independent SDR proof. Each arrow is a hard gate, not a suggestion.
2. **Serial report flow:** Self-test sketch → USB serial → human/script log → `hardware-diagnostics/notes.md`, giving a durable record of what state the board was in at each repair step (important for a repair project since state changes as components are reworked).
3. **RF verification flow (dual-sided):** Tracker (Si5351 → DRA818V → LPF → antenna) is one side; RTL-SDR + decoder on the PC is the other, intentionally never sharing a clock, power supply, or code path with the tracker — this is what makes it an *independent* verifier rather than a self-report.

## Scaling Considerations

Not applicable in the traditional sense (this is a single unit of hardware, not a service). Reframed as "what changes as confidence increases":

| Stage of confidence | Approach |
|---|---|
| Unknown board state (now) | Bench power supply, current-limited, one subsystem at a time, self-test sketches only |
| Power+MCU confirmed good | Can leave board on USB power for extended peripheral bring-up sessions |
| All peripherals confirmed individually | Safe to flash integrated flight firmware; still bench-test with dummy load before first antenna TX |
| End-to-end proven once | Safe to consider field/flight use (explicitly out of scope for this milestone per PROJECT.md) |

### Scaling Priorities

1. **First bottleneck:** Power-path uncertainty. If the buck-boost or power-good behavior is marginal, every downstream test becomes ambiguous (brownout resets mimic peripheral faults). Resolve this before anything else, even before assuming the MCU is dead — a "dead" MCU is very often a starved 3V3 rail.
2. **Second bottleneck:** GPS antenna feed corrosion (already visually observed at L3/GPS1003 joint). This is the most concretely diagnosed damage; treat it as a hardware rework task gated behind confirming the MCU-to-GPS bus itself is fine first (Pattern 1) — otherwise a successful antenna repair could be wrongly credited/blamed for a bus-level issue.

## Anti-Patterns

### Anti-Pattern 1: Keying the DRA818V (or any PA) Without a Load

**What people do:** Flash the flight firmware and let it transmit "just to see if it does anything," without an antenna or dummy load attached, reasoning that a quick test transmission is low-risk.
**Why it's wrong:** PA output stages (the DRA818V explicitly, per its datasheet and this repo's own upload instructions) can be damaged in milliseconds with no load — reflected power has nowhere to go. On a board that is *already* weather-damaged, an unnecessary PA failure would be an entirely self-inflicted, avoidable second fault, confounding the diagnosis.
**Do this instead:** Always confirm a 50-ohm dummy load (bench) or a real antenna (field) is physically connected before any code path that can key the transmitter runs — including accidentally, e.g. via a flight-firmware default that starts transmitting on power-up. Gate this in the self-test sketch itself (require a manual confirmation step before `05_dra818v_dummyload_tx` proceeds).

### Anti-Pattern 2: Chasing a Peripheral Bug Before Confirming Power/MCU Health

**What people do:** See "GPS never gets a fix" and immediately dive into antenna repair, NMEA parsing, or library version issues.
**Why it's wrong:** On a moisture-damaged board, a marginal 3V3 rail, an intermittent solder joint on the I2C/UART lines, or a brownout-reset loop on the MCU can all present as "GPS doesn't work" even though the GPS module itself is fine. Time spent re-soldering an already-suspect antenna joint before confirming the rail and bus are solid risks fixing the wrong thing (or fixing a real problem while a second, unaddressed problem remains and is misattributed to the "fix" not working).
**Do this instead:** Follow the gated order — verify power rail and MCU first with dedicated, minimal self-test sketches unrelated to GPS, then verify the GPS module responds on its bus (passthrough sketch) before touching the antenna feed at all.

### Anti-Pattern 3: Debugging Directly in Flight Firmware

**What people do:** Make changes to `LightAPRS-2-pico-balloon.ino` (or the hab/vehicle variants) to add debug prints and try to bring up GPS/BMP180/RF from inside the full integrated sketch.
**Why it's wrong:** The flight firmware includes power-management (SleepyDog watchdog, sleep cycles), interrupt-driven timers (ZeroTimer), and an APRS/AFSK encode pipeline (ZeroAPRS) all interacting on shared buses and timing. A failure inside that stack is much harder to attribute to a single subsystem than a failure in an isolated 20-line self-test sketch.
**Do this instead:** Use the `self-test/` sketches (Pattern 2) to validate each subsystem in isolation first; only move into the flight firmware for Stage 5 (end-to-end), once every subsystem has already passed independently.

## Integration Points

### External Services / Tools

| Tool | Integration Pattern | Notes |
|------|---------------------|-------|
| arduino-cli (WSL) | CLI compile/upload against pinned `arduino:samd@1.8.12` core | Compile is native Linux-fine; upload needs the USB path resolved (see below) |
| usbipd-win / Windows-side flashing | Forward the board's COM port into WSL, or flash directly from Windows Arduino IDE | WSL2 cannot see Windows COM ports natively — this is a build/flash architecture decision, not just a nuisance: decide once, early, since every self-test sketch and the final flight firmware all need it |
| NooElec RTL-SDR + host PC | `rtl_fm`/`rtl_sdr` capture of 144.39 MHz → AFSK/APRS decoder (e.g., direwolf, multimon-ng) | Runs on the PC, decoupled from the tracker; this is the "independent verifier" and should never share code or power with the tracker itself |
| u-center (u-blox) or generic serial monitor | Read raw NMEA/UBX from the GPS passthrough self-test sketch | Useful for reading C/N0 satellite signal strength as a quantitative antenna-quality signal, not just fix/no-fix |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| MCU ↔ GPS (MAX-M8Q) | UART (primary, per vendored TinyGPSPlus/u-blox libraries) or I2C (DDC) | Confirm which bus the board actually wires to before assuming UART; check schematic/pinout image in `images/lightaprs-2-0-pinout.png` |
| MCU ↔ BMP180 | I2C | Shares the bus with GPS if GPS is also I2C-wired — a self-test isolating BMP180 alone rules out bus-level contention as a shared cause |
| MCU ↔ Si5351 | I2C | Clock synth only generates the signal; does not itself transmit — verify frequency via a receiver/SDR before trusting it feeds the DRA818V correctly |
| MCU ↔ DRA818V | UART (module configuration: frequency, power level, squelch) + a GPIO PTT/enable line | Configuration errors here (wrong frequency, wrong power level) are indistinguishable from hardware RF faults unless the Si5351 stage was already independently confirmed |
| Self-test sketches ↔ flight firmware | No shared runtime — separate `.ino` sketch folders | Deliberate boundary; prevents self-test isolation guarantees (Pattern 2) from being undermined by shared globals/timers |
| Tracker RF output ↔ SDR verifier | Physical RF over the air (or into a shared dummy-load tap if bench-testing), never a wired/software link | Preserves independence of the verification |

## Sources

- [Board Bring-Up — Circuit Cellar](https://circuitcellar.com/resources/quickbits/board-bring-up/) — MEDIUM confidence, general embedded bring-up ordering (power → debug UART → peripherals), consistent with multiple other sources
- [Power-On Checks and Voltage Rails — embeddedprep.com](https://embeddedprep.com/power-on-checks-and-voltage-rails/) — MEDIUM confidence, confirms current-limited-supply-first practice
- [The Definitive Guide to PCB Bring-Up — Cadence](https://resources.pcb.cadence.com/blog/the-definitive-guide-to-pcb-bring-up) — MEDIUM confidence, standard bring-up sequencing reference
- [Hardware Bring-Up Checklist — Hubble Network Community](https://hubble.com/community/guides/hardware-bring-up-checklist-what-to-test-before-writing-firmware/) — MEDIUM confidence, "test before writing firmware" self-test pattern support
- [Dummy Load — Wikipedia](https://en.wikipedia.org/wiki/Dummy_load) — HIGH confidence, general RF safety principle (known impedance, safe sink for transmitter output)
- [RF Power Amplifier Testing — KeyLink Microwave](https://www.keylinkmw.com/blog/rf-power-amplifier-testing_312/) — MEDIUM confidence, PA-into-load testing practice
- [MAX-M8 Hardware Integration Manual — u-blox](https://content.u-blox.com/sites/default/files/MAX-M8_HardwareIntegrationManual_(UBX-13004876).pdf) — HIGH confidence, official datasheet-level source for antenna feed / RF_IN considerations; confirms MAX-M8Q does not provide DC bias on RF_IN (relevant to the observed corroded antenna feed joint)
- Project repo itself (`README.md`, `PROJECT.md`, `libraries/` tree) — HIGH confidence for component inventory (ZeroAPRS, ZeroSi4463, SparkFun u-blox lib, Adafruit BMP085 fork, SleepyDog, ZeroTimer all vendored); the exact GPS bus wiring (UART vs I2C) and precise pin mapping are MEDIUM/LOW confidence from documentation alone — verify against the physical board and pinout image during Stage 3.

---
*Architecture research for: embedded hardware recovery/bring-up (LightAPRS 2.0 field recovery)*
*Researched: 2026-07-05*
