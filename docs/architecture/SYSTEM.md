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

## QR Katilim Yaklasimi

QR tokenin ham hali veritabaninda zorunlu olarak saklanmaz. Uygulama, kisa omurlu token veya hashlenmis dogrulama degeriyle attendance olusturur. `Attendance` modelindeki `@@unique([eventId, userId])` ayni etkinlik icin ikinci katilimi engeller.

## Bildirim Adaptoru Yaklasimi

`Notification` modeli uygulama ici bildirimleri ve gelecekteki kanal metadata'sini tutar. E-posta, SMS veya push gibi saglayicilar adapter arkasina alinmali; domain servisi saglayici detaylarini bilmemelidir.

## Audit Log Yaklasimi

Durum degisiklikleri ve kritik operasyonlar `AuditLog` ile izlenir. Log kaydi actor, entity, action, onceki/sonraki deger ve metadata alanlarini tasir. Audit log islemle ayni transaction icinde yazilmalidir.

`DRAFT -> SUBMITTED` submit isleminde audit action `EVENT_SUBMITTED`, entity `Event`, onceki status `DRAFT`, yeni status `SUBMITTED` ve actor kullanici kimligi tutulur. Cookie, token veya secret audit metadata'sina yazilmaz.

Basin Yayin kararlari icin audit action degerleri `EVENT_CHANGES_REQUESTED`, `EVENT_REJECTED` ve `EVENT_APPROVED` olarak tutulur. Audit metadata karar bilgisini tasir; yorum `EventReview` icinde saklanir ve token, cookie veya secret audit/review kayitlarina yazilmaz.

## Guvenlik ve Kisisel Veri Minimizasyonu

Yalnizca gerekli kullanici bilgileri saklanir. Gizli degerler repoya yazilmaz; `.env.example` yalnizca ornek gelistirme degerleri tasir. Session secret `.env` uzerinden gelir. Session cookie `HttpOnly`, `SameSite=Lax` ve production ortaminda `Secure` olarak yazilir. QR token ham degeri kalici saklama zorunlulugu yoktur. Yetki kontrolleri API tarafinda uygulanir.

## Gelecekte AGU SSO Entegrasyon Noktasi

SSO entegrasyonu auth modulunde adapter olarak eklenmelidir. Dev-login yalnizca gelistirme kolayligi icindir ve production'da kapali kalir. SSO'dan gelen kalici kullanici tanimlayicisi, e-posta ve profil bilgileri `User` kaydina map edilir. Roller ve kulup uyelikleri uygulama verisi olarak ayrica yonetilmeye devam eder.
