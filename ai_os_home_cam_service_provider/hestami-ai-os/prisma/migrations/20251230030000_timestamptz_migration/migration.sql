-- Migration: Convert all TIMESTAMP(3) columns to TIMESTAMPTZ(3)
-- This enables proper timezone handling for multi-timezone users (HOAs, vendors, staff)
-- All existing timestamps are interpreted as UTC during conversion

-- Set timezone for consistent interpretation
SET timezone = 'UTC';

-- =============================================================================
-- Convert all TIMESTAMP columns to TIMESTAMPTZ
-- =============================================================================

ALTER TABLE accounts ALTER COLUMN access_token_expires_at TYPE TIMESTAMPTZ(3) USING access_token_expires_at AT TIME ZONE 'UTC';
 ALTER TABLE accounts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE accounts ALTER COLUMN refresh_token_expires_at TYPE TIMESTAMPTZ(3) USING refresh_token_expires_at AT TIME ZONE 'UTC';
 ALTER TABLE accounts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE activity_events ALTER COLUMN performed_at TYPE TIMESTAMPTZ(3) USING performed_at AT TIME ZONE 'UTC';
 ALTER TABLE announcement_reads ALTER COLUMN read_at TYPE TIMESTAMPTZ(3) USING read_at AT TIME ZONE 'UTC';
 ALTER TABLE announcements ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE announcements ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE announcements ALTER COLUMN published_at TYPE TIMESTAMPTZ(3) USING published_at AT TIME ZONE 'UTC';
 ALTER TABLE announcements ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE ap_invoice_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE ap_invoices ALTER COLUMN approved_at TYPE TIMESTAMPTZ(3) USING approved_at AT TIME ZONE 'UTC';
 ALTER TABLE ap_invoices ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE ap_invoices ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_committee_members ALTER COLUMN joined_at TYPE TIMESTAMPTZ(3) USING joined_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_committee_members ALTER COLUMN left_at TYPE TIMESTAMPTZ(3) USING left_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_committees ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_committees ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_documents ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_documents ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ(3) USING uploaded_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN decision_date TYPE TIMESTAMPTZ(3) USING decision_date AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN proposed_end_date TYPE TIMESTAMPTZ(3) USING proposed_end_date AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN proposed_start_date TYPE TIMESTAMPTZ(3) USING proposed_start_date AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN reviewed_at TYPE TIMESTAMPTZ(3) USING reviewed_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_requests ALTER COLUMN withdrawn_at TYPE TIMESTAMPTZ(3) USING withdrawn_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_reviews ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_reviews ALTER COLUMN decided_at TYPE TIMESTAMPTZ(3) USING decided_at AT TIME ZONE 'UTC';
 ALTER TABLE arc_reviews ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE assessment_charges ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE assessment_charges ALTER COLUMN late_fee_date TYPE TIMESTAMPTZ(3) USING late_fee_date AT TIME ZONE 'UTC';
 ALTER TABLE assessment_charges ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE assessment_types ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE assessment_types ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE asset_maintenance_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE assets ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE assets ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE assets ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE association_service_providers ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE association_service_providers ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE associations ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE associations ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE associations ALTER COLUMN incorporation_date TYPE TIMESTAMPTZ(3) USING incorporation_date AT TIME ZONE 'UTC';
 ALTER TABLE associations ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE auto_pay_settings ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE auto_pay_settings ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE auto_pay_settings ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE bank_accounts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE bank_accounts ALTER COLUMN last_reconciled TYPE TIMESTAMPTZ(3) USING last_reconciled AT TIME ZONE 'UTC';
 ALTER TABLE bank_accounts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE board_history ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE board_members ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE board_members ALTER COLUMN term_end TYPE TIMESTAMPTZ(3) USING term_end AT TIME ZONE 'UTC';
 ALTER TABLE board_members ALTER COLUMN term_start TYPE TIMESTAMPTZ(3) USING term_start AT TIME ZONE 'UTC';
 ALTER TABLE board_members ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE board_motions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE board_motions ALTER COLUMN decided_at TYPE TIMESTAMPTZ(3) USING decided_at AT TIME ZONE 'UTC';
 ALTER TABLE board_motions ALTER COLUMN effective_date TYPE TIMESTAMPTZ(3) USING effective_date AT TIME ZONE 'UTC';
 ALTER TABLE board_motions ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE board_motions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE boards ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE boards ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_event_notifications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_event_notifications ALTER COLUMN notify_at TYPE TIMESTAMPTZ(3) USING notify_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_event_notifications ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_event_notifications ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_events ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_events ALTER COLUMN ends_at TYPE TIMESTAMPTZ(3) USING ends_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_events ALTER COLUMN notify_at TYPE TIMESTAMPTZ(3) USING notify_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_events ALTER COLUMN starts_at TYPE TIMESTAMPTZ(3) USING starts_at AT TIME ZONE 'UTC';
 ALTER TABLE calendar_events ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE case_attachments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_attachments ALTER COLUMN locked_at TYPE TIMESTAMPTZ(3) USING locked_at AT TIME ZONE 'UTC';
 ALTER TABLE case_availability_slots ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_availability_slots ALTER COLUMN end_time TYPE TIMESTAMPTZ(3) USING end_time AT TIME ZONE 'UTC';
 ALTER TABLE case_availability_slots ALTER COLUMN start_time TYPE TIMESTAMPTZ(3) USING start_time AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN delivered_at TYPE TIMESTAMPTZ(3) USING delivered_at AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN failed_at TYPE TIMESTAMPTZ(3) USING failed_at AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN read_at TYPE TIMESTAMPTZ(3) USING read_at AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE case_communications ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE case_issues ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_issues ALTER COLUMN resolved_at TYPE TIMESTAMPTZ(3) USING resolved_at AT TIME ZONE 'UTC';
 ALTER TABLE case_issues ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE case_milestones ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE case_milestones ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_milestones ALTER COLUMN target_date TYPE TIMESTAMPTZ(3) USING target_date AT TIME ZONE 'UTC';
 ALTER TABLE case_milestones ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE case_notes ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_participants ALTER COLUMN added_at TYPE TIMESTAMPTZ(3) USING added_at AT TIME ZONE 'UTC';
 ALTER TABLE case_participants ALTER COLUMN removed_at TYPE TIMESTAMPTZ(3) USING removed_at AT TIME ZONE 'UTC';
 ALTER TABLE case_reviews ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE case_reviews ALTER COLUMN reviewed_at TYPE TIMESTAMPTZ(3) USING reviewed_at AT TIME ZONE 'UTC';
 ALTER TABLE case_reviews ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE case_status_history ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE common_areas ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE common_areas ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE communication_template_versions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE communication_templates ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE communication_templates ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_checklist_items ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_checklist_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_checklist_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_deadlines ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_deadlines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_deadlines ALTER COLUMN due_date TYPE TIMESTAMPTZ(3) USING due_date AT TIME ZONE 'UTC';
 ALTER TABLE compliance_deadlines ALTER COLUMN reminder_date TYPE TIMESTAMPTZ(3) USING reminder_date AT TIME ZONE 'UTC';
 ALTER TABLE compliance_deadlines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_requirements ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_requirements ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE compliance_requirements ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_action_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN planned_at TYPE TIMESTAMPTZ(3) USING planned_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_actions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ(3) USING cancelled_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN closed_at TYPE TIMESTAMPTZ(3) USING closed_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN resolved_at TYPE TIMESTAMPTZ(3) USING resolved_at AT TIME ZONE 'UTC';
 ALTER TABLE concierge_cases ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contact_preferences ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contact_preferences ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE contact_preferences ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_renewals ALTER COLUMN approved_at TYPE TIMESTAMPTZ(3) USING approved_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_renewals ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_renewals ALTER COLUMN renewed_at TYPE TIMESTAMPTZ(3) USING renewed_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_schedules ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_schedules ALTER COLUMN last_generated_at TYPE TIMESTAMPTZ(3) USING last_generated_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_schedules ALTER COLUMN next_generate_at TYPE TIMESTAMPTZ(3) USING next_generate_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_schedules ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_service_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_service_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_sla_records ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contract_sla_records ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_branches ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_branches ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN blocked_at TYPE TIMESTAMPTZ(3) USING blocked_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN earliest_insurance_expiry TYPE TIMESTAMPTZ(3) USING earliest_insurance_expiry AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN earliest_license_expiry TYPE TIMESTAMPTZ(3) USING earliest_license_expiry AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN last_checked_at TYPE TIMESTAMPTZ(3) USING last_checked_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_compliance_statuses ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_insurances ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_insurances ALTER COLUMN effective_date TYPE TIMESTAMPTZ(3) USING effective_date AT TIME ZONE 'UTC';
 ALTER TABLE contractor_insurances ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE contractor_insurances ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_insurances ALTER COLUMN verified_at TYPE TIMESTAMPTZ(3) USING verified_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_licenses ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_licenses ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE contractor_licenses ALTER COLUMN issue_date TYPE TIMESTAMPTZ(3) USING issue_date AT TIME ZONE 'UTC';
 ALTER TABLE contractor_licenses ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_licenses ALTER COLUMN verified_at TYPE TIMESTAMPTZ(3) USING verified_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_profiles ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_profiles ALTER COLUMN last_compliance_check TYPE TIMESTAMPTZ(3) USING last_compliance_check AT TIME ZONE 'UTC';
 ALTER TABLE contractor_profiles ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_trades ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE contractor_trades ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE customers ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE customers ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE customers ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE dashboard_widgets ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE dashboard_widgets ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN accepted_at TYPE TIMESTAMPTZ(3) USING accepted_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN granted_at TYPE TIMESTAMPTZ(3) USING granted_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN revoked_at TYPE TIMESTAMPTZ(3) USING revoked_at AT TIME ZONE 'UTC';
 ALTER TABLE delegated_authorities ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN accepted_at TYPE TIMESTAMPTZ(3) USING accepted_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN actual_end TYPE TIMESTAMPTZ(3) USING actual_end AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN actual_start TYPE TIMESTAMPTZ(3) USING actual_start AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN assigned_at TYPE TIMESTAMPTZ(3) USING assigned_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ(3) USING cancelled_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN declined_at TYPE TIMESTAMPTZ(3) USING declined_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ(3) USING scheduled_end AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ(3) USING scheduled_start AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC';
 ALTER TABLE dispatch_assignments ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE document_access_grants ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE document_access_grants ALTER COLUMN granted_at TYPE TIMESTAMPTZ(3) USING granted_at AT TIME ZONE 'UTC';
 ALTER TABLE document_access_grants ALTER COLUMN revoked_at TYPE TIMESTAMPTZ(3) USING revoked_at AT TIME ZONE 'UTC';
 ALTER TABLE document_context_bindings ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE document_download_logs ALTER COLUMN downloaded_at TYPE TIMESTAMPTZ(3) USING downloaded_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN archived_at TYPE TIMESTAMPTZ(3) USING archived_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN captured_at TYPE TIMESTAMPTZ(3) USING captured_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN effective_date TYPE TIMESTAMPTZ(3) USING effective_date AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN processing_completed_at TYPE TIMESTAMPTZ(3) USING processing_completed_at AT TIME ZONE 'UTC';
 ALTER TABLE documents ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE estimate_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE estimate_lines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE estimate_options ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE estimate_options ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN accepted_at TYPE TIMESTAMPTZ(3) USING accepted_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN declined_at TYPE TIMESTAMPTZ(3) USING declined_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN issue_date TYPE TIMESTAMPTZ(3) USING issue_date AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN valid_until TYPE TIMESTAMPTZ(3) USING valid_until AT TIME ZONE 'UTC';
 ALTER TABLE estimates ALTER COLUMN viewed_at TYPE TIMESTAMPTZ(3) USING viewed_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN response_at TYPE TIMESTAMPTZ(3) USING response_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_approvals ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_contexts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_contexts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_contexts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_rules ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_rules ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE external_hoa_rules ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE external_vendor_contexts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE external_vendor_contexts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE external_vendor_contexts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE external_vendor_interactions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE external_vendor_interactions ALTER COLUMN interaction_date TYPE TIMESTAMPTZ(3) USING interaction_date AT TIME ZONE 'UTC';
 ALTER TABLE gl_accounts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE gl_accounts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE gl_accounts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE idempotency_keys ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE idempotency_keys ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_assets ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_assets ALTER COLUMN install_date TYPE TIMESTAMPTZ(3) USING install_date AT TIME ZONE 'UTC';
 ALTER TABLE individual_assets ALTER COLUMN last_service_date TYPE TIMESTAMPTZ(3) USING last_service_date AT TIME ZONE 'UTC';
 ALTER TABLE individual_assets ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_assets ALTER COLUMN warranty_expires TYPE TIMESTAMPTZ(3) USING warranty_expires AT TIME ZONE 'UTC';
 ALTER TABLE individual_maintenance_requests ALTER COLUMN completed_date TYPE TIMESTAMPTZ(3) USING completed_date AT TIME ZONE 'UTC';
 ALTER TABLE individual_maintenance_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_maintenance_requests ALTER COLUMN preferred_date TYPE TIMESTAMPTZ(3) USING preferred_date AT TIME ZONE 'UTC';
 ALTER TABLE individual_maintenance_requests ALTER COLUMN scheduled_date TYPE TIMESTAMPTZ(3) USING scheduled_date AT TIME ZONE 'UTC';
 ALTER TABLE individual_maintenance_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_properties ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE individual_properties ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE intent_notes ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_items ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_levels ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_levels ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE inventory_levels ALTER COLUMN last_counted_at TYPE TIMESTAMPTZ(3) USING last_counted_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_levels ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_locations ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_locations ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_locations ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfer_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfer_lines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfers ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfers ALTER COLUMN received_at TYPE TIMESTAMPTZ(3) USING received_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfers ALTER COLUMN requested_at TYPE TIMESTAMPTZ(3) USING requested_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfers ALTER COLUMN shipped_at TYPE TIMESTAMPTZ(3) USING shipped_at AT TIME ZONE 'UTC';
 ALTER TABLE inventory_transfers ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE invoice_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE invoice_lines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_attachments ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ(3) USING uploaded_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checklists ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checklists ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checklists ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checkpoints ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checkpoints ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_checkpoints ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN due_date TYPE TIMESTAMPTZ(3) USING due_date AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN issue_date TYPE TIMESTAMPTZ(3) USING issue_date AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN paid_at TYPE TIMESTAMPTZ(3) USING paid_at AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_invoices ALTER COLUMN viewed_at TYPE TIMESTAMPTZ(3) USING viewed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_media ALTER COLUMN captured_at TYPE TIMESTAMPTZ(3) USING captured_at AT TIME ZONE 'UTC';
 ALTER TABLE job_media ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_media ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_media ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ(3) USING uploaded_at AT TIME ZONE 'UTC';
 ALTER TABLE job_notes ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_notes ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_signatures ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_signatures ALTER COLUMN signed_at TYPE TIMESTAMPTZ(3) USING signed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_status_history ALTER COLUMN changed_at TYPE TIMESTAMPTZ(3) USING changed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_steps ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE job_steps ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_steps ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_template_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_template_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_templates ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_templates ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_time_entries ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_time_entries ALTER COLUMN end_time TYPE TIMESTAMPTZ(3) USING end_time AT TIME ZONE 'UTC';
 ALTER TABLE job_time_entries ALTER COLUMN start_time TYPE TIMESTAMPTZ(3) USING start_time AT TIME ZONE 'UTC';
 ALTER TABLE job_time_entries ALTER COLUMN synced_at TYPE TIMESTAMPTZ(3) USING synced_at AT TIME ZONE 'UTC';
 ALTER TABLE job_time_entries ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN actual_end TYPE TIMESTAMPTZ(3) USING actual_end AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN actual_start TYPE TIMESTAMPTZ(3) USING actual_start AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ(3) USING scheduled_end AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ(3) USING scheduled_start AT TIME ZONE 'UTC';
 ALTER TABLE job_visits ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN assigned_at TYPE TIMESTAMPTZ(3) USING assigned_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ(3) USING cancelled_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN closed_at TYPE TIMESTAMPTZ(3) USING closed_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN dispatched_at TYPE TIMESTAMPTZ(3) USING dispatched_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN invoiced_at TYPE TIMESTAMPTZ(3) USING invoiced_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN paid_at TYPE TIMESTAMPTZ(3) USING paid_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ(3) USING scheduled_end AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ(3) USING scheduled_start AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE jobs ALTER COLUMN warranty_ends TYPE TIMESTAMPTZ(3) USING warranty_ends AT TIME ZONE 'UTC';
 ALTER TABLE journal_entries ALTER COLUMN approved_at TYPE TIMESTAMPTZ(3) USING approved_at AT TIME ZONE 'UTC';
 ALTER TABLE journal_entries ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE journal_entries ALTER COLUMN posted_at TYPE TIMESTAMPTZ(3) USING posted_at AT TIME ZONE 'UTC';
 ALTER TABLE journal_entries ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE journal_entry_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE management_contracts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE management_contracts ALTER COLUMN end_date TYPE TIMESTAMPTZ(3) USING end_date AT TIME ZONE 'UTC';
 ALTER TABLE management_contracts ALTER COLUMN start_date TYPE TIMESTAMPTZ(3) USING start_date AT TIME ZONE 'UTC';
 ALTER TABLE management_contracts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE manager_assignments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE manager_assignments ALTER COLUMN end_date TYPE TIMESTAMPTZ(3) USING end_date AT TIME ZONE 'UTC';
 ALTER TABLE manager_assignments ALTER COLUMN start_date TYPE TIMESTAMPTZ(3) USING start_date AT TIME ZONE 'UTC';
 ALTER TABLE manager_assignments ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE mass_communication_deliveries ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE mass_communication_deliveries ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE mass_communications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE mass_communications ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ(3) USING scheduled_for AT TIME ZONE 'UTC';
 ALTER TABLE mass_communications ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE mass_communications ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE material_decisions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE material_decisions ALTER COLUMN decided_at TYPE TIMESTAMPTZ(3) USING decided_at AT TIME ZONE 'UTC';
 ALTER TABLE material_decisions ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE material_decisions ALTER COLUMN outcome_recorded_at TYPE TIMESTAMPTZ(3) USING outcome_recorded_at AT TIME ZONE 'UTC';
 ALTER TABLE material_decisions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE material_usages ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE material_usages ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE material_usages ALTER COLUMN used_at TYPE TIMESTAMPTZ(3) USING used_at AT TIME ZONE 'UTC';
 ALTER TABLE meeting_agenda_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE meeting_attendance ALTER COLUMN checked_in_at TYPE TIMESTAMPTZ(3) USING checked_in_at AT TIME ZONE 'UTC';
 ALTER TABLE meeting_attendance ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE meeting_minutes ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE meeting_minutes ALTER COLUMN recorded_at TYPE TIMESTAMPTZ(3) USING recorded_at AT TIME ZONE 'UTC';
 ALTER TABLE meetings ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE meetings ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ(3) USING scheduled_for AT TIME ZONE 'UTC';
 ALTER TABLE meetings ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE notice_sequence_configs ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE notice_sequence_configs ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE notice_sequence_steps ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE notice_templates ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE notice_templates ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE notification_settings ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE notification_settings ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE notification_settings ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE offline_sync_queue ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE offline_sync_queue ALTER COLUMN last_attempt_at TYPE TIMESTAMPTZ(3) USING last_attempt_at AT TIME ZONE 'UTC';
 ALTER TABLE offline_sync_queue ALTER COLUMN synced_at TYPE TIMESTAMPTZ(3) USING synced_at AT TIME ZONE 'UTC';
 ALTER TABLE offline_sync_queue ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE organizations ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE organizations ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE organizations ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN acknowledged_at TYPE TIMESTAMPTZ(3) USING acknowledged_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN converted_at TYPE TIMESTAMPTZ(3) USING converted_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN declined_at TYPE TIMESTAMPTZ(3) USING declined_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_intents ALTER COLUMN withdrawn_at TYPE TIMESTAMPTZ(3) USING withdrawn_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_request_history ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN closed_at TYPE TIMESTAMPTZ(3) USING closed_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN resolved_at TYPE TIMESTAMPTZ(3) USING resolved_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE owner_requests ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE ownerships ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE ownerships ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE ownerships ALTER COLUMN end_date TYPE TIMESTAMPTZ(3) USING end_date AT TIME ZONE 'UTC';
 ALTER TABLE ownerships ALTER COLUMN start_date TYPE TIMESTAMPTZ(3) USING start_date AT TIME ZONE 'UTC';
 ALTER TABLE ownerships ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE parties ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE parties ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE parties ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_applications ALTER COLUMN applied_at TYPE TIMESTAMPTZ(3) USING applied_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_applications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN failed_at TYPE TIMESTAMPTZ(3) USING failed_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN initiated_at TYPE TIMESTAMPTZ(3) USING initiated_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN processed_at TYPE TIMESTAMPTZ(3) USING processed_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN refunded_at TYPE TIMESTAMPTZ(3) USING refunded_at AT TIME ZONE 'UTC';
 ALTER TABLE payment_intents ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE payments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE payments ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE policy_documents ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE policy_documents ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE policy_versions ALTER COLUMN approved_at TYPE TIMESTAMPTZ(3) USING approved_at AT TIME ZONE 'UTC';
 ALTER TABLE policy_versions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE portfolio_properties ALTER COLUMN added_at TYPE TIMESTAMPTZ(3) USING added_at AT TIME ZONE 'UTC';
 ALTER TABLE portfolio_properties ALTER COLUMN removed_at TYPE TIMESTAMPTZ(3) USING removed_at AT TIME ZONE 'UTC';
 ALTER TABLE price_rules ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE price_rules ALTER COLUMN ends_at TYPE TIMESTAMPTZ(3) USING ends_at AT TIME ZONE 'UTC';
 ALTER TABLE price_rules ALTER COLUMN starts_at TYPE TIMESTAMPTZ(3) USING starts_at AT TIME ZONE 'UTC';
 ALTER TABLE price_rules ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN activated_at TYPE TIMESTAMPTZ(3) USING activated_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN effective_end TYPE TIMESTAMPTZ(3) USING effective_end AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN effective_start TYPE TIMESTAMPTZ(3) USING effective_start AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN published_at TYPE TIMESTAMPTZ(3) USING published_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebook_versions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebooks ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE pricebooks ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE properties ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE properties ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE properties ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN effective_from TYPE TIMESTAMPTZ(3) USING effective_from AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN effective_to TYPE TIMESTAMPTZ(3) USING effective_to AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE property_ownerships ALTER COLUMN verified_at TYPE TIMESTAMPTZ(3) USING verified_at AT TIME ZONE 'UTC';
 ALTER TABLE property_portfolios ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE property_portfolios ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE property_portfolios ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN accepted_at TYPE TIMESTAMPTZ(3) USING accepted_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN declined_at TYPE TIMESTAMPTZ(3) USING declined_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN issue_date TYPE TIMESTAMPTZ(3) USING issue_date AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN sent_at TYPE TIMESTAMPTZ(3) USING sent_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN signed_at TYPE TIMESTAMPTZ(3) USING signed_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN valid_until TYPE TIMESTAMPTZ(3) USING valid_until AT TIME ZONE 'UTC';
 ALTER TABLE proposals ALTER COLUMN viewed_at TYPE TIMESTAMPTZ(3) USING viewed_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_lines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipt_lines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipt_lines ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipt_lines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipts ALTER COLUMN received_at TYPE TIMESTAMPTZ(3) USING received_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_order_receipts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN confirmed_at TYPE TIMESTAMPTZ(3) USING confirmed_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN expected_date TYPE TIMESTAMPTZ(3) USING expected_date AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN order_date TYPE TIMESTAMPTZ(3) USING order_date AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN received_at TYPE TIMESTAMPTZ(3) USING received_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE purchase_orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE report_definitions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE report_definitions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE report_executions ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE report_executions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE report_executions ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC';
 ALTER TABLE report_schedules ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE report_schedules ALTER COLUMN last_run_at TYPE TIMESTAMPTZ(3) USING last_run_at AT TIME ZONE 'UTC';
 ALTER TABLE report_schedules ALTER COLUMN next_run_at TYPE TIMESTAMPTZ(3) USING next_run_at AT TIME ZONE 'UTC';
 ALTER TABLE report_schedules ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_components ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_components ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_components ALTER COLUMN last_inspection_date TYPE TIMESTAMPTZ(3) USING last_inspection_date AT TIME ZONE 'UTC';
 ALTER TABLE reserve_components ALTER COLUMN placed_in_service_date TYPE TIMESTAMPTZ(3) USING placed_in_service_date AT TIME ZONE 'UTC';
 ALTER TABLE reserve_components ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_funding_schedules ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN effective_date TYPE TIMESTAMPTZ(3) USING effective_date AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN expiration_date TYPE TIMESTAMPTZ(3) USING expiration_date AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN study_date TYPE TIMESTAMPTZ(3) USING study_date AT TIME ZONE 'UTC';
 ALTER TABLE reserve_studies ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE reserve_study_components ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE resolutions ALTER COLUMN adopted_at TYPE TIMESTAMPTZ(3) USING adopted_at AT TIME ZONE 'UTC';
 ALTER TABLE resolutions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE resolutions ALTER COLUMN effective_date TYPE TIMESTAMPTZ(3) USING effective_date AT TIME ZONE 'UTC';
 ALTER TABLE resolutions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE route_plans ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE route_plans ALTER COLUMN optimized_at TYPE TIMESTAMPTZ(3) USING optimized_at AT TIME ZONE 'UTC';
 ALTER TABLE route_plans ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE schedule_slots ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE schedule_slots ALTER COLUMN end_time TYPE TIMESTAMPTZ(3) USING end_time AT TIME ZONE 'UTC';
 ALTER TABLE schedule_slots ALTER COLUMN start_time TYPE TIMESTAMPTZ(3) USING start_time AT TIME ZONE 'UTC';
 ALTER TABLE schedule_slots ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN actual_end TYPE TIMESTAMPTZ(3) USING actual_end AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN actual_start TYPE TIMESTAMPTZ(3) USING actual_start AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN assigned_at TYPE TIMESTAMPTZ(3) USING assigned_at AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN confirmed_at TYPE TIMESTAMPTZ(3) USING confirmed_at AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ(3) USING scheduled_end AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ(3) USING scheduled_start AT TIME ZONE 'UTC';
 ALTER TABLE scheduled_visits ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE service_areas ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE service_areas ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE service_contracts ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE service_contracts ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE service_contracts ALTER COLUMN renewal_notice_at TYPE TIMESTAMPTZ(3) USING renewal_notice_at AT TIME ZONE 'UTC';
 ALTER TABLE service_contracts ALTER COLUMN signed_at TYPE TIMESTAMPTZ(3) USING signed_at AT TIME ZONE 'UTC';
 ALTER TABLE service_contracts ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_links ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_links ALTER COLUMN linked_at TYPE TIMESTAMPTZ(3) USING linked_at AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_links ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_links ALTER COLUMN verification_expires TYPE TIMESTAMPTZ(3) USING verification_expires AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_profiles ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE service_provider_profiles ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE sessions ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE sessions ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE sessions ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN resolution_due TYPE TIMESTAMPTZ(3) USING resolution_due AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN resolved_at TYPE TIMESTAMPTZ(3) USING resolved_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN responded_at TYPE TIMESTAMPTZ(3) USING responded_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN response_due TYPE TIMESTAMPTZ(3) USING response_due AT TIME ZONE 'UTC';
 ALTER TABLE sla_records ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_windows ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE sla_windows ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN activated_at TYPE TIMESTAMPTZ(3) USING activated_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN activation_code_expires_at TYPE TIMESTAMPTZ(3) USING activation_code_expires_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN deactivated_at TYPE TIMESTAMPTZ(3) USING deactivated_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN suspended_at TYPE TIMESTAMPTZ(3) USING suspended_at AT TIME ZONE 'UTC';
 ALTER TABLE staff ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE staff_case_assignments ALTER COLUMN assigned_at TYPE TIMESTAMPTZ(3) USING assigned_at AT TIME ZONE 'UTC';
 ALTER TABLE staff_case_assignments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE staff_case_assignments ALTER COLUMN unassigned_at TYPE TIMESTAMPTZ(3) USING unassigned_at AT TIME ZONE 'UTC';
 ALTER TABLE staff_case_assignments ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE stored_payment_methods ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE stored_payment_methods ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE stored_payment_methods ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE suppliers ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE suppliers ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE suppliers ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_availability ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_availability ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_certifications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_certifications ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_certifications ALTER COLUMN issued_at TYPE TIMESTAMPTZ(3) USING issued_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_certifications ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_kpis ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_kpis ALTER COLUMN period_end TYPE TIMESTAMPTZ(3) USING period_end AT TIME ZONE 'UTC';
 ALTER TABLE technician_kpis ALTER COLUMN period_start TYPE TIMESTAMPTZ(3) USING period_start AT TIME ZONE 'UTC';
 ALTER TABLE technician_kpis ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_skills ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_skills ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_territories ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_territories ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_time_off ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_time_off ALTER COLUMN ends_at TYPE TIMESTAMPTZ(3) USING ends_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_time_off ALTER COLUMN starts_at TYPE TIMESTAMPTZ(3) USING starts_at AT TIME ZONE 'UTC';
 ALTER TABLE technician_time_off ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE technicians ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE technicians ALTER COLUMN hire_date TYPE TIMESTAMPTZ(3) USING hire_date AT TIME ZONE 'UTC';
 ALTER TABLE technicians ALTER COLUMN termination_date TYPE TIMESTAMPTZ(3) USING termination_date AT TIME ZONE 'UTC';
 ALTER TABLE technicians ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE tenancies ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE tenancies ALTER COLUMN lease_end TYPE TIMESTAMPTZ(3) USING lease_end AT TIME ZONE 'UTC';
 ALTER TABLE tenancies ALTER COLUMN lease_start TYPE TIMESTAMPTZ(3) USING lease_start AT TIME ZONE 'UTC';
 ALTER TABLE tenancies ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE units ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE units ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE units ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE user_organizations ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE user_organizations ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE user_profiles ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE user_profiles ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE user_profiles ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN estimated_end_date TYPE TIMESTAMPTZ(3) USING estimated_end_date AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN estimated_start_date TYPE TIMESTAMPTZ(3) USING estimated_start_date AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN received_at TYPE TIMESTAMPTZ(3) USING received_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN responded_at TYPE TIMESTAMPTZ(3) USING responded_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_bids ALTER COLUMN valid_until TYPE TIMESTAMPTZ(3) USING valid_until AT TIME ZONE 'UTC';
 ALTER TABLE vendor_candidates ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_candidates ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_candidates ALTER COLUMN extracted_at TYPE TIMESTAMPTZ(3) USING extracted_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_candidates ALTER COLUMN status_changed_at TYPE TIMESTAMPTZ(3) USING status_changed_at AT TIME ZONE 'UTC';
 ALTER TABLE vendor_candidates ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN approved_at TYPE TIMESTAMPTZ(3) USING approved_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN insurance_expires_at TYPE TIMESTAMPTZ(3) USING insurance_expires_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN license_expires_at TYPE TIMESTAMPTZ(3) USING license_expires_at AT TIME ZONE 'UTC';
 ALTER TABLE vendors ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE verifications ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE verifications ALTER COLUMN expires_at TYPE TIMESTAMPTZ(3) USING expires_at AT TIME ZONE 'UTC';
 ALTER TABLE verifications ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_appeals ALTER COLUMN appeal_hearing_date TYPE TIMESTAMPTZ(3) USING appeal_hearing_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_appeals ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_appeals ALTER COLUMN decision_date TYPE TIMESTAMPTZ(3) USING decision_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_appeals ALTER COLUMN filed_date TYPE TIMESTAMPTZ(3) USING filed_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_appeals ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_evidence ALTER COLUMN captured_at TYPE TIMESTAMPTZ(3) USING captured_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_evidence ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_evidence ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ(3) USING uploaded_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_fines ALTER COLUMN assessed_date TYPE TIMESTAMPTZ(3) USING assessed_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_fines ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_fines ALTER COLUMN due_date TYPE TIMESTAMPTZ(3) USING due_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_fines ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_fines ALTER COLUMN waived_date TYPE TIMESTAMPTZ(3) USING waived_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN appeal_date TYPE TIMESTAMPTZ(3) USING appeal_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN appeal_deadline TYPE TIMESTAMPTZ(3) USING appeal_deadline AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN hearing_date TYPE TIMESTAMPTZ(3) USING hearing_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN recorded_at TYPE TIMESTAMPTZ(3) USING recorded_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_hearings ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_notices ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_notices ALTER COLUMN cure_period_ends TYPE TIMESTAMPTZ(3) USING cure_period_ends AT TIME ZONE 'UTC';
 ALTER TABLE violation_notices ALTER COLUMN delivered_date TYPE TIMESTAMPTZ(3) USING delivered_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_notices ALTER COLUMN sent_date TYPE TIMESTAMPTZ(3) USING sent_date AT TIME ZONE 'UTC';
 ALTER TABLE violation_notices ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_status_history ALTER COLUMN changed_at TYPE TIMESTAMPTZ(3) USING changed_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_types ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violation_types ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN closed_date TYPE TIMESTAMPTZ(3) USING closed_date AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN cure_period_ends TYPE TIMESTAMPTZ(3) USING cure_period_ends AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN cured_date TYPE TIMESTAMPTZ(3) USING cured_date AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN deleted_at TYPE TIMESTAMPTZ(3) USING deleted_at AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN last_notice_date TYPE TIMESTAMPTZ(3) USING last_notice_date AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN observed_date TYPE TIMESTAMPTZ(3) USING observed_date AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN reported_date TYPE TIMESTAMPTZ(3) USING reported_date AT TIME ZONE 'UTC';
 ALTER TABLE violations ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE vote_ballots ALTER COLUMN cast_at TYPE TIMESTAMPTZ(3) USING cast_at AT TIME ZONE 'UTC';
 ALTER TABLE votes ALTER COLUMN closed_at TYPE TIMESTAMPTZ(3) USING closed_at AT TIME ZONE 'UTC';
 ALTER TABLE votes ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_attachments ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ(3) USING uploaded_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN proposed_end_date TYPE TIMESTAMPTZ(3) USING proposed_end_date AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN proposed_start_date TYPE TIMESTAMPTZ(3) USING proposed_start_date AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN requested_at TYPE TIMESTAMPTZ(3) USING requested_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN responded_at TYPE TIMESTAMPTZ(3) USING responded_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN submitted_at TYPE TIMESTAMPTZ(3) USING submitted_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_bids ALTER COLUMN valid_until TYPE TIMESTAMPTZ(3) USING valid_until AT TIME ZONE 'UTC';
 ALTER TABLE work_order_comments ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_line_items ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_line_items ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';
 ALTER TABLE work_order_status_history ALTER COLUMN changed_at TYPE TIMESTAMPTZ(3) USING changed_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN assigned_at TYPE TIMESTAMPTZ(3) USING assigned_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN authorized_at TYPE TIMESTAMPTZ(3) USING authorized_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN closed_at TYPE TIMESTAMPTZ(3) USING closed_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN completed_at TYPE TIMESTAMPTZ(3) USING completed_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN created_at TYPE TIMESTAMPTZ(3) USING created_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN requested_at TYPE TIMESTAMPTZ(3) USING requested_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ(3) USING scheduled_end AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ(3) USING scheduled_start AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN sla_deadline TYPE TIMESTAMPTZ(3) USING sla_deadline AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN started_at TYPE TIMESTAMPTZ(3) USING started_at AT TIME ZONE 'UTC';
 ALTER TABLE work_orders ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3) USING updated_at AT TIME ZONE 'UTC';

