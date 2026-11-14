# Sonar cycle 6: the lead's record

These five files are the lead's working record of Sonar cycle 6, copied byte for byte on 2026-11-13 so that the cycle's
open work does not rest on a temporary folder (`docs/_working/ROADMAP-toolchain-and-sonar.md`, M0). They keep their
Windows line endings, and the hashes below are of these bytes. Paths inside them are absolute paths in the Sonar
worktree, `E:/Projects/hestami-sonar`.

| File | What it is | Tree | Findings | SHA-256 |
| --- | --- | --- | --- | --- |
| `triage-main.json` | The first sweep, before any fix | `5fad05f3` | 512 in 126 files | `6bfa07a5731ebc4225e2baf20da5cfab74a0c9825406311e325c657232e496c1` |
| `triage-merged-1.json` | A re-sweep taken during Tier A/B, before its commit `e31c2f8a` | Tier A/B in progress | 224 in 90 files | `9c0738ec4eafd40fe78857c77735e8d3ac5c6dcc544c49a9f2d9e71b32e2c1f8` |
| `triage-final.json` | The sweep after Tier C; each finding has its rule, file, line, message and tier | `a318be36` | 179 in 79 files | `74dde08f7c979062c4c73a950c4f7ace09d3eed2ecdead3b52fe87d81a73bd3d` |
| `classify-final.txt` | The classification of the findings still open after Tier C | `a318be36` | | `c480485553b0c5fc620668083fdf74321a2cf175731373b5fdd387b6510af965` |
| `refute-summary.txt` | The Tier D checkers' verdicts on the refused rule families | `a318be36` | | `32dc32ff3e16be3385010e714bbaf5be4424bacd0f853f1789ab687248ac6a06` |

Tier D (`e299baef`) then fixed 3 of the 179, which leaves 176. Of those, 24 are refused at their own sites (the roadmap's
X1) and 152 are the unfixed findings whose dispositions the roadmap's E0 records.
