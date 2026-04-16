/**
 * Rolling Coverage - Track test coverage over time.
 *
 * Provides:
 *   - Coverage trend tracking
 *   - Coverage regression detection
 *   - Phase coverage metrics
 *   - Coverage reports for CI
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PhaseId } from '../../lib/types/records';

export interface CoveragePoint {
  timestamp: string;
  commitSha: string;
  branch: string;
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  phaseCoverage: Record<PhaseId, number>;
}

export interface CoverageTrend {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  dataPoints: CoveragePoint[];
  regressions: CoverageRegression[];
}

export interface CoverageRegression {
  phase: PhaseId;
  previousCoverage: number;
  currentCoverage: number;
  change: number;
  files: string[];
}

export interface CoverageReport {
  generatedAt: string;
  summary: {
    totalLines: number;
    coveredLines: number;
    linePercent: number;
    totalBranches: number;
    coveredBranches: number;
    branchPercent: number;
    totalFunctions: number;
    coveredFunctions: number;
    functionPercent: number;
  };
  phaseBreakdown: Record<PhaseId, {
    lines: number;
    covered: number;
    percent: number;
    files: string[];
  }>;
  trends: CoverageTrend;
  recommendations: string[];
}

/**
 * Rolling coverage tracker.
 */
export class RollingCoverageTracker {
  private readonly historyFile: string;
  private history: CoveragePoint[] = [];
  private readonly maxHistorySize = 100;

  constructor(historyFile: string) {
    this.historyFile = historyFile;
    this.loadHistory();
  }

  /**
   * Record a coverage point.
   */
  recordCoverage(point: CoveragePoint): void {
    this.history.push(point);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    this.saveHistory();
  }

  /**
   * Get coverage trend analysis.
   */
  getTrend(windowSize = 10): CoverageTrend {
    const recentPoints = this.history.slice(-windowSize);

    if (recentPoints.length < 2) {
      return {
        direction: 'stable',
        changePercent: 0,
        dataPoints: recentPoints,
        regressions: [],
      };
    }

    const first = recentPoints[0];
    const last = recentPoints.at(-1)!;

    const changePercent = last.lineCoverage - first.lineCoverage;
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (changePercent > 1) {
      direction = 'improving';
    } else if (changePercent < -1) {
      direction = 'declining';
    }

    // Detect regressions per phase
    const regressions: CoverageRegression[] = [];
    const phases = Object.keys(last.phaseCoverage) as PhaseId[];

    for (const phase of phases) {
      const prevCoverage = first.phaseCoverage[phase] ?? 0;
      const currCoverage = last.phaseCoverage[phase] ?? 0;
      const change = currCoverage - prevCoverage;

      if (change < -5) {
        regressions.push({
          phase,
          previousCoverage: prevCoverage,
          currentCoverage: currCoverage,
          change,
          files: [], // Would need file-level tracking
        });
      }
    }

    return {
      direction,
      changePercent,
      dataPoints: recentPoints,
      regressions,
    };
  }

  /**
   * Check if coverage has regressed.
   */
  hasRegression(): boolean {
    const trend = this.getTrend();
    return trend.direction === 'declining' || trend.regressions.length > 0;
  }

  /**
   * Get coverage history.
   */
  getHistory(): CoveragePoint[] {
    return [...this.history];
  }

  /**
   * Generate a coverage report.
   */
  generateReport(currentCoverage: {
    lines: { total: number; covered: number };
    branches: { total: number; covered: number };
    functions: { total: number; covered: number };
    phaseCoverage: Record<PhaseId, { total: number; covered: number; files: string[] }>;
    commitSha: string;
    branch: string;
  }): CoverageReport {
    const trends = this.getTrend();

    const summary = {
      totalLines: currentCoverage.lines.total,
      coveredLines: currentCoverage.lines.covered,
      linePercent: currentCoverage.lines.total > 0
        ? (currentCoverage.lines.covered / currentCoverage.lines.total) * 100
        : 0,
      totalBranches: currentCoverage.branches.total,
      coveredBranches: currentCoverage.branches.covered,
      branchPercent: currentCoverage.branches.total > 0
        ? (currentCoverage.branches.covered / currentCoverage.branches.total) * 100
        : 0,
      totalFunctions: currentCoverage.functions.total,
      coveredFunctions: currentCoverage.functions.covered,
      functionPercent: currentCoverage.functions.total > 0
        ? (currentCoverage.functions.covered / currentCoverage.functions.total) * 100
        : 0,
    };

    const phaseBreakdown = {} as Record<PhaseId, { lines: number; covered: number; percent: number; files: string[] }>;
    for (const [phase, data] of Object.entries(currentCoverage.phaseCoverage)) {
      phaseBreakdown[phase as PhaseId] = {
        lines: data.total,
        covered: data.covered,
        percent: data.total > 0 ? (data.covered / data.total) * 100 : 0,
        files: data.files,
      };
    }

    const recommendations = this.generateRecommendations(summary, trends);

    return {
      generatedAt: new Date().toISOString(),
      summary,
      phaseBreakdown,
      trends,
      recommendations,
    };
  }

