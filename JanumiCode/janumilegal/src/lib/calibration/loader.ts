/**
 * Gold matter loader.
 *
 * Reads `calibration/gold/<id>/...` and materializes a GoldMatter object.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AssertionFile,
  ExpectedLensClassification,
  ExpectedReleaseStatuses,
  FailureTrap,
  GoldMatter,
  GoldMatterMetadata,
} from './types.js';

export class GoldMatterLoadError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'GoldMatterLoadError';
  }
}

export function loadGoldMatter(rootDir: string): GoldMatter {
  if (!fs.existsSync(rootDir)) {
    throw new GoldMatterLoadError(`gold matter dir not found: ${rootDir}`, 'DIR_NOT_FOUND');
  }

  const metadata = readJson<GoldMatterMetadata>(path.join(rootDir, 'matter.json'), 'matter.json');

  const inputsDir = path.join(rootDir, 'inputs');
  const inputs: Record<string, string> = {};
  if (fs.existsSync(inputsDir)) {
    for (const entry of fs.readdirSync(inputsDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        inputs[entry.name] = fs.readFileSync(path.join(inputsDir, entry.name), 'utf8');
      }
    }
  }

  const expectationsDir = path.join(rootDir, 'expectations');
  const expectedLensClassification = readJsonOptional<ExpectedLensClassification>(
    path.join(expectationsDir, 'lens_classification.json'),
  );
  const requiredStatesPath = path.join(expectationsDir, 'required_states.json');
  const requiredStatesRaw = fs.existsSync(requiredStatesPath)
    ? readJson<{ states: string[] }>(requiredStatesPath, 'required_states.json')
    : { states: [] };
  const requiredStates = requiredStatesRaw.states;

  const stateOutputsDir = path.join(expectationsDir, 'state_outputs');
  const stateOutputs: Record<string, unknown> = {};
  if (fs.existsSync(stateOutputsDir)) {
    for (const entry of fs.readdirSync(stateOutputsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const name = entry.name.replace(/\.json$/, '');
        stateOutputs[name] = readJson<unknown>(path.join(stateOutputsDir, entry.name), entry.name);
      }
    }
  }

  const artifactsDir = path.join(expectationsDir, 'artifacts');
  const artifacts: Record<string, unknown> = {};
  if (fs.existsSync(artifactsDir)) {
    for (const entry of fs.readdirSync(artifactsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const name = entry.name.replace(/\.json$/, '');
        artifacts[name] = readJson<unknown>(path.join(artifactsDir, entry.name), entry.name);
      }
    }
  }

  const releaseStatuses = readJsonOptional<ExpectedReleaseStatuses>(path.join(expectationsDir, 'release_status.json'));
  const failureTrapsRaw = readJsonOptional<{ traps: FailureTrap[] }>(path.join(expectationsDir, 'failure_traps.json'));
  const failureTraps = failureTrapsRaw?.traps ?? [];

  const assertionsPath = path.join(rootDir, 'assertions', 'assertions.json');
  const assertions: AssertionFile = fs.existsSync(assertionsPath)
    ? readJson<AssertionFile>(assertionsPath, 'assertions.json')
    : { assertions: [] };

  return {
    metadata,
    inputs,
    expectedLensClassification,
    requiredStates,
    stateOutputs,
    artifacts,
    releaseStatuses,
    failureTraps,
    assertions,
  };
}

export function listGoldMatters(goldDir: string): string[] {
  if (!fs.existsSync(goldDir)) return [];
  return fs
    .readdirSync(goldDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(goldDir, e.name, 'matter.json')))
    .map((e) => path.join(goldDir, e.name));
}

function readJson<T>(p: string, label: string): T {
  if (!fs.existsSync(p)) throw new GoldMatterLoadError(`required file missing: ${label}`, 'FILE_MISSING');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch (err) {
    throw new GoldMatterLoadError(`invalid JSON in ${label}: ${(err as Error).message}`, 'INVALID_JSON');
  }
}

function readJsonOptional<T>(p: string): T | undefined {
  if (!fs.existsSync(p)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return undefined;
  }
}
