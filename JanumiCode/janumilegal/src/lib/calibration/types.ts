/**
 * Calibration types.
 *
 * Per docs/calibration/gold_capture_protocol.md.
 *
 * A gold matter is a fully specified, hand-curated, end-to-end test fixture
 * stored under calibration/gold/<test_case_id>/.
 */

export interface GoldMatterMetadata {
  readonly testCaseId: string;
  readonly lens: string;
  readonly jurisdiction: string;
  readonly practiceArea: string;
  readonly matterType: string;
  readonly primaryUser: string;
  readonly secondaryUsers: readonly string[];
  readonly releaseTarget: readonly string[];
  readonly riskLevel: 'Low' | 'Medium' | 'High';
  readonly goldMatterVersion: string;
  readonly lastRevised: string;
  readonly authoringAttorneyId: string;
  readonly sensitiveContent: boolean;
  readonly status: 'engineering_draft' | 'attorney_reviewed';
}

export interface ExpectedLensClassification {
  readonly primary_lens: string;
  readonly secondary_lenses: readonly string[];
  readonly matter_type: string;
  readonly jurisdiction: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly safe_next_state: string;
  readonly prohibited_actions: readonly string[];
}

export interface ExpectedReleaseStatuses {
  readonly [artifactType: string]: string;
}

export interface FailureTrap {
  readonly id: string;
  readonly description: string;
  readonly expectedDetectionPoint: string;
  readonly expectedEscalationPath: string;
}

export interface AssertionEntry {
  readonly id: string;
  readonly target: string; // dotted JSON path within the activation snapshot
  readonly comparator: 'equals' | 'contains' | 'in' | 'gte' | 'not_equals' | 'matches';
  readonly expected: unknown;
  /** When true, failure of this assertion is a hard-gate break (not just a metric regression). */
  readonly hardGate?: boolean;
}

export interface AssertionFile {
  readonly assertions: readonly AssertionEntry[];
}

export interface GoldMatter {
  readonly metadata: GoldMatterMetadata;
  readonly inputs: Readonly<Record<string, string>>;
  readonly expectedLensClassification?: ExpectedLensClassification;
  readonly requiredStates: readonly string[];
  readonly stateOutputs: Readonly<Record<string, unknown>>;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly releaseStatuses?: ExpectedReleaseStatuses;
  readonly failureTraps: readonly FailureTrap[];
  readonly assertions: AssertionFile;
}

/** Hard-gate metrics enforced on every CI run (no override). */
export interface HardGateMetrics {
  readonly requiredStateCompletionRate: number; // must be 1.0
  readonly issueBloomLateAdditionRate: number; // must be 0
  readonly silentPruningRate: number; // must be 0
  readonly falseConfidenceRate: number; // must be 0
  readonly crossMatterLeakageBytes: number; // must be 0
  readonly releaseGateCorrectness: number; // must be 1.0
}

export interface RegressionReport {
  readonly producedAt: string;
  readonly goldSetSize: number;
  readonly passed: number;
  readonly failed: number;
  readonly perGoldMatter: ReadonlyArray<{
    readonly testCaseId: string;
    readonly status: 'pass' | 'fail';
    readonly assertionsPassed: number;
    readonly assertionsFailed: number;
    readonly failures: readonly { assertionId: string; reason: string }[];
  }>;
  readonly hardGateMetrics: HardGateMetrics;
  readonly hardGateBreaches: readonly string[];
}
