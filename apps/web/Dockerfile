# syntax=docker/dockerfile:1
#
# Production image for @agu/web (Next.js, standalone output).
#
# Build context: the monorepo root (not apps/web), because `turbo prune`
# needs to see the whole workspace, and Next's file tracing needs to walk up
# to the workspace root (see outputFileTracingRoot in next.config.ts).
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://agu-takvim-api-xxxxx-ew.a.run.app \
#     -t agu-web .

################################################################################
# base: shared toolchain (Node 24 + pnpm 11.16.0), no source code yet
################################################################################
FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

WORKDIR /app

################################################################################
# pruner: trims the monorepo down to @agu/web + its internal workspace deps
################################################################################
FROM base AS pruner

RUN npm install -g turbo@2.10.6

COPY . .
RUN turbo prune @agu/web --docker

################################################################################
# installer: installs deps for the pruned workspace and builds it
################################################################################
FROM base AS installer

COPY scripts ./scripts
COPY tsconfig.base.json ./tsconfig.base.json
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .

# Next.js inlines NEXT_PUBLIC_* variables into the client bundle at build
# time, so the API origin has to be supplied as a build arg, not a runtime
# env var. NEXT_PUBLIC_API_BASE_URL is the variable name the app code
# actually reads (packages/config, press-dashboard-client.tsx); it's set
# from the same build arg so both names stay in sync.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_URL} \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# next.config.ts sets output:"standalone", which does NOT bundle a public/
# directory if one doesn't exist. Ensure the path always exists so the
# later COPY in the runtime stage never fails, even though this repo
# doesn't currently ship one.
RUN mkdir -p apps/web/public

RUN pnpm turbo run build --filter=@agu/web...

################################################################################
# web: the Cloud Run service image
################################################################################
FROM base AS web

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs webuser

ENV NODE_ENV=production
# Cloud Run injects PORT itself; 8080 matches the documented
# `gcloud run deploy --port` value and the next.config.ts server default.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Standalone output already contains a minimal server.js plus a traced,
# self-contained node_modules (workspace packages included) rooted at the
# outputFileTracingRoot (the monorepo root) — so copying it to WORKDIR
# reproduces the apps/web/server.js entrypoint directly.
COPY --from=installer --chown=webuser:nodejs /app/apps/web/.next/standalone ./
# Static assets and public/ are intentionally excluded from the standalone
# output and must be copied alongside it.
COPY --from=installer --chown=webuser:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=webuser:nodejs /app/apps/web/public ./apps/web/public

USER webuser
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
