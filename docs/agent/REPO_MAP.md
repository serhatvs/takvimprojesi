# Repo Map

## Kok

- `package.json`: Workspace komutlari ve ortak dev bagimliliklari.
- `pnpm-workspace.yaml`: `apps/*` ve `packages/*` workspace kapsamı.
- `turbo.json`: Build, lint, typecheck ve test orchestration.
- `.nvmrc` ve `.node-version`: Projenin Node 24 major surumunde calismasini sabitler.
- `.npmrc`: npm uyumlulugu icin engine ve proje-local pnpm store ayarlarini tasir.
- `.pnpm-store`: Git ignore edilen proje-local pnpm store artefact'i.
- `.env.example`: Gizli olmayan yerel ortam degiskenleri.
- `docker-compose.yml`: Yerel PostgreSQL servisi.
- `AGENTS.md`: Kisa agent calisma kurallari.
- `scripts/check-node-version.mjs`: `preinstall` sirasinda Node 24.x ve pnpm 11.16.0 kontrolu yapar.

## Uygulamalar

- `apps/web`: Next.js App Router web arayuzu. Giris noktasi `apps/web/app/page.tsx`; gelistirme auth smoke kontrolu `apps/web/app/dev-auth-panel.tsx`.
- `apps/api`: NestJS REST API. Giris noktasi `apps/api/src/main.ts`.
- `apps/api/src/auth`: Gelistirme auth endpointleri, session servisi, authentication guard, role guard/decorator, current user decorator ve authorization service siniri.
- `apps/api/src/events`: Event lifecycle servisi, `POST /events` taslak etkinlik olusturma, `POST /events/:eventId/submit` onaya gonderme, Basin Yayin review karar endpointleri ve `POST /events/:eventId/publish` yayinlama controller/service/dto siniri.
- `apps/api/src/prisma`: Prisma client icin Nest provider/modul siniri.
- `apps/api/prisma/schema.prisma`: Domain veri modeli ve Prisma schema.
- `apps/api/prisma.config.ts`: Prisma 7 config, root `.env` dosyasini yukler.
- `apps/api/prisma/migrations/20260723115617_init/migration.sql`: Ilk PostgreSQL migration.
- `apps/api/prisma/seed.ts`: Gelistirme seed verisi.

## Paketler

- `packages/contracts`: Paylasilan API tipleri, auth principal response tipleri, draft/event response ve review request tipleri, roller, etkinlik durumlari, `publishedAt` response alani ve lifecycle contractlari.
- `packages/config`: Ortak zaman dilimi ve ortam konfigurasyonu yardimcilari.
- `packages/ui`: Paylasilan React bilesenleri.

## Belgeler

- `docs/product/PRD.md`: Urun kapsami ve varsayimlar.
- `docs/architecture/SYSTEM.md`: Sistem sinirlari ve teknik yaklasim.
- `docs/domain/EVENT_LIFECYCLE.md`: Etkinlik durumlari ve izinli gecisler.
- `docs/agent/*`: Agent calismasi, test matrisi, kararlar ve current state.

## Repo-local Skills

Su anda repo-local skill yoktur. AGU domainine ozel tekrar eden kurallar netlestiginde yeni skill'ler ayri gorevlerde eklenmelidir.
