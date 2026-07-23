# AGU Kampus Takvimi Handoff

Bu belge, onceki sohbet gecmisine ihtiyac duymadan AGU Kampus Takvimi repository'sinde kaldigi yerden devam etmek icin ana devir kaynagidir. Mevcut baseline commit:

```text
ecc049a feat: add attendance summary panel
```

## 1. Projenin Amaci

AGU Kampus Takvimi, AGU ogrenci kuluplerinin etkinliklerini merkezi bir onay ve yayin akisindan gecirerek kampus takviminde gosteren, ogrencilerin etkinlige kayit olmasini ve etkinlik gunu QR ile yoklama vermesini saglayan bir Faz 1 uygulamasidir.

Tamamlanan uc uca Faz 1 akisi:

```text
Kulup etkinlik olusturur
-> onaya gonderir
-> Basin Yayin karar verir
-> etkinlik yayinlanir
-> ogrenci kayit olur
-> QR ile yoklama verir
-> kulup katilim ozetini gorur
```

## 2. Mevcut Teknik Yapi

Kullanilan teknolojiler:

- pnpm workspace
- Turborepo
- Node 24
- pnpm 11.16.0
- Next.js App Router
- NestJS REST API
- Prisma
- PostgreSQL
- TypeScript
- Vitest
- Docker Compose

Workspace yapisi:

- `apps/api`: NestJS API. Auth, event lifecycle, registration, QR attendance, attendance summary ve health endpointleri burada.
- `apps/web`: Next.js App Router web arayuzu. Public liste, public detay, dev auth paneli, registration paneli, QR yonetim paneli, check-in ekrani ve attendance summary paneli burada.
- `packages/contracts`: Web/API paylasilan tipler; roller, event statusleri, auth principal, public event, registration, attendance token, attendance ve attendance summary response tipleri.
- `packages/config`: Ortak config helperlari; API base URL, varsayilan timezone, attendance token TTL ve check-in pencere sabitleri.
- `packages/ui`: Paylasilan hafif React UI bilesenleri; mevcut durumda `StatusBadge` kullaniliyor.

## 3. Calistirma Ortami

- Node major surumu 24 olmali. `.nvmrc` ve `.node-version` Node 24'u sabitler.
- `package.json` engine araligi: `>=24.0.0 <25`.
- pnpm tam surum: `11.16.0`.
- PostgreSQL Docker Compose host portu: `5433` -> container `5432`.
- `.env.example` yalniz yerel gelistirme ornek degerleri tasir. Gercek `.env` commit edilmemelidir.
- Sistem Node'u farkli olabilir; dogrulamalar nvm altindaki Node v24.18.0 ile yapildi.

Temel kurulum:

```bash
corepack enable
corepack prepare pnpm@11.16.0 --activate
pnpm install --frozen-lockfile --reporter=append-only
cp .env.example .env
docker compose up -d postgres
```

Prisma:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm --filter @agu/api prisma:migrate:dev --name init
pnpm seed
```

Gelistirme:

```bash
pnpm --filter @agu/api dev
pnpm --filter @agu/web dev
```

Dogrulama:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
NEXT_TELEMETRY_DISABLED=1 pnpm build
```

Not: Root Turbo wrapper bazi ortamlarda child isler bittikten sonra beklemede kalabiliyor. Gercek sonuc icin paket bazli komutlar kullanildi:

```bash
pnpm --filter @agu/api lint
pnpm --filter @agu/api typecheck
pnpm --filter @agu/api test
pnpm --filter @agu/api test:integration
pnpm --filter @agu/api build
pnpm --filter @agu/web lint
pnpm --filter @agu/web typecheck
pnpm --filter @agu/web test
pnpm --filter @agu/web build
```

## 4. Veri Modeli

Prisma modelleri:

- `User`: Email, display name, opsiyonel student number, aktiflik, coklu global roller, kulup uyelikleri, olusturdugu eventler, review, registration, attendance, notification ve audit iliskileri.
- `UserRole`: `User` ile `RoleName` join modeli. `@@unique([userId, role])`.
- `Club`: Kulup adi, slug, aktiflik, uyelikler ve eventler.
- `ClubMembership`: Kullanici-kulup uyeligi. `MEMBER` veya `ADMIN`; aktiflik alani var. `@@unique([userId, clubId])`.
- `Event`: Kulup, olusturan user, baslik, slug, aciklama, konum, status, tarih alanlari, capacity, `publishedAt`, `qrTokenHash`, `qrTokenExpiresAt`, review/registration/attendance iliskileri.
- `EventReview`: Event, reviewer, karar, yorum, karar zamani.
- `EventRegistration`: Event-user kaydi. `@@unique([eventId, userId])`.
- `Attendance`: Event-user yoklama kaydi. `@@unique([eventId, userId])`.
- `Notification`: Gelecekte bildirim adapterleri icin uygulama ici bildirim modeli.
- `AuditLog`: Kritik islemler icin actor, entity, action, before/after/metadata ve zaman.

Onemli constraint ve alanlar:

- Bir kullanici ayni etkinlige yalniz bir kez kayit olabilir: `EventRegistration @@unique([eventId, userId])`.
- Bir kullanici ayni etkinlikte yalniz bir attendance kaydina sahip olabilir: `Attendance @@unique([eventId, userId])`.
- Event status enum: `DRAFT`, `SUBMITTED`, `CHANGES_REQUESTED`, `REJECTED`, `APPROVED`, `PUBLISHED`, `CANCELLED`, `COMPLETED`.
- `publishedAt`: `APPROVED -> PUBLISHED` sirasinda doldurulur.
- `qrTokenHash`: Ham token yerine SHA-256 hash saklar ve unique'tir.
- `qrTokenExpiresAt`: Attendance token expiry icin eklendi.
- Tarihler UTC olarak saklanir; UI `Europe/Istanbul` gosterir.
- Audit kayitlari lifecycle, review, publish ve attendance token issue gibi kritik islemler icin kullanilir.

Migration'lar:

- `20260723115617_init`: Tum baslangic enumlari, tablolar, foreign keyler, indeksler, unique constraintler ve `qrTokenHash` alanini olusturur.
- `20260723193154_add_attendance_token_expiry`: `Event.qrTokenExpiresAt` alanini ekler.

## 5. Roller ve Authorization

Roller:

- `STUDENT`: Public eventlere kayit olabilir, kendi registration durumunu gorebilir, kayitli oldugu etkinlikte QR check-in yapabilir.
- `CLUB_MEMBER`: Su anda kulup adina yonetim islemi yapamaz; normal uye olarak tutulur.
- `CLUB_ADMIN`: Yalniz aktif `ClubMembership.role = ADMIN` oldugu kendi kulubu icin draft event olusturabilir, draft submit edebilir, QR attendance token uretimini gorebilir/kullanabilir ve attendance summary gorebilir.
- `PRESS_EDITOR`: `SUBMITTED` etkinliklerde request changes, reject, approve kararlari verebilir ve `APPROVED` etkinligi publish edebilir. Kulup adina event olusturamaz veya review disinda kulup temsilcisi sayilmaz.
- `SYSTEM_ADMIN`: Operasyonel bypass. Draft event olusturma, submit, review kararlar, publish, attendance token ve attendance summary icin yetkilidir.

Onemli kurallar:

- Kulup admini sadece kendi kulubunde yetkilidir; baska kulup eventleri icin `403`.
- `PRESS_EDITOR` kendi basina kulup event olusturma, submit, registration, attendance token veya summary yetkisi almaz.
- `STUDENT` sadece registration/check-in akislarinda yetkilidir.
- `SYSTEM_ADMIN` bypass'lari acik ve servis/authorization katmaninda uygulanir.
- Session token payload'i roller veya kulup uyeliklerini tasimaz. Her korumali istekte principal veritabanindan yeniden cozulur.
- UI gorunurluk kontrolleri UX icindir; API authorization zorunlu guvenlik siniri olarak kalir.

## 6. Event Lifecycle

Butun durumlar:

- `DRAFT`
- `SUBMITTED`
- `CHANGES_REQUESTED`
- `REJECTED`
- `APPROVED`
- `PUBLISHED`
- `CANCELLED`
- `COMPLETED`

