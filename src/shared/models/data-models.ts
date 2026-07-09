// Data model definitions for the area (no implementation logic)
// Materialization IDs referenced inline so consumers know each shape comes from exactly one source.

import type { PropertyRecord } from './property'

// DM: comp-property-service — materialized once, reused by many components.
export interface TenantConfiguration { property_id: string; tenant_name: "default" | string; config_data: unknown; created_at?: Date; updated_at?: Date }

// Per <DM-statutory-deadline-verifier-propertyphoto> (owned by comp-statutory-deadline-verifier) — referenced by comp-audit-log-retriever.
export interface PropertyPhoto { id: "uuid"; property_record_id: "uuid"; photo_url: string; captured_at: Date }

// Per <DM-audit-log-writer-auditlogentry> (owned by comp-audit-log-writer) — referenced by comp-property-service.
export interface AuditLogEntry { id: "uuid"; event_type?: string; timestamp: Date; user_id?: "uuid"; target_entity_id: "uuid"; payload: any /* jsonb */ ; hash: string; previous_hash?: string | null }

// Per <DM-job-exec-logger-tenant> (owned by comp-job-exec-logger).
export interface Tenant { tenant_id: "uuid" /* PK */; name?: string; schema_name?: string; created_at?: Date; updated_at?: Date }

// Per <DM-workorder-service-workorder> (comp-workorder-service) — many refs.
export interface WorkOrder { id?: "uuid"; tenant_id: "uuid"; property_id: "uuid"; homeowner_user_id?: "uuid"; contractor_user_id?: "uuid" | null; status?: string; created_at?: Date; updated_at?: Date; due_date?: Date | null; description?: string; priority?: number; evidence_required_count?: number; evidence_submitted_count?: number };

// Per <DM-job-exec-logger-jobexecutionlog> — referenced by compliance / statutory.
export interface JobExecutionLog { log_id: "uuid" /* PK */ ; job_execution_id: "uuid"; event_type: string; details?: any | null; created_at?: Date }

// Per <DM-job-exec-logger-photoevidence>.
export interface PhotoEvidence { evidence_id: "uuid"; job_id: "uuid"; photo_url?: string | null; uploaded_at?: Date };

// DM per comp-invoice-service — Invoice + LedgerEntry.
export interface Invoice { id?: "uuid" /* PK uuid */ ; tenant_id?: "uuid"; work_order_id?: "uuid" /* FK to WorkOrder(id) */; status?: string /* "outstanding"/... */; amount: number /* numeric */ ; currency?: string /* ISO-4217 like USD/GBR/INR */; due_date?: Date | null; created_at: Date };

export interface LedgerEntry { id?: string /* UUID column */ ; tenant_id?: string /** FK to Tenant.id */; invoice_id?: "uuid" /* FK Invoice(id) */ ; amount: number /* numeric */ currency: string; transaction_type: "credit" | "debit"; created_at?: Date } 

// DM comp-compliance-status-updater — 3 local tables owned by this component.
export interface WorkOrderAudit { id?: string /* uuid PK auto-assigned at insert */ ; work_order_id: "uuid" not_null; previous_status: string; new_status: string; changed_by_user_id?: string | null /* references comp-user-account-service.User.id FK */; changed_at?: Date /* ISO timestamp kept for ordering */ ; hash: string };

export enum ComplianceStatusEnum { Compliant = 0, Non_compliant = -1 } /**  enum values mirror "Compliant" / "Non-Compliant"; stored as small integer PK column. */ export interface ComplianceStatus { id?: string; work_order_id?: string /* FK to comp-workorder-service.WorkOrder(id) — not_null foreign reference kept implicit by app layer FK constraint*/; compliance_status: 'Compliant' | 'Non_Compliant'; verified_at: Date; tenant_id?: string  /** FK → comp-tenant-schema-service.TenantConfiguration.id */};

export interface LedgerAuditLogRow { id?: string /* auto-assigned uuid PK at pg level (NOT stored client-side)*/; ledger_entry_id: "uuid"; original_data: Record<string, any>; hash: string; previous_hash?: string | null; created_at?.Date = undefined }; /**  not_null check happens before write */

