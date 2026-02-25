# Indexer Service
# Builds spec/decision indices for evidence bundle generation

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy entire workspace for pnpm workspace resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY schemas ./schemas
COPY packages ./packages
COPY services/indexer ./services/indexer

# Copy other workspace package.json files to satisfy workspace resolution
COPY services/bundle-builder/package.json ./services/bundle-builder/
COPY extension/package.json ./extension/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages in order
RUN pnpm --filter @hestami/contracts build
RUN pnpm --filter @hestami/corpus-tools build
RUN pnpm --filter @hestami/indexer build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install pnpm for runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy built outputs and dependencies
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml* ./
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/corpus-tools/package.json ./packages/corpus-tools/
COPY --from=builder /app/packages/corpus-tools/dist ./packages/corpus-tools/dist
COPY --from=builder /app/services/indexer/package.json ./services/indexer/
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/packages/corpus-tools/node_modules ./packages/corpus-tools/node_modules
COPY --from=builder /app/services/indexer/node_modules ./services/indexer/node_modules

# Run
CMD ["node", "services/indexer/dist/index.js"]
