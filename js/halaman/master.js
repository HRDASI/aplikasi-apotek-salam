// Master Data, Kontak, Multi Outlet, Metode Pembayaran: memakai halamanCrud.
import { rute, sb, ambilRef } from '../inti.js?v=1.19.0';
import { halamanCrud } from '../crud.js?v=1.19.0';
import { esc, rupiah, angka, toast } from '../ui.js?v=1.19.0';
import { bukaKartu } from './member.js?v=1.19.0';

export const GOLONGAN = [
  ['bebas', 'Obat Bebas'], ['bebas_terbatas', 'Obat Bebas Terbatas'], ['keras', 'Obat Keras (K)'], ['okt', 'OKT'],
  ['psikotropika', 'Psikotropika'], ['narkotika', 'Narkotika'], ['jamu', 'Jamu/Herbal'], ['suplemen', 'Suplemen'],
  ['alkes', 'Alat Kesehatan'], ['kosmetik', 'Kosmetik'], ['lainnya', 'Lainnya'],
];
const namaGol = g => (GOLONGAN.find(x => x[0] === g) || [, g])[1];

// ---------- Produk ----------
async function satuanLainHtml(baris) {
  const satuan = await ambilRef('satuan');
  let rows = [];
  if (baris) {
    const { data } = await sb.from('produk_satuan').select('*').eq('produk_id', baris.id).order('isi');
    rows = data || [];
  }
  const opsi = v => satuan.map(s => `<option value="${s.id}" ${String(s.id) === String(v) ? 'selected' : ''}>${esc(s.nama)}</option>`).join('');
  const baris1 = r => `<tr>
    <td><select name="_ps_satuan" class="input">${opsi(r.satuan_id)}</select></td>
    <td><input name="_ps_isi" class="input" type="number" step="any" min="0.0001" value="${r.isi ?? ''}" placeholder="mis. 10"></td>
    <td><input name="_ps_harga" class="input" type="number" step="any" min="0" value="${r.harga_jual ?? ''}"></td>
    <td><input name="_ps_barcode" class="input" value="${esc(r.barcode ?? '')}"></td>
    <td><button type="button" class="ikon-aksi hapus" data-hapus-ps>✕</button></td></tr>`;
  window.__barisPS = baris1;
  return `<div style="margin-top:4px">
    <b>Satuan lain</b> <small style="color:var(--teks-2)">(mis. Strip isi 10 tablet, Box isi 100 tablet)</small>
    <div class="bungkus-tabel" style="margin-top:8px"><table class="tabel"><thead><tr><th>Satuan</th><th>Isi (satuan dasar)</th><th>Harga jual</th><th>Barcode</th><th></th></tr></thead>
    <tbody data-ps>${rows.map(baris1).join('')}</tbody></table></div>
    <button type="button" class="tombol kedua kecil" style="margin-top:8px" data-tambah-ps>+ Tambah satuan</button></div>`;
}

function saatBukaProduk(m) {
  m.addEventListener('click', e => {
    if (e.target.closest('[data-tambah-ps]')) m.querySelector('[data-ps]').insertAdjacentHTML('beforeend', window.__barisPS({}));
    if (e.target.closest('[data-hapus-ps]')) e.target.closest('tr').remove();
  });
  // Bantu hitung margin
  const beli = m.querySelector('[name=harga_beli]'), jual = m.querySelector('[name=harga_jual]');
  const info = document.createElement('small');
  jual.after(info);
  const hitung = () => {
    const b = Number(beli.value), j = Number(jual.value);
    info.textContent = b > 0 && j > 0 ? `Margin ${angka(((j - b) / b) * 100)}% (untung ${rupiah(j - b)} per satuan dasar)` : '';
  };
  beli.oninput = jual.oninput = hitung; hitung();
}

async function simpanSatuanLain(id, m) {
  const sat = [...m.querySelectorAll('[name=_ps_satuan]')], isi = [...m.querySelectorAll('[name=_ps_isi]')],
    harga = [...m.querySelectorAll('[name=_ps_harga]')], bc = [...m.querySelectorAll('[name=_ps_barcode]')];
  const rows = sat.map((s, i) => ({ produk_id: id, satuan_id: Number(s.value), isi: Number(isi[i].value), harga_jual: Number(harga[i].value || 0), barcode: bc[i].value.trim() || null }))
    .filter(r => r.isi > 0);
  const { error: e1 } = await sb.from('produk_satuan').delete().eq('produk_id', id);
  if (e1) throw e1;
  if (rows.length) { const { error } = await sb.from('produk_satuan').insert(rows); if (error) throw error; }
}

