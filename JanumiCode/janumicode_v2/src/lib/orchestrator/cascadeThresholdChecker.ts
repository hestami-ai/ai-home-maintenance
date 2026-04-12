/**
 * CascadeThresholdChecker — compares estimated refactoring scope against configured limits.
 * Based on JanumiCode Spec v2.3, §4 Phase 0.5.
 *
 * If either threshold is exceeded, presents a hard stop menu.
 */

export interface CascadeThresholdConfig {
  taskCountThreshold: number;
  fileCountThreshold: number;
}

export interface CascadeCheckResult {
  exceeds: boolean;
  exceedsTaskCount: boolean;
  exceedsFileCount: boolean;
  estimatedTaskCount: number;
  estimatedFileCount: number;
  taskCountThreshold: number;
  fileCountThreshold: number;
}

export class CascadeThresholdChecker {
  constructor(private readonly config: CascadeThresholdConfig) {}

  check(estimatedTaskCount: number, estimatedFileCount: number): CascadeCheckResult {
    const exceedsTaskCount = estimatedTaskCount > this.config.taskCountThreshold;
    const exceedsFileCount = estimatedFileCount > this.config.fileCountThreshold;

    return {
      exceeds: exceedsTaskCount || exceedsFileCount,
      exceedsTaskCount,
      exceedsFileCount,
      estimatedTaskCount,
      estimatedFileCount,
      taskCountThreshold: this.config.taskCountThreshold,
      fileCountThreshold: this.config.fileCountThreshold,
    };
  }
}
