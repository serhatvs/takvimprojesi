# Pilot Readiness Assessment

Bu belge AGÜ Kampüs Takvimi Faz 1 pilot sürüm öncesi güvenlik ve yayın hazırlık durumunu sınıflandırır.

## Sınıflandırma Ölçeği

| Seviye | Anlam |
|--------|-------|
| ✅ HAZİR | Pilot için yeterli, ek aksiyon gerekmez |
| ⚠️ KABUL EDİLEBİLİR | Bilinen sınırlama var ama pilot engellemez |
| 🔴 KRİTİK BLOCKER | Pilot başlatılamaz, çözülmesi gerekir |

---

## 1. Kimlik Doğrulama

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Gerçek AGÜ SSO | ✅ HAZİR | AGÜ kullanıcıları kurumsal e-posta ile, dış katılımcılar normal e-posta doğrulamasıyla giriş yapabilir. AGÜ SSO zorunlu değildir. |
| Production e-posta OTP teslimat sağlayıcısı | 🔴 KRİTİK BLOCKER | Production e-posta OTP teslimat sağlayıcısı ve gönderici domaini henüz yapılandırılmadı. |
| Session cookie güvenliği | ✅ HAZİR | HttpOnly, SameSite=Lax, production'da Secure. Token payload'ında yalnızca userId. |
| Session secret doğrulaması | ✅ HAZİR | Startup'ta `AUTH_SESSION_SECRET` varlığı, minimum 32 karakter uzunluğu ve `.env.example` geliştirme değerinin kullanılmadığı doğrulanır. |

## 2. Yetkilendirme

| Madde | Durum | Açıklama |
|-------|-------|----------|
| API-side role enforcement | ✅ HAZİR | Tüm korumalı endpointler `AuthenticationGuard` + role/club yetki kontrolü ile korunur. |
| Controller'da iş mantığı yok | ✅ HAZİR | Authorization kararları `AuthorizationService` ve servis katmanında uygulanır. |
| Principal token'dan çözülmez | ✅ HAZİR | Her istekte DB'den güncel roller ve üyelikler yüklenir. |

## 3. CORS ve İletişim Güvenliği

| Madde | Durum | Açıklama |
|-------|-------|----------|
| CORS origin kontrolü | ✅ HAZİR | Production'da `WEB_ORIGIN` zorunlu, wildcard (`*`) ve bilinmeyen origin'ler kesinlikle reddedilir. Development'ta localhost fallback. |
| Credentials taşıma | ✅ HAZİR | `credentials: true` ile cookie tabanlı auth. |
| HSTS | ✅ HAZİR | API ve Web tarafında production'da HSTS header'ı eklenir. |

## 4. Güvenlik Başlıkları (Headers)

| Madde | Durum | Açıklama |
|-------|-------|----------|
| X-Content-Type-Options: nosniff | ✅ HAZİR | API middleware + Next.js headers() |
| X-Frame-Options: DENY | ✅ HAZİR | Clickjacking koruması |
| X-XSS-Protection: 0 | ✅ HAZİR | Legacy header, modern tarayıcılarda CSP yeterli |
| Referrer-Policy | ✅ HAZİR | strict-origin-when-cross-origin |
| Content-Security-Policy | ✅ HAZİR | Web ve API için ayrı yapılandırıldı; kamera/QR stream, Next.js script/style ve API connect kaynaklarına uyumlu. |
| Framework bilgi sızıntısı | ✅ HAZİR | `X-Powered-By` header'ı Express ve Next.js düzeyinde kaldırılmıştır. |

## 5. Rate Limiting

