# wordfreq: requirements

Usage: `node bin/wordfreq.js [options] [file]`. Node.js 20 or later, no dependencies.

| Id | Requirement | Acceptance |
|---|---|---|
| R1 | Reads UTF-8 text from `file`, or from standard input when no file is given or the file is `-`. | The same text gives the same output from a file, from standard input, and from `-`. |
| R2 | A word is a maximal run of letters (any script), decimal digits, or apostrophes (U+0027 and U+2019). | `it's 4 o'clock` is three words; `café` is one. |
| R3 | Words are folded to lower case unless `--case-sensitive` is given. | `The THE the` counts `the` 3 times; case-sensitive, three words once each. |
| R4 | Prints the N most frequent words, one per line, as `<count> <word>`, most frequent first; a tie goes to the word, ascending (code-unit order). | `pear fig apple fig apple pear` prints `apple`, `fig`, `pear`. |
| R5 | `-n N` or `--top N` sets N, a positive integer; the default is 10. | 13 distinct words print 10 lines; `-n 3` prints 3. |
| R6 | `--stop-words FILE` excludes the words in FILE, one per line, compared after folding unless `--case-sensitive`. | A stop word `The` excludes `the`, `The` and `THE`; case-sensitive, only `The`. |
| R7 | `-h` or `--help` prints usage to standard output and exits 0, wherever it appears before `--`. | `--help` exits 0 with the usage on standard output. |
| R8 | Exit codes: 0 success; 1 the input or stop-word file is missing or unreadable; 2 a usage error (an unknown option, a bad N, a missing option value, a second file). | `--bogus` exits 2; a missing file exits 1. |
| R9 | An error is one line on standard error, beginning `wordfreq: `. | Every non-zero exit writes exactly one such line. |

Usage: `node bin/wordfreq.js [-n N | --top N] [--case-sensitive] [--stop-words FILE] [-h | --help] [file]`.
