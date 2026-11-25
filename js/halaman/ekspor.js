// Pengaturan → Ekspor Data. Kolom data master sama dengan Impor Data, sehingga bisa diubah lalu diimpor lagi.
import { rute, sb, S, bisa, ambilSemua, ambilRef } from '../inti.js?v=1.25.0';
import { ikon } from '../menu.js?v=1.25.0';
import { esc, angka, toast, pesanGalat, judulHalaman } from '../ui.js?v=1.25.0';
import { rpc, hariIni, awalBulan } from '../tabel.js?v=1.25.0';
import { buatExcel, buatCsv, simpanBlob, tglBerkas, catatUnduh } from '../unduh.js?v=1.25.0';
import { KOLOM_IMPOR } from './impor.js?v=1.25.0';

const ya = v => v ? 'Ya' : 'Tidak', n = v => v === null || v === undefined || v === '' ? null : Number(v);
// judul kolom = kata kunci pertama yang dikenali Impor Data
const HURUF = { kodeproduk: 'Kode Produk' };
const kolomImpor = (jenis, ambil) => KOLOM_IMPOR[jenis].filter(([k]) => k in ambil).map(([k, l, t, , kata]) => ({ label: HURUF[kata.split(' ')[0]] || kata.split(' ')[0], ket: l, nilai: ambil[k], t: t === 'n' ? 'angka' : undefined }));

