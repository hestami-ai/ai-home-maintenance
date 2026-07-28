import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "preview";
const closureTime = process.argv[3] ?? "PREVIEW";
if (!["preview", "apply", "validate"].includes(mode)) {
  throw new Error(`Unsupported mode: ${mode}`);
}
function validIsoTimestamp(value) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && !Number.isNaN(Date.parse(value))
  );
}
if (mode !== "validate" && !validIsoTimestamp(closureTime)) {
  throw new Error(`${mode} mode requires a valid ISO-8601 closure time: ${closureTime}`);
}

const recordsDir = path.dirname(fileURLToPath(import.meta.url));
const archiveDir = path.join(recordsDir, "archive");
const utf8 = new TextEncoder();

const specifications = {
  "001": {
    file: "JAN-CSAA-001 - Requirement Ledger.md",
    sourceBytes: 352801,
    sourceSha: "55a476a2683ec65baa898b4b9425aecd3b6af17cd3c09aa2b8b59b3942e42e1a",
    archive: "JAN-CSAA-001-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot",
    mainFile: path.join(recordsDir, "..", "JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md"),
    mainBytes: 109420,
    mainSha: "cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b",
  },
  "002": {
    file: "JAN-CSAA-002 - Requirement Ledger.md",
    sourceBytes: 250049,
    sourceSha: "dd2a08970c927ddb26ef522c7fc405f7210da13e35e32405486da26009a52acc",
    archive: "JAN-CSAA-002-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot",
    mainFile: path.join(recordsDir, "..", "JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md"),
    mainBytes: 162179,
    mainSha: "9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911",
  },
  "005": {
    file: "JAN-CSAA-005 - Requirement Ledger.md",
    sourceBytes: 459849,
    sourceSha: "86940e63fc011ae58a460bb4f403d79763e8e8722edd5bfeeb75c6cb6597d3b4",
    archive: "JAN-CSAA-005-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot",
    mainFile: path.join(recordsDir, "..", "JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md"),
    mainBytes: 119118,
    mainSha: "3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625",
  },
};

const evidence007 =
  "[EVIDENCE-007](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>)";
const evidence008 =
  "[EVIDENCE-008](<JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md>)";
const reconciliation002 =
  "[successor cross-package reconciliation](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>)";
const closureIntegrityId = "`JAN-CSAA-W1-LEDGER-CLOSURE-INTEGRITY-001@0.1.0`";
const closureRecordName =
  "JAN-CSAA-W1 - Synchronized Ledger Closure and Integrity Record.md";

const evidenceSpecifications = [
  [
    "JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md",
    6952,
    "d2cba1614aea77a720cac597ed9f6faeda266a854022b6f3c1fa956dae869532",
  ],
  [
    "JAN-CSAA - External Repository Drift Non-Blocking Authoring Direction.md",
    5153,
    "3760646744063eae3f678b84961e4d0e3778ec0fabd2e7b45765cb7530df5aae",
  ],
  [
    "JAN-CSAA-005 - Current Subject Rebinding Record 004.md",
    11582,
    "63b1e06287dcaf993bffecc20164227567c5248a8616650f3a5cc5e2538f95a7",
  ],
  [
    "JAN-CSAA-005 - Current Subject Rebinding Record 003.md",
    11664,
    "87d4b8a45c1346175efaa5a64f52002d44ce0478943b12764b2dd70f9997eee8",
  ],
  [
    "JAN-CSAA-005 - Current Subject Rebinding Record 002.md",
    9327,
    "0de68cafa8ceaae5c9f5919b6edf92707a8a0007303d795c0079d1afe8dcd33d",
  ],
  [
    "JAN-CSAA-005 - Current Subject Rebinding Record.md",
    5735,
    "534ddd0cd3146fdf7b4b7e823a84b0a3b7409c0f04efadf1a1d156a54e59ecd1",
  ],
  [
    "JAN-CSAA-001 - Objective Author Verification Record.md",
    8499,
    "3ea9ca194b0902ad693b4f6d157443db50c195aa291fcdf39ee2552c4c948a09",
  ],
  [
    "JAN-CSAA-002 - Objective Author Verification Record.md",
    7241,
    "95f67f64bd9e390fc936a076c07273c2ed869d3b8c396ca9d3cb7a777fa1d0fa",
  ],
  [
    "JAN-CSAA-005 - Objective Author Verification Record.md",
    8028,
    "85a0e47a2185e46cbd18ec5b04bd2420a5acad8b6f11e5eff96eb0dc9461bfa7",
  ],
  [
    "JAN-CSAA-001 - Objective Author Verification Record 002.md",
    9298,
    "934bafa753153a7f2528f5bee97f535954918eb9a72342c0405fc3282e785d88",
  ],
  [
    "JAN-CSAA-002 - Objective Author Verification Record 002.md",
    9082,
    "1f8971db167df9a1ac22d667a0f7f990c9397657af2d68033a7f2e9664e59aab",
  ],
  [
    "JAN-CSAA-005 - Objective Author Verification Record 002.md",
    9547,
    "1d9d084b46c555b82c3dfc3aa4b076d34ae230072f9bc066d1f031ba5686e8d9",
  ],
  [
    "JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record.md",
    8112,
    "7b3693f539e54432d49da162f031feafcf5df7ea7b3e3b714b79b7b95394e49e",
  ],
  [
    "JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md",
    10321,
    "1a7f970353db9dd70faf23c1de05193b348459458b6438303e82250692fc2515",
  ],
];

function sha(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactFileIdentity(file, bytes, digest, label) {
  const value = fs.readFileSync(file);
  assert(value.length === bytes, `${label} byte mismatch: ${value.length} != ${bytes}`);
  assert(sha(value) === digest, `${label} SHA-256 mismatch: ${sha(value)} != ${digest}`);
  return value;
}

function normalizeInput(bytes, label) {
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${label} has BOM`);
  const text = bytes.toString("utf8");
  assert(Buffer.from(text, "utf8").equals(bytes), `${label} is not valid round-trip UTF-8`);
  assert(!/(?<!\r)\n/.test(text), `${label} has LF without CR`);
  assert(!/\r(?!\n)/.test(text), `${label} has CR without LF`);
  assert(text.endsWith("\r\n") && !text.endsWith("\r\n\r\n"), `${label} terminal CRLF mismatch`);
  return text.slice(0, -2).split("\r\n");
}

function encodeLines(lines) {
  return Buffer.from(`${lines.join("\r\n")}\r\n`, "utf8");
}

function parseRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return null;
  const body = line.slice(1, -1);
  const cells = [];
  let current = "";
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "|" && body[i - 1] !== "\\") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function joinRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function findUnique(lines, predicate, label) {
  const matches = [];
  lines.forEach((line, index) => {
    if (predicate(line, index)) matches.push(index);
  });
  assert(matches.length === 1, `${label}: expected one match, found ${matches.length}`);
  return matches[0];
}

function heading(lines, prefix) {
  return findUnique(lines, (line) => line.startsWith(prefix), `heading ${prefix}`);
}

function replacePrefix(lines, prefix, replacement) {
  const index = findUnique(lines, (line) => line.startsWith(prefix), `prefix ${prefix}`);
  lines[index] = replacement;
}

function setMetadataField(lines, field, value) {
  const start = heading(lines, "## 1.");
  const end = heading(lines, "## 2.");
  const index = findUnique(
    lines,
    (line, i) => {
      if (i <= start || i >= end) return false;
      const cells = parseRow(line);
      return cells?.[0] === field;
    },
    `metadata field ${field}`,
  );
  lines[index] = joinRow([field, value]);
}

function insertMetadataAfter(lines, field, newRows) {
  const start = heading(lines, "## 1.");
  const end = heading(lines, "## 2.");
  const index = findUnique(
    lines,
    (line, i) => {
      if (i <= start || i >= end) return false;
      const cells = parseRow(line);
      return cells?.[0] === field;
    },
    `metadata insertion field ${field}`,
  );
  lines.splice(index + 1, 0, ...newRows.map(([name, value]) => joinRow([name, value])));
}

function editUniqueRow(lines, id, editor) {
  const marker = `\`${id}\``;
  const index = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === marker,
    `row ${id}`,
  );
  const cells = parseRow(lines[index]);
  editor(cells);
  lines[index] = joinRow(cells);
}

function setMeasure(lines, name, value, nextName = name) {
  const index = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === name,
    `measure ${name}`,
  );
  const cells = parseRow(lines[index]);
  assert(cells.length === 2, `measure ${name} has ${cells.length} cells`);
  lines[index] = joinRow([nextName, value]);
}

function appendOnce(value, addition) {
  return value.includes(addition) ? value : `${value}; ${addition}`;
}

function setCombinedVerificationState(value, state) {
  assert(/ \/ `[^`]+`$/.test(value), `combined verification cell has unexpected form: ${value}`);
  return value.replace(/ \/ `[^`]+`$/, ` / \`${state}\``);
}

