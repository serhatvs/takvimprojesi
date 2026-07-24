# Google Cloud Run Deployment Guide

AGÜ Kampüs Takvimi'nin `apps/api` ve `apps/web` uygulamalarını Google Cloud Run
üzerinde container olarak dağıtmak için rehber. Genel (platformdan bağımsız)
production kavramları için `docs/pilot/DEPLOYMENT.md` ve
`docs/pilot/ENVIRONMENT.md` belgelerine bakın; bu belge yalnızca GCP'ye özgü
adımları içerir.

Bu akış mevcut yerel geliştirme akışını (`pnpm dev`, `docker compose up -d
postgres`) değiştirmez — Dockerfile'lar ve Cloud Build configleri repoya ek
olarak eklenmiştir.

---

## 1. GCP Kaynakları (bu pilot için sabit)

| Kaynak | Değer |
|---|---|
| Project | `agu-kampus-takvimi-pilot` |
| Region | `europe-west1` |
| Artifact Registry repo | `agu-takvim-containers` |
| API image | `europe-west1-docker.pkg.dev/agu-kampus-takvimi-pilot/agu-takvim-containers/api` |
| Web image | `europe-west1-docker.pkg.dev/agu-kampus-takvimi-pilot/agu-takvim-containers/web` |
| Cloud SQL instance | `agu-kampus-takvimi-pilot:europe-west1:agu-takvim-db` |
| Runtime service account | `agu-takvim-runtime@agu-kampus-takvimi-pilot.iam.gserviceaccount.com` |

Artifact Registry deposu ve service account'un zaten oluşturulmuş olduğu
varsayılır. Yoksa:

```bash
gcloud artifacts repositories create agu-takvim-containers \
  --project=agu-kampus-takvimi-pilot \
  --location=europe-west1 \
  --repository-format=docker

gcloud iam service-accounts create agu-takvim-runtime \
  --project=agu-kampus-takvimi-pilot \
  --display-name="AGU Takvim Cloud Run runtime"
```

Runtime service account'a en az şu rollere ihtiyaç vardır: `roles/cloudsql.client`,
Secret Manager'daki her secret için `roles/secretmanager.secretAccessor`.

---

## 2. Container Image'lar

İki uygulama için iki ayrı Dockerfile vardır, ikisi de **repo kökünü** build
context olarak kullanır (pnpm workspace + `turbo prune` tüm monorepoyu
görebilmeli):

- `apps/api/Dockerfile` — multi-stage, iki hedef (`--target`) sunar:
  - `api` (varsayılan): NestJS API'nin production Cloud Run service image'ı.
    Başlangıçta yalnızca `node apps/api/dist/src/main.js` çalıştırır; migration
    veya seed **çalıştırmaz**.
  - `migrate`: Cloud Run Job için, yalnızca
    `pnpm --filter @agu/api prisma:migrate:deploy` çalıştırır. Seed **hiçbir
    zaman** çalıştırmaz.
- `apps/web/Dockerfile` — Next.js standalone output kullanan tek hedefli
  production image'ı. `NEXT_PUBLIC_API_URL` build-arg olarak alınır ve build
  sırasında client bundle'a gömülür (Next.js `NEXT_PUBLIC_*` kuralı).

Her iki Dockerfile da Node 24 + pnpm 11.16.0 kullanır (`node:24-slim` +
corepack), non-root kullanıcıyla çalışır ve `.dockerignore` sayesinde `.env`,
`.git`, `node_modules`, test/coverage çıktıları image'a hiç girmez.

### 2.1 Cloud Build ile build + push

```bash
# API service + migration job image'ları
gcloud builds submit --config=cloudbuild.api.yaml --project=agu-kampus-takvimi-pilot .

# Web image (API URL'i bilindiğinde / değiştiğinde substitution ile geçin)
gcloud builds submit --config=cloudbuild.web.yaml \
  --project=agu-kampus-takvimi-pilot \
  --substitutions=_NEXT_PUBLIC_API_URL=https://agu-takvim-api-xxxxx-ew.a.run.app \
  .
```

Her ikisi de image'ları hem `:$COMMIT_SHA` hem `:latest` etiketiyle (API için
ayrıca `:migrate-$COMMIT_SHA` / `:migrate-latest`) Artifact Registry'ye
pushlar (Cloud Build `images:` alanı otomatik push eder).

