# Hardware Diagnostics — LightAPRS 2.0 (N8EPK)

Phase 1 / DIAG-01 — visual inspection log. Photos in `photos/`.

## 2026-07-05 — Visual inspection from photos (pre-bench)

**Source images:** `board-front-01..04.png` (full front, varied light/focus) + `gps-antenna-feed-closeup.png` (macro of the Rainsun GPS1003 feed). Board back not yet photographed.

### Findings (front side)

1. **GPS antenna feed (Rainsun GPS1003) — PRIMARY SUSPECT.**
   Macro shows the feed-point solder joint at the base of the chip antenna (by `L3`) is **dark brown/amber with a rough, grainy texture** — consistent with oxidized flux residue and/or early moisture corrosion. This is exactly the node whose integrity determines GPS RX. Highest-priority area to test (continuity feed→ground) and, if the bus is proven good, to rework.

2. **General surface film.**
   A hazy whitish/dull film appears over parts of the board in photos 01–02 (around the micro-USB shell and some lower-left passives). Could be flux residue, water mineral deposits, or light surface corrosion. Needs a 99% IPA clean + re-inspection under magnification before judging joints underneath.

3. **Micro-USB connector.**
   Shell shows dulling/spotting (photos 01–02). Connectors are moisture traps; check for corroded pins / intermittent enumeration during Phase 2.

4. **Supercaps (2× blue, right side).**
   Wired to VBAT/GND via twisted leads + bulky solder blobs; joints look intact. If they were wet/cold, ESR/capacity may have degraded — measure terminal voltage and charge/hold behavior in Phase 1 power checks.

5. **Wire terminations.**
   Black GND/VBAT wires (left) and the thin bottom-center monopole (2 m antenna/counterpoise) appear mechanically sound at their solder pads.

6. **No obvious** cracked components, burn marks, or lifted pads visible from these angles.

### Limits of a photo inspection (cannot rule out)
- Cold/oxidized joints *under* the ATSAMD21 QFN and *under* the MAX-M8Q LGA (hidden corrosion — the exact-board "Sats:0" precedent was an **L1 inductor defect + antenna mismatch**, not the visible feed).
- Any electrical fault (shorts, open rails) — requires meter.
- Back-side condition — **not photographed yet** (please add back-side photos).

### Recommended bench checks (DIAG-02, next)
- [ ] Continuity: GPS antenna feed → ground; 2+ ground pads.
- [ ] Resistance VBAT→GND and 3V3→GND cold (look for a dead short before applying power).
- [ ] Current-limited power-up (USB-only, then VBAT-only): confirm 3V3 = 3.3 V ±5%, no current runaway.
- [ ] Buck-boost "power good" asserts.
- [ ] Supercap terminal voltage + hold.

*Inspection by: assistant, from operator-supplied photos. Bench verification pending operator + equipment.*
