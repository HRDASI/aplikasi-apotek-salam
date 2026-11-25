// Program Promo: Diskon Produk, Bundel/Paket, Voucher, Program Member.
import { rute, sb, ambilRef } from '../inti.js?v=1.24.0';
import { esc, angka, rupiah } from '../ui.js?v=1.24.0';
import { halamanCrud } from '../crud.js?v=1.24.0';

const status = r => {
  const h = new Date().toISOString().slice(0, 10);
  if (!r.aktif) return '<span class="chip">Nonaktif</span>';
  if (r.mulai && h < r.mulai) return '<span class="chip oranye">Belum mulai</span>';
  if (r.selesai && h > r.selesai) return '<span class="chip merah">Berakhir</span>';
  return '<span class="chip hijau">Berjalan</span>';
};
const periode = [{ f: 'mulai', label: 'Mulai', tipe: 'tanggal', bantu: 'Kosongkan bila langsung berlaku.' }, { f: 'selesai', label: 'Selesai', tipe: 'tanggal', bantu: 'Kosongkan bila tanpa batas.' }];

// ---------- Diskon Produk ----------
rute('promo/diskon', halamanCrud({
  judul: 'Diskon Produk', remah: 'Program Promo / Diskon Produk', tabel: 'promo_diskon', satuan: 'Diskon Produk', kunciTulis: ['promo.diskon'],
  kolom: [
    { f: 'nama', label: 'Nama Promo', wajib: true, lebar: true },
    { f: 'produk_id', label: 'Produk', tipe: 'ref', ref: 'produk', bantu: 'Pilih produk, ATAU kosongkan lalu pilih kategori (berlaku untuk semua produk di kategori itu).' },
    { f: 'kategori_id', label: 'Kategori', tipe: 'ref', ref: 'kategori' },
    { f: 'jenis', label: 'Jenis Diskon', tipe: 'pilih', wajib: true, opsi: [['persen', 'Persen (%)'], ['rupiah', 'Rupiah per satuan terkecil']] },
    { f: 'nilai', label: 'Nilai', tipe: 'angka', wajib: true, min: 0, tampil: r => r.jenis === 'persen' ? angka(r.nilai) + '%' : rupiah(r.nilai) + '/satuan' },
    { f: 'min_qty', label: 'Minimal Beli (satuan terkecil)', tipe: 'angka', min: 0, daftar: false, bantu: 'mis. 10 = diskon berlaku bila beli minimal 10 tablet.' },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status },
  ],
  bawaan: { jenis: 'persen', aktif: true, min_qty: 0 }, urut: 'dibuat', naik: false,
  sebelumSimpan: d => { if (!d.produk_id && !d.kategori_id) throw new Error('Pilih produk atau kategori.'); if (d.jenis === 'persen' && d.nilai > 100) throw new Error('Diskon persen maksimal 100.'); },
}));

// ---------- Bundel / Paket ----------
async function isiPaketHtml(baris) {
  const produk = await ambilRef('produk', 'id,nama');
  let rows = [];
  if (baris) rows = (await sb.from('promo_bundel_item').select('*').eq('bundel_id', baris.id).order('id')).data || [];
  const opsi = v => produk.map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nama)}</option>`).join('');
  window.__barisPaket = r => `<tr><td><select class="input" name="_pk_produk">${opsi(r.produk_id)}</select></td><td><input class="input" type="number" min="0.0001" step="any" name="_pk_qty" value="${r.qty ?? 1}" style="width:90px"></td><td><button type="button" class="ikon-aksi hapus" data-hapus-pk>✕</button></td></tr>`;
  return `<b>Isi paket</b> <small style="color:var(--teks-2)">(jumlah dalam satuan terkecil, mis. 10 tablet)</small>
    <div class="bungkus-tabel" style="margin-top:8px"><table class="tabel"><thead><tr><th>Produk</th><th>Jumlah</th><th></th></tr></thead><tbody data-pk>${rows.map(window.__barisPaket).join('')}</tbody></table></div>
    <button type="button" class="tombol kedua kecil" style="margin-top:8px" data-tambah-pk>+ Tambah produk</button>`;
}
rute('promo/bundel', halamanCrud({
  judul: 'Bundel/Paket Produk', remah: 'Program Promo / Bundel/Paket Produk', tabel: 'promo_bundel', satuan: 'Paket', kunciTulis: ['promo.bundel'], ukuranForm: 'besar',
  kolom: [{ f: 'kode', label: 'Kode' }, { f: 'nama', label: 'Nama Paket', wajib: true }, { f: 'harga', label: 'Harga Paket', tipe: 'uang', wajib: true, min: 0 },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status }],
  bawaan: { aktif: true }, cari: ['nama', 'kode'],
  ekstraForm: isiPaketHtml,
  saatBukaForm: m => m.addEventListener('click', e => {
    if (e.target.closest('[data-tambah-pk]')) m.querySelector('[data-pk]').insertAdjacentHTML('beforeend', window.__barisPaket({}));
    if (e.target.closest('[data-hapus-pk]')) e.target.closest('tr').remove();
  }),
  sebelumSimpan: () => { if (!document.querySelectorAll('[name=_pk_produk]').length) throw new Error('Isi paket minimal 1 produk.'); },
  setelahSimpan: async (id, m) => {
    const p = [...m.querySelectorAll('[name=_pk_produk]')], q = [...m.querySelectorAll('[name=_pk_qty]')];
    const rows = p.map((s, i) => ({ bundel_id: id, produk_id: Number(s.value), qty: Number(q[i].value) })).filter(r => r.qty > 0);
    const { error: e1 } = await sb.from('promo_bundel_item').delete().eq('bundel_id', id); if (e1) throw e1;
    if (rows.length) { const { error } = await sb.from('promo_bundel_item').insert(rows); if (error) throw error; }
  },
}));

// ---------- Voucher ----------
rute('promo/voucher', halamanCrud({
  judul: 'Voucher Diskon', remah: 'Program Promo / Voucher Diskon', tabel: 'voucher', satuan: 'Voucher', kunciTulis: ['promo.voucher'], labelBaris: 'kode',
  kolom: [
    { f: 'kode', label: 'Kode Voucher', wajib: true, bantu: 'Yang diketik kasir, mis. SEHAT10.' }, { f: 'nama', label: 'Keterangan' },
    { f: 'jenis', label: 'Jenis', tipe: 'pilih', wajib: true, opsi: [['rupiah', 'Potongan Rupiah'], ['persen', 'Potongan Persen']] },
    { f: 'nilai', label: 'Nilai', tipe: 'angka', wajib: true, min: 0, tampil: r => r.jenis === 'persen' ? angka(r.nilai) + '%' : rupiah(r.nilai) },
    { f: 'maks_potongan', label: 'Maksimal Potongan (Rp)', tipe: 'uang', min: 0, daftar: false, bantu: 'Untuk voucher persen. 0 = tanpa batas.' },
    { f: 'min_belanja', label: 'Minimal Belanja', tipe: 'uang', min: 0 },
    { f: 'kuota', label: 'Kuota Pemakaian', tipe: 'angka', min: 0, bantu: 'Kosongkan bila tanpa batas.', tampil: r => r.kuota === null ? '∞' : `${angka(r.terpakai)} / ${angka(r.kuota)}` },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status },
  ],
  bawaan: { jenis: 'rupiah', aktif: true }, cari: ['kode', 'nama'], urut: 'dibuat', naik: false,
  sebelumSimpan: d => { d.kode = (d.kode || '').toUpperCase().replace(/\s+/g, ''); if (d.kuota === 0) d.kuota = null; },
}));
// Program Member (model stamp) ada di member.js
