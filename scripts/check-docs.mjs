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
//
// The checks are exposed as runChecks() and main() so tests can run them against
// fixture directories; the CLI only runs when this file is executed directly.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// Documents decided but not written yet. Remove an entry once its file exists.
/** @type {Map<string, string>} */
const PLANNED_DOCS = new Map();

// Wildcard references that intentionally describe a range of documents.
/** @type {Map<string, Set<string>>} */
const ALLOWED_PATTERN_REFS = new Map([["CONTRIBUTING.md", new Set(["00-*.md", "15-*.md"])]]);

// Stale names quoted on purpose (for example, as examples of past drift).
// Remove an entry once the quoting text is rewritten.
/** @type {Map<string, Set<string>>} */
const QUOTED_REFS = new Map([
  [
    "docs/BACKEND-ROADMAP.md",
    new Set(["05-architecture.md", "06-api-spec.md", "06-data-model.md"]),
  ],
]);

const ADR_REQUIRED_SECTIONS = [
  { name: "**Status:**", pattern: /^\*\*Status:\*\*/ },
  { name: "## Context", pattern: /^## Context\s*$/ },
  { name: "## Decision", pattern: /^## Decision\s*$/ },
  { name: "## Consequences", pattern: /^## Consequences\s*$/ },
  { name: "## Alternatives Considered", pattern: /^## Alternatives Considered\s*$/ },
  { name: "## Deferred detail", pattern: /^## Deferred detail\s*$/ },
  { name: "## Related", pattern: /^## Related\s*$/ },
];

const SDD_REF = /(?<![\w-])(\d{2}-[A-Za-z0-9*_-]+\.md)/g;
const ADR_REF = /(?<![\w-])(\d{4}-[A-Za-z0-9*_-]+\.md)/g;
const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const SDD_FILE = /^(\d{2})-[a-z0-9-]+\.md$/;
const ADR_FILE = /^\d{4}-[a-z0-9-]+\.md$/;
const SDD_TITLE = /^# SDD (\d{2}) — \S.*$/;

/**
 * Tracks fenced code blocks line by line. A fence opens with up to 3 spaces of
 * indentation and 3+ backticks or tildes. It closes only with the same marker
 * character, a length at least that of the opener, and no info string.
 * `inFence` is the state after the line was processed.
 */
export function createFenceTracker() {
  /** @type {string | null} */
  let openFence = null;
  return {
    /**
     * @param {string} line
     * @returns {{ inFence: boolean, opened: boolean, closed: boolean, info: string }}
     */
    update(line) {
      const fence = FENCE_OPEN.exec(line);
      const marker = fence?.[1] ?? "";
      const info = (fence?.[2] ?? "").trim();
      let opened = false;
      let closed = false;
      if (fence) {
        if (openFence === null) {
          openFence = marker;
          opened = true;
        } else if (marker[0] === openFence[0] && marker.length >= openFence.length && info === "") {
          openFence = null;
          closed = true;
        }
      }
      return { inFence: openFence !== null, opened, closed, info: fence ? info : "" };
    },
  };
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
 * @typedef {object} CheckOptions
 * @property {string} [root]
 * @property {Map<string, string>} [plannedDocs]
 * @property {Map<string, Set<string>>} [allowedPatternRefs]
 * @property {Map<string, Set<string>>} [quotedRefs]
 */

/**
 * Runs every check against the repository at `root`. Holds no module-level state.
 * @param {CheckOptions} [options]
 * @returns {{ problems: string[], filesScanned: number }}
 */
export function runChecks({
  root = process.cwd(),
  plannedDocs = PLANNED_DOCS,
  allowedPatternRefs = ALLOWED_PATTERN_REFS,
  quotedRefs = QUOTED_REFS,
} = {}) {
  const docsDir = join(root, "docs");
  const adrDir = join(docsDir, "adr");
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
    return relative(root, absolute).split(sep).join("/");
  }

  /**
   * @param {string} file
   * @param {string} ref
   */
  function isAllowedPattern(file, ref) {
    if (allowedPatternRefs.get(file)?.has(ref)) {
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
    if (quotedRefs.get(file)?.has(ref)) {
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
    if (kind === "SDD" && plannedDocs.has(ref)) return;
    if (isQuoted(file, ref)) return;
    report(file, lineNo, `${kind} reference "${ref}" does not resolve to ${rel(dir)}/${ref}`);
  }

  /** @param {string} absolute */
  function checkReferencesAndFences(absolute) {
    const file = rel(absolute);
    const lines = readLines(absolute);
    const fences = createFenceTracker();

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      for (const match of line.matchAll(SDD_REF)) {
        checkRef(file, lineNo, match[1] ?? "", docsDir, "SDD");
      }
      for (const match of line.matchAll(ADR_REF)) {
        checkRef(file, lineNo, match[1] ?? "", adrDir, "ADR");
      }

      const fence = fences.update(line);
      if (fence.opened && /\s/.test(fence.info)) {
        report(file, lineNo, `code fence info string has extra attributes: "${fence.info}"`);
      }
    });

    if (fences.update("").inFence) report(file, lines.length, "unclosed code fence");
  }

  /** @param {string} absolute */
  function checkSddTitle(absolute) {
    const file = rel(absolute);
    const number = SDD_FILE.exec(absolute.split(sep).pop() ?? "")?.[1];
    if (number === undefined) return;
    const fences = createFenceTracker();
    for (const [index, line] of readLines(absolute).entries()) {
      if (fences.update(line).inFence || !/^#{1,6}\s/.test(line)) continue;
      const title = SDD_TITLE.exec(line);
      if (!title) {
        report(
          file,
          index + 1,
          `first heading must be "# SDD ${number} — <Title>", found "${line}"`,
        );
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
    for (const { name, pattern } of ADR_REQUIRED_SECTIONS) {
      if (!lines.some((line) => pattern.test(line))) {
        report(file, 1, `ADR is missing required section "${name}"`);
      }
    }
  }

  function checkUnusedExceptions() {
    for (const ref of plannedDocs.keys()) {
      if (existsSync(join(docsDir, ref))) {
        report("scripts/check-docs.mjs", 1, `"${ref}" now exists; remove it from PLANNED_DOCS`);
      }
    }
    for (const [kind, map] of /** @type {const} */ ([
      ["pattern", allowedPatternRefs],
      ["quoted", quotedRefs],
    ])) {
      for (const [file, refs] of map) {
        for (const ref of refs) {
          if (!usedAllowEntries.has(`${kind}:${file}:${ref}`)) {
            report("scripts/check-docs.mjs", 1, `unused ${kind} exception "${ref}" for ${file}`);
          }
        }
      }
    }
  }

  const referenceFiles = [
    ...markdownFilesUnder(docsDir),
    join(root, "README.md"),
    join(root, "CONTRIBUTING.md"),
  ].filter((file) => existsSync(file));

  for (const file of referenceFiles) checkReferencesAndFences(file);

  for (const entry of readdirSync(docsDir).sort()) {
    if (SDD_FILE.test(entry)) checkSddTitle(join(docsDir, entry));
  }

  for (const entry of readdirSync(adrDir).sort()) {
    if (ADR_FILE.test(entry)) checkAdrSections(join(adrDir, entry));
  }

  checkUnusedExceptions();

  return { problems, filesScanned: referenceFiles.length };
}

/**
 * Runs the checks, writes the report and returns the exit code (0 or 1).
 * @param {string} [root]
 * @param {CheckOptions & { write?: (text: string) => void }} [options]
 */
export function main(root = process.cwd(), options = {}) {
  const { write = (text) => process.stdout.write(text), ...tables } = options;
  const { problems, filesScanned } = runChecks({ ...tables, root });
  for (const problem of problems) write(`${problem}\n`);
  write(
    problems.length === 0
      ? `docs:check passed (${String(filesScanned)} files scanned)\n`
      : `docs:check found ${String(problems.length)} problem(s)\n`,
  );
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
