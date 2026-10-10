# syntax=docker/dockerfile:1.7
# Production image for the VPS (see deploy/README.md). Built on the VPS by
# `docker compose build`, so `next build` can prerender pages straight from
# the local Postgres.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DEPLOYMENT_VERSION
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
# Type checking happens in CI (see .github/workflows/deploy.yml); skipping it
# here keeps the build within a 4 GB VPS. The heap cap leaves room for
# Postgres and n8n running alongside.
ENV SKIP_BUILD_TYPECHECK=1 NODE_OPTIONS=--max-old-space-size=2560
# The production .env is mounted only for this step (NEXT_PUBLIC_* values are
# inlined into the client bundle at build time). Standalone output copies
# .env files next to server.js, so they are deleted again right after the
# build — otherwise every secret would ship inside the image. The runtime
# container gets its environment from compose's env_file instead.
# The build reaches Postgres over the host network, so DATABASE_URL is
# overridden with the loopback address from a second secret.
RUN --mount=type=secret,id=dotenv,target=/app/.env \
    --mount=type=secret,id=build_database_url \
    DATABASE_URL="$(cat /run/secrets/build_database_url)" pnpm build \
    && rm -f .next/standalone/.env .next/standalone/.env.*

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
