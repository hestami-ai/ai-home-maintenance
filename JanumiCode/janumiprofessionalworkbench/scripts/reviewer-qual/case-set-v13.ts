// Package Y — case set v13 (design D37; REG-D-141 (4), REG-D-142), 2026-10-31.
// The 92 kept cases come directly from version twelve's own source, byte for byte.
// Only the recast pair gains D31 marks, computed by production from the frozen rerun manifests.
// The three additions are the pre-checked prototype's data. Its new world is frozen, never re-run.
import { readFileSync } from 'node:fs';
import type { DeliverableFile, HostSequenceAct, ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import { deliverableFiles } from '../../apps/rph-demo/src/lib/server/execution/deliverable-view.js';
import { CASE_SET_V12, V12_WORLDS, type RerunWorld, type World, type WorldAct, type WorkProductCaseV12, type ProcessResultCaseV12 } from './case-set-v12.js';
import { CASE_PRODUCER_MODEL_ID, CASE_PRODUCER_PROVIDER_ID, type CaseSet, type QualificationCase } from './cases.js';

export const RECAST_V13: Readonly<Record<string, string>> = {
 'W12-CSV-RERUN': 'W13-CSV-RERUN',
 'W12-CSV-RERUN-RR-07': 'W13-CSV-RERUN-RR-07'
};
export const NEW_V13: readonly string[] = ['W13-CSV-INHERITED', 'P13-CSV-NARROWED', 'P13-CSV-NARROWED-WHOLE'];
export const WORLDS_V13_FILE = 'scripts/reviewer-qual/case-set-v13-worlds.json';
export const V13_WORLDS = (JSON.parse(readFileSync(new URL('./case-set-v13-worlds.json', import.meta.url), 'utf8')) as {worlds: Readonly<Record<string, World>>}).worlds;
function oldWork(id: string): WorkProductCaseV12 {
 const c = CASE_SET_V12.cases.find(c => c.id === id);
 if (c?.arm !== 'WORK_PRODUCT') throw new Error('version twelve holds no work case ' + id);
 return c as WorkProductCaseV12;
}
const rw = V12_WORLDS.rerun as RerunWorld;
const baseline = new Map(rw.baselineHashes.map(([p,hash]) => [p,{hash}]));
const stepStart = new Map(rw.rerunOwnStart.map(([p,hash]) => [p,{hash}]));
const final = new Map(rw.finalManifest.map(([p,hash]) => [p,{hash,text:rw.files.find(f => f.path === p)?.content ?? ''}]));
export const MARKED_RERUN_FILES: readonly DeliverableFile[] = deliverableFiles(baseline, final, stepStart);
// ~~function recast(c: QualificationCase): QualificationCase~~ — 2026-10-31, package Y: the recast work input carries
// the product builder's deliverable, which cases.ts's narrower input omits; type it as V/V-2 did, without changing data.
function recast(c: QualificationCase): QualificationCase | WorkProductCaseV12 {
 const id = RECAST_V13[c.id];
 if (id === undefined) return c;
 const work = oldWork(c.id);
 return {...work, id, input:{...work.input,deliverable:{...work.input.deliverable,files:MARKED_RERUN_FILES}}} satisfies WorkProductCaseV12;
}
const inheritedSource = oldWork('W12-CSV-RR-08');
const inherited: WorkProductCaseV12 = {
 ...inheritedSource,
 id: 'W13-CSV-INHERITED',
 input: {...inheritedSource.input, answer:"{\"files\":[{\"path\":\"package.json\",\"change\":\"created\"},{\"path\":\"src/summarise.js\",\"change\":\"changed\"},{\"path\":\"test/fixtures/readings.csv\",\"change\":\"created\"},{\"path\":\"test/csv.test.js\",\"change\":\"created\"},{\"path\":\"test/summarise.test.js\",\"change\":\"created\"},{\"path\":\"test/cli.test.js\",\"change\":\"created\"},{\"path\":\"docs/test-report.md\",\"change\":\"created\"}],\"keptAsFound\":[\"src/csv.js\",\"bin/colsummary.js\"],\"testCommand\":\"node --test\",\"testResult\":\"14 tests, 14 passed on the last run; the first run failed 2 of 14, both on the unrounded mean, fixed in src/summarise.js\",\"coverage\":[{\"file\":\"test/csv.test.js\",\"tests\":4,\"covers\":[\"R2\"]},{\"file\":\"test/summarise.test.js\",\"tests\":6,\"covers\":[\"R1\",\"R3\",\"R4\",\"R6\"]},{\"file\":\"test/cli.test.js\",\"tests\":4,\"covers\":[\"R1\",\"R5\",\"R6\"]}],\"limitations\":[\"Tested with Node v24.11.1 on Windows only.\",\"A file is read whole into memory.\"],\"residualDefects\":[]}", rationale:{...inheritedSource.input.rationale!,rationale:"When this step began, the workspace already held the parser in src/csv.js, the statistics in src/summarise.js and the command in bin/colsummary.js, where the instruction puts them. I read each of them, and kept src/csv.js and bin/colsummary.js as I found them. I wrote package.json, declaring \"type\": \"module\" and the colsummary bin and no dependencies, and the three test files and their fixture. Each of R1–R6 has a test: R2 in test/csv.test.js; R1, R3, R4 and R6 in test/summarise.test.js; and R1, R5 and R6 through the command itself in test/cli.test.js, on the fixture test/fixtures/readings.csv. The first run of `node --test` failed two of its 14 tests, both on the mean, which src/summarise.js as I found it did not round, so I rewrote src/summarise.js to round the mean to two decimal places. With the files as they now stand, `node --test` passes all 14 tests on its last run. I wrote docs/test-report.md to record the command and that result."}}
};
const hostAct = (a:WorldAct): HostSequenceAct => a.kind === 'WRITE' ? {try:a.try,ordinal:a.ordinal,kind:'WRITE',path:a.path!} : {try:a.try,ordinal:a.ordinal,kind:'RUN',argv:a.argv!,exitCode:a.exitCode ?? null,timedOut:a.timedOut ?? false};
/** The same command builder shape as version twelve: the frozen act's own output and timings, never a new execution. */
function command(id:string,subjectId:string,capture:string,w:World,rationale:ProfessionalRationaleSummary):ProcessResultCaseV12 {
 const a = w.acts.find(a => a.ordinal === 12)!;
 return {
  id,arm:'PROCESS_RESULT',
  subject:{subjectId,objectType:'EVIDENCE',semanticVersion:1,isAiProduced:true,producer:{actorType:'AGENT',agentId:'execution.process-run:' + subjectId,modelId:CASE_PRODUCER_MODEL_ID,providerId:CASE_PRODUCER_PROVIDER_ID}},
  input:{
   producingPrompt:oldWork('W12-CSV-RR-03').input.producingPrompt,
   run:{ordinal:a.ordinal,argv:a.argv!,exitCode:a.exitCode ?? null,timedOut:false,durationMs:a.durationMs!,outputComplete:true,omittedRegions:[],retention:{retained:true,workspaceOwnerId:'colsummary',purgeability:'PURGEABLE_AT_EXPIRY',stdoutPath:'captures/' + capture + '/stdout.txt',stderrPath:'captures/' + capture + '/stderr.txt',omittedRegions:[],omissionsPath:'captures/' + capture + '/omissions.json'},stdout:a.stdout!,stderr:a.stderr!},
   rationale,
   observedToolCalls:{observation:'OBSERVED',calls:w.acts.map((a,i) => ({ordinal:i+1,nameProvenance:'MINTED_BY_HOST',toolName:a.kind === 'WRITE'?'write_file':'run_command',outcome:'COMPLETED'})),observedCount:w.acts.length,recordedLimit:32},
   hostSequence:{acts:w.acts.map(hostAct),droppedRuns:0,recordedLimit:32,subjectOrdinal:12}
  }
 };
}
const narrowed = command('P13-CSV-NARROWED','evd_01M6H7B2D4F6H8K0M2P4R6T8W0','8b3f5d21-4c7e-4a96-b2d8-6e1f9c0a3b57',V12_WORLDS.narrowed!,oldWork('W12-CSV-RR-03').input.rationale!);
const narrowedWhole = command('P13-CSV-NARROWED-WHOLE','evd_01M6H7B3E5G7J9M1P3S5V7X9Z1','d7e2a9c4-1b5f-4e38-9a6c-3f0b8d2e5c71',V13_WORLDS['narrowed-whole']!,{
	"rationale": "I wrote colsummary as the instruction lays it out: the RFC 4180 parser in src/csv.js, the statistics in src/summarise.js and the command in bin/colsummary.js, with package.json declaring \"type\": \"module\" and the colsummary bin and no dependencies. Each of R1–R6 has a test: R2 in test/csv.test.js; R1, R3, R4 and R6 in test/summarise.test.js; and R1, R5 and R6 through the command itself in test/cli.test.js, on the fixture test/fixtures/readings.csv. I ran the unit tests first: `node --test test/csv.test.js test/summarise.test.js` passes all 10 on its last run; its first run failed one, on the mean, which was not rounded, and src/summarise.js now rounds it to two decimal places. Then I ran the whole suite: `node --test` passes all 14 tests, the four command tests in test/cli.test.js among them. docs/test-report.md records that command and its result.",
	"assumptions": [
		"A column is found by an exact match of its name in the first row; if a name appears twice, the first such column is summarised.",
		"Spaces around a cell's text are ignored, so a cell holding only spaces is blank.",
		"A file that is not valid CSV, a quoted field never closed, exits 1 with a message, as a value that is not a number does."
	],
	"limitations": [
		"Tested with Node v24.11.1 on Windows only.",
		"A file is read whole into memory; files larger than a few megabytes were not tried."
	],
	"residualUncertainty": [
		"A quoted field holding a line break is parsed as one field, but no test covers it."
	]
});
export const CASE_SET_V13: CaseSet = {
 note:'GENERATED by bun run scripts/reviewer-qual/generate.ts from scripts/reviewer-qual/case-set-v13.ts — never hand-edited. Reviewer-qualification cases, version thirteen (package Y; design D37; REG-D-141 (4), REG-D-142): version twelve’s 94 in their order, 92 byte for byte, the rerun pair recast in place with production’s D31 per-file marks, then three new cases. The new narrowed-whole world was executed once on Node v24.11.1 and frozen in case-set-v13-worlds.json. Existing worlds stay in case-set-v12-worlds.json. No world is re-run. Oracles are versioned separately. This increment edits no reviewer prompt, criterion or scoring.',
 caseSetVersion:13,
 cases:[...CASE_SET_V12.cases.map(recast),inherited,narrowed,narrowedWhole]
};