const kolomProduk = [
  { f: 'kode', label: 'Kode/SKU', maks: 40 },
  { f: 'barcode', label: 'Barcode', daftar: false },
  { f: 'nama', label: 'Nama Produk', wajib: true, lebar: true, tampil: r => `<b>${esc(r.nama)}</b>${r.nama_generik ? `<br><small style="color:var(--teks-2)">${esc(r.nama_generik)}</small>` : ''}` },
  { f: 'nama_generik', label: 'Nama Generik / Zat Aktif', daftar: false },
  { f: 'pabrik', label: 'Pabrik', daftar: false },
  { f: 'golongan', label: 'Golongan', tipe: 'pilih', opsi: GOLONGAN, wajib: true, tampil: r => `<span><span class="gol ${r.golongan}"></span>${esc(namaGol(r.golongan))}</span>` },
  { f: 'kategori_id', label: 'Kategori', tipe: 'ref', ref: 'kategori' },
  { f: 'satuan_id', label: 'Satuan Dasar', tipe: 'ref', ref: 'satuan', wajib: true, bantu: 'Satuan terkecil yang dijual, mis. Tablet.' },
  { f: 'rak_id', label: 'Rak', tipe: 'ref', ref: 'rak', daftar: false },
  { f: 'pajak_id', label: 'Pajak', tipe: 'ref', ref: 'pajak', daftar: false },
  { f: 'harga_beli', label: 'Harga Beli', tipe: 'uang', min: 0, bantu: 'Per satuan dasar, sudah termasuk PPN.' },
  { f: 'harga_jual', label: 'Harga Jual', tipe: 'uang', min: 0, wajib: true },
  { f: 'stok_min', label: 'Stok Minimum', tipe: 'angka', min: 0, daftar: false },
  { f: 'stok_maks', label: 'Stok Maksimum', tipe: 'angka', min: 0, daftar: false },
  { f: 'wajib_resep', label: 'Wajib resep dokter', tipe: 'bool', daftar: false },
  { f: 'konsinyasi', label: 'Barang konsinyasi (titipan)', tipe: 'bool', daftar: false },
  { f: 'aktif', label: 'Aktif', tipe: 'bool', daftar: false },
  { f: 'keterangan', label: 'Keterangan', tipe: 'area', daftar: false },
];
export const cfgProduk = (judul, remah) => ({
  judul, remah, tabel: 'produk', satuan: 'Produk', kunciTulis: ['master.produk', 'persediaan.produk'],
  kolom: kolomProduk, cari: ['nama', 'kode', 'barcode', 'nama_generik'], filterAktif: true, ukuranForm: 'besar',
  bawaan: { golongan: 'bebas', aktif: true },
  ekstraForm: satuanLainHtml, saatBukaForm: saatBukaProduk, setelahSimpan: simpanSatuanLain,
});
rute('master/produk', halamanCrud(cfgProduk('Master Produk', 'Master Data / Master Produk')));

// ---------- Master kecil ----------
const sederhana = (k, judul, tabel, kolomTambahan = [], ekstra = {}) =>
  rute('master/' + k, halamanCrud({ judul, remah: 'Master Data / ' + judul, tabel, kunciTulis: ['master.' + k],
    kolom: [{ f: 'nama', label: 'Nama', wajib: true }, ...kolomTambahan], ...ekstra }));

sederhana('kategori', 'Master Kategori', 'kategori', [{ f: 'keterangan', label: 'Keterangan', tipe: 'area' }]);
sederhana('satuan', 'Master Satuan', 'satuan');
sederhana('rak', 'Master Rak', 'rak', [{ f: 'keterangan', label: 'Keterangan', tipe: 'area' }], { outlet: true });
sederhana('gudang', 'Master Gudang', 'gudang', [{ f: 'utama', label: 'Gudang utama', tipe: 'bool' }, { f: 'keterangan', label: 'Keterangan', tipe: 'area' }], { outlet: true });
sederhana('kategori_pelanggan', 'Master Kategori Pelanggan', 'kategori_pelanggan', [
  { f: 'diskon_persen', label: 'Diskon Otomatis', tipe: 'persen', min: 0, bantu: 'Diskon (%) yang otomatis berlaku saat pelanggan kategori ini belanja.' },
  { f: 'keterangan', label: 'Keterangan', tipe: 'area' }]);