  private generateRecommendations(
    summary: CoverageReport['summary'],
    trends: CoverageTrend,
  ): string[] {
    const recommendations: string[] = [];

    if (summary.linePercent < 80) {
      recommendations.push(`Line coverage at ${summary.linePercent.toFixed(1)}% is below 80% target`);
    }

    if (summary.branchPercent < 70) {
      recommendations.push(`Branch coverage at ${summary.branchPercent.toFixed(1)}% is below 70% target`);
    }

    for (const regression of trends.regressions) {
      recommendations.push(
        `Phase ${regression.phase} coverage dropped by ${Math.abs(regression.change).toFixed(1)}%`
      );
    }

    if (trends.direction === 'declining') {
      recommendations.push('Overall coverage trend is declining - review recent changes');
    }

    return recommendations;
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        this.history = JSON.parse(content) as CoveragePoint[];
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    const dir = path.dirname(this.historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), 'utf-8');
  }
}

/**
 * Parse coverage from lcov.info file.
 */
export function parseLcovFile(lcovPath: string): {
  lines: { total: number; covered: number };
  branches: { total: number; covered: number };
  functions: { total: number; covered: number };
  files: Array<{ path: string; lines: { total: number; covered: number } }>;
} {
  const content = fs.readFileSync(lcovPath, 'utf-8');

  let totalLines = 0;
  let coveredLines = 0;
  let totalBranches = 0;
  let coveredBranches = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  const files: Array<{ path: string; lines: { total: number; covered: number } }> = [];

  let currentFile = '';
  let fileLines = 0;
  let fileCovered = 0;

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      if (currentFile) {
        files.push({ path: currentFile, lines: { total: fileLines, covered: fileCovered } });
      }
      currentFile = line.slice(3);
      fileLines = 0;
      fileCovered = 0;
    } else if (line.startsWith('DA:')) {
      const parts = line.slice(3).split(',');
      const hit = Number.parseInt(parts[1] ?? '0', 10);
      fileLines++;
      totalLines++;
      if (hit > 0) {
        fileCovered++;
        coveredLines++;
      }
    } else if (line.startsWith('BRDA:')) {
      const parts = line.slice(5).split(',');
      const taken = Number.parseInt(parts[3] ?? '0', 10);
      totalBranches++;
      if (taken > 0) {
        coveredBranches++;
      }
    } else if (line.startsWith('FNDA:')) {
      const parts = line.slice(5).split(',');
      const execCount = Number.parseInt(parts[0] ?? '0', 10);
      totalFunctions++;
      if (execCount > 0) {
        coveredFunctions++;
      }
    }
  }

  if (currentFile) {
    files.push({ path: currentFile, lines: { total: fileLines, covered: fileCovered } });
  }

  return {
    lines: { total: totalLines, covered: coveredLines },
    branches: { total: totalBranches, covered: coveredBranches },
    functions: { total: totalFunctions, covered: coveredFunctions },
    files,
  };
}

/**
 * Get phase from file path.
 */
export function getPhaseFromPath(filePath: string): PhaseId | null {
  const phasePattern = /phase[_-]?(\d+(?:\.\d+)?)/i;
  const match = phasePattern.exec(filePath);
  if (match) {
    return match[1] as PhaseId;
  }
  return null;
}

/**
 * Group coverage by phase.
 */
export function groupCoverageByPhase(
  files: Array<{ path: string; lines: { total: number; covered: number } }>,
): Record<PhaseId, { total: number; covered: number; files: string[] }> {
  const byPhase: Record<string, { total: number; covered: number; files: string[] }> = {};

  for (const file of files) {
    const phase = getPhaseFromPath(file.path);
    const phaseKey = phase ?? 'unknown';

    if (!byPhase[phaseKey]) {
      byPhase[phaseKey] = { total: 0, covered: 0, files: [] };
    }

    byPhase[phaseKey].total += file.lines.total;
    byPhase[phaseKey].covered += file.lines.covered;
    byPhase[phaseKey].files.push(file.path);
  }

  return byPhase as Record<PhaseId, { total: number; covered: number; files: string[] }>;
}
