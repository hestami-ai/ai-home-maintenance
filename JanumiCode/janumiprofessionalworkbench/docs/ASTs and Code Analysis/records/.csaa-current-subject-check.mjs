import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const recordsDir = path.dirname(fileURLToPath(import.meta.url));

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const exactDocumentationInputs = [
  [
    path.join(recordsDir, "..", "JAN-CSAA-001 - Codebase Semantic Analysis and Assurance Architecture.md"),
    109420,
    "cda7defe7fa310f912bceb8b355952e1159bebc05528fc51c310578ede26237b",
  ],
  [
    path.join(recordsDir, "JAN-CSAA-001 - Requirement Ledger.md"),
    352801,
    "55a476a2683ec65baa898b4b9425aecd3b6af17cd3c09aa2b8b59b3942e42e1a",
  ],
  [
    path.join(recordsDir, "..", "JAN-CSAA-002 - TypeScript Semantic Model and Invariant Catalog.md"),
    162179,
    "9bcaa9f9a2212d66ae7c417af84c4f0e14672d282c04e73d719f7f9cceda1911",
  ],
  [
    path.join(recordsDir, "JAN-CSAA-002 - Requirement Ledger.md"),
    250049,
    "dd2a08970c927ddb26ef522c7fc405f7210da13e35e32405486da26009a52acc",
  ],
  [
    path.join(
      recordsDir,
      "..",
      "JAN-CSAA-005 - JPWB TypeScript Repository Semantic Inventory and Conformance Mapping.md",
    ),
    119118,
    "3a9f49a492ca0b73cb50413bf694cf90e0608d73d6248db9df7cb45804b80625",
  ],
  [
    path.join(recordsDir, "JAN-CSAA-005 - Requirement Ledger.md"),
    459849,
    "86940e63fc011ae58a460bb4f403d79763e8e8722edd5bfeeb75c6cb6597d3b4",
  ],
  [
    path.join(recordsDir, "JAN-CSAA - External Repository Drift Non-Blocking Authoring Direction.md"),
    5153,
    "3760646744063eae3f678b84961e4d0e3778ec0fabd2e7b45765cb7530df5aae",
  ],
  [
    path.join(
      recordsDir,
      "JAN-CSAA-005 - Non-Blocking External Drift and Authoring Baseline Record.md",
    ),
    6952,
    "d2cba1614aea77a720cac597ed9f6faeda266a854022b6f3c1fa956dae869532",
  ],
];

function capture() {
  const start = new Date().toISOString();
  const files = exactDocumentationInputs.map(([file, expectedBytes, expectedSha]) => {
    const bytes = fs.readFileSync(file);
    const actual = {
      path: path.relative(recordsDir, file).replaceAll("\\", "/"),
      bytes: bytes.length,
      sha: digest(bytes),
    };
    assert(actual.bytes === expectedBytes, `${actual.path} byte mismatch`);
    assert(actual.sha === expectedSha, `${actual.path} digest mismatch`);
    return actual;
  });
  const closureRecordAbsent = !fs.existsSync(
    path.join(recordsDir, "JAN-CSAA-W1 - Synchronized Ledger Closure and Integrity Record.md"),
  );
  assert(closureRecordAbsent, "closure record already exists");
  const completion = new Date().toISOString();
  return {
    start,
    completion,
    files,
    closureRecordAbsent,
  };
}

function stableProjection(value) {
  const { start: _start, completion: _completion, ...stable } = value;
  return stable;
}

const first = capture();
const second = capture();
assert(
  JSON.stringify(stableProjection(first)) === JSON.stringify(stableProjection(second)),
  "paired documentation-directory captures do not match",
);