export const DATA_EKSPOR = {
  produk: { nama: 'Produk & satuan', akses: ['master.produk', 'persediaan.produk', 'persediaan.lihat'], impor: true, muat: async () => {
    const [p, ps] = await Promise.all([ambilSemua(() => sb.from('produk').select('*, kategori:kategori_id(nama), satuan:satuan_id(nama), rak:rak_id(nama)').order('id')), ambilSemua(() => sb.from('produk_satuan').select('produk_id,isi,harga_jual,satuan_id,satuan:satuan_id(nama)').order('produk_id').order('isi'))]);
    const m = new Map(); for (const x of ps) (m.get(x.produk_id) || m.set(x.produk_id, []).get(x.produk_id)).push(x);
    for (const x of p) x._s = (m.get(x.id) || []).filter(y => y.satuan_id !== x.satuan_id);
    const s = (i, f) => r => r._s[i] ? f(r._s[i]) : null;
    return { baris: p, kolom: kolomImpor('produk', { kode: r => r.kode, barcode: r => r.barcode, nama: r => r.nama, nama_generik: r => r.nama_generik, pabrik: r => r.pabrik, kategori: r => r.kategori?.nama, golongan: r => r.golongan, satuan: r => r.satuan?.nama, rak: r => r.rak?.nama, harga_beli: r => n(r.harga_beli), harga_jual: r => n(r.harga_jual), stok_min: r => n(r.stok_min), stok_maks: r => n(r.stok_maks), wajib_resep: r => ya(r.wajib_resep), aktif: r => ya(r.aktif), satuan2: s(0, x => x.satuan?.nama), isi2: s(0, x => n(x.isi)), harga2: s(0, x => n(x.harga_jual)), satuan3: s(1, x => x.satuan?.nama), isi3: s(1, x => n(x.isi)), harga3: s(1, x => n(x.harga_jual)) }) };
  } },
  stok: { nama: 'Stok per batch & ED', akses: ['persediaan'], impor: true, outlet: true, muat: async f => ({ baris: await ambilSemua(() => sb.from('stok_batch').select('*, produk:produk_id(kode,barcode,nama,satuan:satuan_id(nama))').eq('outlet_id', f.outlet).eq('konsinyasi', false).neq('qty', 0).order('id')), kolom: kolomImpor('stok', { kode: r => r.produk?.kode, barcode: r => r.produk?.barcode, nama: r => r.produk?.nama, qty: r => n(r.qty), satuan: r => r.produk?.satuan?.nama, batch: r => r.no_batch, ed: r => r.ed, hpp: r => n(r.hpp) }) }) },
  titipan: { nama: 'Barang titipan', akses: ['konsinyasi', 'keuangan.konsinyasi'], outlet: true, muat: async f => ({ baris: await ambilSemua(() => sb.from('stok_batch').select('*, produk:produk_id(kode,nama,satuan:satuan_id(nama)), supplier:supplier_id(nama)').eq('outlet_id', f.outlet).eq('konsinyasi', true).gt('qty', 0).order('id')), kolom: [['Penitip', r => r.supplier?.nama], ['Kode', r => r.produk?.kode], ['Produk', r => r.produk?.nama], ['Sisa', r => n(r.qty), 'angka'], ['Satuan', r => r.produk?.satuan?.nama], ['Batch', r => r.no_batch], ['ED', r => r.ed], ['Harga titip', r => n(r.hpp), 'uang'], ['Nilai', r => Math.round(r.qty * r.hpp), 'uang', true]].map(([label, nilai, t, jml]) => ({ label, nilai, t, jml })) }) },
  supplier: { nama: 'Supplier', akses: ['kontak.supplier'], impor: true, muat: async () => ({ baris: await ambilSemua(() => sb.from('supplier').select('*').order('id')), kolom: kolomImpor('supplier', { kode: r => r.kode, nama: r => r.nama, alamat: r => r.alamat, telp: r => r.telp, email: r => r.email, kontak_person: r => r.kontak_person, npwp: r => r.npwp, tempo_hari: r => n(r.tempo_hari) }) }) },
  pelanggan: { nama: 'Pelanggan', akses: ['kontak.pelanggan'], impor: true, muat: async () => ({ baris: await ambilSemua(() => sb.from('pelanggan').select('*').order('id')), kolom: kolomImpor('pelanggan', { kode: r => r.kode, nama: r => r.nama, telp: r => r.telp, alamat: r => r.alamat, tgl_lahir: r => r.tgl_lahir, jenis_kelamin: r => r.jenis_kelamin, alergi: r => r.alergi, catatan: r => r.catatan }) }) },
  utang: { nama: 'Utang belum lunas', akses: ['keuangan.utang'], impor: true, outlet: true, muat: async f => ({ baris: (await rpc('daftar_utang', { p_outlet: f.outlet })).utang, kolom: kolomImpor('utang', { nama: r => r.supplier, no_faktur: r => r.ref || r.no, tanggal: r => r.tanggal, jatuh_tempo: r => r.jatuh_tempo, jumlah: r => n(r.sisa) }) }) },
  piutang: { nama: 'Piutang belum lunas', akses: ['keuangan.piutang'], impor: true, outlet: true, muat: async f => ({ baris: await rpc('daftar_piutang', { p_outlet: f.outlet }), kolom: kolomImpor('piutang', { nama: r => r.pelanggan, no_faktur: r => r.no, tanggal: r => r.tanggal, jatuh_tempo: r => r.jatuh_tempo, jumlah: r => n(r.sisa) }) }) },
  penjualan: { nama: 'Penjualan (per barang)', akses: ['laporan.penjualan'], outlet: true, tanggal: true, muat: async f => {
    const d = await ambilSemua(() => sb.from('penjualan').select('id,no,tanggal,waktu,status,pengguna_nama,shift_nama,total,pelanggan:pelanggan_id(nama),item:penjualan_item(nama,qty,satuan_nama,harga,diskon_promo,diskon_manual,subtotal),bayar:penjualan_bayar(jumlah,metode:metode_bayar_id(nama))').eq('outlet_id', f.outlet).in('status', ['selesai', 'batal']).gte('tanggal', f.dari).lte('tanggal', f.sampai).order('id'), 100000);
    return { baris: d.flatMap(j => j.item.map(i => ({ j, i }))), kolom: [['No nota', r => r.j.no], ['Tanggal', r => r.j.tanggal], ['Jam', r => new Date(r.j.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })], ['Status', r => r.j.status], ['Kasir', r => r.j.pengguna_nama], ['Shift', r => r.j.shift_nama], ['Pelanggan', r => r.j.pelanggan?.nama], ['Produk', r => r.i.nama], ['Jumlah', r => n(r.i.qty), 'angka'], ['Satuan', r => r.i.satuan_nama], ['Harga', r => n(r.i.harga), 'uang'], ['Diskon', r => Number(r.i.diskon_promo || 0) + Number(r.i.diskon_manual || 0), 'uang'], ['Subtotal', r => n(r.i.subtotal), 'uang'], ['Total nota', r => n(r.j.total), 'uang'], ['Bayar', r => r.j.bayar.map(b => b.metode?.nama).filter(Boolean).join(', ')]].map(([label, nilai, t]) => ({ label, nilai, t })) };
  } },
  pembelian: { nama: 'Pembelian (per barang)', akses: ['laporan.pembelian', 'pembelian.faktur'], outlet: true, tanggal: true, muat: async f => {
    const d = await ambilSemua(() => sb.from('faktur_beli').select('id,no,no_faktur,tanggal,jatuh_tempo,cara_bayar,total,supplier:supplier_id(nama),item:faktur_beli_item(qty,bonus,isi,harga,diskon_persen,no_batch,ed,subtotal,produk:produk_id(kode,nama),satuan:satuan_id(nama))').eq('outlet_id', f.outlet).eq('status', 'posting').gte('tanggal', f.dari).lte('tanggal', f.sampai).order('id'), 50000);
    return { baris: d.flatMap(j => j.item.map(i => ({ j, i }))), kolom: [['No', r => r.j.no], ['No faktur', r => r.j.no_faktur], ['Tanggal', r => r.j.tanggal], ['Jatuh tempo', r => r.j.jatuh_tempo], ['Supplier', r => r.j.supplier?.nama], ['Kode', r => r.i.produk?.kode], ['Produk', r => r.i.produk?.nama], ['Jumlah', r => n(r.i.qty), 'angka'], ['Bonus', r => n(r.i.bonus), 'angka'], ['Satuan', r => r.i.satuan?.nama], ['Harga', r => n(r.i.harga), 'uang'], ['Diskon %', r => n(r.i.diskon_persen), 'angka'], ['Batch', r => r.i.no_batch], ['ED', r => r.i.ed], ['Subtotal', r => n(r.i.subtotal), 'uang'], ['Total faktur', r => n(r.j.total), 'uang']].map(([label, nilai, t]) => ({ label, nilai, t })) };
  } },
};

