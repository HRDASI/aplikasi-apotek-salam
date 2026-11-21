// Home: sapaan, ikon modul (HP), ringkasan, aktivitas terakhir, pembaruan aplikasi.
import { rute, sb, S, bisa, bisaSalahSatu } from '../inti.js?v=1.0.1';
import { MENU, ITEM, MODUL_HP, LABEL_HP, ikon, NAMA_TAHAP } from '../menu.js?v=1.0.1';
import { esc, angka, waktu } from '../ui.js?v=1.0.1';

export const PEMBARUAN = [
  ['2026-11-22', 'Tahap 1 (Fondasi): login & hak akses, Master Data, Kontak, Multi Outlet, Pengaturan, Log Aktivitas.'],
  ['2026-11-22', 'Aplikasi bisa dibuka di PC, Android, dan iPhone, dan bisa dipasang ke layar utama HP.'],
];

rute('home', async el => {
  const nama = S.pengguna.nama.split(' ')[0];
  const modul = MODUL_HP.map(k => MENU.find(m => m.k === k)).filter(g => g && ITEM.some(i => i.url.startsWith(`#/${g.k}/`) && bisaSalahSatu(i.akses)));
  const urlPertama = g => (ITEM.find(i => i.url.startsWith(`#/${g.k}/`) && bisaSalahSatu(i.akses)) || {}).url;
  el.innerHTML = `
    <div class="ikon-modul hanya-hp">${modul.map(g => `<a href="#/modul/${g.k}"><span class="kotak">${ikon(g.i)}</span>${esc(LABEL_HP[g.k] || g.t)}</a>`).join('')}</div>
    <div class="grid-2 hanya-pc" style="margin-bottom:16px">
      <div class="sapaan"><div><h2>Halo ${esc(S.pengguna.nama)} 👋</h2>
        <p>Selamat datang di Aplikasi Apotek Salam. Semoga apotek kita makin berkah dan terus tumbuh.</p>
        <a class="tombol" href="#/pengguna/log">Aktivitas Saya</a></div><img src="img/lamlam.png" alt="Si Lamlam menyapa"></div>
      <div class="kartu"><div class="kepala-kartu teal">${ikon('info')} Ringkasan Data</div><div class="grid-2" data-ringkas>Memuat...</div></div>
    </div>
    <div class="kartu hanya-hp" style="margin-bottom:16px"><div class="kepala-kartu teal">Ringkasan Data</div><div class="grid-2" data-ringkas2 style="grid-template-columns:1fr 1fr"></div></div>
    <div class="grid-2">
      <div class="kartu"><div class="kepala-kartu oranye">Aktivitas Terakhir Akun Anda <a href="#/pengguna/log" style="margin-left:auto">${ikon('panah')}</a></div>
        <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>No.</th><th>Waktu</th><th>Aktivitas</th></tr></thead><tbody data-akt><tr><td colspan="3" class="kosong">Memuat...</td></tr></tbody></table></div></div>
      <div class="kartu"><div class="kepala-kartu teal">Update Aplikasi</div>
        <ul class="daftar-update">${PEMBARUAN.map(([t, x]) => `<li><time>${t.split('-').reverse().join('-')}</time><span>${esc(x)}</span></li>`).join('')}</ul>
        <p style="color:var(--teks-2);font-size:12.5px;margin:12px 0 0">Berikutnya: Tahap 2 – ${esc(NAMA_TAHAP[2])}.</p></div>
    </div>`;

  const { data: akt } = await sb.from('log_aktivitas').select('waktu,keterangan,aksi').eq('pengguna_id', S.pengguna.id).order('waktu', { ascending: false }).limit(5);
  el.querySelector('[data-akt]').innerHTML = (akt || []).length ? akt.map((r, i) => `<tr><td>${i + 1}</td><td style="white-space:nowrap">${waktu(r.waktu)}</td><td>${esc(r.keterangan || r.aksi)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="kosong">Belum ada aktivitas.</td></tr>';

  const hitung = async t => (await sb.from(t).select('id', { count: 'exact', head: true })).count ?? 0;
  const [produk, pelanggan, supplier, pengguna] = await Promise.all(['produk', 'pelanggan', 'supplier', 'pengguna'].map(hitung));
  const kotak = (l, v, url) => `<a href="${url}" class="statistik" style="text-decoration:none;color:inherit"><small>${l}</small><b>${angka(v)}</b></a>`;
  const html = kotak('Produk', produk, '#/persediaan/produk') + kotak('Pelanggan', pelanggan, '#/kontak/pelanggan') + kotak('Supplier', supplier, '#/kontak/supplier') + kotak('Pengguna', pengguna, '#/pengguna/daftar');
  el.querySelector('[data-ringkas]').innerHTML = html;
  el.querySelector('[data-ringkas2]').innerHTML = html;
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
      <a href="#/keluar" style="display:flex;gap:12px;padding:14px 18px;text-decoration:none;color:var(--merah)">${ikon('keluar')} Keluar</a></div>`;
  return 'Menu Lainnya';
});

// Halaman untuk menu yang dibuat di tahap berikutnya
export function halamanSegera(item) {
  return el => {
    el.innerHTML = `<div class="kartu segera"><div class="ikon-besar">${ikon(item.ikon)}</div>
      <h3>${esc(item.judul)}</h3>
      <p>Menu ini dibuat di <b>Tahap ${item.tahap}: ${esc(NAMA_TAHAP[item.tahap])}</b>. Saat ini sudah selesai Tahap 1 (Fondasi).</p></div>`;
  };
}
