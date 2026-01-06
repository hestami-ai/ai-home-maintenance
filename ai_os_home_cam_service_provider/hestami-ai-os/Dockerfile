# syntax=docker/dockerfile:1.4

# =============================================================================
# Build stage - Bun for package management and build
# =============================================================================
FROM oven/bun:1.3.5-debian AS builder

WORKDIR /app

# Copy files needed for bun install
COPY package.json bun.lock ./
COPY 3rdParty/zod-prisma-types-3.5.8/packages/generator/zod-prisma-types-3.5.8.tgz ./3rdParty/zod-prisma-types-3.5.8/packages/generator/

# Use BuildKit cache mount for bun cache - dramatically speeds up rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Copy Prisma schema and generate client (separate layer for caching)
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    bunx prisma generate

# Copy config files needed for build (separate from source for better caching)
COPY tsconfig.json svelte.config.js vite.config.ts ./

# Copy source files
COPY src ./src
COPY static ./static
COPY scripts ./scripts

# Sync and build with svelte-adapter-bun
RUN bunx svelte-kit sync
RUN BETTER_AUTH_SECRET="build-placeholder-secret-min-32-chars" \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    bun run build

# =============================================================================
# Production stage - Bun runtime (single process per container)
# =============================================================================
FROM oven/bun:1.3.5-debian AS production

WORKDIR /app

# Create non-root user
RUN groupadd -g 1001 sveltekit && \
    useradd -u 1001 -g sveltekit -m sveltekit

# Copy built application from builder
COPY --from=builder --chown=sveltekit:sveltekit /app/build ./build
COPY --from=builder --chown=sveltekit:sveltekit /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:sveltekit /app/package.json ./
COPY --from=builder --chown=sveltekit:sveltekit /app/generated ./generated

# Copy Prisma schema and migrations for runtime migrate deploy
COPY --from=builder --chown=sveltekit:sveltekit /app/prisma ./prisma

# Copy telemetry preload and entrypoint script
COPY --chown=sveltekit:sveltekit telemetry.ts ./
COPY --chown=sveltekit:sveltekit docker/app/entrypoint.sh ./

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Switch to non-root user
USER sveltekit

EXPOSE 3000

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run entrypoint script which handles migrations and starts app
CMD ["./entrypoint.sh"]
