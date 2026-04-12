/**
 * OpenAI Codex CLI provider — command construction and detection.
 */

import { execSync } from 'child_process';

export interface CodexCliConfig {
  command?: string;
}

export class CodexCliProvider {
  private readonly command: string;

  constructor(config?: CodexCliConfig) {
    this.command = config?.command ?? 'codex';
  }

  buildCommand(prompt: string): { command: string; args: string[] } {
    return {
      command: this.command,
      args: ['-q', prompt],
    };
  }

  isAvailable(): boolean {
    try {
      execSync(`${this.command} --version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  getVersion(): string | null {
    try {
      return execSync(`${this.command} --version`, {
        stdio: 'pipe', timeout: 5000, encoding: 'utf-8',
      }).trim();
    } catch {
      return null;
    }
  }
}
