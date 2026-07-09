// per <DM-property-service-propertyrecord> — materializes PropertyRecord, owned by comp-property-service.
// Referenced by: comp-audit-log-retriever, comp-compliance-status-updater, comp-statutory-deadline-verifier,
//               comp-invoice-service, comp-job-exec-logger, comp-tenant-schema-service.

export interface PropertyRecord {
  // primary_key uuid for the property row in Postgres
  property_id: string;
  // FK → TenantConfiguration.id (comp-tenant-schema-service)
  tenant_id: string;
  // mailing / service / physical address of the real estate
  address: string;
  // jsonb — array / object describing key location photos associated with this property
  key_photos: unknown;
  // ISO-8601 creation timestamp (set at INSERT, never updated)
  created_at: Date;
}
