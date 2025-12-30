/**
 * Organization API client wrapper
 * 
 * Provides type exports for organization-related data.
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract OrganizationListItem type from organization.list response (array element)
export type OrganizationListItem = operations['organization.list']['responses']['200']['content']['application/json']['data']['organizations'][number];

// Extract the full list response data
export type OrganizationListData = operations['organization.list']['responses']['200']['content']['application/json']['data'];

// Extract Organization type from organization.create response
export type OrganizationCreateResponse = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];

// Extract Organization type from organization.get response
export type OrganizationGetResponse = operations['organization.get']['responses']['200']['content']['application/json']['data']['organization'];

// =============================================================================
// Helper Labels for UI
// =============================================================================

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
	INDIVIDUAL_PROPERTY_OWNER: 'Individual Property Owner',
	TRUST_OR_LLC: 'Trust or LLC',
	COMMUNITY_ASSOCIATION: 'Community Association',
	MANAGEMENT_COMPANY: 'Management Company',
	SERVICE_PROVIDER: 'Service Provider',
	COMMERCIAL_CLIENT: 'Commercial Client',
	EXTERNAL_SERVICE_PROVIDER: 'External Service Provider',
	PLATFORM_OPERATOR: 'Platform Operator'
};

export const ORGANIZATION_STATUS_LABELS: Record<string, string> = {
	ACTIVE: 'Active',
	SUSPENDED: 'Suspended',
	INACTIVE: 'Inactive'
};
