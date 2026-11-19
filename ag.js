// Zaman Yolu – özel linkle oynama (PeerJS / WebRTC, kendi sunucumuz yok)
// Odayı kuran (ev sahibi) oyun durumunu tutar; misafir yalnızca eylem gönderir ve gelen durumu çizer.
// PeerJS yalnızca bu mod seçildiğinde yüklenir; diğer modlar internetsiz çalışır.

(function (kok) {
  const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const ON_EK = 'zamanyolu-';
  const KOD_HARFLERI = 'ABCDEFGHJKLMNPRSTUVYZ23456789';

  const yuklenenler = {};
  function scriptYukle(url) {
    if (!yuklenenler[url]) {
      yuklenenler[url] = new Promise((coz, reddet) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = coz;
        s.onerror = () => { delete yuklenenler[url]; reddet(new Error('Kütüphane yüklenemedi. İnternet bağlantısını kontrol edin.')); };
        document.head.appendChild(s);
      });
    }
    return yuklenenler[url];
  }

  function odaKoduUret() {
    let kod = '';
    for (let i = 0; i < 6; i++) kod += KOD_HARFLERI[Math.floor(Math.random() * KOD_HARFLERI.length)];
    return kod;
  }

  function hataMetni(err) {
    const tur = err && err.type;
    if (tur === 'peer-unavailable') return 'Oda bulunamadı. Oda kapanmış veya kod yanlış olabilir.';
    if (tur === 'unavailable-id') return 'Bu oda kodu kullanımda.';
    if (tur === 'network' || tur === 'server-error' || tur === 'socket-error') return 'Bağlantı sunucusuna ulaşılamadı. İnternet veya okul ağı engelliyor olabilir.';
    if (tur === 'browser-incompatible') return 'Bu tarayıcı çevrim içi modu desteklemiyor.';
    return 'Bağlantı hatası: ' + ((err && (err.message || err.type)) || 'bilinmiyor');
  }

  // Ev sahibi: odayı açar, yalnızca ilk misafiri (veya aynı adla geri dönen misafiri) kabul eder
  async function evSahibi(kod, olay) {
    await scriptYukle(PEERJS_URL);
    const peer = new Peer(ON_EK + kod);
    let baglanti = null;
    let misafirAdi = null;

    peer.on('open', () => olay.acildi && olay.acildi());
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') return;
      olay.hata && olay.hata(hataMetni(err), err.type);
    });
    peer.on('connection', conn => {
      conn.on('data', veri => {
        if (veri && veri.tip === 'katil') {
          if (misafirAdi === null || veri.ad === misafirAdi) {
            if (baglanti && baglanti !== conn) baglanti.close();
            baglanti = conn;
            misafirAdi = veri.ad;
            olay.misafir && olay.misafir(veri.ad, veri.renk);
          } else {
            conn.send({ tip: 'dolu' });
            setTimeout(() => conn.close(), 500);
          }
          return;
        }
        if (conn === baglanti && veri && veri.tip === 'eylem') olay.eylem && olay.eylem(veri.eylem);
      });
      conn.on('close', () => {
        if (conn === baglanti) { baglanti = null; olay.kopma && olay.kopma(); }
      });
    });

    return {
      gonder(veri) { if (baglanti && baglanti.open) baglanti.send(veri); },
      kapat() { peer.destroy(); }
    };
  }

  // Misafir: odaya bağlanır, eylem gönderir, ev sahibinden durum alır
  async function misafir(kod, ad, olay, renk) {
    await scriptYukle(PEERJS_URL);
    const peer = new Peer();
    let baglanti = null;

    peer.on('error', err => olay.hata && olay.hata(hataMetni(err), err.type));
    peer.on('open', () => {
      baglanti = peer.connect(ON_EK + kod, { reliable: true });
      baglanti.on('open', () => {
        baglanti.send({ tip: 'katil', ad, renk });
        olay.baglandi && olay.baglandi();
      });
      baglanti.on('data', veri => {
        if (!veri) return;
        if (veri.tip === 'durum') olay.durum && olay.durum(veri.durum, veri.zaman);
        else if (veri.tip === 'dolu') olay.dolu && olay.dolu();
      });
      baglanti.on('close', () => olay.kopma && olay.kopma());
    });

    return {
      gonder(eylem) { if (baglanti && baglanti.open) baglanti.send({ tip: 'eylem', eylem }); },
      kapat() { peer.destroy(); }
    };
  }

  kok.ZamanYoluAg = { scriptYukle, odaKoduUret, evSahibi, misafir };
})(this);
