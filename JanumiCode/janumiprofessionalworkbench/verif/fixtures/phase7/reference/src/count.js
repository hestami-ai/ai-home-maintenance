// Words, their counts, and the order they are printed in.

/**
 * A word: a maximal run of letters (any script), decimal digits, or apostrophes. Both apostrophe characters count:
 * U+0027 and U+2019, the typographic one UTF-8 text often carries.
 */
const WORD = /[\p{L}\p{Nd}'’]+/gu;

/** Every word in `text`, in order, folded to lower case unless `caseSensitive`. */
export function words(text, { caseSensitive = false } = {}) {
	const found = text.match(WORD) ?? [];
	return caseSensitive ? found : found.map((word) => word.toLowerCase());
}

/** The stop words in a file's text: one per line, trimmed, blank lines skipped, folded unless `caseSensitive`. */
export function parseStopWords(text, { caseSensitive = false } = {}) {
	const stopWords = new Set();
	for (const line of text.split(/\r?\n/)) {
		const word = line.trim();
		if (word !== '') stopWords.add(caseSensitive ? word : word.toLowerCase());
	}
	return stopWords;
}

/** How often each word occurs in `text`, leaving out `stopWords`. */
export function countWords(text, { caseSensitive = false, stopWords = new Set() } = {}) {
	const counts = new Map();
	for (const word of words(text, { caseSensitive })) {
		if (stopWords.has(word)) continue;
		counts.set(word, (counts.get(word) ?? 0) + 1);
	}
	return counts;
}

/** Most frequent first; a tie is broken by the word, ascending (JavaScript's code-unit order). */
export function byFrequency([wordA, countA], [wordB, countB]) {
	if (countA !== countB) return countB - countA;
	if (wordA < wordB) return -1;
	if (wordA > wordB) return 1;
	return 0;
}

/** The `n` most frequent entries of `counts`, in print order. */
export function topWords(counts, n) {
	return [...counts].sort(byFrequency).slice(0, n);
}

/** One line per entry: "<count> <word>". */
export function formatTop(top) {
	return top.map(([word, count]) => `${count} ${word}\n`).join('');
}