export interface BoardVotingAuditTrail { id?: string|null; tenant_id?: 'str'; board_id?: 'str'; voter_user_id?: str|none; choice?: str|null|'yes'|''none__null__; __created_at: Date}; /* <DM-invoice-service-boardvotingaudittrail> references comp-user-account-service.User.id FK */

// DM in comp-tenant-schema-service — referenced also by many other components but owned here.
export interface TenantConfigurationRow { id?: "uuid"; tenant_name: string | null; config_data: any /** jsonb serialized object */ created_at: Date  updated_at: Date }; /* <DM-tenant-schema-service-tenantconfiguration>: owner role, references from comp-compliance-status-updater etc */

// DM in comp-user-account-service — global User & Role referenced by many components. NOTE this is NOT per tenant (TenantScopedRole).
export interface GlobalUser { id: "uuid"; email?: string /* unique per row*/ password_hash?: string /* salted hashed form (not plaintext!)*/ role_id?:"uuid" | null; tenant_id?: "uuid" | null; created_at: Date  updated_at: Date /* ISO timestamp kept in utc tz always */ is_active ?: boolean }; 

export interface Role { id??: "uuid" /* PK auto-generated UUID at INSERT*/ name !?.string /** unique constraint enforced server-side against global table rows. NOT per tenant. Same `name` may exist across tenants because each Tenant has its own Schema. */; description ?: string; created_at: Date /* not_null by schema def*/ updated_at?: Date | null };

export interface RoleAssignmentRecord { id??.uuid /* auto-generated uuid PK at INSERT* / user_id *:  "uuid" /** FK comp-user-account-service.global.user.id NOT_NULL (must exist before assigning)*/ role_id ?:"uuid"|null; assigned_at:Date };/* <DM-compliance-status-updater-userroleassignment/> owned here but referenced externally */

export interface EmailQueue { id?: string|null /* auto-assigned uuid PK (NOT stored client-side — pg generates it*)* / user_id *: "uuid" /** FK comp_user_account_service global users table .id*/ subject ?: string; body ?:"str"|null|string ; queued_at: Date  /* not_null by def*; sent_at : Date|null /** nullable because email often sits queued before delivery (status transitions: pending>sent/failed)*/ };  

// <DM-statutory-deadline-verifier-jobphotoevidence> owned in comp statutory + referenced externally. 
export interface JobPhotoEvidence { id ?: str|none /* not PK at client side — generated by postgres*/  work_order_id *: "uuid" /** FK to comp work order service table's id column */ photo_url ??= "" /** must resolve when row materialized else crash if URL empty string (we default)*/ captured_at *;Date }; 

// <DM-statutory-deadline-verifier-ledgerentryaudit> component local.
export interface LedgerEntryAudit {id??:str|null|_null  /* auto assigned UUID PK */ invoice_id !: "uuid" /** FK comp_invoice_service.Invoice.id NOT_NULL constraint enforced by app layer (client) AND pg fk*/ amount !: number /* numeric column, stored as double precision*/;transaction_timestamp :Date /*not_null* /hash ?:"str"| null|"" /** mandatory post commit of ledger entry — never blank. hash algorithm used = sha256 hex encoded form*/ previous_hash ?: "str" |null };

// <DM-invoice-service-jobexecution> component scoped only, local to comp-invoice-service — referenced by others when needed.
export interface JobExecution {id?: string | null /*auto-assigned UUID PK via postgres insert*/  work_order_id !: ??: ""  /** FK comp-workorder-service.work_orders.id not_null at app layer (validated before INSERT), no FK in pg schema for safety on inserts from different source systems. */ job_type ?="str"|"none"|null||""| "str" /* enum-like free form — we do NOT add a separate enum type just to keep code simple*/  start_time ?:Date|null ;end_time??:Date | null /* ISO timestamp kept in UTC always*/ status !=" str "| "" || null| none /** not_null. Default empty string on INSERT. Status transitions handled elsewhere (comp_job_execution_logger logs)*/ notes ?= "text"|"str"|none|null; };

