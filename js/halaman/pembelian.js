// Pembelian: Rencana Pembelian, Pesanan Pembelian (SP), Faktur Pembelian, Retur Pembelian.
import { sb, S } from '../inti.js?v=1.2.0';
import { esc, angka, rupiah, tanggal, toast, pesanGalat } from '../ui.js?v=1.2.0';
import { rutekanDokumen, barisTotal } from '../dokumen.js?v=1.2.0';

const refSupplier = (wajib = true) => ({ f: 'supplier_id', label: 'Supplier / PBF', tipe: 'ref', ref: 'supplier', wajib });
const gudangOutlet = { f: 'gudang_id', label: 'Masuk ke Gudang', tipe: 'ref', ref: 'gudang', refKolom: 'id,nama,outlet_id', saring: o => o.outlet_id === S.pengguna.outlet_id, bantu: 'Kosongkan untuk gudang utama.' };
const kolomSupplierDaftar = { label: 'Supplier', nilai: r => esc(r.supplier?.nama || '-') };
const hargaBeliSatuan = (p, isi) => Math.round(Number(p.harga_beli || 0) * isi);
const sum = (items, fn) => items.reduce((a, r) => a + fn(r), 0);
const kirimKe = (jenis, rute, data) => { sessionStorage.setItem('prefill:' + jenis, JSON.stringify(data)); location.hash = `#/${rute}/baru`; };
const ambilItemSaja = items => items.map(r => ({ produk_id: r.produk_id, satuan_id: r.satuan_id, isi: r.isi, qty: r.qty, harga: r.harga }));

// ---------- Rencana Pembelian ----------
rutekanDokumen({
  jenis: 'rencana', rute: 'pembelian/rencana', judul: 'Rencana Pembelian', satuan: 'Rencana Pembelian', remah: 'Pembelian / Rencana Pembelian',
  tabel: 'rencana_beli', tabelItem: 'rencana_beli_item', fk: 'rencana_id', kunci: 'pembelian.rencana', stok: false,
  statusOpsi: ['draft', 'diproses', 'selesai', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)', daftarKolom: [kolomSupplierDaftar],
  header: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, refSupplier(false), { f: 'catatan', label: 'Catatan', tipe: 'area' }],
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'satuan', label: 'Satuan', tipe: 'satuan' },
    { f: 'qty', label: 'Jumlah', tipe: 'angka' }, { f: 'harga', label: 'Perkiraan Harga', tipe: 'uang', lebar: 110 },
    { f: 'sub', label: 'Subtotal', tipe: 'hitung', hitung: r => rupiah((r.qty || 0) * (r.harga || 0)) },
    { f: 'catatan', label: 'Catatan', tipe: 'teks' },
  ],
  itemBaru: p => ({ qty: 1, harga: Math.round(p.harga_beli || 0) }), hargaSatuan: hargaBeliSatuan,
  total: (h, it) => barisTotal([['Perkiraan total', rupiah(sum(it, r => (r.qty || 0) * (r.harga || 0))), true]]),
  aksiEkstra: [
    { teks: 'Tandai Diproses', jika: (st, b) => b && st.status === 'draft' && st.header.id, fn: async (st, a) => {
      await a.simpan(); const { error } = await sb.rpc('ubah_status_dok', { p_jenis: 'rencana', p_id: st.header.id, p_status: 'diproses' }); if (error) throw error; a.tampilUlang(); } },
    { teks: 'Buat Surat Pesanan (SP)', kelas: 'oranye', jika: (st, b) => b && st.header.id && !['batal', 'selesai'].includes(st.status),
      fn: st => kirimKe('pesanan', 'pembelian/pesanan', { header: { supplier_id: st.header.supplier_id, rencana_id: st.header.id }, items: ambilItemSaja(st.items) }) },
  ],
  headerTambahan: [],
});