function transform001(sourceLines) {
  const lines = [...sourceLines];
  replacePrefix(lines, "**Ledger ID:**", "**Ledger ID:** `JAN-CSAA-001-LEDGER-001@0.3.1`");
  replacePrefix(
    lines,
    "**Status:**",
    "**Status:** Closed for the named JAN-CSAA-001 Draft objective-verification commission; non-authoritative evidence record",
  );
  replacePrefix(
    lines,
    "**Purpose:**",
    "**Purpose:** Preserve one row for every atomic `JAN-CSAA-001` requirement and every applicable inherited obligation while recording completed author-side objective closure and keeping author self-review, post-Proposed independent adversarial review, post-Proposed integrity/provenance validation, final decision authority, ministerial recording, and later implementation separate and unperformed.",
  );
  setMetadataField(lines, "Ledger ID", "`JAN-CSAA-001-LEDGER-001@0.3.1`");
  setMetadataField(
    lines,
    "Parent commit",
    "`49b69fb7b78efa180fa19f3f2f24b8de749c3857`, dated OBS-035/036 authoring baseline; live refresh deferred under EVIDENCE-008",
  );
  setMetadataField(
    lines,
    "Worktree/change-set identity",
    "Dated implementation/configuration authoring baseline recorded by `JAN-CSAA-005-EVIDENCE-007@0.1.0`: 19-path perimeter; two tracked unstaged paths; exact status, content, normalized default-index unstaged diff, empty staged diff, tracked-manifest, generated-context, committed-tree, mutation-journal, and Bun-quiescence identities during OBS-035/036. EVIDENCE-008 expressly prevents representing that snapshot as continuously live-current and requires consolidated refresh before final freeze. Final 001 bytes remain unfrozen Draft bytes; this ledger records only objective closure.",
  );
  setMetadataField(
    lines,
    "Last refresh time",
    "Dated OBS-036 completion `2026-07-28T19:20:40.359Z`; the closure-integrity record rechecks exact documentation-directory preimages only under EVIDENCE-008",
  );
  setMetadataField(
    lines,
    "Current subject evidence",
    `${evidence008}; dated ${evidence007}; historical [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>) and all prior 005 evidence remain preserved`,
  );
  insertMetadataAfter(lines, "Current subject evidence", [
    [
      "Objective verification evidence",
      "Historical [VERIFICATION-001](<JAN-CSAA-001 - Objective Author Verification Record.md>) — 8,499 bytes / `3ea9ca194b0902ad693b4f6d157443db50c195aa291fcdf39ee2552c4c948a09`; current [VERIFICATION-002](<JAN-CSAA-001 - Objective Author Verification Record 002.md>) — 9,298 bytes / `934bafa753153a7f2528f5bee97f535954918eb9a72342c0405fc3282e785d88`; [reconciliation 002](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>) — 10,321 bytes / `1a7f970353db9dd70faf23c1de05193b348459458b6438303e82250692fc2515`",
    ],
    ["Closure time", `\`${closureTime}\``],
    ["Post-transition integrity evidence", closureIntegrityId],
  ]);
  setMetadataField(
    lines,
    "Author self-review",
    "Not complete; unlocked as the next separately recorded activity by this ledger closure",
  );
  setMetadataField(lines, "Ledger state", "`CLOSED_FOR_NAMED_COMMISSION`");
  setMetadataField(
    lines,
    "Supersedes",
    "`JAN-CSAA-001-LEDGER-001@0.3.0 / Open`, 352,801 bytes, SHA-256 `55a476a2683ec65baa898b4b9425aecd3b6af17cd3c09aa2b8b59b3942e42e1a`, preserved at `archive/JAN-CSAA-001-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot`",
  );

  replacePrefix(
    lines,
    "Reconciliation: **558 obligations",
    "Reconciliation: **558 obligations = 558 unique ledger rows; difference = 0**. The inherited intake records the architecture, document-control, historical Wave 1 boundary, standing documentation commission, five-role assurance model, adversarial-review, integrity-validation, and later-allocation surfaces identified during authoring. Complete author-side objective and applicability verification passed under VERIFICATION-001 and successor VERIFICATION-002; excluded charter ranges remain concern-routed in §4.3 rather than silently treated as verified omissions.",
  );
  replacePrefix(
    lines,
    "`PLANNED` means",
    "`IMPLEMENTED` means that the exact non-authoritative Draft contains the documentation obligation at its bound substantive site; `PASSED` means the current author-side objective method reproduced that documentation result against the exact recorded subject. Neither state claims an executable provider, contract, test, implementation, later-owner artifact, independent assurance result, Proposed status, or authority. Seventy-six noncurrent rows remain `NOT_REQUIRED_CURRENT_PHASE`.",
  );
  replacePrefix(
    lines,
    "Each row preserves one exact stable source row",
    "Each row preserves one exact stable source row from the closed 000 refresh ledger. VERIFICATION-001 and successor VERIFICATION-002 passed 001's applicable downstream carriage and audited every noncurrent allocation without performing the allocated future activity.",
  );

  const start = heading(lines, "## 3.");
  const end = heading(lines, "## 5.");
  let applicable = 0;
  let noncurrent = 0;
  const ids = new Set();
  for (let index = start + 1; index < end; index += 1) {
    const cells = parseRow(lines[index]);
    if (!cells || !/^`(?:CSAA-001-|CSAA-000-REQ-)/.test(cells[0])) continue;
    assert([8, 9, 12].includes(cells.length), `001 row ${cells[0]} has ${cells.length} cells`);
    assert(!ids.has(cells[0]), `duplicate 001 row ${cells[0]}`);
    ids.add(cells[0]);
    const isApplicable = cells[3].startsWith("`APPLICABLE_NOW`");
    const implementationIndex = cells.length === 8 ? 5 : 6;
    const verificationIndex = cells.length === 12 ? 8 : cells.length === 9 ? 7 : 6;
    const evidenceIndex = cells.length === 12 ? 10 : cells.length === 9 ? 8 : 7;
    if (isApplicable) {
      applicable += 1;
      cells[implementationIndex] = "`IMPLEMENTED`";
      cells[verificationIndex] = setCombinedVerificationState(cells[verificationIndex], "PASSED");
      cells[evidenceIndex] = appendOnce(
        cells[evidenceIndex],
        "[successor objective verification](<JAN-CSAA-001 - Objective Author Verification Record 002.md>)",
      );
      if (cells.length === 12) {
        cells[9] =
          "Author/ledger closer; objective verification passed under VERIFICATION-001 and VERIFICATION-002; later independent assurance not performed";
        cells[11] = cells[11]
          .replace(
            "Candidate text mapping only; performance and verification unclaimed",
            "Documentation obligation implemented and author-side objective verification passed; no executable implementation, independent assurance, Proposed readiness, or authority is inferred",
          )
          .replace(
            "performance and verification unclaimed",
            "author-side objective verification passed; allocated later activity remains unclaimed",
          );
      } else {
        cells[evidenceIndex] = cells[evidenceIndex]
          .replace(
            "downstream verification unclaimed",
            "author-side documentation carriage passed; allocated downstream work remains unclaimed",
          )
          .replace(
            "no independent review performed",
            "author-side objective verification passed; no independent review performed",
          );
      }
    } else {
      noncurrent += 1;
      assert(
        cells[implementationIndex] === "`NOT_REQUIRED_CURRENT_PHASE`",
        `001 noncurrent ${cells[0]} implementation changed unexpectedly`,
      );
      cells[verificationIndex] = setCombinedVerificationState(
        cells[verificationIndex],
        "NOT_REQUIRED_CURRENT_PHASE",
      );
    }
    lines[index] = joinRow(cells);
  }
  assert(ids.size === 558 && applicable === 482 && noncurrent === 76, "001 row population mismatch");

  replacePrefix(
    lines,
    "Implementation and verification are independent.",
    "Implementation and verification are independent. All 482 applicable-now documentation rows are `IMPLEMENTED / PASSED`; all 76 post-ledger-self-review, later-lifecycle, later-execution, superseded, deferred, successor-controlled, or not-applicable rows remain `NOT_REQUIRED_CURRENT_PHASE`. An allocation identifies an owner and gate but creates no artifact, authority, or performance. Allocation to an active documentation subphase does not authorize its executable counterpart.",
  );

  editUniqueRow(lines, "JAN-CSAA-001-LEDGER-GAP-001", (cells) => {
    cells[2] =
      "The corrected concern-aware inherited intake received complete objective verification and successor freshness revalidation";
    cells[3] =
      "Preserve source ownership and the exact verified population; any later source or candidate change triggers affected revalidation";
    cells[4] =
      "VERIFICATION-001; VERIFICATION-002; exact unchanged governing-source identities";
    cells[5] = "None for ledger closure; later lifecycle remains separately allocated";
    cells[6] = "`CLOSED_BY_OBJECTIVE_VERIFICATION`";
  });
  editUniqueRow(lines, "JAN-CSAA-001-LEDGER-GAP-002", (cells) => {
    cells[2] =
      "All 558 rows received objective reconciliation: 482 applicable rows implemented/passed and 76 noncurrent rows preserved without performance";
    cells[3] =
      "Keep author self-review and all later assurance as explicit non-passes; close only the named objective commission";
    cells[4] =
      "VERIFICATION-001; VERIFICATION-002; reconciliation 002; synchronized closure integrity record";
    cells[5] =
      "None for ledger closure; separately recorded author self-review remains a Proposed-promotion predicate";
    cells[6] = "`CLOSED_BY_SYNCHRONIZED_LEDGER_CLOSURE`";
  });
  editUniqueRow(lines, "JAN-CSAA-001-LEDGER-GAP-007", (cells) => {
    cells[2] =
      "Historical subjects and EVIDENCE-004/005/006 remain preserved; OBS-035/036 supplies the dated implementation/configuration authoring baseline, while EVIDENCE-008 makes later external drift nonblocking only for documentation-ledger closure";
    cells[3] =
      "Use EVIDENCE-007 only as dated snapshot evidence; use EVIDENCE-008 for intermediate documentation closure and perform consolidated implementation refresh before exact candidate freeze";
    cells[4] =
      "[Current subject rebinding 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>); historical [rebinding 003](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), [rebinding 002](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), and preparation evidence";
    cells[5] =
      "No blocker for documentation-ledger closure under STANDING-DIRECTION-003; final implementation refresh and Proposed-transition freeze remain open";
    cells[6] = "`NONBLOCKING_FOR_DOCUMENT_CLOSURE — FINAL_REFRESH_REQUIRED`";
  });

  const currentMethods = [
    "JAN-CSAA-001-VER-CTL-001",
    "JAN-CSAA-001-VER-ARC-001",
    "JAN-CSAA-001-VER-FLW-001",
    "JAN-CSAA-001-VER-TRU-001",
    "JAN-CSAA-001-VER-DEG-001",
    "JAN-CSAA-001-VER-OBS-001",
    "JAN-CSAA-001-VER-QUA-001",
    "JAN-CSAA-001-VER-ALT-001",
    "JAN-CSAA-001-VER-ACC-001",
    "JAN-CSAA-001-VER-INH-000",
    "JAN-CSAA-001-VER-INH-CON",
    "JAN-CSAA-001-VER-INH-DOC001",
    "JAN-CSAA-001-VER-INH-DOC002",
    "JAN-CSAA-001-VER-INH-DOC003",
    "JAN-CSAA-001-VER-INH-DOC004",
    "JAN-CSAA-001-VER-INH-REG",
  ];
  for (const id of currentMethods) {
    editUniqueRow(lines, id, (cells) => {
      assert(cells.length === 8, `${id} method schema mismatch`);
      cells[2] = cells[2].replace("; not yet performed", "; performed and recorded");
      cells[3] = appendOnce(
        cells[3],
        "`JAN-CSAA-005-EVIDENCE-007@0.1.0` dated snapshot plus `JAN-CSAA-005-EVIDENCE-008@0.1.0` authoring-baseline control",
      );
      cells[5] = appendOnce(
        cells[5],
        "result evidence VERIFICATION-001 and successor VERIFICATION-002",
      );
      cells[7] = "`PASSED`";
    });
  }
  replacePrefix(
    lines,
    "No state other than `PASSED` means passed.",
    "No state other than `PASSED` means passed. All sixteen current-phase author/ledger-closer objective methods executed and passed against the exact recorded bytes and successor freshness evidence. Author self-review, independent adversarial review, and independent integrity/provenance validation have not executed. The two post-Proposed methods are not Draft ledger-closure prerequisites.",
  );

  setMeasure(lines, "Implemented", "482");
  setMeasure(lines, "Planned", "0");
  setMeasure(lines, "Not started", "0");
  setMeasure(lines, "Not required current phase", "76");
  setMeasure(lines, "Verification `NOT_RUN`", "0");
  setMeasure(lines, "Verification `NOT_REQUIRED_CURRENT_PHASE`", "76");
  setMeasure(lines, "Verification `PASSED`", "482");
  setMeasure(lines, "Applicable-now implemented", "482");
  setMeasure(lines, "Applicable-now not implemented", "0");
  setMeasure(lines, "Applicable-now verification passed", "482");
  setMeasure(lines, "Applicable-now verification not passed", "0");
  setMeasure(lines, "Open gaps", "2");
  setMeasure(lines, "Closed authoring defects", "5", "Closed or current-phase-resolved gaps");
  const resolvedGapIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Current-subject-resolved gaps",
    "001 resolved-gap measure",
  );
  lines.splice(
    resolvedGapIndex + 1,
    0,
    joinRow(["Current verification methods passed", "16"]),
    joinRow(["Future/noncurrent verification methods not passed", "3"]),
  );
  replacePrefix(
    lines,
    "Implementation-state arithmetic:",
    "Implementation-state arithmetic: **558 = 482 implemented + 0 planned + 0 not started + 76 not required current phase**. Verification-state arithmetic: **558 = 482 passed + 0 not run + 76 not required current phase**. All 482 applicable-now documentation obligations passed author-side objective verification; all 76 noncurrent obligations remain explicit non-passes for their allocated activity. No author self-review, formal independent review, Proposed readiness, full executable wave exit, or authority is claimed.",
  );
  replacePrefix(lines, "**Ledger status:**", "**Ledger status:** `CLOSED_FOR_NAMED_COMMISSION`.");
  replacePrefix(
    lines,
    "**Author self-review:**",
    "**Author self-review:** Open — activated by ledger closure; not yet performed.",
  );
  const authorIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Author / ledger closer",
    "001 author sign-off",
  );
  lines[authorIndex] = joinRow([
    "Author / ledger closer",
    "Current Draft objective closure",
    "Codex documentation author/integrator and objective-verification streams",
    "`PASS — OBJECTIVE VERIFICATION COMPLETE; CLOSED_FOR_NAMED_COMMISSION`",
    `\`${closureTime}\``,
    "Exact 0.3.0 OPEN preimage; VERIFICATION-001; VERIFICATION-002; EVIDENCE-007; reconciliation 002; post-transition closure integrity record",
  ]);
  const selfIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Author self-reviewer",
    "001 self sign-off",
  );
  const selfCells = parseRow(lines[selfIndex]);
  selfCells[3] =
    "`OPEN — ACTIVATED BY LEDGER CLOSURE; NOT YET PERFORMED`; allocated through `JAN-CSAA-001-VER-SELF-001`";
  lines[selfIndex] = joinRow(selfCells);

  return lines;
}

