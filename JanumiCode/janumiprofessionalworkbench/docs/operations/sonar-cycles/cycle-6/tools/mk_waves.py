"""Generate JPWB Sonar cycle-6 workflow scripts with their batch embedded (replaces the lost mk-waves.cjs).

usage:
  mk_waves.py mech   <triage.json> <out_dir> <wave_name>            # tier AB findings, one edit-only agent per file
  mk_waves.py cx     <triage.json> <out_dir> <wave_name>            # tier C (S3776) findings, one agent per file
  mk_waves.py review <anchors.json> <out_dir> <wave_name> <jpwb_root> <rel> [<rel> ...]
                                                                    # adversarial equivalence review of HEAD->tree diffs
Each script embeds its batch as JSON (so the batch never passes through the orchestrator's context) and is split
into parts under BUDGET bytes, because a Workflow script is capped at 512 KB.
"""
import json
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BUDGET = 420_000

COMMON = """ABSOLUTE RULES
- EDIT ONLY. Use Read, Edit and Grep only. Do NOT run Bash or any command, do not spawn processes, do not run tests, tsc, prettier or sonar. All verification is done centrally afterwards.
- Work ONLY in the one file named above. It lives in the git worktree E:/Projects/hestami-sonar/. NEVER edit any file under E:/Projects/hestami-ai/ - that is a different checkout that another session is using for live work, and an edit there would corrupt it. When you Grep for context, search under E:/Projects/hestami-sonar/JanumiCode/janumiprofessionalworkbench only.
- The code is strict TypeScript (noUncheckedIndexedAccess) with lib and target ES2022.
- Every change MUST preserve EXACT runtime behaviour for every input and every path. If a change would or might alter behaviour, or you are not sure, SKIP that finding with needsManual: true and a precise reason. A correct skip is worth more than a plausible fix.
- Read the cited line and enough context (types, closures, call sites) BEFORE editing. Make the smallest correct change. Do not touch code unrelated to the findings, and do not reformat lines you do not change: formatting is done centrally, and whitespace churn breaks content-anchored instruments.
- MUTATION-LEDGER ANCHORS: every text listed under "Anchors" must remain BYTE-IDENTICAL (indentation and line breaks included) and must occur EXACTLY ONCE in the file after your edits. Do not edit inside an anchored text, do not re-indent it, do not move it to a different nesting depth, and do not copy or quote any part of it anywhere, not even in a comment: a second occurrence fails the exactly-once check. If a finding can only be fixed by changing an anchored text, SKIP it and name the anchor id in the reason.
- Sonar's message, quoted verbatim with each finding, is the authority on what the rule asks. Do not assume a rule means something its message does not say.
- If you refuse a finding because the fix would change behaviour (a principled won't-fix), write a one-line comment directly ABOVE the flagged line naming the rule id and the mechanism, in the file's existing style (for example: // S6582: kept explicit - the optional chain would evaluate sha256(bytes) when both sides are undefined), and say so in the skip reason. Do not write such comments for findings you simply did not attempt."""

