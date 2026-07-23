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

Faz 1'de gercek AGU SSO yoktur. Test hesaplarina uygun bir auth siniri kurulacak ve gelecekte SSO'dan gelen kullanici kimligi ayni `User` modeline baglanacaktir.

## Yetkilendirme Yaklasimi

Sistem rolleri coklu rol modeliyle tutulur. Kulup icindeki yetki `ClubMembership` uzerinden belirlenir. API endpointleri hem sistem rolunu hem ilgili kulup uyeligini dogrulamalidir.

## QR Katilim Yaklasimi

QR tokenin ham hali veritabaninda zorunlu olarak saklanmaz. Uygulama, kisa omurlu token veya hashlenmis dogrulama degeriyle attendance olusturur. `Attendance` modelindeki `@@unique([eventId, userId])` ayni etkinlik icin ikinci katilimi engeller.

## Bildirim Adaptoru Yaklasimi

`Notification` modeli uygulama ici bildirimleri ve gelecekteki kanal metadata'sini tutar. E-posta, SMS veya push gibi saglayicilar adapter arkasina alinmali; domain servisi saglayici detaylarini bilmemelidir.

## Audit Log Yaklasimi

Durum degisiklikleri ve kritik operasyonlar `AuditLog` ile izlenir. Log kaydi actor, entity, action, onceki/sonraki deger ve metadata alanlarini tasir. Audit log islemle ayni transaction icinde yazilmalidir.

## Guvenlik ve Kisisel Veri Minimizasyonu

Yalnizca gerekli kullanici bilgileri saklanir. Gizli degerler repoya yazilmaz; `.env.example` yalnizca ornek degerleri tasir. QR token ham degeri kalici saklama zorunlulugu yoktur. Yetki kontrolleri API tarafinda uygulanir.

## Gelecekte AGU SSO Entegrasyon Noktasi

SSO entegrasyonu auth modulunde adapter olarak eklenmelidir. SSO'dan gelen kalici kullanici tanimlayicisi, e-posta ve profil bilgileri `User` kaydina map edilir. Roller ve kulup uyelikleri uygulama verisi olarak ayrica yonetilmeye devam eder.
