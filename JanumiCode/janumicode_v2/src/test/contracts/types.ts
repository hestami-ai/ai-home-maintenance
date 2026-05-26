/**
 * Contract harness — base types.
 *
 * A ContractSuite describes the assertions that a producer sub-phase's
 * output must satisfy for its downstream consumer to function correctly.
 * Each ContractClause is one assertion; runner.ts executes them and
 * collects ContractResults.
 *
 * Design intent: backwards-derived from consumer needs (see
 * docs/design/contract-harness-stage1-enumeration.md and
 * docs/design/contract-harness-stage1b-design-positions.md).
 */

export type Severity = 'blocking' | 'advisory';

export interface ClauseFailure {
  readonly message: string;
  readonly details?: unknown;
}

/** Clause check result: literal `true` for pass, ClauseFailure for fail. */
export type ClauseCheckResult = true | ClauseFailure;

/**
 * Context passed to every clause check. Holds related artifacts from
 * the same workflow run so cross-artifact assertions (e.g. "every UJ
 * id referenced elsewhere must resolve in user_journey_bloom") are
 * possible without each clause re-querying the DB.
 */
export interface ContractContext {
  /** Workflow run id (for log / report attribution). */
  readonly workflowRunId: string;
  /**
   * All artifact_produced contents in the run, keyed by `content.kind`.
   * Empty map is valid (e.g. when running against a synthetic fixture
   * in isolation). When non-empty, the same artifact may appear under
   * its kind key multiple times if the producer was re-run.
   */
  readonly relatedArtifacts: ReadonlyMap<string, ReadonlyArray<unknown>>;
}

export interface ContractClause<TArtifact> {
  /** Stable id of the clause within its suite (e.g. "C-4.2.1"). */
  readonly id: string;
  /** One-sentence human-readable description. */
  readonly description: string;
  readonly severity: Severity;
  /**
   * Pure function: takes the producer artifact + related-artifact
   * context, returns either `true` (pass) or a ClauseFailure (fail).
   * MUST NOT mutate inputs. MUST NOT perform I/O.
   */
  readonly check: (artifact: TArtifact, context: ContractContext) => ClauseCheckResult;
}

export interface ContractSuite<TArtifact> {
  /** Stable boundary id (e.g. "4.2_component_skeleton"). */
  readonly boundaryId: string;
  /** Phase id this suite governs the output of. */
  readonly phaseId: string;
  /** Sub-phase id within that phase. */
  readonly subPhaseId: string;
  /**
   * `content.kind` of the producer artifact this suite validates.
   * Diagnose CLI uses this to look up the right artifact_produced
   * record(s) from the governed stream.
   */
  readonly producerArtifactKind: string;
  /** Short description used in diagnostic output. */
  readonly description: string;
  /** Ordered list of clauses. Order is informational only. */
  readonly clauses: ReadonlyArray<ContractClause<TArtifact>>;
}

export interface ContractResult {
  readonly boundaryId: string;
  readonly clauseId: string;
  readonly clauseDescription: string;
  readonly severity: Severity;
  readonly passed: boolean;
  readonly message?: string;
  readonly details?: unknown;
}

export interface ContractSummary {
  readonly total: number;
  readonly passed: number;
  readonly blockingFailures: number;
  readonly advisoryFailures: number;
}
