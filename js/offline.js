// Mode offline: salinan data di perangkat (IndexedDB), antrean transaksi, masuk offline, dan sinkron otomatis.
// Hanya aktif di perangkat yang sudah ditandai Pemilik. Antrean tidak pernah dihapus sebelum server menjawab "tercatat".
import { sb, S, KONEKSI, cekServer, ambilSemua, HOOK } from './inti.js?v=1.15.0';
import { toast } from './ui.js?v=1.15.0';

const AGEN = 'http://localhost:8766';
const MASA_LOGIN = 3 * 864e5;                 // masuk offline berlaku 3 hari sejak login online terakhir
export const METODE_OFFLINE = ['tunai', 'qris', 'transfer'];
const uuidBaru = () => crypto.randomUUID();
const ls = { baca: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, tulis: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* penuh/diblokir */ } } };
export const perangkat = () => ls.baca('apotek-perangkat');       // { id, nama, aktif }
export const perangkatAktif = () => !!perangkat()?.aktif;

// ---------- IndexedDB ----------
let janjiDb;
function db() {
  janjiDb ||= new Promise((res, rej) => {
    const r = indexedDB.open('apotek-offline', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('data'); r.result.createObjectStore('antre', { keyPath: 'id' }); r.result.createObjectStore('akun', { keyPath: 'username' }); };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); janjiDb = null; }; res(r.result); };
    r.onerror = () => { janjiDb = null; rej(new Error('Penyimpanan perangkat tidak bisa dibuka')); };
  });
  return janjiDb;
}
async function tx(toko, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    let hasil; const t = d.transaction(toko, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined);
    const q = fn(t.objectStore(toko)); if (q) q.onsuccess = () => { hasil = q.result; };
    t.oncomplete = () => res(hasil); t.onerror = t.onabort = () => rej(new Error('Gagal menyimpan di perangkat: ' + (t.error?.message || 'penyimpanan penuh')));
  });
}
const simpanDb = (toko, nilai, kunci) => tx(toko, 'readwrite', s => { kunci === undefined ? s.put(nilai) : s.put(nilai, kunci); });
const bacaDb = (toko, kunci) => tx(toko, 'readonly', s => s.get(kunci));
const semuaDb = toko => tx(toko, 'readonly', s => s.getAll());
const hapusDb = (toko, kunci) => tx(toko, 'readwrite', s => { s.delete(kunci); });

// ---------- Salinan data ----------
let D = null;
export const adaData = () => !!D && D.outlet_id === S.pengguna?.outlet_id;
export const siap = () => perangkatAktif() && adaData();
export const waktuData = () => D?.waktu || 0;
export async function bacaSalinan() { if (!D) { try { D = await bacaDb('data', 'salinan') || null; } catch { D = null; } } return D; }

