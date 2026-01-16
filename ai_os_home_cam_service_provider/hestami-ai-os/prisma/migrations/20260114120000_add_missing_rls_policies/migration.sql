-- Phase 35: Add Missing RLS Policies for Concierge Platform Tables
-- This migration adds RLS to tables that were missed in the original RLS setup
--
-- Design Principles:
-- 1. Direct org-scoped tables use owner_org_id column
-- 2. Join-based tables use EXISTS subquery for related table lookup
-- 3. All tables use FORCE ROW LEVEL SECURITY for strictest enforcement

-- =============================================================================
-- PART 1: INDIVIDUAL PROPERTY TABLES (owner_org_id column)
-- =============================================================================

-- individual_properties
ALTER TABLE individual_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_properties FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_individual_properties_select ON individual_properties
  FOR SELECT USING (owner_org_id = current_org_id());
CREATE POLICY rls_individual_properties_insert ON individual_properties
  FOR INSERT WITH CHECK (owner_org_id = current_org_id());
CREATE POLICY rls_individual_properties_update ON individual_properties
  FOR UPDATE USING (owner_org_id = current_org_id());
CREATE POLICY rls_individual_properties_delete ON individual_properties
  FOR DELETE USING (owner_org_id = current_org_id());

-- =============================================================================
-- PART 2: TABLES SCOPED VIA individual_properties (via property_id join)
-- =============================================================================

-- property_ownerships (via individual_properties.owner_org_id)
ALTER TABLE property_ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_ownerships FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_property_ownerships_select ON property_ownerships FOR SELECT
  USING (EXISTS (SELECT 1 FROM individual_properties p
    WHERE p.id = property_ownerships.property_id AND p.owner_org_id = current_org_id()));
CREATE POLICY rls_property_ownerships_insert ON property_ownerships FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM individual_properties p
    WHERE p.id = property_ownerships.property_id AND p.owner_org_id = current_org_id()));
CREATE POLICY rls_property_ownerships_update ON property_ownerships FOR UPDATE
  USING (EXISTS (SELECT 1 FROM individual_properties p
    WHERE p.id = property_ownerships.property_id AND p.owner_org_id = current_org_id()));
CREATE POLICY rls_property_ownerships_delete ON property_ownerships FOR DELETE
  USING (EXISTS (SELECT 1 FROM individual_properties p
    WHERE p.id = property_ownerships.property_id AND p.owner_org_id = current_org_id()));

-- =============================================================================
-- PART 3: TABLES SCOPED VIA property_portfolios (organization_id column)
-- =============================================================================

-- portfolio_properties (via property_portfolios.organization_id)
ALTER TABLE portfolio_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_properties FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_portfolio_properties_select ON portfolio_properties FOR SELECT
  USING (EXISTS (SELECT 1 FROM property_portfolios pp
    WHERE pp.id = portfolio_properties.portfolio_id AND pp.organization_id = current_org_id()));
CREATE POLICY rls_portfolio_properties_insert ON portfolio_properties FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM property_portfolios pp
    WHERE pp.id = portfolio_properties.portfolio_id AND pp.organization_id = current_org_id()));
CREATE POLICY rls_portfolio_properties_update ON portfolio_properties FOR UPDATE
  USING (EXISTS (SELECT 1 FROM property_portfolios pp
    WHERE pp.id = portfolio_properties.portfolio_id AND pp.organization_id = current_org_id()));
CREATE POLICY rls_portfolio_properties_delete ON portfolio_properties FOR DELETE
  USING (EXISTS (SELECT 1 FROM property_portfolios pp
    WHERE pp.id = portfolio_properties.portfolio_id AND pp.organization_id = current_org_id()));

-- =============================================================================
-- PART 4: CONCIERGE CASE CHILD TABLES (via concierge_cases.organization_id)
-- =============================================================================

