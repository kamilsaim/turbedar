<div align="center">

<img src="logo.png" alt="Türbedar" width="240">

# Türbedar

**Emanet • Hizmet • Sadakat**

_Türkiye'nin ve dünyanın türbe, kümbet ve önemli mezarlarının gönüllü ortak envanteri_

[**▶ Uygulamayı Aç**](https://kamilsaim.github.io/turbedar/)

</div>

---

## Türbedar nedir?

Türbedar, bir türbenin bakımını ve hizmetini üstlenen kişiye verilen addır. Bu uygulama da aynı ruhu taşır: bu toprakların manevi mirasını oluşturan türbe, kümbet, şehitlik ve önemli mezarları kayıt altına almayı, fotoğraflamayı ve gelecek nesillere taşımayı amaçlar.

Birçok türbe ufak bir köyün kenarında, bir tepenin yamacında, kayıtsız ve bilinmez halde durur. Bir yere gidip o yeri görmüş, fotoğraflamış, hakkında bilgi edinmiş herkes; bu bilgiyi ortak bir hafızaya ekleyebilir. Böylece dağınık bilgi tek bir yerde toplanır, herkesin erişimine açılır.

> _"Allah yolunda öldürülenler için 'ölüler' demeyin. Hayır, onlar diridirler, fakat siz bilemezsiniz."_ — Bakara, 154

## Nasıl çalışır?

Türbedar topluluk temelli bir envanterdir. Herkes katkıda bulunabilir, ama kalite için her katkı bir onay sürecinden geçer:

1. **Keşfet** — Haritada veya listede mevcut türbeleri gezersin. İl, ilçe, mahalle ve kategoriye göre arayabilir, sana en yakın yerleri görebilirsin.
2. **Ekle** — Gittiğin bir yeri kaydedersin. Fotoğrafını çekersin (konum, fotoğrafın kendisinden ya da cihazından otomatik bulunur), yerin adını, burada yatan kişileri, kaynakları ve varsa video bağlantılarını girersin.
3. **Onay** — Eklediğin kayıt yöneticilere ulaşır. Onaylandığında haritada herkese görünür hale gelir.
4. **Zenginleştir** — Onaylı bir yere herkes fotoğraf, ek bilgi veya düzenleme önerisi katabilir. Ziyaret ettiğin yerleri işaretler, yorum yaparsın.

Aynı yerin tekrar tekrar eklenmesini önlemek için uygulama, yakındaki kayıtları tespit edip seni uyarır ve katkını mevcut kayda yönlendirir.

## Öne çıkan özellikler

- 🗺️ **Harita** — Sokak ve uydu görünümü, kubbe biçimli işaretler, konum tabanlı keşif
- 📷 **Akıllı konum** — Fotoğraftan otomatik GPS, cihaz konumu veya elle iğne yerleştirme
- 👥 **Yatan kişiler** — Her yere birden çok kişi, unvanları ve kısa biyografileriyle
- 📚 **Kaynaklar ve videolar** — Bilginin dayanağını belgele, YouTube/Instagram/X bağlantıları ekle
- ✅ **Onay ve revizyon sistemi** — Kaliteli ve güvenilir bir envanter için yönetici denetimi
- 🤝 **Topluluk katkısı** — Fotoğraf, ek bilgi ve düzenleme önerileri
- 🕌 **Ziyaret takibi** — Gezdiğin yerleri işaretle, kilometre taşlarında manevi mesajlarla
- 🔔 **Anlık bildirimler** — Kaydın onaylandığı an, telefon kapalı olsa bile haberin olur
- 📊 **İstatistikler** — Kişisel yolculuğun ve topluluk katkı sıralaması
- 📿 **Türbe âdâbı** — Ziyaret hakkında bilinmesi gerekenler bölümü
- 📱 **Uygulama olarak da** — Android'de doğrudan yüklenebilir; tarayıcıdan açanlara ana ekrana ekleme önerilir

## Teknoloji

Türbedar, tek bir HTML dosyasından oluşan, derleme adımı gerektirmeyen sade bir uygulamadır. Arka planda [Supabase](https://supabase.com) (veritabanı, kimlik doğrulama ve dosya depolama) kullanır; harita için [Leaflet](https://leafletjs.com), giriş için Google ile kimlik doğrulama tercih edilmiştir. [GitHub Pages](https://pages.github.com) üzerinden yayınlanır. Aynı kod, [Capacitor](https://capacitorjs.com) ile sarılarak Android uygulaması (APK) olarak da dağıtılabilir — web sürümü güncellendiğinde mobil uygulama da otomatik güncellenir.

## Sürüm Geçmişi

| Sürüm | Öne çıkanlar |
|-------|--------------|
| **1.21** | Canlı güncelleme: onay/red anında uygulama açıkken bile anlık yansıyor, bildirimler beklemeden düşüyor |
| **1.20** | Push bildirim altyapısı — cihaz kaydı ve bildirime dokununca ilgili kayda gitme |
| **1.19** | Tarayıcıdan açanlara "ana ekrana ekle" önerisi (Android gerçek yükleme, iOS yönlendirme) |
| **1.18** | Harita butonları sağ alt köşede toplandı, APK'da Google girişi sistem tarayıcısında açılıyor, katkı sıralaması sadece giriş yapana görünür |
| **1.17** | Haritada "buraya ekle" modu — bir noktaya dokunarak yeni kayıt başlatma |
| **1.16** | Yurtdışı kayıtlar için ülke bilgisi ve keşfette ülke filtresi |
| **1.15** | WhatsApp iletişim numarası kurucu profilinden yönetiliyor |
| **1.14** | Profile "Türbedar Hakkında" sayfası ve iletişim bölümü |
| **1.13** | Kapak fotoğrafı seçimi — ilk gösterilecek fotoğrafı belirleme |
| **1.12** | Kilometre taşı kutlamaları, onay bildirimleri, "yakınımdaki yerler" |
| **1.11** | Kişisel istatistikler İstatistik sekmesine taşındı, profil sadeleşti |
| **1.10** | Ek bilgi önerilerine fotoğraf ekleme |
| **1.9** | Çoklu kaynak + bağlantı, onaylı yerlere ek bilgi önerme |
| **1.8** | Güncelleme kontrolü ve fotoğraf galerisinde geçiş |
| **1.7** | Kullanıcı istatistikleri ve yönetici kullanıcı araması |
| **1.6** | Video bağlantıları (yer ve yorumlarda) |
| **1.5** | Otomatik baş harf büyütme, haritada uydu görünümü |
| **1.4** | Mükerrer kayıt önleme, mahalle/köy bilgisi |
| **1.3** | Açılış karşılaması, Bakara 154, türbe âdâbı bölümü |
| **1.2** | "Ziyaret ettim" özelliği |
| **1.1** | Harita önizleme kartları, iOS fotoğraf düzeltmesi |
| **1.0** | İlk sürüm: harita, kayıt ekleme, onay sistemi, yorumlar |

## Katkı

Türbedar bir gönül işidir. Bir yeri ziyaret ettiğinde fotoğraflayıp eklemen, bilgi düzeltmen ya da eksik bir kaynağı tamamlaman, bu ortak hafızaya katkıdır. Uygulamaya [buradan](https://kamilsaim.github.io/turbedar/) Google hesabınla giriş yaparak başlayabilirsin.

---

<div align="center">
<sub>Edeple gelen, lütufla gider.</sub>
</div>
