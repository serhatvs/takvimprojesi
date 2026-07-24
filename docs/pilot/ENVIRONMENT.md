# Ortam Değişkenleri Rehberi (Environment Variables)

AGÜ Kampüs Takvimi projesinin ortam değişkenleri ve üretim (production) gereksinimleri.

## Ortam Değişkenleri Listesi

| Değişken | Açıklama | Örnek (Dev) | Production Kuralları |
|----------|----------|-------------|----------------------|
| `NODE_ENV` | Çalışma ortamı | `development` | `production` zorunlu |
| `DATABASE_URL` | PostgreSQL bağlantı cümlesi | `postgresql://agu:agu_dev_password@localhost:5433/agu_kampus_takvimi?schema=public` | Gerçek production DB adresi ve şifresi |
| `API_PORT` | NestJS API portu | `3001` | Sunucu port seçimi |
| `WEB_ORIGIN` | API'ye erişebilecek Frontend adresi (CORS) | `http://localhost:3000` | Frontend production URL'i (`https://takvim.agu.edu.tr`). Wildcard (`*`) KABUL EDİLMEZ. |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend'in API'ye atacağı istek adresi | `http://localhost:3001` | API production public URL'i (`https://api-takvim.agu.edu.tr`). |
| `ENABLE_DEV_AUTH` | Dev-login kapısı | `true` | Production'da `false` olmalı veya TANIMLANMAMALIDIR. `true` ise API BAŞLAMAZ. |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH` | Frontend dev login UI görünürlüğü | `true` | Production'da `false` veya TANIMLANMAMIŞ olmalıdır. |
| `AUTH_SESSION_SECRET` | Session JWT imzalamak için gizli anahtar | `replace-with-a-local-development-session-secret` | En az 32 karakter uzunluğunda yüksek entropili rastgele metin. Örnek değer kabul edilmez. |
| `QR_ATTENDANCE_SECRET` | Yoklama QR token imzalamak için gizli anahtar | `dev-qr-attendance-secret-change-in-production` | En az 32 karakter uzunluğunda yüksek entropili rastgele metin. Örnek değer kabul edilmez. |
| `APP_TIME_ZONE` | Varsayılan zaman dilimi | `Europe/Istanbul` | `Europe/Istanbul` |

---

## Otomatik Doğrulama (Startup Validation)

API başlatıldığında (`main.ts`), `validateProductionEnv()` fonksiyonu `NODE_ENV=production` ise şu kontrolleri yapar:

1. `DATABASE_URL` tanımlı mı?
2. `AUTH_SESSION_SECRET` tanımlı ve en az 32 karakter mi?
3. `QR_ATTENDANCE_SECRET` tanımlı, en az 32 karakter ve varsayılan dev metni değil mi?
4. `WEB_ORIGIN` tanımlı ve `*` değil mi?
5. `ENABLE_DEV_AUTH` `true` olarak ayarlanmış mı? (`true` ise başlatma engellenir)

Koşullar sağlanmazsa uygulama başlamaz ve eksik/hatalı değişkenlerin listesini içeren hata fırlatır.
Secret değerleri veya şifreler hata mesajlarında VEYA loglarda KESİNLİKLE gösterilmez.