TRAPS = r"""KNOWN TRAPS IN THIS REPOSITORY (each one broke a past cycle)
- S2871 (sort without a compare function): for strings use exactly (a, b) => Number(a > b) - Number(a < b). It reproduces the default UTF-16 order and is branchless. NEVER localeCompare (it changes the order and pinned hashes) and NEVER a nested-ternary comparator (it trips S3358). For numbers use (a, b) => a - b only when numeric order is clearly intended; otherwise SKIP.
- S6582 (prefer optional chaining): rewriting `X === undefined || X.p !== Y` (or `!X || X.p !== Y`) as `X?.p !== Y` is NOT equivalent when (1) Y can itself be undefined - `undefined !== undefined` is false, so the guard stops refusing; (2) the right-hand side can throw or has side effects (a hash or parse call) - the optional chain now evaluates it where the original short-circuited; (3) it makes a dereference eager by hoisting it out of an && chain. It is safe only when Y is a literal or enum constant, or is pinned by a ?? default. Decide by what the guard protects, never by the rule id; when in doubt SKIP. Likewise `a && a.b` -> `a?.b` differs when `a` can be a falsy non-nullish value (0, '', false, NaN): the original returns `a`, the optional chain returns undefined.
- S6551 (Object default stringification): cast the String() or template argument to the primitive type it holds (for example String(x as string)), preserving the coercion; never switch to JSON.stringify.
- S7778 (several push calls): merge consecutive pushes into one only when nothing between them reads the array and the element order is identical.
- S7765 (.includes over .some(x => x === v) or .indexOf): includes uses SameValueZero (NaN matches NaN) and reads array holes as undefined, while === never matches NaN and some/indexOf skip holes; apply only when the searched value cannot be NaN or undefined, or the array cannot have holes.
- S4043 (sort or reverse used as an expression): move the in-place sort/reverse into its own statement before the value is used, mutating exactly the array it mutated before. NEVER .toSorted or .toReversed (ES2023; the lib is ES2022).
- Anything that needs .findLast, .findLastIndex, .toSorted, .toReversed, .toSpliced or .with: ES2023 APIs, and the lib is ES2022 - SKIP with needsManual: false and reason "ES2023 API; lib is ES2022", without adding a comment.
- S7750 (.find over .filter(...)[0]): find visits array holes, filter skips them; apply only when the array cannot have holes.
- S7758: codePointAt over charCodeAt - refuse in code-unit comparators, surrogate-pair handling or code-unit cursors; apply only when the comparison is against a fixed BMP constant. fromCodePoint over fromCharCode - fromCharCode truncates its argument to 16 bits, fromCodePoint throws on non-integers and values above 0x10FFFF; apply only when every argument is an integer in 0..0xFFFF.
- S7781 (replaceAll): `.replace(/x/g, y)` -> `.replaceAll('x', y)` only when the pattern is a plain global literal with no special regex characters and y has no `$` patterns; `.split(s).join(r)` -> `.replaceAll(s, r)` only when s is a NON-EMPTY string literal.
- S4624 (nested template literals): lift the inner template into a const ONLY when the original evaluates it unconditionally; if it sits in a ternary arm, an && / || / ?? operand or a callback, move it into a local inside that same branch or into a small helper, so it is still evaluated only on that path. The resulting string must be byte-identical.
- S3358 (nested ternary): rewrite as an if/else assignment, an early return or a small helper, keeping each arm lazily evaluated and the result identical for every input.
- S7780 (String.raw): convert only when the literal's ONLY escapes are `\\`, it contains no backtick and no `${`, EVERY character of it is ASCII, and the resulting string is byte-identical. Never inside a mutation-ledger payload and never inside an anchored text. (Measured 2026-11-12: under Bun 1.3.14, which runs this repository's tools, String.raw returns the non-ASCII characters of its raw text as \uXXXX escapes - String.raw`Läbel` written with a real a-umlaut reads back as Läbel - so a conversion that is identical by the language specification changed a reviewer-qualification witness and moved the pinned reviewer fingerprint.)
- S3735 (void operator): `return void expr;` -> `expr; return;` (add braces to a braceless if) and `=> void expr` -> `=> { expr; }` are identical (both yield undefined) - apply. A standalone `void _name;` statement marks a compile-time assertion constant as used - keep it (SKIP, needsManual: false).
- S6353 (concise character classes): `[0-9]` -> `\d` is always identical in JavaScript; `[A-Za-z0-9_]` -> `\w` is identical unless the regex carries both the i flag and the u or v flag - then SKIP.
- S7755 (.at over [length - k]): apply only when k is a positive integer constant (a variable k can be 0, and .at(-0) reads the FIRST element).
- S6644 (conditional default assignment): `a ? a : b` -> `a || b` only when `a` is a plain variable or property read with no side effects (it is now evaluated once instead of twice).
- S7776 (array used for membership -> Set): only when the array is local to this file and used only for membership checks; never change an exported constant's type.
- S107 (too many parameters): only when the function is not exported and every call site is in this file; otherwise SKIP.
- S7747 (spread before for...of): if the loop body adds to or deletes from the collection it iterates, the spread is a deliberate snapshot - SKIP.
- S3863 (module imported more than once): merge into one import with inline `type` modifiers, keeping every imported name and leaving side-effect-only imports alone.
- S7718 (catch parameter name): rename only when the new name is not already in use in that scope.
- S1874 (deprecated API): replace only with a documented exact equivalent; otherwise SKIP.
- S6594 (RegExp.exec over String.match): only for a NON-global regex.
- S8786 or S5843 (super-linear or over-complex regex): change only if you can show the match result is identical for every input; otherwise SKIP.
- Object-literal dispatch: never replace an if/else chain with a bare object literal keyed by an EXTERNAL string (`__proto__`, `constructor`, `toString` resolve on Object.prototype); use a Map and .get().
- A file whose header says it is generated: do not edit it (its generator is fixed instead) - SKIP with that reason.
- ANY OTHER RULE: apply the standard fix the message asks for when it is provably behaviour-identical; otherwise SKIP with the reason."""

