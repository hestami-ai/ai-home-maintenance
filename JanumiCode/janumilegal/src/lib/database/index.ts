/**
 * Database module public surface.
 *
 * The DAL is the only sanctioned path for SQL execution against domain tables.
 * Direct better-sqlite3 access outside this module is rejected by
 * `scripts/lintLayers.ts`.
 */

export { openDirect } from './directDb.js';
export { runMigrations, validateSchema } from './migrations.js';
export { ScopedDal, FirmDal } from './scopedDal.js';
export { ClvDal } from './clvDal.js';
export { VccDal } from './vccDal.js';
export { PromptTemplateDal } from './promptTemplateDal.js';
export { ManifestDal } from './manifestDal.js';
export { ActivationDal } from './activationDal.js';
export { OpStreamDal } from './opStreamDal.js';
export { AgentRegistryDal } from './agentRegistryDal.js';
export { PrivilegeFrameDal } from './privilegeFrameDal.js';
export { ExportDal } from './exportDal.js';
export { MatterKeysDal } from './matterKeysDal.js';
export { ConflictsDal } from './conflictsDal.js';
export { TraceDal } from './traceDal.js';
export { BriefBankDal } from './briefBankDal.js';
export { AttorneyAdmissionsDal } from './attorneyAdmissionsDal.js';
export { AttorneyActionDal } from './attorneyActionDal.js';
export { DashboardDal } from './dashboardDal.js';
export { LensMigrationsDal } from './lensMigrationsDal.js';
export { SCHEMA_V1_VERSION, SCOPED_DOMAIN_TABLES, UNSCOPED_REGISTRY_TABLES } from './schema.js';
export type { Scope, PartialScope } from './types.js';