function transform002(sourceLines) {
  const lines = [...sourceLines];
  replacePrefix(lines, "**Ledger ID:**", "**Ledger ID:** `JAN-CSAA-002-LEDGER-001@0.3.1`");
  replacePrefix(
    lines,
    "**Status:**",
    "**Status:** Closed for the named JAN-CSAA-002 Draft objective-verification commission; non-authoritative evidence record",
  );
  replacePrefix(
    lines,
    "**Purpose:**",
    "**Purpose:** Preserve an atomic, source-exact, bidirectionally mappable row for every local and inherited requirement applicable to the current Draft while recording completed author-side objective closure and keeping author self-review, post-Proposed independent adversarial review, post-Proposed integrity/provenance validation, final decision authority, ministerial recording, and later implementation separate and unperformed.",
  );
  setMetadataField(lines, "Ledger ID", "`JAN-CSAA-002-LEDGER-001@0.3.1`");
  setMetadataField(
    lines,
    "Parent commit",
    "`49b69fb7b78efa180fa19f3f2f24b8de749c3857`, dated OBS-035/036 authoring baseline; live refresh deferred under EVIDENCE-008",
  );
  setMetadataField(
    lines,
    "Worktree/change-set identity",
    "Dated implementation/configuration authoring baseline recorded by `JAN-CSAA-005-EVIDENCE-007@0.1.0`: 19-path perimeter; two tracked unstaged paths; exact status, content, normalized default-index unstaged diff, empty staged diff, tracked-manifest, generated-context, committed-tree, mutation-journal, and Bun-quiescence identities during OBS-035/036. EVIDENCE-008 expressly prevents representing that snapshot as continuously live-current and requires consolidated refresh before final freeze. Final 002 bytes remain unfrozen Draft bytes; this ledger records only objective closure.",
  );
  setMetadataField(
    lines,
    "Defect-resolution refresh",
    "2026-07-26 correction preserved; independent-predicate atomicity, 17-facet profile completeness, and inherited intake were objectively verified under VERIFICATION-001 and successor VERIFICATION-002.",
  );
  setMetadataField(
    lines,
    "Last refresh time",
    "Dated OBS-036 completion `2026-07-28T19:20:40.359Z`; the closure-integrity record rechecks exact documentation-directory preimages only under EVIDENCE-008",
  );
  setMetadataField(
    lines,
    "Current subject evidence",
    `${evidence008}; dated ${evidence007}; historical [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>) and all prior 005 evidence remain preserved`,
  );
  insertMetadataAfter(lines, "Current subject evidence", [
    [
      "Objective verification evidence",
      "Historical [VERIFICATION-001](<JAN-CSAA-002 - Objective Author Verification Record.md>) — 7,241 bytes / `95f67f64bd9e390fc936a076c07273c2ed869d3b8c396ca9d3cb7a777fa1d0fa`; current [VERIFICATION-002](<JAN-CSAA-002 - Objective Author Verification Record 002.md>) — 9,082 bytes / `1f8971db167df9a1ac22d667a0f7f990c9397657af2d68033a7f2e9664e59aab`; [reconciliation 002](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>) — 10,321 bytes / `1a7f970353db9dd70faf23c1de05193b348459458b6438303e82250692fc2515`",
    ],
    ["Closure time", `\`${closureTime}\``],
    ["Post-transition integrity evidence", closureIntegrityId],
  ]);
  setMetadataField(
    lines,
    "Author self-review",
    "Not complete; unlocked as the next separately recorded activity by this ledger closure",
  );
  setMetadataField(lines, "Ledger state", "`CLOSED_FOR_NAMED_COMMISSION`");
  setMetadataField(
    lines,
    "Supersedes",
    "`JAN-CSAA-002-LEDGER-001@0.3.0 / Open`, 250,049 bytes, SHA-256 `dd2a08970c927ddb26ef522c7fc405f7210da13e35e32405486da26009a52acc`, preserved at `archive/JAN-CSAA-002-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot`",
  );

  replacePrefix(
    lines,
    "- The fulfillment cell is",
    "- The fulfillment cell is the implemented design/documentation site. `IMPLEMENTED` records exact documentation presence after objective verification; it does not claim executable implementation.",
  );
  replacePrefix(
    lines,
    "- Current Draft closure verification is",
    "- Current Draft closure verification is `PASSED` for every applicable row and owned by the author/ledger closer under VERIFICATION-001 and successor VERIFICATION-002. In every compact requirement table, the value after the final slash is the row's single verification state. Every preceding Verification ID is a required method binding. Method execution state is recorded only in §7. Noncurrent rows remain `NOT_REQUIRED_CURRENT_PHASE`; a current method pass audits only their disposition or allocation and does not perform the allocated future obligation. This activity neither constitutes author self-review nor substitutes for later independent adversarial review or integrity/provenance validation.",
  );
  replacePrefix(
    lines,
    "- Oracle owner/status is",
    "- Oracle owner/status is `Author/ledger closer; objective documentation check passed; no executable oracle change` for current rows. A noncurrent overlay names its later role and remains `NOT_REQUIRED_CURRENT_PHASE`.",
  );
  replacePrefix(
    lines,
    "- Evidence is",
    "- Evidence is the linked Draft, ledger, exact governed sources, `JAN-CSAA-005-EVIDENCE-007@0.1.0`, VERIFICATION-001, successor VERIFICATION-002, and reconciliation 002.",
  );

  const localStart = heading(lines, "## 4.");
  const inheritedStart = heading(lines, "## 5.");
  const canonStart = heading(lines, "## 6.");
  const methodsStart = heading(lines, "## 7.");
  const noncurrentInherited = new Set([
    "150",
    "164",
    "167",
    "168",
    "652",
    "738",
    ...Array.from({ length: 18 }, (_, i) => String(668 + i)),
  ]);
  let applicable = 0;
  let noncurrent = 0;
  const ids = new Set();
  for (let index = localStart + 1; index < methodsStart; index += 1) {
    const cells = parseRow(lines[index]);
    if (!cells) continue;
    let isRequirement = false;
    let isApplicable = false;
    let implementationIndex;
    let verificationIndex;
    if (index < inheritedStart && /^`CSAA-002-REQ-/.test(cells[0])) {
      isRequirement = true;
      isApplicable = true;
      assert(cells.length === 6, `002 local ${cells[0]} schema mismatch`);
      implementationIndex = 4;
      verificationIndex = 5;
    } else if (
      index >= inheritedStart &&
      index < canonStart &&
      /^`CSAA-000-REQ-(\d{3})`$/.test(cells[0])
    ) {
      isRequirement = true;
      const number = cells[0].match(/REQ-(\d{3})/)[1];
      isApplicable = !noncurrentInherited.has(number);
      assert(cells.length === 6, `002 inherited ${cells[0]} schema mismatch`);
      implementationIndex = 4;
      verificationIndex = 5;
    } else if (
      index >= canonStart &&
      /^`CSAA-002-INH-CAN-/.test(cells[0])
    ) {
      isRequirement = true;
      isApplicable = true;
      assert(cells.length === 6, `002 canon ${cells[0]} schema mismatch`);
      implementationIndex = 4;
      verificationIndex = 5;
      if (cells[0] === "`CSAA-002-INH-CAN-022`") {
        cells[3] = cells[3].replace(
          "prohibition-by-prohibition applicability and sufficiency review remains `NOT_RUN`",
          "prohibition-by-prohibition applicability and sufficiency review passed under `JAN-CSAA-002-VER-CAN-001` and successor VERIFICATION-002",
        );
      }
    } else if (
      index >= canonStart &&
      /^`CSAA-002-INH-REG-/.test(cells[0])
    ) {
      isRequirement = true;
      assert(cells.length === 7, `002 register ${cells[0]} schema mismatch`);
      isApplicable = cells[3].startsWith("`APPLICABLE_NOW`");
      implementationIndex = 5;
      verificationIndex = 6;
    }
    if (!isRequirement) continue;
    assert(!ids.has(cells[0]), `duplicate 002 row ${cells[0]}`);
    ids.add(cells[0]);
    if (isApplicable) {
      applicable += 1;
      cells[implementationIndex] = "`IMPLEMENTED`";
      cells[verificationIndex] = setCombinedVerificationState(cells[verificationIndex], "PASSED");
    } else {
      noncurrent += 1;
      assert(
        cells[implementationIndex] === "`NOT_REQUIRED_CURRENT_PHASE`",
        `002 noncurrent ${cells[0]} implementation mismatch`,
      );
      cells[verificationIndex] = setCombinedVerificationState(
        cells[verificationIndex],
        "NOT_REQUIRED_CURRENT_PHASE",
      );
    }
    lines[index] = joinRow(cells);
  }
  assert(
    ids.size === 822 && applicable === 793 && noncurrent === 29,
    `002 row population mismatch: ids=${ids.size} applicable=${applicable} noncurrent=${noncurrent}`,
  );

  const currentMethods = [
    "JAN-CSAA-002-VER-GOV-001",
    "JAN-CSAA-002-VER-SUB-001",
    "JAN-CSAA-002-VER-WRK-001",
    "JAN-CSAA-002-VER-ART-001",
    "JAN-CSAA-002-VER-TSC-001",
    "JAN-CSAA-002-VER-GRF-001",
    "JAN-CSAA-002-VER-EXE-001",
    "JAN-CSAA-002-VER-EPI-001",
    "JAN-CSAA-002-VER-INV-001",
    "JAN-CSAA-002-VER-CAT-001",
    "JAN-CSAA-002-VER-INH-000",
    "JAN-CSAA-002-VER-CAN-001",
    "JAN-CSAA-002-VER-REG-001",
  ];
  for (const id of currentMethods) {
    editUniqueRow(lines, id, (cells) => {
      assert(cells.length === 10, `${id} method schema mismatch`);
      cells[3] = appendOnce(
        cells[3],
        "`JAN-CSAA-005-EVIDENCE-007@0.1.0` dated snapshot plus `JAN-CSAA-005-EVIDENCE-008@0.1.0` authoring-baseline control",
      );
      cells[7] = appendOnce(
        cells[7],
        "VERIFICATION-001 and successor VERIFICATION-002 result evidence",
      );
      cells[9] = "`PASSED`";
    });
  }
  replacePrefix(
    lines,
    "Purely diagnostic author-side mechanical checks",
    "All thirteen current-phase objective methods executed and passed under VERIFICATION-001 and successor VERIFICATION-002 against an implementation/configuration subject byte-identical to EVIDENCE-007. EVIDENCE-007 separately revalidated current freshness and unchanged applicability after an excluded Draft authority input changed. Author self-review and both post-Proposed independent assurance methods remain explicit non-passes; no method pass performs a noncurrent allocated obligation.",
  );

  editUniqueRow(lines, "JAN-CSAA-002-GAP-001", (cells) => {
    cells[2] =
      "The corrected invariant, self-review, canon, and register intake received complete objective verification and successor freshness revalidation";
    cells[3] = "Corrected intake objectively verified";
    cells[4] =
      "Preserve the exact 822-row population and rerun affected methods after any source or candidate change";
    cells[6] = "None for ledger closure";
    cells[7] = "`CORRECTED_AND_OBJECTIVELY_VERIFIED`";
  });
  editUniqueRow(lines, "JAN-CSAA-002-GAP-002", (cells) => {
    cells[2] =
      "All 793 applicable-now rows passed current-phase objective verification; 29 noncurrent rows remain explicit non-passes";
    cells[3] = "Objective verification closed";
    cells[4] =
      "Keep author self-review and all later assurance separately open; do not infer executable implementation";
    cells[6] =
      "None for ledger closure; author self-review remains a Proposed-promotion predicate";
    cells[7] = "`CLOSED_BY_SYNCHRONIZED_LEDGER_CLOSURE`";
  });
  for (const id of ["JAN-CSAA-002-GAP-005", "JAN-CSAA-002-GAP-006"]) {
    editUniqueRow(lines, id, (cells) => {
      cells[4] = appendOnce(
        cells[4],
        "VERIFICATION-001 and successor VERIFICATION-002 passed the corrected exact surface",
      );
      cells[6] = "None";
      cells[7] = "`CORRECTED_AND_OBJECTIVELY_VERIFIED`";
    });
  }
  editUniqueRow(lines, "JAN-CSAA-002-GAP-007", (cells) => {
    cells[2] =
      "Historical examples remain bound to their cited predecessor snapshot; OBS-035/036 separately supplies the dated implementation/configuration authoring baseline";
    cells[4] =
      "Preserve historical examples without silent rebinding; use EVIDENCE-007 only as dated snapshot evidence, EVIDENCE-008 for documentation closure, and perform consolidated implementation refresh before exact candidate freeze";
    cells[5] =
      "[Current subject rebinding 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>); historical [rebinding 003](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), [rebinding 002](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), and cited historical 005 evidence";
    cells[6] =
      "No blocker for documentation-ledger closure under STANDING-DIRECTION-003; final implementation refresh and Proposed-transition freeze remain open";
    cells[7] = "`NONBLOCKING_FOR_DOCUMENT_CLOSURE — FINAL_REFRESH_REQUIRED`";
  });
  editUniqueRow(lines, "JAN-CSAA-002-GAP-008", (cells) => {
    cells[2] =
      "Author self-review is now activated by ledger closure but has not yet been performed";
    cells[4] =
      "Keep all eighteen rows `ALLOCATED_TO_POST_LEDGER_SELF_REVIEW`; perform before Proposed freeze";
  });

  setMeasure(
    lines,
    "Implementation states",
    "793 `IMPLEMENTED`; 0 `PLANNED`; 29 `NOT_REQUIRED_CURRENT_PHASE`; total 822.",
  );
  setMeasure(
    lines,
    "Row verification states",
    "793 `PASSED`; 0 `NOT_RUN`; 29 `NOT_REQUIRED_CURRENT_PHASE`; total 822 requirement rows.",
  );
  setMeasure(
    lines,
    "Verification-method execution states",
    "13 `PASSED`; 0 `NOT_RUN`; 3 `NOT_REQUIRED_CURRENT_PHASE`; total 16 methods.",
  );
  setMeasure(lines, "Applicable-now implemented / not implemented", "793 / 0.");
  setMeasure(lines, "Applicable-now verification passed / not passed", "793 / 0.");
  setMeasure(
    lines,
    "Gaps",
    "1 exact-freeze `OPEN`; 1 later-lifecycle `OPEN`; 3 `CORRECTED_AND_OBJECTIVELY_VERIFIED`; 1 `CLOSED_BY_SYNCHRONIZED_LEDGER_CLOSURE`; 1 `NONBLOCKING_FOR_DOCUMENT_CLOSURE — FINAL_REFRESH_REQUIRED`; 1 `ALLOCATED_TO_POST_LEDGER_SELF_REVIEW`; 1 `RESOLVED_IN_CURRENT_DRAFT`; 1 `PROCEDURE_SUPERSEDED — FINAL_CARRIAGE_PENDING`.",
  );
  setMeasure(
    lines,
    "Ledger",
    "`CLOSED_FOR_NAMED_COMMISSION`; READY_FOR_REVIEW and Proposed are not claimed.",
  );
  setMeasure(
    lines,
    "Formal review",
    "Current-phase objective verification complete; author self-review is activated but not performed; post-Proposed adversarial review and integrity/provenance validation are not yet due.",
  );
  replacePrefix(
    lines,
    "Closure is not claimed.",
    "Closure is claimed only for the named Draft objective-verification commission. Section 10 counts requirement-row states; §7 counts method execution states. All 793 applicable-now rows are `IMPLEMENTED / PASSED`; all 29 noncurrent rows remain explicit non-passes; no author self-review, Proposed promotion, independent assurance, final decision, or authority is inferred.",
  );

  const authorIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Author / ledger closer",
    "002 author sign-off",
  );
  lines[authorIndex] = joinRow([
    "Author / ledger closer",
    "Current Draft objective closure",
    "Codex documentation author/integrator and objective-verification streams",
    "`PASS — OBJECTIVE VERIFICATION COMPLETE; CLOSED_FOR_NAMED_COMMISSION`",
    `\`${closureTime}\``,
    "Exact 0.3.0 OPEN preimage; VERIFICATION-001; VERIFICATION-002; EVIDENCE-007; reconciliation 002; post-transition closure integrity record",
  ]);
  const selfIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Author self-reviewer",
    "002 self sign-off",
  );
  const selfCells = parseRow(lines[selfIndex]);
  selfCells[3] =
    "`OPEN — ACTIVATED BY LEDGER CLOSURE; NOT YET PERFORMED`; allocated through `JAN-CSAA-002-VER-SELF-001`";
  lines[selfIndex] = joinRow(selfCells);

  return lines;
}