-- case_availability_slots
ALTER TABLE case_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_availability_slots FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_availability_slots_select ON case_availability_slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_availability_slots.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_availability_slots_insert ON case_availability_slots FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_availability_slots.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_availability_slots_update ON case_availability_slots FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_availability_slots.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_availability_slots_delete ON case_availability_slots FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_availability_slots.case_id AND cc.organization_id = current_org_id()));

-- case_status_history
ALTER TABLE case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_status_history FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_status_history_select ON case_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_status_history.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_status_history_insert ON case_status_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_status_history.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_status_history_update ON case_status_history FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_status_history.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_status_history_delete ON case_status_history FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_status_history.case_id AND cc.organization_id = current_org_id()));

-- case_notes
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_notes_select ON case_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_notes.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_notes_insert ON case_notes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_notes.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_notes_update ON case_notes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_notes.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_notes_delete ON case_notes FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_notes.case_id AND cc.organization_id = current_org_id()));

-- case_attachments
ALTER TABLE case_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_attachments_select ON case_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_attachments.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_attachments_insert ON case_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_attachments.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_attachments_update ON case_attachments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_attachments.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_attachments_delete ON case_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_attachments.case_id AND cc.organization_id = current_org_id()));

-- case_participants
ALTER TABLE case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_participants FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_participants_select ON case_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_participants.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_participants_insert ON case_participants FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_participants.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_participants_update ON case_participants FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_participants.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_participants_delete ON case_participants FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_participants.case_id AND cc.organization_id = current_org_id()));

-- case_milestones
ALTER TABLE case_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_milestones_select ON case_milestones FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_milestones.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_milestones_insert ON case_milestones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_milestones.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_milestones_update ON case_milestones FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_milestones.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_milestones_delete ON case_milestones FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_milestones.case_id AND cc.organization_id = current_org_id()));

-- case_issues
ALTER TABLE case_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_issues FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_issues_select ON case_issues FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_issues.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_issues_insert ON case_issues FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_issues.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_issues_update ON case_issues FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_issues.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_issues_delete ON case_issues FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_issues.case_id AND cc.organization_id = current_org_id()));

-- case_communications
ALTER TABLE case_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_communications FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_communications_select ON case_communications FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_communications.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_communications_insert ON case_communications FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_communications.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_communications_update ON case_communications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_communications.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_communications_delete ON case_communications FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_communications.case_id AND cc.organization_id = current_org_id()));

-- case_reviews
ALTER TABLE case_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_case_reviews_select ON case_reviews FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_reviews.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_reviews_insert ON case_reviews FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_reviews.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_reviews_update ON case_reviews FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_reviews.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_case_reviews_delete ON case_reviews FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = case_reviews.case_id AND cc.organization_id = current_org_id()));

-- concierge_actions
ALTER TABLE concierge_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_concierge_actions_select ON concierge_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = concierge_actions.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_actions_insert ON concierge_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = concierge_actions.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_actions_update ON concierge_actions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = concierge_actions.case_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_actions_delete ON concierge_actions FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_cases cc
    WHERE cc.id = concierge_actions.case_id AND cc.organization_id = current_org_id()));

-- concierge_action_logs (via concierge_actions -> concierge_cases)
ALTER TABLE concierge_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE concierge_action_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_concierge_action_logs_select ON concierge_action_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM concierge_actions ca
    JOIN concierge_cases cc ON cc.id = ca.case_id
    WHERE ca.id = concierge_action_logs.action_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_action_logs_insert ON concierge_action_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM concierge_actions ca
    JOIN concierge_cases cc ON cc.id = ca.case_id
    WHERE ca.id = concierge_action_logs.action_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_action_logs_update ON concierge_action_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM concierge_actions ca
    JOIN concierge_cases cc ON cc.id = ca.case_id
    WHERE ca.id = concierge_action_logs.action_id AND cc.organization_id = current_org_id()));
