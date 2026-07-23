# Event Lifecycle

## Durumlar

- `DRAFT`: Kulup tarafindan hazirlanan, henuz onaya gonderilmemis etkinlik.
- `SUBMITTED`: Basin Yayin incelemesine gonderilmis etkinlik.
- `CHANGES_REQUESTED`: Basin Yayin degisiklik istemistir.
- `REJECTED`: Basin Yayin etkinligi reddetmistir.
- `APPROVED`: Basin Yayin etkinligi onaylamistir.
- `PUBLISHED`: Kampus takviminde yayinlanan etkinlik.
- `CANCELLED`: Iptal edilen etkinlik.
- `COMPLETED`: Gerceklesmis ve kapatilmis etkinlik.

## Izin Verilen Gecisler

| From | To | Yetkili roller |
| --- | --- | --- |
| `DRAFT` | `SUBMITTED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |
| `SUBMITTED` | `CHANGES_REQUESTED` | `PRESS_EDITOR` |
| `SUBMITTED` | `REJECTED` | `PRESS_EDITOR` |
| `SUBMITTED` | `APPROVED` | `PRESS_EDITOR` |
| `CHANGES_REQUESTED` | `SUBMITTED` | `CLUB_ADMIN` |
| `APPROVED` | `PUBLISHED` | `PRESS_EDITOR`, `SYSTEM_ADMIN` |
| `PUBLISHED` | `COMPLETED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |
| `DRAFT` | `CANCELLED` | `CLUB_ADMIN` |
| `SUBMITTED` | `CANCELLED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |
| `CHANGES_REQUESTED` | `CANCELLED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |
| `APPROVED` | `CANCELLED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |
| `PUBLISHED` | `CANCELLED` | `CLUB_ADMIN`, `SYSTEM_ADMIN` |

## Uygulama Kurallari

- Gecisler servis katmaninda `EventLifecycleService` ile dogrulanir.
- Controller yalnizca request/response sinirini yonetir.
- Her durum degisikligi `AuditLog` kaydi uretmelidir.
- `DRAFT -> SUBMITTED` yalnizca mevcut durum `DRAFT` ise yapilir; tekrarli veya eszamanli ikinci submit `409 Conflict` doner.
- Event status guncellemesi ve `AuditLog` kaydi ayni transaction icinde kalici hale getirilir.
- Basin Yayin kararlari `EventReview` icinde karar veren kullanici ve aciklama ile saklanir.
- Kulup yetkisi icin sistem rolunun yaninda ilgili kulupte aktif `ClubMembership` kontrolu gerekir.