// ---------- Pesanan Pembelian (SP) ----------
const JENIS_SP = [['reguler', 'Reguler'], ['prekursor', 'Prekursor'], ['oot', 'Obat-Obat Tertentu (OOT)'], ['psikotropika', 'Psikotropika'], ['narkotika', 'Narkotika']];
rutekanDokumen({
  jenis: 'pesanan', rute: 'pembelian/pesanan', judul: 'Pesanan Pembelian', satuan: 'Surat Pesanan', judulCetak: 'SURAT PESANAN', remah: 'Pembelian / Pesanan Pembelian',
  tabel: 'pesanan_beli', tabelItem: 'pesanan_beli_item', fk: 'pesanan_id', kunci: 'pembelian.pesanan', stok: false,
  statusOpsi: ['draft', 'dipesan', 'sebagian', 'selesai', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)',
  daftarKolom: [kolomSupplierDaftar, { label: 'Jenis', nilai: r => esc((JENIS_SP.find(j => j[0] === r.jenis_sp) || [])[1] || '') }, { label: 'Perkiraan', angka: true, nilai: r => rupiah(r.total) }],
  header: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, refSupplier(), { f: 'jenis_sp', label: 'Jenis SP', tipe: 'pilih', opsi: JENIS_SP },
    { f: 'catatan', label: 'Catatan', tipe: 'area' }],
  headerTambahan: ['rencana_id'], bawaan: { jenis_sp: 'reguler' },
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'satuan', label: 'Satuan', tipe: 'satuan' },
    { f: 'qty', label: 'Jumlah', tipe: 'angka' }, { f: 'harga', label: 'Perkiraan Harga', tipe: 'uang', lebar: 110 },
    { f: 'qty_diterima', label: 'Diterima', tipe: 'info', cetak: false },
    { f: 'sub', label: 'Subtotal', tipe: 'hitung', hitung: r => rupiah((r.qty || 0) * (r.harga || 0)) },
  ],
  itemBaru: p => ({ qty: 1, harga: Math.round(p.harga_beli || 0) }), hargaSatuan: hargaBeliSatuan,
  total: (h, it) => barisTotal([['Perkiraan total', rupiah(sum(it, r => (r.qty || 0) * (r.harga || 0))), true]]),
  ttdKiri: 'Supplier', ttdKanan: 'Apoteker Pemesan',
  validasi: (h, it) => it.some(r => !(r.qty > 0)) ? 'Jumlah setiap barang harus lebih dari 0.' : null,
  aksiEkstra: [
    { teks: 'Tandai Sudah Dipesan', jika: (st, b) => b && st.status === 'draft' && st.header.id, fn: async (st, a) => {
      await a.simpan(); const { error } = await sb.rpc('ubah_status_dok', { p_jenis: 'pesanan', p_id: st.header.id, p_status: 'dipesan' }); if (error) throw error; toast('SP ditandai dipesan', 'sukses'); a.tampilUlang(); } },
    { teks: 'Terima Barang (Buat Faktur)', kelas: 'oranye', jika: (st, b) => b && ['dipesan', 'sebagian'].includes(st.status),
      fn: st => kirimKe('faktur', 'pembelian/faktur', { header: { supplier_id: st.header.supplier_id, pesanan_id: st.header.id },
        items: st.items.filter(r => r.qty > r.qty_diterima).map(r => ({ produk_id: r.produk_id, satuan_id: r.satuan_id, isi: r.isi, qty: Number(r.qty) - Number(r.qty_diterima), bonus: 0, harga: Math.round(r.harga / 1.11), diskon_persen: 0 })) }) },
    { teks: 'Tandai Selesai', jika: (st, b) => b && ['dipesan', 'sebagian'].includes(st.status), fn: async (st, a) => {
      const { error } = await sb.rpc('ubah_status_dok', { p_jenis: 'pesanan', p_id: st.header.id, p_status: 'selesai' }); if (error) throw error; a.tampilUlang(); } },
  ],
});

