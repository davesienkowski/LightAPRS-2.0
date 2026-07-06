#!/usr/bin/env node
// Build recovery.html from RECOVERY-LOG.md — RECOVERY-LOG.md is the single
// source of truth. This script parses the log into the page's `DATA` object and
// regex-replaces ONLY the `const DATA = {…}` literal inside recovery.html,
// leaving the CSS + render/interaction JS shell untouched.
//
//   Usage:  node build-recovery-dashboard.mjs [--check]
//     (default) regenerate recovery.html in place
//     --check   parse + report, write nothing, exit 1 if the DATA block moved
//
// The only presentation copy NOT taken from the log is meta.subtitle (the log
// has no equivalent one-line pitch). It lives in PRESENTATION below, labeled.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(HERE, "RECOVERY-LOG.md");
const HTML = path.join(HERE, "recovery.html");

// ── presentation-only copy (the log carries no one-line marketing subtitle) ──
const PRESENTATION = {
  subtitle:
    "A QRP-Labs LightAPRS 2.0 (ATSAMD21G18) left outdoors too long. Diagnose the " +
    "damage, repair it, reflash, and prove it flies again — GPS fix + a decodable " +
    "APRS packet on 2 m.",
  // trailing sentence appended to the log's Core-Value line
  coreValueTail: " If everything else is deferred, this must work.",
  // phrases auto-bolded inside the core-value line
  coreValueBold: ["powers up", "GPS fix", "APRS packet", "decodable APRS packet"],
};

