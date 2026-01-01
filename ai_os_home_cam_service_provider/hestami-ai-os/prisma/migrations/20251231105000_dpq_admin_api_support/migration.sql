-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- Insert initial DPQ settings if not exists
INSERT INTO "system_settings" (key, value, updated_at, updated_by)
VALUES ('dpq_settings', '{
  "autoRetryEnabled": true,
  "maxRetryAttempts": 3,
  "retryIntervalSeconds": 300,
  "retryBackoffMultiplier": 2,
  "infectedRetentionDays": 30
}'::jsonb, NOW(), 'SYSTEM')
ON CONFLICT (key) DO NOTHING;

-- Enhanced list function for admin
DROP FUNCTION IF EXISTS list_documents_admin(TEXT, TEXT, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION list_documents_admin(
  p_status TEXT DEFAULT NULL,
  p_error_type TEXT DEFAULT NULL,
  p_org_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  organization_id TEXT,
  organization_name TEXT,
  title TEXT,
  status TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  processing_attempt_count INTEGER,
  processing_error_type TEXT,
  processing_error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id::TEXT,
    d.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    d.title::TEXT,
    d.status::TEXT,
    d.file_name::TEXT,
    d.file_size::BIGINT,
    d.mime_type::TEXT,
    d.processing_attempt_count,
    d.processing_error_type,
    d.processing_error_message,
    d.processing_started_at,
    d.processing_completed_at,
    d.processing_next_retry_at,
    d.created_at,
    d.updated_at
  FROM documents d
  JOIN organizations o ON o.id = d.organization_id
  WHERE (p_status IS NULL OR d.status::TEXT = p_status)
    AND (p_error_type IS NULL OR d.processing_error_type = p_error_type)
    AND (p_org_id IS NULL OR d.organization_id = p_org_id)
    AND d.deleted_at IS NULL
  ORDER BY d.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION list_documents_admin(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO hestami_app;

-- Update processing queue stats to include more metrics
DROP FUNCTION IF EXISTS get_processing_queue_stats();
CREATE OR REPLACE FUNCTION get_processing_queue_stats()
RETURNS TABLE (
  metric_name TEXT,
  metric_value BIGINT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Counts by status
  SELECT 
    d.status::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status::TEXT IN ('PENDING_UPLOAD', 'PROCESSING', 'PROCESSING_FAILED', 'INFECTED')
    AND d.deleted_at IS NULL
  GROUP BY d.status
  
  UNION ALL
  
  -- Processed today
  SELECT 
    'PROCESSED_TODAY' as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'ACTIVE'
    AND d.processing_completed_at >= CURRENT_DATE
    AND d.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_processing_queue_stats() TO hestami_app;
