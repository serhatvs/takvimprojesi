# Geri Dönüş ve Felaket Kurtarma (Rollback Plan)

AGÜ Kampüs Takvimi dağıtım başarısızlığı veya prod sorunlarında geri dönüş prosedürü.

## 1. Uygulama Kodu Geri Dönüşü (App Rollback)

Eğer yeni bir release deploy edildikten sonra sorun tespit edilirse:

```bash
# 1. Önceki kararlı commit'e dönün
git checkout <previous-stable-commit-hash>

# 2. Kontratları ve uygulamayı yeniden derleyin
pnpm --filter @agu/contracts build
NEXT_TELEMETRY_DISABLED=1 pnpm build

# 3. Servisleri yeniden başlatın
pm2 restart all # veya systemctl restart agu-api agu-web
```

---

## 2. Veritabanı Geri Dönüşü (Database Rollback)

Prisma `migrate deploy` yalnızca ileri yönlü (forward-only) çalışır.

### Senaryo A: Destructive Olmayan Migration (Yeni tablo/sütun ekleme)
- Kod önceki sürüme çekildiğinde veritabanındaki yeni sütun veya tablolar zarar vermez.
- Migration rollback yapılması zorunlu değildir.

### Senaryo B: Şema Değişikliği Geri Alma Gereksinimi
- Deployment öncesi veritabanı yedeği (dump) alınmalıdır:
  ```bash
  pg_dump -U agu -h localhost -p 5433 agu_kampus_takvimi > backup_before_deploy.sql
  ```
- Sorun anında yedeğe dönün:
  ```bash
  psql -U agu -h localhost -p 5433 -d agu_kampus_takvimi < backup_before_deploy.sql
  ```

---

## 3. Acil Durum Kontrol Listesi (Emergency Checklist)

1. **Servis erişilemiyor:** `/health` endpoint'ini kontrol edin (Process sorunu mu?).
2. **Veritabanı hatası:** `/ready` endpoint'ini kontrol edin (503 dönüyorsa DB erişimi kopmuştur).
3. **Log inceleme:** Secret veya token loglara sızmaz, logları inceleyip 500 hatalarının kök nedenini belirleyin.
4. **Dev-login hatası:** Production'da `ENABLE_DEV_AUTH=true` kalmışsa uygulama başlamaz, env dosyasını düzeltin.
