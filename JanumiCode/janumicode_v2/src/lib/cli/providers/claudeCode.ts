/**
 * Claude Code CLI provider — command construction and detection.
 * Based on JanumiCode Spec v2.3, §16.1.
 */

import { execSync } from 'child_process';

export interface ClaudeCodeConfig {
  /** Override command name (default: 'claude') */
  command?: string;
}

export class ClaudeCodeProvider {
  private readonly command: string;

  constructor(config?: ClaudeCodeConfig) {
    this.command = config?.command ?? 'claude';
  }

  /**
   * Build the command and args for a Claude Code CLI invocation.
   * Uses: claude -p "<prompt>" --output-format stream-json
   */
  buildCommand(prompt: string): { command: string; args: string[] } {
    return {
      command: this.command,
      args: ['-p', prompt, '--output-format', 'stream-json'],
    };
  }

  /**
   * Check if Claude Code CLI is installed and accessible.
   */
  isAvailable(): boolean {
    try {
      execSync(`${this.command} --version`, {
        stdio: 'pipe',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the installed version.
   */
  getVersion(): string | null {
    try {
      const output = execSync(`${this.command} --version`, {
        stdio: 'pipe',
        timeout: 5000,
        encoding: 'utf-8',
      });
      return output.trim();
    } catch {
      return null;
    }
  }
}
