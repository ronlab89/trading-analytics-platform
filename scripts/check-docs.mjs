// Documentation consistency check for the SDD set (docs/README.md, "Maintenance").
//
// Checks:
//   1. References to numbered SDD documents (NN-name.md) and ADRs (NNNN-name.md)
//      in docs/**/*.md, README.md and CONTRIBUTING.md resolve to existing files.
//   2. Code fence info strings carry a single language token and no attributes.
//   3. The first heading of each docs/NN-*.md is "# SDD NN — Title" with its own number.
//   4. Every ADR (docs/adr/NNNN-*.md) has the required sections.
//
// Output: one "path:line: message" line per problem, then a summary.
// Exit code: 1 when any problem is found, 0 otherwise.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, "docs");
const ADR_DIR = join(DOCS_DIR, "adr");

// Documents decided but not written yet. Remove an entry once its file exists.
/** @type {Map<string, string>} */
const PLANNED_DOCS = new Map();

// Wildcard references that intentionally describe a range of documents.
const ALLOWED_PATTERN_REFS = new Map([["CONTRIBUTING.md", new Set(["00-*.md", "15-*.md"])]]);

// Stale names quoted on purpose (for example, as examples of past drift).
// Remove an entry once the quoting text is rewritten.
const QUOTED_REFS = new Map([
  [
    "docs/BACKEND-ROADMAP.md",
    new Set(["05-architecture.md", "06-api-spec.md", "06-data-model.md"]),
  ],
]);

const ADR_REQUIRED_SECTIONS = [
  /^\*\*Status:\*\*/,
  /^## Context\s*$/,
  /^## Decision\s*$/,
  /^## Consequences\s*$/,
  /^## Alternatives Considered\s*$/,
  /^## Deferred detail\s*$/,
  /^## Related\s*$/,
];

const SDD_REF = /(?<![\w-])(\d{2}-[A-Za-z0-9*_-]+\.md)/g;
const ADR_REF = /(?<![\w-])(\d{4}-[A-Za-z0-9*_-]+\.md)/g;
const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const SDD_FILE = /^(\d{2})-[a-z0-9-]+\.md$/;
const ADR_FILE = /^\d{4}-[a-z0-9-]+\.md$/;
const SDD_TITLE = /^# SDD (\d{2}) — \S.*$/;

/** @type {string[]} */
const problems = [];
/** @type {Set<string>} */
const usedAllowEntries = new Set();

/**
 * @param {string} file
 * @param {number} line
 * @param {string} message
 */
function report(file, line, message) {
  problems.push(`${file}:${String(line)}: ${message}`);
}

/** @param {string} absolute */
function rel(absolute) {
  return relative(ROOT, absolute).split(sep).join("/");
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function markdownFilesUnder(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...markdownFilesUnder(full));
    else if (entry.endsWith(".md")) files.push(full);
  }
  return files;
}

/** @param {string} absolute */
function readLines(absolute) {
  return readFileSync(absolute, "utf8").split(/\r?\n/);
}

/**
 * @param {string} file
 * @param {string} ref
 */
function isAllowedPattern(file, ref) {
  const allowed = ALLOWED_PATTERN_REFS.get(file);
  if (allowed?.has(ref)) {
    usedAllowEntries.add(`pattern:${file}:${ref}`);
    return true;
  }
  return false;
}

/**
 * @param {string} file
 * @param {string} ref
 */
function isQuoted(file, ref) {
  const quoted = QUOTED_REFS.get(file);
  if (quoted?.has(ref)) {
    usedAllowEntries.add(`quoted:${file}:${ref}`);
    return true;
  }
  return false;
}

/**
 * @param {string} file
 * @param {number} lineNo
 * @param {string} ref
 * @param {string} dir
 * @param {string} kind
 */
function checkRef(file, lineNo, ref, dir, kind) {
  if (ref.includes("*")) {
    if (!isAllowedPattern(file, ref)) {
      report(file, lineNo, `placeholder ${kind} reference "${ref}"; name the document`);
    }
    return;
  }
  if (existsSync(join(dir, ref))) return;
  if (kind === "SDD" && PLANNED_DOCS.has(ref)) return;
  if (isQuoted(file, ref)) return;
  report(file, lineNo, `${kind} reference "${ref}" does not resolve to ${rel(dir)}/${ref}`);
}

