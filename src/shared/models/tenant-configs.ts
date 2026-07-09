export interface TenantConfiguration {
  /** Unique identifier for the tenant */
  id: string;
  
  /** Display-friendly name of the tenant (e.g., "Sunrise Valley HOA") */
  tenant_name: string;
  
  /** Raw JSON blob holding all runtime tenant settings */
  config_data: unknown;
  
  /** Created at timestamp (ISO-8601) */
  created_at: Date;
  
  /** Last modified at timestamp */
  updated_at?: Date;
}

export type TenantConfigurationRecord = {
  id?: string;
  tenant_name: string;
  config_data: unknown;
  created_at?: Date;
  updated_at?: Date;
};
