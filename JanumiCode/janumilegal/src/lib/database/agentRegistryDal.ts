/**
 * Agent registry persistence.
 *
 * The in-memory AgentRegistry holds the runtime view; this DAL persists
 * registrations to the agents table so registry contents survive restart.
 */

import type Database from 'better-sqlite3';
import type { AgentRegistryEntry } from '../registry/agentRegistry.js';

interface DbRow {
  agent_id: string;
  display_name: string;
  tier: string;
  capability_group_a: string | null;
  capability_group_b: string | null;
  capability_group_c: string | null;
  permitted_lenses_json: string;
  permitted_states_json: string;
  input_schema: string;
  output_schema: string;
  prohibited_actions_json: string;
  required_validators_json: string;
  confidence_policy_json: string;
  authority_policy_json: string;
  privilege_policy_json: string;
  version: string;
}

export class AgentRegistryDal {
  constructor(private readonly db: Database.Database) {}

  insert(entry: AgentRegistryEntry): void {
    this.db
      .prepare(
        `INSERT INTO agents
         (agent_id, display_name, tier, capability_group_a, capability_group_b, capability_group_c,
          permitted_lenses_json, permitted_states_json, input_schema, output_schema,
          prohibited_actions_json, required_validators_json,
          confidence_policy_json, authority_policy_json, privilege_policy_json, version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.agentId,
        entry.displayName,
        entry.tier,
        entry.capabilityGroupA ?? null,
        entry.capabilityGroupB ?? null,
        entry.capabilityGroupC ?? null,
        JSON.stringify(entry.permittedLenses),
        JSON.stringify(entry.permittedStates),
        entry.inputSchema,
        entry.outputSchema,
        JSON.stringify(entry.prohibitedActions),
        JSON.stringify(entry.requiredValidators),
        JSON.stringify(entry.confidencePolicy),
        JSON.stringify(entry.authorityPolicy),
        JSON.stringify(entry.privilegePolicy),
        entry.version,
        new Date().toISOString(),
      );
  }

  has(agentId: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM agents WHERE agent_id = ?').get(agentId);
    return !!row;
  }

  all(): AgentRegistryEntry[] {
    const rows = this.db.prepare('SELECT * FROM agents').all() as DbRow[];
    return rows.map(rowToEntry);
  }
}

function rowToEntry(row: DbRow): AgentRegistryEntry {
  return {
    agentId: row.agent_id,
    displayName: row.display_name,
    tier: row.tier as AgentRegistryEntry['tier'],
    capabilityGroupA: (row.capability_group_a ?? undefined) as AgentRegistryEntry['capabilityGroupA'],
    capabilityGroupB: (row.capability_group_b ?? undefined) as AgentRegistryEntry['capabilityGroupB'],
    capabilityGroupC: (row.capability_group_c ?? undefined) as AgentRegistryEntry['capabilityGroupC'],
    permittedLenses: JSON.parse(row.permitted_lenses_json) as string[],
    permittedStates: JSON.parse(row.permitted_states_json) as string[],
    inputSchema: row.input_schema,
    outputSchema: row.output_schema,
    prohibitedActions: JSON.parse(row.prohibited_actions_json) as string[],
    requiredValidators: JSON.parse(row.required_validators_json) as string[],
    confidencePolicy: JSON.parse(row.confidence_policy_json) as AgentRegistryEntry['confidencePolicy'],
    authorityPolicy: JSON.parse(row.authority_policy_json) as AgentRegistryEntry['authorityPolicy'],
    privilegePolicy: JSON.parse(row.privilege_policy_json) as AgentRegistryEntry['privilegePolicy'],
    version: row.version,
  };
}
