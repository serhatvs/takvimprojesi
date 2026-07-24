import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// These checks don't require Docker: they assert on the actual file contents
// of the deployment artifacts so a bad edit to the Dockerfile / Cloud Build
// configs / .dockerignore fails `pnpm test` instead of only being caught by
// a much slower, Docker-dependent smoke test (see scripts/docker/).

const repoRoot = resolve(__dirname, "../../../..");

const readRepoFile = (relativePath: string): string =>
  readFileSync(resolve(repoRoot, relativePath), "utf8");

describe("apps/api/Dockerfile", () => {
  const dockerfile = readRepoFile("apps/api/Dockerfile");

  it("defines both the api and migrate targets", () => {
    expect(dockerfile).toMatch(/FROM base AS api/);
    expect(dockerfile).toMatch(/FROM base AS migrate/);
  });

  it("starts the API service without running migrations or seed automatically", () => {
    const apiStage = dockerfile.split("FROM base AS api")[1]?.split("FROM base AS migrate")[0] ?? "";
    expect(apiStage).toMatch(/CMD \["node", "apps\/api\/dist\/src\/main\.js"\]/);
    expect(apiStage).not.toMatch(/CMD.*migrate/i);
    expect(apiStage).not.toMatch(/CMD.*seed/i);
    expect(apiStage).not.toMatch(/ENTRYPOINT.*migrate/i);
    expect(apiStage).not.toMatch(/ENTRYPOINT.*seed/i);
  });

  it("runs prisma migrate deploy in the migrate target and never seeds", () => {
    const migrateStage = dockerfile.split("FROM base AS migrate")[1] ?? "";
    expect(migrateStage).toMatch(
      /CMD \["pnpm", "--filter", "@agu\/api", "prisma:migrate:deploy"\]/
    );
    expect(migrateStage).not.toMatch(/seed/i);
  });

  it("runs as a non-root user in both the api and migrate stages", () => {
    const stages = dockerfile.split(/FROM base AS (api|migrate)/).slice(1);
    for (let i = 0; i < stages.length; i += 2) {
      const stageBody = stages[i + 1] ?? "";
      expect(stageBody).toMatch(/USER apiuser/);
    }
  });

  it("copies the prisma schema and migrations into both runtime stages", () => {
    expect(dockerfile).toMatch(/apps\/api\/prisma/);
  });
});

describe("apps/web/Dockerfile", () => {
  const dockerfile = readRepoFile("apps/web/Dockerfile");

  it("accepts NEXT_PUBLIC_API_URL as a build-time ARG", () => {
    expect(dockerfile).toMatch(/ARG NEXT_PUBLIC_API_URL/);
  });

  it("also exports it as NEXT_PUBLIC_API_BASE_URL, the variable the app code reads", () => {
    expect(dockerfile).toMatch(/NEXT_PUBLIC_API_BASE_URL=\$\{NEXT_PUBLIC_API_URL\}/);
  });

  it("uses the Next.js standalone server as the runtime entrypoint", () => {
    expect(dockerfile).toMatch(/CMD \["node", "apps\/web\/server\.js"\]/);
  });

  it("runs as a non-root user", () => {
    expect(dockerfile).toMatch(/USER webuser/);
  });
});

describe("root .dockerignore", () => {
  const dockerignore = readRepoFile(".dockerignore");

  it("excludes .env files and .git from the build context", () => {
    expect(dockerignore).toMatch(/\*\*\/\.env/);
    expect(dockerignore).toMatch(/\*\*\/\.git/);
  });

  it("still allows .env.example through", () => {
    expect(dockerignore).toMatch(/!\*\*\/\.env\.example/);
  });

  it("excludes node_modules and build caches", () => {
    expect(dockerignore).toMatch(/\*\*\/node_modules/);
    expect(dockerignore).toMatch(/\*\*\/dist/);
    expect(dockerignore).toMatch(/\*\*\/\.next/);
  });
});

describe("cloudbuild.api.yaml", () => {
  const cfg = readRepoFile("cloudbuild.api.yaml");

  it("builds both the api and migrate targets from apps/api/Dockerfile", () => {
    expect(cfg).toMatch(/--target=api/);
    expect(cfg).toMatch(/--target=migrate/);
    expect(cfg).toMatch(/apps\/api\/Dockerfile/);
  });

  it("pushes to the configured Artifact Registry repo with commit SHA and latest tags", () => {
    expect(cfg).toMatch(/europe-west1-docker\.pkg\.dev/);
    expect(cfg).toMatch(/agu-takvim-containers/);
    expect(cfg).toMatch(/\$\{COMMIT_SHA\}/);
    expect(cfg).toMatch(/:latest/);
  });
});

describe("cloudbuild.web.yaml", () => {
  const cfg = readRepoFile("cloudbuild.web.yaml");

  it("passes NEXT_PUBLIC_API_URL as a docker build-arg", () => {
    expect(cfg).toMatch(/--build-arg/);
    expect(cfg).toMatch(/NEXT_PUBLIC_API_URL=\$\{_NEXT_PUBLIC_API_URL\}/);
  });

  it("pushes to the configured Artifact Registry repo with commit SHA and latest tags", () => {
    expect(cfg).toMatch(/europe-west1-docker\.pkg\.dev/);
    expect(cfg).toMatch(/agu-takvim-containers/);
    expect(cfg).toMatch(/\$\{COMMIT_SHA\}/);
    expect(cfg).toMatch(/:latest/);
  });
});
