# Phase 39: Internationalization (i18n) with Paraglide-js

## Systems Requirements Document

**Version:** 1.0
**Date:** January 18, 2026
**Status:** Initial Implementation Complete

---

## 1. Executive Summary

### 1.1 Problem Statement

Hestami AI OS currently has all user-facing text hardcoded as English strings throughout the codebase. This creates several issues:

1. **Market Limitation** - Cannot serve non-English speaking markets (Spanish, French, German, Portuguese)
2. **Inconsistent Terminology** - Same concepts may use different terms across the application
3. **Difficult Translation** - No infrastructure exists to extract or manage translatable strings
4. **Accessibility** - Non-English users cannot effectively use the platform

### 1.2 Solution Overview

Implement Paraglide-js, a modern compiler-based i18n framework that integrates seamlessly with SvelteKit. The solution provides:

1. **Type-Safe Messages** - Compile-time validation of message keys
2. **Tree-Shaking** - Only used messages are included in the bundle
3. **Vite Integration** - Seamless build pipeline integration
4. **Message Extraction** - Centralized JSON-based message files

### 1.3 Scope

**In Scope:**
- Paraglide-js installation and configuration
- Initial message file structure (English + Spanish)
- Sample component migration demonstrating the pattern
- Docker build configuration updates
- Developer documentation

**Out of Scope:**
- Full application-wide string migration (future phases)
- Language detection middleware
- User language preferences storage
- Right-to-left (RTL) language support

---

## 2. Functional Requirements

### 2.1 Message Management

#### FR-2.1.1 Message File Structure
The system SHALL store translatable messages in JSON files located at:
```
messages/
├── en.json    # English (source language)
├── es.json    # Spanish
├── fr.json    # French (placeholder)
├── de.json    # German (placeholder)
└── pt.json    # Portuguese (placeholder)
```

#### FR-2.1.2 Message Key Convention
Message keys SHALL follow a hierarchical naming convention:
- `{domain}_{specific_key}` format
- Examples: `common_save_changes`, `vendor_business_name`, `label_email`

#### FR-2.1.3 Message Categories
The system SHALL organize messages into the following categories:

| Category | Prefix | Examples |
|----------|--------|----------|
| Common Actions | `common_` | `common_save_changes`, `common_cancel`, `common_delete` |
| Form Labels | `label_` | `label_name`, `label_email`, `label_status` |
| Form Validation | `form_` | `form_required_field`, `form_invalid_email` |
| Entity Names | `{entity}_` | `vendor_title`, `work_order_plural` |
| Empty States | `empty_state_` | `empty_state_no_data`, `empty_state_no_results` |

### 2.2 Component Integration

#### FR-2.2.1 Message Import Pattern
Components SHALL import messages using:
```typescript
import * as m from '$lib/paraglide/messages.js';
```

#### FR-2.2.2 Message Usage Pattern
Messages SHALL be used as function calls in templates:
```svelte
<button>{m.common_save_changes()}</button>
<label>{m.label_email()}</label>
```

#### FR-2.2.3 Parameterized Messages
Messages requiring dynamic values SHALL use parameter syntax:
```json
{
  "greeting_user": "Hello, {name}!"
}
```
```svelte
{m.greeting_user({ name: userName })}
```

### 2.3 Build Integration

#### FR-2.3.1 Vite Plugin Configuration
The paraglide Vite plugin SHALL be configured in `vite.config.ts`:
```typescript
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide'
    })
  ]
});
```

#### FR-2.3.2 Generated Output
The build process SHALL generate type-safe message functions at:
```
src/lib/paraglide/
├── messages.js        # Main export
├── messages/          # Individual message modules
│   ├── _index.js
│   ├── common_save_changes.js
│   └── ...
├── runtime.js         # Runtime utilities
└── server.js          # Server-side utilities
```

#### FR-2.3.3 Docker Build Support
The Dockerfile SHALL copy i18n configuration files:
```dockerfile
COPY project.inlang ./project.inlang
COPY messages ./messages
```

---

## 3. Non-Functional Requirements

### 3.1 Performance

#### NFR-3.1.1 Bundle Size
- Only messages used by imported components SHALL be included in the client bundle
- Tree-shaking SHALL eliminate unused message functions

#### NFR-3.1.2 Build Time
- Message compilation SHALL complete in < 5 seconds for up to 1000 messages

### 3.2 Developer Experience

#### NFR-3.2.1 Type Safety
- Message function parameters SHALL be type-checked at compile time
- Missing message keys SHALL cause TypeScript errors

#### NFR-3.2.2 IDE Support
- Message functions SHALL have IntelliSense/autocomplete support
- Go-to-definition SHALL navigate to message source

### 3.3 Maintainability

#### NFR-3.3.1 Linting
The inlang project SHALL configure lint rules for:
- Empty pattern detection
- Missing translation detection
- Orphan translation detection

---

## 4. Technical Architecture

### 4.1 Project Configuration