-- =============================================================================
-- Update SECURITY DEFINER functions to return TIMESTAMPTZ(3)
-- =============================================================================

-- Drop and recreate get_user_memberships with TIMESTAMPTZ return types
DROP FUNCTION IF EXISTS get_user_memberships(TEXT);

CREATE OR REPLACE FUNCTION get_user_memberships(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  organization_id TEXT,
  role TEXT,
  is_default BOOLEAN,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3),
  org_id TEXT,
  org_name TEXT,
  org_slug TEXT,
  org_type TEXT,
  org_status TEXT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uo.id::TEXT,
    uo.user_id::TEXT,
    uo.organization_id::TEXT,
    uo.role::TEXT,
    uo.is_default,
    uo.created_at,
    uo.updated_at,
    o.id::TEXT AS org_id,
    o.name::TEXT AS org_name,
    o.slug::TEXT AS org_slug,
    o.type::TEXT AS org_type,
    o.status::TEXT AS org_status
  FROM user_organizations uo
  JOIN organizations o ON o.id = uo.organization_id
  WHERE uo.user_id = p_user_id
    AND o.deleted_at IS NULL
  ORDER BY uo.is_default DESC, uo.created_at ASC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_user_memberships(TEXT) TO hestami_app;

-- Drop and recreate get_staff_profile with TIMESTAMPTZ return types and proper enum casting
DROP FUNCTION IF EXISTS get_staff_profile(TEXT);

