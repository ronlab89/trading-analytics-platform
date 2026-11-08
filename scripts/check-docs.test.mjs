// Fixture-based tests for scripts/check-docs.mjs. Run with: pnpm test:scripts

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";

import { createFenceTracker, main, runChecks } from "./check-docs.mjs";

/** @type {string[]} */
const tempRoots = [];

after(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

const VALID_ADR = [
  "# ADR 0001 — Sample",
  "**Status:** accepted",
  "## Context",
  "## Decision",
  "## Consequences",
  "## Alternatives Considered",
  "## Deferred detail",
  "## Related",
  "",
].join("\n");

/**
 * Builds a fixture repository under the OS temp directory.
 * @param {Record<string, string>} files repository-relative path to content
 */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "check-docs-"));
  tempRoots.push(root);
  mkdirSync(join(root, "docs", "adr"), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

const EMPTY_TABLES = {
  plannedDocs: new Map(),
  allowedPatternRefs: new Map(),
  quotedRefs: new Map(),
};

/**
 * @param {Record<string, string>} files
 * @param {Partial<typeof EMPTY_TABLES>} [tables]
 */
function run(files, tables = {}) {
  return runChecks({ root: fixture(files), ...EMPTY_TABLES, ...tables });
}

describe("createFenceTracker", () => {
  it("opens on a backtick fence and closes on the same marker", () => {
    const tracker = createFenceTracker();
    assert.deepEqual(tracker.update("```js"), {
      inFence: true,
      opened: true,
      closed: false,
      info: "js",
    });
    assert.equal(tracker.update("code").inFence, true);
    assert.deepEqual(tracker.update("```"), {
      inFence: false,
      opened: false,
      closed: true,
      info: "",
    });
    assert.equal(tracker.update("plain").inFence, false);
  });

  it("does not close a tilde fence with backticks", () => {
    const tracker = createFenceTracker();
    tracker.update("~~~");
    assert.equal(tracker.update("```").inFence, true);
    assert.equal(tracker.update("~~~").inFence, false);
  });

  it("does not close with a shorter marker or a marker that carries info", () => {
    const tracker = createFenceTracker();
    tracker.update("````");
    assert.equal(tracker.update("```").inFence, true);
    assert.equal(tracker.update("```` js").inFence, true);
    assert.equal(tracker.update("`````").inFence, false);
  });

  it("ignores indentation of four spaces or more", () => {
    const tracker = createFenceTracker();
    assert.equal(tracker.update("    ```").inFence, false);
    assert.equal(tracker.update("   ```").inFence, true);
  });
});

describe("fences", () => {
  it("reports an unclosed fence on the last line", () => {
    const { problems } = run({ "README.md": "intro\n```js\ncode" });
    assert.deepEqual(problems, ["README.md:3: unclosed code fence"]);
  });

  it("reports extra attributes in the info string", () => {
    const { problems } = run({ "README.md": '```js title="x"\ncode\n```\n' });
    assert.deepEqual(problems, [
      'README.md:1: code fence info string has extra attributes: "js title="x""',
    ]);
  });

  it("accepts a single language token", () => {
    const { problems } = run({ "README.md": "```ts\ncode\n```\n" });
    assert.deepEqual(problems, []);
  });

  it("does not close a tilde block on a backtick fence", () => {
    const { problems } = run({ "README.md": "~~~\n```\ncode\n```\n" });
    assert.deepEqual(problems, ["README.md:5: unclosed code fence"]);
  });

  it("does not close a block on a shorter marker", () => {
    const { problems } = run({ "README.md": "````\ncode\n```\n" });
    assert.deepEqual(problems, ["README.md:4: unclosed code fence"]);
  });

  it("checks references both inside and outside fences", () => {
    const { problems } = run({
      "README.md": "see 12-missing.md\n```\n13-also-missing.md\n```\n",
    });
    assert.deepEqual(problems, [
      'README.md:1: SDD reference "12-missing.md" does not resolve to docs/12-missing.md',
      'README.md:3: SDD reference "13-also-missing.md" does not resolve to docs/13-also-missing.md',
    ]);
  });

  it("ignores heading-like lines inside a fence when looking for the SDD title", () => {
    const { problems } = run({
      "docs/01-intro.md": "```md\n# not the title\n```\n# SDD 01 — Intro\n",
    });
    assert.deepEqual(problems, []);
  });

  it("keeps a tilde block open across backtick lines when looking for the SDD title", () => {
    const { problems } = run({
      "docs/01-intro.md": "~~~\n```\n# hidden\n```\n~~~\n# SDD 01 — Intro\n",
    });
    assert.deepEqual(problems, []);
  });
});

describe("references", () => {
  it("resolves an existing ADR reference", () => {
    const { problems } = run({
      "docs/adr/0001-foo.md": VALID_ADR,
      "README.md": "see 0001-foo.md\n",
    });
    assert.deepEqual(problems, []);
  });

  it("reports an ADR reference that does not exist", () => {
    const { problems } = run({ "README.md": "see 0002-bar.md\n" });
    assert.deepEqual(problems, [
      'README.md:1: ADR reference "0002-bar.md" does not resolve to docs/adr/0002-bar.md',
    ]);
  });

  it("does not read an ADR number as an SDD reference", () => {
    const { problems } = run({
      "docs/adr/0001-foo.md": VALID_ADR,
      "README.md": "see 0001-foo.md\n",
    });
    assert.equal(
      problems.some((p) => p.includes("SDD reference")),
      false,
    );
  });

  it("treats a hyphenated name as a single SDD reference, not an ADR reference", () => {
    const { problems } = run({ "README.md": "see 10-testing-strategy-0001-x.md\n" });
    assert.deepEqual(problems, [
      'README.md:1: SDD reference "10-testing-strategy-0001-x.md" does not resolve to docs/10-testing-strategy-0001-x.md',
    ]);
  });

  it("ignores a number preceded by a hyphen or word character", () => {
    const { problems } = run({ "README.md": "abc-12-foo.md and x12-bar.md\n" });
    assert.deepEqual(problems, []);
  });

  it("reports placeholder references unless allowed", () => {
    const { problems } = run({ "README.md": "see 05-*.md\n" });
    assert.deepEqual(problems, [
      'README.md:1: placeholder SDD reference "05-*.md"; name the document',
    ]);
  });

  it("accepts a planned document reference", () => {
    const { problems } = run(
      { "README.md": "see 20-future.md\n" },
      { plannedDocs: new Map([["20-future.md", "planned"]]) },
    );
    assert.deepEqual(problems, []);
  });
});

describe("exception tables", () => {
  it("accepts used pattern and quoted exceptions without problems", () => {
    const { problems } = run(
      { "README.md": "see 05-*.md\n", "docs/NOTES.md": "old 06-api.md\n" },
      {
        allowedPatternRefs: new Map([["README.md", new Set(["05-*.md"])]]),
        quotedRefs: new Map([["docs/NOTES.md", new Set(["06-api.md"])]]),
      },
    );
    assert.deepEqual(problems, []);
  });

  it("reports an unused pattern exception", () => {
    const { problems } = run(
      { "README.md": "nothing\n" },
      { allowedPatternRefs: new Map([["README.md", new Set(["05-*.md"])]]) },
    );
    assert.deepEqual(problems, [
      'scripts/check-docs.mjs:1: unused pattern exception "05-*.md" for README.md',
    ]);
  });

  it("reports an unused quoted exception", () => {
    const { problems } = run(
      { "README.md": "nothing\n" },
      { quotedRefs: new Map([["README.md", new Set(["06-api.md"])]]) },
    );
    assert.deepEqual(problems, [
      'scripts/check-docs.mjs:1: unused quoted exception "06-api.md" for README.md',
    ]);
  });

  it("reports a planned document whose file now exists", () => {
    const { problems } = run(
      { "docs/20-future.md": "# SDD 20 — Future\n" },
      { plannedDocs: new Map([["20-future.md", "planned"]]) },
    );
    assert.deepEqual(problems, [
      'scripts/check-docs.mjs:1: "20-future.md" now exists; remove it from PLANNED_DOCS',
    ]);
  });
});

describe("SDD titles", () => {
  it("reports a title that names another number", () => {
    const { problems } = run({ "docs/01-intro.md": "# SDD 02 — Intro\n" });
    assert.deepEqual(problems, ["docs/01-intro.md:1: first heading names SDD 02, expected 01"]);
  });

  it("reports a missing heading", () => {
    const { problems } = run({ "docs/01-intro.md": "just text\n" });
    assert.deepEqual(problems, ['docs/01-intro.md:1: missing first heading "# SDD 01 — <Title>"']);
  });

  it("reports a heading that does not match the format", () => {
    const { problems } = run({ "docs/01-intro.md": "\n# Intro\n" });
    assert.deepEqual(problems, [
      'docs/01-intro.md:2: first heading must be "# SDD 01 — <Title>", found "# Intro"',
    ]);
  });

  it("accepts a correct title", () => {
    const { problems, filesScanned } = run({ "docs/01-intro.md": "# SDD 01 — Intro\n" });
    assert.deepEqual(problems, []);
    assert.equal(filesScanned, 1);
  });
});

describe("ADR sections", () => {
  it("reports every missing section by its visible name", () => {
    const { problems } = run({ "docs/adr/0001-foo.md": "# ADR\n## Context\n" });
    assert.deepEqual(problems, [
      'docs/adr/0001-foo.md:1: ADR is missing required section "**Status:**"',
      'docs/adr/0001-foo.md:1: ADR is missing required section "## Decision"',
      'docs/adr/0001-foo.md:1: ADR is missing required section "## Consequences"',
      'docs/adr/0001-foo.md:1: ADR is missing required section "## Alternatives Considered"',
      'docs/adr/0001-foo.md:1: ADR is missing required section "## Deferred detail"',
      'docs/adr/0001-foo.md:1: ADR is missing required section "## Related"',
    ]);
  });

  it("accepts a complete ADR", () => {
    const { problems } = run({ "docs/adr/0001-foo.md": VALID_ADR });
    assert.deepEqual(problems, []);
  });
});

describe("main", () => {
  /**
   * @param {Record<string, string>} files
   */
  function runMain(files) {
    /** @type {string[]} */
    const output = [];
    const code = main(fixture(files), {
      ...EMPTY_TABLES,
      write: (/** @type {string} */ text) => {
        output.push(text);
      },
    });
    return { code, output };
  }

  it("returns 0 and the passed summary on a clean fixture", () => {
    const { code, output } = runMain({ "README.md": "hello\n" });
    assert.equal(code, 0);
    assert.deepEqual(output, ["docs:check passed (1 files scanned)\n"]);
  });

  it("returns 1 with problem lines and the found summary", () => {
    const { code, output } = runMain({ "README.md": "see 12-missing.md\n" });
    assert.equal(code, 1);
    assert.deepEqual(output, [
      'README.md:1: SDD reference "12-missing.md" does not resolve to docs/12-missing.md\n',
      "docs:check found 1 problem(s)\n",
    ]);
  });
});
