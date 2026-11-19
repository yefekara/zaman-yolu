# Zaman Yolu

9. sınıf tarih dersi için hem web’de hem kâğıt kartlarla oynanabilen soru kartı oyunu (TÜBİTAK 2204-A projesi).

## Nasıl açılır?

- **Oyun:** `index.html` dosyasına çift tıklayın. Tarayıcıda açılır, kurulum gerekmez. Aynı cihaz, bilgisayara karşı ve pratik modları internetsiz çalışır.
- **Basılabilir set:** `kartlar.html` dosyasını açıp tarayıcıdan yazdırın (A4, ölçek %100, kenar boşluğu yok, arka plan grafikleri açık). Kural sayfası, tahta, 66 soru kartı ve joker kartları çıkar.
- **Özel linkle oynama** ve **kartlardaki QR kodlar** için oyunun internette yayınlanması gerekir: bkz. [YAYINLAMA.md](YAYINLAMA.md).

## Dosyalar

| Dosya | Görevi |
|---|---|
| `sorular.js` | **Tek soru bankası.** Web oyunu da basılı kartlar da buradan beslenir. |
| `oyun-motoru.js` | Oyun kuralları (taş-kağıt-makas, altın kare, jokerler, süre, kazanma). Ekrandan ve ağdan bağımsızdır. |
| `oyun.js` | Ekranlar: menü, tahta, kartlar, pratik, kayıtlar, tek kart (QR). |
| `ag.js` | Özel link modu (PeerJS / WebRTC). Yalnızca bu mod seçilince yüklenir. |
| `index.html`, `stil.css` | Oyun sayfası ve görünümü. |
| `kartlar.html` | Basılabilir set. |
| `test/motor.test.js` | Kural testleri ve süre benzetimi: `node test/motor.test.js` |

## Bir soruyu değiştirmek veya eklemek

`sorular.js` dosyasını bir metin düzenleyiciyle (ör. Not Defteri, VS Code) açın. Her kart şu biçimdedir:

```js
{ id: '2-B2', unite: 2, konu: '2.1', tur: 'bilgi', sayfa: '77',
  soru: 'Tarım Devrimi sürecinde Güneydoğu Asya’da evcilleştirilen temel bitki hangisidir?',
  secenekler: ['Buğday', 'Mısır', 'Pirinç', 'Arpa'],
  cevap: 2,
  aciklama: 'Mezopotamya’da buğday, Güneydoğu Asya’da pirinç, Orta Amerika’da mısır evcilleştirilmiştir.' },
```

- `cevap`, doğru seçeneğin **sırasıdır** ve **0’dan başlar**: A=0, B=1, C=2, D=3.
- `tur`: `bilgi`, `kanit`, `krono`, `kavram` veya `altin`.
- Kanıt kartlarında ayrıca `kanit: '…'` (kaynak alıntısı), kronoloji kartlarında `olaylar: ['…', '…', '…']`, kavram kartlarında `kavram: '…'` ve `yasakli: ['…']` alanları vardır.
- Metin içinde tek tırnak gerekiyorsa kitaptaki gibi kesme işareti (’) kullanın; düz tırnak (') kullanılacaksa önüne ters eğik çizgi koyun: `\'`.
- Her `id` benzersiz olmalıdır. Değişiklikten sonra `index.html` ve `kartlar.html` sayfalarını yenilemek yeterlidir.

Bir ünitedeki her kart türünden en az birkaç kart bulunmalıdır; oyun o türün destesi bitince desteyi baştan karıştırmadan sırayla tekrar kullanır.

## Oyun kuralları (özet)

2 oyuncu veya 2 takım · 15 kare, 3 bölge (her bölge bir ünite) · zar yok.

1. İki taraf taş-kağıt-makas yapar; kazanan 1 kare ilerleyip o karenin rengindeki kartı cevaplar (30 sn).
2. Yanlış veya süre biterse piyon geri alınır, soru rakibe geçer; rakip bilirse kendi piyonunu 1 kare ilerletir.
3. Altın kare (3., 8., 13. kareler): zor soru; doğruysa +1 kare daha; yanlışta rakibe geçmez.
4. BİTİŞ: 15. karedeki oyuncu taş-kağıt-makası kazanınca karışık bir son soru gelir; bilirse kazanır.
5. Jokerler (birer kez): Kitaba Bak (+20 sn, kartın konusu gösterilir), Takas (kart değişir).

## Veriler ve gizlilik

Oyun hesap, isim veya kişisel bilgi toplamaz. Cevaplar (kart, konu, doğru/yanlış, süre) yalnızca o cihazdaki tarayıcıda tutulur ve **Cevap Kayıtları** ekranından CSV (Excel) olarak indirilebilir. Özel link modunda oyun verisi iki cihaz arasında doğrudan ve şifreli aktarılır; PeerJS’in ücretsiz aracı yalnızca iki cihazı ilk anda tanıştırır.