**File:** `project.inlang/settings.json`

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "sourceLanguageTag": "en",
  "languageTags": ["en", "es", "fr", "de", "pt"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-empty-pattern@1/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-missing-translation@1/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-without-source@1/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@2/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{languageTag}.json"
  }
}
```

### 4.2 Package Dependencies

```json
{
  "dependencies": {
    "@inlang/paraglide-js": "^2.9.0"
  }
}
```

### 4.3 File Structure

```
hestami-ai-os/
├── project.inlang/
│   └── settings.json           # Inlang project config
├── messages/
│   ├── en.json                 # English messages (source)
│   └── es.json                 # Spanish translations
├── src/lib/paraglide/          # Generated (git-ignored)
│   ├── messages.js
│   ├── messages/
│   ├── runtime.js
│   └── server.js
└── vite.config.ts              # Paraglide plugin configured
```

---

## 5. Implementation Details

### 5.1 Initial Message Catalog

The initial English message catalog includes:

| Category | Count | Examples |
|----------|-------|----------|
| Common Actions | 20 | save_changes, cancel, close, delete, edit |
| Form Labels | 18 | name, email, phone, status, type |
| Form Validation | 3 | required_field, invalid_email, invalid_phone |
| Properties | 5 | property_type, year_built, units |
| Documents | 3 | upload, no_documents, category |
| Work Orders | 3 | title, plural, new |
| Service Calls | 3 | title, plural, new |
| Vendors | 10 | title, edit, business_info, trades_services |
| Violations | 3 | title, plural, send_notice |
| Meetings | 2 | title, plural |
| Empty States | 2 | no_data, no_results |

**Total Initial Messages:** ~72

### 5.2 Sample Migration: Vendor Edit Page

**File:** `src/routes/app/cam/vendors/[id]/edit/+page.svelte`

**Before:**
```svelte
<h1 class="text-xl font-semibold">Edit Vendor</h1>
<label>Business Name</label>
<button>Cancel</button>
<button>Save Changes</button>
```

**After:**
```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
</script>

<h1 class="text-xl font-semibold">{m.vendor_edit()}</h1>
<label>{m.vendor_business_name()}</label>
<button>{m.common_cancel()}</button>
<button>{m.common_save_changes()}</button>
```

---

## 6. Docker Integration

### 6.1 Dockerfile Changes

Added COPY commands for i18n files before build:

```dockerfile
# Copy i18n/paraglide configuration and message files
COPY project.inlang ./project.inlang
COPY messages ./messages
```

### 6.2 Build Verification

The Docker build now outputs:
```
✔ [paraglide-js] Compilation complete (message-modules)
```

---

## 7. Future Roadmap

### Phase 39.1: Full String Migration
- Migrate all Svelte component strings to messages
- Create automated extraction tooling
- Estimated scope: 500+ strings

### Phase 39.2: Language Detection
- Add Accept-Language header detection
- Implement language preference cookies
- Add language switcher UI component

### Phase 39.3: User Preferences
- Store language preference in user settings
- Sync preference across devices
- Default to browser/system language

### Phase 39.4: Additional Languages
- Complete French translations
- Complete German translations
- Complete Portuguese translations
- Consider Chinese, Japanese, Korean for Asian markets

### Phase 39.5: RTL Support
- Add Arabic support
- Implement RTL CSS utilities
- Test bidirectional text handling

---

## 8. Developer Guide

### 8.1 Adding a New Message

1. Add the message to `messages/en.json`:
```json
{
  "new_feature_title": "My New Feature"
}
```

2. Add translation to other language files (e.g., `messages/es.json`):
```json
{
  "new_feature_title": "Mi Nueva Funcionalidad"
}
```

3. Run build to regenerate paraglide modules:
```bash
bun run build
```

4. Use in component:
```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
</script>

<h1>{m.new_feature_title()}</h1>
```

### 8.2 Message Key Naming Guidelines

| Pattern | Use Case | Example |
|---------|----------|---------|
| `common_*` | Reusable UI elements | `common_save`, `common_cancel` |
| `label_*` | Form field labels | `label_email`, `label_phone` |
| `form_*` | Form validation messages | `form_required`, `form_invalid_email` |
| `{entity}_*` | Entity-specific strings | `vendor_title`, `work_order_new` |
| `error_*` | Error messages | `error_network`, `error_unauthorized` |
| `empty_state_*` | Empty/no-data states | `empty_state_no_results` |
| `action_*` | Action-specific buttons | `action_submit_for_review` |

### 8.3 Parameterized Messages

For dynamic content:

```json
{
  "greeting": "Welcome back, {userName}!",
  "items_count": "You have {count} items"
}
```

```svelte
{m.greeting({ userName: user.name })}
{m.items_count({ count: items.length })}
```

---

## 9. Dependencies

- **Paraglide-js v2.9.0** - Core i18n compiler
- **Vite v7.2.7** - Build tool integration
- **SvelteKit** - Framework integration

---

## 10. Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Initial message catalog size | 70+ messages | 72 messages |
| Languages configured | 5 | 5 (en, es, fr, de, pt) |
| Languages with translations | 2 | 2 (en, es) |
| Sample component migrated | 1 | 1 (vendor edit) |
| Docker build passing | Yes | Yes |
| Bundle size increase | < 5KB | ~3KB |

---

## 11. References

- [Paraglide-js Documentation](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
- [Inlang Message Format](https://inlang.com/m/reootnfj/plugin-inlang-messageFormat)
- [SvelteKit i18n Guide](https://kit.svelte.dev/docs/configuration#prerender)
