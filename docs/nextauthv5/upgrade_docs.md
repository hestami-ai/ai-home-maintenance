Upgrade Guide (NextAuth.js v5)

This guide only applies to next-auth upgrades for users of Next.js. Feel free to skip to the next section, Installation, if you are not upgrading to next-auth@5.

NextAuth.js version 5 is a major rewrite of the next-auth package, that being said, we introduced as few breaking changes as possible. For all else, this document will guide you through the migration process.

Get started by installing the latest version of next-auth with the beta tag.

npm install next-auth@beta

New Features
Main changes

    App Router-first (pages/ still supported)
    OAuth support on preview deployments (Read more)
    Simplified setup (shared config, inferred env variables)
    New account() callback on providers (account() docs)
    Edge-compatible

Universal auth()

    A single method to authenticate anywhere
    Use auth() instead of getServerSession, getSession, withAuth, getToken, and useSession (Read more)

Breaking Changes

    Auth.js now builds on @auth/core with stricter OAuth/OIDC spec-compliance, which might break some existing OAuth providers. See our open issues for more details.
    OAuth 1.0 support is deprecated.
    The minimum required Next.js version is now 14.0.
    The import next-auth/next is replaced. See Authenticating server-side for more details.
    The import next-auth/middleware is replaced. See Authenticating server-side for more details.
    When the idToken: boolean option is set to false, it won’t entirely disable the ID token. Instead, it signals next-auth to also visit the userinfo_endpoint for the final user data. Previously, idToken: false opted out to check the id_token validity at all.

Migration
Configuration File

One of our goals was to avoid exporting your configuration from one file and passing it around as authOptions throughout your application. To achieve this, we settled on moving the configuration file to the root of the repository and having it export the necessary functions you can use everywhere else. (auth, signIn, signOut, handlers etc.).

The configuration file should look very similar to your previous route-based Auth.js configuration. Except that we’re doing it in a new file in the root of the repository now, and we’re exporting methods to be used elsewhere. Below is a simple example of a v5 configuration file.
./auth.ts

import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
 
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub, Google],
})

Some things to note about the new configuration:

    This is now in a file named auth.ts in the root of your repository. It can technically be named anything, but you’ll be importing the exported methods from here across your app, so we’d recommend keeping it short.
    There is no need to install @auth/core to import the provider definitions from, these come from next-auth itself.
    The configuration object passed to the NextAuth() function is the same as before.
    The returned methods exported from the NextAuth() function call are new and will be required elsewhere in your application.

The old configuration file, contained in the API Route (pages/api/auth/[...nextauth].ts / app/api/auth/[...nextauth]/route.ts), now becomes much shorter. These exports are designed to be used in an App Router API Route, but the rest of your app can stay in the Pages Router if you are gradually migrating!
app/api/auth/[...nextauth]/route.ts

import { handlers } from "@/auth"
export const { GET, POST } = handlers

Authenticating server-side

Auth.js has had a few different ways to authenticate server-side in the past, so we’ve tried to simplify this as much as possible.

Now that Next.js components are server-first by default, and thanks to the investment in using standard Web APIs, we were able to simplify the authentication process to a single auth() function call in most cases.
Authentication methods

See the table below for a summary of the changes. Below that are diff examples of how to use the new auth() method in various environments and contexts.
Where	v4	v5
Server Component	getServerSession(authOptions)	auth() call
Middleware	withAuth(middleware, subset of authOptions) wrapper	auth export / auth() wrapper
Client Component	useSession() hook	useSession() hook
Route Handler	Previously not supported	auth() wrapper
API Route (Edge)	Previously not supported	auth() wrapper
API Route (Node.js)	getServerSession(req, res, authOptions)	auth(req, res) call
API Route (Node.js)	getToken(req) (No session rotation)	auth(req, res) call
getServerSideProps	getServerSession(ctx.req, ctx.res, authOptions)	auth(ctx) call
getServerSideProps	getToken(ctx.req) (No session rotation)	auth(req, res) call


Details

Server Components (App Router)
Auth.js v4 has supported reading the session in Server Components for a while via getServerSession. This has been also simplified to the same auth() function.
app/page.tsx

- import { authOptions } from "pages/api/auth/[...nextauth]"
- import { getServerSession } from "next-auth/next"
+ import { auth } from "@/auth"
 
export default async function Page() {
-  const session = await getServerSession(authOptions)
+  const session = await auth()
  return (<p>Welcome {session?.user.name}!</p>)
}

Client Components (App Router)

Imports from next-auth/react are now marked with the "use client" directive. Therefore, they can be used in client components just like they were used in previous versions. Don’t forget, client components that attempt to access the session via context will need to be wrapped in a <SessionProvider />.
components/clientComponent.tsx

'use client';
 
import { useSession, SessionProvider } from 'next-auth/react';
 
const ClientComponent = () => {
  const session = useSession();
 
  return (
    <SessionProvider>
      <p>Welcome {session?.user?.name}</p>
    </SessionProvider>
  )
}

Middleware

middleware.ts

- export { default } from "next-auth/middleware"
+ export { auth as middleware } from "@/auth"

For advanced use cases, you can use auth as a wrapper for your Middleware:
middleware.ts

import { auth } from "@/auth"
 