let sedangUnduh = null;
export function unduhData(penuh = false) {
  sedangUnduh ||= (async () => {
    await bacaSalinan();
    const o = S.pengguna.outlet_id, lama = D && D.outlet_id === o && !penuh && Date.now() - D.penuh < 36e5 ? D : null;
    const ambil = (t, k, u = 'id') => ambilSemua(() => sb.from(t).select(k).order(u));
    const kolProduk = 'id,kode,barcode,nama,nama_generik,golongan,kategori_id,satuan_id,harga_jual,wajib_resep,aktif,diubah';
    const mulai = Date.now(), [stok, produk] = await Promise.all([
      ambilSemua(() => sb.from('stok_produk').select('produk_id,qty').eq('outlet_id', o).order('produk_id')),
      lama ? ambilSemua(() => sb.from('produk').select(kolProduk).gt('diubah', lama.produkSampai).order('id')) : ambil('produk', kolProduk),
    ]);
    const n = lama ? { ...lama } : { outlet_id: o, penuh: mulai };
    const pm = new Map((lama?.produk || []).map(p => [p.id, p]));
    for (const p of produk) p.aktif ? pm.set(p.id, p) : pm.delete(p.id);
    n.produk = [...pm.values()];
    n.produkSampai = produk.reduce((a, p) => p.diubah > a ? p.diubah : a, lama?.produkSampai || '1970-01-01T00:00:00Z');
    n.stok = Object.fromEntries(stok.map(s => [s.produk_id, Number(s.qty)]));
    if (!lama) {
      const t = { satuan: 'id,nama', produk_satuan: 'id,produk_id,satuan_id,isi,harga_jual', promo_diskon: '*', promo_bundel: '*', promo_bundel_item: '*', pelanggan: 'id,nama,telp,kode,member,stamp,kategori_pelanggan_id,aktif',
        kategori_pelanggan: '*', jenis_pelayanan: '*', dokter: 'id,nama,no_sip', metode_bayar: 'id,nama,jenis,aktif,urutan', shift: '*', template_racikan: '*', template_racikan_item: '*' };
      const isi = await Promise.all(Object.entries(t).map(([k, v]) => ambil(k, v)));
      Object.keys(t).forEach((k, i) => { n[k] = isi[i]; });
      const { data: kf, error } = await sb.from('konfigurasi').select('*'); if (error) throw error;
      n.konfigurasi = kf;
      const { data: ol, error: e2 } = await sb.from('outlet').select('*').eq('id', o).single(); if (e2) throw e2;
      n.outlet = ol;
    }
    n.waktu = mulai;
    await simpanDb('data', n, 'salinan');
    D = n; indeks = null;
    // transaksi yang belum terkirim tetap mengurangi stok di perangkat ini
    for (const a of await semuaDb('antre')) if (a.jenis === 'jual') kurangiStok(a.data.hasil.items);
  })().finally(() => { sedangUnduh = null; });
  return sedangUnduh;
}
let indeks = null;
function ix() {
  if (!indeks) {
    const m = a => new Map((a || []).map(x => [x.id, x]));
    indeks = { produk: m(D.produk), satuan: m(D.satuan), pelanggan: m(D.pelanggan), jp: m(D.jenis_pelayanan), bundel: m(D.promo_bundel), kp: m(D.kategori_pelanggan), ps: new Map() };
    for (const s of D.produk_satuan) { if (!indeks.ps.has(s.produk_id)) indeks.ps.set(s.produk_id, []); indeks.ps.get(s.produk_id).push(s); }
  }
  return indeks;
}
function kurangiStok(items) {
  for (const i of items) {
    if (i.bundel_id) for (const b of D.promo_bundel_item.filter(x => x.bundel_id === i.bundel_id)) D.stok[b.produk_id] = (D.stok[b.produk_id] || 0) - b.qty * i.qty;
    else D.stok[i.produk_id] = (D.stok[i.produk_id] || 0) - i.qty * i.isi;
  }
}

