-- Update processing queue stats to include all required metrics for Phase 8
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
  -- Currently Processing
  SELECT 
    'currently_processing'::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'PROCESSING'
    AND d.deleted_at IS NULL
  
  UNION ALL
  
  -- Failed - Awaiting Retry
  SELECT 
    'failed_awaiting_retry'::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'PROCESSING_FAILED'
    AND d.processing_error_type = 'TRANSIENT'
    AND d.processing_attempt_count < 3 -- Assuming default max attempts
    AND d.deleted_at IS NULL
    
  UNION ALL
  
  -- Failed - Needs Attention
  SELECT 
    'failed_needs_attention'::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'PROCESSING_FAILED'
    AND (d.processing_error_type = 'PERMANENT' OR d.processing_attempt_count >= 3)
    AND d.deleted_at IS NULL
    
  UNION ALL
  
  -- Infected - Quarantined
  SELECT 
    'infected_quarantined'::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'INFECTED'
    AND d.deleted_at IS NULL
    
  UNION ALL
  
  -- Processed Today
  SELECT 
    'processed_today'::TEXT as metric_name,
    COUNT(*)::BIGINT as metric_value
  FROM documents d
  WHERE d.status = 'ACTIVE'
    AND d.processing_completed_at >= CURRENT_DATE
    AND d.deleted_at IS NULL
    
  UNION ALL
  
  -- Success Rate (Last 24h)
  SELECT 
    'success_rate_24h'::TEXT as metric_name,
    CASE 
      WHEN (COUNT(*) FILTER (WHERE d.status = 'ACTIVE' OR d.status = 'PROCESSING_FAILED')) = 0 THEN 100::BIGINT
      ELSE (COUNT(*) FILTER (WHERE d.status = 'ACTIVE') * 100 / COUNT(*))::BIGINT
    END as metric_value
  FROM documents d
  WHERE d.processing_completed_at >= NOW() - INTERVAL '24 hours'
    AND d.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_processing_queue_stats() TO hestami_app;
