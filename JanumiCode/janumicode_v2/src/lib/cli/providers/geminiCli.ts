/**
 * Gemini CLI provider — command construction and detection.
 */

import { execSync } from 'child_process';

export interface GeminiCliConfig {
  command?: string;
}

export class GeminiCliProvider {
  private readonly command: string;

  constructor(config?: GeminiCliConfig) {
    this.command = config?.command ?? 'gemini';
  }

  buildCommand(prompt: string): { command: string; args: string[] } {
    return {
      command: this.command,
      args: ['--prompt', prompt, '--format', 'json'],
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
