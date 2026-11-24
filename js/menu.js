// Struktur menu aplikasi. `tahap` = tahap pengerjaan (1 = sudah jadi).
// Kunci akses: '<grup>.<item>'. Peran dengan akses '<grup>' otomatis boleh semua item di grup itu.

const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  dashboard: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  penjualan: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  pelayanan: '<rect x="3" y="8" width="10" height="8" rx="4"/><path d="M8 8v8"/><circle cx="17.5" cy="12" r="3.5"/><path d="M15 14.5l5-5"/>',
  persediaan: '<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-8h10v8"/><path d="M7 17h10"/>',
  pembelian: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  konsinyasi: '<path d="M3 20V8h4v12M7 12h10v8M17 16h4v4"/><path d="M10 12V6h4v6"/>',
  promo: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  keuangan: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 15h2"/>',
  akuntansi: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2"/>',
  kontak: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 18c1-3 9-3 10 0"/>',
  laporan: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  analisis: '<path d="M5 19c3-1 4-3 5-6l3 3c3-1 5-5 6-11-6 1-10 3-11 6l3 3c-3 1-5 2-6 5z"/>',
  pengguna: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><circle cx="18" cy="15" r="2.5"/><path d="M18 11v1.5M18 17.5V19M14.5 15H16M20 15h1.5"/>',
  gaji: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v6M18 9v6"/>',
  kpi: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  pengaturan: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  outlet: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/>',
  master: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  panah: '<path d="M9 6l6 6-6 6"/>',
  kiri: '<path d="M15 6l-6 6 6 6"/>',
  cari: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  tambah: '<path d="M12 5v14M5 12h14"/>',
  ubah: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  hapus: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  tutup: '<path d="M6 6l12 12M18 6L6 18"/>',
  lonceng: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  akun: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3.5"/><path d="M5.5 18.5c1.5-2.5 3.8-3.5 6.5-3.5s5 1 6.5 3.5"/>',
  muat: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  keluar: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  kunci: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unduh: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  produk: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h3M8 12h3M8 16h3M14 8h2M14 12h2M14 16h2"/>',
  kasir: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M6 10V5h8v5M16 10V7h3v3M7 14h2M11 14h2M15 14h2M7 17h10"/>',
  lainnya: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bantuan: '<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5M12 17h0"/>',
  barcode: '<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h0"/>',
};
export const ikon = (n, cls = '') => `<svg class="ik ${cls}" viewBox="0 0 24 24">${P[n] || P.info}</svg>`;

