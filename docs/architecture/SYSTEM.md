# Sistem Mimarisi

## Sistem Bilesenleri

- `apps/web`: Next.js App Router tabanli web arayuzu.
- `apps/api`: NestJS REST API, is kurallari ve veri erisimi.
- `packages/contracts`: Web ve API tarafindan paylasilan tipler, enumlar ve lifecycle kurallari.
- `packages/config`: Ortak sabitler ve ortam konfigurasyonu yardimcilari.
- `packages/ui`: Tekrar kullanilabilir React arayuz bilesenleri.
- PostgreSQL: Kalici veri deposu.
- Prisma: ORM, schema ve migration yonetimi.

## Web ve API Siniri

Web uygulamasi urun deneyimini ve istemci tarafli durumlari yonetir. Yetki, durum gecisi ve veri butunlugu API tarafinda zorunlu kilinir. Web, REST endpointlerini `packages/contracts` tiplerine gore kullanir; controller icinde is mantigi tutulmaz.

Public etkinlik kesfi `GET /events` ve `GET /events/:eventId` endpointleriyle authentication gerektirmeden sunulur. Bu endpointler yalnizca `PUBLISHED` etkinlikleri gosterir; public olmayan veya bilinmeyen event ID'leri varlik bilgisi sizdirmamak icin `404 Not Found` doner.

Web ana sayfasi public etkinlik listesini server component icinde `GET /events` uzerinden okur. Arama, tarih araligi ve sayfalama URL query string ile tasinir; sayfa yenilemesinde filtreler korunur. Public liste fetch'i `cache: "no-store"` ile yapilir; kampus takvimi yayinlanan etkinlik degisikliklerini geciktirmeden gostermeyi onceliklendirir. API erisilemezse sayfa cokmez ve kullaniciya kisa hata durumu gosterilir.

Web public etkinlik detayi `/events/[eventId]` route'u ile sunulur ve `GET /events/:eventId` endpointini kullanir. `eventId` API path'ine encode edilerek aktarilir; liste filtreleri detail URL query string'inde yalniz geri navigasyon icin korunur ve detail API istegine eklenmez. API `404` donerse Next.js `notFound()` mekanizmasi kullanilir ve public olmayan etkinliklerin varligi ifsa edilmez. API baglanti veya `5xx` hatalari `404` olarak gosterilmez; kontrollu hata durumu ve listeye donus baglantisi render edilir.

## Veritabani Yaklasimi

PostgreSQL ana veri deposudur. Prisma schema domain iliskilerini, indeksleri ve benzersizlik kurallarini tanimlar. Migration dosyalari veri etkisi kontrol edilerek uretilmelidir. Tarihler UTC olarak saklanir.

## Kimlik Dogrulama Siniri

Faz 1'de gercek AGU SSO yoktur. Gelistirme ortaminda `ENABLE_DEV_AUTH=true` ve `NODE_ENV !== "production"` kosuluyla seed kullanicilari uzerinden `POST /auth/dev-login` kullanilir. Basarili giris kisa omurlu, HttpOnly cookie icinde tasinan imzali session token uretir. Token payload'i yalnizca kullanici kimligi ve standart zaman alanlarini tasir; rol veya kulup uyeligi listesi token'a gomulmez.

`GET /auth/me` gibi korumali isteklerde API token'daki kullanici kimligini dogrular, ardindan kullaniciyi, global rollerini ve aktif kulup uyeliklerini veritabanindan tekrar cozer. Ham session token veritabaninda saklanmaz ve session tablosu yoktur. Bu sinir gelecekte AGU SSO adapter'i ile degistirilecek; SSO'dan gelen kalici kimlik ayni `User` kaydina map edilecektir.

## Yetkilendirme Yaklasimi

Sistem rolleri coklu rol modeliyle tutulur. Kulup icindeki yetki `ClubMembership` uzerinden belirlenir. API endpointleri hem sistem rolunu hem ilgili kulup uyeligini dogrulamalidir. Auth altyapisinda `AuthenticationGuard`, `CurrentUser`, global role decorator/guard ve kulup uyeligi sorgulamalari icin `AuthorizationService` siniri bulunur; controller icinde authorization is mantigi tutulmaz.

Taslak etkinlik olusturma kulup icinde `ADMIN` uyelik rolu gerektirir. `SYSTEM_ADMIN` operasyonel destek icin acik bir bypass'a sahiptir. `PRESS_EDITOR` Basin Yayin inceleme roludur; kulup uyeligi veya sistem adminligi olmadan kulup adina etkinlik olusturamaz.

Taslak etkinligi onaya gonderme yalnizca `DRAFT -> SUBMITTED` gecisini kapsar. Gecis `EventLifecycleService` ile dogrulanir, status guncellemesi kosullu olarak yalnizca mevcut status `DRAFT` iken yapilir ve audit kaydi ayni transaction icinde olusturulur. Tekrarli veya eszamanli ikinci submit `409 Conflict` ile sonuclanir.

Basin Yayin inceleme islemleri yalnizca `PRESS_EDITOR` veya `SYSTEM_ADMIN` tarafindan yapilabilir. `SUBMITTED -> CHANGES_REQUESTED`, `SUBMITTED -> REJECTED` ve `SUBMITTED -> APPROVED` gecisleri `EventLifecycleService` ile dogrulanir; kulup admini kendi etkinligini bu rol nedeniyle inceleyemez. Her karar status kosullu update, `EventReview` create ve audit create adimlarini tek transaction icinde yapar; ikinci veya yarisan karar `409 Conflict` doner.

