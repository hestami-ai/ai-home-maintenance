# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY ./frontend/sveltekit/hestami-ai-ui/package*.json ./

# Install dependencies
RUN npm ci

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY ./frontend/sveltekit/hestami-ai-ui/package*.json ./

# Install dependencies with platform-specific binaries
RUN npm ci --no-optional --platform=linux --arch=x64
RUN npm i @rollup/rollup-linux-x64-musl


# Copy source code
COPY ./frontend/sveltekit/hestami-ai-ui .

# Build the application
RUN npm i -D @sveltejs/adapter-node
RUN NODE_ENV=production npm run build

# Stage 3: Production
FROM node:18-alpine AS deployer
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/build ./build/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/ecosystem.config.cjs ./
COPY --from=builder /app/node_modules ./node_modules/

EXPOSE 3000

ENV NODE_ENV=production
ENV BODY_SIZE_LIMIT=104857600

CMD ["npx", "pm2-runtime", "start", "ecosystem.config.cjs"]