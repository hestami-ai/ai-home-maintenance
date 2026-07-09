// <DM-audit-log-writer-auditlogentry> — append-only hash-chained row
export interface AuditLogEntry {
  id: string;
  event_type?: string;
  timestamp: Date; // not_null ISO-timestamp (ISO-8601 TZ-aware)
  user_id?: string | null;         // FK to any User.id that authored the change
  target_entity_id: string;        // not_null — identifies which entity changed
  payload: unknown;                // jsonb / arbitrary JSON blob
  hash: string;                    // MD5/SHA-payload digest (not_null)
  previous_hash?: string | null;   // FK-like link to prior_audit.id.hash, null on first audit
}

// <DM-property-service-boardvoteaudittrail> — Board vote row owned by property service
export interface BoardVoteAuditTrail {
  board_vote_id: string;           // not_null PK uuid
  work_order_id: string;           // not_null — references WorkOrder.id
  tenant_id?: PropertyRecord | null;   // FK to TenantConfiguration.id (Tenant)
  voter_user_id?: string | null;       // references comp-property-service UserAccount.user_id
  choice!: 'Yes' | 'No';             // not_null enum constraint
  voted_at: Date;                // not_null timestamp of casting
}

// <DM-tenant-schema-service-jobevidence> — per work order evidence attach
export interface JobEvidence {
  id: string;                        // PK uuid
  work_order_id?: WorkOrder | null;       // FK to comp-workorder-service.WorkOrder.id (not_null)
  photo_url: string;               // S3/SeaweedFS location or public URL
  captured_at: Date;                 // not_null ISO-timestamp — when the camera shot happened
  created_at: Date;                // not_null app-generated insertion ts
}

interface PropertyRecord { id?: string }
interface WorkOrder { tenant_id?: string; property_id?: any }