// ---------- Pengganti kueri server ----------
export function cariProdukL(q, batas = 15) {
  const c = q.trim().toLowerCase(); if (!c) return [];
  const h = [];
  for (const p of D.produk) {
    const tepat = p.barcode === q.trim() || (p.kode || '').toLowerCase() === c;
    if (tepat || p.nama.toLowerCase().includes(c) || (p.kode || '').toLowerCase().includes(c) || (p.nama_generik || '').toLowerCase().includes(c)) h.push([tepat ? 0 : 1, p]);
  }
  return h.sort((a, b) => a[0] - b[0] || a[1].nama.localeCompare(b[1].nama)).slice(0, batas).map(([, p]) => ({ ...p, satuan: ix().satuan.get(p.satuan_id), stok: D.stok[p.id] || 0 }));
}
export function infoProdukL(ids) {
  const h = {};
  for (const id of ids) {
    const p = ix().produk.get(id); if (!p) continue;
    const sat = ix().satuan.get(p.satuan_id), opsi = [{ satuan_id: p.satuan_id, nama: sat?.nama || 'satuan', isi: 1 }];
    for (const s of [...(ix().ps.get(id) || [])].sort((a, b) => a.isi - b.isi)) opsi.push({ satuan_id: s.satuan_id, nama: ix().satuan.get(s.satuan_id)?.nama, isi: Number(s.isi) });
    h[id] = { ...p, satuan: sat, satuanDasar: sat?.nama || '', satuanOpsi: opsi };
  }
  return h;
}
export const pelangganL = q => { const c = q.toLowerCase(); return D.pelanggan.filter(p => p.aktif && (p.nama.toLowerCase().includes(c) || (p.telp || '').includes(q) || (p.kode || '').toLowerCase().includes(c))).slice(0, 10).map(p => ({ ...p, kategori: ix().kp.get(p.kategori_pelanggan_id) })); };
export const bundelL = () => D.promo_bundel.filter(b => b.aktif);
export const konfigL = k => D.konfigurasi.find(x => x.kunci === k)?.nilai;
export const templateL = () => D.template_racikan.filter(t => t.aktif).map(t => ({ ...t, item: D.template_racikan_item.filter(i => i.template_id === t.id).map(i => ({ ...i, produk: infoProdukL([i.produk_id])[i.produk_id] })) }));
export const outletL = () => D.outlet;

const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const berlaku = x => (!x.mulai || x.mulai <= hariIni()) && (!x.selesai || x.selesai >= hariIni());
const rd = n => Math.round(n + 1e-9);
// Salinan aturan hitung_penjualan di server (tanpa voucher, poin, dan resep). Server menghitung ulang saat sinkron.
export function hitungL(p) {
  const kj = konfigL('penjualan') || {}, maks = Number(kj.diskon_maks_persen ?? 20), bebas = S.akses.includes('*'), { produk, satuan, pelanggan, jp, bundel, kp, ps } = ix();
  const j = jp.get(Number(p.jenis_pelayanan_id)), pel = pelanggan.get(Number(p.pelanggan_id));
  if (p.voucher_kode) throw new Error('Voucher belum bisa dipakai saat offline');
  if (p.resep_id) throw new Error('Tebus resep terdaftar perlu internet. Isi nomor resep secara manual.');
  let sub = 0, perlu = false; const keras = ['keras', 'okt', 'psikotropika', 'narkotika'], items = [];
  for (const it of p.items) {
    const qty = Number(it.qty || 0), dp = Number(it.diskon_persen || 0);
    if (!(qty > 0)) throw new Error('Jumlah barang harus lebih dari 0');
    let nama, harga, isi = 1, sid = null, snama, gol = null, pr = null, dPromo = 0, promo = null;
    if (it.bundel_id) {
      const b = bundel.get(it.bundel_id); if (!b || !b.aktif || !berlaku(b)) throw new Error('Paket sudah tidak berlaku');
      nama = 'Paket ' + b.nama; harga = Number(b.harga); snama = 'paket';
      if (D.promo_bundel_item.some(x => x.bundel_id === b.id && keras.includes(produk.get(x.produk_id)?.golongan))) perlu = true;
    } else {
      pr = produk.get(it.produk_id); if (!pr) throw new Error('Produk tidak ada di data perangkat');
      sid = it.satuan_id || pr.satuan_id; harga = Number(pr.harga_jual);
      if (sid !== pr.satuan_id) { const s = (ps.get(pr.id) || []).find(x => x.satuan_id === sid); if (!s) throw new Error('Satuan tidak tersedia untuk ' + pr.nama); isi = Number(s.isi); harga = Number(s.harga_jual) > 0 ? Number(s.harga_jual) : harga * isi; }
      if (!(harga > 0)) throw new Error(`Produk ${pr.nama} belum punya harga jual`);
      snama = satuan.get(sid)?.nama; nama = pr.nama; gol = pr.golongan;
      if (keras.includes(gol) || pr.wajib_resep) perlu = true;
    }
    if (j && Number(j.markup_persen)) harga = rd(harga * (1 + Number(j.markup_persen) / 100));
    const bruto = harga * qty;
    if (pr) for (const x of D.promo_diskon) {
      if (!x.aktif || !berlaku(x) || Number(x.min_qty) > qty * isi || !(x.produk_id === pr.id || (x.produk_id === null && x.kategori_id !== null && x.kategori_id === pr.kategori_id))) continue;
      const pot = Math.min(bruto, x.jenis === 'persen' ? bruto * x.nilai / 100 : x.nilai * qty * isi);
      if (promo === null || pot > dPromo) { dPromo = pot; promo = x.id; }
    }
    dPromo = rd(dPromo);
    if (dp < 0 || dp > 100) throw new Error('Diskon tidak valid');
    if (dp > maks && !bebas) throw new Error(`Diskon maksimal ${maks} persen`);
    const dMan = rd((bruto - dPromo) * dp / 100), st = bruto - dPromo - dMan;
    sub += st;
    items.push({ produk_id: it.bundel_id ? null : pr.id, bundel_id: it.bundel_id || null, nama, golongan: gol, satuan_id: sid, satuan_nama: snama, isi, qty, harga, promo_id: promo, diskon_promo: dPromo, diskon_persen: dp, diskon_manual: dMan, subtotal: st });
  }
  let sisa = sub; const dPel = pel?.kategori_pelanggan_id ? rd(sub * Number(kp.get(pel.kategori_pelanggan_id)?.diskon_persen || 0) / 100) : 0;
  sisa -= dPel;
  let dNota = Number(p.diskon_nota || 0);
  if (dNota < 0) throw new Error('Diskon nota tidak valid');
  if (dNota > sub * maks / 100 && !bebas) throw new Error(`Diskon nota maksimal ${maks} persen dari subtotal`);
  dNota = Math.min(dNota, sisa); sisa -= dNota;
  const emb = Number(j?.embalase || 0), tus = Number(j?.tuslah || 0), dasar = Math.max(sisa + emb + tus, 0), k = Number(kj.pembulatan || 0), total = k > 0 ? Math.ceil(dasar / k) * k : rd(dasar);
  return { items, subtotal: sub, diskon_pelanggan: dPel, diskon_nota: dNota, potongan_voucher: 0, potongan_poin: 0, embalase: emb, tuslah: tus, pembulatan: total - dasar, total, stamp_didapat: 0, jasa_racik: 0, jasa_resep: 0, perlu_resep: perlu, wajib_resep: kj.wajib_resep_obat_keras ?? true };
}