CREATE OR REPLACE FUNCTION get_staff_profile(p_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  status TEXT,
  roles TEXT[],
  pillar_access TEXT[],
  activated_at TIMESTAMPTZ(3),
  suspended_at TIMESTAMPTZ(3),
  deactivated_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id::TEXT,
    s.user_id::TEXT,
    s.status::TEXT,
    ARRAY(SELECT unnest(s.roles)::TEXT)::TEXT[],
    ARRAY(SELECT unnest(s.pillar_access)::TEXT)::TEXT[],
    s.activated_at,
    s.suspended_at,
    s.deactivated_at,
    s.created_at,
    s.updated_at
  FROM staff s
  WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_profile(TEXT) TO hestami_app;

-- Drop and recreate get_staff_work_queue with TIMESTAMPTZ return types
-- Uses UNION of concierge_cases, work_orders, violations, arc_requests
DROP FUNCTION IF EXISTS get_staff_work_queue();

CREATE OR REPLACE FUNCTION get_staff_work_queue()
RETURNS TABLE (
  item_type TEXT,
  item_id TEXT,
  item_number TEXT,
  organization_id TEXT,
  organization_name TEXT,
  title TEXT,
  status TEXT,
  priority TEXT,
  property_name TEXT,
  association_name TEXT,
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Concierge Cases
  SELECT 
    'CONCIERGE_CASE'::TEXT AS item_type,
    cc.id::TEXT AS item_id,
    cc.case_number::TEXT AS item_number,
    cc.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    cc.title::TEXT,
    cc.status::TEXT,
    cc.priority::TEXT,
    p.name::TEXT AS property_name,
    NULL::TEXT AS association_name,
    cc.assigned_concierge_user_id::TEXT AS assigned_to_id,
    u.name::TEXT AS assigned_to_name,
    cc.created_at,
    cc.updated_at
  FROM concierge_cases cc
  LEFT JOIN organizations o ON o.id = cc.organization_id
  LEFT JOIN individual_properties p ON p.id = cc.property_id
  LEFT JOIN users u ON u.id = cc.assigned_concierge_user_id
  WHERE cc.deleted_at IS NULL
    AND cc.status NOT IN ('CLOSED', 'CANCELLED')
  
  UNION ALL
  
  -- Work Orders
  SELECT 
    'WORK_ORDER'::TEXT AS item_type,
    wo.id::TEXT AS item_id,
    wo.work_order_number::TEXT AS item_number,
    wo.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    wo.title::TEXT,
    wo.status::TEXT,
    wo.priority::TEXT,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    wo.created_at,
    wo.updated_at
  FROM work_orders wo
  LEFT JOIN organizations o ON o.id = wo.organization_id
  LEFT JOIN associations a ON a.id = wo.association_id
  LEFT JOIN units un ON un.id = wo.unit_id
  WHERE wo.status NOT IN ('CLOSED', 'CANCELLED')
  
  UNION ALL
  
  -- Violations
  SELECT 
    'VIOLATION'::TEXT AS item_type,
    v.id::TEXT AS item_id,
    v.violation_number::TEXT AS item_number,
    v.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    v.title::TEXT,
    v.status::TEXT,
    v.severity::TEXT AS priority,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    v.created_at,
    v.updated_at
  FROM violations v
  LEFT JOIN organizations o ON o.id = v.organization_id
  LEFT JOIN associations a ON a.id = v.association_id
  LEFT JOIN units un ON un.id = v.unit_id
  WHERE v.deleted_at IS NULL
    AND v.status NOT IN ('CLOSED', 'DISMISSED')
  
  UNION ALL
  
  -- ARC Requests
  SELECT 
    'ARC_REQUEST'::TEXT AS item_type,
    ar.id::TEXT AS item_id,
    ar.request_number::TEXT AS item_number,
    ar.organization_id::TEXT,
    o.name::TEXT AS organization_name,
    ar.title::TEXT,
    ar.status::TEXT,
    'NORMAL'::TEXT AS priority,
    COALESCE(un.unit_number, 'N/A')::TEXT AS property_name,
    a.name::TEXT AS association_name,
    NULL::TEXT AS assigned_to_id,
    NULL::TEXT AS assigned_to_name,
    ar.created_at,
    ar.updated_at
  FROM arc_requests ar
  LEFT JOIN organizations o ON o.id = ar.organization_id
  LEFT JOIN associations a ON a.id = ar.association_id
  LEFT JOIN units un ON un.id = ar.unit_id
  WHERE ar.status NOT IN ('APPROVED', 'DENIED', 'WITHDRAWN');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_work_queue() TO hestami_app;

-- Drop and recreate get_work_item_org
DROP FUNCTION IF EXISTS get_work_item_org(TEXT);
DROP FUNCTION IF EXISTS get_work_item_org(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_work_item_org(
  p_item_type TEXT,
  p_item_id TEXT
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id TEXT;
BEGIN
  CASE p_item_type
    WHEN 'CONCIERGE_CASE' THEN
      SELECT organization_id INTO v_org_id FROM concierge_cases WHERE id = p_item_id;
    WHEN 'WORK_ORDER' THEN
      SELECT organization_id INTO v_org_id FROM work_orders WHERE id = p_item_id;
    WHEN 'VIOLATION' THEN
      SELECT organization_id INTO v_org_id FROM violations WHERE id = p_item_id;
    WHEN 'ARC_REQUEST' THEN
      SELECT organization_id INTO v_org_id FROM arc_requests WHERE id = p_item_id;
    ELSE
      v_org_id := NULL;
  END CASE;
  
  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_work_item_org(TEXT, TEXT) TO hestami_app;

-- Drop and recreate get_staff_work_queue_summary
DROP FUNCTION IF EXISTS get_staff_work_queue_summary();

CREATE OR REPLACE FUNCTION get_staff_work_queue_summary()
RETURNS TABLE (
  concierge_intake INT,
  concierge_in_progress INT,
  concierge_pending_external INT,
  concierge_pending_owner INT,
  work_orders_open INT,
  violations_open INT,
  arc_requests_pending INT
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'INTAKE'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'IN_PROGRESS'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'PENDING_EXTERNAL'),
    (SELECT COUNT(*)::INT FROM concierge_cases WHERE deleted_at IS NULL AND status = 'PENDING_OWNER'),
    (SELECT COUNT(*)::INT FROM work_orders WHERE status NOT IN ('CLOSED', 'CANCELLED')),
    (SELECT COUNT(*)::INT FROM violations WHERE deleted_at IS NULL AND status NOT IN ('CLOSED', 'DISMISSED')),
    (SELECT COUNT(*)::INT FROM arc_requests WHERE status NOT IN ('APPROVED', 'DENIED', 'WITHDRAWN'));
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_work_queue_summary() TO hestami_app;

-- Drop and recreate get_staff_concierge_cases_list with TIMESTAMPTZ
DROP FUNCTION IF EXISTS get_staff_concierge_cases_list(TEXT, INT);

CREATE OR REPLACE FUNCTION get_staff_concierge_cases_list(
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  case_number TEXT,
  title TEXT,
  status TEXT,
  priority TEXT,
  organization_id TEXT,
  organization_name TEXT,
  property_id TEXT,
  property_name TEXT,
  assigned_concierge_user_id TEXT,
  assigned_concierge_name TEXT,
  created_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3)
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id::TEXT,
    cc.case_number::TEXT,
    cc.title::TEXT,
    cc.status::TEXT,
    cc.priority::TEXT,
    cc.organization_id::TEXT,
    o.name::TEXT,
    cc.property_id::TEXT,
    p.name::TEXT,
    cc.assigned_concierge_user_id::TEXT,
    u.name::TEXT,
    cc.created_at,
    cc.updated_at
  FROM concierge_cases cc
  LEFT JOIN organizations o ON o.id = cc.organization_id
  LEFT JOIN individual_properties p ON p.id = cc.property_id
  LEFT JOIN users u ON u.id = cc.assigned_concierge_user_id
  WHERE cc.deleted_at IS NULL
    AND (p_status IS NULL OR cc.status::TEXT = p_status)
    AND cc.status::TEXT NOT IN ('CLOSED', 'CANCELLED')
  ORDER BY cc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_staff_concierge_cases_list(TEXT, INT) TO hestami_app;