İlk deploy sırasında web API URL'ini henüz bilmiyorsanız: önce API'yi deploy
edin, ardından gerçek Cloud Run URL'iyle web image'ını yeniden build edin
(bkz. bölüm 5).

### 2.2 Yerel build (opsiyonel, doğrulama için)

```bash
docker build -f apps/api/Dockerfile --target api     -t agu-api:local .
docker build -f apps/api/Dockerfile --target migrate -t agu-api-migrate:local .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  -t agu-web:local .
```

---

## 3. Migration — Cloud Run Job (`agu-takvim-migrate`)

Migration, API servisinin başlangıcında **otomatik çalışmaz**. Her deploy
öncesi ayrı, manuel tetiklenen bir Cloud Run Job olarak çalıştırılır ve sonucu
kontrol edilir.

### 3.1 Job'u oluştur / güncelle

```bash
gcloud run jobs deploy agu-takvim-migrate \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/agu-kampus-takvimi-pilot/agu-takvim-containers/api:migrate-latest \
  --service-account=agu-takvim-runtime@agu-kampus-takvimi-pilot.iam.gserviceaccount.com \
  --set-cloudsql-instances=agu-kampus-takvimi-pilot:europe-west1:agu-takvim-db \
  --set-secrets=DATABASE_URL=agu-database-url:latest \
  --set-env-vars=NODE_ENV=production \
  --max-retries=0 \
  --task-timeout=600
```

Job image'ının `apps/api/Dockerfile`'daki `migrate` hedefinden geldiğinden
emin olun (`:migrate-latest` veya belirli bir `:migrate-<sha>`), **`api`
hedefinden değil** — `api` hedefinde prisma CLI (devDependency) production
bağımlılıklarından budanmıştır ve migration komutu çalışmaz.

Job yalnızca `DATABASE_URL` secret'ını alır; `AUTH_SESSION_SECRET`,
`QR_ATTENDANCE_SECRET`, `EMAIL_OTP_SECRET` gibi migration ile ilgisiz
secretlar Job'a verilmez.

### 3.2 Job'u çalıştır ve sonucu kontrol et

**Her API deploymentından önce manuel olarak çalıştırılmalı ve başarı sonucu
kontrol edilmelidir:**

```bash
gcloud run jobs execute agu-takvim-migrate \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --wait

echo "Exit code: $?"
```

`--wait` bayrağı execution bitene kadar bekler; çıkış kodu `0` değilse API
deploy'una **devam etmeyin**, logları inceleyin:

```bash
gcloud run jobs executions list \
  --job=agu-takvim-migrate \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1

gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="agu-takvim-migrate"' \
  --project=agu-kampus-takvimi-pilot --limit=100 --format=json
```

---

## 4. API Cloud Run Service Deploy (`agu-takvim-api`)

Secret Manager'da önce şu secret'ların oluşturulmuş olması gerekir (bkz.
bölüm 6 — **değerler bu belgeye yazılmaz**):
`agu-database-url`, `agu-auth-session-secret`, `agu-qr-attendance-secret`,
`agu-email-otp-secret`.

```bash
gcloud run deploy agu-takvim-api \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/agu-kampus-takvimi-pilot/agu-takvim-containers/api:latest \
  --platform=managed \
  --port=8080 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --service-account=agu-takvim-runtime@agu-kampus-takvimi-pilot.iam.gserviceaccount.com \
  --add-cloudsql-instances=agu-kampus-takvimi-pilot:europe-west1:agu-takvim-db \
  --set-secrets=DATABASE_URL=agu-database-url:latest,AUTH_SESSION_SECRET=agu-auth-session-secret:latest,QR_ATTENDANCE_SECRET=agu-qr-attendance-secret:latest,EMAIL_OTP_SECRET=agu-email-otp-secret:latest \
  --set-env-vars=NODE_ENV=production,ENABLE_DEV_AUTH=false,ENABLE_EMAIL_AUTH=false,EMAIL_DELIVERY_MODE=smtp,WEB_ORIGIN=https://REPLACE-WITH-WEB-URL
```

### Ayarların özeti