function transform005(sourceLines) {
  const lines = [...sourceLines];
  replacePrefix(lines, "**Ledger ID:**", "**Ledger ID:** `JAN-CSAA-005-LEDGER-001@0.3.1`");
  replacePrefix(
    lines,
    "**Status:**",
    "**Status:** Closed for the named JAN-CSAA-005 Draft objective-verification commission; non-authoritative evidence record",
  );
  replacePrefix(
    lines,
    "**Purpose:**",
    "**Purpose:** Preserve one row for every stable requirement in the revision-bound repository inventory while recording completed author-side objective Draft closure and keeping observation, author self-review, post-Proposed assurance, final decision, and ministerial recording as separate states.",
  );
  setMetadataField(lines, "Ledger ID", "`JAN-CSAA-005-LEDGER-001@0.3.1`");
  setMetadataField(
    lines,
    "Parent commit",
    "`49b69fb7b78efa180fa19f3f2f24b8de749c3857`",
  );
  setMetadataField(
    lines,
    "Worktree/change-set identity",
    "Accepted observations `JAN-CSAA-005-REFRESH-OBS-035` and `036`, from OBS-035 start `2026-07-28T19:20:38.576Z` through OBS-036 completion `2026-07-28T19:20:40.359Z`: endpoint-corrected 19-path perimeter and authority-input capture; two selected tracked paths with unstaged changes; exact status, content, normalized default-index unstaged diff, empty staged diff, tracked-manifest, generated-context, tree, quiescence, and unchanged-applicability conclusions recorded in `JAN-CSAA-005-EVIDENCE-007@0.1.0`.",
  );
  setMetadataField(
    lines,
    "Intake time",
    "Historical intake `2026-07-26T11:52:31.6050250-04:00`; clean successor OBS-019/020, dirty OBS-027/028, OBS-029/030/EVIDENCE-004, OBS-031/032/EVIDENCE-005, and OBS-033/034/EVIDENCE-006 remain historical; current subject and authority-input rebinding is OBS-035/036 through EVIDENCE-007",
  );
  setMetadataField(
    lines,
    "Last refresh time",
    "`2026-07-28T19:20:40.359Z`; the immediate closure recheck recorded by the closure-integrity record also matched every EVIDENCE-007 predicate",
  );
  setMetadataField(
    lines,
    "Refresh evidence",
    `${evidence007}; historical [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), [Current Subject Refresh and Compatibility Record](<JAN-CSAA-005 - Current Subject Refresh and Compatibility Record.md>), [Successor Preparation Evidence Snapshot](<JAN-CSAA-005 - Successor Preparation Evidence Snapshot.md>), and prior blocker remain visible and unchanged`,
  );
  insertMetadataAfter(lines, "Refresh evidence", [
    [
      "Objective verification evidence",
      "Historical [VERIFICATION-001](<JAN-CSAA-005 - Objective Author Verification Record.md>) — 8,028 bytes / `85a0e47a2185e46cbd18ec5b04bd2420a5acad8b6f11e5eff96eb0dc9461bfa7`; current [VERIFICATION-002](<JAN-CSAA-005 - Objective Author Verification Record 002.md>) — 9,547 bytes / `1d9d084b46c555b82c3dfc3aa4b076d34ae230072f9bc066d1f031ba5686e8d9`; [reconciliation 002](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>) — 10,321 bytes / `1a7f970353db9dd70faf23c1de05193b348459458b6438303e82250692fc2515`",
    ],
    ["Closure time", `\`${closureTime}\``],
    ["Post-transition integrity evidence", closureIntegrityId],
  ]);
  setMetadataField(lines, "Ledger state", "`CLOSED_FOR_NAMED_COMMISSION`");
  setMetadataField(
    lines,
    "Supersedes",
    "`JAN-CSAA-005-LEDGER-001@0.3.0 / Open`, 459,849 bytes, SHA-256 `86940e63fc011ae58a460bb4f403d79763e8e8722edd5bfeeb75c6cb6597d3b4`, preserved at `archive/JAN-CSAA-005-LEDGER@0.3.0.Open.PRE-CLOSURE.snapshot`",
  );

  replacePrefix(
    lines,
    "The 336 local rows reconcile",
    "The 336 local rows reconcile exactly to the 336 local mandatory clauses. Eighty-eight `JAN-CSAA-000` obligations are imported individually, including eighteen obligations deliberately allocated to the separately recorded post-ledger author self-review. Seventy-one applicable direct concern-owning canon obligations are individually dispositioned without capturing their source concerns. The current repository subject is the exact dirty OBS-035/036 pair recorded by `JAN-CSAA-005-EVIDENCE-007@0.1.0`; it is not represented as clean, committed, tested, or behavior-preserving. The former MANIFEST-002 intermediate gate remains withdrawn under `REG-D-021`/`REG-D-022`, while synchronized member/manifest carriage remains allocated to the final corpus transaction. All current objective methods and exact cross-document reconciliation passed. Author self-review, exact Proposed-candidate freeze, formal independent adversarial review, and integrity/provenance validation remain open. This 495-row ledger is `CLOSED_FOR_NAMED_COMMISSION` and does not claim `READY_FOR_REVIEW` or Proposed.",
  );
  replacePrefix(
    lines,
    "Disposition, implementation, and verification are independent.",
    "Disposition, implementation, and verification are independent. All 458 Draft-applicable rows are authored and objectively verified for this exact closure subject; all 37 noncurrent rows remain explicit non-passes. No row is `PASSED` without exact-subject evidence and its passed Section 6 record.",
  );

  const localStart = heading(lines, "## 3.");
  const inheritedStart = heading(lines, "### 3.1");
  const canonStart = heading(lines, "### 3.2");
  const allowedStart = heading(lines, "### Allowed obligation-disposition");
  let localApplicable = 0;
  let localNoncurrent = 0;
  const localIds = new Set();
  const oldCurrentLink =
    "[Current Subject Rebinding Record](<JAN-CSAA-005 - Current Subject Rebinding Record.md>)";
  const newCurrentLink =
    "[Current Subject Rebinding Record 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>)";
  for (let index = localStart + 1; index < inheritedStart; index += 1) {
    const cells = parseRow(lines[index]);
    if (!cells || !/^`CSAA-005-REQ-/.test(cells[0])) continue;
    assert(cells.length === 15, `005 local ${cells[0]} schema mismatch`);
    assert(!localIds.has(cells[0]), `duplicate 005 local row ${cells[0]}`);
    localIds.add(cells[0]);
    cells[13] = cells[13].replace(oldCurrentLink, newCurrentLink);
    const isApplicable = cells[5] === "`APPLICABLE_NOW`";
    if (isApplicable) {
      localApplicable += 1;
      cells[8] = "`IMPLEMENTED`";
      cells[11] = "`PASSED`";
      cells[12] =
        "Author/ledger closer; objective verification `PASSED` under VERIFICATION-001 and VERIFICATION-002; later assurance not performed";
      cells[13] = appendOnce(
        cells[13],
        "[successor objective verification](<JAN-CSAA-005 - Objective Author Verification Record 002.md>)",
      );
      cells[14] = cells[14].replace(
        /verification remains open/g,
        "author-side objective verification passed; later assurance remains unperformed",
      );
    } else {
      localNoncurrent += 1;
      assert(
        cells[8] === "`NOT_REQUIRED_CURRENT_PHASE`" &&
          cells[11] === "`NOT_REQUIRED_CURRENT_PHASE`",
        `005 noncurrent local ${cells[0]} state mismatch`,
      );
    }
    lines[index] = joinRow(cells);
  }
  assert(
    localIds.size === 336 && localApplicable === 322 && localNoncurrent === 14,
    "005 local population mismatch",
  );

  replacePrefix(
    lines,
    "| Implementation state |",
    "| Implementation state | `IMPLEMENTED`, except `CSAA-000-REQ-150`, `164`, `167`, `168`, `652`, and `668`–`685`, which remain `NOT_REQUIRED_CURRENT_PHASE` under their deferred, successor-controlled, later-lifecycle, later-execution, or post-ledger-self-review dispositions |",
  );
  replacePrefix(
    lines,
    "| Verification state |",
    "| Verification state | `PASSED`, except `CSAA-000-REQ-150`, `164`, `167`, `168`, `652`, and `668`–`685`, which remain `NOT_REQUIRED_CURRENT_PHASE` |",
  );
  replacePrefix(
    lines,
    "| Oracle owner/status |",
    "| Oracle owner/status | Author/ledger closer objective Draft verification passed under VERIFICATION-001 and successor VERIFICATION-002; distinct adversarial reviewer and integrity/provenance validator remain later; final decision authority and ministerial recorder remain separate; no oracle judgment conferred |",
  );
  replacePrefix(
    lines,
    "| Evidence record |",
    "| Evidence record | [JAN-CSAA-000 Refresh Requirement Ledger](<JAN-CSAA-000 - Refresh Requirement Ledger.md>); this ledger; [JAN-CSAA-005](<../JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md>); [Current Subject Rebinding Record 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>); historical [Current Subject Rebinding Record 003](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), [Current Subject Rebinding Record 002](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), and [Current Subject Rebinding Record](<JAN-CSAA-005 - Current Subject Rebinding Record.md>); [successor objective verification](<JAN-CSAA-005 - Objective Author Verification Record 002.md>); historical preparation evidence |",
  );

  const compactIds = new Set();
  let compactApplicable = 0;
  let compactNoncurrent = 0;
  for (let index = inheritedStart + 1; index < canonStart; index += 1) {
    const cells = parseRow(lines[index]);
    if (!cells || !/^`CSAA-000-REQ-/.test(cells[0]) || cells.length !== 8) continue;
    assert(!compactIds.has(cells[0]), `duplicate 005 compact row ${cells[0]}`);
    compactIds.add(cells[0]);
    if (cells[4] === "`APPLICABLE_NOW`") {
      compactApplicable += 1;
      cells[7] = cells[7]
        .replace(
          /author verification remains open/g,
          "author-side objective verification passed under VERIFICATION-002",
        )
        .replace(
          /Controlled-document review pending/g,
          "Controlled-document objective verification passed under VERIFICATION-002",
        )
        .replace(
          /Metadata review pending/g,
          "Metadata objective verification passed under VERIFICATION-002",
        )
        .replace(
          /objective verification remains pending/g,
          "objective verification passed under VERIFICATION-002",
        )
        .replace(
          /objective exact-source and binding verification remains open/g,
          "objective exact-source and binding verification passed under VERIFICATION-002",
        )
        .replace(
          /Objective source review remains pending/g,
          "Objective source review passed under VERIFICATION-002",
        )
        .replace(/Reproduction pending/g, "Objective reproduction passed under VERIFICATION-002")
        .replace(
          /Provider-neutrality review pending/g,
          "Provider-neutrality objective review passed under VERIFICATION-002",
        )
        .replace(
          /OBS-029\/030 rebound the exact dirty subject/g,
          "OBS-035/036 rebinds the exact dirty subject through EVIDENCE-007",
        )
        .replace(
          /Exact OBS-029\/030 dirty subject/g,
          "Exact OBS-035/036 dirty subject",
        )
        .replace(
          /OBS-029\/030 supplied a matching accepted dirty-subject rebinding/g,
          "OBS-035/036 supplied a matching accepted dirty-subject rebinding",
        )
        .replace(
          /Current-subject freshness remains open/g,
          "Current-subject freshness passed under EVIDENCE-007; later invalidation reopens it",
        )
        .replace(
          /Authoring and objective Draft verification remain in progress/g,
          "Authoring and objective Draft verification are complete; author self-review and post-Proposed assurance remain later",
        )
        .replace(
          /Ledger closure and author self-review remain required and open/g,
          "Ledger closure is complete; author self-review remains required and open",
        );
    } else {
      compactNoncurrent += 1;
    }
    lines[index] = joinRow(cells);
  }
  assert(
    compactIds.size === 70 && compactApplicable === 65 && compactNoncurrent === 5,
    "005 compact inherited population mismatch",
  );
  replacePrefix(
    lines,
    "Each row below preserves these explicit fields unless the row says otherwise:",
    "Each row below preserves these explicit fields unless the row says otherwise: owner/source `JAN-CSAA-000@0.3.0 / §17`; applicability/subject this exact authored controlled-document Draft after objective ledger closure; obligation disposition `ALLOCATED_TO_POST_LEDGER_SELF_REVIEW`; disposition authority `REG-D-021` lifecycle ordering and `CSAA-LEDGER-TEMPLATE-001@0.5.0` §9; implementation/document site the separately recorded, itemized author self-review; implementation state `NOT_REQUIRED_CURRENT_PHASE`; enforced reference artifact the exact `JAN-CSAA-000` source row and its README §17 question; verification binding `JAN-CSAA-005-VER-SELF-001`; verification state `NOT_REQUIRED_CURRENT_PHASE`; oracle owner/status author self-reviewer / activated by ledger closure but not yet performed; evidence record future exact author-self-review record; notes no satisfaction or pass is inferred from allocation.",
  );
  replacePrefix(
    lines,
    "Each row in this section preserves these explicit fields unless the row says otherwise:",
    "Each row in this section preserves these explicit fields unless the row says otherwise: applicability/subject this exact revision-bound inventory Draft and ledger; obligation disposition `APPLICABLE_NOW`; disposition authority/rationale source concern ownership plus the standing documentation commission; implementation state `IMPLEMENTED`; enforced reference artifact the exact cited canon source; verification state `PASSED`; oracle owner/status author/ledger closer / objective concern-aware verification passed under VERIFICATION-001 and successor VERIFICATION-002; evidence record this ledger, the exact cited source, EVIDENCE-007, and VERIFICATION-002; notes the source retains semantic authority and no independent review has been performed.",
  );

  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-001", (cells) => {
    cells[2] =
      "The earlier intake defect is corrected and the complete direct-canon and self-review population received objective verification";
    cells[4] =
      "Preserve all 71 direct canon rows and 18 self-review allocations; rerun affected checks after any source or candidate change";
    cells[6] = "None for ledger closure";
    cells[7] = "`CORRECTED_AND_OBJECTIVELY_VERIFIED`";
  });
  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-002", (cells) => {
    cells[2] =
      "All 458 Draft-applicable rows passed objective verification; the eighteen-question author self-review is activated but unperformed";
    cells[4] =
      "Keep self-review rows `NOT_REQUIRED_CURRENT_PHASE`; close only the objective commission and perform self-review separately";
    cells[6] = "Proposed promotion; not ledger closure";
    cells[7] =
      "`OBJECTIVE_VERIFICATION_CLOSED — POST_LEDGER_SELF_REVIEW_OPEN`";
  });
  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-003", (cells) => {
    cells[2] =
      "OBS-035/036 rebinds the current dirty subject and unchanged-applicability conclusion through EVIDENCE-007; exact predecessor snapshots and EVIDENCE-003/004/005/006 remain historical; author self-review and the exact Proposed-transition freeze remain open";
    cells[4] =
      "Bind current technical conclusions only to OBS-035/036; after self-review, recheck freshness and freeze exact candidate bytes, digest, worktree impact, and conclusion-bearing subject identity";
    cells[5] =
      "[Current Subject Rebinding Record 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>); historical [Current Subject Rebinding Record 003](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), [Current Subject Rebinding Record 002](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), and predecessor records";
    cells[6] = "Author self-review, Proposed promotion, and post-Proposed assurance";
    cells[7] =
      "`CURRENT_SUBJECT_REBOUND — AUTHOR_SELF_REVIEW_AND_PROPOSED_TRANSITION_FREEZE_OPEN`";
  });
  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-005", (cells) => {
    cells[4] =
      "Retain 336 exact atomic local rows; all 322 applicable local rows are implemented/passed and all 14 later-lifecycle rows remain explicit non-passes";
    cells[6] = "None for ledger closure; later independent review remains after Proposed";
    cells[7] = "`CORRECTED_AND_OBJECTIVELY_VERIFIED`";
  });
  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-006", (cells) => {
    cells[2] =
      "The historical `e673fb…` subject, later clean OBS-019/020 subject, OBS-027/028 parent-commit identity, OBS-029/030/EVIDENCE-004 parent identity, OBS-031/032/EVIDENCE-005 authority-input identity, and OBS-033/034/EVIDENCE-006 parent identity became stale for current use; EVIDENCE-004 and EVIDENCE-006 were invalidated by documentation-only parent advances and EVIDENCE-005 by the intervening excluded SPEC-001 Draft working-copy change";
    cells[4] =
      "Preserve predecessor evidence and blockers; use only the exact OBS-035/036 dirty subject for current author verification and recheck every invalidation trigger before freeze";
    cells[5] =
      "[Current Subject Rebinding Record 004](<JAN-CSAA-005 - Current Subject Rebinding Record 004.md>); historical [Current Subject Rebinding Record 003](<JAN-CSAA-005 - Current Subject Rebinding Record 003.md>), [Current Subject Rebinding Record 002](<JAN-CSAA-005 - Current Subject Rebinding Record 002.md>), [EVIDENCE-004](<JAN-CSAA-005 - Current Subject Rebinding Record.md>), refresh, preparation, and blocker records";
    cells[6] =
      "None for this exact subject while every recorded identity remains current; reopens on any invalidation trigger";
    cells[7] = "`RESOLVED_FOR_OBS-035/036_DIRTY_SUBJECT_ONLY`";
  });
  editUniqueRow(lines, "JAN-CSAA-005-LEDGER-GAP-008", (cells) => {
    cells[2] =
      "The historical 0.2.2 authoring-state gap remains preserved; successor member verification and cross-package reconciliation now close the exact 0.3.0 pre-closure surface";
    cells[4] =
      "Preserve every predecessor snapshot; use only the successor reconciliation for the live closure result";
    cells[5] =
      "[Wave 1 objective reconciliation 002](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record 002.md>); historical [reconciliation 001](<JAN-CSAA-W1 - Wave 1 Cross-Package Objective Reconciliation Record.md>) and Closure Pass A";
    cells[6] = "None for synchronized Draft ledger closure; later Proposed review remains open";
    cells[7] =
      "`RESOLVED_BY_JAN-CSAA-W1-OBJECTIVE-RECONCILIATION-002_FOR_EXACT_PRE-CLOSURE_SURFACE`";
  });

  const currentMethods = [
    "JAN-CSAA-005-VER-AUT-001",
    "JAN-CSAA-005-VER-SCP-001",
    "JAN-CSAA-005-VER-WRK-001",
    "JAN-CSAA-005-VER-TOL-001",
    "JAN-CSAA-005-VER-SEM-001",
    "JAN-CSAA-005-VER-EPI-001",
    "JAN-CSAA-005-VER-INH-DOC-001",
    "JAN-CSAA-005-VER-INH-INV-001",
    "JAN-CSAA-005-VER-INH-W1-001",
    "JAN-CSAA-005-VER-INH-LIFE-001",
    "JAN-CSAA-005-VER-INH-CON-001",
    "JAN-CSAA-005-VER-INH-DOC001-001",
    "JAN-CSAA-005-VER-INH-DOC002-001",
    "JAN-CSAA-005-VER-INH-DOC003-001",
    "JAN-CSAA-005-VER-INH-DOC004-001",
  ];
  for (const id of currentMethods) {
    editUniqueRow(lines, id, (cells) => {
      assert(cells.length === 10, `${id} method schema mismatch`);
      if (id === "JAN-CSAA-005-VER-INH-DOC-001") {
        cells[1] =
          "Applicable-now portion of `CSAA-000-REQ-145`–`163`; REQ-150 remains `DEFERRED_BY_CITED_AUTHORITY / NOT_REQUIRED_CURRENT_PHASE`";
      }
      cells[3] = cells[3]
        .replace(/JAN-CSAA-005-EVIDENCE-004@0\.1\.0/g, "JAN-CSAA-005-EVIDENCE-007@0.1.0")
        .replace(/OBS-029\/030/g, "OBS-035/036");
      cells[7] = appendOnce(
        cells[7],
        "VERIFICATION-001 and successor VERIFICATION-002 result evidence",
      );
      cells[9] = "`PASSED`";
    });
  }
  replacePrefix(
    lines,
    "No state other than `PASSED` means passed.",
    "No state other than `PASSED` means passed. All fifteen current author-side objective methods passed under VERIFICATION-001 and successor VERIFICATION-002 against an implementation/configuration subject byte-identical to EVIDENCE-007; EVIDENCE-007 separately revalidated current freshness and unchanged applicability after an excluded Draft authority input changed. `SELF`, `LIFE-SUCCESSOR`, `W1-EXECUTION`, `LIFE-LATER`, and `INTEGRITY` remain `NOT_REQUIRED_CURRENT_PHASE`; no current method performs those future activities. No build, test, analyzer, gate, generator, or mutation command was run by this documentation closure.",
  );

  setMeasure(
    lines,
    "Direct cited-canon obligations awaiting intake",
    "0; all 71 received objective verification and remain subordinate to their concern-owning sources.",
  );
  setMeasure(lines, "Applicable-now implemented", "458");
  setMeasure(lines, "Applicable-now planned but not objectively verified", "0");
  setMeasure(lines, "Applicable-now verification passed", "458");
  setMeasure(lines, "Applicable-now verification not passed", "0");
  const deferredIndex = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === "Deferred implementation and verification states",
    "005 deferred summary",
  );
  lines.splice(
    deferredIndex + 1,
    0,
    joinRow([
      "Implementation states",
      "458 `IMPLEMENTED`; 0 `PLANNED`; 37 `NOT_REQUIRED_CURRENT_PHASE`; total 495.",
    ]),
    joinRow([
      "Row verification states",
      "458 `PASSED`; 0 `NOT_RUN`; 37 `NOT_REQUIRED_CURRENT_PHASE`; total 495.",
    ]),
    joinRow([
      "Verification-method states",
      "15 `PASSED`; 5 `NOT_REQUIRED_CURRENT_PHASE`; total 20.",
    ]),
    joinRow([
      "Gaps",
      "Objective/intake/current-subject/cross-package closure complete; author self-review, exact Proposed freeze, later assurance, and final carriage remain explicit non-passes.",
    ]),
  );
  replacePrefix(
    lines,
    "The local atomicity defect is corrected:",
    "The local atomicity defect is corrected and objectively verified: 336 unique local rows account for 336 independently verifiable local mandatory clauses, including four successor-equivalence clauses for frozen preparation-evidence line 438. Eighty-eight identified `JAN-CSAA-000` obligations have individual rows, including eighteen allocated to the later, separately recorded author self-review. Seventy-one applicable direct concern-owning canon obligations have individual stable rows, substantive bindings, and passed objective methods. All 458 applicable-now documentation rows are `IMPLEMENTED / PASSED`; all 37 noncurrent rows remain explicit non-passes. The final corpus package still preserves individual exact-member/material-fork/exception/residual-risk/amendment fields. The MANIFEST-002 intermediate gate remains withdrawn and final synchronized carriage remains pending. Author self-review, exact candidate freeze, Proposed promotion, independent adversarial review, integrity validation, and final decision remain open. This ledger is `CLOSED_FOR_NAMED_COMMISSION`; READY_FOR_REVIEW and Proposed are not claimed.",
  );

  const signoffStart005 = heading(lines, "## 9. Sign-off");
  const authorIndex = findUnique(
    lines,
    (line, index) =>
      index > signoffStart005 && parseRow(line)?.[0] === "Author/integrator",
    "005 author sign-off",
  );
  lines[authorIndex] = joinRow([
    "Author/integrator",
    "Current Draft objective closure",
    "Codex documentation author/integrator and objective-verification streams",
    "`PASS — OBJECTIVE VERIFICATION COMPLETE; CLOSED_FOR_NAMED_COMMISSION`",
    `\`${closureTime}\``,
    "Exact 0.3.0 OPEN preimage; VERIFICATION-001; VERIFICATION-002; EVIDENCE-007; reconciliation 002; post-transition closure integrity record",
  ]);
  const selfIndex = findUnique(
    lines,
    (line, index) =>
      index > signoffStart005 && parseRow(line)?.[0] === "Author self-reviewer",
    "005 self sign-off",
  );
  const selfCells = parseRow(lines[selfIndex]);
  selfCells[3] =
    "`OPEN — ACTIVATED BY LEDGER CLOSURE; NOT YET PERFORMED`; allocated through `JAN-CSAA-005-VER-SELF-001`";
  lines[selfIndex] = joinRow(selfCells);

  assert(localApplicable + compactApplicable + 71 === 458, "005 applicable arithmetic mismatch");
  assert(localNoncurrent + compactNoncurrent + 18 === 37, "005 noncurrent arithmetic mismatch");
  const canonRows = lines
    .slice(canonStart + 1, allowedStart)
    .map(parseRow)
    .filter((cells) => cells && /^`CSAA-005-INH-/.test(cells[0]));
  assert(canonRows.length === 71 && canonRows.every((cells) => cells.length === 5), "005 canon rows mismatch");

  return lines;
}

function verifyEvidenceIdentities() {
  for (const [name, bytes, digest] of evidenceSpecifications) {
    exactFileIdentity(path.join(recordsDir, name), bytes, digest, name);
  }
}

function validateLocalLinks(id, text) {
  const expression = /\[[^\]]*\]\((?:<([^>]+)>|([^)]+))\)/g;
  const missing = [];
  for (const match of text.matchAll(expression)) {
    const target = (match[1] || match[2]).trim();
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const filePart = target.split("#")[0];
    if (!filePart) continue;
    const resolved = path.resolve(recordsDir, filePart);
    if (!fs.existsSync(resolved)) missing.push(target);
  }
  assert(missing.length === 0, `${id} broken local links: ${missing.join(", ")}`);
}

function gapState(lines, id) {
  const index = findUnique(
    lines,
    (line) => parseRow(line)?.[0] === `\`${id}\``,
    `${id} gap state`,
  );
  return parseRow(lines[index]).at(-1);
}