sederhana('jenis_pelayanan', 'Jenis Pelayanan', 'jenis_pelayanan', [
  { f: 'markup_persen', label: 'Tambahan Harga', tipe: 'persen', bantu: 'Kenaikan harga (%) dari harga jual biasa, mis. untuk penjualan online.' },
  { f: 'embalase', label: 'Embalase', tipe: 'uang', min: 0 },
  { f: 'tuslah', label: 'Tuslah', tipe: 'uang', min: 0 },
  { f: 'aktif', label: 'Aktif', tipe: 'bool' }], { bawaan: { aktif: true } });
sederhana('pajak', 'Master Pajak', 'pajak', [{ f: 'persen', label: 'Tarif', tipe: 'persen', min: 0, wajib: true }]);
sederhana('shift', 'Master Shift', 'shift', [{ f: 'jam_mulai', label: 'Jam Mulai', tipe: 'jam' }, { f: 'jam_selesai', label: 'Jam Selesai', tipe: 'jam' }]);

// ---------- Kontak ----------
const kontak = (k, judul, tabel, kolom, ekstra = {}) =>
  rute('kontak/' + k, halamanCrud({ judul, remah: 'Kontak / ' + judul, tabel, kunciTulis: ['kontak.' + k], kolom, filterAktif: true, bawaan: { aktif: true }, ...ekstra }));


kontak('pelanggan', 'Pelanggan', 'pelanggan', [
  { f: 'kode', label: 'Kode' }, { f: 'nama', label: 'Nama', wajib: true }, { f: 'telp', label: 'No. HP', tipe: 'telp' },
  { f: 'jenis_kelamin', label: 'Jenis Kelamin', tipe: 'pilih', opsi: [['L', 'Laki-laki'], ['P', 'Perempuan']], daftar: false },
  { f: 'tgl_lahir', label: 'Tanggal Lahir', tipe: 'tanggal', daftar: false },
  { f: 'kategori_pelanggan_id', label: 'Kategori', tipe: 'ref', ref: 'kategori_pelanggan' },
  { f: 'alamat', label: 'Alamat', tipe: 'area', daftar: false },
  { f: 'batas_kredit', label: 'Batas Kredit', tipe: 'uang', min: 0, daftar: false, bantu: '0 = tidak boleh kredit. Hanya yang punya akses Piutang Usaha yang bisa mengubah.' },
  { f: 'tempo_kredit', label: 'Tempo Kredit (hari)', tipe: 'angka', min: 0, daftar: false },
  { f: 'alergi', label: 'Riwayat Alergi Obat', tipe: 'area', daftar: false },
  { f: 'catatan', label: 'Catatan', tipe: 'area', daftar: false },
  { f: 'member', label: 'Member', tipe: 'bool', form: false, tampil: r => r.member ? `<span class="chip oranye">${esc(r.kode || 'Member')}</span>` : '' },
  { f: 'stamp', label: 'Stamp', tipe: 'angka', form: false },
  { f: 'aktif', label: 'Aktif', tipe: 'bool', daftar: false }], { cari: ['nama', 'kode', 'telp'], bawaan: { aktif: true, batas_kredit: 0, tempo_kredit: 30 },
  sebelumSimpan: d => { d.batas_kredit ??= 0; d.tempo_kredit ??= 30; },
  aksiBaris: [{ ikon: 'kontak', judul: 'Kartu member', fn: p => p.member ? bukaKartu(p) : toast('Belum member. Daftarkan di Program Promo → Program Member.', 'galat') }] });
kontak('sales', 'Sales/Pelayan', 'sales', [
  { f: 'nama', label: 'Nama', wajib: true }, { f: 'telp', label: 'No. HP', tipe: 'telp' }, { f: 'catatan', label: 'Catatan', tipe: 'area', daftar: false },
  { f: 'aktif', label: 'Aktif', tipe: 'bool' }]);