CREATE POLICY rls_concierge_action_logs_delete ON concierge_action_logs FOR DELETE
  USING (EXISTS (SELECT 1 FROM concierge_actions ca
    JOIN concierge_cases cc ON cc.id = ca.case_id
    WHERE ca.id = concierge_action_logs.action_id AND cc.organization_id = current_org_id()));

-- =============================================================================
-- PART 5: OWNER INTENT CHILD TABLES (via owner_intents.organization_id)
-- =============================================================================

-- intent_notes
ALTER TABLE intent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_intent_notes_select ON intent_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM owner_intents oi
    WHERE oi.id = intent_notes.intent_id AND oi.organization_id = current_org_id()));
CREATE POLICY rls_intent_notes_insert ON intent_notes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM owner_intents oi
    WHERE oi.id = intent_notes.intent_id AND oi.organization_id = current_org_id()));
CREATE POLICY rls_intent_notes_update ON intent_notes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM owner_intents oi
    WHERE oi.id = intent_notes.intent_id AND oi.organization_id = current_org_id()));
CREATE POLICY rls_intent_notes_delete ON intent_notes FOR DELETE
  USING (EXISTS (SELECT 1 FROM owner_intents oi
    WHERE oi.id = intent_notes.intent_id AND oi.organization_id = current_org_id()));

-- =============================================================================
-- PART 6: VENDOR TABLES (organization_id and join-based)
-- =============================================================================

-- vendor_candidates (has organization_id)
ALTER TABLE vendor_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_vendor_candidates_select ON vendor_candidates FOR SELECT
  USING (organization_id = current_org_id());
CREATE POLICY rls_vendor_candidates_insert ON vendor_candidates FOR INSERT
  WITH CHECK (organization_id = current_org_id());
CREATE POLICY rls_vendor_candidates_update ON vendor_candidates FOR UPDATE
  USING (organization_id = current_org_id());
CREATE POLICY rls_vendor_candidates_delete ON vendor_candidates FOR DELETE
  USING (organization_id = current_org_id());

-- vendor_bids (via vendor_candidates.organization_id)
ALTER TABLE vendor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bids FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_vendor_bids_select ON vendor_bids FOR SELECT
  USING (EXISTS (SELECT 1 FROM vendor_candidates vc
    WHERE vc.id = vendor_bids.vendor_candidate_id AND vc.organization_id = current_org_id()));
CREATE POLICY rls_vendor_bids_insert ON vendor_bids FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM vendor_candidates vc
    WHERE vc.id = vendor_bids.vendor_candidate_id AND vc.organization_id = current_org_id()));
CREATE POLICY rls_vendor_bids_update ON vendor_bids FOR UPDATE
  USING (EXISTS (SELECT 1 FROM vendor_candidates vc
    WHERE vc.id = vendor_bids.vendor_candidate_id AND vc.organization_id = current_org_id()));
CREATE POLICY rls_vendor_bids_delete ON vendor_bids FOR DELETE
  USING (EXISTS (SELECT 1 FROM vendor_candidates vc
    WHERE vc.id = vendor_bids.vendor_candidate_id AND vc.organization_id = current_org_id()));

-- =============================================================================
-- PART 7: EXTERNAL HOA CHILD TABLES (via external_hoa_contexts.organization_id)
-- =============================================================================

-- external_hoa_approvals
ALTER TABLE external_hoa_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_hoa_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_external_hoa_approvals_select ON external_hoa_approvals FOR SELECT
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_approvals.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_approvals_insert ON external_hoa_approvals FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_approvals.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_approvals_update ON external_hoa_approvals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_approvals.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_approvals_delete ON external_hoa_approvals FOR DELETE
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_approvals.external_hoa_context_id AND ehc.organization_id = current_org_id()));

