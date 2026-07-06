---
gsd_artifact: quick-plan
quick_id: 260706-0u2
slug: comprehensively-review-recovery-html-for
date: 2026-07-06
status: complete
---

# Quick Task — Review recovery.html for incorrect/misleading content

Comprehensively review `hardware-diagnostics/recovery.html`, cross-checked against
its declared source of truth (`hardware-diagnostics/RECOVERY-LOG.md`) and GSD
`STATE.md`. Fix content that misrepresents project progress — flagged example:
the `Core value — "done"` label reads as a *completion status* when the project
has barely started.

## Approach

1. Read `recovery.html` in full (data-driven page: all content in one `DATA = {…}`
   object; DOM is generated, so fixes go in the data/markup strings, not the render JS).
2. Cross-check every factual claim against `RECOVERY-LOG.md`, `STATE.md`, `PROJECT.md`.
3. Classify findings: hard errors vs. faithful-but-arguable-source vs. informational.
4. Fix unambiguous errors. Leave source-of-truth judgment calls to the user.

## Tasks

- [x] Full read + cross-check against source-of-truth docs
- [x] Fix the misleading `Core value — "done"` label → `Core value — definition of "done"`
- [x] Record remaining findings (DIAG-01 "pass" while inspection incomplete; STATE.md
      vs. dashboard progress divergence) for the user to adjudicate

## Out of scope

- Changing DIAG-01's status (it faithfully mirrors `RECOVERY-LOG.md:35` ✅ — the
  source of truth's call, not an HTML bug).
- Reconciling GSD `STATE.md` (0%, "planning") with the hardware dashboard — they
  measure different things by design.