export default auth((req) => {
  // req.auth
})
 
// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}

Whenever auth() is passed the res object (i.e. as a part of context), it will rotate the session expiry. This was not the case with getToken() previously.
Adapters
Adapter packages

Beginning with next-auth v5, you should now install database adapters from the @auth/*-adapter scope, instead of @next-auth/*-adapter. Database adapters don’t rely on any Next.js features, so it made more sense to move them to this new scope.

- npm install @next-auth/prisma-adapter
+ npm install @auth/prisma-adapter

Check out the adapters page for a list of official adapters, or the “create a database adapter” guide to learn how to create your own.
Database Migrations

NextAuth.js v5 does not introduce any breaking changes to the database schema. However, since OAuth 1.0 support is dropped, the (previously optional) oauth_token_secret and oauth_token fields can be removed from the account table if you are not using them.

Furthermore, previously uncommon fields like GitHub’s refresh_token_expires_in fields were required to be added to the account table. This is no longer the case, and you can remove it if you are not using it. If you do use it, please make sure to return it via the new account() callback.
Edge compatibility

While Auth.js strictly uses standard Web APIs (and thus can run in any environment that supports them), some libraries or ORMs (Object-Relational Mapping) packages that you rely on might not be ready yet. In this case, you can split the auth configuration into multiple files.

Auth.js supports two session strategies. When you are using an adapter, it will default to the database strategy. Unless your database and its adapter is compatible with the Edge runtime/infrastructure, you will not be able to use the "database" session strategy.

So for example, if you are using an adapter that relies on an ORM/library that is not yet compatible with Edge runtime(s) below is an example where we force the jwt strategy and split up the configuration so the library doesn’t attempt to access the database in edge environments, like in the middleware.

The following filenames are only a convention, they can be named anything you like.

    Create an auth.config.ts file which exports an object containing your Auth.js configuration options. You can put all common configuration here which does not rely on the adapter. Notice this is exporting a configuration object only, we’re not calling NextAuth() here.

auth.config.ts

import GitHub from "next-auth/providers/github"
import type { NextAuthConfig } from "next-auth"
 
export default { providers: [GitHub] } satisfies NextAuthConfig

    Next, create an auth.ts file and add your adapter and the jwt session strategy there. This is the auth.ts configuration file you will import from in the rest of your application, other than in the middleware.

auth.ts

import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import authConfig from "./auth.config"
 
const prisma = new PrismaClient()
 
export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
})

    In your middleware file, import the configuration object from your first auth.config.ts file and use it to lazily initialize Auth.js there. In effect, initialize Auth.js separately with all of your common options, but without the edge incompatible adapter.

middleware.ts

import authConfig from "./auth.config"
import NextAuth from "next-auth"
 
// Use only one of the two middleware options below
// 1. Use middleware directly
// export const { auth: middleware } = NextAuth(authConfig)
 
// 2. Wrapped middleware option
const { auth } = NextAuth(authConfig)
export default auth(async function middleware(req: NextRequest) {
  // Your custom middleware logic goes here
})

The above is just an example. The main idea, is to separate the part of the configuration that is edge-compatible from the rest, and only import the edge-compatible part in Middleware/Edge pages/routes. You can read more about this workaround in the Prisma docs, for example.

Please follow up with your library/database/ORM’s maintainer to see if they are planning to support the Edge runtime/infrastructure.

For more information in general about edge compatibility and how Auth.js fits into this, check out our edge compatibility article.
Environment Variables

There are no breaking changes to the environment variables, but we have cleaned up a few things which make some of them unnecessary. Therefore, we wanted to share some best practices around environment variables.

    All environment variables should be prefixed with AUTH_, NEXTAUTH_ is no longer in use.
    If you name your provider secret / clientId variables using this syntax, i.e. AUTH_GITHUB_SECRET and AUTH_GITHUB_ID, they will be auto-detected and you won’t have to explicitly pass them into your provider’s configuration.
    The NEXTAUTH_URL/AUTH_URL is not strictly necessary anymore in most environments. We will auto-detect the host based on the request headers.
    The AUTH_TRUST_HOST environment variable serves the same purpose as setting trustHost: true in your Auth.js configuration. This is necessary when running Auth.js behind a proxy. When set to true we will trust the X-Forwarded-Host and X-Forwarded-Proto headers passed to the app by the proxy to auto-detect the host URL (AUTH_URL)
    The AUTH_SECRET environment variable is the only variable that is really necessary. You do not need to additionally pass this value into your config as the secret configuration option if you’ve set the environment variable.

For more information about environment variables and environment variable inference, check out our environment variable page.
TypeScript

    NextAuthOptions is renamed to NextAuthConfig
    The following types are now exported from all framework packages like next-auth and @auth/sveltekit:

export type {
  Account,
  DefaultSession,
  Profile,
  Session,
  User,
} from "@auth/core/types"

    All Adapter types are re-exported from /adapters in the framework packages as well, i.e. from next-auth/adapters, @auth/sveltekit/adapters, etc.

Cookies

    The next-auth prefix is renamed to authjs.

Summary

We hope this migration goes smoothly for everyone! If you have any questions or get stuck anywhere, feel free to create a new issue on GitHub, or come chat with us in the Discord server.