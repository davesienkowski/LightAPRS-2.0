# LightAPRS 2.0 Field-Recovery (N8EPK)

## What This Is

A recovery-and-repair effort for a QRP-Labs **LightAPRS 2.0** APRS tracker (ATSAMD21G18 / ARM Cortex-M0+) that was left outdoors too long and shows environmental damage. The goal is to systematically diagnose which components are degraded, repair or replace them, reflash known-good firmware, and prove the tracker works end-to-end again — culminating in a confirmed GPS fix and a valid APRS packet transmitted on the 2 m band. It also builds small custom tools/scripts to speed up hardware and firmware troubleshooting, including an SDR-based receive path to verify transmissions from the PC.

## Core Value

**The tracker powers up, acquires a GPS fix, and transmits a decodable APRS packet.** If everything else is deferred, this must work.

## Requirements

### Validated

<!-- Inferred from the existing, compiling firmware in this repo (brownfield). -->

- ✓ Firmware sources build for all three variants (pico-balloon, hab, vehicle) — existing, verified via arduino-cli `arduino:samd@1.8.12`, ~20% flash
- ✓ Vendored SAMD library set resolves and links (ZeroAPRS, ZeroSi4463, u-blox, geofence, etc.) — existing
- ✓ Reproducible WSL build environment (arduino-cli + pinned SAMD core) — established this session

### Active

<!-- Hypotheses until confirmed on the physical board. -->

- [ ] Visual + electrical damage assessment of the board (corrosion, cold/oxidized joints, component integrity)
- [ ] Diagnose the GPS antenna feed / L3 area — closeup shows corrosion at the Rainsun GPS1003 solder joint
- [ ] Verify power path: USB enumeration, 3V3 rail, VBat/supercap input, buck-boost "power good"
- [ ] Verify GPS: MAX-M8Q communicates over UART/I2C and achieves a fix (may require antenna feed repair first)
- [ ] Verify sensor: BMP180 pressure/temperature read over I2C
- [ ] Verify VHF radio: Si5351/DRA818V path transmits (with a dummy load/antenna attached — never key up bare)
- [ ] Repair/replace damaged parts identified during diagnosis
- [ ] Reflash firmware to the board (resolve WSL↔USB flashing path: usbipd-win or Windows-side)
- [ ] Build custom troubleshooting/test tooling (serial monitors, register pokes, self-test sketches)
- [ ] SDR receive-and-decode validation path (NooElec RTL-SDR → 144.39 MHz → APRS decode) to confirm TX independently
- [ ] End-to-end validation: GPS fix + decodable APRS packet received on the SDR

### Out of Scope

- WSPR / LightAPRS-W variant — different board/firmware; not what's being recovered
- Board redesign or PCB respin — this is a repair, not a new build
- Flying an actual balloon mission — recovery proves function; flight is a separate future effort
- Antenna/RF range optimization — bench validation only, not field-range tuning

## Context

- **Hardware**: LightAPRS 2.0, QRP-Labs. MCU ATSAMD21G18 (48 MHz, 256 KB flash, 32 KB RAM). GPS u-blox MAX-M8Q with Rainsun GPS1003 chip antenna. Sensor BMP180. VHF via Si5351 + Dorji DRA818V, 7-element LPF. Powered via micro-USB or VBat (buck-boost regulator), supercaps visible in photos.
- **Observed damage**: Photos (`hardware-diagnostics/photos/`) show discoloration/corrosion concentrated at the GPS antenna feed point (L3/antenna joint) and general solder tarnish consistent with moisture exposure. Five photos: four full-board fronts + one macro of the antenna feed.
- **Operator**: Licensed amateur, callsign **N8EPK** — legally cleared to transmit on 2 m.
- **Repos**: `LightAPRS-2.0` (this repo — forked to `davesienkowski`, upstream `lightaprs/LightAPRS-2.0`). A separate `LightAPRS-1.0` fork exists but is for the older ATmega1284P board and is not the recovery target.
- **Test gear**: NooElec RTL-SDR + antenna connectable to the PC — enables independent RX verification of transmissions.

## Constraints

- **Tech stack**: Arduino / arduino-cli, SAMD core pinned to **1.8.12** (newer versions throw `bad CPU type in executable`); vendored libraries only, never Library Manager versions — Why: upstream-known-good config, patched SAMD forks.
- **Toolchain (build)**: Runs in WSL; compile works natively — Why: arduino-cli + ARM GCC are Linux-native.
- **Toolchain (flash)**: WSL2 cannot see Windows COM ports directly; uploading needs `usbipd-win` forwarding or Windows-side flashing — Why: WSL USB limitation.
- **Safety**: Never transmit without a dummy load or antenna attached — Why: the DRA818V PA can be damaged with no load.
- **Regulatory**: 2 m transmissions require the amateur license (held) — Why: FCC Part 97.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Recover the 2.0 board (not the 1.0 fork) | Physical hardware is LightAPRS 2.0 / ATSAMD21, confirmed from silkscreen + chip markings | ✓ Good |
| Pin SAMD core to 1.8.12 | Upstream README warns newer versions break the upload tool | ✓ Good |
| Fork LightAPRS-2.0 to own account | Needed a writable remote to commit recovery work | ✓ Good |
| Use SDR (NooElec) for TX validation | Independent RX proof that the radio path works, no second APRS station needed | — Pending |
| Coarse phase granularity | Focused recovery job; diagnose → repair → reflash → validate | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-05 after initialization*
