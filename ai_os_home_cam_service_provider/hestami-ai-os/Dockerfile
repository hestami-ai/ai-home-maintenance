# syntax=docker/dockerfile:1.4

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
# Only copy files needed for npm ci
COPY package*.json ./
COPY 3rdParty/zod-prisma-types-3.5.8/packages/generator/zod-prisma-types-3.5.8.tgz ./

# Use BuildKit cache mount for npm cache - dramatically speeds up rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy Prisma schema and generate client (separate layer for caching)
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate

# Copy config files needed for build (separate from source for better caching)
COPY tsconfig.json svelte.config.js vite.config.ts ./

# Copy source files
COPY src ./src
COPY static ./static
COPY scripts ./scripts

# Sync and build
RUN npx svelte-kit sync
RUN BETTER_AUTH_SECRET="build-placeholder-secret-min-32-chars" \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npm run build

# Prune dev dependencies in a separate layer
RUN --mount=type=cache,target=/root/.npm \
    npm prune --production

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install PM2 and Prisma CLI globally
RUN npm install -g pm2 prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

# Copy built application
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./
COPY --from=builder --chown=sveltekit:nodejs /app/generated ./generated

# Copy Prisma schema and migrations for runtime migrate deploy
COPY --from=builder --chown=sveltekit:nodejs /app/prisma ./prisma

# Copy PM2 ecosystem config, telemetry preload, and entrypoint script
COPY --chown=sveltekit:nodejs ecosystem.config.cjs ./
COPY --chown=sveltekit:nodejs telemetry.cjs ./
COPY --chown=sveltekit:nodejs docker/app/entrypoint.sh ./

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Switch to non-root user
USER sveltekit

EXPOSE 3000

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Run entrypoint script which handles migrations and starts app
CMD ["./entrypoint.sh"]
