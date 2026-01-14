-- Security Fix: Add SET search_path = public to SECURITY DEFINER functions
-- This prevents search_path hijacking attacks (R7 compliance)
--
-- Reference: https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
-- "A SECURITY DEFINER function should always be created with SET search_path = public"
--
-- This migration fixes the core RLS context functions that were defined without
-- the SET search_path directive in earlier migrations.

-- Fix current_org_id() - core RLS context function
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '');
END;
$$ LANGUAGE plpgsql;

-- Fix current_assoc_id() - association-level RLS context function
CREATE OR REPLACE FUNCTION current_assoc_id()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_assoc_id', true), '');
END;
$$ LANGUAGE plpgsql;

-- Fix is_org_staff() - staff identification helper
CREATE OR REPLACE FUNCTION is_org_staff()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_org_staff', true) = 'true', false);
END;
$$ LANGUAGE plpgsql;

-- Fix current_user_id() - user identification helper
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql;

-- Fix set_org_context_audited() - context setter with audit support
DROP FUNCTION IF EXISTS set_org_context_audited(TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION set_org_context_audited(
  p_user_id TEXT,
  p_org_id TEXT,
  p_assoc_id TEXT DEFAULT NULL,
  p_is_staff BOOLEAN DEFAULT false,
  p_reason TEXT DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', COALESCE(p_org_id, ''), false);
  PERFORM set_config('app.current_assoc_id', COALESCE(p_assoc_id, ''), false);
  PERFORM set_config('app.current_user_id', COALESCE(p_user_id, ''), false);
  PERFORM set_config('app.is_org_staff', p_is_staff::TEXT, false);

  RAISE DEBUG 'RLS context set: user=%, org=%, assoc=%, is_staff=%, reason=%',
    p_user_id, p_org_id, p_assoc_id, p_is_staff, p_reason;
END;
$$ LANGUAGE plpgsql;

-- Fix clear_org_context_audited() - context clearer
DROP FUNCTION IF EXISTS clear_org_context_audited(TEXT);
CREATE OR REPLACE FUNCTION clear_org_context_audited(p_user_id TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', '', false);
  PERFORM set_config('app.current_assoc_id', '', false);
  PERFORM set_config('app.current_user_id', '', false);
  PERFORM set_config('app.is_org_staff', 'false', false);
  RAISE DEBUG 'RLS context cleared by user=%', p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Fix check_document_assignment() - document access checker
CREATE OR REPLACE FUNCTION check_document_assignment(p_doc_id TEXT, p_user_id TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder for assignment-based access logic
  -- In a future phase, this will join through DocumentContextBinding
  -- to verify if the user has an active assignment (Work Order / Case)
  -- that grants them visibility to this document.
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Fix set_current_org_id() - legacy context setter from rls_setup migration
CREATE OR REPLACE FUNCTION set_current_org_id(org_id TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id, false);
END;
$$ LANGUAGE plpgsql;