| Madde | Durum | Açıklama |
|-------|-------|----------|
| /auth/dev-login | ✅ HAZİR | IP başına 5 istek/dakika. |
| /attendance/check-in | ✅ HAZİR | IP başına 10 istek/dakika. |
| /events/*/attendance-token | ✅ HAZİR | IP başına 10 istek/dakika. |
| Genel API rate limit | ⚠️ KABUL EDİLEBİLİR | Hassas endpoint'ler korundu, genel limit production reverse proxy'de eklenebilir. |

## 6. Veri Güvenliği ve Minimizasyon

| Madde | Durum | Açıklama |
|-------|-------|----------|
| QR token saklanmıyor | ✅ HAZİR | Ham token yalnızca response'da bir kez döner, DB'de HMAC SHA256 ile doğrulanır. |
| Token loglara yazılmıyor | ✅ HAZİR | Audit metadata'sında token/hash yok. Kod içinde `console.log` yok. |
| Public response minimizasyonu | ✅ HAZİR | createdById, email, membership, review, audit alanları dönmüyor. |
| Summary'de kişisel veri | ✅ HAZİR | Yalnızca yetkili yönetici erişebilir; toplam metrikler + katılımcı bilgisi. |
| Production Hata Güvenliği | ✅ HAZİR | `AllExceptionsFilter` ile 500 yanıtlarında stack trace, connection string veya token/secret sızıntısı tamamen engellenmiştir. |

## 7. Veritabanı ve Migration

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Migration stratejisi | ✅ HAZİR | Production'da `prisma migrate deploy` (seed çalıştırmaz, reset yapmaz). Sıfır veritabanına başarıyla uygulanabilirliği doğrulandı. |
| Development seed idempotent | ✅ HAZİR | Seed birden çok kez çalıştırılabilir. |
| Destructive migration yok | ✅ HAZİR | Mevcut migration'larda DROP/TRUNCATE yok. |

## 8. Health Check

| Madde | Durum | Açıklama |
|-------|-------|----------|
| /health (liveness) | ✅ HAZİR | Lightweight, DB bağımlılığı yok (200 OK). |
| /ready (readiness) | ✅ HAZİR | DB connectivity testi (SELECT 1). Canlı iken 200, kapalı iken 503. |

## 9. Ortam Değişkenleri

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Production env validation | ✅ HAZİR | Startup'ta DATABASE_URL, AUTH_SESSION_SECRET, QR_ATTENDANCE_SECRET, WEB_ORIGIN kontrol edilir. |
| Zayıf ve varsayılan secret tespiti | ✅ HAZİR | Minimum 32 karakter, default `.env.example` geliştirme değerleri reddedilir. |
| Dev-auth+production çakışması | ✅ HAZİR | `ENABLE_DEV_AUTH=true` + `NODE_ENV=production` durumunda uygulama başlatılmaz. |

## 10. Docker ve Deployment

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Development Docker Compose | ✅ HAZİR | Yalnızca PostgreSQL, healthcheck ile. Davranış değiştirilmedi. |
| Production Dockerfile | ⚠️ KABUL EDİLEBİLİR | Henüz production Dockerfile yok. Pilot ortam konfigürasyonu ayrıca yapılmalı. |
| CI/CD pipeline | ⚠️ KABUL EDİLEBİLİR | Henüz otomatik pipeline yok. Manuel deploy yeterli pilot için. |

---

## Özet

| Kategori | Durum |
|----------|-------|
| ✅ HAZİR | 20 madde |
| ⚠️ KABUL EDİLEBİLİR | 3 madde (genel rate limit, Dockerfile, CI/CD) |
| 🔴 KRİTİK BLOCKER | 1 madde (Gerçek AGÜ SSO) |

### Kritik Blocker Hakkında Karar

**Gerçek AGÜ SSO** henüz mevcut değildir. Pilot dağıtımı öncesinde kapalı ağda test hesapları ile yürütülmeli veya SSO entegrasyonu tamamlanmalıdır.

---

## Test Doğrulama Durumu

- [x] Lint: 5 package scope geçti
- [x] Typecheck: 5 package scope geçti
- [x] API unit tests: 221 test geçti
- [x] API integration tests: 153 test geçti
- [x] Web unit tests: 140 test geçti
- [x] Contracts build: geçti
- [x] Clean DB Migration Deploy: geçti
- [x] Production Smoke Test (CORS, CSP, dev-auth lock, headers, health/ready): geçti
