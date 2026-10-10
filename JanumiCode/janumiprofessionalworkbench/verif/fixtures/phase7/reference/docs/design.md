# wordfreq: design

| Module | Exports | Errors |
|---|---|---|
| `src/options.js` | `parseArgs(argv)`, `parseTop(option, value)`, `USAGE`, `DEFAULT_TOP`, `UsageError` | `UsageError` for an unknown option, a bad or missing N, a missing `--stop-words` file name, a second file |
| `src/count.js` | `words(text, {caseSensitive})`, `parseStopWords(text, {caseSensitive})`, `countWords(text, {caseSensitive, stopWords})`, `byFrequency(a, b)`, `topWords(counts, n)`, `formatTop(top)` | none |
| `src/cli.js` | `run(argv, io)` returning the exit code; `EXIT` | a usage error is written as `wordfreq: <message>` and returns 2; a file that cannot be read returns 1 |
| `bin/wordfreq.js` | the entry: hands `run` the process's streams and files, and sets the exit code | none of its own |

`io` is `{ readFile, readStdin, out, err }`, so the unit tests drive `run` without a process.

## Requirement to test

| Requirement | Unit tests | End-to-end tests |
|---|---|---|
| R1 | `cli.test.js`: reads the named file; standard input | reads a file; standard input and `-` |
| R2 | `count.test.js`: words | Unicode letters and apostrophes |
| R3 | `count.test.js`: folds; `cli.test.js`: folds case | folds case by default |
| R4 | `count.test.js`: byFrequency, topWords | ties ascending |
| R5 | `options.test.js`: parseTop, parseArgs | 10 by default; `-n` and `--top` |
| R6 | `count.test.js`: parseStopWords, countWords; `cli.test.js`: stop words | excludes the stop words |
| R7 | `options.test.js`: help wins; `cli.test.js`: help | `-h` and `--help` |
| R8 | `cli.test.js`: exit codes | unknown option; bad N; missing file |
| R9 | `cli.test.js`: one-line errors | one line on standard error |
