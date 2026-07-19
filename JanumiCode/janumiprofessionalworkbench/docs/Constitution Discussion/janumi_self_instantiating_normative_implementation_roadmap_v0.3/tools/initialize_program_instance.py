#!/usr/bin/env python3
"""Initialize a repository-specific Janumi IRP program-instance directory."""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--package-root', required=True)
    ap.add_argument('--output', required=True)
    ap.add_argument('--program-instance-id', required=True)
    ap.add_argument('--repository-uri', default='UNAVAILABLE')
    ap.add_argument('--repository-revision', default='UNASSESSED')
    ap.add_argument('--created-by', default='UNASSIGNED')
    args = ap.parse_args()

    package = Path(args.package_root).resolve()
    output = Path(args.output).resolve()
    templates = package / 'templates'
    if not templates.is_dir():
        raise SystemExit(f'Templates not found: {templates}')
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f'Output exists and is not empty: {output}')

    for d in ['control','evidence','current-state','assessments','reconciliation','transition','roadmap/increments','roadmap/evidence-plans','reviews','decisions','deviations','deferrals','changes']:
        (output/d).mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    for path in sorted(templates.glob('*.json')):
        if path.name in {'requirement-assessment.json', 'requirement-assessment-prefilled-157.json'}:
            continue
        obj = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(obj, dict):
            obj['programInstanceId'] = args.program_instance_id
            obj['createdAt'] = now
            obj['createdBy'] = args.created_by
            if path.name == 'program-execution-context.json':
                obj['repository']['uri'] = args.repository_uri
                obj['repository']['revision'] = args.repository_revision
            if 'repositoryRevision' in obj:
                obj['repositoryRevision'] = args.repository_revision
        (output/'control'/path.name).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')

    # Copy the prefilled 157-requirement assessment as the starting register.
    pref = json.loads((templates/'requirement-assessment-prefilled-157.json').read_text(encoding='utf-8'))
    pref['programInstanceId'] = args.program_instance_id
    pref['createdAt'] = now
    pref['createdBy'] = args.created_by
    pref['repositoryRevision'] = args.repository_revision
    (output/'assessments/requirement-assessment.json').write_text(json.dumps(pref,indent=2)+'\n',encoding='utf-8')

    shutil.copy2(package/'control/requirement-register.json', output/'control/requirement-register.json')
    shutil.copy2(package/'control/source-catalog.json', output/'control/source-catalog.json')
    (output/'README.md').write_text(
        f'# Janumi Implementation Program Instance\n\nProgram instance: `{args.program_instance_id}`  \nRepository: `{args.repository_uri}`  \nStarting revision: `{args.repository_revision}`  \nInitialized: `{now}`\n',
        encoding='utf-8')
    print(output)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
