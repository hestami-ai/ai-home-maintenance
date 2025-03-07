# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app


# Copy package files
COPY ./frontend/nextjs/package.json ./frontend/nextjs/package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ./frontend/nextjs .


# Set environment variables
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build application
ARG ENV_NPM_BUILD_FILE
COPY ${ENV_NPM_BUILD_FILE} .
RUN npm install dotenv dotenv-cli
RUN ./node_modules/.bin/dotenv -e ${ENV_NPM_BUILD_FILE} npm run build
RUN rm ${ENV_NPM_BUILD_FILE}

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install sharp for production - DELETE IF NOT NEEDED
# COPY --from=builder /app/node_modules/sharp ./node_modules/sharp

# Copy necessary files
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]