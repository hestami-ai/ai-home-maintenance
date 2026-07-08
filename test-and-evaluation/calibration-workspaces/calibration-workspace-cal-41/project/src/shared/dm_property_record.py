# DM-audit-log-retriever-propertyrecord — canonical shape for PropertyRecord, referenced by:
# comp-audit-log-retriever, comp-compliance-status-updater, comp-statutory-deadline-verifier,
# comp-invoice-service, comp-job-exec-logger, comp-property-service, comp-tenant-schema-service.

from __future__ import annotations
import uuid as _uuid
from datetime import datetime
from typing import TypedDict


class PropertyRecord(TypedDict):
    """A single address/property record. Fields reconcile divergent field names by
    materialisng a single canonical view (split address + flat alias)."""

    id: str  # uuid
    tenant_id: str  # uuid
    property_id: str  # uuid — synonym for ``id`` (kept for backwards compat)
    address_street: str | None
    address_line1: str
    address_line2: str | None
    city: str
    address_city: str
    state: str
    address_state: str
    zip_code: str
    address_zip: str
    key_photos_jsonb: dict[str, object] | None  # reconciled from split jsonb/json/array/string
    key_photo_urls: list[str] | None  # flattened view of ``key_photos`` (jsonb)
    key_photos: list[str]  # canonical array<string>; redundant alias kept for callers
    address: str  # derived full-address string
    created_at: datetime
    updated_at: timestamp: datetime
