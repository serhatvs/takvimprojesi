# AGU Kampus Takvimi PRD

## Problem

AGU ogrenci kulubu etkinlikleri daginik kanallarda duyuruluyor, onay sureci merkezi takip edilemiyor ve etkinlik katilimi guvenilir bicimde olculmuyor. Kulup yetkilileri etkinlik yayinlamak icin net bir is akisina, Basin Yayin ekibi yayin oncesi kontrol noktasina, ogrenciler de guncel kampus takvimine ihtiyac duyuyor.

## Kullanicilar

- Ogrenci: Etkinlikleri gorur, kayit olur ve etkinlik gunu QR ile katilim verir.
- Kulup uyesi: Kulup etkinliklerini takip eder, ileride yetkisine gore katkida bulunabilir.
- Kulup yoneticisi: Etkinlik olusturur, onaya gonderir, katilim istatistiklerini gorur.
- Basin Yayin editoru: Etkinlikleri inceler, onaylar, reddeder veya degisiklik ister.
- Sistem yoneticisi: Roller, kulup kayitlari ve sistem ayarlari icin operasyonel yetkiye sahiptir.

## Faz 1 Kapsami

- Rol tabanli test hesaplari ile giris siniri.
- Kulup ve kulup uyeligi modeli.
- Etkinlik olusturma, onaya gonderme ve durum gecisi servis siniri.
- Basin Yayin inceleme kayit modeli.
- Onaylanan etkinliklerin yayinlanmasi ve yayinlanmis etkinliklerin public liste/detay API'leriyle kampus takvimine hazir hale gelmesi.
- Ana sayfada yayinlanmis ve yaklasan etkinliklerin arama, tarih filtresi ve sayfalama ile listelenmesi.
- Yayinlanmis etkinlikler icin public detay sayfasinda etkinlik bilgilerini goruntuleme.
- Ogrencinin yayinlanmis ve henuz baslamamis etkinlige detay sayfasindan tekil kayit olmasi ve kendi kayit durumunu gormesi.
- Kulup yoneticisinin etkinlik detay sayfasinda kisa omurlu QR katilim tokeni uretmesi, QR gorselini yenileyebilmesi ve kalan sureyi gorebilmesi.
- Kayitli ogrencinin etkinlik gunu QR token ile tekil attendance kaydi olusturmasi.
- Ogrencinin `/check-in` ekraninda kamera veya manuel QR payload yedegiyle yoklama vermesi.
- Kulup yoneticisinin etkinlik bazinda kayit, yoklama, gelmeyen ve kapasite ozetini gormesi icin API temeli.
- QR token ham degerini saklamadan katilim dogrulama mimarisi.
- Audit log ve bildirim adaptoru icin baslangic sinirlari.

## Kapsam Disi Ozellikler

- Gercek AGU SSO entegrasyonu.
- Tum urun ekranlari ve tamamlanmis tasarim sistemi.
- E-posta, SMS veya push bildirimlerinin gercek saglayici entegrasyonlari.
- Gelismis takvim filtreleri, tekrar eden etkinlikler ve mekan rezervasyonu.
- Mobil uygulama.
- Analitik dashboardlarin tamamlanmis hali.

## Temel Kullanici Senaryolari

- Kulup yoneticisi taslak etkinlik olusturur ve Basin Yayin onayina gonderir.
- Basin Yayin editoru aciklama ekleyerek onaylar, reddeder veya degisiklik ister.
- Herkes yayinlanmis gelecek etkinlikleri ana sayfadaki kampus takviminde arar, tarih araligina gore filtreler ve listeler.
- Herkes yayinlanmis bir etkinligin public detay sayfasini acar ve filtreleri korunmus sekilde listeye donebilir.
- Ogrenci yayinlanmis ve henuz baslamamis etkinlige kapasite uygunsa detay sayfasindan bir kez kayit olur; sayfa yenilendiginde kayitli durumu korunur.
- Kulup yoneticisi etkinlik gunu katilim icin kisa omurlu QR token uretir, QR gorselini katilim noktasinda gosterir ve gerekirse yeniler.
- Kayitli ogrenci etkinlik gunu QR token ile yalnizca bir attendance kaydi olusturur.
- Ogrenci kamera kullanarak veya kamera kullanilamiyorsa QR payload'ini manuel girerek yoklama verir.
- Kulup yoneticisi etkinlik katilim sayilarini gorur.
- Kulup yoneticisi kendi etkinligi icin katilim ozetini gorur.

## Basari Olcutleri

- Kulup etkinliklerinin onay sureci sistem uzerinden izlenebilir.
- Gecersiz etkinlik durum gecisleri API servis katmaninda engellenir.
- Yayinlanan etkinlikler merkezi takvim icin public liste ve detay verisi uretir, ana sayfada kartlar halinde gorunur ve detay sayfasinda incelenir.
- Kayit ve attendance tekillik kurallari veritabani tarafinda korunur; etkinlik kapasitesi ve eszamanli attendance istekleri limitleri asmaz.
- Katilim ozetleri ogrenci isim/e-posta bilgisi sizdirmeden toplam kayit, yoklama, gelmeyen, kalan kapasite ve oran metriklerini uretir.
- Kritik durum degisiklikleri audit log ile geriye donuk incelenebilir.

## Varsayimlar

- Tarihler veritabaninda UTC saklanir, arayuzde `Europe/Istanbul` olarak gosterilir.
- Bir kullanici birden fazla sistem rolune sahip olabilir.
- Kulup icindeki yetki `ClubMembership.role` uzerinden belirlenir.
- QR tokenin yalnizca hash veya turetilmis dogrulama verisi saklanir; web arayuzunde ham token sadece QR uretildikten sonra client component belleginde tutulur.
- Faz 1'de kimlik dogrulama test hesaplariyla sinirlandirilir.

## Acik Sorular

- Etkinlik kapasitesi doldugunda bekleme listesi gerekecek mi?
- QR tokenin 15 dakikalik MVP gecerlilik suresi operasyon icin yeterli mi?
- Kulup yetkilileri AGU tarafindan mi atanacak, yoksa kulup adminleri yeni uye ekleyebilecek mi?
- Bildirim kanallari hangi sirayla devreye alinacak?
- Gercek cihaz kamera testleri icin hangi browser/cihaz matrisi kabul edilecek?