function validateClosed(id, lines) {
  const text = `${lines.join("\r\n")}\r\n`;
  assert(!/(?<!\r)\n/.test(text), `${id} prospective output has LF-only`);
  assert(!/\r(?!\n)/.test(text), `${id} prospective output has CR-only`);
  assert(text.endsWith("\r\n") && !text.endsWith("\r\n\r\n"), `${id} terminal CRLF mismatch`);
  assert(text.includes(`JAN-CSAA-${id}-LEDGER-001@0.3.1`), `${id} missing 0.3.1 ID`);
  assert(text.includes("`CLOSED_FOR_NAMED_COMMISSION`"), `${id} missing closure state`);
  assert(text.includes(closureIntegrityId), `${id} missing closure-integrity binding`);
  const timeMatches = [
    ...text.matchAll(/\| Closure time \| `([^`]+)` \|/g),
  ];
  assert(timeMatches.length === 1, `${id} closure-time field count is ${timeMatches.length}`);
  assert(validIsoTimestamp(timeMatches[0][1]), `${id} invalid closure time ${timeMatches[0][1]}`);
  const fenceCount = lines.filter((line) => line.startsWith("```")).length;
  assert(fenceCount % 2 === 0, `${id} unbalanced fences`);
  validateLocalLinks(id, text);

  const methodPrefix = `\`JAN-CSAA-${id}-VER-`;
  const methodRows = lines.map(parseRow).filter((cells) => cells?.[0].startsWith(methodPrefix));
  const expected = id === "001" ? [16, 3] : id === "002" ? [13, 3] : [15, 5];
  const currentMethodIds = new Set(
    (
      id === "001"
        ? [
            "JAN-CSAA-001-VER-CTL-001",
            "JAN-CSAA-001-VER-ARC-001",
            "JAN-CSAA-001-VER-FLW-001",
            "JAN-CSAA-001-VER-TRU-001",
            "JAN-CSAA-001-VER-DEG-001",
            "JAN-CSAA-001-VER-OBS-001",
            "JAN-CSAA-001-VER-QUA-001",
            "JAN-CSAA-001-VER-ALT-001",
            "JAN-CSAA-001-VER-ACC-001",
            "JAN-CSAA-001-VER-INH-000",
            "JAN-CSAA-001-VER-INH-CON",
            "JAN-CSAA-001-VER-INH-DOC001",
            "JAN-CSAA-001-VER-INH-DOC002",
            "JAN-CSAA-001-VER-INH-DOC003",
            "JAN-CSAA-001-VER-INH-DOC004",
            "JAN-CSAA-001-VER-INH-REG",
          ]
        : id === "002"
          ? [
              "JAN-CSAA-002-VER-GOV-001",
              "JAN-CSAA-002-VER-SUB-001",
              "JAN-CSAA-002-VER-WRK-001",
              "JAN-CSAA-002-VER-ART-001",
              "JAN-CSAA-002-VER-TSC-001",
              "JAN-CSAA-002-VER-GRF-001",
              "JAN-CSAA-002-VER-EXE-001",
              "JAN-CSAA-002-VER-EPI-001",
              "JAN-CSAA-002-VER-INV-001",
              "JAN-CSAA-002-VER-CAT-001",
              "JAN-CSAA-002-VER-INH-000",
              "JAN-CSAA-002-VER-CAN-001",
              "JAN-CSAA-002-VER-REG-001",
            ]
          : [
              "JAN-CSAA-005-VER-AUT-001",
              "JAN-CSAA-005-VER-SCP-001",
              "JAN-CSAA-005-VER-WRK-001",
              "JAN-CSAA-005-VER-TOL-001",
              "JAN-CSAA-005-VER-SEM-001",
              "JAN-CSAA-005-VER-EPI-001",
              "JAN-CSAA-005-VER-INH-DOC-001",
              "JAN-CSAA-005-VER-INH-INV-001",
              "JAN-CSAA-005-VER-INH-W1-001",
              "JAN-CSAA-005-VER-INH-LIFE-001",
              "JAN-CSAA-005-VER-INH-CON-001",
              "JAN-CSAA-005-VER-INH-DOC001-001",
              "JAN-CSAA-005-VER-INH-DOC002-001",
              "JAN-CSAA-005-VER-INH-DOC003-001",
              "JAN-CSAA-005-VER-INH-DOC004-001",
            ]
    ).map((methodId) => `\`${methodId}\``),
  );
  const futureMethodIds = new Set(
    id === "001"
      ? [
          "`JAN-CSAA-001-VER-SELF-001`",
          "`JAN-CSAA-001-VER-PROPOSED-001`",
          "`JAN-CSAA-001-VER-INTEGRITY-001`",
        ]
      : id === "002"
        ? [
            "`JAN-CSAA-002-VER-SELF-001`",
            "`JAN-CSAA-002-VER-PROPOSED-001`",
            "`JAN-CSAA-002-VER-INTEGRITY-001`",
          ]
        : [
            "`JAN-CSAA-005-VER-SELF-001`",
            "`JAN-CSAA-005-VER-LIFE-SUCCESSOR-001`",
            "`JAN-CSAA-005-VER-W1-EXECUTION-001`",
            "`JAN-CSAA-005-VER-LIFE-LATER-001`",
            "`JAN-CSAA-005-VER-INTEGRITY-001`",
          ],
  );
  const expectedMethodIds = [...currentMethodIds, ...futureMethodIds].sort();
  const actualMethodIds = methodRows.map((cells) => cells[0]).sort();
  assert(
    new Set(actualMethodIds).size === actualMethodIds.length &&
      JSON.stringify(actualMethodIds) === JSON.stringify(expectedMethodIds),
    `${id} exact method-ID population mismatch`,
  );
  const passed = methodRows.filter((cells) => cells.at(-1) === "`PASSED`").length;
  const nonpass = methodRows.filter(
    (cells) => cells.at(-1) === "`NOT_REQUIRED_CURRENT_PHASE`",
  ).length;
  assert(
    passed === expected[0] && nonpass === expected[1] && methodRows.length === passed + nonpass,
    `${id} method-state mismatch: ${passed}/${nonpass}/${methodRows.length}`,
  );
  for (const cells of methodRows) {
    const expectedState = currentMethodIds.has(cells[0])
      ? "`PASSED`"
      : "`NOT_REQUIRED_CURRENT_PHASE`";
    assert(
      cells.at(-1) === expectedState,
      `${id} method ${cells[0]} state mismatch: ${cells.at(-1)} != ${expectedState}`,
    );
  }

  if (id === "001") {
    const start = heading(lines, "## 3.");
    const end = heading(lines, "## 5.");
    const rows = [];
    for (let index = start + 1; index < end; index += 1) {
      const cells = parseRow(lines[index]);
      if (cells && /^`(?:CSAA-001-|CSAA-000-REQ-)/.test(cells[0])) rows.push(cells);
    }
    assert(rows.length === 558 && new Set(rows.map((cells) => cells[0])).size === 558, "001 row count mismatch");
    let applicable = 0;
    let noncurrent = 0;
    for (const cells of rows) {
      const implementationIndex = cells.length === 8 ? 5 : 6;
      const verificationIndex = cells.length === 12 ? 8 : cells.length === 9 ? 7 : 6;
      if (cells[3].startsWith("`APPLICABLE_NOW`")) {
        applicable += 1;
        assert(cells[implementationIndex] === "`IMPLEMENTED`", `001 ${cells[0]} not implemented`);
        assert(cells[verificationIndex].endsWith("/ `PASSED`"), `001 ${cells[0]} not passed`);
      } else {
        noncurrent += 1;
        assert(
          cells[implementationIndex] === "`NOT_REQUIRED_CURRENT_PHASE`" &&
            cells[verificationIndex].endsWith("/ `NOT_REQUIRED_CURRENT_PHASE`"),
          `001 ${cells[0]} noncurrent state mismatch`,
        );
      }
    }
    assert(applicable === 482 && noncurrent === 76, "001 applicable arithmetic mismatch");
    assert(
      gapState(lines, "JAN-CSAA-001-LEDGER-GAP-001") ===
        "`CLOSED_BY_OBJECTIVE_VERIFICATION`" &&
        gapState(lines, "JAN-CSAA-001-LEDGER-GAP-002") ===
          "`CLOSED_BY_SYNCHRONIZED_LEDGER_CLOSURE`" &&
        gapState(lines, "JAN-CSAA-001-LEDGER-GAP-007") ===
          "`RESOLVED_FOR_OBS-035/036_SUBJECT_ONLY`",
      "001 live gap state mismatch",
    );
    assert(
      text.includes("558 = 482 implemented + 0 planned + 0 not started + 76 not required current phase") &&
        text.includes("558 = 482 passed + 0 not run + 76 not required current phase"),
      "001 summary arithmetic mismatch",
    );
  } else if (id === "002") {
    const start = heading(lines, "## 4.");
    const end = heading(lines, "## 7.");
    const rows = [];
    for (let index = start + 1; index < end; index += 1) {
      const cells = parseRow(lines[index]);
      if (
        cells &&
        /^`(?:CSAA-002-REQ-|CSAA-000-REQ-|CSAA-002-INH-CAN-|CSAA-002-INH-REG-)/.test(
          cells[0],
        )
      ) {
        rows.push(cells);
      }
    }
    assert(rows.length === 822 && new Set(rows.map((cells) => cells[0])).size === 822, "002 row count mismatch");
    let implemented = 0;
    let noncurrent = 0;
    for (const cells of rows) {
      const implementationIndex = cells.length === 7 ? 5 : 4;
      const verificationIndex = cells.length === 7 ? 6 : 5;
      if (cells[implementationIndex] === "`IMPLEMENTED`") {
        implemented += 1;
        assert(cells[verificationIndex].endsWith("/ `PASSED`"), `002 ${cells[0]} not passed`);
      } else {
        noncurrent += 1;
        assert(
          cells[implementationIndex] === "`NOT_REQUIRED_CURRENT_PHASE`" &&
            cells[verificationIndex].endsWith("/ `NOT_REQUIRED_CURRENT_PHASE`"),
          `002 ${cells[0]} noncurrent state mismatch`,
        );
      }
    }
    assert(implemented === 793 && noncurrent === 29, "002 state arithmetic mismatch");
    assert(
      !text.includes("prohibition-by-prohibition applicability and sufficiency review remains `NOT_RUN`"),
      "002 CAN-022 contradiction remains",
    );
    assert(
      gapState(lines, "JAN-CSAA-002-GAP-001") ===
        "`CORRECTED_AND_OBJECTIVELY_VERIFIED`" &&
        gapState(lines, "JAN-CSAA-002-GAP-002") ===
          "`CLOSED_BY_SYNCHRONIZED_LEDGER_CLOSURE`" &&
        gapState(lines, "JAN-CSAA-002-GAP-005") ===
          "`CORRECTED_AND_OBJECTIVELY_VERIFIED`" &&
        gapState(lines, "JAN-CSAA-002-GAP-006") ===
          "`CORRECTED_AND_OBJECTIVELY_VERIFIED`" &&
        gapState(lines, "JAN-CSAA-002-GAP-007") ===
          "`RESOLVED_FOR_OBS-035/036_SUBJECT_ONLY`",
      "002 live gap state mismatch",
    );
    assert(
      text.includes("793 `IMPLEMENTED`; 0 `PLANNED`; 29 `NOT_REQUIRED_CURRENT_PHASE`") &&
        text.includes("793 `PASSED`; 0 `NOT_RUN`; 29 `NOT_REQUIRED_CURRENT_PHASE`"),
      "002 summary arithmetic mismatch",
    );
  } else {
    const localStart = heading(lines, "## 3.");
    const inheritedStart = heading(lines, "### 3.1");
    const canonStart = heading(lines, "### 3.2");
    const allowedStart = heading(lines, "### Allowed obligation-disposition");
    const localRows = lines
      .slice(localStart + 1, inheritedStart)
      .map(parseRow)
      .filter((cells) => cells && /^`CSAA-005-REQ-/.test(cells[0]));
    const compactRows = lines
      .slice(inheritedStart + 1, canonStart)
      .map(parseRow)
      .filter((cells) => cells && /^`CSAA-000-REQ-/.test(cells[0]) && cells.length === 8);
    const selfRows = lines
      .slice(inheritedStart + 1, canonStart)
      .map(parseRow)
      .filter((cells) => cells && /^`CSAA-000-REQ-(?:66[8-9]|67\d|68[0-5])`$/.test(cells[0]) && cells.length === 2);
    const canonRows = lines
      .slice(canonStart + 1, allowedStart)
      .map(parseRow)
      .filter((cells) => cells && /^`CSAA-005-INH-/.test(cells[0]));
    assert(
      localRows.length === 336 &&
        compactRows.length === 70 &&
        selfRows.length === 18 &&
        canonRows.length === 71,
      `005 population mismatch ${localRows.length}/${compactRows.length}/${selfRows.length}/${canonRows.length}`,
    );
    const localApplicable = localRows.filter((cells) => cells[5] === "`APPLICABLE_NOW`");
    const localNoncurrent = localRows.filter((cells) => cells[5] !== "`APPLICABLE_NOW`");
    assert(
      localApplicable.length === 322 &&
        localApplicable.every(
          (cells) => cells[8] === "`IMPLEMENTED`" && cells[11] === "`PASSED`",
        ) &&
        localNoncurrent.length === 14 &&
        localNoncurrent.every(
          (cells) =>
            cells[8] === "`NOT_REQUIRED_CURRENT_PHASE`" &&
            cells[11] === "`NOT_REQUIRED_CURRENT_PHASE`",
        ),
      "005 local state mismatch",
    );
    assert(
      text.includes("| Implementation state | `IMPLEMENTED`, except") &&
        text.includes("| Verification state | `PASSED`, except") &&
        text.includes("implementation state `IMPLEMENTED`; enforced reference artifact") &&
        text.includes("verification state `PASSED`; oracle owner/status"),
      "005 compact/default state mismatch",
    );
    assert(
      !text.includes("Every Draft-applicable row is authored but remains unverified") &&
        !text.includes("current subject rebinding accepted in OBS-029/030") &&
        text.includes("All 458 Draft-applicable rows are authored and objectively verified"),
      "005 stale closure prose remains",
    );
    assert(
      gapState(lines, "JAN-CSAA-005-LEDGER-GAP-001") ===
        "`CORRECTED_AND_OBJECTIVELY_VERIFIED`" &&
        gapState(lines, "JAN-CSAA-005-LEDGER-GAP-002") ===
          "`OBJECTIVE_VERIFICATION_CLOSED — POST_LEDGER_SELF_REVIEW_OPEN`" &&
        gapState(lines, "JAN-CSAA-005-LEDGER-GAP-003") ===
          "`CURRENT_SUBJECT_REBOUND — AUTHOR_SELF_REVIEW_AND_PROPOSED_TRANSITION_FREEZE_OPEN`" &&
        gapState(lines, "JAN-CSAA-005-LEDGER-GAP-005") ===
          "`CORRECTED_AND_OBJECTIVELY_VERIFIED`" &&
        gapState(lines, "JAN-CSAA-005-LEDGER-GAP-006") ===
          "`RESOLVED_FOR_OBS-035/036_DIRTY_SUBJECT_ONLY`" &&
        gapState(lines, "JAN-CSAA-005-LEDGER-GAP-008") ===
          "`RESOLVED_BY_JAN-CSAA-W1-OBJECTIVE-RECONCILIATION-002_FOR_EXACT_PRE-CLOSURE_SURFACE`",
      "005 live gap state mismatch",
    );
    assert(
      text.includes("458 `IMPLEMENTED`; 0 `PLANNED`; 37 `NOT_REQUIRED_CURRENT_PHASE`") &&
        text.includes("458 `PASSED`; 0 `NOT_RUN`; 37 `NOT_REQUIRED_CURRENT_PHASE`"),
      "005 summary arithmetic mismatch",
    );
  }

  const signoffHeading =
    id === "002" ? heading(lines, "## 11. Sign-off") : heading(lines, "## 9. Sign-off");
  const signoffLabel = id === "005" ? "Author/integrator" : "Author / ledger closer";
  const signoff = findUnique(
    lines,
    (line, index) => index > signoffHeading && parseRow(line)?.[0] === signoffLabel,
    `${id} closure sign-off`,
  );
  const signoffCells = parseRow(lines[signoff]);
  assert(
    signoffCells[3].includes("CLOSED_FOR_NAMED_COMMISSION"),
    `${id} closure sign-off missing`,
  );
  assert(
    signoffCells[4] === `\`${timeMatches[0][1]}\``,
    `${id} closure field and sign-off time mismatch`,
  );
}

function buildClosureRecord(outputs, freshness) {
  const postRows = Object.entries(outputs).map(([id, value]) => [
    `JAN-CSAA-${id}-LEDGER-001@0.3.1`,
    specifications[id].file,
    value.length.toLocaleString("en-US"),
    sha(value),
  ]);
  const lines = [
    "# JAN-CSAA Wave 1 Synchronized Ledger Closure and Integrity Record",
    "",
    `**Record ID:** ${closureIntegrityId}`,
    "",
    "**Status:** Completed non-authoritative author-side synchronized-closure and integrity evidence",
    "",
    `**Transaction initiation time:** \`${closureTime}\``,
    "",
    "**Authority:** `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`; bounded documentation-only Draft objective closure",
    "",
    "**Result:** `PASS — THREE_LEDGER_SYNCHRONIZED_CLOSURE_COMPLETE — AUTHOR_SELF_REVIEW_UNLOCKED`",
    "",
    "**Assurance boundary:** This record proves only the exact administrative Draft-ledger closure transaction described below. It is not author self-review, Proposed promotion, independent adversarial review, independent integrity/provenance validation of a Proposed candidate, final sponsor decision, manifest carriage, executable Wave 1 exit, or authority.",
    "",
    "---",
    "",
    "## 1. Exact preimages and preserved archives",
    "",
    "| Ledger preimage | Bytes | SHA-256 | Preserved archive |",
    "| --- | ---: | --- | --- |",
    ...Object.entries(specifications).map(([id, spec]) =>
      joinRow([
        `\`JAN-CSAA-${id}-LEDGER-001@0.3.0 / OPEN\``,
        spec.sourceBytes.toLocaleString("en-US"),
        `\`${spec.sourceSha}\``,
        `\`archive/${spec.archive}\``,
      ]),
    ),
    "",
    "Every archive was identity-checked before mutation. Each main Draft remained byte-identical to its verified `JAN-CSAA-00x@0.3.0` preimage.",
    "",
    "---",
    "",
    "## 2. Immediate current-subject preflight",
    "",
    `The read-only paired closure preflight \`${freshness.checkId}\` ran immediately before the synchronized write: first capture \`${freshness.firstStart}\` through \`${freshness.firstCompletion}\`; second capture \`${freshness.secondStart}\` through \`${freshness.secondCompletion}\`; pair equality \`${freshness.pairEquality ? "TRUE" : "FALSE"}\`; result \`${freshness.result}\`.`,
    "",
    "| Predicate | Exact result |",
    "| --- | --- |",
    joinRow(["Branch / HEAD", `\`${freshness.subject.branch}\` / \`${freshness.subject.head}\``]),
    joinRow([
      "Perimeter",
      `${freshness.subject.perimeter.records} records / ${freshness.subject.perimeter.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.perimeter.sha}\``,
    ]),
    joinRow([
      "Selected status",
      `${freshness.subject.status.records} records / ${freshness.subject.status.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.status.sha}\``,
    ]),
    joinRow([
      "Tracked manifest",
      `${freshness.subject.tracked.records} records / ${freshness.subject.tracked.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.tracked.sha}\``,
    ]),
    joinRow([
      "Dirty manifest",
      `${freshness.subject.dirtyManifest.records} records / ${freshness.subject.dirtyManifest.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.dirtyManifest.sha}\``,
    ]),
    joinRow([
      "Package / lock",
      `\`${freshness.subject.packageSha}\` / \`${freshness.subject.lockSha}\``,
    ]),
    joinRow([
      "Packages / apps trees",
      `\`${freshness.subject.packagesTree}\` / \`${freshness.subject.appsTree}\``,
    ]),
    joinRow([
      "Generated context",
      `${freshness.subject.generated.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.generated.sha}\` / mtime ns \`${freshness.subject.generated.mtimeNs}\``,
    ]),
    joinRow([
      "Mutation journal / Bun processes",
      `${freshness.subject.mutationJournalAbsent ? "Absent" : "Present"} / ${freshness.subject.bunProcesses}`,
    ]),
    joinRow([
      "Authority-state inputs",
      `SPEC-001 ${freshness.subject.addedAuthorityFiles.spec.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.addedAuthorityFiles.spec.sha}\`; proposed commission ${freshness.subject.addedAuthorityFiles.commission.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.addedAuthorityFiles.commission.sha}\`; effective register ${freshness.subject.addedAuthorityFiles.register.bytes.toLocaleString("en-US")} bytes / \`${freshness.subject.addedAuthorityFiles.register.sha}\``,
    ]),
    joinRow([
      "Authority-state classifications",
      `SPEC-001 Draft/HYPOTHESIS/not-ratified \`${freshness.subject.addedAuthorityFiles.specDraft && freshness.subject.addedAuthorityFiles.specHypothesis && freshness.subject.addedAuthorityFiles.specNotRatified ? "TRUE" : "FALSE"}\`; commission Proposed/non-conferring \`${freshness.subject.addedAuthorityFiles.commissionProposed && freshness.subject.addedAuthorityFiles.commissionConfersNothing ? "TRUE" : "FALSE"}\`; effective register contains SPEC-001 \`${freshness.subject.addedAuthorityFiles.registerHasSpec001 ? "TRUE" : "FALSE"}\``,
    ]),
    "",
    "### 2.1 Exact selected dirty paths",
    "",
    "| Repository-root-relative path | Status | Content bytes / SHA-256 | Normalized unstaged diff bytes / SHA-256 | Staged diff bytes / SHA-256 |",
    "| --- | --- | --- | --- | --- |",
    ...freshness.subject.dirty.map((item) =>
      joinRow([
        `\`${item.path}\``,
        `\`${item.status}\``,
        `${item.contentBytes.toLocaleString("en-US")} / \`${item.contentSha}\``,
        `${item.unstagedBytes.toLocaleString("en-US")} / \`${item.unstagedSha}\``,
        `${item.stagedBytes.toLocaleString("en-US")} / \`${item.stagedSha}\``,
      ]),
    ),
    "",
    "Both dirty paths also reproduced their exact content, default-index unstaged-diff, and empty staged-diff identities. `JPWB-SPEC-001` remained Draft/HYPOTHESIS/not ratified; its proposed commissioning record remained non-conferring; and the effective register remained exact and contained no `JPWB-SPEC-001` entry. No invalidation predicate fired.",
    "",
    "---",
    "",
    "## 3. Exact evidence inputs",
    "",
    "| Evidence | Bytes | SHA-256 |",
    "| --- | ---: | --- |",
    ...evidenceSpecifications.map(([name, bytes, digest]) =>
      joinRow([`\`${name}\``, bytes.toLocaleString("en-US"), `\`${digest}\``]),
    ),
    "",
    "All evidence identities were checked after acquiring the closure lock and before the write. Historical EVIDENCE-004/005/006, VERIFICATION-001, and reconciliation 001 remain preserved; EVIDENCE-007 supplies current freshness and unchanged applicability while VERIFICATION-002 and reconciliation 002 supply current objective closure support.",
    "",
    "---",
    "",
    "## 4. Exact post-transition results",
    "",
    "| Closed ledger | Path | Bytes | SHA-256 |",
    "| --- | --- | ---: | --- |",
    ...postRows.map(([identity, file, bytes, digest]) =>
      joinRow([`\`${identity}\``, `\`${file}\``, bytes, `\`${digest}\``]),
    ),
    "",
    "| Member | Total rows | Applicable `IMPLEMENTED / PASSED` | Noncurrent explicit non-passes | Current methods passed | Future methods non-pass |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    "| `JAN-CSAA-001` | 558 | 482 | 76 | 16 | 3 |",
    "| `JAN-CSAA-002` | 822 | 793 | 29 | 13 | 3 |",
    "| `JAN-CSAA-005` | 495 | 458 | 37 | 15 | 5 |",
    "",
    "The three outputs were fully prepared and validated in memory before any live ledger changed. The closure process then re-read and compared all three live preimages, wrote the three outputs under one exclusive transaction lock, wrote this record, and revalidated exact bytes, row/method arithmetic, gaps, summaries, links, UTF-8/no-BOM/CRLF form, main-Draft stability, and evidence identities. Any failure in that bounded block triggers restoration of all three original ledger bytes and removal of this record.",
    "",
    "---",
    "",
    "## 5. Bounded disposition",
    "",
    "- The three ledgers are `CLOSED_FOR_NAMED_COMMISSION` only for their exact Draft objective-verification commissions.",
    "- All three `JAN-CSAA-00x@0.3.0` main Drafts remain byte-unchanged, Draft, HYPOTHESIS-grade, non-authoritative, and not Proposed.",
    "- The eighteen-question author self-review is now activated for each member but has not been performed.",
    "- Exact Proposed freeze/promotion, independent adversarial review, distinct integrity/provenance validation, final sponsor review, exact-member conferrals, register/README carriage, and every executable action remain future non-passes.",
    "- No application source, test, configuration, dependency, provider, fixture, oracle, gate, topology, register, staging area, or commit was changed by this transaction.",
    "",
  ];
  return encodeLines(lines);
}

function validateClosureRecord(recordBytes, outputs) {
  const lines = normalizeInput(recordBytes, "closure integrity record");
  const text = lines.join("\r\n");
  const requireUniqueLine = (expectedLine, label) => {
    assert(
      lines.filter((line) => line === expectedLine).length === 1,
      `closure record ${label} mismatch`,
    );
  };
  const requireUniqueField = (prefix, expectedLine, label) => {
    const matches = lines.filter((line) => line.startsWith(prefix));
    assert(
      matches.length === 1 && matches[0] === expectedLine,
      `closure record ${label} field mismatch`,
    );
  };
  requireUniqueField("**Record ID:**", `**Record ID:** ${closureIntegrityId}`, "ID");
  requireUniqueField(
    "**Status:**",
    "**Status:** Completed non-authoritative author-side synchronized-closure and integrity evidence",
    "status",
  );
  requireUniqueField(
    "**Authority:**",
    "**Authority:** `JPWB-REG-005 REG-D-021` as corrected by `REG-D-022`; bounded documentation-only Draft objective closure",
    "authority",
  );
  requireUniqueField(
    "**Result:**",
    "**Result:** `PASS — THREE_LEDGER_SYNCHRONIZED_CLOSURE_COMPLETE — AUTHOR_SELF_REVIEW_UNLOCKED`",
    "result",
  );
  requireUniqueField(
    "**Assurance boundary:**",
    "**Assurance boundary:** This record proves only the exact administrative Draft-ledger closure transaction described below. It is not author self-review, Proposed promotion, independent adversarial review, independent integrity/provenance validation of a Proposed candidate, final sponsor decision, manifest carriage, executable Wave 1 exit, or authority.",
    "assurance boundary",
  );
  const transactionMatches = [
    ...text.matchAll(/^\*\*Transaction initiation time:\*\* `([^`]+)`$/gm),
  ];
  assert(
    transactionMatches.length === 1 &&
      lines.filter((line) => line.startsWith("**Transaction initiation time:**")).length === 1,
    "closure record transaction-time cardinality mismatch",
  );
  const recordedTransactionTime = transactionMatches[0][1];
  assert(validIsoTimestamp(recordedTransactionTime), "closure record transaction time is invalid");
  if (mode === "apply") {
    assert(
      recordedTransactionTime === closureTime,
      "closure record transaction time does not match the apply argument",
    );
  }

  const preflightMatches = [
    ...text.matchAll(
      /The read-only paired closure preflight `JAN-CSAA-CLOSURE-FRESHNESS-001` ran immediately before the synchronized write: first capture `([^`]+)` through `([^`]+)`; second capture `([^`]+)` through `([^`]+)`; pair equality `TRUE`; result `PASS`\./g,
    ),
  ];
  assert(preflightMatches.length === 1, "closure record paired-preflight statement mismatch");
  const [, firstStart, firstCompletion, secondStart, secondCompletion] =
    preflightMatches[0];
  for (const value of [firstStart, firstCompletion, secondStart, secondCompletion]) {
    assert(validIsoTimestamp(value), `closure record preflight timestamp is invalid: ${value}`);
  }
  assert(
    Date.parse(firstStart) <= Date.parse(firstCompletion) &&
      Date.parse(firstCompletion) <= Date.parse(secondStart) &&
      Date.parse(secondStart) <= Date.parse(secondCompletion),
    "closure record preflight timestamp ordering mismatch",
  );
  assert(
    Date.parse(recordedTransactionTime) <= Date.parse(firstStart),
    "closure transaction initiation time follows its immediate preflight start",
  );

  for (const [id, spec] of Object.entries(specifications)) {
    const ledgerText = outputs[id].toString("utf8");
    const ledgerTimeMatches = [
      ...ledgerText.matchAll(/\| Closure time \| `([^`]+)` \|/g),
    ];
    assert(
      ledgerTimeMatches.length === 1 &&
        ledgerTimeMatches[0][1] === recordedTransactionTime,
      `${id} ledger closure time does not match the closure record`,
    );
    exactFileIdentity(
      path.join(archiveDir, spec.archive),
      spec.sourceBytes,
      spec.sourceSha,
      `${id} closure archive`,
    );
    requireUniqueLine(
      joinRow([
        `\`JAN-CSAA-${id}-LEDGER-001@0.3.0 / OPEN\``,
        spec.sourceBytes.toLocaleString("en-US"),
        `\`${spec.sourceSha}\``,
        `\`archive/${spec.archive}\``,
      ]),
      `${id} preimage row`,
    );
    requireUniqueLine(
      joinRow([
        `\`JAN-CSAA-${id}-LEDGER-001@0.3.1\``,
        `\`${spec.file}\``,
        outputs[id].length.toLocaleString("en-US"),
        `\`${sha(outputs[id])}\``,
      ]),
      `${id} postimage row`,
    );
  }

  for (const [name, bytes, digest] of evidenceSpecifications) {
    requireUniqueLine(
      joinRow([
        `\`${name}\``,
        bytes.toLocaleString("en-US"),
        `\`${digest}\``,
      ]),
      `evidence row ${name}`,
    );
  }

  const requiredSubjectRows = [
    joinRow([
      "Branch / HEAD",
      "`main` / `49b69fb7b78efa180fa19f3f2f24b8de749c3857`",
    ]),
    joinRow([
      "Perimeter",
      "19 records / 1,005 bytes / `74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390`",
    ]),
    joinRow([
      "Selected status",
      "2 records / 385 bytes / `d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374`",
    ]),
    joinRow([
      "Tracked manifest",
      "541 records / 75,641 bytes / `8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a`",
    ]),
    joinRow([
      "Dirty manifest",
      "2 records / 594 bytes / `4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac`",
    ]),
    joinRow([
      "Package / lock",
      "`ce83e2619fbbcc2bc82b95b0294b96336d7d264005c821c48551dcc8cee01ad0` / `9d4f7ecec8363ae4111538aa489383b3bcb4b5935afc5d93f78bf53b60229358`",
    ]),
    joinRow([
      "Packages / apps trees",
      "`9a1646f73dc4e75e6f1462c15e524e943e5b526a` / `673f7ae53d54a66ca6cc93f8a602413547c062ef`",
    ]),
    joinRow([
      "Generated context",
      "1,010 bytes / `c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4` / mtime ns `1785245807954176300`",
    ]),
    joinRow(["Mutation journal / Bun processes", "Absent / 0"]),
    joinRow([
      "Authority-state inputs",
      "SPEC-001 1,145,520 bytes / `889a56679cac7f4a884e88103f9316be52ad7e34c9422ed8c7940288db9709f5`; proposed commission 7,065 bytes / `578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195`; effective register 120,174 bytes / `d9f4c0224c0f419e5bfe84e4989261b478fa7cbcce7759a819cc12398228e3a5`",
    ]),
    joinRow([
      "Authority-state classifications",
      "SPEC-001 Draft/HYPOTHESIS/not-ratified `TRUE`; commission Proposed/non-conferring `TRUE`; effective register contains SPEC-001 `FALSE`",
    ]),
    joinRow([
      "`JanumiCode/janumiprofessionalworkbench/apps/rph-demo/e2e/pwa-node-graph.e2e.ts`",
      "`.M`",
      "2,970 / `e301f438aea48ad7bfbeef717979fa83c566c3a3956c17c819abaf0ab8366fc8`",
      "817 / `9c64df496cc634a26d9037738a52ff63fa6d254e4e351b8fba937ca6e12f00a4`",
      "0 / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`",
    ]),
    joinRow([
      "`JanumiCode/janumiprofessionalworkbench/apps/rph-demo/src/lib/PwuTypeCard.svelte`",
      "`.M`",
      "8,020 / `8b7487e3cc98d9e44543b259e098b46289e5ae1f9adda039dfe6404b51661704`",
      "2,237 / `c68cca158887275d0a19b86e311bb5273bdfb9e2f4b7612a5267cb9dd2588207`",
      "0 / `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`",
    ]),
  ];
  for (const row of requiredSubjectRows) {
    requireUniqueLine(row, `subject row ${row}`);
  }

  const arithmeticRows = [
    "| `JAN-CSAA-001` | 558 | 482 | 76 | 16 | 3 |",
    "| `JAN-CSAA-002` | 822 | 793 | 29 | 13 | 3 |",
    "| `JAN-CSAA-005` | 495 | 458 | 37 | 15 | 5 |",
  ];
  for (const expectedLine of arithmeticRows) {
    requireUniqueLine(expectedLine, `arithmetic row ${expectedLine}`);
  }

  const assertExactTableRows = (startPrefix, endPrefix, expectedRows, label) => {
    const start = heading(lines, startPrefix);
    const end = heading(lines, endPrefix);
    const actualRows = lines
      .slice(start + 1, end)
      .filter((line) => line.startsWith("|") && line.endsWith("|"));
    assert(
      JSON.stringify(actualRows) === JSON.stringify(expectedRows),
      `closure record ${label} exact table-row set/order mismatch`,
    );
  };
  const preimageRows = Object.entries(specifications).map(([id, spec]) =>
    joinRow([
      `\`JAN-CSAA-${id}-LEDGER-001@0.3.0 / OPEN\``,
      spec.sourceBytes.toLocaleString("en-US"),
      `\`${spec.sourceSha}\``,
      `\`archive/${spec.archive}\``,
    ]),
  );
  const postimageRows = Object.entries(specifications).map(([id, spec]) =>
    joinRow([
      `\`JAN-CSAA-${id}-LEDGER-001@0.3.1\``,
      `\`${spec.file}\``,
      outputs[id].length.toLocaleString("en-US"),
      `\`${sha(outputs[id])}\``,
    ]),
  );
  const evidenceRows = evidenceSpecifications.map(([name, bytes, digest]) =>
    joinRow([
      `\`${name}\``,
      bytes.toLocaleString("en-US"),
      `\`${digest}\``,
    ]),
  );
  assertExactTableRows(
    "## 1.",
    "## 2.",
    [
      "| Ledger preimage | Bytes | SHA-256 | Preserved archive |",
      "| --- | ---: | --- | --- |",
      ...preimageRows,
    ],
    "preimage",
  );
  assertExactTableRows(
    "## 2.",
    "## 3.",
    [
      "| Predicate | Exact result |",
      "| --- | --- |",
      ...requiredSubjectRows.slice(0, 11),
      "| Repository-root-relative path | Status | Content bytes / SHA-256 | Normalized unstaged diff bytes / SHA-256 | Staged diff bytes / SHA-256 |",
      "| --- | --- | --- | --- | --- |",
      ...requiredSubjectRows.slice(11),
    ],
    "current-subject",
  );
  assertExactTableRows(
    "## 3.",
    "## 4.",
    [
      "| Evidence | Bytes | SHA-256 |",
      "| --- | ---: | --- |",
      ...evidenceRows,
    ],
    "evidence",
  );
  assertExactTableRows(
    "## 4.",
    "## 5.",
    [
      "| Closed ledger | Path | Bytes | SHA-256 |",
      "| --- | --- | ---: | --- |",
      ...postimageRows,
      "| Member | Total rows | Applicable `IMPLEMENTED / PASSED` | Noncurrent explicit non-passes | Current methods passed | Future methods non-pass |",
      "| --- | ---: | ---: | ---: | ---: | ---: |",
      ...arithmeticRows,
    ],
    "postimage and arithmetic",
  );
  assert(
    text.includes(
      "All evidence identities were checked after acquiring the closure lock and before the write.",
    ) &&
      text.includes(
        "No application source, test, configuration, dependency, provider, fixture, oracle, gate, topology, register, staging area, or commit was changed by this transaction.",
      ),
    "closure-record bounded-disposition text mismatch",
  );
}