rute('pengaturan/ekspor', async el => {
  const ada = Object.entries(DATA_EKSPOR).filter(([, d]) => d.akses.some(bisa)), outlet = bisa('outlet.daftar') ? await ambilRef('outlet') : [];
  el.innerHTML = judulHalaman('Ekspor Data', 'Pengaturan / Ekspor Data') + `<form class="kartu" onsubmit="return false"><p class="pesan info" style="margin-top:0">Data bertanda <b>bisa diimpor</b> memakai kolom yang sama dengan Impor Data. Setiap ekspor dicatat di Log Aktivitas.</p>
    <div class="pilih-model">${ada.map(([k, d]) => `<label><input type="checkbox" name="d" value="${k}"><b>${esc(d.nama)}</b><small>${d.impor ? 'bisa diimpor' : ''}${d.tanggal ? 'sesuai tanggal' : ''}</small></label>`).join('')}</div>
    <div class="form-grid" style="margin-top:14px"><label class="isian"><span>Format</span><select name="f"><option value="xlsx">Excel (satu berkas, satu lembar per data)</option><option value="csv">CSV (satu berkas per data)</option></select></label>${outlet.length > 1 ? `<label class="isian"><span>Outlet</span><select name="o">${outlet.map(o => `<option value="${o.id}" ${o.id === S.pengguna.outlet_id ? 'selected' : ''}>${esc(o.nama)}</option>`).join('')}</select></label>` : ''}<label class="isian"><span>Dari tanggal</span><input type="date" name="a" value="${awalBulan()}" max="${hariIni()}"></label><label class="isian"><span>Sampai</span><input type="date" name="b" value="${hariIni()}" max="${hariIni()}"></label></div>
    <button class="tombol" data-ekspor>${ikon('unduh')} Ekspor</button> <span data-jalan style="color:var(--teks-2)"></span></form><p class="pesan peringatan">Berkas berisi data pelanggan dan keuangan. Simpan di tempat aman dan jangan dibagikan.</p>`;
  el.addEventListener('change', () => el.querySelectorAll('.pilih-model label').forEach(l => l.classList.toggle('aktif', l.querySelector('input').checked)));
  el.querySelector('[data-ekspor]').onclick = async e => {
    const f = el.querySelector('form'), pilih = [...f.querySelectorAll('[name=d]:checked')].map(x => x.value), p = { outlet: Number(f.o?.value || S.pengguna.outlet_id), dari: f.a.value, sampai: f.b.value }, j = el.querySelector('[data-jalan]');
    if (!pilih.length) return toast('Pilih data yang diekspor', 'galat'); if (!p.dari || !p.sampai || p.dari > p.sampai) return toast('Tanggal tidak valid', 'galat');
    e.target.disabled = true;
    try {
      const lembar = []; for (const k of pilih) { j.textContent = `Mengambil ${DATA_EKSPOR[k].nama}…`; lembar.push({ nama: DATA_EKSPOR[k].nama, kunci: k, ...await DATA_EKSPOR[k].muat(p) }); }
      j.textContent = 'Membuat berkas…';
      if (f.f.value === 'xlsx') simpanBlob(await buatExcel(lembar), `ekspor-${pilih.length === 1 ? pilih[0] : 'data'}-${tglBerkas()}.xlsx`);
      else for (const l of lembar) { simpanBlob(new Blob([buatCsv(l.kolom, l.baris)], { type: 'text/csv;charset=utf-8' }), `ekspor-${l.kunci}-${tglBerkas()}.csv`); await new Promise(r => setTimeout(r, 400)); }
      await catatUnduh('Ekspor ' + lembar.map(l => `${l.nama} ${l.baris.length}`).join(', ')); j.textContent = lembar.map(l => `${l.nama}: ${angka(l.baris.length)} baris`).join(' · '); toast('Ekspor selesai', 'sukses');
    } catch (x) { j.textContent = ''; toast(pesanGalat(x), 'galat'); }
    e.target.disabled = false;
  };
});
