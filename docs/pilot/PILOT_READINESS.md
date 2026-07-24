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
| Dev-login production engeli | ✅ HAZİR | `AuthService.ensureDevAuthAvailable()` `NODE_ENV=production` veya `ENABLE_DEV_AUTH !== 'true'` olduğunda 403 döndürür. Startup env validation da bu kombinasyonu reddeder. |
| Gerçek AGÜ SSO | 🔴 KRİTİK BLOCKER | Henüz SSO provider yok. Pilot test hesaplarıyla yapılabilir ama gerçek öğrenci/personel girişi için SSO şart. **Pilot kapsamı yalnızca test hesaplarıyla sınırlanırsa kabul edilebilir (⚠️).** |
| Session cookie güvenliği | ✅ HAZİR | HttpOnly, SameSite=Lax, production'da Secure. Token payload'ında yalnızca userId. |
| Session secret doğrulaması | ✅ HAZİR | Startup'ta AUTH_SESSION_SECRET varlığı ve minimum uzunluğu kontrol edilir. |

## 2. Yetkilendirme

| Madde | Durum | Açıklama |
|-------|-------|----------|
| API-side role enforcement | ✅ HAZİR | Tüm korumali endpointler AuthenticationGuard + role/club yetki kontrolü. |
| Controller'da iş mantığı yok | ✅ HAZİR | Authorization kararları AuthorizationService ve servis katmanında. |
| Principal token'dan çözülmez | ✅ HAZİR | Her istekte DB'den güncel roller ve üyelikler yüklenir. |

## 3. CORS ve İletişim Güvenliği

| Madde | Durum | Açıklama |
|-------|-------|----------|
| CORS origin kontrolü | ✅ HAZİR | Production'da WEB_ORIGIN zorunlu, wildcard (*) yasak, env validasyonla kontrol edilir. Development'ta localhost fallback. |
| Credentials taşıma | ✅ HAZİR | `credentials: true` ile cookie tabanlı auth. |
| HSTS | ✅ HAZİR | API ve Web tarafında production'da HSTS header'ı eklenir. |

## 4. Güvenlik Başlıkları (Headers)

| Madde | Durum | Açıklama |
|-------|-------|----------|
| X-Content-Type-Options: nosniff | ✅ HAZİR | API middleware + Next.js headers() |
| X-Frame-Options: DENY | ✅ HAZİR | Clickjacking koruması |
| X-XSS-Protection: 0 | ✅ HAZİR | Legacy header, modern tarayıcılarda CSP yeterli |
| Referrer-Policy | ✅ HAZİR | strict-origin-when-cross-origin |
| Content-Security-Policy | ⚠️ KABUL EDİLEBİLİR | Pilot için eklenmedi. Production CSP kuralları deploy ortamına göre özelleştirilmeli. |

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
| QR token saklanmıyor | ✅ HAZİR | Ham token yalnızca response'da bir kez döner, DB'de SHA-256 hash saklanır. |
| Token loglara yazılmıyor | ✅ HAZİR | Audit metadata'sında token/hash yok. Kod içinde `console.log` yok. |
| Public response minimizasyonu | ✅ HAZİR | createdById, email, membership, review, audit alanları dönmüyor. |
| Summary'de kişisel veri | ✅ HAZİR | Yalnızca yetkili yönetici erişebilir; toplam metrikler + katılımcı bilgisi. |

## 7. Veritabanı ve Migration

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Migration stratejisi | ✅ HAZİR | Production'da `prisma migrate deploy` (seed çalıştırmaz, reset yapmaz). |
| Development seed idempotent | ✅ HAZİR | Seed birden çok kez çalıştırılabilir. |
| Destructive migration yok | ✅ HAZİR | Mevcut migration'larda DROP/TRUNCATE yok. |

## 8. Health Check

| Madde | Durum | Açıklama |
|-------|-------|----------|
| /health (liveness) | ✅ HAZİR | Lightweight, DB bağımlılığı yok. |
| /ready (readiness) | ✅ HAZİR | DB connectivity testi (SELECT 1). Başarısızsa 503. |

## 9. Ortam Değişkenleri

| Madde | Durum | Açıklama |
|-------|-------|----------|
| Production env validation | ✅ HAZİR | Startup'ta DATABASE_URL, AUTH_SESSION_SECRET, QR_ATTENDANCE_SECRET, WEB_ORIGIN kontrol edilir. |
| Zayıf secret tespiti | ✅ HAZİR | Minimum 32 karakter, default dev değerleri reddedilir. |
| Dev-auth+production çakışması | ✅ HAZİR | ENABLE_DEV_AUTH=true + NODE_ENV=production = uygulama başlatılmaz. |

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
| ✅ HAZİR | 18 madde |
| ⚠️ KABUL EDİLEBİLİR | 4 madde (CSP, genel rate limit, Dockerfile, CI/CD) |
| 🔴 KRİTİK BLOCKER | 1 madde (Gerçek AGÜ SSO) |

### Kritik Blocker Hakkında Karar

**Gerçek AGÜ SSO** henüz mevcut değil. İki seçenek:

1. **Pilot'u test hesaplarıyla başlat** → SSO blocker'ı **⚠️ KABUL EDİLEBİLİR** olarak yeniden sınıflandır. Dev-login production'da kapalı kalacağı için test hesapları manuel olarak (seed veya admin panel üzerinden) oluşturulmalı ve session secret güçlü tutulmalı.

2. **SSO entegrasyonunu bekle** → Pilot ertelensin.

Kullanıcı kararı bekleniyor.

---

## Test Doğrulama Durumu

- [x] Lint: 5 package scope geçti
- [x] Typecheck: 5 package scope geçti
- [x] API unit tests: geçti
- [x] API integration tests: geçti
- [x] Web unit tests: geçti
- [x] Contracts build: geçti
