#!/usr/bin/env python3
"""Check P6 roadmap-instance coverage of the controlled requirement register."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--requirements', required=True)
    ap.add_argument('--roadmap-instance', required=True)
    args = ap.parse_args()
    reqs = json.loads(Path(args.requirements).read_text(encoding='utf-8'))['requirements']
    roadmap = json.loads(Path(args.roadmap_instance).read_text(encoding='utf-8'))
    covered = {x['requirementId'] for x in roadmap.get('requirementCoverage', [])}
    expected = {x['requirementId'] for x in reqs}
    missing = sorted(expected - covered)
    extra = sorted(covered - expected)
    duplicates = []
    seen=set()
    for x in roadmap.get('requirementCoverage', []):
        rid=x['requirementId']
        if rid in seen: duplicates.append(rid)
        seen.add(rid)
    print(f'expected={len(expected)} covered={len(covered)} missing={len(missing)} extra={len(extra)} duplicates={len(duplicates)}')
    if missing:
        print('MISSING:'); print('\n'.join(missing))
    if extra:
        print('EXTRA:'); print('\n'.join(extra))
    if duplicates:
        print('DUPLICATES:'); print('\n'.join(sorted(set(duplicates))))
    return 1 if missing or extra or duplicates else 0


if __name__ == '__main__':
    raise SystemExit(main())
