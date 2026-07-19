#!/usr/bin/env python3
"""Read-only Janumi P1 repository evidence inventory.

The tool uses only the Python standard library. It never imports repository code,
installs dependencies, modifies the repository, or accesses the network.
Heuristic hits are candidates for manual semantic inspection, not conformance claims.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

DEFAULT_EXCLUDES = {
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache',
    '.mypy_cache', '.ruff_cache', '.svelte-kit', '.next', 'dist', 'build',
    'coverage', '.coverage', 'target', 'vendor', '.turbo', '.cache'
}
TEXT_EXTS = {
    '.ts', '.tsx', '.js', '.jsx', '.svelte', '.vue', '.py', '.go', '.rs', '.java',
    '.kt', '.cs', '.rb', '.php', '.sql', '.graphql', '.gql', '.proto', '.json',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.md', '.txt', '.sh', '.ps1',
    '.html', '.css', '.scss', '.xml', '.properties'
}
MANIFEST_NAMES = {
    'package.json', 'pyproject.toml', 'requirements.txt', 'poetry.lock', 'pdm.lock',
    'uv.lock', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
    'Gemfile', 'composer.json', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'compose.yml', 'compose.yaml', 'Chart.yaml', 'schema.prisma'
}

PATTERNS = {
    'pwu': re.compile(r'\b(PWU|ProfessionalWorkUnit|professional[_ -]?work[_ -]?unit)\b', re.I),
    'rph': re.compile(r'\b(RPH|RecursiveProfessionalHarness|recursive[_ -]?professional[_ -]?harness)\b', re.I),
    'pwa': re.compile(r'\b(PWA|ProfessionalWorkArchitecture|professional[_ -]?work[_ -]?architecture)\b', re.I),
    'command': re.compile(r'\b(CommandHandler|dispatchCommand|executeCommand|command_id|commandId)\b', re.I),
    'event': re.compile(r'\b(DomainEvent|event_id|eventId|outbox|event_store|EventStore)\b', re.I),
    'projection': re.compile(r'\b(projection|read[_ -]?model|materialized[_ -]?view)\b', re.I),
    'validator': re.compile(r'\b(validator|validation_result|ValidationResult|invariant)\b', re.I),
    'reconciliation': re.compile(r'\b(reconciliation|reconcile|contradiction)\b', re.I),
    'agent': re.compile(r'\b(agent[_ -]?execution|coding[_ -]?agent|model[_ -]?gateway|tool[_ -]?call|sandbox)\b', re.I),
    'tenant': re.compile(r'\b(tenant_id|tenantId|organization_id|organizationId|row level security|row-level security|RLS)\b', re.I),
    'auth': re.compile(r'\b(OIDC|OAuth|SAML|authorization|permission|role[_ -]?based|RBAC|JWT)\b', re.I),
    'otel': re.compile(r'\b(OpenTelemetry|opentelemetry|OTEL_|TracerProvider|MeterProvider)\b', re.I),
    'workflow': re.compile(r'\b(Temporal|Celery|workflow|durable[_ -]?process|process_instance|saga)\b', re.I),
}

ROUTE_PATTERNS = [
    re.compile(r'@(?:app|router)\.(get|post|put|patch|delete)\(\s*[rRuUbBfF]*[\"\']([^\"\']+)', re.I),
    re.compile(r'\b(?:app|router)\.(get|post|put|patch|delete)\(\s*[\"\']([^\"\']+)', re.I),
]


def sha256_file(path: Path, limit: int) -> str | None:
    try:
        if path.stat().st_size > limit:
            return None
        h = hashlib.sha256()
        with path.open('rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def run_git(repo: Path, *args: str) -> str:
    try:
        p = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, timeout=10, check=False)
        return (p.stdout or p.stderr).strip()
    except Exception as exc:
        return f'UNAVAILABLE: {exc}'


def iter_files(root: Path, excludes: set[str]) -> Iterable[Path]:
    for current, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in excludes]
        base = Path(current)
        for name in files:
            yield base / name


def classify(path: Path, rel: str) -> str:
    name = path.name.lower()
    low = rel.lower()
    if name in {n.lower() for n in MANIFEST_NAMES} or 'package-lock' in name or 'pnpm-lock' in name or 'yarn.lock' == name:
        return 'MANIFEST'
    if '/migrations/' in '/' + low or name.startswith('migration') or name == 'schema.prisma' or 'alembic' in low:
        return 'DATABASE'
    if any(x in low for x in ['/test/', '/tests/', '/__tests__/']) or re.search(r'(^|/)(test_|.*\.(test|spec)\.)', low):
        return 'TEST'
    if name.startswith('dockerfile') or 'docker-compose' in name or '/k8s/' in '/' + low or '/helm/' in '/' + low or '/terraform/' in '/' + low or path.suffix in {'.tf', '.tfvars'}:
        return 'INFRASTRUCTURE'
    if path.suffix.lower() in {'.svelte', '.tsx', '.jsx', '.vue'}:
        return 'UI_COMPONENT'
    if 'src/routes/' in low or '/app/' in '/' + low and name.startswith('page.') or '/pages/' in '/' + low:
        return 'FRONTEND_ROUTE'
    if path.suffix.lower() in {'.proto', '.graphql', '.gql'} or 'openapi' in name or 'swagger' in name:
        return 'API_CONTRACT'
    if path.suffix.lower() == '.sql':
        return 'DATABASE'
    return 'SOURCE' if path.suffix.lower() in TEXT_EXTS else 'OTHER'


def read_text(path: Path, max_bytes: int = 2_000_000) -> str | None:
    try:
        if path.stat().st_size > max_bytes or path.suffix.lower() not in TEXT_EXTS:
            return None
        return path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None


def ensure(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, headers: list[str], rows: list[dict]) -> None:
    with path.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for row in rows:
            w.writerow({h: row.get(h, '') for h in headers})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--hash-limit-mb', type=int, default=20)
    ap.add_argument('--exclude', action='append', default=[])
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    out = Path(args.output).resolve()
    if not repo.is_dir():
        print(f'Repository not found: {repo}', file=sys.stderr)
        return 2
    ensure(out)

    excludes = DEFAULT_EXCLUDES | set(args.exclude)
    hash_limit = args.hash_limit_mb * 1024 * 1024
    now = datetime.now(timezone.utc).isoformat()

    git = {
        'root': run_git(repo, 'rev-parse', '--show-toplevel'),
        'commit': run_git(repo, 'rev-parse', 'HEAD'),
        'branch': run_git(repo, 'branch', '--show-current'),
        'statusPorcelain': run_git(repo, 'status', '--porcelain=v1'),
        'submodules': run_git(repo, 'submodule', 'status', '--recursive'),
        'remotes': run_git(repo, 'remote', '-v'),
    }

    file_rows, route_rows, comp_rows, test_rows, db_rows, infra_rows = [], [], [], [], [], []
    manifests, semantic_hits, secobs_hits = [], [], []
    ext_counts, category_counts = Counter(), Counter()

    for path in iter_files(repo, excludes):
        rel = path.relative_to(repo).as_posix()
        category = classify(path, rel)
        suffix = path.suffix.lower() or '<none>'
        try:
            size = path.stat().st_size
        except OSError:
            size = -1
        digest = sha256_file(path, hash_limit)
        row = {'path': rel, 'category': category, 'extension': suffix, 'size_bytes': size, 'sha256': digest or 'SKIPPED'}
        file_rows.append(row)
        ext_counts[suffix] += 1
        category_counts[category] += 1

        low = rel.lower()
        if path.name in MANIFEST_NAMES or category == 'MANIFEST':
            manifests.append({'path': rel, 'sizeBytes': size, 'sha256': digest})
        if category == 'UI_COMPONENT':
            comp_rows.append({'path': rel, 'framework_hint': suffix.lstrip('.'), 'name': path.stem})
        if category == 'TEST':
            test_rows.append({'path': rel, 'framework_hint': '', 'target_hint': path.stem})
        if category == 'DATABASE':
            db_rows.append({'path': rel, 'kind': 'migration' if 'migration' in low else 'schema_or_sql', 'name': path.name})
        if category == 'INFRASTRUCTURE':
            infra_rows.append({'path': rel, 'kind': 'container_or_deployment', 'name': path.name})

        # Filesystem route conventions
        if 'src/routes/' in low and path.name.startswith('+'):
            route = rel.split('src/routes/', 1)[1].rsplit('/', 1)[0] if '/' in rel.split('src/routes/',1)[1] else '/'
            route_rows.append({'method': 'FILESYSTEM', 'route': '/' + route.strip('/'), 'path': rel, 'framework_hint': 'SvelteKit'})
        elif re.search(r'(^|/)app/.*/page\.(tsx|ts|jsx|js)$', low):
            route = re.split(r'(^|/)app/', low, maxsplit=1)[-1].rsplit('/page.', 1)[0]
            route_rows.append({'method': 'FILESYSTEM', 'route': '/' + route.strip('/'), 'path': rel, 'framework_hint': 'Next.js'})

        text = read_text(path)
        if text is None:
            continue
        for pat in ROUTE_PATTERNS:
            for m in pat.finditer(text):
                route_rows.append({'method': m.group(1).upper(), 'route': m.group(2), 'path': rel, 'framework_hint': 'decorator_or_router'})
        for name, pat in PATTERNS.items():
            matches = list(pat.finditer(text))
            if not matches:
                continue
            sample_lines = sorted({text.count('\n', 0, m.start()) + 1 for m in matches[:10]})
            hit = {'concept': name, 'path': rel, 'hit_count': len(matches), 'sample_lines': ';'.join(map(str, sample_lines))}
            if name in {'tenant', 'auth', 'otel'}:
                secobs_hits.append(hit)
            else:
                semantic_hits.append(hit)

    file_rows.sort(key=lambda r: r['path'])
    for rows in (route_rows, comp_rows, test_rows, db_rows, infra_rows, semantic_hits, secobs_hits):
        rows.sort(key=lambda r: (r.get('path',''), r.get('route',''), r.get('concept','')))

    summary = {
        'generatedAt': now,
        'repository': str(repo),
        'git': git,
        'excludedDirectories': sorted(excludes),
        'fileCount': len(file_rows),
        'filesByExtension': dict(sorted(ext_counts.items())),
        'filesByCategory': dict(sorted(category_counts.items())),
        'routeCandidateCount': len(route_rows),
        'componentCandidateCount': len(comp_rows),
        'testCandidateCount': len(test_rows),
        'databaseCandidateCount': len(db_rows),
        'infrastructureCandidateCount': len(infra_rows),
        'semanticHitCount': len(semantic_hits),
        'securityObservabilityHitCount': len(secobs_hits),
        'warning': 'Heuristic inventory only. Manual semantic validation is mandatory.'
    }
    (out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    (out / 'manifests.json').write_text(json.dumps(manifests, indent=2) + '\n', encoding='utf-8')
    write_csv(out / 'files.csv', ['path','category','extension','size_bytes','sha256'], file_rows)
    write_csv(out / 'routes.csv', ['method','route','path','framework_hint'], route_rows)
    write_csv(out / 'components.csv', ['path','framework_hint','name'], comp_rows)
    write_csv(out / 'tests.csv', ['path','framework_hint','target_hint'], test_rows)
    write_csv(out / 'database.csv', ['path','kind','name'], db_rows)
    write_csv(out / 'infrastructure.csv', ['path','kind','name'], infra_rows)
    write_csv(out / 'semantic-hits.csv', ['concept','path','hit_count','sample_lines'], semantic_hits)
    write_csv(out / 'security-observability-hits.csv', ['concept','path','hit_count','sample_lines'], secobs_hits)

    commands = [
        f'generated_at={now}', f'repository={repo}',
        f'git_commit={git["commit"]}', f'git_branch={git["branch"]}',
        'git_status_porcelain:', git['statusPorcelain'] or '<clean>',
        'git_submodules:', git['submodules'] or '<none>',
        'git_remotes:', git['remotes'] or '<none>',
    ]
    (out / 'commands.txt').write_text('\n'.join(commands) + '\n', encoding='utf-8')

    lines = [
        '# P1 Repository Evidence Inventory Summary', '',
        f'**Generated:** {now}', f'**Repository:** `{repo}`',
        f'**Commit:** `{git["commit"]}`', f'**Branch:** `{git["branch"]}`', '',
        '> This is a heuristic inventory. It is not a conformance assessment.', '',
        '## Counts', '',
        f'- Files: **{len(file_rows)}**',
        f'- Route candidates: **{len(route_rows)}**',
        f'- UI component candidates: **{len(comp_rows)}**',
        f'- Test candidates: **{len(test_rows)}**',
        f'- Database candidates: **{len(db_rows)}**',
        f'- Infrastructure candidates: **{len(infra_rows)}**',
        f'- Semantic keyword hit records: **{len(semantic_hits)}**',
        f'- Security/observability hit records: **{len(secobs_hits)}**', '',
        '## Files by category', ''
    ]
    for k, v in sorted(category_counts.items()):
        lines.append(f'- {k}: {v}')
    lines += ['', '## Dirty state', '', '```text', git['statusPorcelain'] or '<clean>', '```', '']
    (out / 'summary.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
