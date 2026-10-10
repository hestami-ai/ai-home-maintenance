wordfreq is a command-line tool for Node.js 20 or later, with no dependencies. Usage: node bin/wordfreq.js [options] [file]
- It reads UTF-8 text from file, or from standard input when no file is given or the file is "-".
- A word is a maximal run of letters, digits or apostrophes (Unicode letters included). Words are folded to lower case unless --case-sensitive is given.
- It prints the N most frequent words, one per line, as "<count> <word>", most frequent first; ties are broken by the word, ascending.
- Options: -n N or --top N, a positive integer, default 10; --case-sensitive; --stop-words FILE, a file of one word per line whose words are excluded (compared after case folding unless --case-sensitive); -h or --help prints usage to standard output and exits 0.
- Exit codes: 0 success; 1 the input file is missing or unreadable; 2 a usage error (an unknown option, or a bad N).
- Errors go to standard error, as one line beginning "wordfreq: ".
- Files: bin/wordfreq.js (the entry), src/*.js (ES modules; package.json has "type": "module"), test/unit/*.test.js and test/e2e/*.test.js run with node --test, and docs/requirements.md, docs/design.md and docs/verification.md.