verifyEvidenceIdentities();

const originals = {};
const outputs = {};
for (const [id, spec] of Object.entries(specifications)) {
  const ledgerPath = path.join(recordsDir, spec.file);
  const current = fs.readFileSync(ledgerPath);
  originals[id] = current;
  if (mode === "validate") {
    const lines = normalizeInput(current, `${id} closed ledger`);
    validateClosed(id, lines);
    outputs[id] = current;
  } else {
    assert(current.length === spec.sourceBytes, `${id} source byte mismatch`);
    assert(sha(current) === spec.sourceSha, `${id} source digest mismatch`);
    const lines = normalizeInput(current, `${id} source ledger`);
    const transformed =
      id === "001"
        ? transform001(lines)
        : id === "002"
          ? transform002(lines)
          : transform005(lines);
    validateClosed(id, transformed);
    outputs[id] = encodeLines(transformed);
  }
  exactFileIdentity(spec.mainFile, spec.mainBytes, spec.mainSha, `${id} main`);
}

let closureRecordBytes = null;
if (mode === "apply") {
  const lockPath = path.join(recordsDir, ".csaa-wave1-ledger-closure.lock");
  const closureRecordPath = path.join(recordsDir, closureRecordName);
  let lockHandle;
  let lockAcquired = false;
  let recordWriteAttempted = false;
  const ledgerWriteAttempts = [];
  try {
    lockHandle = fs.openSync(lockPath, "wx");
    lockAcquired = true;
    assert(!fs.existsSync(closureRecordPath), `${closureRecordName} already exists`);
    for (const [id, spec] of Object.entries(specifications)) {
      exactFileIdentity(
        path.join(archiveDir, spec.archive),
        spec.sourceBytes,
        spec.sourceSha,
        `${id} archive`,
      );
    }
    verifyEvidenceIdentities();
    const freshnessText = execFileSync(
      process.execPath,
      [path.join(recordsDir, ".csaa-current-subject-check.mjs")],
      { cwd: recordsDir, encoding: "utf8", windowsHide: true },
    );
    const freshness = JSON.parse(freshnessText);
    assert(
      freshness.result === "PASS" && freshness.pairEquality === true,
      "Immediate closure freshness preflight did not pass",
    );
    for (const [id, spec] of Object.entries(specifications)) {
      const live = fs.readFileSync(path.join(recordsDir, spec.file));
      assert(live.equals(originals[id]), `${id} live preimage changed before write`);
      assert(live.length === spec.sourceBytes && sha(live) === spec.sourceSha, `${id} CAS failed`);
    }
    closureRecordBytes = buildClosureRecord(outputs, freshness);

    for (const [id, spec] of Object.entries(specifications)) {
      ledgerWriteAttempts.push(id);
      fs.writeFileSync(path.join(recordsDir, spec.file), outputs[id]);
    }
    recordWriteAttempted = true;
    fs.writeFileSync(closureRecordPath, closureRecordBytes);

    for (const [id, spec] of Object.entries(specifications)) {
      const ledgerPath = path.join(recordsDir, spec.file);
      const actual = fs.readFileSync(ledgerPath);
      assert(actual.equals(outputs[id]), `${id} post-write byte mismatch`);
      validateClosed(id, normalizeInput(actual, `${id} post-write ledger`));
      exactFileIdentity(spec.mainFile, spec.mainBytes, spec.mainSha, `${id} post-write main`);
    }
    const recordActual = fs.readFileSync(closureRecordPath);
    assert(recordActual.equals(closureRecordBytes), "closure record post-write mismatch");
    validateClosureRecord(recordActual, outputs);
    verifyEvidenceIdentities();
  } catch (error) {
    if (lockAcquired) {
      for (const id of ledgerWriteAttempts) {
        const spec = specifications[id];
        const ledgerPath = path.join(recordsDir, spec.file);
        if (fs.existsSync(ledgerPath) && !fs.readFileSync(ledgerPath).equals(originals[id])) {
          fs.writeFileSync(ledgerPath, originals[id]);
        }
      }
      if (recordWriteAttempted && fs.existsSync(closureRecordPath)) {
        fs.unlinkSync(closureRecordPath);
      }
    }
    throw new Error(
      lockAcquired
        ? `Synchronized closure failed and was rolled back: ${error.message}`
        : `Synchronized closure did not acquire its lock and made no changes: ${error.message}`,
    );
  } finally {
    if (lockAcquired) {
      if (lockHandle !== undefined) fs.closeSync(lockHandle);
      if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    }
  }
} else if (mode === "validate") {
  const closureRecordPath = path.join(recordsDir, closureRecordName);
  assert(fs.existsSync(closureRecordPath), `${closureRecordName} is absent`);
  closureRecordBytes = fs.readFileSync(closureRecordPath);
  validateClosureRecord(closureRecordBytes, outputs);
}

for (const [id, value] of Object.entries(outputs)) {
  console.log(`${id}\t${mode}\t${value.length}\t${sha(value)}`);
}
if (closureRecordBytes) {
  console.log(`closure-record\t${mode}\t${closureRecordBytes.length}\t${sha(closureRecordBytes)}`);
}
