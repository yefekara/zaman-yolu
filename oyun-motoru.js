// Zaman Yolu – oyun kuralları (ekran ve ağdan bağımsız)
// Durum düz bir nesnedir; uygula(durum, eylem, simdi) yeni durumu döndürür, eskisini değiştirmez.
// Aynı cihaz modu ve çevrim içi mod (ev sahibi) bu motoru aynı şekilde kullanır.

(function (kok) {
  const SORU_SURESI = 30000;      // ms
  const KITAP_EK_SURE = 20000;    // Kitaba Bak jokeri
  const TKM_GOSTERIM = 2600;      // başlangıçtaki taş-kağıt-makas sonucu ekranda kalır, soru süresi sonra başlar
  const SIRA_GOSTERIM = 1500;     // "Sıra X'te" ekranda kalır, soru süresi sonra başlar
  const CEVAP_GOSTERIM = 1800;    // "Yanlış! Soru rakibe geçti" ekranda kalır, rakibin süresi sonra başlar
  const KARE_SAYISI = 15;
  const BITIS = KARE_SAYISI + 1;

  // Her bölge 5 kare: 4 kart türü + ortada (3. kare) altın kare
  const BOLGE_DIZILERI = {
    1: ['bilgi', 'kanit', 'altin', 'krono', 'kavram'],
    2: ['kanit', 'kavram', 'altin', 'bilgi', 'krono'],
    3: ['krono', 'bilgi', 'altin', 'kavram', 'kanit']
  };

  // TAHTA[1..15] = { unite, tur }; 0 = BAŞLA, 16 = BİTİŞ
  const TAHTA = [null];
  [1, 2, 3].forEach(u => BOLGE_DIZILERI[u].forEach(tur => TAHTA.push({ unite: u, tur })));

  const TKM_YENER = { tas: 'makas', kagit: 'tas', makas: 'kagit' };

  function karistir(dizi, rastgele) {
    const a = dizi.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rastgele() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // BİTİŞ'e geçiş sorusu tüm ünitelerin bilgi ve kanıt kartlarından karışık gelir
  function desteAnahtari(kare) {
    if (kare === BITIS) return 'bitis';
    return TAHTA[kare].unite + '-' + TAHTA[kare].tur;
  }

  function desteleriKur(sorular, rastgele) {
    const desteler = { bitis: [] };
    sorular.forEach(q => {
      const k = q.unite + '-' + q.tur;
      (desteler[k] = desteler[k] || []).push(q.id);
      if (q.tur === 'bilgi' || q.tur === 'kanit') desteler.bitis.push(q.id);
    });
    for (const k in desteler) desteler[k] = karistir(desteler[k], rastgele);
    return desteler;
  }

  function yeniOyun(adlar, sorular, rastgele) {
    rastgele = rastgele || Math.random;
    return {
      oyuncular: adlar.map(ad => ({ ad, konum: 0, jokerler: { kitap: true, takas: true }, seri: 0 })),
      desteler: desteleriKur(sorular, rastgele),
      kullanilan: {},          // deste anahtarı -> o desteden çekilen kart sayısı
      faz: 'tkm',              // tkm (yalnızca başta, ilk başlayanı seçer) | soru | sonuc | bitti
      tkm: [null, null],
      sonTkm: null,            // { secimler, kazanan }
      tkmSayac: 0,             // biten taş-kağıt-makas sayısı (ekran sonucu bir kez göstersin diye)
      aktif: null,             // soruyu cevaplayan oyuncu
      hamleSahibi: null,       // sırası gelen oyuncu
      hedef: null,             // hamle sahibinin gideceği kare
      kart: null,
      pas: false,              // soru rakibe geçti mi
      kitapAcik: false,
      sureBitis: null,
      sonuc: null,             // { oyuncu, dogru, secilen, ilerleme, pasVar }
      kazanan: null,
      tur: 0,
      kayit: []                // { kart, oyuncu, dogru, sureMs, pas }
    };
  }

  function kartCek(d, anahtar) {
    const deste = d.desteler[anahtar];
    const n = d.kullanilan[anahtar] || 0;
    d.kullanilan[anahtar] = n + 1;
    return deste[n % deste.length];
  }

  function soruBaslat(d, simdi) {
    d.faz = 'soru';
    d.kitapAcik = false;
    d.sureBitis = simdi + SORU_SURESI;
    d.soruBaslangic = simdi;
  }

  // Sırası gelen oyuncu 1 kare ilerleyecek; o karenin kartı çekilir
  function turBaslat(d, oyuncu, simdi) {
    d.tur++;
    d.hamleSahibi = oyuncu;
    d.aktif = oyuncu;
    d.hedef = d.oyuncular[oyuncu].konum + 1;
    d.pas = false;
    d.sonuc = null;
    d.kitapAcik = false;
    d.kart = kartCek(d, desteAnahtari(d.hedef));
    soruBaslat(d, simdi);
  }

  function cevapla(d, oyuncu, secilen, sorular, simdi) {
    const kart = sorular.find(q => q.id === d.kart);
    const dogru = secilen !== null && secilen === kart.cevap;
    d.kayit.push({ kart: kart.id, oyuncu, dogru, sureMs: simdi - d.soruBaslangic, pas: d.pas });
    const o = d.oyuncular[oyuncu];
    o.seri = dogru ? o.seri + 1 : 0;

    let ilerleme = 0;
    if (!d.pas) {
      if (dogru) {
        const bonus = kart.tur === 'altin' ? 1 : 0;
        o.konum = Math.min(BITIS, d.hedef + bonus);
        ilerleme = 1 + bonus;
      } else if (kart.tur !== 'altin' && d.hedef !== BITIS) {
        // soru rakibe geçer
        d.sonuc = { oyuncu, dogru, secilen, ilerleme: 0, pasVar: true };
        d.pas = true;
        d.aktif = 1 - oyuncu;
        soruBaslat(d, simdi + CEVAP_GOSTERIM);
        return;
      }
    } else if (dogru) {
      o.konum = Math.min(BITIS - 1, o.konum + 1);
      ilerleme = 1;
    }

    d.sonuc = { oyuncu, dogru, secilen, ilerleme, pasVar: false, oncekiYanlis: d.pas };
    d.faz = 'sonuc';
    d.sureBitis = null;
    if (d.oyuncular[oyuncu].konum >= BITIS) d.kazanan = oyuncu;
  }

  function uygula(durum, eylem, sorular, simdi) {
    if (durum.faz === 'bitti') return durum;
    const d = JSON.parse(JSON.stringify(durum));
    simdi = simdi || Date.now();

    switch (eylem.tip) {
      case 'tkm': {
        if (d.faz !== 'tkm' || !TKM_YENER[eylem.secim]) return durum;
        d.tkm[eylem.oyuncu] = eylem.secim;
        if (d.tkm[0] && d.tkm[1]) {
          const [a, b] = d.tkm;
          const kazanan = a === b ? null : (TKM_YENER[a] === b ? 0 : 1);
          d.sonTkm = { secimler: [a, b], kazanan };
          d.tkmSayac = (d.tkmSayac || 0) + 1;
          d.tkm = [null, null];
          if (kazanan === null) return d;          // beraberlik: tekrar
          turBaslat(d, kazanan, simdi + TKM_GOSTERIM);
        }
        return d;
      }
      case 'cevap': {
        if (d.faz !== 'soru' || eylem.oyuncu !== d.aktif || simdi < d.soruBaslangic) return durum;
        cevapla(d, eylem.oyuncu, eylem.secilen, sorular, simdi);
        return d;
      }
      case 'sure': {
        if (d.faz !== 'soru' || simdi < d.sureBitis) return durum;
        cevapla(d, d.aktif, null, sorular, simdi);
        return d;
      }
      case 'joker': {
        if (d.faz !== 'soru' || eylem.oyuncu !== d.aktif || simdi < d.soruBaslangic) return durum;
        const j =d.oyuncular[eylem.oyuncu].jokerler;
        if (!j[eylem.ad]) return durum;
        if (eylem.ad === 'kitap') {
          j.kitap = false;
          d.kitapAcik = true;
          d.sureBitis += KITAP_EK_SURE;
        } else if (eylem.ad === 'takas') {
          if (d.pas) return durum;                 // rakibe geçen soru değiştirilemez
          j.takas = false;
          d.kart = kartCek(d, desteAnahtari(d.hedef));
          soruBaslat(d, simdi);
        }
        return d;
      }
      case 'devam': {
        if (d.faz !== 'sonuc') return durum;
        if (d.kazanan !== null) { d.faz = 'bitti'; return d; }
        // sıra, bu turu oynayanın rakibine geçer (soru rakibe geçmiş olsa da)
        turBaslat(d, 1 - d.hamleSahibi, simdi + SIRA_GOSTERIM);
        return d;
      }
    }
    return durum;
  }

  // Çevrim içi modda karşı tarafa gönderilmeden önce rakibin gizli taş-kağıt-makas seçimi saklanır
  function maskele(durum, gorenOyuncu) {
    const d = JSON.parse(JSON.stringify(durum));
    d.tkm = d.tkm.map((s, i) => (i === gorenOyuncu ? s : (s ? 'secildi' : null)));
    return d;
  }

  const motor = { yeniOyun, uygula, maskele, TAHTA, BITIS, KARE_SAYISI, SORU_SURESI, KITAP_EK_SURE, TKM_GOSTERIM, SIRA_GOSTERIM, CEVAP_GOSTERIM, TKM_YENER, desteAnahtari };
  if (typeof module !== 'undefined') module.exports = motor;
  else kok.ZamanYoluMotor = motor;
})(this);