const datedBaseline = {
  branch: "main",
  head: "49b69fb7b78efa180fa19f3f2f24b8de749c3857",
  perimeter: {
    records: 19,
    bytes: 1005,
    sha: "74bfdc46ebddddc7a4cafa12584e76f92faa6489feaf1078ac2772871182b390",
  },
  status: {
    records: 2,
    bytes: 385,
    sha: "d09d0ef72e64cc445a2b3e23a6c7082382e2a05df0bd106c6de90f47df183374",
  },
  tracked: {
    records: 541,
    bytes: 75641,
    sha: "8b8c4e1d6dee18da4c5814725e69b42b2b8a002a5405b5fea7348ef8edd39a9a",
  },
  dirty: [
    {
      path: "JanumiCode/janumiprofessionalworkbench/apps/rph-demo/e2e/pwa-node-graph.e2e.ts",
      kind: "tracked",
      status: ".M",
      contentBytes: 2970,
      contentSha: "e301f438aea48ad7bfbeef717979fa83c566c3a3956c17c819abaf0ab8366fc8",
      unstagedBytes: 817,
      unstagedSha: "9c64df496cc634a26d9037738a52ff63fa6d254e4e351b8fba937ca6e12f00a4",
      stagedBytes: 0,
      stagedSha: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      path: "JanumiCode/janumiprofessionalworkbench/apps/rph-demo/src/lib/PwuTypeCard.svelte",
      kind: "tracked",
      status: ".M",
      contentBytes: 8020,
      contentSha: "8b7487e3cc98d9e44543b259e098b46289e5ae1f9adda039dfe6404b51661704",
      unstagedBytes: 2237,
      unstagedSha: "c68cca158887275d0a19b86e311bb5273bdfb9e2f4b7612a5267cb9dd2588207",
      stagedBytes: 0,
      stagedSha: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
  ],
  dirtyManifest: {
    records: 2,
    bytes: 594,
    sha: "4c1ac0e964882ab53898eaef176beefc252154ee13700588fb1a42ddc5488aac",
  },
  packageSha: "ce83e2619fbbcc2bc82b95b0294b96336d7d264005c821c48551dcc8cee01ad0",
  lockSha: "9d4f7ecec8363ae4111538aa489383b3bcb4b5935afc5d93f78bf53b60229358",
  packagesTree: "9a1646f73dc4e75e6f1462c15e524e943e5b526a",
  appsTree: "673f7ae53d54a66ca6cc93f8a602413547c062ef",
  generated: {
    bytes: 1010,
    sha: "c01d35eee60b3cb21e230c392c72c947234d7f406b83959a042a63e09db454c4",
    mtimeNs: "1785245807954176300",
  },
  mutationJournalAbsent: true,
  bunProcesses: 0,
  addedAuthorityFiles: {
    spec: {
      bytes: 1145520,
      sha: "889a56679cac7f4a884e88103f9316be52ad7e34c9422ed8c7940288db9709f5",
    },
    commission: {
      bytes: 7065,
      sha: "578549db9b2503244ea36d70b4a670106a4c822d27638e487cb31d0bb39b6195",
    },
    register: {
      bytes: 120174,
      sha: "d9f4c0224c0f419e5bfe84e4989261b478fa7cbcce7759a819cc12398228e3a5",
    },
    specDraft: true,
    specHypothesis: true,
    specNotRatified: true,
    commissionProposed: true,
    commissionConfersNothing: true,
    registerHasSpec001: false,
  },
};

console.log(
  JSON.stringify(
    {
      checkId: "JAN-CSAA-DOCUMENT-CLOSURE-FRESHNESS-001",
      scope: "docs/ASTs and Code Analysis/** only",
      liveGitChecked: false,
      direction: "JAN-CSAA-STANDING-DIRECTION-003@0.1.0",
      baselineEvidence: "JAN-CSAA-005-EVIDENCE-007@0.1.0",
      controllingEvidence: "JAN-CSAA-005-EVIDENCE-008@0.1.0",
      firstStart: first.start,
      firstCompletion: first.completion,
      secondStart: second.start,
      secondCompletion: second.completion,
      pairEquality: true,
      result: "PASS",
      documentationInputs: second.files,
      subject: datedBaseline,
    },
    null,
    2,
  ),
);
