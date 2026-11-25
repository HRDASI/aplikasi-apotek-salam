// Home: sapaan, ikon modul (HP), ringkasan, aktivitas terakhir, pembaruan aplikasi.
import { rute, sb, S, bisa, bisaSalahSatu } from '../inti.js?v=1.19.0';
import { MENU, ITEM, MODUL_HP, LABEL_HP, ikon, NAMA_TAHAP } from '../menu.js?v=1.19.0';
import { esc, angka, rupiah, waktu } from '../ui.js?v=1.19.0';

export const PEMBARUAN = [
  ['2026-11-25', 'Kasir: tombol Layar penuh (F11). Akun Kasir langsung ke halaman Kasir dalam layar penuh.'],
  ['2026-11-25', 'Logo Apotek Salam tanpa latar di ikon aplikasi, layar masuk, menu, kartu member, dan cetakan.'],
  ['2026-11-25', 'Cadangan Data: salinan database otomatis 5 kali sehari ke Google Drive, dengan status dan peringatan bila terlambat.'],
  ['2026-11-25', 'Kasir: obat keras tidak lagi wajib diisi dokter atau nomor resep. OKT, psikotropika, dan narkotika tetap wajib.'],
  ['2026-11-25', 'Integrasi Kinerja: nilai triwulan dan nilai ujian dari aplikasi Kinerja bisa dipakai sebagai parameter KPI.'],
  ['2026-11-25', 'Manajemen KPI: parameter dan bobot per jabatan, target karyawan, nilai otomatis dan manual, laporan, serta KPI Saya.'],
  ['2026-11-25', 'Gaji Karyawan: setting gaji, gaji pokok, tunjangan, potongan, kasbon, perhitungan dari presensi, pembayaran, dan slip gaji.'],
  ['2026-11-25', 'Laporan Penjualan per Shift, retur langsung dari layar Kasir, dan barcode nota di struk yang bisa di-scan untuk retur.'],
  ['2026-11-25', 'Data Karyawan, Jadwal Kerja (impor Excel), Riwayat & Laporan Presensi dari aplikasi Absensi, serta pengajuan Izin, Sakit & Cuti.'],
  ['2026-11-24', 'Impor Data dari Excel/CSV (produk, supplier, pelanggan, stok awal, utang, piutang) di Pengaturan → Impor Data.'],
  ['2026-11-24', 'Mode offline: kasir dan resep baru tetap jalan saat internet putus, lalu terkirim otomatis. Perangkat ditandai di Pengaturan → Mode Offline & Sinkron.'],
  ['2026-11-24', 'Tampilan baru HP & laptop, beranda berisi ringkasan hari ini, aplikasi lebih cepat dibuka, dan tanggal mulai pembukuan bisa diatur.'],
  ['2026-11-24', 'Tahap 5: Keuangan (akun kas, buku kas, utang, piutang & batas kredit), Akuntansi (jurnal otomatis, buku besar, aktiva tetap, kunci periode), Dashboard, Laporan, dan Analisis.'],
  ['2026-11-24', 'Cetak label barcode/harga produk dari Persediaan → Daftar Produk, langsung ke printer label.'],
  ['2026-11-24', 'Tahap 4: Pelayanan Apotek — resep (foto + ketik, skrining, racikan), tebus di kasir (jasa racik + %), etiket & copy resep, swamedikasi, HPC, PIO, MESO, konseling, catatan pengobatan. Agen Cetak: struk & etiket langsung ke printer.'],
  ['2026-11-23', 'QRIS BRI terpasang di kasir. Program member model stamp: kartu member digital + link, kirim WhatsApp, katalog hadiah, tukar stamp.'],
  ['2026-11-23', 'Tahap 3: Kasir dengan sesi (kas awal & tutup sesi), struk 58/80 mm, pembayaran campur & QRIS, pesanan, retur, penjualan tertolak, promo (diskon, paket, voucher, member/poin).'],
  ['2026-11-22', 'Login memilih Shift. Pemilik/Admin boleh masuk tanpa shift (diatur di Peran & Hak Akses).'],
  ['2026-11-22', 'PPN di faktur bisa dipilih (belum termasuk / sudah termasuk / tidak kena PPN) dengan tarif dari Master Pajak. Peringatan stok: hampir ED, berpotensi rugi, stok menipis/habis, belum ada harga jual.'],
  ['2026-11-22', 'Tahap 2: Persediaan (stok per batch & ED, kartu stok, defecta, opname, penyesuaian, pindah stok), Pembelian (rencana, SP, faktur, retur), Konsinyasi.'],
  ['2026-11-22', 'Tahap 1 (Fondasi): login & hak akses, Master Data, Kontak, Multi Outlet, Pengaturan, Log Aktivitas.'],
  ['2026-11-22', 'Aplikasi bisa dibuka di PC, Android, dan iPhone, dan bisa dipasang ke layar utama HP.'],
];

