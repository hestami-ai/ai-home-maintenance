# Phase 39: Internationalization (i18n) - Implementation Roadmap

**Version:** 1.0
**Date:** January 18, 2026
**Status:** Phase 39.0 Complete

---

## Overview

This roadmap tracks the implementation of internationalization (i18n) support using Paraglide-js across Hestami AI OS. The work is divided into phases, with Phase 39.0 (foundation) complete and subsequent phases planned for full coverage.

---

## Phase 39.0: Foundation Setup (COMPLETE)

### 39.0.1 Package Installation
- [x] Install `@inlang/paraglide-js` package
- [x] Verify version compatibility with Vite 7.x and SvelteKit

### 39.0.2 Project Configuration
- [x] Create `project.inlang/settings.json`
- [x] Configure source language (English)
- [x] Configure target languages (es, fr, de, pt)
- [x] Add lint rule modules (empty-pattern, missing-translation, without-source)
- [x] Configure message format plugin with path pattern

### 39.0.3 Vite Integration
- [x] Import `paraglideVitePlugin` from `@inlang/paraglide-js`
- [x] Add plugin to `vite.config.ts`
- [x] Configure project path and output directory
- [x] Verify build compiles messages successfully

### 39.0.4 Initial Message Catalog
- [x] Create `messages/en.json` with initial messages
- [x] Create `messages/es.json` with Spanish translations
- [x] Organize messages by category (common, label, form, entity-specific)
- [x] Verify message count (~72 initial messages)

### 39.0.5 Docker Build Support
- [x] Update `Dockerfile` to copy `project.inlang/` directory
- [x] Update `Dockerfile` to copy `messages/` directory
- [x] Verify Docker build completes with paraglide compilation
- [x] Test Docker container runs correctly

### 39.0.6 Sample Component Migration
- [x] Select sample component (`vendors/[id]/edit/+page.svelte`)
- [x] Add message import (`import * as m from '$lib/paraglide/messages.js'`)
- [x] Replace hardcoded strings with message functions
- [x] Verify component renders correctly with i18n

### 39.0.7 Documentation
- [x] Create Phase 39 SRD document
- [x] Create Phase 39 Implementation Roadmap
- [x] Document message key naming conventions
- [x] Document developer workflow for adding messages

---

## Phase 39.1: Common Components Migration

### 39.1.1 UI Component Library
- [ ] `Alert.svelte` - aria-label, variant titles
- [ ] `EmptyState.svelte` - default messages
- [ ] `LoadingSpinner.svelte` - default loading text
- [ ] `Card.svelte` - any default labels
- [ ] `Breadcrumb.svelte` - default separators/labels

### 39.1.2 Form Components
- [ ] Extract form validation messages
- [ ] Extract placeholder text
- [ ] Extract field labels used in multiple places
- [ ] Extract error messages

### 39.1.3 Navigation Components
- [ ] Sidebar navigation labels
- [ ] Header/toolbar labels
- [ ] Footer content
- [ ] Menu item labels

### 39.1.4 Modal/Dialog Components
- [ ] Confirmation dialog defaults
- [ ] Delete confirmation messages
- [ ] Cancel/Close button labels
- [ ] Modal titles and descriptions

---

## Phase 39.2: CAM Pillar Migration

### 39.2.1 Dashboard
- [ ] Dashboard page titles
- [ ] Widget labels and headers
- [ ] Empty state messages
- [ ] Stat card labels

### 39.2.2 Properties Module
- [ ] Property list page
- [ ] Property detail page
- [ ] Property edit page
- [ ] Property creation form
- [ ] Unit management pages

### 39.2.3 Vendors Module
- [x] Vendor edit page (sample migration)
- [ ] Vendor list page
- [ ] Vendor detail page
- [ ] Vendor creation form
- [ ] Vendor approval workflow

### 39.2.4 Work Orders Module
- [ ] Work order list page
- [ ] Work order detail page
- [ ] Work order creation form
- [ ] Status labels and transitions
- [ ] Priority labels

### 39.2.5 Violations Module
- [ ] Violation list page
- [ ] Violation detail page
- [ ] Violation creation form
- [ ] Notice templates
- [ ] Status labels

### 39.2.6 ARC Module
- [ ] ARC request list page
- [ ] ARC request detail page
- [ ] ARC submission form
- [ ] Review workflow labels
- [ ] Status transitions

### 39.2.7 Governance Module
- [ ] Meeting list page
- [ ] Meeting detail page
- [ ] Meeting scheduling form
- [ ] Motion voting interface
- [ ] Minutes generation labels

### 39.2.8 Documents Module
- [ ] Document list page
- [ ] Document upload interface
- [ ] Category labels
- [ ] Document type labels

---

## Phase 39.3: Concierge Pillar Migration

### 39.3.1 Case Management
- [ ] Case list page
- [ ] Case detail page
- [ ] Case creation form
- [ ] Case status labels
- [ ] Priority labels

### 39.3.2 Service Calls
- [ ] Service call list page
- [ ] Service call detail page
- [ ] Service call creation form
- [ ] Status transitions

### 39.3.3 Property Owner Portal
- [ ] Owner dashboard
- [ ] Property details
- [ ] Document access
- [ ] Communication preferences

---

## Phase 39.4: Contractor Pillar Migration

### 39.4.1 Job Management
- [ ] Job list page
- [ ] Job detail page
- [ ] Job status labels
- [ ] Dispatch interface

### 39.4.2 Team Management
- [ ] Technician list
- [ ] Technician profile
- [ ] Schedule management
- [ ] Role labels

