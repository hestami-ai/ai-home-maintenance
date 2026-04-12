/**
 * System capabilities — help, getSettings, getVersion.
 *
 * Note: `help` needs the registry, but the registry imports capabilities, so
 * we accept the registry via the CapabilityContext at registration time
 * (see ClientLiaisonAgent.registerAllCapabilities — it injects a closure).
 */

import type { Capability, CapabilityRegistry } from '../index';

export const getVersion: Capability<Record<string, never>, { version: string }> = {
  name: 'getVersion',
  category: 'system',
  description: 'Return the JanumiCode version SHA pinned to the current workflow.',
  parameters: { type: 'object', properties: {} },
  execute: async (_p, ctx) => ({ version: ctx.orchestrator.janumiCodeVersionSha }),
  formatResponse: (r) => `JanumiCode version: \`${r.version}\``,
};

export const getSettings: Capability<Record<string, never>, { settings: string }> = {
  name: 'getSettings',
  category: 'system',
  description: 'Return the current JanumiCode configuration as JSON.',
  parameters: { type: 'object', properties: {} },
  execute: async (_p, _ctx) => {
    // The orchestrator does not currently expose configManager directly;
    // return a placeholder note. Wave 5 minimal: surface the workspace path.
    return {
      settings:
        'Settings are managed via .janumicode/config.json in the workspace root.',
    };
  },
  formatResponse: (r) => r.settings,
};

/**
 * `help` is constructed at registration time so it can capture the registry
 * for `formatHelp()`. Use `makeHelpCapability(registry)` from
 * ClientLiaisonAgent.
 */
export function makeHelpCapability(registry: CapabilityRegistry): Capability<Record<string, never>, string> {
  return {
    name: 'help',
    category: 'system',
    description:
      'List all Client Liaison capabilities by category. Use when the user asks "what can you do?".',
    parameters: { type: 'object', properties: {} },
    execute: async () => registry.formatHelp(),
    formatResponse: (text) => text,
  };
}

export function buildSystemCapabilities(registry: CapabilityRegistry) {
  return [getVersion, getSettings, makeHelpCapability(registry)];
}
