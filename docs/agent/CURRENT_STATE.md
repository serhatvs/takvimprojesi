# Current State

## Mevcut Asama

Repository altyapisi Node 24 ortaminda stabilize edildi. Monorepo kurulumu, Prisma migration/seed, workspace kontrolleri, build, health smoke testleri, gelistirme auth siniri, taslak etkinlik olusturma API'si, taslagi Basin Yayin onayina gonderme API'si, Basin Yayin inceleme karar API'leri, onaylanmis etkinligi yayinlama API'si, public yayinlanmis etkinlik kesif API'leri ve ana sayfa public etkinlik listeleme ekrani tamamlandi.

## Tamamlanan Isler

- pnpm workspace ve Turborepo komutlari kuruldu.
- `apps/web` Next.js App Router ana sayfasi eklendi.
- `apps/api` NestJS health endpointi eklendi.
- Web ana sayfasi API health endpointini okuyacak sekilde hazirlandi.
- `packages/contracts`, `packages/config`, `packages/ui` paketleri olusturuldu.
- Prisma schema baslangic modelleri, iliskiler, indeksler ve tekillik kurallariyla eklendi.
- Development seed dosyasi test kullanicilari, kulup ve ornek etkinlikler icin hazirlandi.
- Temel unit ve API integration test altyapisi eklendi.
- Urun, mimari, domain ve agent belgeleri yazildi.
- Prisma 7 icin `prisma.config.ts` eklendi ve datasource URL schema disina tasindi.
- Generic repo-local skill'ler kaldirildi; su anda `.agents/skills` yok.
- Node 24.x `.nvmrc`, `.node-version`, `engines.node` ve `preinstall` guard ile sabitlendi.
- pnpm 11.16.0 `packageManager`, `engines.pnpm` ve `preinstall` guard ile sabitlendi.
- Node 24.18.0 kullanici hesabindaki nvm ile kuruldu ve kullanildi.
- PostgreSQL host portu yerel port cakismasi nedeniyle `5433:5432` olarak ayarlandi.
- Ilk Prisma migration olusturuldu: `20260723115617_init`.
- Development seed iki kez calistirildi ve idempotent oldugu dogrulandi.
- Web build Next Turbopack yerine `next build --webpack` ile stabilize edildi.
- Gelistirme auth endpointleri eklendi: `POST /auth/dev-login`, `GET /auth/me`, `POST /auth/logout`.
- Session cookie siniri HttpOnly, SameSite=Lax ve production ortaminda Secure olacak sekilde kuruldu.
- Principal her korumali istekte veritabanindan kullanici rolleri ve aktif kulup uyelikleriyle yeniden cozulur.
- Authentication guard, current user decorator, global role decorator/guard ve kulup uyeligi sorgulamalari icin authorization service siniri eklendi.
- Web ana sayfasina yalnizca gelistirme ortaminda gorunen seed kullanicili minimal dev login kontrolu eklendi.
- `POST /events` eklendi; authenticated kulup adminleri kendi aktif kulupleri icin `DRAFT` etkinlik olusturabilir.
- Event olusturma yetkisi `AuthorizationService.canCreateEventForClub` uzerinden uygulanir; `SYSTEM_ADMIN` icin acik bypass vardir, `PRESS_EDITOR` kulup uyeligi olmadan kulup adina etkinlik olusturamaz.
- `POST /events/:eventId/submit` eklendi; authenticated kulup admini veya `SYSTEM_ADMIN` `DRAFT -> SUBMITTED` gecisini yapabilir.
- Submit gecisi status kosullu update ve audit create islemini tek transaction icinde yapar; tekrarli/eszamanli submit `409 Conflict` doner.
- `POST /events/:eventId/request-changes`, `POST /events/:eventId/reject` ve `POST /events/:eventId/approve` eklendi; `PRESS_EDITOR` veya `SYSTEM_ADMIN` submitted etkinliklerde karar verebilir.
- Review gecisleri status kosullu update, `EventReview` create ve audit create adimlarini tek transaction icinde yapar; tekrarli/eszamanli ikinci karar `409 Conflict` doner.
- `POST /events/:eventId/publish` eklendi; `PRESS_EDITOR` veya `SYSTEM_ADMIN` approved etkinligi `PUBLISHED` durumuna gecirebilir.
- Publish gecisi status kosullu update ile `publishedAt` doldurur ve audit create islemini tek transaction icinde yapar; tekrarli/eszamanli ikinci publish `409 Conflict` doner.
- `GET /events` ve `GET /events/:eventId` eklendi; authentication gerektirmez ve yalniz `PUBLISHED` etkinlikleri public alanlarla dondurur.
- Public liste varsayilan olarak mevcut zamandan sonraki etkinlikleri `startsAt ASC, id ASC` siralar; `from`, `to`, `clubId`, `q`, `page`, `pageSize` filtreleri desteklenir.
- Web ana sayfasi `GET /events` verisini kullanarak yayinlanmis yaklasan etkinlikleri kartlarla listeler; `q`, `from`, `to` ve sayfalama URL query string ile korunur.
- Public web liste fetch'i `cache: "no-store"` kullanir; API erisilemezse sayfa cokmeden hata durumu gosterir.

## Calisan Komutlar

