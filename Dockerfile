FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/e2b/package.json packages/e2b/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN bun install --frozen-lockfile || bun install

# Build the web app
FROM base AS web-build
COPY --from=deps /app/node_modules node_modules
COPY packages packages
COPY apps/web apps/web
COPY package.json tsconfig.json ./
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bWVhc3VyZWQtZmxhbWluZ28tODguY2xlcmsuYWNjb3VudHMuZGV2JA
RUN touch .env && bunx next build

# Production image
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bWVhc3VyZWQtZmxhbWluZ28tODguY2xlcmsuYWNjb3VudHMuZGV2JA

# Copy all node_modules (bun hoists everything to root)
COPY --from=deps /app/node_modules node_modules

# Copy source code
COPY packages packages
COPY apps apps
COPY package.json tsconfig.json ./

# Copy built Next.js output
COPY --from=web-build /app/apps/web/.next apps/web/.next

EXPOSE 3000

WORKDIR /app/apps/web
CMD ["bunx", "next", "start", "-p", "3000"]