// ---------- Faktur Pembelian ----------
const hitungFaktur = (h, it) => {
  const sub = sum(it, r => (r.qty || 0) * (r.harga || 0) * (1 - (r.diskon_persen || 0) / 100));
  const dpp = sub - (h.diskon || 0);
  const ppn = Math.round(dpp * (h.ppn_persen || 0) / 100);
  return { sub, dpp, ppn, total: dpp + ppn + (h.biaya_lain || 0) };
};
rutekanDokumen({
  jenis: 'faktur', rute: 'pembelian/faktur', judul: 'Faktur Pembelian', satuan: 'Faktur Pembelian', remah: 'Pembelian / Faktur Pembelian', stok: true,
  tabel: 'faktur_beli', tabelItem: 'faktur_beli_item', fk: 'faktur_id', kunci: 'pembelian.faktur',
  labelPosting: 'Simpan & Terima Barang', pesanPosting: 'Barang akan masuk ke stok, harga beli produk diperbarui, dan faktur tercatat sebagai utang (bila tempo). Lanjutkan?',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)', cariKolom: ['no', 'no_faktur'],
  daftarKolom: [{ label: 'No. Faktur', nilai: r => esc(r.no_faktur || '') }, kolomSupplierDaftar,
    { label: 'Jatuh Tempo', nilai: r => r.cara_bayar === 'tunai' ? '<span class="chip">Tunai</span>' : tanggal(r.jatuh_tempo) },
    { label: 'Total', angka: true, nilai: r => rupiah(r.total) }],
  header: [
    { f: 'no_faktur', label: 'No. Faktur Supplier', wajib: true }, { f: 'tanggal', label: 'Tanggal Faktur', tipe: 'tanggal', wajib: true },
    refSupplier(), gudangOutlet,
    { f: 'cara_bayar', label: 'Pembayaran', tipe: 'pilih', opsi: [['tempo', 'Tempo (utang)'], ['tunai', 'Tunai/Lunas']] },
    { f: 'jatuh_tempo', label: 'Jatuh Tempo', tipe: 'tanggal', bantu: 'Kosongkan: otomatis dari tempo supplier.', tampilJika: h => h.cara_bayar !== 'tunai' },
    { f: 'diskon', label: 'Diskon Faktur (Rp)', tipe: 'uang' }, { f: 'ppn_persen', label: 'PPN (%)', tipe: 'persen', bantu: 'Biasanya 11%. Isi 0 bila harga sudah termasuk PPN.' },
    { f: 'biaya_lain', label: 'Biaya Lain (Rp)', tipe: 'uang', bantu: 'Mis. ongkos kirim/materai.' }, { f: 'catatan', label: 'Catatan', tipe: 'area' },
  ],
  headerTambahan: ['pesanan_id'], bawaan: { cara_bayar: 'tempo', ppn_persen: 11, diskon: 0, biaya_lain: 0 },
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'satuan', label: 'Satuan', tipe: 'satuan' },
    { f: 'qty', label: 'Jumlah', tipe: 'angka', lebar: 75 }, { f: 'bonus', label: 'Bonus', tipe: 'angka', lebar: 70 },
    { f: 'harga', label: 'Harga/Satuan', tipe: 'uang', lebar: 110 }, { f: 'diskon_persen', label: 'Disk %', tipe: 'persen', lebar: 70 },
    { f: 'no_batch', label: 'No. Batch', tipe: 'teks', lebar: 100 }, { f: 'ed', label: 'Kedaluwarsa', tipe: 'tanggal' },
    { f: 'sub', label: 'Subtotal', tipe: 'hitung', hitung: r => rupiah((r.qty || 0) * (r.harga || 0) * (1 - (r.diskon_persen || 0) / 100)) },
  ],
  // harga beli produk sudah termasuk PPN; di faktur harga diisi sebelum PPN (HNA)
  itemBaru: (p, h) => ({ qty: 1, bonus: 0, harga: Math.round((p.harga_beli || 0) / (1 + (h.ppn_persen || 0) / 100)), diskon_persen: 0 }),
  hargaSatuan: (p, isi, h) => Math.round((p.harga_beli || 0) * isi / (1 + (h.ppn_persen || 0) / 100)), gabung: false,
  total: (h, it) => { const t = hitungFaktur(h, it); return barisTotal([['Subtotal', rupiah(t.sub)], ['Diskon faktur', '- ' + rupiah(h.diskon || 0)], ['DPP', rupiah(t.dpp)],
    [`PPN ${angka(h.ppn_persen || 0)}%`, rupiah(t.ppn)], ['Biaya lain', rupiah(h.biaya_lain || 0)], ['TOTAL', rupiah(t.total), true],
    ...(h.terbayar !== undefined && h.status === 'posting' ? [['Sudah dibayar', rupiah(h.terbayar)], ['Sisa utang', rupiah((h.total || 0) - (h.terbayar || 0))]] : [])]); },
  validasi: (h, it) => {
    if (it.some(r => !((r.qty || 0) + (r.bonus || 0) > 0))) return 'Jumlah + bonus setiap barang harus lebih dari 0.';
    if (it.some(r => !r.ed)) return 'Isi tanggal kedaluwarsa (ED) setiap barang.';
    return null;
  },
  ttdKiri: 'Penerima Barang',
});

