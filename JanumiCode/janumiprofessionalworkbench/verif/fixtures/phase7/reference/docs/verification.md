# wordfreq: verification

Run: `node --test "test/unit/*.test.js" "test/e2e/*.test.js"` (the package's `npm test`).

| Requirement | Test | Result |
|---|---|---|
| R1 | e2e: reads a file; reads standard input when no file is given, and when the file is "-" | pass |
| R2 | e2e: reads Unicode letters as letters, and apostrophes as part of a word | pass |
| R3 | e2e: folds case by default, and keeps it with --case-sensitive | pass |
| R4 | e2e: breaks a tie by the word, ascending | pass |
| R5 | e2e: prints 10 words by default; prints N words with -n N and --top N | pass |
| R6 | e2e: excludes the stop words, compared after folding unless --case-sensitive | pass |
| R7 | e2e: -h and --help print usage to standard output and exit 0 | pass |
| R8 | e2e: an unknown option; a bad N; a missing file | pass |
| R9 | e2e: one line on standard error, for each error case | pass |

The end-to-end tests start `bin/wordfreq.js` with the Node.js that runs them (`process.execPath`), in a temporary directory.
