-- Create missing associations for COMMUNITY_ASSOCIATION orgs
INSERT INTO associations (id, organization_id, name, status, fiscal_year_end, settings, created_at, updated_at)
SELECT 
    gen_random_uuid()::text,
    o.id,
    o.name,
    'ONBOARDING'::"AssociationStatus",
    12,
    '{"boardSeats": 5, "totalUnits": 0}'::jsonb,
    NOW(),
    NOW()
FROM organizations o
WHERE o.type = 'COMMUNITY_ASSOCIATION'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM associations a WHERE a.organization_id = o.id);
