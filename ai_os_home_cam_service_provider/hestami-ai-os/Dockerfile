# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and config, generate client
# Note: prisma.config.ts uses dotenv, so we need a placeholder DATABASE_URL
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npx prisma generate

# Copy source and build
COPY . .
RUN npx svelte-kit sync
# Provide placeholder env vars for build (actual values come at runtime)
RUN BETTER_AUTH_SECRET="build-placeholder-secret-min-32-chars" \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npm run build

# Prune dev dependencies
RUN npm prune --production

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
