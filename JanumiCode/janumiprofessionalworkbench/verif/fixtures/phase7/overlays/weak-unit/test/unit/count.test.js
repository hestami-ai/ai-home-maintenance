// ⛔ A BROKEN FIXTURE (`verif/phase7-seeded-faults.test.ts`): unit tests too weak to see case folding. Every input is
// already lower case, and no stop-word line carries a space, so removing `toLowerCase()` or `trim()` from `src/count.js`
// changes nothing these tests can observe. As the only unit test file of its workspace copy, it is all the tool runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { byFrequency, countWords, formatTop, parseStopWords, topWords, words } from '../../src/count.js';

test('words', () => {
	assert.deepEqual(words('a b, c'), ['a', 'b', 'c']);
});

test('counts', () => {
	assert.deepEqual([...countWords('a b a')], [
		['a', 2],
		['b', 1]
	]);
});

test('stop words', () => {
	assert.deepEqual([...parseStopWords('a\nb\n')], ['a', 'b']);
});

test('order and format', () => {
	assert.ok(byFrequency(['a', 1], ['b', 2]) > 0);
	assert.equal(formatTop(topWords(new Map([['a', 1]]), 1)), '1 a\n');
});
