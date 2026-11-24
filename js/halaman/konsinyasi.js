// Konsinyasi (barang titipan): Konsinyasi Masuk, Status, Retur, Stok.
import { rute, sb, S, bisa, ambilSemua } from '../inti.js?v=1.9.0';
import { ikon } from '../menu.js?v=1.9.0';
import { esc, angka, rupiah, tanggal, toast, konfirmasi, pesanGalat, judulHalaman, unduhCSV } from '../ui.js?v=1.9.0';
import { rutekanDokumen, barisTotal, chipStatus } from '../dokumen.js?v=1.9.0';

const refPenitip = { f: 'supplier_id', label: 'Penitip / Supplier', tipe: 'ref', ref: 'supplier', wajib: true, ubahBatch: true };
const sum = (it, fn) => it.reduce((a, r) => a + fn(r), 0);

rutekanDokumen({
  jenis: 'konsinyasi', rute: 'konsinyasi/masuk', judul: 'Konsinyasi Masuk', satuan: 'Konsinyasi Masuk', judulCetak: 'TANDA TERIMA BARANG KONSINYASI', remah: 'Konsinyasi / Konsinyasi Masuk', stok: true,
  tabel: 'konsinyasi_masuk', tabelItem: 'konsinyasi_item', fk: 'konsinyasi_id', kunci: 'konsinyasi.masuk', labelPosting: 'Simpan & Terima Barang',
  pesanPosting: 'Barang titipan masuk ke stok (ditandai titipan). Pembayaran ke penitip dihitung dari barang yang terjual. Lanjutkan?',
  statusOpsi: ['draft', 'posting', 'selesai', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)', cariKolom: ['no', 'no_dokumen'],
  daftarKolom: [{ label: 'No. Dokumen', nilai: r => esc(r.no_dokumen || '') }, { label: 'Penitip', nilai: r => esc(r.supplier?.nama || '') }, { label: 'Nilai Titipan', angka: true, nilai: r => rupiah(r.total) }],
  header: [
    { f: 'no_dokumen', label: 'No. Dokumen Penitip' }, { f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, refPenitip,
    { f: 'gudang_id', label: 'Masuk ke Gudang', tipe: 'ref', ref: 'gudang', refKolom: 'id,nama,outlet_id', saring: o => o.outlet_id === S.pengguna.outlet_id, bantu: 'Kosongkan untuk gudang utama.' },
    { f: 'jatuh_tempo', label: 'Batas Waktu Titip', tipe: 'tanggal' }, { f: 'catatan', label: 'Catatan', tipe: 'area' },
  ],
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'satuan', label: 'Satuan', tipe: 'satuan' }, { f: 'qty', label: 'Jumlah', tipe: 'angka' },
    { f: 'harga', label: 'Harga Titip/Satuan', tipe: 'uang', lebar: 110 }, { f: 'no_batch', label: 'No. Batch', tipe: 'teks', lebar: 90 }, { f: 'ed', label: 'Kedaluwarsa', tipe: 'tanggal' },
    { f: 'sub', label: 'Subtotal', tipe: 'hitung', hitung: r => rupiah((r.qty || 0) * (r.harga || 0)) },
  ],
  itemBaru: p => ({ qty: 1, harga: Math.round(p.harga_beli || 0) }), hargaSatuan: (p, isi) => Math.round((p.harga_beli || 0) * isi), gabung: false,
  total: (h, it) => barisTotal([['Nilai titipan', rupiah(sum(it, r => (r.qty || 0) * (r.harga || 0))), true]]),
  validasi: (h, it) => it.some(r => !(r.qty > 0)) ? 'Jumlah harus lebih dari 0.' : null,
  ttdKiri: 'Penitip', ttdKanan: 'Penerima (Apotek)',
  aksiEkstra: [{ teks: 'Tandai Selesai (sudah diselesaikan dengan penitip)', jika: (st, b) => b && st.status === 'posting', fn: async (st, a) => {
    if (!await konfirmasi('Selesaikan konsinyasi', 'Tandai konsinyasi ini selesai (pembayaran/retur ke penitip sudah beres)?', 'Ya, selesai', '')) return;
    const { error } = await sb.rpc('selesai_konsinyasi', { p_id: st.header.id }); if (error) throw error; a.tampilUlang(); } }],
});