| Ayar | Değer |
|---|---|
| Service | `agu-takvim-api` |
| Region | `europe-west1` |
| Port | `8080` |
| Auth | `--allow-unauthenticated` |
| Min instances | `0` |
| Max instances | `3` (pilot) |
| Service account | `agu-takvim-runtime@agu-kampus-takvimi-pilot.iam.gserviceaccount.com` |
| Cloud SQL | `agu-kampus-takvimi-pilot:europe-west1:agu-takvim-db` (`--add-cloudsql-instances`) |

### Secrets (Secret Manager, `--set-secrets`)

| Env var | Secret |
|---|---|
| `DATABASE_URL` | `agu-database-url:latest` |
| `AUTH_SESSION_SECRET` | `agu-auth-session-secret:latest` |
| `QR_ATTENDANCE_SECRET` | `agu-qr-attendance-secret:latest` |
| `EMAIL_OTP_SECRET` | `agu-email-otp-secret:latest` |

### Normal env değişkenleri

| Env var | Değer | Not |
|---|---|---|
| `NODE_ENV` | `production` | |
| `ENABLE_DEV_AUTH` | `false` | `true` olursa API `validateProductionEnv()` ile başlamayı reddeder. |
| `ENABLE_EMAIL_AUTH` | `false` | SMTP henüz yapılandırılmadığı için ilk deploymentta kapalı — bkz. bölüm 7. |
| `EMAIL_DELIVERY_MODE` | `smtp` | `console` production'da `validateProductionEnv()` tarafından reddedilir. |
| `WEB_ORIGIN` | Web Cloud Run URL'i | İlk deploymentta geçici olarak web servisinin Cloud Run URL'i verilir, sabit domain bağlanınca güncellenir — bkz. bölüm 5. |

`DATABASE_URL` secret değeri Cloud SQL unix socket formatında olmalı, örnek
şablon (gerçek şifre buraya **yazılmaz**, yalnızca Secret Manager'a girilir):

```
postgresql://<db-user>:<db-password>@/<db-name>?host=/cloudsql/agu-kampus-takvimi-pilot:europe-west1:agu-takvim-db&schema=public
```

---

## 5. Web Cloud Run Service Deploy (`agu-takvim-web`)

```bash
gcloud run deploy agu-takvim-web \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/agu-kampus-takvimi-pilot/agu-takvim-containers/web:latest \
  --platform=managed \
  --port=8080 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3
```

### WEB_ORIGIN / NEXT_PUBLIC_API_URL döngüsü (ilk deployment)

API ve web servisleri birbirinin URL'ine ihtiyaç duyduğu için ilk deploymentta
kısa bir "tavuk-yumurta" adımı vardır:

1. `agu-takvim-api`'yi geçici bir `WEB_ORIGIN` ile deploy edin (ör. bilinen
   pilot domaini varsa onu kullanın; yoksa web'i önce deploy edip URL'ini
   alın).
2. `agu-takvim-web`'i `NEXT_PUBLIC_API_URL=<api'nin Cloud Run URL'i>` build-arg'ıyla
   build edip deploy edin.
3. Web'in gerçek Cloud Run URL'i (veya sabit domain) netleşince,
   `agu-takvim-api` servisinin `WEB_ORIGIN` env değişkenini güncelleyin:

```bash
gcloud run services update agu-takvim-api \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --update-env-vars=WEB_ORIGIN=https://agu-takvim-web-xxxxx-ew.a.run.app
```

Sabit bir domain (ör. `https://takvim.agu.edu.tr`) bağlandığında `WEB_ORIGIN`
ve `NEXT_PUBLIC_API_URL` tekrar güncellenip web image'ı yeniden build/deploy
edilmelidir (`NEXT_PUBLIC_API_URL` build-time olduğu için sadece env update
yetmez, image yeniden build edilmeli).

---

## 6. Secret Manager (isimler — değerler burada YOK)

Bu belge hiçbir secret **değeri** içermez, yalnızca Secret Manager'daki isim
referanslarını içerir. Değerler `gcloud secrets create` / `gcloud secrets
versions add` ile ayrıca, bu repodan bağımsız olarak girilir.