// ---------- Antrean ----------
let urut = 0;
async function antrekan(jenis, data, uuid, lampiran) {
  if (!siap()) throw new Error('Perangkat ini belum disiapkan untuk offline');
  const a = { id: uuid, jenis, waktu: Date.now(), urut: Date.now() * 1000 + (urut++ % 1000), pengguna_id: S.pengguna.id, pengguna_nama: S.pengguna.nama, data: { ...data, uuid, perangkat_id: perangkat().id, pengguna_id: S.pengguna.id }, lampiran: lampiran || [], coba: 0, pesan: null };
  await simpanDb('antre', a);
  cadangkan(a);
  beritahu();
  return a;
}
export async function daftarAntre() { try { return (await semuaDb('antre')).sort((a, b) => a.urut - b.urut); } catch { return []; } }
const noOff = h => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${h}-${perangkat().id.slice(0, 4).toUpperCase()}-${String(d.getFullYear()).slice(2)}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };

export async function bukaSesiL(kasAwal) {
  const u = uuidBaru(), w = new Date().toISOString();
  await antrekan('sesi_buka', { kas_awal: kasAwal, shift_id: S.shift?.id ?? null, waktu: w }, u);
  S.sesi = { id: null, uuid: u, kode: noOff('S'), shift_nama: S.shift?.nama, pengguna_nama: S.pengguna.nama, dibuka: w, kas_awal: kasAwal, offline: true };
  simpanSesi(); return S.sesi;
}
export async function tutupSesiL(s, fisik, catatan) {
  await antrekan('sesi_tutup', { ...idSesi(s), kas_fisik: fisik, catatan, waktu: new Date().toISOString() }, uuidBaru());
  S.sesi = null; simpanSesi();
}
const idSesi = s => s.id ? { sesi_id: s.id } : { sesi_uuid: s.uuid };
export async function ringkasanLokal(s) {
  const j = (await daftarAntre()).filter(a => a.jenis === 'jual' && (s.id ? a.data.sesi_id === s.id : a.data.sesi_uuid === s.uuid));
  const jenis = Object.fromEntries(D.metode_bayar.map(m => [m.id, m])), per = {};
  let tunai = 0, kembali = 0, omzet = 0;
  for (const a of j) { omzet += a.data.hasil.total; kembali += a.data.kembalian; for (const b of a.data.bayar) { const m = jenis[b.metode_bayar_id]; per[m?.nama] = (per[m?.nama] || 0) + b.jumlah; if (m?.jenis === 'tunai') tunai += b.jumlah; } }
  return { transaksi: j.length, omzet, per_metode: per, tunai_masuk: tunai, kembalian: kembali };
}
export function simpanSesi() { if (S.pengguna) ls.tulis('apotek-sesi:' + S.pengguna.id, S.sesi || null); document.querySelectorAll('[data-info-sesi]').forEach(x => x.textContent = S.sesi ? S.sesi.kode : '-'); }
export const bacaSesi = () => ls.baca('apotek-sesi:' + S.pengguna?.id);

