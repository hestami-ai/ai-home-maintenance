// ⭐ `JAN-EXEC` Phase 7, P7-4 — THE `node:test` REPORTER THE P7-4 TOOLS RUN A WORKSPACE'S SUITES WITH (`node-tests.ts`).
//
// One line per finished TEST — never per suite, whose pass or fail only repeats its children's — marked so a line the
// tests themselves print cannot be mistaken for one: `jpwb-phase7:{"outcome":"pass"|"fail",...}`. Everything else node
// reports (diagnostics, the summary, a test file's own output) is dropped: the tools need which tests passed, and the
// process's exit code, and nothing between.
//
// ⚠ A FILE THAT FAILS TO LOAD IS REPORTED AS ONE FAILED TEST NAMED FOR THE FILE (node does that, and so a syntax error
// or a throw at module load is a failure here, not an absence). A skipped or todo test is reported with its flag, and
// counted as neither passed nor failed (`node-tests.ts`).
const MARK = 'jpwb-phase7:';

export default async function* phase7Reporter(source) {
	for await (const event of source) {
		if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
		const data = event.data;
		if (data.details?.type === 'suite') continue;
		yield `${MARK}${JSON.stringify({
			outcome: event.type === 'test:pass' ? 'pass' : 'fail',
			file: data.file ?? null,
			name: data.name,
			skip: Boolean(data.skip),
			todo: Boolean(data.todo)
		})}\n`;
	}
}