const STATUS = { "🔄": "active", "✅": "pass", "⬜": "todo", "❌": "fail", "⏭️": "defer" };
const TAG = { "🔴": "red", "🟡": "amber", "🟢": "green", "⬜": "todo", "✅": "green" };
const STATUS_RE = /🔄|✅|⬜|❌|⏭️/;
const TAG_RE = /^\s*[-*]?\s*(🔴|🟡|🟢|⬜|✅)/; // optional list marker before the emoji

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// escape first, THEN turn **bold** / *italic* / `code` into real tags
function mdInline(s) {
  return esc(s.trim())
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+?)\*/g, "<i>$1</i>")
    .replace(/`([^`]+?)`/g, '<span class="mono">$1</span>');
}
// split a table row on UNescaped pipes ( `\|` inside a cell stays literal )
const splitCells = (line) =>
  line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
const slug = (s) =>
  s.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const ridId = (rid) => rid.toLowerCase().replace(/[^a-z0-9]/g, "");

// split a markdown table body into arrays of trimmed cells (skips separator rows)
function tableRows(lines) {
  return lines
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l))
    .map(splitCells);
}

// ── read + section the log ──────────────────────────────────────────────────
const md = fs.readFileSync(LOG, "utf8");
const lines = md.split("\n");
// H2 sections: {title, body[]}
const sections = [];
let cur = { title: "__head__", body: [] };
for (const l of lines) {
  const h = l.match(/^##\s+(.+?)\s*$/);
  if (h) { sections.push(cur); cur = { title: h[1], body: [] }; }
  else cur.body.push(l);
}
sections.push(cur);
const section = (needle) => sections.find((s) => s.title.includes(needle));

// ── meta ──────────────────────────────────────────────────────────────────
const head = sections[0].body.join("\n");
const coreLine = (head.match(/\*\*Core Value[^:]*:\*\*\s*(.+)/) || [])[1] || "";
let coreValue = esc(coreLine.trim());
for (const p of PRESENTATION.coreValueBold)
  coreValue = coreValue.replace(new RegExp(`(${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`), "<b>$1</b>");
coreValue += PRESENTATION.coreValueTail;

// ── safety ──────────────────────────────────────────────────────────────────
const safety = section("Safety gates").body
  .filter((l) => /^\d+\.\s/.test(l))
  .map((l) => mdInline(l.replace(/^\d+\.\s*/, "")));

// ── requirement tracker (inside Progress dashboard) ─────────────────────────
const dash = section("Progress dashboard").body;
const reqStart = dash.findIndex((l) => /\|\s*REQ\s*\|/i.test(l));
const requirements = tableRows(dash.slice(reqStart))
  .slice(1) // drop header row
  .map((c) => {
    const status = STATUS[(c[3].match(STATUS_RE) || [])[0]] || "todo";
    return [c[0], mdInline(c[1]), Number(c[2]), status];
  });
const reqIdsFor = (n) => requirements.filter((r) => r[2] === n).map((r) => r[0]);

// phase status from the dashboard phase table (authoritative)
const phaseStatus = {};
tableRows(dash.slice(0, reqStart)).forEach((c) => {
  const nm = (c[0].match(/\*\*(\d+)\s*—/) || [])[1];
  if (nm) phaseStatus[Number(nm)] = STATUS[(c[2].match(STATUS_RE) || [])[0]] || "todo";
});

// ── phases ──────────────────────────────────────────────────────────────────
function parseFindings(subHeader, body) {
  const hm = subHeader.match(/^###\s+([A-Z0-9-]+)\s*—\s*(.+?)\s*(🔄|✅|⬜|❌|⏭️)?\s*$/);
  const rid = hm ? hm[1] : "";
  const name = hm ? hm[2] : subHeader.replace(/^###\s+/, "");
  const pill = STATUS[(subHeader.match(STATUS_RE) || [])[0]] || "todo";
  const items = body
    .filter((l) => TAG_RE.test(l))
    .map((l) => {
      const t = TAG[(l.match(TAG_RE) || [])[1]] || "todo";
      const x = mdInline(l.replace(/^\s*[-*]?\s*/, "").replace(TAG_RE, ""));
      return { t, x };
    });
  return { type: "findings", title: `${rid} · ${name}`, sub: "", pill, items };
}

function parseMeasures(subHeader, body) {
  // one measure block per "**A. …**" / "**B. …**" intro; rows are the |table| lines that follow
  const rid = (subHeader.match(/^###\s+([A-Z0-9-]+)/) || [])[1] || "";
  const blocks = [];
  let block = null;
  for (const l of body) {
    const intro = l.match(/^\*\*([A-Z])\.\s+(.+?)\*\*\s*(.*)$/);
    if (intro) {
      if (block) blocks.push(block);
      const tail = (intro[2] + " " + intro[3]).trim();
      const dash = tail.indexOf("—");
      const name = (dash >= 0 ? tail.slice(0, dash) : tail).trim();
      const sub = dash >= 0 ? mdInline(tail.slice(dash + 1)) : "";
      block = { type: "measure", title: `${rid}${intro[1]} · ${name}`, sub, rows: [] };
    } else if (block && /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|?\s*$/.test(l)) {
      const c = splitCells(l);
      if (/^#$|^measurement$/i.test(c[0])) continue; // header row
      const label = c[1], exp = c[2];
      if (!label) continue;
      block.rows.push({ id: slug(label), label: mdInline(label), exp: mdInline(exp) });
    }
  }
  if (block) blocks.push(block);
  return blocks;
}

function parseChecklist(body) {
  const items = body
    .filter((l) => /^\s*-\s*\[[ x]\]/.test(l))
    .map((l) => {
      const txt = l.replace(/^\s*-\s*\[[ x]\]\s*/, "");
      const bold = (txt.match(/^\*\*(.+?)\*\*/) || [])[1] || "";
      const isReq = /^[A-Z]+-\d+$/.test(bold);
      const rid = isReq ? bold : "";
      const label = mdInline(txt.replace(/^\*\*.+?\*\*\s*—?\s*/, ""));
      return { id: isReq ? ridId(rid) : slug(bold || label), rid, label };
    });
  return { type: "check", items };
}

function parseField(body) {
  const text = [];
  let inFence = false;
  for (const l of body) {
    if (/^```/.test(l)) { inFence = !inFence; continue; }
    if (inFence) text.push(esc(l));
  }
  return text.length ? { type: "field", text: text.join("\n") } : null;
}

