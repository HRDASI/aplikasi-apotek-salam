// Label barcode/harga produk. Digambar langsung pada titik printer (203 dpi) supaya garis barcode tetap tajam dan terbaca scanner.
import { S } from './inti.js?v=1.12.0';
import { ikon } from './menu.js?v=1.12.0';
import { esc, rupiah, toast, modal, pesanGalat } from './ui.js?v=1.12.0';
import { bacaPrinter, cetakLabelPng } from './cetak.js?v=1.12.0';
import { pasangCariProduk } from './dokumen.js?v=1.12.0';

let janji;
function muatJsBarcode() {
  janji ||= new Promise((res, rej) => {
    if (window.JsBarcode) return res(window.JsBarcode);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
    s.onload = () => res(window.JsBarcode); s.onerror = () => { janji = null; rej(new Error('Gagal memuat pembuat barcode. Cek internet.')); };
    document.head.append(s);
  });
  return janji;
}
const titik = mm => Math.round(mm / 25.4 * 203);
export const kodeLabel = p => (p.barcode || p.kode || '').trim();

async function biner(kode) {
  const JB = await muatJsBarcode();
  const buat = format => { const d = {}; let sah = true; JB(d, kode, { format, flat: true, valid: v => { sah = v; } }); return sah ? d.encodings.map(e => e.data).join('') : null; };
  const bit = (/^\d{13}$/.test(kode) && buat('EAN13')) || buat('CODE128');
  if (!bit) throw new Error(`Kode "${kode}" tidak bisa dijadikan barcode`);
  return bit;
}

function potongBaris(x, teks, maks, jml) {
  const hasil = []; let b = '';
  for (const kata of teks.split(/\s+/)) {
    const coba = b ? b + ' ' + kata : kata;
    if (!b || x.measureText(coba).width <= maks) b = coba; else { hasil.push(b); b = kata; }
  }
  hasil.push(b);
  if (hasil.length > jml) { hasil[jml - 1] = hasil.slice(jml - 1).join(' '); hasil.length = jml; }
  return hasil.map(s => { if (x.measureText(s).width <= maks) return s; while (s && x.measureText(s + '…').width > maks) s = s.slice(0, -1); return s + '…'; });
}

