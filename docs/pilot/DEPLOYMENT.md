# Pilot Deployment Guide

AGÜ Kampüs Takvimi Faz 1 pilot sürümü için dağıtım rehberi.

## Gereksinimler

- Node.js >= 24.0.0
- pnpm 11.16.0
- PostgreSQL >= 17
- Docker & Docker Compose (isteğe bağlı)

---

## Dağıtım Adımları

### 1. Kod ve Bağımlılıklar

```bash
git clone <repository-url> takvimprojesi
cd takvimprojesi
pnpm install --frozen-lockfile
```

### 2. Ortam Değişkenleri

Production `.env` dosyasını `docs/pilot/ENVIRONMENT.md` rehberine göre oluşturun.

Kritik gereksinimler:
- `NODE_ENV=production`
- `AUTH_SESSION_SECRET` (minimum 32 karakter, rastgele üretilmiş)
- `QR_ATTENDANCE_SECRET` (minimum 32 karakter, rastgele üretilmiş)
- `WEB_ORIGIN` (kesinlikle wildcard `*` olmamalı)
- `ENABLE_DEV_AUTH` kesinlikle `true` olmamalı (veya tamamen kaldırılmalı)

### 3. Kontratlar ve Derleme (Build)

```bash
# Contracts derlemesi
pnpm --filter @agu/contracts build

# Production build
NEXT_TELEMETRY_DISABLED=1 pnpm build
```

### 4. Veritabanı Migration

 Production'da kesinlikle `prisma migrate dev` veya `seed` KULLANMAYIN!

```bash
# Güvenli production migration
pnpm --filter @agu/api prisma:migrate:deploy
```

### 5. Uygulamaları Başlatma

```bash
# API Başlatma
cd apps/api
NODE_ENV=production pnpm start

# Web Başlatma (Ayrı process veya reverse proxy arkasında)
cd apps/web
NODE_ENV=production pnpm start
```

---

## Sağlık Kontrolleri (Health Checks)

Dağıtım sonrası doğrulama:

```bash
# Liveness (Process çalışıyor mu?)
curl -f http://localhost:3001/health

# Readiness (Veritabanı bağlantısı açık mı?)
curl -f http://localhost:3001/ready
```

`/ready` endpoint'i DB kapalıysa `503` döner.

---

## Docker ile Dağıtım (İsteğe Bağlı)

```bash
# PostgreSQL ve servisleri başlatma
docker compose -f docker-compose.prod.yml up -d
```