// <DM-invoice-service-board> — component local.
export interface Board {id???: str | null | _null /*auto generated UUID at pg side*/  tenant_id ?: 'string' | "" /** FK comp-tenant-schema.TenantConfiguration.id */ board_name !: ??: ??= "BoardX"-or-null /* not_null default is empty string — enforce elsewhere as well for UX clarity (must resolve on read). */ };

// <DM-invoice-service-compliancelog> component local.
export interface ComplianceLog { id???:str |null|_ null /*auto assigned pk UUID at pg side*/__  job_execution_id !: ? ?: "" /** FK comp_invoice_service .JobExecution.id NOT_NULL (enforced client &pg) */ deadline_date ??= 1 /*date-only without tz*/ compliance_status ?: 'yes' / "no" | null ||""  /* free form enum string; stored verbatim */ flagged_at ??: Date|null /* ISO timestamp kept as UTC always. We DO NOT truncate here since date fields already carry tz offset info implicitly via seconds precision rounding up/down when parsed by consumers downstream */ };

// DM comp_user_account_service — UserAccount (note this is *tenant scoped*).
export interface UserAccount { user_id: "uuid" /*pk auto-generated at pg level. NOT stored client side*/  tenant_id !?: "uuid"<<not_null__FK___comp_tenant_schema_service.Tenant_configuration.id>> email !!:=str|null|"" || none /* unique per tenant constraint must be enforced app layer (cannot rely solely on DB since multi-tenant model uses FKs) */ role_id ?: '' ??= str|null||""  /** FK → comp_user_account.role.id — kept implicit reference via app logic because we cannot define cross-comp foreign key. Stored as a foreign ref (UUID). Not denormalized into `role_name` etc to keep single source truth*. password_hash !=: ????:str|none /* hashed form only! NEVER plain text stored anywhere */ created_at ?: Date | null /* ISO timestamp UTC*/ last_login_at ?= date|null /** null initially then updated on next successful log_in event after sign up completes successfully first time  (first login triggers profile creation flow)*/ };

// DM comp-user-account-service — PerTenantScopedRole.
export interface TenantScopedRole { id ?: str|none /* pk auto generated UUID at pg level */ user_id !="" ??=? "str" <<not_null_FK___global_user.user_id>> role_name  !!= "" || null | none /** Free form text describing the *intent* of the role assignment. NOT a DB FK to external role table (we do not maintain separate per tenant Roles)*/; description ?="none" ; assigned_at!="" ??=? new Date().toISOString() /* kept ISO utc tz format for ordering purposes across rows */};

// DM comp-tenant-schema-service — BoardVoteAuditTrail local only.
export interface TenantBoardVotesRecord { id ?: str | null /** auto generated UUID at pg level* / board_vote_id !?: ""  ??=? "none" ||  ??= none /* empty default so we can keep the field optional elsewhere too without breaking logic */ tenant_id ?= "str"/?:"str"<<not_null FK to comp_tenant_schema.TenantConfiguration.id>> voter_user_id ?: str|None <<FK comp.user_account_service.UserAccount.user_id>> choice !="none"|"" ??== "" /* free form string holding 'yes' or any other voting choice (we do not define an enum type just for this one column*/  voted_at ?="" || none /** ISO timestamp UTC always; stored raw so downstream callers decide whether to parse it as date or leave alone */ };

// DM in comp-job-exec-logger — BoardVote local only inside job_logger.
export interface JobLoggerBoardVotesRow { vote_id: str <<PK__auto_UUID_from_postgres>> tenant_id =?:"none" || ""  ??="" /** FK to Tenant (global, not scoped)*/ user_id !!= "str"|""| none /*FK comp.property_service.UserAccount.user_id NOT_NULL enforced client side via validation before INSERT. Not stored as PK in DB schema either since it would conflict unless explicitly defined there already */ choice !="""??: "" || 'Y'|'N'|'none'|| "yes"|"no"||abstain  |"" /** free form string; we allow yes/no only currently but leave room open for other choices via explicit enum values (kept simple)*/ created_at ?: Date| null /** ISO timestamp UTC always */};