MECH_GUIDE = "You are fixing SonarQube findings in ONE TypeScript or JavaScript file of the Janumi Professional Workbench (JPWB), a Bun + Turborepo monorepo.\n\n" + COMMON + "\n\n" + TRAPS + "\n\nFor each finding either APPLY it (record rule, line and a short note of the change) or SKIP it (rule, line, reason, needsManual)."

CX_GUIDE = "You are reducing SonarQube S3776 Cognitive Complexity of the cited function(s) in ONE file of the Janumi Professional Workbench (JPWB) to at most 15 each, WITHOUT changing runtime behaviour in any way. This is a structural refactor, not a rewrite.\n\n" + COMMON + "\n\n" + TRAPS + """

HOW TO REDUCE COGNITIVE COMPLEXITY
1. Extract self-contained blocks (a loop body, a validation block, one branch's work) into named helpers. Nesting is what is scored, and a helper starts again at nesting 0, so moving nested logic out is the highest-leverage move.
2. Guard clauses and early returns that remove a nesting level - only where no else-branch, trailing statement or cleanup is skipped.
3. Extract a well-named predicate for a complex boolean condition.
4. Replace a long if/else ladder only with a Map lookup or per-arm helpers whose behaviour is identical (never a bare object literal keyed by an external string).

EXTRACTION MOVES COMPLEXITY; IT DOES NOT REMOVE IT. Count each new helper yourself: every function you create or change must end at 15 or below. A helper that collects N conditional spreads `...(p.x !== undefined ? { x } : {})` is as complex as the original - use a loop over a typed field list instead. Avoid introducing S107 (more than 7 parameters - pass one context object), S7778 (consecutive pushes), S4323 (the same union type written repeatedly - declare a type alias), S3358 (nested ternary), S7721 (move a helper that captures nothing to module scope) and S3699 (keep the file's `return fail(...)` idiom; do not turn it into an assignment).

DANGER CHECKLIST - verify every extraction preserves ALL of these, or do it differently, or SKIP:
- shortCircuit: no && / || / ?. operand is evaluated more, less or earlier than before; never hoist a dereference out of a short-circuit chain (it becomes eager).
- evalOrder: side-effecting expressions still run in the same order.
- earlyReturn: a new guard clause does not skip an else-branch, a trailing statement, a mutation or a cleanup that used to run.
- returnValue: every path returns the identical value, type and shape (undefined vs missing, [] vs undefined, -0, NaN).
- closure and this: a helper reads and writes the SAME variables; a write to a captured variable must be preserved (thread state through an object passed by reference, or return the value and assign it); preserve `this`.
- throwTiming: the same throw points and error messages; try/catch/finally boundaries unchanged.
- loopSemantics: `continue` in an extracted per-iteration helper becomes `return`; a `break` or an outer `return` cannot be extracted naively - keep those in the loop. ts.forEachChild stops when its callback returns a truthy value, so extracted callbacks need a block body.
- asyncAwait: no added or removed await; the same order; no accidental parallelism.
- mutationAliasing: in-place mutations act on the same instances.
- typeNarrowing: narrowing that later code relies on is still established - an extracted inline guard loses its narrowing unless the helper's signature carries it (a `value is T` predicate); widening a parameter type can silently drop a brand.
- a function typed `never` that is now called from a helper whose caller continues: make sure the refusal still stops the caller.
- MUTATION ANCHORS: besides staying byte-identical and unique, an anchored block must stay where its declared mutation still makes sense: keep it at its exact nesting depth, and keep every variable and function its code refers to in scope at that same place. Extract the code AROUND an anchored block, never the anchored block itself. A mutation made inexpressible outranks the complexity finding: if you cannot decompose without moving an anchored block, SKIP and name the anchor.

Report each finding as applied (with the extraction approach and the resulting complexity of each function you touched or created, as you counted it) or skipped (reason and needsManual)."""

