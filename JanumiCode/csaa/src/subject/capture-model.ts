import type {
	CapturedArtifactRecord,
	ExcludedArtifactRecord,
	SubjectDiagnostic
} from '../contracts/subject.js';

export interface FileFingerprint {
	readonly bytes: number;
	readonly modifiedMs: number;
	readonly sha256: string;
}

export interface SubjectCapture {
	readonly artifacts: readonly CapturedArtifactRecord[];
	readonly bytesByPath: ReadonlyMap<string, Uint8Array>;
	readonly diagnostics: readonly SubjectDiagnostic[];
	readonly directoryPaths: readonly string[];
	readonly discoveredArtifactCount: number;
	readonly excludedArtifacts: readonly ExcludedArtifactRecord[];
	readonly fingerprints: ReadonlyMap<string, FileFingerprint>;
	readonly realRoot: string;
	readonly typescriptDirectoryRecordings: ReadonlyMap<string, readonly string[]>;
}