rutekanDokumen({
  jenis: 'retur_konsinyasi', rute: 'konsinyasi/retur', judul: 'Retur Konsinyasi', satuan: 'Retur Konsinyasi', remah: 'Konsinyasi / Retur Konsinyasi', stok: true,
  tabel: 'retur_konsinyasi', tabelItem: 'retur_konsinyasi_item', fk: 'retur_id', kunci: 'konsinyasi.retur', labelPosting: 'Simpan & Kembalikan Barang',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, supplier:supplier_id(nama)',
  daftarKolom: [{ label: 'Penitip', nilai: r => esc(r.supplier?.nama || '') }, { label: 'Nilai', angka: true, nilai: r => rupiah(r.total) }],
  header: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, refPenitip,
    { f: 'konsinyasi_id', label: 'Dari Konsinyasi (opsional)', tipe: 'ref', ref: 'konsinyasi_masuk', refKolom: 'id,no,supplier_id,status', refUrut: 'id',
      saring: (o, h) => ['posting', 'selesai'].includes(o.status) && (!h.supplier_id || o.supplier_id === h.supplier_id), label2: o => o.no },
    { f: 'catatan', label: 'Catatan', tipe: 'area' }],
  filterBatch: h => ({ konsinyasi: true, supplier_id: h.supplier_id || undefined }),
  item: [{ f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'batch', label: 'Batch Titipan', tipe: 'batch' }, { f: 'qty', label: 'Jumlah (satuan dasar)', tipe: 'angka' },
    { f: 'alasan', label: 'Alasan', tipe: 'teks', placeholder: 'mis. tidak laku / ED' }],
  itemBaru: () => ({ qty: 1 }), gabung: false,
  validasi: (h, it) => it.some(r => !r.batch_id) ? 'Pilih batch titipan setiap barang (isi penitip dulu).' : it.some(r => !(r.qty > 0)) ? 'Jumlah harus lebih dari 0.' : null,
  ttdKiri: 'Penitip', ttdKanan: 'Apoteker',
});

// ---------- Status Konsinyasi ----------
// Per dokumen konsinyasi: masuk, terjual, diretur, sisa, dan nilai yang harus dibayar ke penitip.
rute('konsinyasi/status', async el => {
  el.innerHTML = judulHalaman('Status Konsinyasi', 'Konsinyasi / Status Konsinyasi', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div class="alat-tabel"><select class="input" style="width:auto" data-status><option value="posting">Masih berjalan</option><option value="selesai">Selesai</option><option value="">Semua</option></select>
      <span style="color:var(--teks-2)" data-info></span></div><div data-isi>Memuat...</div></div>`;
  let baris = [];
  async function muat() {
    const status = el.querySelector('[data-status]').value;
    let q = sb.from('konsinyasi_masuk').select('*, supplier:supplier_id(nama), item:konsinyasi_item(*, produk:produk_id(nama), batch:batch_id(qty))')
      .eq('outlet_id', S.pengguna.outlet_id).order('tanggal', { ascending: false }).limit(200);
    q = status ? q.eq('status', status) : q.in('status', ['posting', 'selesai']);
    const { data, error } = await q;
    if (error) return toast(pesanGalat(error), 'galat');
    const batchIds = data.flatMap(d => d.item.map(i => i.batch_id)).filter(Boolean);
    const { data: mut } = batchIds.length ? await sb.from('stok_mutasi').select('batch_id,jenis,qty').in('batch_id', batchIds).in('jenis', ['jual', 'retur_jual', 'batal_jual', 'retur_konsinyasi', 'batal_retur_konsinyasi']) : { data: [] };
    const jml = (bid, jenis) => -(mut || []).filter(m => m.batch_id === bid && jenis.includes(m.jenis)).reduce((a, m) => a + Number(m.qty), 0);
    baris = [];
    el.querySelector('[data-isi]').innerHTML = data.length ? data.map(d => {
      let bayar = 0;
      const rows = d.item.map(i => {
        const masuk = i.qty * i.isi, terjual = jml(i.batch_id, ['jual', 'retur_jual', 'batal_jual']), retur = jml(i.batch_id, ['retur_konsinyasi', 'batal_retur_konsinyasi']);
        const nilai = terjual * (i.hpp || 0); bayar += nilai;
        baris.push({ no: d.no, penitip: d.supplier?.nama, produk: i.produk?.nama, masuk, terjual, retur, sisa: Number(i.batch?.qty || 0), nilai });
        return `<tr><td>${esc(i.produk?.nama)}</td><td class="angka">${angka(masuk)}</td><td class="angka">${angka(terjual)}</td><td class="angka">${angka(retur)}</td><td class="angka">${angka(i.batch?.qty || 0)}</td><td class="angka">${rupiah(nilai)}</td></tr>`;
      }).join('');
      return `<div style="border:1px solid var(--garis);border-radius:12px;margin-bottom:12px;overflow:hidden">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:#f7fafb"><a href="#/konsinyasi/masuk/${d.id}"><b>${esc(d.no)}</b></a>
          <span>${esc(d.supplier?.nama || '')}</span><span style="color:var(--teks-2)">${tanggal(d.tanggal)}${d.jatuh_tempo ? ' · batas ' + tanggal(d.jatuh_tempo) : ''}</span>${chipStatus(d.status)}
          <b style="margin-left:auto">Harus dibayar: ${rupiah(bayar)}</b></div>
        <div class="bungkus-tabel" style="border:0;border-radius:0"><table class="tabel"><thead><tr><th>Produk</th><th class="angka">Masuk</th><th class="angka">Terjual</th><th class="angka">Diretur</th><th class="angka">Sisa</th><th class="angka">Nilai Terjual</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join('') : '<p class="kosong" style="text-align:center;color:var(--teks-2)">Tidak ada konsinyasi.</p>';
    el.querySelector('[data-info]').textContent = `${data.length} dokumen`;
  }
  el.querySelector('[data-status]').onchange = muat;
  el.querySelector('[data-csv]').onclick = () => unduhCSV('status-konsinyasi', [{ label: 'No', nilai: r => r.no }, { label: 'Penitip', nilai: r => r.penitip }, { label: 'Produk', nilai: r => r.produk },
    { label: 'Masuk', nilai: r => r.masuk }, { label: 'Terjual', nilai: r => r.terjual }, { label: 'Diretur', nilai: r => r.retur }, { label: 'Sisa', nilai: r => r.sisa }, { label: 'Nilai terjual', nilai: r => Math.round(r.nilai) }], baris);
  muat();
});