REVIEW_GUIDE = """You are an ADVERSARIAL equivalence reviewer. The diff below changed ONE file of the Janumi Professional Workbench only to clear SonarQube findings; it MUST be behaviour-identical to the original (HEAD) for every input and every path. Your job is to REFUTE that claim: assume the change introduced a subtle behaviour difference and hunt for it. Only if you genuinely cannot find one after checking every item do you confirm equivalence.

READ-ONLY: use Read and Grep only. Do NOT edit, run commands or spawn processes. The changed file is in the worktree E:/Projects/hestami-sonar/ (read the full current version for context: types, call sites, closures). Never touch E:/Projects/hestami-ai/.

CHECK EVERY ITEM (one violation = NOT equivalent):
- shortCircuit: no && / || / ?. operand evaluated more, less or earlier; laziness intact; no dereference hoisted out of a short-circuit chain.
- optional-chain rewrites (S6582 and similar): `X === undefined || X.p !== Y` -> `X?.p !== Y` diverges when Y can be undefined, when the right-hand side can throw or has side effects, or when a dereference became eager; `a && a.b` -> `a?.b` diverges when `a` can be falsy but non-nullish.
- evalOrder: side effects run in the same relative order.
- earlyReturn/elseEffects: a new guard clause does not skip an else-branch, trailing statement, mutation or cleanup.
- returnValue: identical value, type and shape on every path (undefined vs missing, [] vs undefined, -0, NaN, string vs number).
- closureMutation: writes to captured state are preserved exactly (not dropped, not duplicated); `this` preserved.
- throwTiming: same throw points, error types and messages; try/catch/finally boundaries unchanged.
- loopSemantics: continue/break/return map soundly; ts.forEachChild callbacks do not return truthy values by accident.
- asyncAwait: no added or removed await; same order; no accidental parallelism or serialisation.
- mutationAliasing: in-place mutation acts on the same instances (e.g. .sort() vs a copy).
- collections: array holes (includes vs indexOf, find vs filter, some vs includes); sort comparators reproduce the old order exactly (default sort = UTF-16 code-unit order); Map vs object-literal dispatch (`__proto__` and other prototype keys).
- strings: template literals and String() produce byte-identical text; regex rewrites match identically. Judge the runtime that actually runs the code, not only the specification: under Bun 1.3.14 (this repository's tool runtime) String.raw returns NON-ASCII characters of its raw text as \\uXXXX escapes, so a String.raw conversion of a literal holding any non-ASCII character is NOT equivalent even though the specification says it is.
- typeNarrowing: narrowing later code relies on is still established; brands are not dropped by widened parameter types.
- coverageDrop: no branch, case or condition removed or merged so that an input takes a different path.
- MUTATION ANCHORS: each listed anchor is still byte-identical, occurs exactly once, sits at the same nesting depth, and the variables and functions around it are still in scope there, so the declared mutation can still be applied and still means what it meant.
- Any inline comment the change added (a recorded refusal) is accurate.

Return equivalent=true ONLY if you are confident after checking every item; otherwise equivalent=false with each concern: severity (blocking / minor / observation), the path or line, the inputs and how the outputs differ."""