-- external_hoa_rules
ALTER TABLE external_hoa_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_hoa_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_external_hoa_rules_select ON external_hoa_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_rules.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_rules_insert ON external_hoa_rules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_rules.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_rules_update ON external_hoa_rules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_rules.external_hoa_context_id AND ehc.organization_id = current_org_id()));
CREATE POLICY rls_external_hoa_rules_delete ON external_hoa_rules FOR DELETE
  USING (EXISTS (SELECT 1 FROM external_hoa_contexts ehc
    WHERE ehc.id = external_hoa_rules.external_hoa_context_id AND ehc.organization_id = current_org_id()));

-- =============================================================================
-- PART 8: EXTERNAL VENDOR CHILD TABLES (via external_vendor_contexts.organization_id)
-- =============================================================================

-- external_vendor_interactions
ALTER TABLE external_vendor_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_vendor_interactions FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_external_vendor_interactions_select ON external_vendor_interactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM external_vendor_contexts evc
    WHERE evc.id = external_vendor_interactions.external_vendor_context_id AND evc.organization_id = current_org_id()));
CREATE POLICY rls_external_vendor_interactions_insert ON external_vendor_interactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM external_vendor_contexts evc
    WHERE evc.id = external_vendor_interactions.external_vendor_context_id AND evc.organization_id = current_org_id()));
CREATE POLICY rls_external_vendor_interactions_update ON external_vendor_interactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM external_vendor_contexts evc
    WHERE evc.id = external_vendor_interactions.external_vendor_context_id AND evc.organization_id = current_org_id()));
CREATE POLICY rls_external_vendor_interactions_delete ON external_vendor_interactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM external_vendor_contexts evc
    WHERE evc.id = external_vendor_interactions.external_vendor_context_id AND evc.organization_id = current_org_id()));

-- =============================================================================
-- PART 9: DELEGATED AUTHORITY (via property_ownerships -> individual_properties)
-- =============================================================================

-- delegated_authorities
ALTER TABLE delegated_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegated_authorities FORCE ROW LEVEL SECURITY;
CREATE POLICY rls_delegated_authorities_select ON delegated_authorities FOR SELECT
  USING (EXISTS (SELECT 1 FROM property_ownerships po
    JOIN individual_properties ip ON ip.id = po.property_id
    WHERE po.id = delegated_authorities.property_ownership_id AND ip.owner_org_id = current_org_id()));
CREATE POLICY rls_delegated_authorities_insert ON delegated_authorities FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM property_ownerships po
    JOIN individual_properties ip ON ip.id = po.property_id
    WHERE po.id = delegated_authorities.property_ownership_id AND ip.owner_org_id = current_org_id()));
CREATE POLICY rls_delegated_authorities_update ON delegated_authorities FOR UPDATE
  USING (EXISTS (SELECT 1 FROM property_ownerships po
    JOIN individual_properties ip ON ip.id = po.property_id
    WHERE po.id = delegated_authorities.property_ownership_id AND ip.owner_org_id = current_org_id()));
CREATE POLICY rls_delegated_authorities_delete ON delegated_authorities FOR DELETE
  USING (EXISTS (SELECT 1 FROM property_ownerships po
    JOIN individual_properties ip ON ip.id = po.property_id
    WHERE po.id = delegated_authorities.property_ownership_id AND ip.owner_org_id = current_org_id()));

-- =============================================================================
-- PART 10: COMMENTS
-- =============================================================================

COMMENT ON POLICY rls_individual_properties_select ON individual_properties IS
  'Phase 35: RLS for individual properties using owner_org_id column';

COMMENT ON POLICY rls_concierge_actions_select ON concierge_actions IS
  'Phase 35: RLS for concierge actions via concierge_cases join';

COMMENT ON POLICY rls_vendor_candidates_select ON vendor_candidates IS
  'Phase 35: RLS for vendor candidates using organization_id column';

COMMENT ON POLICY rls_delegated_authorities_select ON delegated_authorities IS
  'Phase 35: RLS for delegated authorities via property_ownerships -> individual_properties join';