- `pnpm install --frozen-lockfile --reporter=append-only`
- `docker compose up -d postgres`
- `pnpm prisma:validate`
- `pnpm prisma:generate`
- `pnpm --filter @agu/api prisma:migrate:dev --name init`
- `pnpm seed` iki kez
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `NEXT_TELEMETRY_DISABLED=1 pnpm build` hedefi paket bazli build komutlariyla dogrulandi; Turbo wrapper child process kalmadan beklerse paket bazli komutlarla sonucu ayir.
- API smoke: `curl http://localhost:3001/health`
- Web smoke: `curl http://localhost:3000/` API acik ve kapaliyken
- Auth smoke: seed kullaniciyla `/auth/dev-login`, cookie ile `/auth/me`, `/auth/logout`, logout sonrasi `/auth/me` 401
- Events smoke: club admin ile `/events` 201 `DRAFT`, student ile ayni istek 403
- Submit smoke: club admin ile `/events/:eventId/submit` 200 `SUBMITTED`, ikinci submit 409, student submit 403, audit kaydi dogrulandi
- Review smoke: PRESS_EDITOR ile request-changes/reject/approve 200, ikinci karar 409, club admin karar girisimi 403, review ve audit kayitlari dogrulandi
- Publish smoke: PRESS_EDITOR ile `/events/:eventId/publish` 200 `PUBLISHED`, ikinci publish 409, club admin publish 403, `publishedAt` ve audit kaydi dogrulandi
- Public events smoke: `GET /events` gelecek iki published etkinligi dondurdu; gecmis published ve public olmayan statuslar dislandi; `from/to`, `q`, pagination, public detail ve route cakismasi dogrulandi
- Public web listing smoke: ana sayfa HTTP 200, kart render, `q`, tarih filtresi, pagination linkleri, bos sonuc, API kapali hata durumu, development auth paneli ve production build dev auth gizleme kontrolleri

## Bilinen Eksikler

- Gercek AGU SSO entegrasyonu yok; gelistirme auth siniri gelecekte SSO adapter'i ile degistirilmek uzere kuruldu.
- Uygulama endpointleri olarak health, auth, taslak event olusturma, taslagi onaya gonderme, Basin Yayin karar endpointleri, yayinlama endpointi ve public yayinlanmis event liste/detay endpointleri vardir; ana sayfada public liste ekrani vardir; yonetimsel listeleme, guncelleme ve silme endpointleri yoktur.
- Bildirim adapterleri placeholder mimari sinir olarak duruyor.
- QR token uretme/dogrulama servisi henuz uygulanmadi.
- Sistem Node'u hala `/usr/bin/node` uzerinden v26.4.0; proje dogrulamasi nvm altindaki Node v24.18.0 ile yapildi.
- Eski yarim `node_modules*` kalintilari silinmeden repo disina tasindi.
- Next/Turbopack build once `.next` artefactinde I/O beklemesine girdi; `.next` repo disina tasindi ve webpack build kullanildi.
- `pnpm install` ilk denemelerde lifecycle/finalizasyon asamasinda takildi; `pnpm fetch`, proje-local store, `packageImportMethod: copy`, `pnpm rebuild` ve son normal install ile stabilize edildi.
- Tasinan dependency artefactleri: `../agu-node-modules-stale-20260723-140042`, `../agu-node-modules-stale-20260723-141007`, `../agu-node-modules-stale-20260723-141308`, `../agu-node-modules-stale-20260723-141940`, `../agu-node-modules-stale-20260723-142254`, `../agu-node-modules-stale-20260723-144152`, `../agu-node-modules-stale-20260723-144456`, `../agu-node-modules-stale-20260723-144753`, `../agu-node-modules-stale-20260723-145003`, `../agu-node-modules-stale-20260723-145306`.
- Tasinan eski web build artefacti: `../../web-next-stale-20260723-150932`.

## Bir Sonraki Onerilen Gorev

Bir sonraki urun dikey ozelligi olarak yayinlanmis etkinlik detay sayfasi veya ogrencinin yayinlanmis etkinlige kayit olmasi gelistirilmeli.

## Son Dogrulama Sonuclari

- Dogrulanan Node: v24.18.0 (`/home/serxc/.nvm/versions/node/v24.18.0/bin/node`).
- Dogrulanan pnpm: 11.16.0.
- Dependency install: gecti, `pnpm install --frozen-lockfile --reporter=append-only`.
- PostgreSQL: `agu-kampus-takvimi-postgres` healthy, host `localhost:5433`.
- Prisma validate/generate: gecti.
- Migration: `20260723115617_init`, destructive islem yok.
- Seed: iki calisma da gecti; DB sayimlari `users=5`, `user_roles=8`, `clubs=1`, `draft_events=1`, `published_events=1`.
- Lint: gecti, 5 package scope, 8 task.
- Typecheck: gecti, 5 package scope, 8 task.
- Unit tests: gecti; API 69 test, contracts 2 test, web 7 test. Config/ui test dosyasi olmadigi icin acik `--passWithNoTests`.
- Integration tests: gecti; API 57 integration test. Diger paketlerde integration dosyasi olmadigi icin acik `--passWithNoTests`.
- Build: gecti; `@agu/contracts`, `@agu/config`, `@agu/ui`, `@agu/api` ve `@agu/web` paketleri Node 24 altinda tekil build komutlariyla dogrulandi; web `next build --webpack`.
- API smoke: gecti, `/health` HTTP 200, auth akisi `dev-login -> me -> logout -> me 401`, event create akisi club admin ile 201 `DRAFT` ve student ile 403, submit akisi club admin ile 200 `SUBMITTED`, ikinci submit 409, student submit 403 ve audit count 1, review akisi PRESS_EDITOR ile uc karar 200, ikinci karar 409, club admin 403, review/audit kayitlari dogrulandi, publish akisi PRESS_EDITOR ile 200 `PUBLISHED`, ikinci publish 409, club admin 403, `publishedAt` ve audit kaydi dogrulandi, public liste/detay akisi authentication olmadan 200/404 davranislariyla dogrulandi.
- Web smoke: gecti; API acikken health sonucu ve gelistirme auth kontrolu render edildi.