FIX_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["rel", "changed", "applied", "skipped", "summary"],
    "properties": {
        "rel": {"type": "string"}, "changed": {"type": "boolean"},
        "applied": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["rule", "line", "note"], "properties": {"rule": {"type": "string"}, "line": {"type": "number"}, "note": {"type": "string"}}}},
        "skipped": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["rule", "line", "reason", "needsManual"], "properties": {"rule": {"type": "string"}, "line": {"type": "number"}, "reason": {"type": "string"}, "needsManual": {"type": "boolean"}}}},
        "summary": {"type": "string"},
    },
}
VERDICT_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["rel", "equivalent", "concerns", "summary"],
    "properties": {
        "rel": {"type": "string"}, "equivalent": {"type": "boolean"},
        "concerns": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["severity", "path", "detail"], "properties": {"severity": {"type": "string", "enum": ["blocking", "minor", "observation"]}, "path": {"type": "string"}, "detail": {"type": "string"}}}},
        "summary": {"type": "string"},
    },
}

SCRIPT = r"""export const meta = {
  name: __NAME__,
  description: __DESC__,
  phases: [{ title: __PHASE__, detail: __DETAIL__ }],
}

const KIND = __KIND__
const GUIDE = __GUIDE__
const SCHEMA = __SCHEMA__
const files = __FILES__

function anchorsBlock(f) {
  if (!f.anchors || f.anchors.length === 0) return 'Anchors in this file: none.'
  return 'Anchors in this file (' + f.anchors.length + '), each delimited by its own marker lines (the markers are not part of the text):\n' +
    f.anchors.map((a) => '<<<ANCHOR ' + a.id + '>>>\n' + a.find + '\n<<<END ' + a.id + '>>>').join('\n')
}

function prompt(f) {
  if (KIND === 'review') {
    return 'Adversarially verify that this change is behaviour-identical to HEAD. READ-ONLY.\n\nFile (read the full current version): ' + f.abs +
      '\n\nUnified diff (HEAD -> working tree):\n\n' + f.diff + '\n\n' + anchorsBlock(f) + '\n\n' + GUIDE
  }
  const head = KIND === 'cx'
    ? 'Reduce the S3776 cognitive complexity of the cited function(s) in ONE file to at most 15 each, behaviour-preserving. EDIT ONLY (Read, Edit, Grep; no commands).'
    : 'Fix SonarQube findings in ONE file. EDIT ONLY (Read, Edit, Grep; no commands).'
  return head + '\n\nFile (absolute path): ' + f.abs + "\n\nFindings (rule @ line:col - Sonar's message, verbatim):\n" +
    f.inScope.map((x) => '  ' + x.rule + ' @ L' + x.line + ':' + x.col + ' - ' + x.message +
      (x.prior ? '\n      PRIOR RULING (an earlier cycle refused this one): ' + x.prior + '. Keep the code. If no comment directly above the line already records it, add ONE line there: // ' + x.rule + ': <this reason, shortened>. Report it as skipped with needsManual: false.' : '')).join('\n') +
    '\n\n' + anchorsBlock(f) + '\n\n' + GUIDE + '\n\nReturn the structured result.'
}

log(KIND + ': ' + files.length + ' files')
const results = await parallel(files.map((f) => () => {
  const o = { label: KIND + ':' + f.rel.split('/').pop(), phase: __PHASE__, schema: SCHEMA }
  if (KIND !== 'mech') o.effort = 'high'
  return agent(prompt(f), o)
}))
const clean = results.filter(Boolean)
const failed = files.filter((f, i) => !results[i]).map((f) => f.rel)
if (failed.length) log('agents that returned nothing: ' + failed.join(', '))
if (KIND === 'review') {
  const notEquiv = clean.filter((r) => !r.equivalent)
  log('review: ' + clean.length + ' reviewed, ' + notEquiv.length + ' NOT equivalent')
  return { kind: KIND, requested: files.length, returned: clean.length, failed, notEquiv: notEquiv.map((r) => r.rel), results: clean }
}
let applied = 0, skipped = 0, manual = 0, changed = 0
for (const r of clean) {
  applied += r.applied.length
  skipped += r.skipped.length
  manual += r.skipped.filter((s) => s.needsManual).length
  if (r.changed) changed++
}
log(KIND + ' done: ' + changed + '/' + clean.length + ' files changed, ' + applied + ' applied, ' + skipped + ' skipped (' + manual + ' need manual)')
return { kind: KIND, requested: files.length, returned: clean.length, failed, changed, applied, skipped, manual, results: clean }
"""