export const MENU = [
  { k: 'home', t: 'Home', i: 'home', url: '#/home', tahap: 1 },
  { k: 'dashboard', t: 'Dashboard', i: 'dashboard', anak: [
    ['umum', 'Dashboard Umum', 1], ['penjualan', 'Dashboard Penjualan', 1], ['pembelian', 'Dashboard Pembelian', 1],
    ['persediaan', 'Dashboard Persediaan', 1], ['keuangan', 'Dash. Keuangan', 1, null, ['keuangan.laba']]] },
  { k: 'penjualan', t: 'Penjualan', i: 'penjualan', anak: [
    ['kasir', 'Kasir', 1], ['pesanan', 'Pesanan Penjualan', 1], ['daftar', 'Daftar Penjualan', 1],
    ['retur', 'Retur Penjualan', 1], ['tertolak', 'Penjualan Tertolak', 1], ['qris', 'QRIS', 1]] },
  { k: 'pelayanan', t: 'Pelayanan Apotek', i: 'pelayanan', anak: [
    ['penerimaan_resep', 'Penerimaan Resep', 1], ['penebusan_resep', 'Penebusan Resep', 1, ['penjualan.kasir']], ['racikan', 'Template Racikan', 1],
    ['swamedikasi', 'Swamedikasi', 1], ['hpc', 'Home Pharmacy Care', 1], ['pio', 'Pel. Informasi Obat', 1],
    ['meso', 'MESO', 1], ['catatan', 'Catatan Pengobatan', 1], ['konseling', 'Konseling', 1]] },
  { k: 'persediaan', t: 'Persediaan', i: 'persediaan', anak: [
    ['produk', 'Daftar Produk', 1, ['persediaan.lihat']], ['peringatan', 'Peringatan Stok', 1, ['persediaan.lihat']], ['defecta', 'Defecta', 1], ['kedaluwarsa', 'Stok Kedaluwarsa', 1],
    ['opname', 'Stok Opname', 1], ['penyesuaian', 'Penyesuaian Stok', 1], ['perpindahan', 'Perpindahan Stok', 1]] },
  { k: 'pembelian', t: 'Pembelian', i: 'pembelian', anak: [
    ['rencana', 'Rencana Pembelian', 1], ['pesanan', 'Pesanan Pembelian', 1], ['faktur', 'Faktur Pembelian', 1], ['retur', 'Retur Pembelian', 1]] },
  { k: 'konsinyasi', t: 'Konsinyasi Masuk', i: 'konsinyasi', anak: [
    ['masuk', 'Konsinyasi Masuk', 1], ['status', 'Status Konsinyasi', 1], ['retur', 'Retur Konsinyasi', 1], ['stok', 'Stok Konsinyasi', 1]] },
  { k: 'promo', t: 'Program Promo', i: 'promo', anak: [
    ['bundel', 'Bundel/Paket Produk', 1], ['diskon', 'Diskon Produk', 1], ['voucher', 'Voucher Diskon', 1], ['member', 'Program Member', 1]] },
  { k: 'keuangan', t: 'Keuangan', i: 'keuangan', anak: [
    ['akun_kas', 'Daftar Akun Kas', 1], ['buku_kas', 'Buku Kas', 1], ['utang', 'Utang Usaha', 1], ['piutang', 'Piutang Usaha', 1]] },
  { k: 'akuntansi', t: 'Akuntansi', i: 'akuntansi', anak: [
    ['akun', 'Daftar Akun', 1], ['buku_besar', 'Buku Besar', 1], ['aktiva', 'Aktiva Tetap', 1]] },
  { k: 'kontak', t: 'Kontak', i: 'kontak', anak: [
    ['pelanggan', 'Pelanggan', 1], ['sales', 'Sales/Pelayan', 1], ['dokter', 'Dokter', 1], ['supplier', 'Supplier', 1]] },
  { k: 'laporan', t: 'Laporan', i: 'laporan', anak: [
    ['penjualan', 'Laporan Penjualan', 1], ['pembelian', 'Laporan Pembelian', 1], ['persediaan', 'Laporan Persediaan', 1],
    ['keuangan', 'Laporan Keuangan', 1, null, ['keuangan.laba']], ['presensi', 'Laporan Presensi', 6]] },
  { k: 'analisis', t: 'Analisis', i: 'analisis', anak: [
    ['pareto', 'Analisis Pareto', 1], ['pembelian', 'Analisis Pembelian', 1], ['harga', 'Analisis Harga', 1, null, ['keuangan.laba']]] },
  { k: 'pengguna', t: 'Manajemen Pengguna', i: 'pengguna', anak: [
    ['daftar', 'Daftar Pengguna', 1], ['peran', 'Peran & Hak Akses', 1], ['jadwal', 'Jadwal Kerja', 6],
    ['presensi', 'Riwayat Presensi', 6], ['sesi', 'Riwayat Shift/Sesi', 1, ['penjualan.kasir']], ['log', 'Log Aktivitas', 1, ['*semua']]] },
  { k: 'gaji', t: 'Gaji Karyawan', i: 'gaji', anak: [
    ['pokok', 'Daftar Gaji Pokok', 6], ['tunjangan', 'Daftar Tunjangan', 6], ['potongan', 'Daftar Potongan Gaji', 6],
    ['hitung', 'Perhitungan Gaji', 6], ['bayar', 'Pembayaran Gaji', 6]] },
  { k: 'kpi', t: 'Manajemen KPI', i: 'kpi', anak: [
    ['parameter', 'Parameter KPI', 6], ['karyawan', 'KPI Karyawan', 6], ['pencapaian', 'Pencapaian KPI', 6], ['laporan', 'Laporan KPI', 6]] },
  { k: 'pengaturan', t: 'Pengaturan', i: 'pengaturan', anak: [
    ['profil', 'Profil Bisnis', 1], ['metode_bayar', 'Metode Pembayaran', 1], ['konfigurasi', 'Konfigurasi', 1], ['printer', 'Printer & Cetak', 1, ['*semua']], ['integrasi', 'Integrasi Platform Lain', 6]] },
  { k: 'outlet', t: 'Multi Outlet', i: 'outlet', anak: [['daftar', 'Daftar Outlet', 1]] },
  { k: 'master', t: 'Master Data', i: 'master', anak: [
    ['produk', 'Master Produk', 1], ['kategori', 'Master Kategori', 1], ['satuan', 'Master Satuan', 1], ['rak', 'Master Rak', 1],
    ['gudang', 'Master Gudang', 1], ['kategori_pelanggan', 'Master Kategori Pelanggan', 1], ['jenis_pelayanan', 'Jenis Pelayanan', 1],
    ['pajak', 'Master Pajak', 1], ['shift', 'Master Shift', 1]] },
];

export const NAMA_TAHAP = {
  1: 'Fondasi', 2: 'Persediaan, Pembelian & Konsinyasi', 3: 'Penjualan & Program Promo',
  4: 'Pelayanan Apotek', 5: 'Keuangan, Akuntansi, Dashboard, Laporan & Analisis', 6: 'Gaji, KPI, Presensi & Integrasi',
};

// Daftar datar semua item: { kunci, url, judul, grup, ikon, tahap, akses[] }
export const ITEM = [];
for (const g of MENU) {
  if (!g.anak) { ITEM.push({ kunci: g.k, url: g.url, judul: g.t, grup: g.t, ikon: g.i, tahap: g.tahap, akses: [g.k] }); continue; }
  // khusus = kunci pengganti: menu berisi laba/HPP tidak ikut terbuka oleh akses grup biasa
  for (const [k, t, tahap, alt, khusus] of g.anak) {
    const kunci = `${g.k}.${k}`;
    ITEM.push({ kunci, url: `#/${g.k}/${k}`, judul: t, grup: g.t, ikon: g.i, tahap, akses: khusus || [kunci, ...(alt || [])] });
  }
}

// Ikon modul di beranda HP (urutan seperti aplikasi lama)
export const MODUL_HP = ['penjualan', 'pembelian', 'keuangan', 'laporan', 'pengguna', 'persediaan', 'konsinyasi', 'kontak', 'analisis', 'pelayanan',
  'promo', 'akuntansi', 'dashboard', 'gaji', 'kpi', 'master', 'outlet', 'pengaturan'];
export const LABEL_HP = { pengguna: 'Pengguna', pelayanan: 'Pelayanan Apotek', konsinyasi: 'Konsinyasi', promo: 'Promo', master: 'Master Data', outlet: 'Outlet', kpi: 'KPI', gaji: 'Gaji' };
