Prompt for Software Developer AI Agent
Objective:
Create a new SvelteKit application that uses Skeleton UI and implements authentication, session management, and API proxying according to the specifications below.

🛠 Setup and Stack
Framework: SvelteKit (latest stable version)

Language: TypeScript

UI Library: TailwindCSS + Skeleton UI

Theme: Tailwind dark mode support enabled by default

Hosting Target: Serverful hosting (Node.js server behind Nginx or Traefik)

🔐 Authentication and Session Management
Users authenticate through an external Python Django authentication server via username/password.

Future OAuth support (Google, GitHub, etc.) should be easy to add later (modularize the auth system).

On successful login, store the session securely using HTTP-only cookies with Secure, SameSite=Strict attributes.

Set a fixed session expiration (e.g., 30 minutes) on the server cookie.

Implement silent heartbeat session checking:

Client should ping /session/check every 2–5 minutes.

If the server responds 401 Unauthorized, automatically redirect to /login.

Implement global 401 error handling:

All client fetch requests should be wrapped.

If any server call returns 401, immediately redirect to login page.

📡 API Proxying
Set up proxy routes inside SvelteKit:

src/routes/api/proxy/[...path]/+server.ts

Proxy incoming client requests securely to external backend API servers (Django server and others).

Securely attach any necessary auth headers, session cookies, or other credentials.

Prevent the client from directly accessing backend URLs.

🧩 Pages and Routes
/login — login page (basic Skeleton UI form, styled with Tailwind)

/dashboard — authenticated landing page after login

/dashboard/overview — example protected page

/dashboard/settings — example protected page

Public (unauthenticated) routes should be accessible normally.

Private (authenticated) routes must:

Check authentication server-side (+layout.server.ts and hooks.server.ts).

Redirect unauthorized users back to /login.

🧠 State Management
Use SvelteKit reactive stores for:

User session data (e.g., username, roles)

UI states (e.g., dark mode preferences)

Persist important session info in memory only (no need to store in localStorage unless offline support is added later).

📦 Packages to Install
@skeletonlabs/skeleton (Skeleton UI)

tailwindcss (if not automatically bundled)

(Optional) sveltekit-superforms if enhanced form handling is desired later

⚙️ Other Technical Requirements
Use SvelteKit layouts (+layout.svelte and +layout.server.ts) to persist page state across route navigations.

Use hooks.server.ts to:

Read and validate session cookies on every request.

Populate locals.user with the authenticated user's information.

Use Tailwind dark mode strategy set to "class".

✨ Deliverables
Working SvelteKit app skeleton with authentication, session timeout management, and backend API proxying fully wired up.

Tailwind + Skeleton UI integrated with dark mode support.

Example protected page (/dashboard/overview) demonstrating a logged-in user experience.

Example of global fetch wrapper for 401 detection.

🚀 Notes
The project should be clean, modular, and ready for future feature additions such as OAuth authentication or offline support.

Prioritize secure session handling and good user experience (silent session timeout handling).

No need to set up ESLint or Prettier (already handled externally).

Make all code TypeScript-idiomatic, using SvelteKit best practices.