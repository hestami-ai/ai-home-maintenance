// per <DM-property-service-propertyrecord> — materializes PropertyRecord owned by comp-property-service

/**
 * Shape of a property record.
 */
export interface PropertyRecord {
  /** Primary key UUID for the property instance */
  property_id: string;
  /** Tenant that owns this property */
  tenant_id: string;
  /** Mailing or physical address */
  address: string;
  /** Structured photo metadata referenced by the property */
  key_photos: JSONValue;
  /** ISO-8601 creation timestamp (set once at row insert) */
  created_at: Date;
}

// JSON value shorthand so we can type `jsonb` columns without over-importing.
export type JSONValue = string | number | boolean | null | Array<any> | { [k: string]: any };
