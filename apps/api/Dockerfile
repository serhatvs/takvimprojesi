# syntax=docker/dockerfile:1
#
# Production image(s) for @agu/api (NestJS).
#
# Build context: the monorepo root (not apps/api), because `turbo prune`
# needs to see the whole workspace to figure out which packages @agu/api
# actually depends on (@agu/config, @agu/contracts).
#
#   docker build -f apps/api/Dockerfile --target api      -t agu-api      .
#   docker build -f apps/api/Dockerfile --target migrate  -t agu-api-migrate .
#
# Two selectable final stages:
#   - "api"     -> the Cloud Run service image. Only runs `node apps/api/dist/src/main.js`.
#                  No automatic migration, no automatic seed.
#   - "migrate" -> the Cloud Run Job image used to run
#                  `pnpm --filter @agu/api prisma:migrate:deploy` manually before a
#                  deploy. Never runs the seed script.

################################################################################
# base: shared toolchain (Node 24 + pnpm 11.16.0), no source code yet
################################################################################
FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# openssl/ca-certificates: required by Prisma's CLI (migration engine) and by
# TLS connections to Cloud SQL / SMTP. tini: correct PID 1 signal handling so
# Cloud Run's SIGTERM on scale-down/deploy reaches Node and shuts it down
# cleanly instead of being force-killed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

WORKDIR /app

################################################################################
# pruner: trims the monorepo down to @agu/api + its internal workspace deps
################################################################################
FROM base AS pruner

# turbo isn't installed yet (no node_modules), so pull the exact version the
# repo's root package.json devDependency pins, just to run `turbo prune`.
RUN npm install -g turbo@2.10.6

COPY . .
RUN turbo prune @agu/api --docker

################################################################################
# installer: installs deps for the pruned workspace and builds it
################################################################################
FROM base AS installer

# turbo prune's "json" output only contains workspace package.json files, not
# root-level scripts referenced by the root package.json's "preinstall" hook
# or the shared tsconfig. Bring those in explicitly before `pnpm install`.
COPY scripts ./scripts
COPY tsconfig.base.json ./tsconfig.base.json
COPY --from=pruner /app/out/json/ .
# Turbo's generated workspace file can omit pnpm security settings such as
# allowBuilds. Restore the repository version before installation.
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Now bring in the real source for @agu/api and its internal deps and build.
COPY --from=pruner /app/out/full/ .

# Prisma config requires DATABASE_URL even for client generation. Use a
# non-secret placeholder only for this build step; runtime receives the real
# value from Secret Manager.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm --filter @agu/api prisma:generate
RUN pnpm turbo run build --filter=@agu/api...

################################################################################
# prod-deps: same as installer, but with devDependencies pruned away
################################################################################
FROM installer AS prod-deps
RUN pnpm prune --prod

################################################################################
# api: the Cloud Run service image (default build target)
################################################################################
FROM base AS api

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs apiuser

COPY --from=prod-deps --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=apiuser:nodejs /app/packages ./packages
COPY --from=prod-deps --chown=apiuser:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=apiuser:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps --chown=apiuser:nodejs /app/apps/api/dist ./apps/api/dist
# Schema + migrations are kept in the API image too (not just the migrate
# target) so `prisma migrate deploy` can also be run as a one-off against
# this exact image if ever needed; the API process itself never invokes it.
COPY --from=prod-deps --chown=apiuser:nodejs /app/apps/api/prisma ./apps/api/prisma

USER apiuser

ENV NODE_ENV=production
# Cloud Run injects PORT itself; 8080 here just matches the documented
# `gcloud run deploy --port` value for local `docker run` testing.
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
# No migration, no seed: just start the API. Migrations run separately via
# the "migrate" target / the agu-takvim-migrate Cloud Run Job.
CMD ["node", "apps/api/dist/src/main.js"]

################################################################################
# migrate: Cloud Run Job image. Only runs `prisma migrate deploy`, never seed.
################################################################################
FROM base AS migrate

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs apiuser

# Full (unpruned) install so the prisma CLI (a devDependency) is available.
COPY --from=installer --chown=apiuser:nodejs /app /app

USER apiuser
ENV NODE_ENV=production

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "--filter", "@agu/api", "prisma:migrate:deploy"]
