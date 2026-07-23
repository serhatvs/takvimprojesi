# Current State

## Mevcut Asama

Repository altyapisi Node 24 ortaminda stabilize edildi. Monorepo kurulumu, Prisma migration/seed, workspace kontrolleri, build, health smoke testleri, gelistirme auth siniri, taslak etkinlik olusturma API'si, taslagi Basin Yayin onayina gonderme API'si, Basin Yayin inceleme karar API'leri, onaylanmis etkinligi yayinlama API'si, public yayinlanmis etkinlik kesif API'leri, ana sayfa public etkinlik listeleme ekrani, public etkinlik detay sayfasi, ogrenci etkinlik kayit API'si, detay sayfasi kayit kontrolu, QR attendance backend temeli, yetkili yoneticiler icin detay sayfasi QR yoklama paneli, ogrenci `/check-in` QR yoklama ekrani, kulup etkinlik katilim ozeti API'si ve detay sayfasi katilim ozeti paneli tamamlandi.

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
- Web `/events/[eventId]` route'u `GET /events/:eventId` verisini kullanarak public detay sayfasi render eder; liste filtreleri detail URL ve geri donus linkinde korunur.
- Detail sayfasi API `404` sonucunu Next.js `notFound()` ile guvenli 404'e cevirir; API baglanti/5xx hatalari 404 gibi gosterilmez ve kontrollu hata durumu render edilir.
- Detail metadata etkinlik basligi ve kisaltilmis aciklamadan uretilir; internal alanlar metadata veya UI icinde kullanilmaz.
- `POST /events/:eventId/register` eklendi; authenticated `STUDENT` rolune sahip kullanici yayinlanmis ve henuz baslamamis etkinlige tekil kayit olabilir.
- Registration kapasite kontrolu PostgreSQL row lock ve Prisma transaction icinde yapilir; duplicate, dolu kapasite ve baslamis etkinlik `409 Conflict`, public olmayan veya bilinmeyen etkinlik `404 Not Found` doner.
- `GET /events/:eventId/registration` eklendi; authenticated `STUDENT` yalniz kendi registration durumunu gorebilir, student olmayan kullanici `403`, public olmayan/bilinmeyen event `404` alir.
- Web public detay sayfasina oturum ve rol durumuna gore mesaj, `Etkinliğe Katıl` butonu, kayitli durum ve kayit zamani gosteren client registration paneli eklendi.
- `POST /events/:eventId/attendance-token` eklendi; kulup admini veya `SYSTEM_ADMIN` published event icin 15 dakikalik ham token uretir, DB'de yalniz hash ve `qrTokenExpiresAt` saklanir, token issue auditlenir.
- `POST /events/:eventId/check-in` eklendi; registered `STUDENT` gecerli tokenla etkinlik baslangicindan 30 dakika once ve bitisten 60 dakika sonraya kadar tekil attendance olusturabilir.
- Attendance duplicate ve eszamanli ikinci check-in `@@unique([eventId, userId])` ile `409 Conflict` sonucuna cevrilir.
- Public detay durum etiketi Turkce karakterle `Yayında` olarak duzeltildi.
- Web public detay sayfasina yalniz etkinligin kulubundeki aktif `ADMIN` veya `SYSTEM_ADMIN` icin gorunen `Yoklama Yönetimi` QR paneli eklendi.
- QR paneli `POST /events/:eventId/attendance-token` endpointini credential ile cagirir, tokeni yalniz client state'te tutar, surumlenmis JSON QR payload'i uretir, kalan sureyi canli gosterir ve sure dolunca QR'i gizler.
- Web `/check-in` route'u eklendi; sayfa `/auth/me` ile STUDENT rolunu kontrol eder, kamera scanner'i yalniz kullanici aksiyonuyla client tarafinda yukler ve manuel QR payload yedegi sunar.
- Check-in parser'i surum `1`, bos olmayan `eventId` ve bos olmayan `token` ister; gecerli payload `POST /events/:eventId/check-in` endpointine credential ve `cache: no-store` ile gonderilir.
- Kayitli ogrenci durumunda detay sayfasindan `/check-in` icin `QR ile Yoklama Ver` baglantisi gosterilir.
- `GET /events/:eventId/attendance-summary` eklendi; etkinligin kulubundeki aktif `ADMIN` veya `SYSTEM_ADMIN` kayit/yoklama/gelmeyen/kalan kapasite/oran ozetini gorebilir.
- Attendance summary yalniz `PUBLISHED`, `COMPLETED` ve `CANCELLED` event statuslari icin doner; diger statuslar `409 Conflict` sonucuna cevrilir.
- Summary response ogrenci isim/e-posta/userId, QR token/hash, audit, review veya katilimci listesi dondurmez.
- Web public detay sayfasina yalniz etkinligin kulubundeki aktif `ADMIN` veya `SYSTEM_ADMIN` icin gorunen `Katılım Özeti` paneli eklendi.
- Katilim ozeti paneli `/auth/me` principal ve public event club ID'si ile gorunurluk karari verir; yetkisiz kullanici icin summary endpointine istek gondermez.
- Panel `GET /events/:eventId/attendance-summary` cevabindaki metrikleri yeniden hesaplamadan Turkce bicimlendirir, `Verileri Yenile` ile manuel refresh yapar ve hata mesajlarini guvenli sekilde esler.

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
- Public web detail smoke: detail linki, detail HTTP 200, public alanlar, filtreli geri donus, public olmayan/unknown 404, API kapali hata durumu, internal alan sizintisi yok, metadata kontrolu ve dev auth etkilenmeme kontrolleri
- Registration smoke: capacity 1 gecici `PUBLISHED` event icin student ilk kayit 201, ayni kullanici ikinci kayit 409, baska student rolu olan kullanici kapasite nedeniyle 409, DB registration count 1 ve gecici kayit temizligi dogrulandi
- Public web detail registration smoke: student dev-login sonrasi detail sayfasinda `Etkinliğe Katıl`, POST sonrasi `Bu etkinliğe kayıtlısınız`, yeniden acilista kayitli durum ve press kullanicisinda butonsuz yetki mesaji dogrulandi
- QR attendance smoke: gecici published event ve student registration ile club admin token 200, student check-in 201, ikinci check-in 409, token rotation sonrasi eski token 400, attendance count 1 ve gecici kayit temizligi dogrulandi
- Public web QR attendance panel smoke: gecici published event detay HTML'i 200, club admin ile iki token uretimi 200, token refresh sonrasi token degisti, eski token check-in 400, yeni token check-in 201, attendance count 1 ve HTML icinde ham token bulunmadigi dogrulandi; client panel gorunurluk/state gecisleri unit helper testleriyle dogrulandi
- Student QR check-in smoke: `/check-in` HTTP 200, loading shell render, gecici published event+registration+attendance token ile manuel payload seklinde check-in API 201, ikinci check-in 409, PRESS_EDITOR API 403, HTML/API text icinde ham token bulunmadigi ve gecici kayit temizligi dogrulandi; gercek kamera otomasyonu yoktur
- Attendance summary smoke: gecici published event icin 3 registration ve 2 attendance ile club admin summary 200, metrikler `3/2/1/97/66.7`, baska kulup admini 403, student 403, response icinde user/email/token bilgisi yok ve gecici kayit temizligi dogrulandi
- Public web attendance summary panel smoke: gecici published event detay sayfasi HTTP 200, club admin summary API 200 ve metrikler `3/2/1/66.7`, sifir kayitli event metrikleri `0/0/0`, baska kulup admini 403, student 403, response/HTML icinde email/userId/token yok ve gecici kayit temizligi dogrulandi; hydrated refresh ve panel gorunurluk davranislari web unit helper testleriyle dogrulandi