// Penjualan offline. Mengembalikan bentuk yang sama dengan bayar_penjualan, ditambah `struk` untuk dicetak.
export async function jualL(uuid, muatan, hasil, bayar, kembalian) {
  const jenis = Object.fromEntries(D.metode_bayar.map(m => [m.id, m]));
  if (bayar.some(b => !METODE_OFFLINE.includes(jenis[b.metode_bayar_id]?.jenis))) throw new Error('Saat offline hanya bisa tunai, QRIS, atau transfer.');
  if (muatan.pesanan_id) throw new Error('Pesanan tersimpan hanya bisa dibayar saat online.');
  const total = bayar.reduce((a, b) => a + b.jumlah, 0), tunai = bayar.filter(b => jenis[b.metode_bayar_id].jenis === 'tunai').reduce((a, b) => a + b.jumlah, 0);
  if (total < hasil.total) throw new Error('Pembayaran kurang');
  if (kembalian > tunai) throw new Error('Kembalian hanya bisa dari uang tunai');
  if (hasil.perlu_resep && hasil.wajib_resep && !muatan.dokter_id && !muatan.no_resep) throw new Error('Ada obat keras: isi dokter atau nomor resep.');
  const no = noOff('OFF'), w = new Date().toISOString(), { items, ...header } = muatan;
  await antrekan('jual', { no_offline: no, ...idSesi(S.sesi), waktu: w, header: { pelanggan_id: header.pelanggan_id, jenis_pelayanan_id: header.jenis_pelayanan_id, dokter_id: header.dokter_id, no_resep: header.no_resep, diskon_nota: header.diskon_nota }, items, hasil, bayar, kembalian }, uuid);
  kurangiStok(hasil.items);
  return { id: null, no, total: hasil.total, dibayar: total, kembalian, stamp_didapat: 0, offline: true,
    struk: { ...hasil, no, waktu: w, pengguna_nama: S.pengguna.nama, kembalian, outlet: D.outlet, no_resep: header.no_resep, status: 'selesai', pelanggan: ix().pelanggan.get(Number(header.pelanggan_id)), dokter: D.dokter.find(d => d.id === Number(header.dokter_id)),
      item: hasil.items.map((x, i) => ({ ...x, id: i })), bayar: bayar.map(b => ({ ...b, metode: jenis[b.metode_bayar_id] })) } };
}
export async function resepL(uuid, p, fotoBlob) {
  const no = noOff('RSP'), w = new Date().toISOString();
  if (!(p.pasien_nama || '').trim()) throw new Error('Nama pasien wajib diisi');
  if (!p.items.length) throw new Error('Resep belum ada obatnya');
  p.items.forEach((i, n) => { if (!(i.qty > 0)) throw new Error(`Jumlah pada R/ ke-${n + 1} harus lebih dari 0`); if (i.jenis === 'racikan' ? !i.komponen.length : !i.produk_id) throw new Error(`Lengkapi obat pada R/ ke-${n + 1}`); });
  await antrekan('resep', { no_offline: no, waktu: w, resep: p }, uuid, fotoBlob);
  return { ...p, id: null, no, tanggal: w.slice(0, 10), waktu: w, outlet_id: S.pengguna.outlet_id, offline: true, item: p.items.map((i, n) => ({ ...i, id: n + 1, urutan: n + 1, qty_ditebus: 0, produk: infoProdukL([i.produk_id])[i.produk_id],
    satuan: ix().satuan.get(i.satuan_id), komponen: (i.komponen || []).map(k => ({ ...k, produk: infoProdukL([k.produk_id])[k.produk_id] })) })) };
}

