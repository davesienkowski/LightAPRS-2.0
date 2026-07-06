---
gsd_artifact: quick-summary
quick_id: 260706-1q3
slug: make-recovery-html-required-before-proce
date: 2026-07-06
status: complete
---

# Summary — Checkable materials in recovery.html

## Outcome

"Required before proceeding" (and "Optional / nice-to-have") materials in
`recovery.html` are now interactive: each row has a **checkbox** (tick when
acquired) and a **free-text notes field** (ordered / substitute / link / etc.).
Both persist to `localStorage`, reusing the page's existing `.cbox` + `.meas-in`
persistence machinery — no new event wiring needed.

## Changes (`hardware-diagnostics/recovery.html`)

- CSS: `.mlist.mcheck`, `.mtext`, `.mat-note`, `.reqcount` for the checkable layout.
- `mCheckItems(arr, prefix)` renderer + `matSlug()` for stable, deterministic
  localStorage keys derived from the material name (e.g.
  `mat:req-50-dummy-load:c`, `…:note`). Keys are slug-based so they survive
  content edits without losing saved state.
- Required card header shows a live `N/M acquired` counter (`reqCount()`),
  refreshed on toggle.
- "Export readings" now appends a **Required materials** section with `[x]`/`[ ]`
  and notes, so acquired-status round-trips to the clipboard export.

## Verification

Headless eval of the page's `<script>` against a stubbed DOM: parses and runs
clean; slug generation produces stable, unique keys for all required items.

## Notes

- Interactive state is client-side (localStorage), so it is **orthogonal to the
  planned MD→HTML generator** — regenerating the HTML will not wipe a user's
  ticks/notes, as long as material names (hence slugs) are unchanged.
