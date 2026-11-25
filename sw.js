// Service worker: berkas aplikasi (ber-versi) dibaca dari HP dulu supaya cepat; halaman utama selalu dicek ke server.
// Data (Supabase) tidak di-cache, selalu diambil langsung dari server.
const C = 'apotek-salam-1.25.0', LUAR = 'apotek-luar-1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'js/app.js?v=1.25.0', 'js/beranda-isi.js?v=1.25.0', 'js/beranda.js?v=1.25.0', 'js/cetak.js?v=1.25.0', 'js/config.js?v=1.25.0', 'js/crud.js?v=1.25.0', 'js/dokumen.js?v=1.25.0', 'js/fokus.js?v=1.25.0', 'js/inti.js?v=1.25.0', 'js/label.js?v=1.25.0', 'js/menu.js?v=1.25.0', 'js/offline.js?v=1.25.0', 'js/panduan-isi.js?v=1.25.0', 'js/struk.js?v=1.25.0', 'js/tabel.js?v=1.25.0', 'js/ui.js?v=1.25.0', 'js/unduh.js?v=1.25.0', 'js/halaman/akuntansi.js?v=1.25.0', 'js/halaman/beranda-kelola.js?v=1.25.0', 'js/halaman/cadangan.js?v=1.25.0', 'js/halaman/dashboard.js?v=1.25.0', 'js/halaman/ekspor.js?v=1.25.0', 'js/halaman/gaji.js?v=1.25.0', 'js/halaman/home.js?v=1.25.0', 'js/halaman/impor.js?v=1.25.0', 'js/halaman/jadwal-excel.js?v=1.25.0', 'js/halaman/keuangan.js?v=1.25.0', 'js/halaman/konsinyasi.js?v=1.25.0', 'js/halaman/kpi.js?v=1.25.0', 'js/halaman/laporan.js?v=1.25.0', 'js/halaman/master.js?v=1.25.0', 'js/halaman/member.js?v=1.25.0', 'js/halaman/offline.js?v=1.25.0', 'js/halaman/panduan.js?v=1.25.0', 'js/halaman/pelayanan.js?v=1.25.0', 'js/halaman/pembelian.js?v=1.25.0', 'js/halaman/pengaturan.js?v=1.25.0', 'js/halaman/pengguna.js?v=1.25.0', 'js/halaman/penjualan.js?v=1.25.0', 'js/halaman/persediaan.js?v=1.25.0', 'js/halaman/presensi.js?v=1.25.0', 'js/halaman/program.js?v=1.25.0', 'js/halaman/promo.js?v=1.25.0', 'js/halaman/retur.js?v=1.25.0', 'js/halaman/shift.js?v=1.25.0', 'js/halaman/struk.js?v=1.25.0', 'css/app.css?v=1.25.0', 'img/logo-b-256.png', 'img/logo-b-tebal.png', 'img/lamlam.png', 'img/salma.png'];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  // simpan satu versi sebelumnya: halaman yang masih terbuka belum dimuat ulang
  e.waitUntil(caches.keys().then(ks => { const app = ks.filter(k => k.startsWith('apotek-salam-') && k !== C); return Promise.all(app.slice(0, -1).map(k => caches.delete(k))); }).then(() => self.clients.claim()));
});
const simpan = (nama, req, r) => { if (r.ok) { const cp = r.clone(); caches.open(nama).then(c => c.put(req, cp)).catch(() => {}); } return r; };
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (CDN.includes(u.hostname)) {
    e.respondWith(caches.match(u.href).then(r => r || fetch(new Request(u.href, { mode: 'cors', credentials: 'omit' })).then(x => simpan(LUAR, u.href, x)).catch(() => fetch(e.request))));
    return;
  }
  if (u.origin !== location.origin) return;
  if (u.searchParams.has('v') || u.pathname.includes('/img/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => simpan(C, e.request, x))));
    return;
  }
  e.respondWith(fetch(e.request).then(x => simpan(C, e.request, x)).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
