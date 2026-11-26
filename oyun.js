// Zaman Yolu – ekranlar ve oyun akışı
(function () {
  const M = ZamanYoluMotor;
  const Ag = ZamanYoluAg;
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const KAYIT_ANAHTARI = 'zamanyolu-kayit';

  const TUR = {
    bilgi:  { ad: 'BİLGİ', renk: 'var(--bilgi)' },
    kanit:  { ad: 'KANIT', renk: 'var(--kanit)' },
    krono:  { ad: 'KRONOLOJİ', renk: 'var(--krono)' },
    kavram: { ad: 'KAVRAM', renk: 'var(--kavram)' },
    altin:  { ad: 'ALTIN SORU', renk: 'var(--altin)' }
  };
  const TKM = { tas: { ad: 'Taş', ikon: '✊' }, kagit: { ad: 'Kağıt', ikon: '✋' }, makas: { ad: 'Makas', ikon: '✌️' } };
  const TKM_TUSLARI = { a: [0, 'tas'], s: [0, 'kagit'], d: [0, 'makas'], j: [1, 'tas'], k: [1, 'kagit'], l: [1, 'makas'] };
  // Piyon renkleri (kurulumda seçilir)
  const RENKLER = [
    { ad: 'Kırmızı', kod: '#c8463c' }, { ad: 'Mavi', kod: '#2f6db5' }, { ad: 'Yeşil', kod: '#2a8a4a' },
    { ad: 'Mor', kod: '#7b4bb8' }, { ad: 'Turuncu', kod: '#e07b1a' }, { ad: 'Pembe', kod: '#d6457f' },
    { ad: 'Turkuaz', kod: '#14898f' }, { ad: 'Siyah', kod: '#2b2f3a' }
  ];
  const PIYON_YOLU = 'M-8 0 Q-8 -4 -5 -5 L-3 -12 Q-7 -14 -6 -19 Q-4 -24 0 -24 Q4 -24 6 -19 Q7 -14 3 -12 L5 -5 Q8 -4 8 0 Z';
  const VARSAYILAN_AD = new RegExp('^(' + RENKLER.map(r => r.ad).join('|') + ') Takım$');
  const HARF = ['A', 'B', 'C', 'D'];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const soruBul = id => SORULAR.find(q => q.id === id);

  // ─── durum ───
  let durum = null;
  let mod = null;               // yerel | bot | ev | misafir
  let baglanti = null;
  let saatFarki = 0;            // misafir: yerel saat - ev sahibi saati
  let kaydedilen = 0;           // durum.kayit içinden kalıcı kayda yazılan sayısı
  let botZamanlayici = null;
  let kopukMesaj = null;
  let sonKurulumModu = 'yerel';
  let benimAdim = '';
  let benimRengim = '';
  let gosterilenTkm = null;     // ekranda sonucu gösterilen son taş-kağıt-makas (durum.tkmSayac)
  let gosterilenCevap = 0;      // ekranda sonucu gösterilen cevap sayısı (durum.kayit.length)
  let gosterilenTur = 0;        // ekranda "Sıra X'te" gösterilen son tur (durum.tur)
  let perdeAcik = false;
  let perdeZamanlayici = null;
  let sonPanelAnahtari = '';

  // ─── yardımcılar ───
  function ekranGoster(id) {
    document.querySelectorAll('.ekran').forEach(e => e.classList.toggle('gizli', e.id !== id));
    window.scrollTo(0, 0);
  }

  function kayitlariOku() {
    try { return JSON.parse(localStorage.getItem(KAYIT_ANAHTARI)) || []; } catch (e) { return []; }
  }
  function kayitEkle(liste) {
    if (!liste.length) return;
    try { localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify(kayitlariOku().concat(liste))); } catch (e) { /* kayıt tutulamıyor */ }
  }
  function kayitSatiri(q, dogru, sureMs, kaynakMod, oyuncuNo) {
    return { zaman: new Date().toISOString(), mod: kaynakMod, oyuncu: oyuncuNo, kart: q.id, unite: q.unite,
      konu: q.konu, tur: q.tur, dogru: dogru ? 1 : 0, sureSn: Math.round(sureMs / 100) / 10 };
  }

  function benimMi(oyuncu) {
    if (mod === 'yerel') return true;
    if (mod === 'misafir') return oyuncu === 1;
    return oyuncu === 0;  // bot ve ev
  }

  function renk(i) { return (durum && durum.oyuncular[i].renk) || RENKLER[i].kod; }

  // Rakip aynı rengi seçtiyse listedeki ilk farklı renk verilir
  function farkliRenk(istenen, dolu) {
    return istenen && istenen !== dolu ? istenen : RENKLER.find(r => r.kod !== dolu).kod;
  }

  // Renk seçici: kutucuğa tıklanınca seçilir; ad kutusu hâlâ "… Takım" ise ad da renge uyar
  function renkSeciciKur(kutu, seciliKod, adKutusu, digerKutu) {
    kutu.innerHTML = `<svg class="renk-piyon" viewBox="-14 -28 28 32" aria-hidden="true"><ellipse cx="0" cy="0" rx="10" ry="3.5" fill="#000" opacity=".15"/>
        <path d="${PIYON_YOLU}" stroke="#fff" stroke-width="1.5"/><circle cx="-2" cy="-20" r="1.8" fill="#fff" opacity=".6"/></svg>
      <div class="renkler">` +
      RENKLER.map(r => `<button type="button" class="renk" data-renk-sec="${r.kod}" title="${r.ad}" style="background:${r.kod}"></button>`).join('') + '</div>';
    kutu.dataset.secili = seciliKod;
    const isaretle = () => {
      kutu.querySelectorAll('.renk').forEach(b => b.classList.toggle('secili', b.dataset.renkSec === kutu.dataset.secili));
      const piyon = kutu.querySelector('.renk-piyon');
      piyon.querySelector('path').setAttribute('fill', kutu.dataset.secili);
      piyon.classList.remove('zipla'); void piyon.getBoundingClientRect(); piyon.classList.add('zipla');
    };
    isaretle();
    kutu.onclick = e => {
      const b = e.target.closest('[data-renk-sec]');
      if (!b) return;
      const eski = kutu.dataset.secili, yeni = b.dataset.renkSec;
      kutu.dataset.secili = yeni;
      isaretle();
      if (adKutusu && (VARSAYILAN_AD.test(adKutusu.value.trim()) || !adKutusu.value.trim())) {
        adKutusu.value = RENKLER.find(r => r.kod === yeni).ad + ' Takım';
      }
      // aynı ekrandaki diğer oyuncu bu rengi seçmişse renkler yer değiştirir
      if (digerKutu && digerKutu.dataset.secili === yeni) digerKutu.querySelector(`[data-renk-sec="${eski}"]`).click();
    };
  }

  function simdi() { return mod === 'misafir' ? Date.now() - saatFarki : Date.now(); }

  // ─── oyun akışı ───
  function oyunuBaslat(adlar, yeniMod, renkler) {
    mod = yeniMod;
    durum = M.yeniOyun(adlar, SORULAR);
    const r0 = (renkler && renkler[0]) || RENKLER[0].kod;
    durum.oyuncular[0].renk = r0;
    durum.oyuncular[1].renk = farkliRenk(renkler && renkler[1], r0);
    kaydedilen = 0;
    kopukMesaj = null;
    perdeyiKapat();
    gosterilenTkm = null;
    ekranGoster('oyun');
    durumDegisti();
  }

  function eylem(e) {
    if (!durum) return;
    if (mod === 'misafir') { baglanti && baglanti.gonder(e); return; }
    const yeni = M.uygula(durum, e, SORULAR, Date.now());
    if (yeni === durum) return;
    durum = yeni;
    durumDegisti();
  }

  function durumDegisti() {
    kayitlariIsle();
    ciz();
    if (mod === 'ev' && baglanti) baglanti.gonder({ tip: 'durum', durum: M.maskele(durum, 1), zaman: Date.now() });
    botPlanla();
  }

  function kayitlariIsle() {
    if (durum.kayit.length < kaydedilen) kaydedilen = 0;
    const yeni = durum.kayit.slice(kaydedilen)
      .filter(k => benimMi(k.oyuncu))
      .map(k => kayitSatiri(soruBul(k.kart), k.dogru, k.sureMs, mod === 'ev' || mod === 'misafir' ? 'cevrimici' : mod, k.oyuncu + 1));
    kaydedilen = durum.kayit.length;
    kayitEkle(yeni);
  }

  function botPlanla() {
    clearTimeout(botZamanlayici);
    if (mod !== 'bot' || !durum) return;
    if (durum.faz === 'tkm' && durum.tkm[0] && !durum.tkm[1]) {
      // Başlangıçtaki taş-kağıt-makasta bilgisayar rastgele seçer. Seçim hemen yapılır,
      // böylece oyuncu "rakip bekleniyor" ekranında beklemez.
      eylem({ tip: 'tkm', oyuncu: 1, secim: Object.keys(TKM)[Math.floor(Math.random() * 3)] });
    } else if (durum.faz === 'soru' && durum.aktif === 1) {
      const gosterim = Math.max(0, durum.soruBaslangic - Date.now());
      botZamanlayici = setTimeout(() => {
        const q = soruBul(durum.kart);
        // Bilgisayar soruların %60'ını bilir. Oyuncudan öndeyse her kare fark için %5 daha az
        // bilir (en az %40): 1 kare önde %55 · 2 kare %50 · 4+ kare %40
        const fark = Math.max(0, durum.oyuncular[1].konum - durum.oyuncular[0].konum);
        const dogru = Math.random() < Math.max(0.4, 0.6 - 0.05 * fark);
        const secilen = dogru ? q.cevap : (q.cevap + 1 + Math.floor(Math.random() * 3)) % 4;
        eylem({ tip: 'cevap', oyuncu: 1, secilen });
      }, gosterim + 2500 + Math.random() * 2500);
    }
  }

  // süre takibi
  setInterval(() => {
    if (!durum || durum.faz !== 'soru') return;
    const kalan = durum.sureBitis - simdi();
    const cubuk = document.querySelector('#panel .sure');
    if (cubuk) {
      const toplam = M.SORU_SURESI + (durum.kitapAcik ? M.KITAP_EK_SURE : 0);
      cubuk.querySelector('i').style.width = Math.max(0, Math.min(100, kalan / toplam * 100)) + '%';
      cubuk.classList.toggle('az', kalan < 8000);
      const yazi = document.querySelector('#panel .kalan');
      if (yazi) yazi.textContent = Math.max(0, Math.ceil(Math.min(kalan, toplam) / 1000)) + ' sn';
    }
    if (kalan <= 0 && mod !== 'misafir') eylem({ tip: 'sure' });
  }, 200);

  // ─── çizim ───
  function ciz() {
    if (!durum) return;
    perdeleriDenetle();
    oyunculariCiz();
    tahtayiCiz();
    paneliCiz();
  }

  // ─── sonuç perdesi: taş-kağıt-makas, sıra ve cevap sonuçları kartın önünde büyük gösterilir ───
  function perdeleriDenetle() {
    const n = durum.tkmSayac || 0, c = durum.kayit.length, t = durum.tur;
    if (gosterilenTkm === null || n < gosterilenTkm || c < gosterilenCevap || t < gosterilenTur) {   // oyuna yeni girildi
      gosterilenTkm = n; gosterilenCevap = c; gosterilenTur = t; return;
    }
    if (n > gosterilenTkm && durum.sonTkm) {
      gosterilenTkm = n;
      gosterilenTur = t;                 // ilk turun sırası taş-kağıt-makas perdesinde yazar
      tkmSonucunuGoster(durum.sonTkm);
    }
    if (t > gosterilenTur && durum.faz === 'soru') {
      gosterilenTur = t;
      siraGoster();
    }
    if (c > gosterilenCevap && durum.sonuc) {
      gosterilenCevap = c;
      cevapSonucunuGoster();
    }
  }

  function perdeAc(html, sure) {
    const perde = $('tkm-perde'), panel = $('panel');
    perde.innerHTML = html;
    perde.style.minHeight = Math.max(panel.offsetHeight, 280) + 'px';
    panel.classList.add('gizli');
    perde.classList.remove('gizli');
    perde.classList.remove('giris'); void perde.offsetWidth; perde.classList.add('giris');
    perdeAcik = true;
    clearTimeout(perdeZamanlayici);
    perdeZamanlayici = setTimeout(perdeyiKapat, sure);
  }

  function cevapSonucunuGoster() {
    const ad = i => esc(durum.oyuncular[i].ad);
    const s = durum.sonuc, o = s.oyuncu, q = soruBul(durum.kart);
    const yerel = mod === 'yerel', benim = benimMi(o);
    const sureDoldu = s.secilen === null;
    const hata = sureDoldu ? 'Süre doldu!' : 'Yanlış!';
    let ikon, yazi, sinif, alt;

    if (durum.faz === 'soru' && durum.pas) {                 // soru rakibe geçti
      const alan = durum.aktif;
      ikon = sureDoldu ? '⏰' : '✘';
      if (!yerel && benimMi(alan)) {
        ikon = '↪'; yazi = 'Soru sana geçti!'; sinif = 'firsat';
        alt = `${ad(o)} ${sureDoldu ? 'süreyi doldurdu' : 'bilemedi'}. Bilirsen 1 kare ilerlersin!`;
      } else {
        yazi = hata; sinif = 'kaybetti';
        alt = `Soru <b>${ad(alan)}</b> tarafına geçti! Bilirse 1 kare ilerler.`;
      }
      perdeAc(perdeHTML(ikon, sinif, yazi, alt, o), Math.max(1200, durum.soruBaslangic - simdi()));
      return;
    }

    if (durum.kazanan !== null) {
      ikon = '🏁';
      yazi = yerel ? `${ad(o)} kazandı!` : (benim ? 'Oyunu kazandın!' : 'Oyunu kaybettin!');
      sinif = yerel || benim ? 'kazandi' : 'kaybetti';
      alt = `${ad(o)} BİTİŞ’e ulaştı`;
    } else if (s.dogru) {
      ikon = '✔';
      yazi = yerel || benim ? 'Doğru!' : `${ad(o)} bildi!`;
      sinif = yerel || benim ? 'kazandi' : 'kaybetti';
      alt = s.oncekiYanlis ? `${ad(o)} soruyu kaptı, 1 kare ilerliyor`
        : q.tur === 'altin' ? `Altın soru! ${ad(o)} 2 kare ilerliyor ★` : `${ad(o)} 1 kare ilerliyor`;
    } else {
      ikon = sureDoldu ? '⏰' : '✘';
      yazi = yerel || benim ? hata : `${ad(o)} bilemedi`;
      sinif = yerel || benim ? 'kaybetti' : 'berabere';
      alt = q.tur === 'altin' && !s.oncekiYanlis ? 'Altın soru rakibe geçmez. Kimse ilerlemedi.' : 'Kimse ilerlemedi.';
    }
    perdeAc(perdeHTML(ikon, sinif, yazi, alt, o), 1800);
  }

  function perdeHTML(ikon, sinif, yazi, alt, oyuncu) {
    return `<div class="perde-ikon ${sinif}">${ikon}</div>
      <div class="el-ad" style="color:${renk(oyuncu)}">${esc(durum.oyuncular[oyuncu].ad)}</div>
      <div class="perde-yazi ${sinif}">${yazi}</div><div class="perde-alt">${alt}</div>`;
  }

  function siraGoster() {
    const i = durum.aktif, h = durum.hedef;
    const yazi = mod === 'yerel' ? 'Sıra sizde!' : (benimMi(i) ? 'Sıra sende!' : 'Sıra rakipte');
    const alt = h >= M.BITIS ? 'BİTİŞ sorusu' : h + '. karenin sorusu' + (M.TAHTA[h].tur === 'altin' ? ' · Altın soru ★' : '');
    perdeAc(`<div class="perde-ikon sira" style="background:${renk(i)}">➜</div>
      <div class="el-ad" style="color:${renk(i)}">${esc(durum.oyuncular[i].ad)}</div>
      <div class="perde-yazi sira" style="background:${renk(i)}">${yazi}</div><div class="perde-alt">${alt}</div>`,
      Math.max(1000, durum.soruBaslangic - simdi()));
  }

  function tkmSonucunuGoster(s) {
    const ad = i => esc(durum.oyuncular[i].ad);
    const k = s.kazanan;
    let yazi, sinif, alt;
    if (k === null) {
      yazi = 'Berabere!'; sinif = 'berabere'; alt = 'İkiniz de aynı şeyi seçtiniz. Tekrar!';
    } else {
      if (mod === 'yerel') { yazi = `${ad(k)} kazandı!`; sinif = 'kazandi'; }
      else if (benimMi(k)) { yazi = 'Kazandın!'; sinif = 'kazandi'; }
      else { yazi = 'Kaybettin!'; sinif = 'kaybetti'; }
      const hedef = durum.oyuncular[k].konum + 1;
      alt = `${ad(k)} oyuna başlıyor ve ${hedef}. karenin sorusunu cevaplayacak. Sonra sırayla oynanır.`;
    }
    const el = i => {
      const durumSinifi = k === null ? '' : (k === i ? 'kazanan-el' : 'kaybeden-el');
      return `<div class="perde-el ${i ? 'sag' : 'sol'} ${durumSinifi}">
        <div class="ikon">${TKM[s.secimler[i]].ikon}</div>
        <div class="el-ad" style="color:${renk(i)}">${ad(i)}</div>
        <div class="not">${TKM[s.secimler[i]].ad}</div></div>`;
    };
    perdeAc(`<div class="perde-eller">${el(0)}<div class="vs">VS</div>${el(1)}</div>
      <div class="perde-yazi ${sinif}">${yazi}</div><div class="perde-alt">${alt}</div>`,
      k === null ? 1700 : Math.max(1500, durum.soruBaslangic - simdi()));
  }

  function perdeyiKapat() {
    clearTimeout(perdeZamanlayici);
    perdeAcik = false;
    $('tkm-perde').classList.add('gizli');
    $('panel').classList.remove('gizli');
  }

  function konumYazisi(k) {
    if (k === 0) return 'BAŞLA';
    if (k >= M.BITIS) return 'BİTİŞ 🏁';
    return k + '. kare';
  }

  function oyunculariCiz() {
    const sirada = durum.faz === 'soru' ? durum.aktif : null;
    $('oyuncular').innerHTML = durum.oyuncular.map((o, i) => `
      <div class="oyuncu ${sirada === i ? 'sirada' : ''}" style="color:${renk(i)}">
        <div>
          <div class="ad"><span class="nokta" style="background:${renk(i)}"></span><span style="color:var(--ink)">${esc(o.ad)}${benimMi(i) && (mod === 'ev' || mod === 'misafir') ? ' (sen)' : ''}</span></div>
          <div class="bilgi">${konumYazisi(o.konum)}${o.seri >= 2 ? ' · 🔥 ' + o.seri + ' doğru üst üste' : ''}</div>
        </div>
        <div class="jokerler">
          <span class="joker ${o.jokerler.kitap ? '' : 'kullanildi'}" title="Kitaba Bak">📖</span>
          <span class="joker ${o.jokerler.takas ? '' : 'kullanildi'}" title="Takas">🔄</span>
        </div>
      </div>`).join('');
  }

  // Tahta: kıvrılan bir yol; her bölge (ünite) bir şerit, 5'er kare
  const SATIR_Y = [80, 180, 280];
  const SUTUN_X = [120, 185, 250, 315, 380];
  function kareKonumu(k) {
    if (k === 0) return { x: 50, y: SATIR_Y[0] };
    if (k >= M.BITIS) return { x: 456, y: SATIR_Y[2] };
    const satir = Math.floor((k - 1) / 5), sutun = (k - 1) % 5;
    return { x: SUTUN_X[satir === 1 ? 4 - sutun : sutun], y: SATIR_Y[satir] };
  }

  // Bölge simgeleri (0,0 merkezli, yaklaşık 40 birim)
  const BOLGE_SIMGE = {
    // parşömen ve büyüteç
    1: '<path d="M-20 -12h26a6 6 0 0 1 0 12h-2v14h-26a6 6 0 0 1 0-12h2z"/><circle cx="12" cy="6" r="8" fill="none" stroke-width="3.5"/><path d="M17 12l8 8" stroke-width="4" stroke-linecap="round"/>',
    // ziggurat ve piramit
    2: '<path d="M-24 16h28v-6h-4v-7h-4v-7h-12v7h-4v7h-4z"/><path d="M4 16l12-26 12 26z"/>',
    // kervansaray kapısı ve kubbe
    3: '<path d="M-22 16v-18h44v18h-14v-10a8 8 0 0 0-16 0v10z"/><path d="M-12 -2a12 12 0 0 1 24 0z"/>'
  };

  function tahtaIskeleti() {
    const bolgeRenk = ['', '#e8eef6', '#f7ebdd', '#e3f1ea'];
    const bolgeCizgi = ['', '#3d5a80', '#b5651d', '#2a7f62'];
    let s = `<svg viewBox="0 0 500 362" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial" data-tahta>
      <defs>
        <filter id="golge" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".28"/></filter>
        <radialGradient id="altin-isilti"><stop offset="0" stop-color="#ffe680" stop-opacity=".9"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
        <linearGradient id="altin-dolgu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2d16b"/><stop offset="1" stop-color="#b8891a"/></linearGradient>
        <pattern id="dama" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#1f2430"/><rect x="4" y="4" width="4" height="4" fill="#1f2430"/></pattern>
      </defs>
      <rect x="0" y="0" width="500" height="362" rx="16" fill="#fbf6ea"/>`;
    // bölge şeritleri
    SATIR_Y.forEach((y, i) => {
      const u = i + 1, sag = u === 3;
      s += `<rect x="8" y="${y - 54}" width="484" height="98" rx="14" fill="${bolgeRenk[u]}"/>`;
      s += `<g transform="translate(${sag ? 300 : 200} ${y + 2}) scale(1.6)" fill="${bolgeCizgi[u]}" stroke="${bolgeCizgi[u]}" opacity=".07">${BOLGE_SIMGE[u]}</g>`;
      const etiket = `${esc(UNITELER[u].bolge.toLocaleUpperCase('tr'))} · ÜNİTE ${u}`;
      const ex = sag ? 484 : 16;
      s += `<g transform="translate(${sag ? ex - 8 : ex + 8} ${y - 44}) scale(.3)" fill="${bolgeCizgi[u]}" stroke="${bolgeCizgi[u]}">${BOLGE_SIMGE[u]}</g>`;
      s += `<text x="${sag ? ex - 20 : ex + 20}" y="${y - 40}" font-size="9" font-weight="700" letter-spacing=".06em" fill="${bolgeCizgi[u]}" text-anchor="${sag ? 'end' : 'start'}">${etiket}</text>`;
    });
    // yol
    const [y1, y2, y3] = SATIR_Y;
    const yol = `M50 ${y1} H420 A50 50 0 0 1 420 ${y2} H80 A50 50 0 0 0 80 ${y3} H456`;
    s += `<path d="${yol}" fill="none" stroke="#cdbb93" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${yol}" fill="none" stroke="#efe3c6" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${yol}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 7" opacity=".9"/>`;
    // başla ve bitiş
    const bas = kareKonumu(0), bit = kareKonumu(M.BITIS);
    s += `<g filter="url(#golge)"><rect x="${bas.x - 30}" y="${bas.y - 17}" width="60" height="34" rx="17" fill="#1f2430"/></g>
      <text x="${bas.x}" y="${bas.y + 4}" font-size="11" fill="#fff" text-anchor="middle" font-weight="800" letter-spacing=".05em">BAŞLA</text>`;
    s += `<g filter="url(#golge)"><rect x="${bit.x - 28}" y="${bit.y - 22}" width="56" height="44" rx="10" fill="url(#dama)" stroke="#1f2430" stroke-width="2"/></g>
      <rect x="${bit.x - 24}" y="${bit.y - 8}" width="48" height="16" rx="4" fill="#1f2430"/>
      <text x="${bit.x}" y="${bit.y + 4}" font-size="10" fill="#fff" text-anchor="middle" font-weight="800" letter-spacing=".05em">BİTİŞ</text>`;
    // hedef halkası (soru sorulan kare)
    s += '<g data-hedef class="hedef-halka" style="display:none"><circle r="29" fill="none" stroke-width="4"/></g>';
    // kareler
    for (let k = 1; k <= M.KARE_SAYISI; k++) {
      const p = kareKonumu(k), t = M.TAHTA[k].tur;
      if (t === 'altin') {
        s += `<circle cx="${p.x}" cy="${p.y}" r="34" fill="url(#altin-isilti)" class="altin-isilti"/>
          <g filter="url(#golge)"><circle cx="${p.x}" cy="${p.y}" r="22" fill="url(#altin-dolgu)" stroke="#fff" stroke-width="3"/></g>
          <text x="${p.x}" y="${p.y + 7}" font-size="21" fill="#fff" text-anchor="middle">★</text>
          <circle cx="${p.x + 16}" cy="${p.y - 16}" r="8" fill="#fff" stroke="#b8891a" stroke-width="1.5"/>
          <text x="${p.x + 16}" y="${p.y - 12.5}" font-size="9" fill="#8a6510" text-anchor="middle" font-weight="800">${k}</text>`;
      } else {
        s += `<g filter="url(#golge)"><circle cx="${p.x}" cy="${p.y}" r="20" fill="${TUR[t].renk}" stroke="#fff" stroke-width="3"/></g>
          <circle cx="${p.x}" cy="${p.y}" r="14" fill="none" stroke="#fff" stroke-width="1" opacity=".35"/>
          <text x="${p.x}" y="${p.y + 5.5}" font-size="15" fill="#fff" text-anchor="middle" font-weight="800">${k}</text>`;
      }
    }
    // piyonlar
    [0, 1].forEach(i => {
      s += `<g data-piyon="${i}" class="piyon" filter="url(#golge)">
        <ellipse cx="0" cy="0" rx="9" ry="3.5" fill="#000" opacity=".18"/>
        <path d="${PIYON_YOLU}" fill="#888" stroke="#fff" stroke-width="2" data-govde/>
        <circle cx="-2" cy="-20" r="1.8" fill="#fff" opacity=".6"/></g>`;
    });
    // açıklama
    const lejant = [['bilgi', 'Bilgi'], ['kanit', 'Kanıt'], ['krono', 'Kronoloji'], ['kavram', 'Kavram'], ['altin', '★ Altın (+1)']];
    lejant.forEach(([t, ad], i) => {
      const x = 40 + i * 88;
      s += `<circle cx="${x}" cy="346" r="6" fill="${t === 'altin' ? 'url(#altin-dolgu)' : TUR[t].renk}"/><text x="${x + 11}" y="350" font-size="10.5" fill="#5b6170">${ad}</text>`;
    });
    return s + '</svg>';
  }

  // Tahta bir kez çizilir; piyonlar ve hedef halkası yerinde güncellenir, böylece piyonlar kayarak ilerler
  function tahtayiCiz() {
    let svg = $('tahta').querySelector('svg[data-tahta]');
    if (!svg) { $('tahta').innerHTML = tahtaIskeleti(); svg = $('tahta').querySelector('svg'); }
    const ayni = durum.oyuncular[0].konum === durum.oyuncular[1].konum;
    durum.oyuncular.forEach((o, i) => {
      const p = kareKonumu(o.konum);
      const dx = ayni || o.konum === 0 || o.konum >= M.BITIS ? (i === 0 ? -11 : 11) : 0;
      const dy = o.konum === 0 || o.konum >= M.BITIS ? -18 : -14;
      const piyon = svg.querySelector(`[data-piyon="${i}"]`);
      piyon.style.transform = `translate(${p.x + dx}px, ${p.y + dy}px)`;
      piyon.querySelector('[data-govde]').setAttribute('fill', renk(i));
    });
    const halka = svg.querySelector('[data-hedef]');
    const hedefVar = durum.faz === 'soru' && !durum.pas && durum.hedef && durum.hedef <= M.KARE_SAYISI;
    halka.style.display = hedefVar ? '' : 'none';
    if (hedefVar) {
      const p = kareKonumu(durum.hedef);
      halka.setAttribute('transform', `translate(${p.x} ${p.y})`);
      halka.querySelector('circle').setAttribute('stroke', renk(durum.aktif));
    }
  }

  // Kart görünümü: secilebilir → cevap butonları tıklanabilir; cevapGoster → doğru/yanlış işaretlenir
  function kartHTML(q, o = {}) {
    const t = TUR[q.tur];
    let ic = '';
    if (q.kanit) ic += `<div class="kanit-metni">${esc(q.kanit)}</div>`;
    if (q.tur === 'kavram' && o.kavramGoster) {
      ic += `<div class="kavram-kelime">${esc(q.kavram)}</div><div class="yasakli">Yasaklı kelimeler: ${q.yasakli.map(esc).join(' · ')}</div>`;
    }
    ic += `<div class="soru">${esc(q.soru)}</div>`;
    if (q.olaylar) ic += `<ol class="olaylar">${q.olaylar.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
    ic += '<div class="secenekler">' + q.secenekler.map((sec, i) => {
      let sinif = '';
      if (o.cevapGoster) sinif = i === q.cevap ? 'dogru' : (i === o.secilen ? 'yanlis' : '');
      const aktif = o.secilebilir && !o.cevapGoster;
      return `<button data-cevap="${i}" class="${sinif}" ${aktif ? '' : 'disabled'}><b>${HARF[i]})</b> ${esc(sec)}</button>`;
    }).join('') + '</div>';
    const bolge = UNITELER[q.unite].bolge;
    return `<div class="kart" style="border-color:${t.renk}">
      <div class="kart-ust" style="background:${t.renk}"><span>${t.ad}</span><small>Ünite ${q.unite} · ${esc(bolge)}${o.konuGoster ? ' · ' + q.konu : ''}</small></div>
      <div class="kart-govde">${o.ust || ''}${ic}${o.alt || ''}</div></div>`;
  }

  function aciklamaHTML(q) {
    return `<div class="aciklama">${esc(q.aciklama)}<div class="not" style="margin-top:4px">📖 Ders kitabı s. ${esc(q.sayfa)} · ${q.konu} ${esc(KONULAR[q.konu])}</div></div>`;
  }

  function paneliCiz() {
    const d = durum, ad = i => esc(d.oyuncular[i].ad);
    let h = '';
    if (kopukMesaj) h += `<div class="uyari">${kopukMesaj}</div>`;

    if (d.faz === 'tkm') {
      if (d.sonTkm) {
        const [a, b] = d.sonTkm.secimler;
        h += `<div class="tkm-sonuc">${ad(0)} ${TKM[a].ikon} — ${TKM[b].ikon} ${ad(1)} → <b>Berabere, tekrar!</b></div>`;
      }
      h += '<div class="durum-yazi">Kim başlayacak? Taş, kağıt, makas! Kazanan ilk turu oynar, sonra sırayla devam edilir.</div>';
      const taraflar = mod === 'yerel' ? [0, 1] : [mod === 'misafir' ? 1 : 0];
      h += `<div class="tkm-alan ${taraflar.length === 1 ? 'tek' : ''}">` + taraflar.map(i => {
        const tuslar = i === 0 ? 'A · S · D' : 'J · K · L';
        const ic = d.tkm[i]
          ? '<div class="secildi">Seçildi ✓<br><span class="not">Rakip bekleniyor…</span></div>'
          : `<div class="tkm-butonlar">${Object.entries(TKM).map(([k, v]) => `<button data-tkm="${k}" data-oyuncu="${i}">${v.ikon}<small>${v.ad}</small></button>`).join('')}</div>` +
            (mod === 'yerel' ? `<div class="tus-ipucu">Klavye: ${tuslar}</div>` : '');
        return `<div class="tkm-taraf" style="border-color:${renk(i)}"><h3 style="color:${renk(i)}">${ad(i)}</h3>${ic}</div>`;
      }).join('') + '</div>';
      if (mod !== 'yerel') {
        const rakip = mod === 'misafir' ? 0 : 1;
        h += `<p class="not" style="text-align:center">${ad(rakip)}: ${d.tkm[rakip] ? 'seçimini yaptı ✓' : 'seçim yapıyor…'}</p>`;
      }
    }

    else if (d.faz === 'soru') {
      const q = soruBul(d.kart);
      const benim = benimMi(d.aktif);
      let ust = '';
      if (d.pas && d.sonuc) ust += `<div class="uyari">${ad(d.sonuc.oyuncu)} ${d.sonuc.secilen === null ? 'süreyi doldurdu' : 'yanlış cevap verdi'}. Soru <b>${ad(d.aktif)}</b> tarafına geçti! Bilirse kendi piyonunu 1 kare ilerletir.</div>`;
      const hedefYazi = d.hedef === M.BITIS ? 'BİTİŞ sorusu' : `${d.hedef}. kare${q.tur === 'altin' ? ' · Altın soru: doğruysa +1 kare daha' : ''}`;
      ust += `<div class="durum-yazi" style="color:${renk(d.aktif)}">Sıra: ${ad(d.aktif)} ${d.pas ? '' : '· ' + hedefYazi}</div>`;
      ust += '<div style="display:flex;align-items:center;gap:8px"><div class="sure" style="flex:1"><i style="width:100%"></i></div><span class="kalan not">30 sn</span></div>';
      if (d.kitapAcik) ust += `<div class="kitap-not">📖 Kitaba Bak: <b>${q.konu} ${esc(KONULAR[q.konu])}</b> konusuna bakabilirsin.</div>`;
      let alt = '';
      if (benim) {
        const j = d.oyuncular[d.aktif].jokerler;
        alt = `<div class="kart-alt"><span class="not">Jokerler:</span><span>
          <button class="ikincil" data-joker="kitap" ${j.kitap ? '' : 'disabled'}>📖 Kitaba Bak (+20 sn)</button>
          <button class="ikincil" data-joker="takas" ${j.takas && !d.pas ? '' : 'disabled'}>🔄 Takas</button></span></div>`;
      } else {
        alt = `<p class="not" style="margin-top:10px">${ad(d.aktif)} cevaplıyor…</p>`;
      }
      h += kartHTML(q, { secilebilir: benim, ust, alt, konuGoster: d.kitapAcik });
    }

    else if (d.faz === 'sonuc' || d.faz === 'bitti') {
      const q = soruBul(d.kart);
      const s = d.sonuc;
      let baslik;
      if (s.dogru) {
        baslik = `<div class="sonuc-baslik iyi">✔ ${ad(s.oyuncu)} doğru bildi! ${s.ilerleme ? '+' + s.ilerleme + ' kare' : ''}</div>`;
      } else {
        baslik = `<div class="sonuc-baslik kotu">✘ ${ad(s.oyuncu)} ${s.secilen === null ? 'süreyi doldurdu' : 'yanlış cevap verdi'}. Kimse ilerlemedi.</div>`;
      }
      if (d.kazanan !== null) baslik = `<div class="sonuc-baslik iyi" style="font-size:22px">🏁 ${ad(d.kazanan)} BİTİŞ’e ulaştı ve kazandı!</div>` + baslik;
      h += kartHTML(q, { cevapGoster: true, secilen: s.secilen, ust: baslik, alt: aciklamaHTML(q), kavramGoster: true, konuGoster: true });
      if (d.faz === 'sonuc') {
        h += `<div class="buton-satiri"><button data-devam>${d.kazanan !== null ? 'Oyun sonucunu gör' : 'Devam →'}</button></div>`;
      } else {
        h += karneHTML();
        h += `<div class="buton-satiri">
          ${mod === 'yerel' || mod === 'bot' ? '<button data-tekrar>Yeni oyun</button>' : ''}
          <button class="ikincil" data-git="kayitlar">Cevap kayıtları</button>
          <button class="ikincil" data-cik>Menü</button></div>`;
      }
    }
    const panel = $('panel');
    panel.innerHTML = h;
    // yeni bir ekran (yeni kart, soru rakibe geçti, sonuç…) kayarak gelir
    const anahtar = [d.faz, d.kart, d.aktif, d.pas, d.tur].join('|');
    if (anahtar !== sonPanelAnahtari) {
      sonPanelAnahtari = anahtar;
      panel.classList.remove('giris');
      void panel.offsetWidth;
      panel.classList.add('giris');
    }
  }

  // Oyun sonu: oyuncu ve konu bazında doğru sayıları
  function karneHTML() {
    const satirlar = {};
    durum.kayit.forEach(k => {
      const q = soruBul(k.kart);
      const r = satirlar[q.konu] = satirlar[q.konu] || [[0, 0], [0, 0]];
      r[k.oyuncu][1]++;
      if (k.dogru) r[k.oyuncu][0]++;
    });
    const ad = i => esc(durum.oyuncular[i].ad);
    let h = `<h3 style="margin-top:16px">Konu karnesi</h3><table><tr><th>Konu</th><th>${ad(0)}</th><th>${ad(1)}</th></tr>`;
    Object.keys(satirlar).sort().forEach(konu => {
      const r = satirlar[konu];
      h += `<tr><td>${konu} ${esc(KONULAR[konu])}</td>${r.map(([d, t]) => `<td>${t ? d + ' / ' + t : '–'}</td>`).join('')}</tr>`;
    });
    return h + '</table><p class="not">Doğru / cevaplanan soru sayısı. Düşük olan konuları ders kitabından tekrar etmek faydalı olur.</p>';
  }

  // ─── olaylar ───
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.git) return git(b.dataset.git);
    if (b.dataset.tkm) return eylem({ tip: 'tkm', oyuncu: +b.dataset.oyuncu, secim: b.dataset.tkm });
    if (b.dataset.cevap !== undefined && b.closest('#panel')) return eylem({ tip: 'cevap', oyuncu: durum.aktif, secilen: +b.dataset.cevap });
    if (b.dataset.joker) return eylem({ tip: 'joker', oyuncu: durum.aktif, ad: b.dataset.joker });
    if (b.hasAttribute('data-devam')) return eylem({ tip: 'devam' });
    if (b.hasAttribute('data-tekrar')) return oyunuBaslat(durum.oyuncular.map(o => o.ad), mod, durum.oyuncular.map(o => o.renk));
    if (b.hasAttribute('data-cik')) return oyundanCik(false);
  });

  document.addEventListener('keydown', e => {
    if (!durum || mod !== 'yerel' || durum.faz !== 'tkm' || perdeAcik || e.target.tagName === 'INPUT') return;
    const t = TKM_TUSLARI[e.key.toLowerCase()];
    if (t && !durum.tkm[t[0]]) eylem({ tip: 'tkm', oyuncu: t[0], secim: t[1] });
  });

  $('oyundan-cik').addEventListener('click', () => oyundanCik(true));

  function oyundanCik(sor) {
    if (sor && durum && durum.faz !== 'bitti' && !confirm('Oyundan çıkılsın mı?')) return;
    clearTimeout(botZamanlayici);
    perdeyiKapat();
    if (baglanti) { baglanti.kapat(); baglanti = null; }
    durum = null; mod = null;
    history.replaceState(null, '', location.pathname);
    ekranGoster('ana');
  }

  function git(hedef) {
    // üst şeritten oyun ekranı dışına gidilirken oyun kapatılır (bitmemişse önce sorulur)
    if (durum && !$('oyun').classList.contains('gizli') && hedef !== 'ana') {
      if (durum.faz !== 'bitti' && !confirm('Oyundan çıkılsın mı?')) return;
      oyundanCik(false);
    }
    if (hedef === 'kurulum-yerel' || hedef === 'kurulum-bot') {
      sonKurulumModu = hedef === 'kurulum-bot' ? 'bot' : 'yerel';
      $('kurulum-baslik').textContent = sonKurulumModu === 'bot' ? 'Bilgisayara Karşı' : 'Aynı Cihazda Oyna';
      $('ad1-kutu').classList.toggle('gizli', sonKurulumModu === 'bot');
      $('tus-notu').classList.toggle('gizli', sonKurulumModu === 'bot');
      if (sonKurulumModu === 'bot' && $('ad0').value === 'Kırmızı Takım') $('ad0').value = 'Ben';
      return ekranGoster('kurulum');
    }
    if (hedef === 'oda-kur') return odaKurEkrani();
    if (hedef === 'pratik-kurulum') return pratikKurulum();
    if (hedef === 'kayitlar') return kayitlariGoster();
    if (hedef === 'ana' && durum) return oyundanCik(true);
    ekranGoster(hedef);
  }

  $('oyunu-baslat').addEventListener('click', () => {
    const ad0 = $('ad0').value.trim() || '1. Oyuncu';
    const ad1 = sonKurulumModu === 'bot' ? 'Bilgisayar' : ($('ad1').value.trim() || '2. Oyuncu');
    const renkler = [$('renk0').dataset.secili, sonKurulumModu === 'bot' ? RENKLER[1].kod : $('renk1').dataset.secili];
    oyunuBaslat([ad0, ad1], sonKurulumModu, renkler);
  });
  renkSeciciKur($('renk0'), RENKLER[0].kod, $('ad0'), $('renk1'));
  renkSeciciKur($('renk1'), RENKLER[1].kod, $('ad1'), $('renk0'));

  // ─── özel link (çevrim içi) ───
  function odaLinki(kod) { return location.origin + location.pathname + '?oda=' + kod; }

  function odaKurEkrani() {
    ekranGoster('oda');
    const dosyaUyari = location.protocol === 'file:'
      ? '<div class="uyari">Oyun şu an bilgisayardaki dosyadan açılmış. Linkin başka cihazlarda açılması için oyunun internette yayınlanmış olması gerekir (bkz. YAYINLAMA.md). Bu bilgisayarda iki sekmeyle deneyebilirsin.</div>' : '';
    $('oda-icerik').innerHTML = `${dosyaUyari}
      <div class="form"><label>Adın veya takımının adı</label><input id="oda-ad" maxlength="20" value="${esc(benimAdim || 'Kırmızı Takım')}">
      <div class="renk-secici" id="oda-renk" aria-label="Piyon rengin"></div>
      <button id="oda-olustur">Yeni Oda Kur</button>
      <p class="not">Oda kurulunca bir oda kodu, link ve QR kod çıkar. Kodu yalnızca birlikte oynayacağın kişiye söyle. İlk katılan kişiden sonra oda kilitlenir.</p>
      <div class="ayirac">veya</div>
      <label>Arkadaşının söylediği oda kodu</label>
      <input id="oda-kodu-gir" class="kod-girdi" maxlength="8" placeholder="ÖRN. K7P2QX" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <button id="koda-katil">Odaya Katıl</button>
      <div id="kod-uyari" class="uyari gizli"></div></div>`;
    renkSeciciKur($('oda-renk'), benimRengim || RENKLER[0].kod, $('oda-ad'));
    $('oda-olustur').onclick = odaOlustur;
    const kodKutusu = $('oda-kodu-gir');
    kodKutusu.oninput = () => { kodKutusu.value = kodTemizle(kodKutusu.value); $('kod-uyari').classList.add('gizli'); };
    kodKutusu.onkeydown = e => { if (e.key === 'Enter') $('koda-katil').click(); };
    $('koda-katil').onclick = () => {
      const kod = kodTemizle(kodKutusu.value);
      if (kod.length !== 6) {
        $('kod-uyari').textContent = 'Oda kodu 6 karakterden oluşur. Kodu kontrol edip tekrar yaz.';
        $('kod-uyari').classList.remove('gizli');
        return;
      }
      let ad = $('oda-ad').value.trim();
      let r = $('oda-renk').dataset.secili;
      // hiçbir şey değiştirilmediyse katılan taraf maviyle girer (odayı kuran varsayılan olarak kırmızı)
      if ((!ad || ad === 'Kırmızı Takım') && r === RENKLER[0].kod) { ad = 'Mavi Takım'; r = RENKLER[1].kod; }
      odayaKatil(kod, ad || 'Mavi Takım', r);
    };
  }

  // Küçük harf, boşluk ve Türkçe harfleri kodla eşleşecek biçime getirir
  function kodTemizle(metin) {
    return metin.toLocaleUpperCase('tr').replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  async function odaOlustur(tekrarDenemesi) {
    benimAdim = $('oda-ad') ? $('oda-ad').value.trim() || 'Kırmızı Takım' : benimAdim;
    benimRengim = $('oda-renk') ? $('oda-renk').dataset.secili : (benimRengim || RENKLER[0].kod);
    const kod = Ag.odaKoduUret();
    $('oda-icerik').innerHTML = '<p>Oda hazırlanıyor…</p>';
    try {
      baglanti = await Ag.evSahibi(kod, {
        acildi: () => odaBekleme(kod),
        misafir: (ad, misafirRengi) => {
          kopukMesaj = null;
          if (durum && mod === 'ev') { durumDegisti(); return; }   // aynı misafir geri döndü
          const r = farkliRenk(misafirRengi, benimRengim);
          if (r !== misafirRengi && VARSAYILAN_AD.test(ad)) ad = RENKLER.find(x => x.kod === r).ad + ' Takım';
          oyunuBaslat([benimAdim, ad], 'ev', [benimRengim, r]);
        },
        eylem: e => { if (mod === 'ev') eylem(e); },
        kopma: () => { kopukMesaj = 'Rakibin bağlantısı koptu. Aynı linkle ve aynı adla yeniden katılabilir; oyun kaldığı yerden devam eder.'; if (durum) ciz(); },
        hata: (mesaj, tur) => {
          if (tur === 'unavailable-id' && tekrarDenemesi !== true) { baglanti && baglanti.kapat(); return odaOlustur(true); }
          if (durum) { kopukMesaj = mesaj; ciz(); } else $('oda-icerik').innerHTML = `<div class="uyari">${esc(mesaj)}</div><button data-git="oda-kur">Tekrar dene</button>`;
        }
      });
    } catch (e) {
      $('oda-icerik').innerHTML = `<div class="uyari">${esc(e.message)}</div><button data-git="oda-kur">Tekrar dene</button>`;
    }
  }

  function odaBekleme(kod) {
    const link = odaLinki(kod);
    $('oda-icerik').innerHTML = `<p>Oda kodu</p><div class="oda-kod">${kod}</div>
      <div class="link-kutu"><input id="oda-link" readonly value="${esc(link)}"><button id="link-kopyala">Kopyala</button></div>
      <div id="qr"></div><p class="not">Arkadaşın <b>Özel Linkle Oyna</b> ekranında bu kodu yazınca, linke tıklayınca veya QR kodu okutunca oyun başlar.<br>Bu sayfayı kapatma; oda bu sayfa açık kaldıkça çalışır.</p>`;
    $('link-kopyala').onclick = () => { $('oda-link').select(); navigator.clipboard && navigator.clipboard.writeText(link); $('link-kopyala').textContent = 'Kopyalandı ✓'; };
    qrCiz($('qr'), link);
  }

  async function qrCiz(el, metin) {
    try {
      await Ag.scriptYukle(QR_URL);
      el.innerHTML = '';
      new QRCode(el, { text: metin, width: 168, height: 168 });
    } catch (e) { el.textContent = ''; }
  }

  function odayaKatilEkrani(kod) {
    ekranGoster('oda');
    $('oda-icerik').innerHTML = `<p>Bir oyuna davet edildin.</p><div class="oda-kod">${esc(kod)}</div>
      <div class="form"><label>Adın veya takımının adı</label><input id="katil-ad" maxlength="20" value="${esc(benimAdim || 'Mavi Takım')}">
      <div class="renk-secici" id="katil-renk" aria-label="Piyon rengin"></div>
      <button id="katil-btn">Odaya Katıl</button></div>`;
    renkSeciciKur($('katil-renk'), benimRengim || RENKLER[1].kod, $('katil-ad'));
    $('katil-btn').onclick = () => odayaKatil(kod, $('katil-ad').value.trim() || 'Mavi Takım', $('katil-renk').dataset.secili);
  }

  async function odayaKatil(kod, ad, r) {
    benimAdim = ad;
    benimRengim = r || benimRengim;
    $('oda-icerik').innerHTML = '<p>Odaya bağlanılıyor…</p>';
    try {
      baglanti = await Ag.misafir(kod, ad, {
        durum: (d, zaman) => {
          saatFarki = Date.now() - zaman;
          kopukMesaj = null;
          if (mod !== 'misafir') { mod = 'misafir'; kaydedilen = 0; gosterilenTkm = null; ekranGoster('oyun'); }
          durum = d;
          kayitlariIsle();
          ciz();
        },
        dolu: () => { $('oda-icerik').innerHTML = '<div class="uyari">Bu oda dolu. Oyun başka biriyle başlamış.</div>'; },
        kopma: () => {
          kopukMesaj = `Bağlantı koptu. <button id="yeniden-baglan">Yeniden bağlan</button>`;
          if (durum) { ciz(); $('yeniden-baglan').onclick = () => { baglanti.kapat(); odayaKatil(kod, ad, r); }; }
        },
        hata: mesaj => {
          if (durum) { kopukMesaj = esc(mesaj); ciz(); return; }
          $('oda-icerik').innerHTML = `<div class="uyari">${esc(mesaj)}</div><button id="tekrar-katil">Tekrar dene</button> <button class="ikincil" data-git="oda-kur">Başka kod gir</button>`;
          $('tekrar-katil').onclick = () => { baglanti && baglanti.kapat(); odayaKatil(kod, ad, r); };
        }
      }, benimRengim);
    } catch (e) {
      $('oda-icerik').innerHTML = `<div class="uyari">${esc(e.message)}</div>`;
    }
  }

  // ─── pratik ───
  let pratik = null;

  function pratikKurulum() {
    ekranGoster('pratik');
    const konuSecenekleri = Object.entries(KONULAR).map(([k, ad]) => `<option value="${k}">${k} ${esc(ad)}</option>`).join('');
    $('pratik-icerik').innerHTML = `<div class="form">
      <label>Ünite</label><select id="p-unite"><option value="">Tüm üniteler</option>
        ${[1, 2, 3].map(u => `<option value="${u}">Ünite ${u} · ${esc(UNITELER[u].ad)}</option>`).join('')}</select>
      <label>Konu</label><select id="p-konu"><option value="">Tüm konular</option>${konuSecenekleri}</select>
      <label>Soru sayısı</label><select id="p-sayi"><option value="10">10</option><option value="20">20</option><option value="0">Hepsi</option></select>
      <button id="p-basla">Başla</button></div>`;
    $('p-unite').onchange = () => {
      const u = $('p-unite').value;
      [...$('p-konu').options].forEach(o => { o.hidden = !!(u && o.value && !o.value.startsWith(u + '.')); });
      $('p-konu').value = '';
    };
    $('p-basla').onclick = () => {
      const u = $('p-unite').value, k = $('p-konu').value, n = +$('p-sayi').value;
      let liste = SORULAR.filter(q => (!u || q.unite === +u) && (!k || q.konu === k));
      liste = liste.sort(() => Math.random() - .5);
      if (n) liste = liste.slice(0, n);
      pratik = { liste, i: 0, dogru: 0, secilen: null, baslangic: Date.now(), sonuclar: [] };
      pratikCiz();
    };
  }

  function pratikCiz() {
    const p = pratik;
    if (p.i >= p.liste.length) {
      const konular = {};
      p.sonuclar.forEach(([q, d]) => { const r = konular[q.konu] = konular[q.konu] || [0, 0]; r[1]++; if (d) r[0]++; });
      $('pratik-icerik').innerHTML = `<div class="panel"><h2>Sonuç: ${p.dogru} / ${p.liste.length}</h2>
        <table><tr><th>Konu</th><th>Doğru</th></tr>${Object.keys(konular).sort().map(k => `<tr><td>${k} ${esc(KONULAR[k])}</td><td>${konular[k][0]} / ${konular[k][1]}</td></tr>`).join('')}</table>
        <div class="buton-satiri"><button data-git="pratik-kurulum">Yeni pratik</button><button class="ikincil" data-git="ana">Menü</button></div></div>`;
      return;
    }
    const q = p.liste[p.i];
    const cevaplandi = p.secilen !== null;
    const ust = `<div class="durum-yazi">Soru ${p.i + 1} / ${p.liste.length} · Doğru: ${p.dogru}</div>`;
    let alt = '';
    if (cevaplandi) {
      alt = `<div class="sonuc-baslik ${p.secilen === q.cevap ? 'iyi' : 'kotu'}" style="margin-top:10px">${p.secilen === q.cevap ? '✔ Doğru!' : '✘ Yanlış'}</div>${aciklamaHTML(q)}
        <div class="buton-satiri"><button id="p-sonraki">Sonraki →</button></div>`;
    }
    $('pratik-icerik').innerHTML = kartHTML(q, { secilebilir: true, cevapGoster: cevaplandi, secilen: p.secilen, ust, alt, konuGoster: true, kavramGoster: cevaplandi });
    $('pratik-icerik').querySelectorAll('[data-cevap]').forEach(b => b.onclick = () => {
      p.secilen = +b.dataset.cevap;
      const dogru = p.secilen === q.cevap;
      if (dogru) p.dogru++;
      p.sonuclar.push([q, dogru]);
      kayitEkle([kayitSatiri(q, dogru, Date.now() - p.baslangic, 'pratik', 1)]);
      pratikCiz();
    });
    if (cevaplandi) $('p-sonraki').onclick = () => { p.i++; p.secilen = null; p.baslangic = Date.now(); pratikCiz(); };
  }

  // ─── tek kart (basılı kartın QR kodu) ───
  function tekKartGoster(id) {
    const q = soruBul(id);
    ekranGoster('tek-kart');
    if (!q) { $('tek-kart-icerik').innerHTML = '<div class="uyari">Kart bulunamadı.</div>'; return; }
    const ciz = acik => {
      $('tek-kart-icerik').innerHTML = kartHTML(q, {
        cevapGoster: acik, kavramGoster: true, konuGoster: true,
        alt: acik ? aciklamaHTML(q) : '<div class="buton-satiri"><button id="cevap-goster">Cevabı göster</button></div>'
      });
      if (!acik) $('cevap-goster').onclick = () => ciz(true);
    };
    ciz(false);
  }

  // ─── kayıtlar ───
  function kayitlariGoster() {
    ekranGoster('kayitlar');
    const kayit = kayitlariOku();
    if (!kayit.length) {
      $('kayit-icerik').innerHTML = '<div class="panel"><p>Henüz kayıt yok. Oyun veya pratik oynadıkça cevaplar bu cihazda kaydedilir.</p>' +
        '<p class="not">Başka cihazlardan indirilen CSV dosyaları Kart analizi sayfasında incelenebilir.</p>' +
        '<div class="buton-satiri"><button class="ikincil" onclick="location.href=\'analiz.html?v=6\'">Kart analizi</button></div></div>';
      return;
    }
    const konular = {};
    kayit.forEach(k => { const r = konular[k.konu] = konular[k.konu] || [0, 0]; r[1]++; r[0] += k.dogru; });
    const toplamDogru = kayit.reduce((a, k) => a + k.dogru, 0);
    $('kayit-icerik').innerHTML = `<div class="panel">
      <p><b>${kayit.length}</b> cevap kaydedildi · genel başarı <b>%${Math.round(toplamDogru / kayit.length * 100)}</b></p>
      <table><tr><th>Konu</th><th>Doğru / Toplam</th><th>Başarı</th></tr>
      ${Object.keys(konular).sort().map(k => {
        const [d, t] = konular[k], yuzde = Math.round(d / t * 100);
        return `<tr><td>${k} ${esc(KONULAR[k])}</td><td>${d} / ${t}</td><td><div class="cubuk"><i style="width:${yuzde}%"></i></div> %${yuzde}</td></tr>`;
      }).join('')}</table>
      <p class="not">Kayıtlar yalnızca bu cihazdaki tarayıcıda tutulur; isim kaydedilmez. Araştırma verisi için CSV dosyasını indirin.</p>
      <div class="buton-satiri"><button id="csv-indir">Excel için indir (CSV)</button><button onclick="location.href='analiz.html?v=6&cihaz=1&yazdir=1'">PDF olarak kaydet</button><button class="ikincil" onclick="location.href='analiz.html?v=6'">Kart analizi</button><button class="ikincil" id="kayit-sil">Kayıtları sil</button></div></div>`;
    $('csv-indir').onclick = csvIndir;
    $('kayit-sil').onclick = () => {
      if (!confirm('Bu cihazdaki tüm cevap kayıtları silinsin mi?')) return;
      try { localStorage.removeItem(KAYIT_ANAHTARI); } catch (e) { /* yok */ }
      kayitlariGoster();
    };
  }

  function csvIndir() {
    const basliklar = ['zaman', 'mod', 'oyuncu_no', 'kart', 'unite', 'konu', 'konu_adi', 'tur', 'dogru', 'sure_sn'];
    const satirlar = kayitlariOku().map(k => [k.zaman, k.mod, k.oyuncu, k.kart, k.unite, k.konu, KONULAR[k.konu], k.tur, k.dogru, String(k.sureSn).replace('.', ',')]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'));
    const blob = new Blob(['﻿' + basliklar.join(';') + '\n' + satirlar.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zaman-yolu-kayitlar-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ─── açılış ───
  const parametre = new URLSearchParams(location.search);
  if (parametre.get('kart')) tekKartGoster(parametre.get('kart'));
  else if (parametre.get('oda')) odayaKatilEkrani(parametre.get('oda').toUpperCase());
  else ekranGoster('ana');
})();