// ---------- Retur Pembelian ----------
rutekanDokumen({
  jenis: 'retur_beli', rute: 'pembelian/retur', judul: 'Retur Pembelian', satuan: 'Retur Pembelian', remah: 'Pembelian / Retur Pembelian', stok: true,
  tabel: 'retur_beli', tabelItem: 'retur_beli_item', fk: 'retur_id', kunci: 'pembelian.retur', labelPosting: 'Simpan & Keluarkan Barang',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)',
  daftarKolom: [kolomSupplierDaftar, { label: 'Penyelesaian', nilai: r => esc(r.penyelesaian.replace('_', ' ')) }, { label: 'Total', angka: true, nilai: r => rupiah(r.total) }],
  header: [
    { f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, { ...refSupplier(), ubahBatch: true },
    { f: 'faktur_id', label: 'Dari Faktur (opsional)', tipe: 'ref', ref: 'faktur_beli', refKolom: 'id,no,no_faktur,supplier_id,status', refUrut: 'id',
      saring: (o, h) => o.status === 'posting' && (!h.supplier_id || o.supplier_id === h.supplier_id), label2: o => `${o.no_faktur || ''} (${o.no})` },
    { f: 'penyelesaian', label: 'Penyelesaian', tipe: 'pilih', opsi: [['potong_hutang', 'Potong utang'], ['tukar_barang', 'Tukar barang'], ['uang_kembali', 'Uang kembali']] },
    { f: 'catatan', label: 'Catatan', tipe: 'area' },
  ],
  bawaan: { penyelesaian: 'potong_hutang' },
  filterBatch: () => ({ konsinyasi: false }),
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'batch', label: 'Batch', tipe: 'batch' },
    { f: 'qty', label: 'Jumlah (satuan dasar)', tipe: 'angka' },
    { f: 'harga', label: 'Harga/satuan dasar', tipe: 'uang', lebar: 110, bantu: '0 = HPP' },
    { f: 'alasan', label: 'Alasan', tipe: 'teks', placeholder: 'mis. rusak/ED' },
  ],
  saatPilihBatch: (r, b) => { if (b) r.harga = Math.round(Number(b.hpp)); },
  itemBaru: () => ({ qty: 1, harga: 0 }), gabung: false,
  total: (h, it) => barisTotal([['Total retur', rupiah(sum(it, r => (r.qty || 0) * (r.harga || 0))), true]]),
  validasi: (h, it) => it.some(r => !r.batch_id) ? 'Pilih batch setiap barang.' : it.some(r => !(r.qty > 0)) ? 'Jumlah harus lebih dari 0.' : null,
  ttdKiri: 'Supplier', ttdKanan: 'Apoteker',
});
