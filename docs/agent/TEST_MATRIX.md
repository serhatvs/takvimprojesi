# Test Matrix

| Degisiklik alani | Calistirilacak kontroller |
| --- | --- |
| Kok workspace, package veya turbo ayarlari | Node 24 aktifken `pnpm install --frozen-lockfile --reporter=append-only`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `NEXT_TELEMETRY_DISABLED=1 pnpm build` |
| `apps/web` | `pnpm --filter @agu/web lint`, `pnpm --filter @agu/web typecheck`, `pnpm --filter @agu/web build` |
| `apps/api/src` | `pnpm --filter @agu/api lint`, `pnpm --filter @agu/api typecheck`, `pnpm --filter @agu/api test`, `pnpm --filter @agu/api test:integration`, `pnpm --filter @agu/api build` |
| `apps/api/prisma/schema.prisma` | PostgreSQL calisirken `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm --filter @agu/api prisma:migrate:dev`, migration SQL etkisi incelemesi |
| `apps/api/prisma/seed.ts` | PostgreSQL calisirken `pnpm --filter @agu/api typecheck`, `pnpm --filter @agu/api seed`; seed ikinci kez de calistirilip idempotency kontrol edilir |
| `packages/contracts` | `pnpm --filter @agu/contracts lint`, `pnpm --filter @agu/contracts typecheck`, `pnpm --filter @agu/contracts test`, bagimli paketlerde typecheck |
| `packages/config` | `pnpm --filter @agu/config lint`, `pnpm --filter @agu/config typecheck`, bagimli paketlerde typecheck |
| `packages/ui` | `pnpm --filter @agu/ui lint`, `pnpm --filter @agu/ui typecheck`, `pnpm --filter @agu/ui build`, web build |
| Docs | Icerik incelemesi, gerekiyorsa Node 24 aktifken `pnpm lint` ile repo geneli kontrol |
| Health smoke | API: build ciktisindan `node apps/api/dist/src/main.js` ve `curl http://localhost:3001/health`; Web: `pnpm --filter @agu/web dev` ile API acik/kapali ana sayfa curl kontrolu |
