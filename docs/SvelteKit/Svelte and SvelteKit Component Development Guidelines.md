# LLM Developer Instruction Prompt: SvelteKit SSR App with Dialog UX and Native Extension

You are developing a SvelteKit 2.16 application using **Svelte 5**, **TailwindCSS**, **Skeleton UI 3**, and **Melt UI** for dialog components. The app prioritizes **server-side rendering (SSR)** and strictly avoids single-page app (SPA) patterns. It must work responsively on desktop and mobile, and will later integrate with a **native iOS app** using WebView or Capacitor (potentially with RoomPlan SDK support).

---

## Primary Design Goals

### 1. Server-First Rendering
- Use `+page.server.ts` and `+layout.server.ts` for all data fetching.
- Avoid hydration unless absolutely necessary.
- Disable client-side rendering with `export const csr = false` on non-interactive pages.
- Use `<ClientOnly>` or `onMount()` only when interactivity is required and cannot be SSR'd.

### 2. Secure Server-Only API Access
- All backend API calls must be made from the SvelteKit server.
- Backend is Django REST Framework with JWT-based authentication.
- Authentication is handled via Auth.js on the SvelteKit server.
- Never expose backend URLs or secrets to the browser.

### 3. Mobile-First and Safe-Area Layouts
- Follow Tailwind’s mobile-first strategy with responsive breakpoints (`xs`, `sm`, `md`, etc.).
- Respect safe areas using `env(safe-area-inset-*)` for padding and layout margins.
- Use `rem`-based typography and spacing consistent with iOS design expectations.

### 4. Dialog and Modal System
- Use **Melt UI** for all modal and dialog components.
- Ensure dialogs are accessible, keyboard-navigable, focus-trapped, and mobile-friendly.
- Manage modal state via a centralized registry:
  - `registerModal('editProperty')`
  - `openModal('editProperty')`
  - `closeModal('editProperty')`

### 5. Form Handling and UI Updates
- Use SvelteKit’s `use:enhance` on all forms.
- On successful form submission, use `invalidate('key')` to re-fetch updated data.
- Avoid local-only state unless for temporary interaction (e.g., modal visibility).
- Prefer server-side logic and SSR consistency over SPA-like dynamic state.

### 6. Styling and Theming
- Use Skeleton UI 3 and Tailwind utility classes for layout and design.
- Apply dark mode using Tailwind’s `darkMode: 'class'` strategy.
- Follow responsive layout conventions (`grid-cols-1 sm:grid-cols-2`, etc.).
- Use shared design tokens from `tailwind.config.js`.

### 7. Hybrid iOS Readiness
- Ensure all layouts are responsive and render cleanly in `WKWebView` or Capacitor shells.
- Support touch input and avoid hover-only interactions.
- All dialogs, buttons, and inputs must be mobile-safe and account for virtual keyboards.

---

## Prohibited or Restricted Svelte 5 Patterns

| Feature                         | Avoid or Limit      | Reason                                                      |
|----------------------------------|---------------------|-------------------------------------------------------------|
| `onMount()`                     | Avoid unless needed | Forces hydration, bypasses SSR                             |
| Client `fetch()` in `.svelte`   | Prohibited          | Exposes backend URLs, breaks server-only access control    |
| `export const ssr = false`      | Avoid               | Breaks SSR-first principle                                 |
| Global `writable()` stores      | Use cautiously      | May replicate SPA patterns and introduce race conditions   |
| `on:submit` without `use:enhance` | Avoid             | Breaks SvelteKit's action system, bypasses SSR flow        |
| `transition:*` on SSR DOM       | Avoid               | Can force hydration unexpectedly; prefer CSS transitions   |
| Custom `use:` actions that mutate DOM | Avoid          | Risk of hydration mismatch unless controlled               |

---

## Developer Action Guidelines

- Use SSR and proxy backend calls exclusively from the server.
- Use the `modalRegistry.ts` abstraction for all dialogs.
- Use `invalidate()` to trigger reactive updates after form submissions.
- Avoid full-page reloads or redirect patterns unless necessary.
- Maintain accessibility, safe-area compliance, and responsive behavior throughout.