// ---------- Cadangan ke berkas PC lewat Agen Cetak (bila data browser terhapus) ----------
const keB64 = b => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); });
async function keTeks(a) { return JSON.stringify({ ...a, lampiran: await Promise.all(a.lampiran.map(async l => l instanceof Blob ? { b64: await keB64(l) } : l)) }); }
async function dariTeks(o) { return { ...o, lampiran: await Promise.all((o.lampiran || []).map(async l => l?.b64 ? await (await fetch(l.b64)).blob() : l)) }; }
async function keAgen(jalur, isi) { const r = await fetch(AGEN + jalur, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isi), signal: AbortSignal.timeout(4000) }); const j = await r.json(); if (!j.ok) throw new Error(j.pesan); return j; }
async function cadangkan(a) { try { await keAgen('/cadangan', { id: a.id, isi: await keTeks(a) }); await simpanDb('data', Date.now(), 'cadangan'); } catch { /* HP atau agen tidak menyala */ } }
const uuidSah = x => /^[0-9a-f-]{36}$/.test(x || '');
async function masukkan(list) {
  const ada = new Set((await semuaDb('antre')).map(a => a.id)); let n = 0;
  for (const o of list) if (uuidSah(o?.id) && ['jual', 'resep', 'sesi_buka', 'sesi_tutup'].includes(o.jenis) && o.data && !ada.has(o.id)) { await simpanDb('antre', await dariTeks(o)); n++; }
  if (n) beritahu();
  return n;
}
export async function pulihkanDariAgen() {
  try { const r = await fetch(AGEN + '/cadangan', { signal: AbortSignal.timeout(4000) }); const j = await r.json(); return j.ok ? await masukkan((j.isi || []).map(t => JSON.parse(t))) : 0; } catch { return 0; }
}
export async function unduhCadangan() {
  const isi = []; for (const a of await daftarAntre()) isi.push(JSON.parse(await keTeks(a)));
  const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([JSON.stringify({ apotek: 'salam', antre: isi })], { type: 'application/json' })); l.download = `cadangan-offline-${noOff('')}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 2000);
}
export async function pulihkanBerkas(file) { const o = JSON.parse(await file.text()); if (o.apotek !== 'salam') throw new Error('Bukan berkas cadangan aplikasi ini'); return masukkan(o.antre || []); }
export async function penyimpananTetap(minta = false) { try { if (minta && !await navigator.storage.persisted()) await navigator.storage.persist(); return await navigator.storage.persisted(); } catch { return false; } }

// ---------- Sinkron ----------
let sedangSinkron = false;
export const sinkronJalan = () => sedangSinkron;
export async function sinkron(manual = false) {
  if (sedangSinkron || KONEKSI.putus || !S.pengguna || !perangkat()) return;
  const jalan = async kunci => {
    if (!kunci) return;                       // tab lain sedang mengirim
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user?.id !== S.pengguna?.id) return;
    const antre = await daftarAntre(); if (!antre.length) return;
    sedangSinkron = true; beritahu(); let ok = 0, gagal = 0;
    try {
      for (const a of antre) {
        try {
          const d = { ...a.data };
          if (a.jenis === 'resep' && a.lampiran.length) {
            const foto = [];
            for (let i = 0; i < a.lampiran.length; i++) {
              const path = `${S.pengguna.outlet_id}/${hariIni().slice(0, 7)}/${a.id}-${i}.jpg`;
              const { error } = await sb.storage.from('resep').upload(path, a.lampiran[i], { contentType: 'image/jpeg' });
              if (error && !/exist|duplicate/i.test(error.message)) throw error;
              foto.push(path);
            }
            d.resep = { ...d.resep, foto };
          }
          const { data, error } = await sb.rpc({ jual: 'sinkron_penjualan', resep: 'sinkron_resep', sesi_buka: 'sinkron_sesi_buka', sesi_tutup: 'sinkron_sesi_tutup' }[a.jenis], { p: d });
          if (error) throw error;
          if (!data) throw new Error('Server tidak menjawab');
          if (a.jenis === 'sesi_buka' && S.sesi?.uuid === a.id) { S.sesi = { ...S.sesi, id: data.id, kode: data.kode, offline: false }; simpanSesi(); }
          await hapusDb('antre', a.id); ok++;
          keAgen('/cadangan/hapus', { id: a.id }).catch(() => {});
        } catch (e) {
          if (KONEKSI.putus || /Failed to fetch|NetworkError|Load failed|timeout/i.test(e.message || '')) break;
          gagal++; await simpanDb('antre', { ...a, coba: a.coba + 1, pesan: e.message || String(e) });
        }
      }
    } finally { sedangSinkron = false; beritahu(); }
    if (ok) { toast(`${ok} data offline tersinkron`, 'sukses'); unduhData(true).catch(() => {}); }
    if (gagal && (ok || manual)) toast(`${gagal} data perlu diperiksa di Mode Offline`, 'galat');
  };
  if (navigator.locks) return navigator.locks.request('apotek-sinkron', { ifAvailable: true }, jalan);
  return jalan(true);
}

// ---------- Masuk offline ----------
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function turunkan(sandi, garam) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(sandi), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(garam.match(/../g), x => parseInt(x, 16)), iterations: 600000 }, k, 256));
}
const profilAman = p => ({ id: p.id, username: p.username, nama: p.nama, aktif: p.aktif, outlet_id: p.outlet_id, peran: { nama: p.peran.nama, akses: p.peran.akses }, outlet: p.outlet });
// dipanggil setelah login online berhasil; sandi tidak disimpan, hanya sidiknya
export async function simpanAkun(p, sandi) {
  if (!perangkatAktif()) return;
  const lama = await bacaDb('akun', p.username), garam = sandi ? hex(crypto.getRandomValues(new Uint8Array(16))) : lama?.garam;
  await simpanDb('akun', { username: p.username, garam, sidik: sandi ? await turunkan(sandi, garam) : lama?.sidik, profil: profilAman(p), terakhir: Date.now(), salah: 0 });
}
export async function masukOffline(username, sandi) {
  if (!perangkatAktif()) throw new Error('Tidak ada internet, dan perangkat ini belum ditandai untuk offline.');
  const a = await bacaDb('akun', username);
  if (!a?.sidik) throw new Error('Akun ini belum pernah login online di perangkat ini.');
  if (a.kunci > Date.now()) throw new Error('Terlalu banyak salah. Coba lagi 5 menit lagi.');
  if (Date.now() - a.terakhir > MASA_LOGIN || a.terakhir > Date.now() + 36e5) throw new Error('Login offline sudah lewat 3 hari. Sambungkan internet lalu login.');
  if (await turunkan(sandi, a.garam) !== a.sidik) { const salah = (a.salah || 0) + 1; await simpanDb('akun', { ...a, salah: salah >= 5 ? 0 : salah, kunci: salah >= 5 ? Date.now() + 3e5 : 0 }); throw new Error('Username atau kata sandi salah.'); }
  await simpanDb('akun', { ...a, salah: 0, kunci: 0 });
  ls.tulis('apotek-aktif', { username, waktu: Date.now() });
  return a.profil;
}
// melanjutkan pengguna terakhir saat aplikasi dibuka tanpa internet
export async function lanjutOffline() {
  const k = ls.baca('apotek-aktif'); if (!perangkatAktif() || !k) return null;
  const a = await bacaDb('akun', k.username).catch(() => null);
  return a && Date.now() - a.terakhir <= MASA_LOGIN ? a.profil : null;
}
export const tandaiAktif = u => ls.tulis('apotek-aktif', u ? { username: u, waktu: Date.now() } : null);
// data pelanggan & produk dibuang bila perangkat dinonaktifkan; antrean tetap ada sampai terkirim
async function bersihkan() { D = null; indeks = null; await tx('data', 'readwrite', s => { s.clear(); }).catch(() => {}); await tx('akun', 'readwrite', s => { s.clear(); }).catch(() => {}); }

// ---------- Pendaftaran & putaran rutin ----------
export async function daftarkan(nama) {
  const id = perangkat()?.id || uuidBaru();
  const { error } = await sb.rpc('daftar_perangkat_offline', { p_id: id, p_nama: nama }); if (error) throw error;
  ls.tulis('apotek-perangkat', { id, nama, aktif: true });
  const tetap = await penyimpananTetap(true);
  await unduhData(true); await simpanAkun(S.pengguna);
  return tetap;
}
export async function periksaPerangkat() {
  const p = perangkat(); if (!p || KONEKSI.putus) return;
  const { data, error } = await sb.rpc('catat_perangkat', { p_id: p.id }); if (error) return;
  const aktif = !!data?.aktif;
  ls.tulis('apotek-perangkat', { ...p, nama: data?.nama || p.nama, aktif });
  if (!aktif) await bersihkan(); else await simpanAkun(S.pengguna).catch(() => {});
}
let pendengar = [];
export const saatBerubah = f => pendengar.push(f);
function beritahu() { pendengar.forEach(f => f()); }
KONEKSI.saatBerubah.push(() => { beritahu(); if (!KONEKSI.putus) setTimeout(() => sinkron(), 500); });

let mulaiSudah = false;
export async function mulaiOffline() {
  if (!perangkat()) return;
  await bacaSalinan();
  penyimpananTetap(true);
  const putar = async () => { if (KONEKSI.putus || !S.pengguna || document.hidden) return; try { await periksaPerangkat(); await sinkron(); if (perangkatAktif() && (!D || D.outlet_id !== S.pengguna.outlet_id || Date.now() - D.waktu > 15 * 6e4)) await unduhData(); } catch { /* dicoba lagi nanti */ } beritahu(); };
  await pulihkanDariAgen();
  if (!mulaiSudah) { mulaiSudah = true; setInterval(putar, 6e4); setInterval(() => { if (KONEKSI.putus) cekServer(); }, 10000); document.addEventListener('visibilitychange', () => { if (!document.hidden) putar(); }); }
  putar();
}
HOOK.offline = { siap, perangkatAktif, refL: (t, urut) => D?.[t] ? [...D[t]].sort((a, b) => a[urut] > b[urut] ? 1 : -1) : null, konfigL: () => D?.konfigurasi?.filter(x => x.kunci !== 'qris') };