### 39.4.3 Bidding Interface
- [ ] Bid submission form
- [ ] Bid review interface
- [ ] Pricing labels

---

## Phase 39.5: Admin/Staff Pillar Migration

### 39.5.1 Organization Management
- [ ] Organization list
- [ ] Organization detail
- [ ] Settings pages
- [ ] Permission labels

### 39.5.2 User Management
- [ ] User list
- [ ] User detail
- [ ] Role assignment
- [ ] Invitation workflow

### 39.5.3 Activity/Audit
- [ ] Activity timeline labels
- [ ] Audit log labels
- [ ] Event type labels

---

## Phase 39.6: Onboarding Flows

### 39.6.1 Authentication
- [ ] Login page
- [ ] Registration page
- [ ] Password reset
- [ ] Email verification

### 39.6.2 Organization Onboarding
- [ ] Pillar selection
- [ ] Organization creation
- [ ] Initial setup wizard

### 39.6.3 Invitation Acceptance
- [ ] Invitation code entry
- [ ] Organization join flow
- [ ] Role acceptance

---

## Phase 39.7: Language Infrastructure

### 39.7.1 Language Detection
- [ ] Implement Accept-Language header detection in hooks.server.ts
- [ ] Add language preference cookie support
- [ ] Create language detection utility function

### 39.7.2 Language Switcher UI
- [ ] Create LanguageSwitcher component
- [ ] Add to header/settings
- [ ] Persist selection to cookie
- [ ] Update page without full reload

### 39.7.3 User Preferences
- [ ] Add language field to user preferences model
- [ ] Create API endpoint for language preference
- [ ] Sync preference across devices
- [ ] Default to detected/browser language

---

## Phase 39.8: Additional Languages

### 39.8.1 French (fr)
- [ ] Create `messages/fr.json`
- [ ] Translate common messages
- [ ] Translate CAM-specific messages
- [ ] Translate other pillar messages
- [ ] Review by native speaker

### 39.8.2 German (de)
- [ ] Create `messages/de.json`
- [ ] Translate common messages
- [ ] Translate CAM-specific messages
- [ ] Translate other pillar messages
- [ ] Review by native speaker

### 39.8.3 Portuguese (pt)
- [ ] Create `messages/pt.json`
- [ ] Translate common messages
- [ ] Translate CAM-specific messages
- [ ] Translate other pillar messages
- [ ] Review by native speaker

---

## Phase 39.9: Quality Assurance

### 39.9.1 Translation Validation
- [ ] Run inlang lint checks
- [ ] Fix missing translations
- [ ] Fix empty patterns
- [ ] Review orphan translations

### 39.9.2 Visual Testing
- [ ] Test all pages in English
- [ ] Test all pages in Spanish
- [ ] Check for text overflow issues
- [ ] Verify dynamic content displays correctly

### 39.9.3 Accessibility
- [ ] Verify screen reader compatibility
- [ ] Test with translated aria-labels
- [ ] Validate language attributes

---

## Tooling & Automation

### Extraction Script (Future)
- [ ] Create script to scan Svelte files for hardcoded strings
- [ ] Generate message keys automatically
- [ ] Output missing messages report

### CI/CD Integration
- [ ] Add translation lint to CI pipeline
- [ ] Fail build on missing required translations
- [ ] Generate translation coverage report

---

## Progress Summary

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| 39.0 | Foundation Setup | Complete | 100% |
| 39.1 | Common Components | Not Started | 0% |
| 39.2 | CAM Pillar | In Progress | 5% |
| 39.3 | Concierge Pillar | Not Started | 0% |
| 39.4 | Contractor Pillar | Not Started | 0% |
| 39.5 | Admin/Staff Pillar | Not Started | 0% |
| 39.6 | Onboarding Flows | Not Started | 0% |
| 39.7 | Language Infrastructure | Not Started | 0% |
| 39.8 | Additional Languages | Not Started | 0% |
| 39.9 | Quality Assurance | Not Started | 0% |

---

## Files Modified (Phase 39.0)

| File | Change |
|------|--------|
| `package.json` | Added `@inlang/paraglide-js` dependency |
| `vite.config.ts` | Added paraglide Vite plugin |
| `project.inlang/settings.json` | Created inlang project config |
| `messages/en.json` | Created English message catalog |
| `messages/es.json` | Created Spanish translations |
| `Dockerfile` | Added COPY for project.inlang and messages |
| `src/routes/app/cam/vendors/[id]/edit/+page.svelte` | Sample i18n migration |

---

## Message Catalog Statistics

| Language | Messages | Coverage |
|----------|----------|----------|
| English (en) | 72 | 100% (source) |
| Spanish (es) | 72 | 100% |
| French (fr) | 0 | 0% |
| German (de) | 0 | 0% |
| Portuguese (pt) | 0 | 0% |

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @inlang/paraglide-js | ^2.9.0 | i18n compiler and runtime |

---

## Notes

1. **Incremental Migration**: Components can be migrated incrementally. Hardcoded strings and i18n messages can coexist during the migration period.

2. **Message Reuse**: Prioritize common messages that appear in multiple places to maximize ROI of translation effort.

3. **Context for Translators**: When adding messages, include comments in the JSON for translator context where the meaning might be ambiguous.

4. **Testing Strategy**: Test each migrated component in at least two languages (en + es) before marking as complete.

5. **Performance**: Paraglide's tree-shaking ensures only used messages are bundled, so there's no performance penalty for having a large message catalog.
