# Globalization - System Requirements

## 1. Core Principles
- **Strict Data Residency (Option C):** Organizations are pinned to a specific residency zone (e.g., EU, US, UK, CA, AU). ALL tenant-scoped business data, processing, and PII-bearing observability data MUST remain inside that zone.
- **Dichotomy of Control vs. Data:**
  - **Global Control Plane:** Handles DNS, edge routing, and zone orchestration. Rejects requests without `X-Org-Id`. Stores ONLY opaque identifiers (No PII).
  - **Zone Data Planes:** Fully independent Hestami stacks (SvelteKit, oRPC, DBOS, Postgres, Redis, Object Store) operating within the residency boundary.
- **Identity Isolation:** Users DO NOT belong to organizations across zones. An email address in the EU zone and the US zone represents two distinct, unconnected identities.

## 2. Infrastructure & Routing
- **Routing Key:** All API calls are routed sequentially by the edge proxy based on the `X-Org-Id` HTTP header.
- **High Availability (99.99):** HA is achieved *within* the zone boundary (e.g., multi-region within EU). Cross-zone failover of restricted data is strictly forbidden.
- **Backups:** Backups and PITR (Point-in-Time Recovery) logs MUST be stored within the same residency zone, with hard guarantees on target countries within the zone.

## 3. Data Classification Enforcement
- **R3 (Tenant PII / Business Data):** Cases, documents, accounting, communication logs, and trace payloads. MUST NEVER LEAVE THE ZONE. (Note: Email addresses are the ONLY PII allowed globally; all other identifiers, IPs, UAs are restricted to the zone).
- **R2 (Tenant Metadata):** Org IDs and Zone assignments. Allowed in Control Plane.
- **R1 (Global Operational):** Zone health and aggregate non-PII metrics. Allowed in Control Plane.
- **R0 (Public):** Marketing, Docs. Publicly accessible.

## 4. Multi-Currency Accounting
- **The Rule:** An organization operates with a single functional currency (`defaultCurrencyCode`).
- **Precision:** Financial values must shift from `Decimal(10,2)` to `amountMinor Int` (or `BigInt`) plus a `currencyCode` string (ISO-4217, e.g., 'USD', 'EUR') to prevent rounding drift.

## 5. Address and Identification Modeling
- **Non-US Addresses:** The concept of "state" is archaic and ambiguous globally. Use ISO-3166-1 (`countryCode`), ISO-3166-2 (`subdivisionCode`), and generic `locality`/`postalCode`.
- **Tax Identifiers:** Deprecate single `taxId` strings. Implement a one-to-many `TaxIdentifier` model (type, value, country) to support diverse global identifiers (EIN, VAT, GST, etc.).
- **Jurisdictions as Configuration:** Tax and regulatory schemas (e.g., invoice numbering rules, tax regimes) should be driven by a configurable `Jurisdiction` model rather than hard-coded into the schema.