## Bilinen Eksikler

- Gercek AGU SSO entegrasyonu yok; gelistirme auth siniri gelecekte SSO adapter'i ile degistirilmek uzere kuruldu.
- Uygulama endpointleri olarak health, auth, taslak event olusturma, taslagi onaya gonderme, Basin Yayin karar endpointleri, yayinlama endpointi, public yayinlanmis event liste/detay endpointleri, ogrenci event registration endpointi, current-user registration status endpointi, attendance token, check-in ve attendance summary endpointleri vardir; ana sayfada public liste ekrani ve `/events/[eventId]` public detay sayfasi/kayit/QR/katilim ozeti panelleri vardir; yonetimsel listeleme, guncelleme ve silme endpointleri yoktur.
- Bildirim adapterleri placeholder mimari sinir olarak duruyor.
- QR indirme/paylasma, ayrintili attendance dashboard'u, katilimci listesi ve manuel personel check-in henuz uygulanmadi.
- Gercek cihaz kamera taramasi browser automation veya fiziksel cihazla dogrulanmadi; scanner lifecycle ve parser davranisi hafif unit testlerle, check-in HTTP davranisi smoke testle dogrulandi.
- Sistem Node'u hala `/usr/bin/node` uzerinden v26.4.0; proje dogrulamasi nvm altindaki Node v24.18.0 ile yapildi.
- Eski yarim `node_modules*` kalintilari silinmeden repo disina tasindi.
- Next/Turbopack build once `.next` artefactinde I/O beklemesine girdi; `.next` repo disina tasindi ve webpack build kullanildi.
- `pnpm install` ilk denemelerde lifecycle/finalizasyon asamasinda takildi; `pnpm fetch`, proje-local store, `packageImportMethod: copy`, `pnpm rebuild` ve son normal install ile stabilize edildi.
- Tasinan dependency artefactleri: `../agu-node-modules-stale-20260723-140042`, `../agu-node-modules-stale-20260723-141007`, `../agu-node-modules-stale-20260723-141308`, `../agu-node-modules-stale-20260723-141940`, `../agu-node-modules-stale-20260723-142254`, `../agu-node-modules-stale-20260723-144152`, `../agu-node-modules-stale-20260723-144456`, `../agu-node-modules-stale-20260723-144753`, `../agu-node-modules-stale-20260723-145003`, `../agu-node-modules-stale-20260723-145306`.
- Tasinan eski web build artefacti: `../../web-next-stale-20260723-150932`.

