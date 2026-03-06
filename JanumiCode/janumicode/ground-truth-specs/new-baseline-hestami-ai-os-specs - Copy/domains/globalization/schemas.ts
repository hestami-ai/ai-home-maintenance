```typescript
// Globalization - Prisma Schemas and Type Definitions

// 1. Organization Globalization Base
export interface Organization {
  id: string; // cuid
  residencyZone: string; // e.g., 'US', 'EU', 'UK', 'CA', 'AU', 'APAC-SG'
  defaultLocale: string; // BCP-47, e.g., 'en-US'
  defaultTimezone: string; // IANA, e.g., 'Europe/London'
  defaultCurrencyCode: string; // ISO-4217, e.g., 'USD', 'EUR'
  legalCountryCode: string; // ISO-3166-1 alpha-2
  legalSubdivisionCode: string | null; // ISO-3166-2
  // ...
}

// 2. Global Address Model
export interface Address {
  id: string; // cuid
  countryCode: string; // ISO-3166-1 alpha-2
  subdivisionCode: string | null; // ISO-3166-2 (e.g., 'US-CA', 'CA-ON')
  locality: string; // City/Town
  postalCode: string; // Do not assume US Zip format
  components: any | null; // JSON for sorting codes, dependent localities
  formatted: string | null; // Cached display string
}

// 3. Tax and Legal Identifiers (One-to-Many instead of single taxId)
export type IdentifierType = 'EIN' | 'VAT_ID' | 'GST_HST' | 'ABN' | 'UTR' | 'OTHER';

export interface TaxIdentifier {
  id: string; // cuid
  entityId: string; // Polymorphic or direct relation to Association/Vendor
  identifierType: IdentifierType;
  countryCode: string;
  subdivisionCode: string | null;
  valueEncrypted: string;
  verifiedAt: Date | null;
  validFrom: Date | null;
  validTo: Date | null;
}

// 4. Multi-Currency Storage (Move away from Decimal(10,2))
// Use this pattern across AssessmentCharge, Payment, APInvoice, etc.
export interface Money {
  amountMinor: number; // BigInt or Int representing cents/pence
  currencyCode: string; // ISO-4217 code matching the organization's functional currency
}

// Optional: FX Metadata for cross-currency display/reporting
export interface FXMetadata {
  fxRate: number; // Decimal
  fxRateSource: string;
  fxRateTimestamp: Date;
  rateType: string;
}

// 5. Data Subject Requests (Compliance Hooks)
export type DSRType = 'EXPORT' | 'DELETE' | 'RECTIFY';

export interface DataSubjectRequest {
  id: string; // cuid
  organizationId: string; // Must execute within the tenant's residency zone
  requesterOpaqueId: string; // Zonal identifier
  type: DSRType;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  dbosWorkflowId: string | null; // Link for durable tracking/audit
  createdAt: Date;
}
```