| Secret adı | Kullanan | Not |
|---|---|---|
| `agu-database-url` | `agu-takvim-api`, `agu-takvim-migrate` | Cloud SQL unix socket connection string. |
| `agu-auth-session-secret` | `agu-takvim-api` | ≥32 karakter, yüksek entropi. |
| `agu-qr-attendance-secret` | `agu-takvim-api` | ≥32 karakter, yüksek entropi. |
| `agu-email-otp-secret` | `agu-takvim-api` | ≥32 karakter, yüksek entropi, session/QR secret'larından farklı olmalı (`validateProductionEnv()` bunu zorunlu kılar). |

SMTP için de yalnızca isimler belgelenir — SMTP henüz yapılandırılmadığından
bu secret'lar **henüz oluşturulmamıştır**:

| Env var (gelecekte) | Önerilen Secret Manager adı |
|---|---|
| `SMTP_HOST` | `agu-smtp-host` |
| `SMTP_PORT` | `agu-smtp-port` |
| `SMTP_USER` | `agu-smtp-user` |
| `SMTP_PASSWORD` | `agu-smtp-password` |
| `EMAIL_FROM` | `agu-smtp-from` |

### SMTP notu (önemli)

SMTP henüz yapılandırılmadığı için **ilk API deploymentında
`ENABLE_EMAIL_AUTH=false` kullanılır** (bölüm 4). SMTP secret'ları Secret
Manager'a eklenip yukarıdaki env değişkenleri `agu-takvim-api` servisine
tanımlandıktan sonra `ENABLE_EMAIL_AUTH=true` yapılır:

```bash
gcloud run services update agu-takvim-api \
  --project=agu-kampus-takvimi-pilot \
  --region=europe-west1 \
  --update-env-vars=ENABLE_EMAIL_AUTH=true,EMAIL_FROM=no-reply@agu.edu.tr \
  --update-secrets=SMTP_HOST=agu-smtp-host:latest,SMTP_PORT=agu-smtp-port:latest,SMTP_USER=agu-smtp-user:latest,SMTP_PASSWORD=agu-smtp-password:latest
```

`validateProductionEnv()`, `ENABLE_EMAIL_AUTH=true` olduğunda `EMAIL_OTP_SECRET`,
`EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT` eksikse API'nin başlamasını zaten
engeller — yanlışlıkla yarım yapılandırmayla prod'a çıkmayı önler.

---

## 7. Deploy sonrası doğrulama

```bash
API_URL=$(gcloud run services describe agu-takvim-api --project=agu-kampus-takvimi-pilot --region=europe-west1 --format='value(status.url)')
WEB_URL=$(gcloud run services describe agu-takvim-web --project=agu-kampus-takvimi-pilot --region=europe-west1 --format='value(status.url)')

curl -f "$API_URL/health"
curl -f "$API_URL/ready"
curl -f "$WEB_URL/"
```

`/health` process canlılığını, `/ready` veritabanı bağlantısını kontrol eder
(DB kapalıysa `503` döner). Bkz. `docs/pilot/DEPLOYMENT.md` bölüm "Sağlık
Kontrolleri".

Docker image'ları yerelde build edip aynı testleri container üzerinde
çalıştırmak için `scripts/docker/smoke-test-api.sh` ve
`scripts/docker/smoke-test-web.sh` betikleri kullanılabilir (Docker gerektirir).

Bir image'ın hiçbir layer'ında `.env` veya `.git` içeriği kalmadığını
doğrulamak için:

```bash
scripts/docker/verify-no-secrets-in-image.sh agu-api:local
```

---

## 8. Rollback

Cloud Run her deploy'da yeni bir immutable revision oluşturur. Sorun
durumunda trafiği önceki revision'a geri almak için:

```bash
gcloud run services update-traffic agu-takvim-api \
  --project=agu-kampus-takvimi-pilot --region=europe-west1 \
  --to-revisions=<önceki-revision-adı>=100
```

Genel rollback prosedürü için `docs/pilot/ROLLBACK.md` belgesine bakın; bu
belge yalnızca Cloud Run'a özgü komutu ekler. Migration'lar geriye dönük
uyumlu (additive) yazıldığı sürece bir API rollback'i genellikle migration
rollback'i gerektirmez — schema geriye dönük uyumsuz bir migration
gerektiriyorsa önce bunun ayrıca ele alınması gerekir.
