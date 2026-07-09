// Data models owned by comp-tenant-schema-service (and shared with consumers of it)

import type { PropertyRecord } from './property'    // for TenantConfiguration.config_data jsonb shape

/**  */
// <DM-tenant-schema-service-tenantconfiguration> — tenant name + JSON config blob
export interface TenantConfiguration {
  id: string;
  /** Human / machine-readable tenant name (unique) */
  tenant_name: string;
  /** Arbitrary configuration payload stored as text-encoded JSON in PG. */
  config_data: string;
  created_at: Date;
  updated_at: Date;
}

/**  */
// <DM-compliance-status-updater-roleassignment> — link users onto roles in a tenant context
export interface RoleAssignment {
  id: string;
  /** Foreign key to user.id (User table, comp-user-account-service) */
  user_id: string;
  role_id: string;
}

/**  */
// <DM-tenant-schema-service-jobevidence> — per-work-order capture artifact reference
export interface JobEvidence {
  id: string;
  work_order_id: string; /* references comp-workorder-service WorkOrder.id */
  photo_url: string;
  captured_at: Date;        // not_null, kept as full iso timestamp
  created_at: Date;         // not_null
}
