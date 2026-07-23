# Test Matrix

| Degisiklik alani | Calistirilacak kontroller |
| --- | --- |
| Kok workspace, package veya turbo ayarlari | Node 24 aktifken `pnpm install --frozen-lockfile --reporter=append-only`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `NEXT_TELEMETRY_DISABLED=1 pnpm build` |
| `apps/web` | `pnpm --filter @agu/web lint`, `pnpm --filter @agu/web typecheck`, `pnpm --filter @agu/web build` |
| `apps/api/src` | `pnpm --filter @agu/api lint`, `pnpm --filter @agu/api typecheck`, `pnpm --filter @agu/api test`, `pnpm --filter @agu/api test:integration`, `pnpm --filter @agu/api build` |
| `apps/api/src/auth` | Unit: session olusturma/dogrulama, gecersiz ve expired token, global role guard, dev auth production/flag engeli. Integration: dev-login, bilinmeyen kullanici, cookie ile `/auth/me`, cookiesiz `/auth/me`, logout sonrasi 401, dev auth kapali login engeli, token'a gomulen sahte rolun yok sayilmasi |
| `apps/api/src/events` | Unit: yetkili kulup admini draft olusturur, yetkisiz kullanici 403, tarih sirasi, status her zaman `DRAFT`, sahte `createdById/status` yok sayilir; submit icin yetkili admin/system admin, yetkisiz roller, gecersiz status 409, transaction update+audit, update fail audit yok, audit fail rollback. Integration: create icin auth yok 401, yetkili seed kulup admini 201, DB `createdById`, baska kulup 403, bilinmeyen kulup 404, gecersiz tarih/capacity 400; submit icin auth yok 401, yetkili admin 200, DB status `SUBMITTED`, tek audit, actor dogru, baska kulup/student/member/press 403, bilinmeyen event 404, gecersiz id 400, tekrar submit 409, basarisiz submit audit yok |
| `apps/api/prisma/schema.prisma` | PostgreSQL calisirken `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm --filter @agu/api prisma:migrate:dev`, migration SQL etkisi incelemesi |
| `apps/api/prisma/seed.ts` | PostgreSQL calisirken `pnpm --filter @agu/api typecheck`, `pnpm --filter @agu/api seed`; seed ikinci kez de calistirilip idempotency kontrol edilir |
| `packages/contracts` | `pnpm --filter @agu/contracts lint`, `pnpm --filter @agu/contracts typecheck`, `pnpm --filter @agu/contracts test`, bagimli paketlerde typecheck |
| `packages/config` | `pnpm --filter @agu/config lint`, `pnpm --filter @agu/config typecheck`, bagimli paketlerde typecheck |
| `packages/ui` | `pnpm --filter @agu/ui lint`, `pnpm --filter @agu/ui typecheck`, `pnpm --filter @agu/ui build`, web build |
| Docs | Icerik incelemesi, gerekiyorsa Node 24 aktifken `pnpm lint` ile repo geneli kontrol |
| Health smoke | API: build ciktisindan `node apps/api/dist/src/main.js` ve `curl http://localhost:3001/health`; Web: `pnpm --filter @agu/web dev` ile API acik/kapali ana sayfa curl kontrolu |
| Auth smoke | API: seed kullaniciyla `POST /auth/dev-login`, cookie jar ile `GET /auth/me`, `POST /auth/logout`, ayni cookie jar ile `/auth/me` 401. Web: `NEXT_PUBLIC_ENABLE_DEV_AUTH=true pnpm --filter @agu/web dev` ile dev giris kontrolunun render edildigini ve API health sonucunu kontrol et |
| Events smoke | API build ciktisi calisirken club admin seed kullaniciyla dev-login, cookie ile `POST /events` 201 ve `DRAFT`; student seed kullaniciyla ayni payload 403 |
| Submit smoke | API build ciktisi calisirken gecici draft event olustur, club admin ile `POST /events/:eventId/submit` 200 ve `SUBMITTED`, ikinci submit 409, student ile baska draft submit 403, audit kaydi DB'de dogrulanir ve gecici kayitlar temizlenir |