Yayinlama islemi yalnizca `PRESS_EDITOR` veya `SYSTEM_ADMIN` tarafindan `APPROVED -> PUBLISHED` gecisi icin yapilir. Event status kosullu olarak yalnizca mevcut durum `APPROVED` iken guncellenir, mevcut `publishedAt` alani UTC islem zamaniyla doldurulur ve audit kaydi ayni transaction icinde olusturulur. Tekrarli veya eszamanli ikinci publish `409 Conflict` doner.

Public listeleme varsayilan olarak mevcut zamandan sonraki `PUBLISHED` etkinlikleri `startsAt ASC, id ASC` siralar. `from` ve `to` filtreleri `startsAt` uzerinden dahilidir; `clubId`, trim edilmis case-insensitive `q`, `page` ve `pageSize` desteklenir. Varsayilan `page=1`, `pageSize=20`, maksimum `pageSize=100` olarak uygulanir.

Ogrenci etkinlik kaydi `POST /events/:eventId/register` ile yapilir ve authentication gerektirir. Principal'in global rolleri arasinda `STUDENT` yoksa `403 Forbidden` doner; `PRESS_EDITOR`, `CLUB_ADMIN` veya `SYSTEM_ADMIN` yalniz bu rolleri nedeniyle otomatik kayit olamaz. Kullanicinin `userId` degeri istemciden alinmaz, authentication principal'indan gelir.

Kayit yalnizca `PUBLISHED` ve henuz baslamamis etkinlikler icin aciktir. Public olmayan veya bilinmeyen event ID'leri `404 Not Found` ile gizlenir; baslamis etkinlik, duplicate kayit veya dolu kapasite `409 Conflict` doner. Kapasite kontrolu PostgreSQL transaction icinde event satirina `FOR UPDATE` lock alinarak yapilir; kayit sayisi ve `EventRegistration` create ayni transaction icindedir. `@@unique([eventId, userId])` duplicate kayit icin son savunma katmani olarak kalir ve Prisma unique constraint hatalari kontrollu `409` cevabina cevrilir.

## QR Katilim Yaklasimi

QR tokenin ham hali veritabaninda zorunlu olarak saklanmaz. Uygulama, kisa omurlu token veya hashlenmis dogrulama degeriyle attendance olusturur. `Attendance` modelindeki `@@unique([eventId, userId])` ayni etkinlik icin ikinci katilimi engeller.

## Bildirim Adaptoru Yaklasimi

`Notification` modeli uygulama ici bildirimleri ve gelecekteki kanal metadata'sini tutar. E-posta, SMS veya push gibi saglayicilar adapter arkasina alinmali; domain servisi saglayici detaylarini bilmemelidir.

## Audit Log Yaklasimi

Durum degisiklikleri ve kritik operasyonlar `AuditLog` ile izlenir. Log kaydi actor, entity, action, onceki/sonraki deger ve metadata alanlarini tasir. Audit log islemle ayni transaction icinde yazilmalidir.

`DRAFT -> SUBMITTED` submit isleminde audit action `EVENT_SUBMITTED`, entity `Event`, onceki status `DRAFT`, yeni status `SUBMITTED` ve actor kullanici kimligi tutulur. Cookie, token veya secret audit metadata'sina yazilmaz.

Basin Yayin kararlari icin audit action degerleri `EVENT_CHANGES_REQUESTED`, `EVENT_REJECTED` ve `EVENT_APPROVED` olarak tutulur. Audit metadata karar bilgisini tasir; yorum `EventReview` icinde saklanir ve token, cookie veya secret audit/review kayitlarina yazilmaz.

Publish islemi icin audit action `EVENT_PUBLISHED` olarak tutulur. Audit kaydi onceki status `APPROVED`, yeni status `PUBLISHED`, actor ve publish zamanini metadata icinde tasir; cookie, token veya secret saklanmaz.

## Guvenlik ve Kisisel Veri Minimizasyonu

Yalnizca gerekli kullanici bilgileri saklanir. Gizli degerler repoya yazilmaz; `.env.example` yalnizca ornek gelistirme degerleri tasir. Session secret `.env` uzerinden gelir. Session cookie `HttpOnly`, `SameSite=Lax` ve production ortaminda `Secure` olarak yazilir. QR token ham degeri kalici saklama zorunlulugu yoktur. Yetki kontrolleri API tarafinda uygulanir.

Public event response'lari `createdById`, kullanici e-postasi, uyelik bilgisi, review, audit, QR token hash ve internal metadata dondurmez; yalniz takvim ve detay gorunumu icin gerekli event ve kulup alanlarini secer.

Event registration response'u yalniz `id`, `eventId`, `userId` ve `registeredAt` alanlarini dondurur; istemciden gonderilen kullanici, rol veya token bilgisi dikkate alinmaz.

Web public etkinlik kartlari da yalniz public response alanlarini render eder: baslik, kulup adi, tarih/saat, konum, aciklama, kapasite ve yayin durumu. Development auth paneli yalniz development ortaminda gorunur ve public liste fetch'inden ayri tutulur.

Public detail sayfasi metadata title degerini etkinlik basligindan, description degerini etkinlik aciklamasinin normalize edilmis ve kisaltilmis ozetinden uretir. Metadata icinde internal alan, kullanici bilgisi veya gizli veri bulunmaz. Ayni request yasam dongusunde metadata ve sayfa verisi icin `cache()` ile tekrar azaltimi uygulanir.

## Gelecekte AGU SSO Entegrasyon Noktasi

SSO entegrasyonu auth modulunde adapter olarak eklenmelidir. Dev-login yalnizca gelistirme kolayligi icindir ve production'da kapali kalir. SSO'dan gelen kalici kullanici tanimlayicisi, e-posta ve profil bilgileri `User` kaydina map edilir. Roller ve kulup uyelikleri uygulama verisi olarak ayrica yonetilmeye devam eder.
