// Data models owned by comp-workorder-service (referenced by many components)

/**
 * @description Materializes the WorkOrder row — core job order entity.
 * <DM-workorder-service-workorder>
 */
export interface WorkOrder {
  id: string;                           // nullable pk uuid
  tenant_id: string;                    // foreign key → Tenant.id
  property_id: string;                  // foreign key → PropertyRecord.property_id
  homeowner_user_id: string;            // FK → UserAccount.user_id (per-tenant view)
  contractor_user_id?: string | null;   // optional contractor assignment
  status: WorkOrderStatus;              // enum-string: drafting/active/done/on-hold
  created_at: Date;                     // not_null ISO-timestamp, kept by PG def default
  updated_at: Date;                     // updated via trigger on payload change
  due_date?: Date | null;               // nullable statutory deadline
  description: string;                  // plain text job summary
  priority: number;                      // integer, lower number = higher urgency
  evidence_required_count: number;     // target photo capture count (from TenantConfiguration)
  evidence_submitted_count: number;    // snapshot of submitted count at latest review
}

/** @enum — canonical work-order lifecycle state. */
export type WorkOrderStatus = 'drafting' | 'active'          | 'done'       | 'on-hold' | 'cancelled';

/**
 * @description Photo evidence row attached to a generic job (not tied exclusively
 *  to a work order). <DM-workorder-service-job>
 */
export interface Job {
  id: string;                         // PK uuid
  work_order_id?: string | null;      // nullable FK → WorkOrder.id
  status: 'active' | 'completed' | 'cancelled';
  created_at: Date;                   // not_null ISO timestamp on INSERT
  completed_at?: Date | null;         // set when work order transitions to done
  payment_processed: boolean;        // default false, flipped by comp-invoice-service
}

export type JobStatus = Job['status'];