## Bir Sonraki Onerilen Gorev

Bir sonraki urun dikey ozelligi olarak kulup icin ayrintili katilimci listesi/CSV dis aktarim siniri veya public etkinlik yonetim ekranlari gelistirilmeli.

## Son Dogrulama Sonuclari

- Dogrulanan Node: v24.18.0 (`/home/serxc/.nvm/versions/node/v24.18.0/bin/node`).
- Dogrulanan pnpm: 11.16.0.
- Dependency install: gecti, `pnpm install --frozen-lockfile --reporter=append-only`.
- PostgreSQL: `agu-kampus-takvimi-postgres` healthy, host `localhost:5433`.
- Prisma validate/generate: gecti.
- Migration: `20260723115617_init` ve `20260723193154_add_attendance_token_expiry`, destructive islem yok.
- Seed: iki calisma da gecti; DB sayimlari `users=5`, `user_roles=8`, `clubs=1`, `draft_events=1`, `published_events=1`.
- Lint: gecti, 5 package scope, 8 task.
- Typecheck: gecti, 5 package scope, 8 task.
- Unit tests: gecti; API 102 test, contracts 2 test, web 68 test. Config/ui test dosyasi olmadigi icin acik `--passWithNoTests`.
- Integration tests: gecti; API 90 integration test. Diger paketlerde integration dosyasi olmadigi icin acik `--passWithNoTests`.
- Build: gecti; `@agu/contracts`, `@agu/config`, `@agu/ui`, `@agu/api` ve `@agu/web` paketleri Node 24 altinda tekil build komutlariyla dogrulandi; web `next build --webpack`.
- API smoke: gecti, `/health` HTTP 200, auth akisi `dev-login -> me -> logout -> me 401`, event create akisi club admin ile 201 `DRAFT` ve student ile 403, submit akisi club admin ile 200 `SUBMITTED`, ikinci submit 409, student submit 403 ve audit count 1, review akisi PRESS_EDITOR ile uc karar 200, ikinci karar 409, club admin 403, review/audit kayitlari dogrulandi, publish akisi PRESS_EDITOR ile 200 `PUBLISHED`, ikinci publish 409, club admin 403, `publishedAt` ve audit kaydi dogrulandi, public liste/detay akisi authentication olmadan 200/404 davranislariyla dogrulandi, registration akisi student ilk kayit 201, duplicate 409, kapasite dolu 409, status endpoint false/true ve DB count 1 olarak dogrulandi, QR attendance akisi token 200, check-in 201, duplicate 409, rotated old token 400 ve attendance count 1 olarak dogrulandi, attendance summary akisi club admin 200 metrik `3/2/1/66.7`, baska kulup admini 403 ve student 403 olarak dogrulandi.
- Web smoke: gecti; API acikken health sonucu, gelistirme auth kontrolu, detail registration paneli render/kayit akisi, QR panel HTTP/token rotation smoke, `/check-in` HTTP/API manuel payload smoke ve attendance summary detail HTTP/API smoke dogrulandi. Gercek browser automation yok; QR panel, student scanner ve attendance summary client state/rol/refresh davranislari mevcut hafif Vitest helper testleriyle dogrulandi.