export async function gambarLabel(p, { lebar, tinggi, harga = true }) {
  const kode = kodeLabel(p), bit = await biner(kode);
  const c = document.createElement('canvas'); c.width = titik(lebar); c.height = titik(tinggi);
  const x = c.getContext('2d'), W = c.width, H = c.height, m = 12;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'top';
  // 10 modul kosong di tiap sisi wajib ada agar terbaca scanner
  const modul = Math.min(3, Math.floor(W / (bit.length + 20)));
  if (modul < 1) throw new Error(`Barcode "${kode}" terlalu panjang untuk stiker ${lebar} mm`);
  const s = Math.min(H / 240, W / 320);                       // skala huruf terhadap stiker 50×30
  const fKop = Math.round(18 * s), fNama = Math.round(24 * s), fKode = Math.round(19 * s), fHarga = Math.round(38 * s);
  let y = Math.round(8 * s);
  x.font = `${fKop}px Arial`; x.fillText(potongBaris(x, S.outlet?.nama || 'Apotek Salam', W - 2 * m, 1)[0], W / 2, y); y += fKop + 4;
  x.font = `bold ${fNama}px Arial`;
  for (const b of potongBaris(x, p.nama || '', W - 2 * m, 2)) { x.fillText(b, W / 2, y); y += fNama + 2; }
  const bawah = fKode + 4 + (harga ? fHarga + 4 : 0) + Math.round(6 * s);
  const t = H - y - bawah - 6;
  if (t < 24) throw new Error(`Stiker ${lebar}×${tinggi} mm terlalu kecil untuk label ini`);
  const x0 = Math.floor((W - bit.length * modul) / 2); y += 4;
  for (let i = 0; i < bit.length; i++) if (bit[i] === '1') x.fillRect(x0 + i * modul, y, modul, t);
  y += t + 4;
  x.font = `${fKode}px Arial`; x.fillText(kode, W / 2, y); y += fKode + 4;
  if (harga) { x.font = `bold ${fHarga}px Arial`; x.fillText(rupiah(p.harga_jual), W / 2, y); }
  const d = x.getImageData(0, 0, W, H), q = d.data;
  for (let i = 0; i < q.length; i += 4) { const v = q[i] < 150 ? 0 : 255; q[i] = q[i + 1] = q[i + 2] = v; q[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  return { png: c.toDataURL('image/png'), modul };
}

export function bukaCetakLabel(awal) {
  const pr = bacaPrinter(), { lebar, tinggi } = pr.label;
  const daftar = [];
  let urutan = 0;
  const m = modal({ judul: 'Cetak Label Barcode / Harga', ukuran: 'besar', isi: `
    <div style="margin-bottom:12px"><input class="input" data-cari placeholder="Tambah produk: ketik nama/kode atau scan barcode, lalu Enter"></div>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Produk</th><th>Kode di barcode</th><th class="angka">Harga</th><th class="angka">Lembar</th><th></th></tr></thead><tbody data-isi></tbody></table></div>
    <label class="cek" style="margin:12px 0"><input type="checkbox" data-harga checked> Cantumkan harga</label>
    <div data-pratinjau style="text-align:center"></div>
    <p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Ukuran stiker ${lebar}×${tinggi} mm, printer: ${esc(pr.mode !== 'dialog' && pr.label.printer || 'dialog cetak browser')}. Ubah di <a href="#/pengaturan/printer">Printer & Cetak</a>.</p>`,
    tombol: [{ teks: 'Tutup', kelas: 'kedua' }, { teks: 'Cetak', aksi: async () => {
      if (!daftar.length) throw new Error('Belum ada produk');
      for (const d of daftar) if (!Number.isInteger(d.qty) || d.qty < 1 || d.qty > 500) throw new Error(`Jumlah lembar ${d.p.nama} harus 1 sampai 500`);
      const harga = m.el.querySelector('[data-harga]').checked, hasil = [];
      for (const d of daftar) hasil.push({ png: (await gambarLabel(d.p, { lebar, tinggi, harga })).png, salinan: d.qty });
      const cara = await cetakLabelPng(hasil, 'Label produk');
      if (cara === 'agen') toast(`${hasil.reduce((a, h) => a + h.salinan, 0)} label dikirim ke printer`, 'sukses');
      return false;
    } }] });
  const pratinjau = async () => {
    const w = m.el.querySelector('[data-pratinjau]'), ini = ++urutan;
    if (!daftar.length) { w.innerHTML = ''; return; }
    try {
      const g = await gambarLabel(daftar[daftar.length - 1].p, { lebar, tinggi, harga: m.el.querySelector('[data-harga]').checked });
      if (ini !== urutan) return;
      w.innerHTML = `<img src="${g.png}" alt="Pratinjau label" style="max-width:100%;border:1px solid #ccc;border-radius:4px">` +
        (g.modul < 2 ? '<p class="pesan peringatan">Garis barcode sangat rapat di stiker ini. Tes scan dulu, atau pakai kode yang lebih pendek / stiker lebih lebar.</p>' : '');
    } catch (e) { if (ini === urutan) w.innerHTML = `<p class="pesan peringatan">${esc(pesanGalat(e))}</p>`; }
  };
  const gambar = () => {
    m.el.querySelector('[data-isi]').innerHTML = daftar.length ? daftar.map((d, i) => `<tr><td><b>${esc(d.p.nama)}</b></td><td>${esc(kodeLabel(d.p))}</td><td class="angka">${rupiah(d.p.harga_jual)}</td>
      <td class="angka"><input type="number" class="input" min="1" max="500" step="1" style="width:80px;text-align:right" data-qty="${i}" value="${d.qty}"></td>
      <td><button type="button" class="ikon-aksi hapus" data-buang="${i}" aria-label="Hapus">${ikon('hapus')}</button></td></tr>`).join('') : '<tr><td colspan="5" class="kosong">Belum ada produk</td></tr>';
    pratinjau();
  };
  const tambah = p => {
    if (!kodeLabel(p)) return toast(`${p.nama} belum punya barcode maupun kode. Isi dulu di Ubah Produk.`, 'galat');
    const ada = daftar.find(d => d.p.id === p.id);
    if (ada) ada.qty++; else daftar.push({ p, qty: 1 });
    gambar();
  };
  m.el.addEventListener('input', e => { if (e.target.dataset.qty !== undefined) daftar[e.target.dataset.qty].qty = Number(e.target.value); });
  m.el.addEventListener('click', e => { const b = e.target.closest('[data-buang]'); if (b) { daftar.splice(b.dataset.buang, 1); gambar(); } });
  m.el.querySelector('[data-harga]').onchange = pratinjau;
  pasangCariProduk(m.el.querySelector('[data-cari]'), tambah);
  gambar();
  if (awal) tambah(awal);
}