// ---------- Stok Konsinyasi ----------
rute('konsinyasi/stok', async el => {
  el.innerHTML = judulHalaman('Stok Konsinyasi', 'Konsinyasi / Stok Konsinyasi', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div class="alat-tabel"><select class="input" style="width:auto" data-penitip><option value="">Semua penitip</option></select><span style="color:var(--teks-2)" data-info></span></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Produk</th><th>Penitip</th><th>Batch</th><th>ED</th><th class="angka">Sisa</th><th class="angka">Harga Titip</th><th class="angka">Nilai</th><th>Gudang</th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const data = await ambilSemua(() => sb.from('stok_batch').select('*, produk:produk_id(nama,satuan:satuan_id(nama)), supplier:supplier_id(id,nama), gudang:gudang_id(nama)')
    .eq('outlet_id', S.pengguna.outlet_id).eq('konsinyasi', true).gt('qty', 0).order('ed').order('id'));
  const penitip = [...new Map(data.map(d => [d.supplier?.id, d.supplier?.nama])).entries()];
  el.querySelector('[data-penitip]').innerHTML += penitip.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('');
  let tampil = data;
  const gambar = () => {
    const p = el.querySelector('[data-penitip]').value;
    tampil = p ? data.filter(d => String(d.supplier_id) === p) : data;
    el.querySelector('[data-info]').textContent = `${tampil.length} batch · nilai ${rupiah(tampil.reduce((a, x) => a + x.qty * x.hpp, 0))}`;
    el.querySelector('[data-isi]').innerHTML = tampil.length ? tampil.map(x => `<tr><td data-label="Produk"><b>${esc(x.produk?.nama)}</b></td><td data-label="Penitip">${esc(x.supplier?.nama || '')}</td>
      <td data-label="Batch">${esc(x.no_batch)}</td><td data-label="ED">${tanggal(x.ed)}</td><td data-label="Sisa" class="angka">${angka(x.qty)} ${esc(x.produk?.satuan?.nama || '')}</td>
      <td data-label="Harga titip" class="angka">${rupiah(x.hpp)}</td><td data-label="Nilai" class="angka">${rupiah(x.qty * x.hpp)}</td><td data-label="Gudang">${esc(x.gudang?.nama || '')}</td></tr>`).join('')
      : '<tr><td class="kosong" colspan="8">Tidak ada stok titipan.</td></tr>';
  };
  el.querySelector('[data-penitip]').onchange = gambar;
  el.querySelector('[data-csv]').onclick = () => unduhCSV('stok-konsinyasi', [{ label: 'Produk', nilai: x => x.produk?.nama }, { label: 'Penitip', nilai: x => x.supplier?.nama }, { label: 'Batch', nilai: x => x.no_batch },
    { label: 'ED', nilai: x => x.ed }, { label: 'Sisa', nilai: x => x.qty }, { label: 'Harga titip', nilai: x => x.hpp }, { label: 'Nilai', nilai: x => Math.round(x.qty * x.hpp) }], tampil);
  gambar();
});
