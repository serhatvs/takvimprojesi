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

Detay sayfasindaki yoklama yonetimi paneli yalniz `/auth/me` principal bilgisindeki `SYSTEM_ADMIN` rolune veya public event club ID'siyle eslesen aktif `ADMIN` kulup uyeligine sahip kullanicilar icin client tarafinda render edilir. Bu kontrol yalniz kullanici deneyimi icindir; `POST /events/:eventId/attendance-token` endpointindeki API authorization zorunlu kalir. Panel tokeni server render sirasinda istemez, QR payload'ini URL, history veya storage'a yazmaz ve ham tokeni yalniz client component state'inde tutar.

Detay sayfasindaki katilim ozeti paneli de ayni `/auth/me` principal bilgisi ve public event club ID'siyle gorunurluk karari verir. Yetkisiz kullanicilar icin `GET /events/:eventId/attendance-summary` istegi hic gonderilmez; API authorization yine zorunlu guvenlik siniri olarak kalir. Panel `credentials: "include"` ve `cache: "no-store"` ile yalniz yetkili kullanici icin veri yukler, otomatik polling yapmaz ve `Verileri Yenile` dugmesiyle tekil refresh saglar. Frontend `absentCount`, `remainingCapacity` ve `attendanceRate` degerlerini yeniden hesaplamaz; backend response'unu tek dogruluk kaynagi kabul edip yalniz Turkce bicimlendirme yapar.

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

Kullanicinin kendi kayit durumu `GET /events/:eventId/registration` ile okunur. Endpoint authentication ve `STUDENT` rolunu gerektirir; yalniz principal `userId` icin `EventRegistration` kaydini dondurur. Baska ogrencilerin kayit bilgisi, kapasite sayisi veya katilimci listesi response'a eklenmez. Web detay sayfasindaki kayit paneli once `/auth/me` ile oturumu cozer, ardindan bu status endpointini kullanir.

Etkinlik katilim ozeti `GET /events/:eventId/attendance-summary` ile okunur ve authentication gerektirir. Yalniz etkinligin kulubundeki aktif `ADMIN` uyeligine sahip kullanici veya `SYSTEM_ADMIN` erisebilir; `STUDENT`, normal kulup uyesi, `PRESS_EDITOR` ve baska kulup admini `403` alir. Kulup yoneticisi kendi kulubundeki etkinligi status fark etmeksizin bulabilir, ancak ozet yalniz `PUBLISHED`, `COMPLETED` ve `CANCELLED` durumlarinda doner; diger statuslar `409 Conflict` doner.

## QR Katilim Yaklasimi

QR tokenin ham hali veritabaninda zorunlu olarak saklanmaz. Uygulama, kisa omurlu token veya hashlenmis dogrulama degeriyle attendance olusturur. `Attendance` modelindeki `@@unique([eventId, userId])` ayni etkinlik icin ikinci katilimi engeller.

`POST /events/:eventId/attendance-token` endpointi yalniz etkinligin kulubundeki aktif `ADMIN` uyeligine sahip kullanici veya `SYSTEM_ADMIN` tarafindan kullanilir. Etkinlik `PUBLISHED` degilse token uretilemez. API kriptografik olarak guvenli rastgele ham token uretir, ham tokeni sadece basarili response icinde bir kez dondurur ve veritabaninda yalniz SHA-256 hash ile `qrTokenExpiresAt` degerini saklar. Yeni token uretimi `Event.qrTokenHash` ve `Event.qrTokenExpiresAt` alanlarini degistirdigi icin eski tokeni gecersiz kilar. MVP token gecerliligi 15 dakikadir.

Token uretimi `EVENT_ATTENDANCE_TOKEN_ISSUED` audit action'i ile kaydedilir. Audit metadata token suresini ve expiry bilgisini tasir; ham token veya token hash audit, log veya hata mesajlarina yazilmaz.

`POST /events/:eventId/check-in` endpointi authentication ve `STUDENT` rolu gerektirir. Ogrencinin etkinlige kayitli olmasi, event status'unun `PUBLISHED` olmasi, token hash'inin guvenli karsilastirmayla dogrulanmasi ve tokenin suresinin dolmamis olmasi gerekir. MVP check-in penceresi etkinlik baslangicindan 30 dakika once acilir ve bitisten 60 dakika sonra kapanir; bu degerler `packages/config` sabitlerinde tutulur. Attendance create islemi transaction icinde calisir ve `@@unique([eventId, userId])` duplicate/eszamanli ikinci check-in'i `409 Conflict` sonucuna cevirir.

Web QR paneli QR icerigini surumlenmis JSON payload olarak uretir: `version=1`, `eventId` ve ham `token`. Ham token metin olarak render edilmez; QR alt/aciklama metnine veya loglara yazilmaz. Kalan sure client tarafinda canli guncellenir; sure dolunca QR gizlenir, token state'i temizlenir ve kullanici yeni token uretmeye yonlendirilir.

Ogrenci yoklama ekrani `/check-in` route'u ile sunulur. Kamera tarayici yalniz client tarafinda, kullanici `Kamerayı Başlat` dugmesine bastiktan sonra dinamik yuklenir; server render sirasinda kamera izni istenmez. Sayfa once `/auth/me` ile principal bilgisini alir, `STUDENT` rolu yoksa tarayiciyi baslatmaz. QR payload parser'i yalniz surum `1`, bos olmayan `eventId` ve bos olmayan `token` kabul eder; UUID gibi backend'den farkli ID varsayimi eklemez. Gecerli payload, `POST /events/:eventId/check-in` istegine yalniz token body'de gonderilerek kullanilir.