const phases = sections
  .filter((s) => /^Phase\s+\d+/.test(s.title))
  .map((s) => {
    const n = Number(s.title.match(/^Phase\s+(\d+)/)[1]);
    const name = s.title.replace(/^Phase\s+\d+\s*—\s*/, "").replace(/\s*(🔄|✅|⬜|❌|⏭️)\s*$/, "").trim();
    const gateLine = s.body.find((l) => /^\*\*Gate/.test(l)) || "";
    let goal = mdInline(gateLine.replace(/^\*\*Gate[^:]*:\*\*\s*/, ""));
    if (/Gate\s*\(Core Value\)/.test(gateLine)) goal += " (Core Value)";
    const status = phaseStatus[n] || "todo";

    // subsections (### …) → findings / measures ;  else checklist + field
    const blocks = [];
    const subIdx = s.body.map((l, i) => (/^###\s/.test(l) ? i : -1)).filter((i) => i >= 0);
    if (subIdx.length) {
      subIdx.forEach((start, k) => {
        const end = k + 1 < subIdx.length ? subIdx[k + 1] : s.body.length;
        const header = s.body[start];
        const sub = s.body.slice(start + 1, end);
        if (sub.some((l) => TAG_RE.test(l))) blocks.push(parseFindings(header, sub));
        if (sub.some((l) => /^\*\*[A-Z]\.\s/.test(l))) blocks.push(...parseMeasures(header, sub));
      });
    } else {
      if (s.body.some((l) => /^\s*-\s*\[[ x]\]/.test(l))) blocks.push(parseChecklist(s.body));
      const f = parseField(s.body);
      if (f) blocks.push(f);
    }

    const phase = { n, name, goal, status, reqIds: reqIdsFor(n), blocks };
    if (status === "active") phase.open = true;
    return phase;
  });

// ── materials ───────────────────────────────────────────────────────────────
const matBody = section("Materials & shopping list").body;
// slice by ### subsections
const matSubs = {};
{
  let key = null;
  for (const l of matBody) {
    const h = l.match(/^###\s+(.+?)\s*$/);
    if (h) { key = h[1]; matSubs[key] = []; }
    else if (key) matSubs[key].push(l);
  }
}
const findSub = (needle) => Object.entries(matSubs).find(([k]) => k.includes(needle))?.[1] || [];
function pairTable(lines, descCols) {
  return tableRows(lines).slice(1).map((c) => {
    const name = mdInline(c[0]);
    const desc = mdInline(descCols.map((i) => c[i]).filter(Boolean).join(" — "));
    return [name, desc];
  });
}
const materials = {
  have: pairTable(findSub("Have"), [1]),
  required: pairTable(findSub("Required before proceeding"), [1, 2]),
  dummy: findSub("DIY 50")
    .filter((l) => /^\s*-\s/.test(l))
    .map((l) => mdInline(l.replace(/^\s*-\s*/, ""))),
  optional: pairTable(findSub("Optional"), [1]),
};

// ── running log ─────────────────────────────────────────────────────────────
const log = tableRows(section("Running log").body)
  .slice(1)
  .filter((c) => c[0] && c[2])
  .map((c) => [c[0], c[1], mdInline(c[2])]);
const updated = log.map((r) => r[0]).sort().slice(-1)[0] || "";

// ── open questions ──────────────────────────────────────────────────────────
const questions = section("Open questions").body
  .filter((l) => /^\s*-\s/.test(l))
  .map((l) => mdInline(l.replace(/^\s*-\s*/, "")));

// ── assemble DATA ───────────────────────────────────────────────────────────
const DATA = {
  meta: { subtitle: PRESENTATION.subtitle, coreValue, updated },
  safety,
  phases,
  requirements,
  materials,
  log,
  questions,
};

// ── inject into recovery.html ───────────────────────────────────────────────
const html = fs.readFileSync(HTML, "utf8");
// also consume a previously-generated banner so re-runs don't stack banners
const DATA_RE = /(?:\/\* GENERATED from RECOVERY-LOG\.md[^\n]*\n)?const DATA = \{[\s\S]*?\n\};\n/;
if (!DATA_RE.test(html)) {
  console.error("ERROR: could not locate `const DATA = {…};` block in recovery.html");
  process.exit(1);
}
const banner = "/* GENERATED from RECOVERY-LOG.md by build-recovery-dashboard.mjs — do not edit by hand */\n";
const injected = banner + "const DATA = " + JSON.stringify(DATA, null, 2) + ";\n";
const out = html.replace(DATA_RE, injected);

const summary =
  `phases:${phases.length} reqs:${requirements.length} safety:${safety.length} ` +
  `have:${materials.have.length} required:${materials.required.length} ` +
  `optional:${materials.optional.length} log:${log.length} questions:${questions.length}`;

if (process.argv.includes("--check")) {
  process.stdout.write("parsed: " + summary + "\n");
  process.stdout.write(out === html ? "recovery.html up to date\n" : "recovery.html WOULD change\n");
  process.exit(out === html ? 0 : 1);
}
fs.writeFileSync(HTML, out);
process.stdout.write("wrote recovery.html — " + summary + "\n");
