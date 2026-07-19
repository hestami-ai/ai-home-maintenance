#!/usr/bin/env python3
"""Validate Janumi IRP machine-readable control records against local schemas."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--schema-dir', required=True, help='Directory containing IRP JSON schemas')
    ap.add_argument('--instance-dir', required=True, help='Directory to scan recursively for JSON control records')
    args = ap.parse_args()
    schema_dir = Path(args.schema_dir).resolve()
    instance_dir = Path(args.instance_dir).resolve()
    if not schema_dir.is_dir() or not instance_dir.is_dir():
        print('schema-dir and instance-dir must be directories', file=sys.stderr)
        return 2

    schemas: dict[str, dict] = {}
    for path in sorted(schema_dir.glob('*.schema.json')):
        try:
            schema = json.loads(path.read_text(encoding='utf-8'))
            Draft202012Validator.check_schema(schema)
            schemas[path.name] = schema
        except Exception as exc:
            print(f'SCHEMA ERROR {path}: {exc}', file=sys.stderr)
            return 3

    checked = 0
    errors = 0
    for path in sorted(instance_dir.rglob('*.json')):
        try:
            obj = json.loads(path.read_text(encoding='utf-8'))
        except Exception as exc:
            print(f'JSON ERROR {path}: {exc}')
            errors += 1
            continue
        if not isinstance(obj, dict) or 'controlSchema' not in obj:
            continue
        schema_name = obj['controlSchema']
        schema = schemas.get(schema_name)
        if schema is None:
            print(f'SCHEMA NOT FOUND {path}: {schema_name}')
            errors += 1
            continue
        checked += 1
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for err in sorted(validator.iter_errors(obj), key=lambda e: list(e.absolute_path)):
            json_path = '$' + ''.join(f'[{i}]' if isinstance(i, int) else f'.{i}' for i in err.absolute_path)
            schema_path = '/'.join(str(x) for x in err.absolute_schema_path)
            print(f'INVALID {path}: {json_path}: {err.message} (schema: {schema_path})')
            errors += 1
    print(f'Validated {checked} control record(s); errors={errors}')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