Attendance summary sayimlari kisa read transaction icinde `EventRegistration.count` ve `Attendance.count` ile yapilir; katilimci listesi bellekte yuklenmez. `absentCount = max(registrationCount - attendanceCount, 0)`, `remainingCapacity = null` sinirsiz kapasite icin, aksi halde negatif olmayacak sekilde hesaplanir. `attendanceRate` kayit yoksa `0`, aksi halde bir ondalik hassasiyetle yuzde olarak doner.

## Bildirim Adaptoru Yaklasimi

`Notification` modeli uygulama ici bildirimleri ve gelecekteki kanal metadata'sini tutar. E-posta, SMS veya push gibi saglayicilar adapter arkasina alinmali; domain servisi saglayici detaylarini bilmemelidir.

## Audit Log Yaklasimi

Durum degisiklikleri ve kritik operasyonlar `AuditLog` ile izlenir. Log kaydi actor, entity, action, onceki/sonraki deger ve metadata alanlarini tasir. Audit log islemle ayni transaction icinde yazilmalidir.

`DRAFT -> SUBMITTED` submit isleminde audit action `EVENT_SUBMITTED`, entity `Event`, onceki status `DRAFT`, yeni status `SUBMITTED` ve actor kullanici kimligi tutulur. Cookie, token veya secret audit metadata'sina yazilmaz.

Basin Yayin kararlari icin audit action degerleri `EVENT_CHANGES_REQUESTED`, `EVENT_REJECTED` ve `EVENT_APPROVED` olarak tutulur. Audit metadata karar bilgisini tasir; yorum `EventReview` icinde saklanir ve token, cookie veya secret audit/review kayitlarina yazilmaz.

Publish islemi icin audit action `EVENT_PUBLISHED` olarak tutulur. Audit kaydi onceki status `APPROVED`, yeni status `PUBLISHED`, actor ve publish zamanini metadata icinde tasir; cookie, token veya secret saklanmaz.

Attendance token uretimi icin audit action `EVENT_ATTENDANCE_TOKEN_ISSUED` olarak tutulur. Audit kaydi actor, Event entity, event ID, expiry ve TTL bilgisini tasir; ham token veya token hash saklanmaz.

## Guvenlik ve Kisisel Veri Minimizasyonu

Yalnizca gerekli kullanici bilgileri saklanir. Gizli degerler repoya yazilmaz; `.env.example` yalnizca ornek gelistirme degerleri tasir. Session secret `.env` uzerinden gelir. Session cookie `HttpOnly`, `SameSite=Lax` ve production ortaminda `Secure` olarak yazilir. QR token ham degeri kalici saklama zorunlulugu yoktur. Yetki kontrolleri API tarafinda uygulanir.

Public event response'lari `createdById`, kullanici e-postasi, uyelik bilgisi, review, audit, QR token hash ve internal metadata dondurmez; yalniz takvim ve detay gorunumu icin gerekli event ve kulup alanlarini secer.

Event registration response'u yalniz `id`, `eventId`, `userId` ve `registeredAt` alanlarini dondurur; istemciden gonderilen kullanici, rol veya token bilgisi dikkate alinmaz.

Web public etkinlik kartlari da yalniz public response alanlarini render eder: baslik, kulup adi, tarih/saat, konum, aciklama, kapasite ve yayin durumu. Detay sayfasindaki ogrenci kayit paneli sadece oturum, rol ve kullanicinin kendi kayit durumunu gosterir; kontenjan sayisi veya katilimci listesi gostermez. Development auth paneli yalniz development ortaminda gorunur ve public liste fetch'inden ayri tutulur.

Detay sayfasindaki QR yoklama paneli yetkili olmayan kullanicilara render edilmez. Yetkili kullanicida ham token sadece buton tiklamasindan sonra client bellekte bulunur; statik HTML, metadata, URL, storage, hata mesaji veya accessibility label icine yazilmaz.

Ogrenci check-in ekrani da tokeni URL, storage, log, hata mesaji veya DOM metni olarak render etmez. Kamera stream'i component kapanisinda ve basarili tarama sonrasinda durdurulur. Kamera kullanilamayan durumlarda manuel yedek alan yalniz tam QR JSON payload'ini kabul eder; gonderimden sonra alan temizlenir.

Attendance summary response'u yalniz event kimligi/basligi/status/tarih/kapasite ve toplam metrikleri dondurur. Ogrenci adi, e-posta, userId, QR token/hash, audit, review veya katilimci listesi response'a eklenmez.

Web katilim ozeti paneli de yalniz toplam metrikleri render eder. Ogrenci isimleri, e-posta, userId, QR token/hash veya ham API response'u DOM'a yazilmaz; hata durumlari guvenli Turkce mesajlara eslenir.

Public detail sayfasi metadata title degerini etkinlik basligindan, description degerini etkinlik aciklamasinin normalize edilmis ve kisaltilmis ozetinden uretir. Metadata icinde internal alan, kullanici bilgisi veya gizli veri bulunmaz. Ayni request yasam dongusunde metadata ve sayfa verisi icin `cache()` ile tekrar azaltimi uygulanir.

## Gelecekte AGU SSO Entegrasyon Noktasi

SSO entegrasyonu auth modulunde adapter olarak eklenmelidir. Dev-login yalnizca gelistirme kolayligi icindir ve production'da kapali kalir. SSO'dan gelen kalici kullanici tanimlayicisi, e-posta ve profil bilgileri `User` kaydina map edilir. Roller ve kulup uyelikleri uygulama verisi olarak ayrica yonetilmeye devam eder.