def emit(kind, entries, out_dir, wave):
    os.makedirs(out_dir, exist_ok=True)
    guide = {"mech": MECH_GUIDE, "cx": CX_GUIDE, "review": REVIEW_GUIDE}[kind]
    schema = VERDICT_SCHEMA if kind == "review" else FIX_SCHEMA
    phase = {"mech": "Fix", "cx": "Decompose", "review": "Verify"}[kind]
    parts, cur, size = [], [], 0
    for e in entries:
        n = len(json.dumps(e))
        if cur and size + n > BUDGET:
            parts.append(cur)
            cur, size = [], 0
        cur.append(e)
        size += n
    if cur:
        parts.append(cur)
    paths = []
    for i, part in enumerate(parts, 1):
        name = "%s-p%d" % (wave, i) if len(parts) > 1 else wave
        desc = {"mech": "Sonar cycle 6: behaviour-preserving mechanical fixes, one edit-only agent per file, in the Sonar worktree",
                "cx": "Sonar cycle 6: S3776 decompositions to cx <= 15, one edit-only agent per file, in the Sonar worktree",
                "review": "Sonar cycle 6: adversarial equivalence review of each changed file (read-only)"}[kind]
        detail = {"mech": "edit-only; behaviour-preserving; skip and flag any risk",
                  "cx": "edit-only; extract around anchors; every function <= 15",
                  "review": "read-only; refute equivalence; default to NOT equivalent if unsure"}[kind]
        body = (SCRIPT.replace("__NAME__", json.dumps(name)).replace("__DESC__", json.dumps(desc))
                .replace("__DETAIL__", json.dumps(detail)).replace("__PHASE__", json.dumps(phase))
                .replace("__KIND__", json.dumps(kind)).replace("__GUIDE__", json.dumps(guide))
                .replace("__SCHEMA__", json.dumps(schema)).replace("__FILES__", json.dumps(part, ensure_ascii=False)))
        p = os.path.join(out_dir, name + ".workflow.js")
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(body)
        paths.append((p, len(part), len(body.encode("utf-8"))))
    for p, n, b in paths:
        print("wrote %s  (%d files, %.0f KB)" % (p, n, b / 1024))
    return paths


def from_triage(kind, triage_path, out_dir, wave):
    t = json.load(open(triage_path, encoding="utf-8"))
    want = "C" if kind == "cx" else "AB"
    entries = []
    for rel, f in sorted(t["files"].items()):
        scope = [dict({"rule": r["rule"], "line": r["line"], "col": r["col"], "message": r["message"]}, **({"prior": r["prior"]} if r.get("prior") else {}))
                 for r in f["findings"] if r["tier"] == want]
        if not scope:
            continue
        entries.append({"rel": rel, "abs": f["abs"], "inScope": scope, "anchors": f["anchors"]})
    print("%s: %d files, %d findings" % (kind, len(entries), sum(len(e["inScope"]) for e in entries)))
    return emit(kind, entries, out_dir, wave)


def review(anchors_path, out_dir, wave, root, rels):
    anchors = json.load(open(anchors_path, encoding="utf-8"))
    entries = []
    for rel in rels:
        diff = subprocess.run(["git", "-C", root, "--no-optional-locks", "diff", "--relative", "--", rel],
                              capture_output=True, text=True, encoding="utf-8", check=True).stdout
        if not diff.strip():
            print("  no diff, skipped:", rel)
            continue
        live = [{"id": a["id"], "find": a["find"]} for a in anchors.get(rel, []) if not a["history"]]
        entries.append({"rel": rel, "abs": root.rstrip("/") + "/" + rel, "diff": diff, "anchors": live})
    print("review: %d files" % len(entries))
    return emit("review", entries, out_dir, wave)


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode in ("mech", "cx"):
        from_triage(mode, sys.argv[2], sys.argv[3], sys.argv[4])
    elif mode == "review":
        review(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:])
    else:
        sys.exit("unknown mode " + mode)
