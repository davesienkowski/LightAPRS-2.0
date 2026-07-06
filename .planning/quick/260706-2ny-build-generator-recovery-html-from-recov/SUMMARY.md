---
gsd_artifact: quick-summary
quick_id: 260706-2ny
slug: build-generator-recovery-html-from-recov
date: 2026-07-06
status: complete
---

# Summary — Generate recovery.html from RECOVERY-LOG.md

## Outcome

`RECOVERY-LOG.md` is now the **single source of truth**. A new Node generator,
`hardware-diagnostics/build-recovery-dashboard.mjs`, parses the log into the
dashboard's `DATA` object and regex-replaces **only** the `const DATA = {…}`
literal inside `recovery.html`, leaving the CSS + render/interaction JS shell
(including the checkable-materials feature from 260706-1q3) untouched.

## Usage

```bash
node hardware-diagnostics/build-recovery-dashboard.mjs          # regenerate in place
node hardware-diagnostics/build-recovery-dashboard.mjs --check  # CI: exit 1 if stale
```

Edit `RECOVERY-LOG.md`, re-run, commit. `recovery.html`'s `DATA` block now
carries a `/* GENERATED … do not edit by hand */` banner.

## What is parsed from the log (authoritative)

safety gates · phase statuses+goals (status from the Progress-dashboard table) ·
DIAG-01 findings (severity from 🔴🟡🟢⬜ emoji) · DIAG-02 measure tables (A/B) ·
Phase 2–4 checklists (REQ-id → id) + fill-in field templates · requirement
tracker · materials (Have / Required / DIY dummy / Optional) · running log ·
open questions · `meta.updated` (latest log date) · `meta.coreValue` (from the
log's Core-Value line, key phrases auto-bolded).

## Presentation-only exception (documented, not from the log)

`meta.subtitle` — the log has no one-line marketing pitch. Lives as a single
labeled constant (`PRESENTATION.subtitle`) in the generator. Everything that can
actually *drift* comes from the log.

## Drift resolved (log wins)

The old hand-written `DATA` had fewer items than the log; regeneration reconciled:
- Materials **Have** 5 → 6 (IPA and no-clean flux were merged; log lists separately).
- Materials **Required** 4 → 5 (solder wick + fresh thin solder were merged).
- Materials **Optional** 5 → 7 (log has 2 more: IPA swabs, known-good APRS ref).

## Bugs found + fixed during verification (via parse-diff against golden DATA)

1. **DIAG-01 findings block dropped** — `- 🔴 …` bullets have a leading list dash;
   the emoji regex expected the emoji at line-start. Fixed `TAG_RE` to allow an
   optional list marker.
2. **TOOL-02 requirement mangled** (`Pnull`, truncated, dropped from P4 reqIds) —
   its cell holds an escaped pipe `` `rtl_fm \| direwolf` ``; naive `split("|")`
   shattered the row. Added `splitCells()` that splits on unescaped pipes only.
3. **Banner would stack** on re-runs — made `DATA_RE` swallow any prior banner.
4. **innerHTML safety** — requirement captions + material name/desc are now
   `mdInline`-escaped (so `sats>0` stays literal, `` `rtl_fm | direwolf` `` renders
   mono), and field templates are `esc()`-escaped.

## Verification

- `--check` idempotent: exits 0, "recovery.html up to date".
- Exactly one GENERATED banner.
- Full page `<script>` evaluates clean against a stubbed DOM (no JS errors).
- Spot-checked rendered strings: TOOL-02 mono, `sats&gt;0` escaped, bold/italic intact.

## Follow-up (optional)

- Wire `build-recovery-dashboard.mjs --check` into CI / a pre-commit hook so the
  HTML can't silently drift from the log.