Gercekten uygulanmis gecisler:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> CHANGES_REQUESTED`
- `SUBMITTED -> REJECTED`
- `SUBMITTED -> APPROVED`
- `APPROVED -> PUBLISHED`

Belgede tanimli ama henuz endpoint olarak uygulanmamis veya tamamlanmamis surecler:

- `CHANGES_REQUESTED -> SUBMITTED` yeniden duzenleme/submit akisi.
- `PUBLISHED -> COMPLETED`.
- `DRAFT|SUBMITTED|CHANGES_REQUESTED|APPROVED|PUBLISHED -> CANCELLED`.
- Event guncelleme/silme, changes requested sonrasi duzenleme, complete/cancel UI/API.

## 7. Mevcut API Endpointleri

Toplam uygulanmis endpoint sayisi: 17.

### Health

- `GET /health`
  - Auth gerekmez.
  - `200 OK`; service, status, timezone ve checkedAt doner.

### Auth

- `POST /auth/dev-login`
  - Auth gerekmez; yalniz `NODE_ENV !== "production"` ve `ENABLE_DEV_AUTH=true`.
  - Body: `{ "email": "..." }`.
  - Basarida HttpOnly session cookie yazar ve principal doner.
  - Bilinmeyen user `404`; production/dev auth kapali durumlarda kullanilamaz.

- `GET /auth/me`
  - Auth gerekir.
  - Basarida user id, email, displayName, global roller ve aktif kulup uyelikleri doner.
  - Cookie yok/gecersiz/expired ise `401`.

- `POST /auth/logout`
  - Auth zorunlu degil.
  - Session cookie temizlenir; oturum yoksa da guvenli basarili cevap.

### Event Write/Lifecycle

- `POST /events`
  - Auth gerekir.
  - Yetki: eventin `clubId` degerindeki aktif kulup `ADMIN` uyeligi veya `SYSTEM_ADMIN`.
  - Basari: `201`, her zaman `DRAFT`.
  - `400`: validation; `401`: auth yok; `403`: yetki yok; `404`: kulup yok.

- `POST /events/:eventId/submit`
  - Auth gerekir.
  - Yetki: event kulubunde aktif `ADMIN` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `DRAFT -> SUBMITTED`.
  - `400`: gecersiz id; `401`; `403`; `404`; `409`: event `DRAFT` degil veya tekrarli/yarisan submit.

- `POST /events/:eventId/request-changes`
  - Auth gerekir.
  - Yetki: `PRESS_EDITOR` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `SUBMITTED -> CHANGES_REQUESTED`; comment trim sonrasi bos olamaz.
  - `400`: gecersiz id/comment; `401`; `403`; `404`; `409`: status uygun degil veya ikinci karar.

- `POST /events/:eventId/reject`
  - Auth gerekir.
  - Yetki: `PRESS_EDITOR` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `SUBMITTED -> REJECTED`; comment trim sonrasi bos olamaz.
  - `400`, `401`, `403`, `404`, `409` davranislari request-changes ile ayni.

- `POST /events/:eventId/approve`
  - Auth gerekir.
  - Yetki: `PRESS_EDITOR` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `SUBMITTED -> APPROVED`; comment opsiyoneldir.
  - `400`, `401`, `403`, `404`, `409` davranislari review akisiyle ayni.

- `POST /events/:eventId/publish`
  - Auth gerekir.
  - Yetki: `PRESS_EDITOR` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `APPROVED -> PUBLISHED`, `publishedAt` doldurulur.
  - `400`; `401`; `403`; `404`; `409`: event `APPROVED` degil veya ikinci publish.

### Public Discovery

- `GET /events`
  - Auth gerekmez.
  - Yalniz `PUBLISHED` eventleri public alanlarla dondurur.
  - Query: `from`, `to`, `clubId`, `q`, `page`, `pageSize`.
  - Varsayilan `from = now`, `page=1`, `pageSize=20`; web UI `pageSize=12` kullanir.
  - Siralama: `startsAt ASC`, deterministik ikinci alan `id ASC`.
  - `400`: gecersiz tarih/sayfalama.

- `GET /events/:eventId`
  - Auth gerekmez.
  - Yalniz `PUBLISHED` event detail doner.
  - Public olmayan veya bilinmeyen event `404`; gecersiz id `400`.
  - Internal alanlar donmez.

### Registration

- `POST /events/:eventId/register`
  - Auth gerekir.
  - Yetki: principal global rollerinde `STUDENT`.
  - Basari: `201`, `{ id, eventId, userId, registeredAt }`.
  - Yalniz `PUBLISHED` ve henuz baslamamis eventler.
  - `400`: gecersiz id; `401`; `403`: student degil; `404`: bilinmeyen/public olmayan event; `409`: duplicate, baslamis event veya kapasite dolu.

- `GET /events/:eventId/registration`
  - Auth gerekir.
  - Yetki: `STUDENT`.
  - Basari: `{ registered, registration }`; yalniz current user kaydi.
  - `401`; `403`; `404`: bilinmeyen/public olmayan event.

### Attendance

- `POST /events/:eventId/attendance-token`
  - Auth gerekir.
  - Yetki: event kulubunde aktif `ADMIN` veya `SYSTEM_ADMIN`.
  - Basari: `200`, `{ eventId, token, expiresAt }`.
  - Yalniz `PUBLISHED` event. Ham token sadece response'ta bir kez doner.
  - `400`: gecersiz id; `401`; `403`; `404`; `409`: event published degil.

- `POST /events/:eventId/check-in`
  - Auth gerekir.
  - Yetki: `STUDENT`.
  - Body: `{ token }`.
  - Basari: `201`, `{ id, eventId, userId, checkedInAt }`.
  - Gerekenler: event `PUBLISHED`, ogrenci kayitli, token gecerli ve suresi dolmamis, zaman penceresi uygun, duplicate attendance yok.
  - `400`: gecersiz id/token veya suresi dolmus/gecersiz token; `401`; `403`: student degil veya kayit yok; `404`: event yok/public degil; `409`: zaman penceresi disi veya duplicate.

- `GET /events/:eventId/attendance-summary`
  - Auth gerekir.
  - Yetki: event kulubunde aktif `ADMIN` veya `SYSTEM_ADMIN`.
  - Basari: `200`, event ozet bilgisi ve toplam metrikler.
  - `PUBLISHED`, `COMPLETED`, `CANCELLED` statuslerinde anlamli summary doner.
  - `400`: gecersiz id; `401`; `403`; `404`; `409`: status summary icin uygun degil.

## 8. Transaction ve Eszamanlilik Kararlari

- Lifecycle gecisleri kosullu update kullanir: update sadece beklenen mevcut status ile eslesirse basarili olur.
- `DRAFT -> SUBMITTED` event update ve `AuditLog` ayni transaction icinde yazilir.
- Review kararlari event update, `EventReview` ve `AuditLog` kaydini ayni transaction icinde yazar.
- Publish event update, `publishedAt` ve `AuditLog` kaydini ayni transaction icinde yazar.
- Registration kapasite kontrolu PostgreSQL `FOR UPDATE` ile event satirini kilitler; count ve create ayni transaction icindedir.
- Registration duplicate son savunmasi: `EventRegistration @@unique([eventId, userId])`.
- Attendance duplicate son savunmasi: `Attendance @@unique([eventId, userId])`.
- Yarisan isteklerde yalniz ilk uygun islem basarili olur; kaybeden istek kontrollu `409` alir.
- Prisma `P2002` unique constraint hatalari registration/attendance duplicate durumlarinda kontrollu `409 Conflict` cevabina cevrilir.
- Basarisiz transaction yarim event/review/audit/registration/attendance kaydi birakmamalidir.

## 9. QR Guvenlik Tasarimi

- Ham attendance token yalniz `POST /events/:eventId/attendance-token` basarili response'unda bir kez doner.
- Veritabaninda ham token degil SHA-256 hash saklanir: `Event.qrTokenHash`.
- Expiry `Event.qrTokenExpiresAt` alaninda saklanir.
- MVP token gecerliligi: 15 dakika.
- Yeni token uretimi eski tokeni gecersiz kilar.
- QR payload version 1:

```json
{
  "version": 1,
  "eventId": "...",
  "token": "..."
}
```

- Token URL, browser storage, server/client loglari, statik HTML, hata mesaji veya accessibility label icine yazilmamalidir.
- Check-in zaman penceresi `packages/config` sabitleriyle:
  - Event baslangicindan 30 dakika once acilir.
  - Event bitisinden 60 dakika sonra kapanir.
- Yalniz etkinlige kayitli `STUDENT` check-in yapabilir.
- Token karsilastirmasi hash ve timing-safe karsilastirma yaklasimi ile yapilir.

## 10. Web Route ve Ekranlar

Uygulanmis route'lar:

- `/`: Ana public etkinlik listesi.
- `/events/[eventId]`: Public event detail.
- `/check-in`: Ogrenci QR yoklama ekrani.

Davranislar:

- Public filtreleme ve pagination: Ana sayfa `GET /events` kullanir; `q`, `from`, `to`, `page`, `pageSize` URL query string ile korunur.
- Public detail ve guvenli 404: `/events/[eventId]`, `GET /events/:eventId` kullanir; API 404 ise Next `notFound()`, API/5xx hatasi ise kontrollu hata paneli.
- Dev auth paneli: Sadece development ortaminda ve `NEXT_PUBLIC_ENABLE_DEV_AUTH=true` iken gorunur.
- Ogrenci registration paneli: Detail sayfasinda `/auth/me` ile oturumu cozer; anonymous, non-student, not registered, registered ve hata durumlarini gosterir. Student kayitliysa `/check-in` linki verir.
- Yetkili QR yonetim paneli: Sadece event kulubu aktif `ADMIN` veya `SYSTEM_ADMIN`; token uretir, QR gorseli ve expiry/kalan sure gosterir, refresh eder.
- Ogrenci kamera/manual check-in ekrani: `/check-in`; once `/auth/me`, sonra `STUDENT` kontrolu. Kamera sadece kullanici aksiyonuyla baslar; manuel JSON payload yedegi vardir.
- Attendance summary paneli: Detail sayfasinda sadece event kulubu aktif `ADMIN` veya `SYSTEM_ADMIN`; `GET /events/:eventId/attendance-summary` ile toplam metrikleri gosterir ve manuel refresh yapar.

Panel gorunurlukleri:

- Girmemis kullanici: Public liste/detail gorebilir; registration panel login mesaji verir; QR/summary paneller gorunmez; `/check-in` login mesaji verir.
- `STUDENT`: Registration panel ve `/check-in` kullanabilir; QR/summary paneller gorunmez.
- `PRESS_EDITOR`: Review/publish API yetkisi vardir; web detail QR/summary/registration butonlari gorunmez.
- Normal kulup uyesi: QR/summary paneli gorunmez.
- Kendi kulubunun `CLUB_ADMIN` uyeligi: QR ve attendance summary paneli gorur.
- `SYSTEM_ADMIN`: QR ve attendance summary paneli gorur.

## 11. Test Durumu

Son dogrulanmis test sayilari:

- API unit: 102
- API integration: 90
- Web unit: 68
- Contracts unit: 2

`packages/config` ve `packages/ui` icinde test dosyasi yoktur; mevcut scriptler `--passWithNoTests` ile acik sekilde bos gecer.

Test stratejisi:

- Unit testler: Servis/helper/state/lifecycle/authorization hesaplari.
- API integration: Nest app + gercek Prisma/PostgreSQL test verisiyle endpoint davranislari.
- HTTP smoke: Build edilmis API ve web dev server ile kritik uc uca HTTP akislari.
- Gercek browser automation yok.
- Kamera davranisi fiziksel cihazla test edilmedi; parser, scanner lifecycle, permission/error state ve manuel payload davranislari helper/unit testleriyle dogrulandi.

## 12. Bilinen Ortam Sorunlari

- Root Turbo wrapper bazi komutlar sonunda child processler tamamlandiktan sonra beklemede kalabiliyor.
- Gercek dogrulamalar paket bazli komutlarla ayrica yapildi ve gecmistir.
- Eski Next/Node/Turbo sureclerinin kernel `D` veya defunct state'te kalabildigi goruldu.
- Bu surecler kaynak kodu veya Git durumunu etkilemedi; sonraki agent bu PID'lerle gereksiz yere ugrasmamali.
- `.next`, `.turbo`, `node_modules` ve yarim kurulum kalintilari gerekli oldugunda repo disina tasindi.
- PostgreSQL container host portu `5433`; varsayilan `5432` kullanilmiyor.

## 13. Tamamlanan Faz 1 Akisi

1. Dev auth
2. Taslak event olusturma
3. Submit
4. Press review
5. Publish
6. Public liste
7. Public detail
8. Student registration
9. Registration status UI
10. QR token
11. QR display
12. Student scanner/manual payload
13. Check-in
14. Attendance summary API
15. Attendance summary UI

## 14. Henuz Yapilmayanlar

- Gercek AGU SSO
- Kulup ve Basin Yayin dashboard listeleri
- Event duzenleme
- `CHANGES_REQUESTED` sonrasi duzenleme ve yeniden submit
- Event cancel/complete lifecycle
- Registration iptali
- Ayrintili katilimci listesi
- CSV/Excel export
- Manuel personel check-in
- Attendance silme
- Bildirim/e-posta
- Browser E2E
- Gercek cihaz kamera matrisi
- Salon rezervasyonu ve Faz 2 ozellikleri

## 15. Sonraki Onerilen Gorevler

1. Kulup dashboard'u ve kulubun kendi etkinlik listesi
   - Kulup admininin olusturdugu/takip ettigi etkinlikleri tek yerde gormesi sonraki yonetim akislari icin temel olur.
2. `CHANGES_REQUESTED` event duzenleme ve yeniden submit
   - Basin Yayin'in degisiklik isteme karari su anda terminal gibi kaliyor; bu akisi tamamlamak onay surecini kullanilabilir hale getirir.
3. Basin Yayin bekleyen etkinlikler paneli
   - `SUBMITTED` eventlerin UI uzerinden incelenmesi press editor deneyimini tamamlar.
4. Event cancel/complete lifecycle
   - Yayinlanmis etkinliklerin operasyonel kapanis ve iptal senaryolari icin gerekli lifecycle adimlaridir.
5. Katilimci listesi ve export
   - Attendance summary sonrasi kulup raporlama ihtiyaci icin ayrintili, kontrollu ve veri minimizasyonlu cikti gerekir.

## 16. Calisma Kurallari

- Once `AGENTS.md`, `docs/agent/HANDOFF.md` ve `docs/agent/CURRENT_STATE.md` oku.
- Butun repository'yi gereksiz yere tekrar tarama.
- Kucuk dikey dilimler gelistir.
- Controller icine is mantigi koyma.
- Authorization API'de zorunlu olsun; UI kontrolu guvenlik siniri degildir.
- Public response'lara internal veri sizdirma.
- Test ve smoke dogrulamasi yap.
- Basarisiz kontrolleri gizleme.
- AGU Kampus Takvimi projesinde gorev basariyla tamamlandiginda commit ve push rutin olarak yapilabilir.
- Kullanici aksi yonde soylemedikce ayrica commit/push onayi bekleme.
- Kernel `D` state PID'leriyle ugrasma.

## 17. Mevcut Git Durumu

- Branch: `main`
- Upstream: `origin/main`
- Remote repository: `https://github.com/serhatvs/takvimprojesi.git`
- Son commit: `ecc049a feat: add attendance summary panel`
- Calisma agaci: Bu handoff olusturulmadan once temizdi.

Son 15 commit:

```text
ecc049a feat: add attendance summary panel
b4e223e feat: add event attendance summary
fb4b7d8 feat: add student QR check-in scanner
bbb48bb feat: add attendance QR display
b75fcfe feat: add QR attendance backend
d2a8004 feat: add event registration controls
b00041b feat: add student event registration
603de99 feat: add public event detail page
1eadd06 feat: add public campus event listing
beba5d4 feat: add public event discovery API
e9ede26 feat: add event publishing workflow
9a25a7e feat: add press event review workflow
e529ffd feat: add event submission workflow
374575e feat: add draft event creation endpoint
5a00db3 feat: add development authentication boundary
```