kontak('dokter', 'Dokter', 'dokter', [
  { f: 'nama', label: 'Nama Dokter', wajib: true }, { f: 'spesialis', label: 'Spesialis' }, { f: 'no_sip', label: 'No. SIP' },
  { f: 'telp', label: 'No. HP', tipe: 'telp' }, { f: 'tempat_praktik', label: 'Tempat Praktik' },
  { f: 'alamat', label: 'Alamat', tipe: 'area', daftar: false }, { f: 'aktif', label: 'Aktif', tipe: 'bool', daftar: false }], { cari: ['nama', 'spesialis', 'tempat_praktik'] });
kontak('supplier', 'Supplier', 'supplier', [
  { f: 'kode', label: 'Kode' }, { f: 'nama', label: 'Nama Supplier/PBF', wajib: true }, { f: 'telp', label: 'Telepon', tipe: 'telp' },
  { f: 'kontak_person', label: 'Kontak Person' }, { f: 'email', label: 'Email', tipe: 'email', daftar: false },
  { f: 'npwp', label: 'NPWP', daftar: false }, { f: 'tempo_hari', label: 'Tempo Bayar (hari)', tipe: 'angka', min: 0 },
  { f: 'bank', label: 'Bank', daftar: false }, { f: 'no_rekening', label: 'No. Rekening', daftar: false },
  { f: 'alamat', label: 'Alamat', tipe: 'area', daftar: false }, { f: 'aktif', label: 'Aktif', tipe: 'bool', daftar: false }],
  { cari: ['nama', 'kode', 'kontak_person'], bawaan: { aktif: true, tempo_hari: 30 } });

// ---------- Multi Outlet ----------
rute('outlet/daftar', halamanCrud({
  judul: 'Daftar Outlet', remah: 'Multi Outlet / Daftar Outlet', tabel: 'outlet', satuan: 'Outlet', kunciTulis: ['pengaturan.profil', 'outlet.daftar'],
  kolom: [
    { f: 'kode', label: 'Kode', wajib: true, bantu: 'Singkat, mis. PUSAT atau JTK.' }, { f: 'nama', label: 'Nama Outlet', wajib: true },
    { f: 'alamat', label: 'Alamat', tipe: 'area' }, { f: 'telp', label: 'Telepon', tipe: 'telp' },
    { f: 'apoteker', label: 'Apoteker Penanggung Jawab' }, { f: 'sipa', label: 'No. SIPA', daftar: false },
    { f: 'no_sia', label: 'No. SIA', daftar: false }, { f: 'aktif', label: 'Aktif', tipe: 'bool' }],
  urut: 'id', bawaan: { aktif: true }, cari: ['nama', 'kode'],
}));

// ---------- Metode Pembayaran ----------
rute('pengaturan/metode_bayar', halamanCrud({
  judul: 'Metode Pembayaran', remah: 'Pengaturan / Metode Pembayaran', tabel: 'metode_bayar', kunciTulis: ['pengaturan.metode_bayar'],
  kolom: [
    { f: 'nama', label: 'Nama', wajib: true },
    { f: 'jenis', label: 'Jenis', tipe: 'pilih', wajib: true, opsi: [['tunai', 'Tunai'], ['qris', 'QRIS'], ['transfer', 'Transfer Bank'], ['debit', 'Kartu Debit'], ['kredit', 'Kartu Kredit'], ['ewallet', 'E-Wallet'], ['lainnya', 'Lainnya'], ['piutang', 'Piutang (kredit pelanggan)']] },
    { f: 'akun_kas_id', label: 'Masuk ke Akun', tipe: 'ref', ref: 'akun_kas', bantu: 'Untuk non-tunai. Kosong = bank pertama. Tunai selalu ke Kas Kasir.' },
    { f: 'biaya_persen', label: 'Biaya Admin', tipe: 'persen', min: 0, bantu: 'Potongan (%) dari bank/penyedia, untuk laporan keuangan.' },
    { f: 'urutan', label: 'Urutan Tampil', tipe: 'angka' },
    { f: 'aktif', label: 'Aktif', tipe: 'bool' }],
  urut: 'urutan', bawaan: { aktif: true, jenis: 'tunai', urutan: 10 },
}));