const JENIS = [['ed', 'Hampir / sudah ED', 'merah'], ['rugi', 'Berpotensi rugi', 'merah'], ['menipis', 'Stok menipis', 'oranye'], ['habis', 'Stok habis', 'oranye'], ['harga', 'Belum ada harga jual', 'oranye']];
const salam = () => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam'; };
const tglLokal = n => { const d = new Date(Date.now() - n * 864e5); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const CEPAT = [['penjualan.kasir', 'kasir', 'Buka Kasir'], ['pelayanan.penerimaan_resep', 'pelayanan', 'Terima Resep'], ['pembelian.faktur', 'pembelian', 'Input Faktur'], ['persediaan.produk', 'produk', 'Cek Stok'], ['persediaan.defecta', 'persediaan', 'Defecta'], ['keuangan.buku_kas', 'keuangan', 'Buku Kas'], ['dashboard.penjualan', 'dashboard', 'Dashboard']];

rute('home', async el => {
  const modul = MODUL_HP.map(k => MENU.find(m => m.k === k)).filter(g => g && ITEM.some(i => i.url.startsWith(`#/${g.k}/`) && bisaSalahSatu(i.akses)));
  const lihatJual = bisaSalahSatu(['laporan.penjualan', 'dashboard.umum', 'dashboard.penjualan', 'keuangan.laba']), lihatStok = bisaSalahSatu(['persediaan.peringatan', 'persediaan.lihat']);
  const cepat = CEPAT.map(([k, i, t]) => [ITEM.find(x => x.kunci === k), i, t]).filter(([x]) => x && bisaSalahSatu(x.akses)).slice(0, 6);
  const baru = PEMBARUAN.map(([t, x]) => `<li><time>${t.split('-').reverse().join('-')}</time><span>${esc(x)}</span></li>`);
  el.innerHTML = `
    <div class="ikon-modul hanya-hp">${modul.map(g => `<a href="#/modul/${g.k}"><span class="kotak">${ikon(g.i)}</span>${esc(LABEL_HP[g.k] || g.t)}</a>`).join('')}</div>
    <div class="sapaan hanya-pc"><div><p class="kecil">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>${salam()}, ${esc(S.pengguna.nama)} 👋</h2>
      <p>Mau mulai dari mana hari ini?</p><div class="aksi-cepat">${cepat.map(([x, i, t]) => `<a href="${x.url}">${ikon(i)} ${esc(t)}</a>`).join('')}</div></div><img src="img/lamlam.png" alt="Si Lamlam menyapa" width="190" height="190"></div>
    <div data-cadangan></div>
    ${lihatJual ? '<div class="kartu blok"><div class="kepala-blok"><h3>Penjualan hari ini</h3><a href="#/dashboard/penjualan">Lihat dashboard</a></div><div class="angka-utama" data-hari><div class="kerangka-muat"><i></i></div><div class="kerangka-muat"><i></i></div><div class="kerangka-muat"><i></i></div></div></div>' : ''}
    ${lihatStok ? `<div class="kartu blok"><div class="kepala-blok"><h3>Perlu perhatian</h3><a href="#/persediaan/peringatan">Lihat semua</a></div><div class="perhatian" data-perhatian>${JENIS.map(() => '<div class="kerangka-muat"><i></i></div>').join('')}</div></div>` : ''}
    <div class="grid-2 blok">
      <div class="kartu"><div class="kepala-blok"><h3>Aktivitas terakhir Anda</h3><a href="#/pengguna/log">Semua</a></div><ul class="daftar-akt" data-akt><li class="kerangka-muat"><i></i></li><li class="kerangka-muat"><i></i></li></ul></div>
      <div class="kartu" style="margin:0"><div class="kepala-blok"><h3>Data apotek</h3></div><div class="grid-data" data-ringkas><div class="kerangka-muat"><i></i></div></div>
        <div class="kepala-blok" style="margin-top:18px"><h3>Yang baru</h3></div><ul class="daftar-update">${baru.slice(0, 2).join('')}</ul><details><summary>Pembaruan sebelumnya</summary><ul class="daftar-update">${baru.slice(2).join('')}</ul></details>
        <p style="color:var(--teks-2);font-size:12.5px;margin:12px 0 0">Berikutnya: Tahap 6 – ${esc(NAMA_TAHAP[6])}.</p></div>
    </div>`;
  const isi = (s, f) => { const x = el.querySelector(s); if (x) f(x); };

  if (bisa('pengaturan.cadangan')) sb.rpc('status_cadangan').then(({ data }) => { if (data?.terlambat) isi('[data-cadangan]', x => { x.innerHTML = '<p class="pesan galat">Cadangan data belum berjalan lebih dari 14 jam. <a href="#/pengaturan/cadangan">Periksa</a></p>'; }); });
  // tiap blok dimuat sendiri-sendiri; yang lambat/gagal tidak menahan yang lain
  if (lihatJual) (async () => {
    const ambil = async t => { const { data, error } = await sb.rpc('lap_penjualan', { p_dari: t, p_sampai: t, p_kelompok: 'total', p_outlet: null }); if (error) throw error; return data[0] || { trx: 0, netto: 0, laba: 0 }; };
    const [h, k] = await Promise.all([ambil(tglLokal(0)), ambil(tglLokal(1))]), beda = Number(h.netto) - Number(k.netto);
    isi('[data-hari]', x => { x.innerHTML = `<div><small>Omzet bersih</small><b>${rupiah(h.netto)}</b><span class="${beda < 0 ? 'turun' : 'naik'}">${!beda && Number(k.netto) ? 'Sama dengan kemarin' : Number(k.netto) ? (beda < 0 ? '▼ ' : '▲ ') + rupiah(Math.abs(beda)) + ' dari kemarin' : 'Kemarin belum ada penjualan'}</span></div>
      <div><small>Transaksi</small><b>${angka(h.trx)}</b><span>kemarin ${angka(k.trx)}</span></div>
      ${bisa('keuangan.laba') ? `<div><small>Laba kotor</small><b>${rupiah(h.laba)}</b><span>kemarin ${rupiah(k.laba)}</span></div>` : `<div><small>Rata-rata per nota</small><b>${rupiah(Number(h.trx) ? h.netto / h.trx : 0)}</b><span>&nbsp;</span></div>`}`; });
  })().catch(() => isi('[data-hari]', x => { x.innerHTML = '<p class="kosong">Ringkasan belum bisa dimuat.</p>'; }));
  if (lihatStok) import('./persediaan.js?v=1.19.0').then(m => m.hitungPeringatan()).then(j => isi('[data-perhatian]', x => {
    x.innerHTML = Object.values(j).some(Boolean) ? JENIS.map(([k, l, w]) => `<a href="#/persediaan/peringatan/${k}" class="statistik ${j[k] ? w : 'aman'}"><small>${esc(l)}</small><b>${j[k] ? angka(j[k]) : '✓'}</b></a>`).join('') : '<p class="aman-semua">✓ Semua stok aman, tidak ada yang perlu ditindaklanjuti.</p>';
  })).catch(() => isi('[data-perhatian]', x => { x.textContent = 'Peringatan belum bisa dimuat.'; }));
  sb.from('log_aktivitas').select('waktu,keterangan,aksi').eq('pengguna_id', S.pengguna.id).order('waktu', { ascending: false }).limit(5).then(({ data }) => isi('[data-akt]', x => {
    x.innerHTML = (data || []).length ? data.map(r => `<li><span>${esc(r.keterangan || r.aksi)}</span><time>${waktu(r.waktu)}</time></li>`).join('') : '<li class="kosong">Belum ada aktivitas.</li>';
  }));
  Promise.all([['produk', 'Produk', '#/persediaan/produk'], ['pelanggan', 'Pelanggan', '#/kontak/pelanggan'], ['supplier', 'Supplier', '#/kontak/supplier'], ['pengguna', 'Pengguna', '#/pengguna/daftar']].map(async ([t, l, u]) => {
    const { count } = await sb.from(t).select('id', { count: 'exact', head: true }); return `<a href="${u}" class="statistik"><small>${l}</small><b>${angka(count ?? 0)}</b></a>`;
  })).then(h => isi('[data-ringkas]', x => { x.innerHTML = h.join(''); })).catch(() => {});
});

// Halaman daftar submenu satu modul (untuk HP)
rute('modul', async (el, [k]) => {
  const g = MENU.find(m => m.k === k);
  if (!g) { location.hash = '#/home'; return; }
  const item = ITEM.filter(i => i.url.startsWith(`#/${k}/`) && bisaSalahSatu(i.akses));
  el.innerHTML = `<div class="kartu" style="padding:6px 0">${item.map(i => `<a href="${i.url}" style="display:flex;align-items:center;gap:12px;padding:14px 18px;text-decoration:none;color:var(--teks);border-bottom:1px solid var(--garis)">
    <span>${esc(i.judul)}</span>${i.tahap > 1 ? `<span class="chip oranye" style="margin-left:auto">Tahap ${i.tahap}</span>` : `<span style="margin-left:auto;color:var(--teks-2)">${ikon('panah')}</span>`}</a>`).join('')}</div>`;
  return g.t;
});

// Semua menu (tombol "Lainnya" di HP)
rute('lainnya', async el => {
  const grup = MENU.filter(g => g.anak && g.anak.some(([a]) => bisaSalahSatu(ITEM.find(i => i.kunci === `${g.k}.${a}`).akses)));
  el.innerHTML = `<div class="ikon-modul" style="margin-top:-14px">${grup.map(g => `<a href="#/modul/${g.k}"><span class="kotak">${ikon(g.i)}</span>${esc(LABEL_HP[g.k] || g.t)}</a>`).join('')}</div>
    <div class="kartu" style="padding:6px 0">
      <a href="#/akun" style="display:flex;gap:12px;padding:14px 18px;text-decoration:none;color:var(--teks);border-bottom:1px solid var(--garis)">${ikon('kunci')} Ganti Kata Sandi</a>
      <a href="#/ganti-shift" style="display:flex;gap:12px;padding:14px 18px;text-decoration:none;color:var(--teks);border-bottom:1px solid var(--garis)">${ikon('muat')} Ganti Shift <small style="margin-left:auto;color:var(--teks-2)">${esc(S.shift?.nama || '')}</small></a>
      <a href="#/keluar" style="display:flex;gap:12px;padding:14px 18px;text-decoration:none;color:var(--merah)">${ikon('keluar')} Keluar</a></div>`;
  return 'Menu Lainnya';
});

// Halaman untuk menu yang dibuat di tahap berikutnya
export function halamanSegera(item) {
  return el => {
    el.innerHTML = `<div class="kartu segera"><div class="ikon-besar">${ikon(item.ikon)}</div>
      <h3>${esc(item.judul)}</h3>
      <p>Menu ini dibuat di <b>Tahap ${item.tahap}: ${esc(NAMA_TAHAP[item.tahap])}</b>. Saat ini sudah selesai sampai Tahap 5.</p></div>`;
  };
}