/** @param {string} absolute */
function checkReferencesAndFences(absolute) {
  const file = rel(absolute);
  const lines = readLines(absolute);
  /** @type {string | null} */
  let openFence = null;

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    for (const match of line.matchAll(SDD_REF)) {
      checkRef(file, lineNo, match[1] ?? "", DOCS_DIR, "SDD");
    }
    for (const match of line.matchAll(ADR_REF)) {
      checkRef(file, lineNo, match[1] ?? "", ADR_DIR, "ADR");
    }

    const fence = FENCE_OPEN.exec(line);
    if (!fence) return;
    const marker = fence[1] ?? "";
    const info = (fence[2] ?? "").trim();
    if (openFence === null) {
      openFence = marker;
      if (/\s/.test(info)) {
        report(file, lineNo, `code fence info string has extra attributes: "${info}"`);
      }
    } else if (marker[0] === openFence[0] && marker.length >= openFence.length && info === "") {
      openFence = null;
    }
  });

  if (openFence !== null) report(file, lines.length, "unclosed code fence");
}

/** @param {string} absolute */
function checkSddTitle(absolute) {
  const file = rel(absolute);
  const number = SDD_FILE.exec(absolute.split(sep).pop() ?? "")?.[1];
  if (number === undefined) return;
  const lines = readLines(absolute);
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (FENCE_OPEN.test(line)) inFence = !inFence;
    if (inFence || !/^#{1,6}\s/.test(line)) continue;
    const title = SDD_TITLE.exec(line);
    if (!title) {
      report(file, index + 1, `first heading must be "# SDD ${number} — <Title>", found "${line}"`);
    } else if (title[1] !== number) {
      report(file, index + 1, `first heading names SDD ${title[1] ?? "?"}, expected ${number}`);
    }
    return;
  }
  report(file, 1, `missing first heading "# SDD ${number} — <Title>"`);
}

/** @param {string} absolute */
function checkAdrSections(absolute) {
  const file = rel(absolute);
  const lines = readLines(absolute);
  for (const section of ADR_REQUIRED_SECTIONS) {
    if (!lines.some((line) => section.test(line))) {
      const name = section.source.replace(/\\s\*\$$/, "").replace(/[\\^$]/g, "");
      report(file, 1, `ADR is missing required section "${name}"`);
    }
  }
}

function checkUnusedExceptions() {
  for (const ref of PLANNED_DOCS.keys()) {
    if (existsSync(join(DOCS_DIR, ref))) {
      report("scripts/check-docs.mjs", 1, `"${ref}" now exists; remove it from PLANNED_DOCS`);
    }
  }
  for (const [kind, map] of [
    ["pattern", ALLOWED_PATTERN_REFS],
    ["quoted", QUOTED_REFS],
  ]) {
    for (const [file, refs] of /** @type {Map<string, Set<string>>} */ (map)) {
      for (const ref of refs) {
        if (!usedAllowEntries.has(`${String(kind)}:${file}:${ref}`)) {
          report(
            "scripts/check-docs.mjs",
            1,
            `unused ${String(kind)} exception "${ref}" for ${file}`,
          );
        }
      }
    }
  }
}

const referenceFiles = [
  ...markdownFilesUnder(DOCS_DIR),
  join(ROOT, "README.md"),
  join(ROOT, "CONTRIBUTING.md"),
].filter((file) => existsSync(file));

for (const file of referenceFiles) checkReferencesAndFences(file);

for (const entry of readdirSync(DOCS_DIR).sort()) {
  if (SDD_FILE.test(entry)) checkSddTitle(join(DOCS_DIR, entry));
}

for (const entry of readdirSync(ADR_DIR).sort()) {
  if (ADR_FILE.test(entry)) checkAdrSections(join(ADR_DIR, entry));
}

checkUnusedExceptions();

for (const problem of problems) process.stdout.write(`${problem}\n`);
process.stdout.write(
  problems.length === 0
    ? `docs:check passed (${String(referenceFiles.length)} files scanned)\n`
    : `docs:check found ${String(problems.length)} problem(s)\n`,
);
process.exitCode = problems.length === 0 ? 0 : 1;
