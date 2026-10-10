import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { byFrequency, countWords, formatTop, parseStopWords, topWords, words } from '../../src/count.js';

describe('words', () => {
	test('a word is a maximal run of letters, digits or apostrophes', () => {
		assert.deepEqual(words("it's 4 o'clock, rock'n'roll; x2-y3!"), ["it's", '4', "o'clock", "rock'n'roll", 'x2', 'y3']);
		assert.deepEqual(words('don’t stop'), ['don’t', 'stop']);
	});

	test('Unicode letters are letters', () => {
		assert.deepEqual(words('café naïve straße мир'), ['café', 'naïve', 'straße', 'мир']);
	});

	test('folds to lower case by default, and keeps case when asked', () => {
		assert.deepEqual(words('The THE the'), ['the', 'the', 'the']);
		assert.deepEqual(words('The THE the', { caseSensitive: true }), ['The', 'THE', 'the']);
	});

	test('no words in text with none', () => {
		assert.deepEqual(words(''), []);
		assert.deepEqual(words(' ,.;-! '), []);
	});
});

describe('parseStopWords', () => {
	test('one word per line, trimmed, blank lines skipped, folded by default', () => {
		assert.deepEqual([...parseStopWords('The\r\n  and \n\nOF\n')], ['the', 'and', 'of']);
	});

	test('kept as written when case-sensitive', () => {
		assert.deepEqual([...parseStopWords('The\nand\n', { caseSensitive: true })], ['The', 'and']);
	});
});

describe('countWords', () => {
	test('counts each word', () => {
		assert.deepEqual([...countWords('a b a c a b')], [
			['a', 3],
			['b', 2],
			['c', 1]
		]);
	});

	test('counts after folding by default, as written when case-sensitive', () => {
		assert.deepEqual([...countWords('Go go GO')], [['go', 3]]);
		assert.deepEqual([...countWords('Go go GO', { caseSensitive: true })], [
			['Go', 1],
			['go', 1],
			['GO', 1]
		]);
	});

	test('leaves out stop words', () => {
		assert.deepEqual([...countWords('the cat and the dog', { stopWords: new Set(['the', 'and']) })], [
			['cat', 1],
			['dog', 1]
		]);
	});
});

describe('byFrequency', () => {
	test('more frequent first', () => {
		assert.ok(byFrequency(['b', 5], ['a', 2]) < 0);
		assert.ok(byFrequency(['a', 2], ['b', 5]) > 0);
	});

	test('a tie goes to the word, ascending', () => {
		assert.equal(byFrequency(['apple', 2], ['banana', 2]), -1);
		assert.equal(byFrequency(['banana', 2], ['apple', 2]), 1);
		assert.equal(byFrequency(['same', 2], ['same', 2]), 0);
	});
});

describe('topWords and formatTop', () => {
	const counts = new Map([
		['delta', 1],
		['alpha', 3],
		['charlie', 2],
		['bravo', 2],
		['echo', 1]
	]);

	test('the n most frequent, ties ascending', () => {
		assert.deepEqual(topWords(counts, 3), [
			['alpha', 3],
			['bravo', 2],
			['charlie', 2]
		]);
		assert.deepEqual(topWords(counts, 1), [['alpha', 3]]);
	});

	test('all of them when n is larger than the count', () => {
		assert.deepEqual(
			topWords(counts, 10).map(([word]) => word),
			['alpha', 'bravo', 'charlie', 'delta', 'echo']
		);
	});

	test('one "<count> <word>" line each', () => {
		assert.equal(formatTop([['alpha', 3], ['bravo', 2]]), '3 alpha\n2 bravo\n');
		assert.equal(formatTop([]), '');
	});
});
