// Persediaan: Daftar Produk (dengan stok & kartu stok), Defecta, Stok Kedaluwarsa, Stok Opname, Penyesuaian, Perpindahan.
import { rute, sb, S, bisa, ambilSemua } from '../inti.js?v=1.24.0';
import { ikon } from '../menu.js?v=1.24.0';
import { esc, angka, rupiah, tanggal, waktu, toast, modal, pesanGalat, judulHalaman, unduhCSV } from '../ui.js?v=1.24.0';
import { halamanCrud } from '../crud.js?v=1.24.0';
import { cfgProduk } from './master.js?v=1.24.0';
import { rutekanDokumen, barisTotal } from '../dokumen.js?v=1.24.0';
import { ambilKonfig } from './pengaturan.js?v=1.24.0';
import { bukaCetakLabel } from '../label.js?v=1.24.0';

export const JENIS_MUTASI = {
  beli: 'Pembelian', retur_beli: 'Retur pembelian', penyesuaian: 'Penyesuaian', opname: 'Stok opname', pindah_keluar: 'Pindah keluar',
  pindah_masuk: 'Pindah masuk', konsinyasi: 'Konsinyasi masuk', retur_konsinyasi: 'Retur konsinyasi', jual: 'Penjualan', retur_jual: 'Retur penjualan',
};
const namaJenis = j => j.startsWith('batal_') ? 'Batal ' + (JENIS_MUTASI[j.slice(6)] || j.slice(6)).toLowerCase() : (JENIS_MUTASI[j] || j);
const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const selisihHari = d => Math.round((new Date(d + 'T00:00:00') - new Date(hariIni() + 'T00:00:00')) / 864e5);
// dari Dashboard: [{produk_id, qty}] dalam satuan dasar
export async function kirimRencana(a) {
  const { data, error } = await sb.from('produk').select('id,satuan_id,harga_beli').in('id', a.map(x => x.produk_id)); if (error) throw error;
  const m = new Map(data.map(p => [p.id, p]));
  kirimKe('rencana', 'pembelian/rencana', { header: {}, items: a.filter(x => m.has(x.produk_id)).map(x => ({ produk_id: x.produk_id, satuan_id: m.get(x.produk_id).satuan_id, isi: 1, qty: x.qty, harga: Math.round(m.get(x.produk_id).harga_beli || 0) })) });
}
const kirimKe = (jenis, ruteDok, data) => { sessionStorage.setItem('prefill:' + jenis, JSON.stringify(data)); location.hash = `#/${ruteDok}/baru`; };

// ---------- Kartu stok ----------
export async function kartuStok(p) {
  const o = S.pengguna.outlet_id;
  const [{ data: b }, { data: m }] = await Promise.all([
    sb.from('stok_batch').select('*, gudang:gudang_id(nama), supplier:supplier_id(nama)').eq('produk_id', p.id).eq('outlet_id', o).gt('qty', 0).order('ed', { nullsFirst: false }),
    sb.from('stok_mutasi').select('*').eq('produk_id', p.id).eq('outlet_id', o).order('id', { ascending: false }).limit(200),
  ]);
  const sat = p.satuan_id__ref?.nama || '';
  const total = (b || []).reduce((a, x) => a + Number(x.qty), 0);
  // saldo berjalan dihitung mundur dari stok saat ini
  let saldo = total;
  const baris = (m || []).map(x => { const s = saldo; saldo -= Number(x.qty); return { ...x, saldo: s }; });
  modal({ judul: 'Kartu Stok: ' + p.nama, ukuran: 'besar', isi: `
    <div class="grid-4" style="margin-bottom:14px"><div class="statistik"><small>Stok</small><b>${angka(total)} ${esc(sat)}</b></div>
      <div class="statistik"><small>Nilai (HPP)</small><b>${rupiah((b || []).reduce((a, x) => a + x.qty * x.hpp, 0))}</b></div>
      <div class="statistik"><small>Stok minimum</small><b>${angka(p.stok_min)}</b></div><div class="statistik"><small>Harga jual</small><b>${rupiah(p.harga_jual)}</b></div></div>
    <h4 style="margin:0 0 6px">Batch tersedia</h4>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Batch</th><th>ED</th><th>Gudang</th><th class="angka">Sisa</th><th class="angka">HPP</th><th></th></tr></thead><tbody>
      ${(b || []).length ? b.map(x => `<tr><td>${esc(x.no_batch)}</td><td>${tanggal(x.ed)}</td><td>${esc(x.gudang?.nama || '')}</td><td class="angka">${angka(x.qty)}</td><td class="angka">${rupiah(x.hpp)}</td>
        <td>${x.konsinyasi ? `<span class="chip oranye">titipan ${esc(x.supplier?.nama || '')}</span>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="kosong">Stok kosong</td></tr>'}</tbody></table></div>
    <h4 style="margin:16px 0 6px">Riwayat keluar-masuk (200 terakhir)</h4>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Waktu</th><th>Jenis</th><th>Dokumen</th><th class="angka">Masuk</th><th class="angka">Keluar</th><th class="angka">Saldo</th><th>Oleh</th></tr></thead><tbody>
      ${baris.length ? baris.map(x => `<tr><td style="white-space:nowrap">${waktu(x.waktu)}</td><td>${esc(namaJenis(x.jenis))}</td><td>${esc(x.ref_no || '')}</td>
        <td class="angka">${x.qty > 0 ? angka(x.qty) : ''}</td><td class="angka">${x.qty < 0 ? angka(-x.qty) : ''}</td><td class="angka">${angka(x.saldo)}</td><td>${esc(x.pengguna_nama || '')}</td></tr>`).join('')
        : '<tr><td colspan="7" class="kosong">Belum ada riwayat</td></tr>'}</tbody></table></div>`, tombol: [{ teks: 'Tutup', kelas: 'kedua' }] });
}

async function tempelStok(data) {
  if (!data.length) return;
  const { data: st } = await sb.from('stok_produk').select('produk_id,qty,ed_terdekat').eq('outlet_id', S.pengguna.outlet_id).in('produk_id', data.map(d => d.id));
  for (const d of data) { const s = st?.find(x => x.produk_id === d.id); d._stok = Number(s?.qty || 0); d._ed = s?.ed_terdekat; }
}

// ---------- Daftar Produk ----------
{
  const cfg = cfgProduk('Daftar Produk', 'Persediaan / Daftar Produk');
  const i = cfg.kolom.findIndex(k => k.f === 'golongan');
  cfg.kolom.splice(i, 0, { f: '_stok', label: 'Stok', form: false, tipe: 'angka', tampil: r => {
    const habis = r._stok <= 0, tipis = !habis && r.stok_min > 0 && r._stok <= r.stok_min;
    return `<span class="chip ${habis ? 'merah' : tipis ? 'oranye' : 'hijau'}">${angka(r._stok)} ${esc(r.satuan_id__ref?.nama || '')}</span>`;
  } });
  cfg.kolom.splice(i + 1, 0, { f: '_ed', label: 'ED Terdekat', form: false, tampil: r => {
    if (!r._ed) return '';
    const h = selisihHari(r._ed);
    return `<span class="${h < 0 ? 'chip merah' : h <= 90 ? 'chip oranye' : ''}">${tanggal(r._ed)}</span>`;
  } });
  cfg.setelahMuat = tempelStok;
  cfg.aksiBaris = [{ ikon: 'laporan', judul: 'Kartu stok', fn: kartuStok }, { ikon: 'barcode', judul: 'Cetak label', fn: p => bukaCetakLabel(p) }];
  cfg.aksiAtas = [{ ikon: 'barcode', judul: 'Cetak Label', fn: () => bukaCetakLabel() }];
  cfg.kunciTulis = ['persediaan.produk', 'master.produk'];
  rute('persediaan/produk', halamanCrud(cfg));
}

// ---------- Defecta ----------
rute('persediaan/defecta', async el => {
  el.innerHTML = judulHalaman('Defecta', 'Persediaan / Defecta', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><p class="pesan info" style="margin-top:0">Produk yang stoknya sudah di bawah atau sama dengan <b>stok minimum</b>. Centang lalu buat rencana pembelian atau SP.</p>
    <div class="alat-tabel"><label class="cek" style="margin:0"><input type="checkbox" data-nol> Tampilkan juga produk stok habis yang belum diberi stok minimum</label>
      <span style="margin-left:auto;display:flex;gap:8px"><button class="tombol kedua" data-ke="rencana">Buat Rencana Pembelian</button><button class="tombol" data-ke="pesanan">Buat SP</button></span></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th><input type="checkbox" data-semua></th><th>Produk</th><th class="angka">Stok</th><th class="angka">Min</th><th class="angka">Maks</th><th class="angka">Saran Pesan</th><th>Satuan</th></tr></thead>
    <tbody data-isi><tr><td class="kosong" colspan="7">Memuat...</td></tr></tbody></table></div></div>`;
  const [p, st] = await Promise.all([
    ambilSemua(() => sb.from('produk').select('id,kode,nama,stok_min,stok_maks,harga_beli,satuan_id,satuan:satuan_id(nama)').eq('aktif', true).order('nama').order('id')),
    ambilSemua(() => sb.from('stok_produk').select('produk_id,qty').eq('outlet_id', S.pengguna.outlet_id).order('produk_id')),
  ]);
  const stok = Object.fromEntries((st || []).map(s => [s.produk_id, Number(s.qty)]));
  let data = [];
  const gambar = () => {
    const nol = el.querySelector('[data-nol]').checked;
    data = p.map(x => ({ ...x, stok: stok[x.id] || 0 })).filter(x => (x.stok_min > 0 && x.stok <= x.stok_min) || (nol && x.stok <= 0))
      .map(x => ({ ...x, saran: Math.max(1, Math.ceil((x.stok_maks > 0 ? x.stok_maks : Math.max(x.stok_min * 2, 1)) - x.stok)) }));
    el.querySelector('[data-isi]').innerHTML = data.length ? data.map((x, i) => `<tr><td><input type="checkbox" data-pilih="${i}" checked></td>
      <td data-label="Produk"><b>${esc(x.nama)}</b> <small style="color:var(--teks-2)">${esc(x.kode || '')}</small></td>
      <td data-label="Stok" class="angka"><span class="chip ${x.stok <= 0 ? 'merah' : 'oranye'}">${angka(x.stok)}</span></td><td data-label="Min" class="angka">${angka(x.stok_min)}</td>
      <td data-label="Maks" class="angka">${angka(x.stok_maks)}</td><td data-label="Saran" class="angka"><input type="number" class="input" style="width:90px;text-align:right" min="0" data-saran="${i}" value="${x.saran}"></td>
      <td data-label="Satuan">${esc(x.satuan?.nama || '')}</td></tr>`).join('') : '<tr><td class="kosong" colspan="7">Tidak ada produk yang perlu dipesan. 👍</td></tr>';
  };
  el.querySelector('[data-nol]').onchange = gambar;
  el.querySelector('[data-semua]').onchange = e => el.querySelectorAll('[data-pilih]').forEach(c => c.checked = e.target.checked);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-ke]');
    if (b) {
      const pilih = [...el.querySelectorAll('[data-pilih]:checked')].map(c => { const x = data[c.dataset.pilih]; return { ...x, saran: Number(el.querySelector(`[data-saran="${c.dataset.pilih}"]`).value) }; }).filter(x => x.saran > 0);
      if (!pilih.length) return toast('Centang minimal satu produk', 'galat');
      const items = pilih.map(x => ({ produk_id: x.id, satuan_id: x.satuan_id, isi: 1, qty: x.saran, harga: Math.round(x.harga_beli || 0) }));
      kirimKe(b.dataset.ke, b.dataset.ke === 'rencana' ? 'pembelian/rencana' : 'pembelian/pesanan', { header: {}, items });
    }
    if (e.target.closest('[data-csv]')) unduhCSV('defecta', [{ label: 'Kode', nilai: x => x.kode }, { label: 'Produk', nilai: x => x.nama }, { label: 'Stok', nilai: x => x.stok },
      { label: 'Min', nilai: x => x.stok_min }, { label: 'Maks', nilai: x => x.stok_maks }, { label: 'Saran', nilai: x => x.saran }, { label: 'Satuan', nilai: x => x.satuan?.nama }], data);
  });
  gambar();
});

// ---------- Stok Kedaluwarsa ----------
rute('persediaan/kedaluwarsa', async el => {
  const k = await ambilKonfig();
  const n = Number(k.persediaan.peringatan_ed_hari || 90);
  el.innerHTML = judulHalaman('Stok Kedaluwarsa', 'Persediaan / Stok Kedaluwarsa', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div class="alat-tabel"><select class="input" style="width:auto" data-batas>
      <option value="0">Sudah kedaluwarsa</option><option value="30">ED ≤ 30 hari lagi</option><option value="${n}" selected>ED ≤ ${n} hari lagi</option><option value="180">ED ≤ 180 hari lagi</option><option value="365">ED ≤ 1 tahun lagi</option></select>
      <span style="color:var(--teks-2)" data-info></span>
      <span style="margin-left:auto;display:flex;gap:8px"><button class="tombol kedua" data-ke="retur_beli">Retur ke Supplier</button><button class="tombol kedua" data-ke="penyesuaian">Keluarkan (dimusnahkan)</button></span></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th><input type="checkbox" data-semua></th><th>Produk</th><th>Batch</th><th>ED</th><th>Sisa waktu</th><th class="angka">Stok</th><th class="angka">Nilai HPP</th><th>Gudang</th></tr></thead>
    <tbody data-isi></tbody></table></div></div>`;
  let data = [];
  async function muat() {
    const hari = Number(el.querySelector('[data-batas]').value);
    const batas = new Date(new Date(hariIni()).getTime() + hari * 864e5).toISOString().slice(0, 10);
    let d;
    try { d = await ambilSemua(() => { const q = sb.from('stok_batch').select('*, produk:produk_id(nama,kode,satuan:satuan_id(nama)), gudang:gudang_id(nama)').eq('outlet_id', S.pengguna.outlet_id).gt('qty', 0).not('ed', 'is', null).order('ed').order('id'); return hari === 0 ? q.lt('ed', hariIni()) : q.lte('ed', batas); }); }
    catch (e) { return toast(pesanGalat(e), 'galat'); }
    data = d;
    el.querySelector('[data-info]').textContent = `${d.length} batch · nilai ${rupiah(d.reduce((a, x) => a + x.qty * x.hpp, 0))}`;
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map((x, i) => { const h = selisihHari(x.ed); return `<tr><td><input type="checkbox" data-pilih="${i}"></td>
      <td data-label="Produk"><b>${esc(x.produk?.nama)}</b>${x.konsinyasi ? ' <span class="chip oranye">titipan</span>' : ''}</td><td data-label="Batch">${esc(x.no_batch)}</td>
      <td data-label="ED">${tanggal(x.ed)}</td><td data-label="Sisa waktu"><span class="chip ${h < 0 ? 'merah' : h <= 30 ? 'oranye' : ''}">${h < 0 ? `lewat ${-h} hari` : h === 0 ? 'hari ini' : `${h} hari lagi`}</span></td>
      <td data-label="Stok" class="angka">${angka(x.qty)} ${esc(x.produk?.satuan?.nama || '')}</td><td data-label="Nilai" class="angka">${rupiah(x.qty * x.hpp)}</td><td data-label="Gudang">${esc(x.gudang?.nama || '')}</td></tr>`; }).join('')
      : '<tr><td class="kosong" colspan="8">Tidak ada stok pada rentang ini. 👍</td></tr>';
  }
  el.querySelector('[data-batas]').onchange = muat;
  el.querySelector('[data-semua]').onchange = e => el.querySelectorAll('[data-pilih]').forEach(c => c.checked = e.target.checked);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-ke]');
    if (b) {
      const pilih = [...el.querySelectorAll('[data-pilih]:checked')].map(c => data[c.dataset.pilih]);
      if (!pilih.length) return toast('Centang batch yang mau diproses', 'galat');
      if (b.dataset.ke === 'retur_beli') {
        if (pilih.some(x => x.konsinyasi)) return toast('Barang titipan diretur lewat menu Retur Konsinyasi', 'galat');
        kirimKe('retur_beli', 'pembelian/retur', { header: {}, items: pilih.map(x => ({ produk_id: x.produk_id, batch_id: x.id, qty: Number(x.qty), harga: Math.round(x.hpp), alasan: 'Kedaluwarsa' })) });
      } else kirimKe('penyesuaian', 'persediaan/penyesuaian', { header: { catatan: 'Pemusnahan obat kedaluwarsa' }, items: pilih.map(x => ({ produk_id: x.produk_id, batch_id: x.id, arah: 'kurang', qty: Number(x.qty), alasan: 'Kedaluwarsa' })) });
    }
    if (e.target.closest('[data-csv]')) unduhCSV('stok-kedaluwarsa', [{ label: 'Produk', nilai: x => x.produk?.nama }, { label: 'Batch', nilai: x => x.no_batch }, { label: 'ED', nilai: x => x.ed },
      { label: 'Stok', nilai: x => x.qty }, { label: 'Nilai HPP', nilai: x => Math.round(x.qty * x.hpp) }, { label: 'Gudang', nilai: x => x.gudang?.nama }, { label: 'Titipan', nilai: x => x.konsinyasi ? 'Ya' : '' }], data);
  });
  muat();
});

// ---------- Peringatan ----------
const tglPlus = n => new Date(new Date(hariIni()).getTime() + n * 864e5).toISOString().slice(0, 10);
export const JENIS_PERINGATAN = [
  ['ed', 'Hampir / sudah ED', 'merah'], ['rugi', 'Berpotensi rugi', 'merah'], ['menipis', 'Stok menipis', 'oranye'],
  ['habis', 'Stok habis', 'oranye'], ['harga', 'Belum ada harga jual', 'oranye'],
];
function kueriPeringatan(jenis, k, kepala = false) {
  const o = S.pengguna.outlet_id;
  const opsi = kepala ? { count: 'exact', head: true } : undefined;
  if (jenis === 'ed') return sb.from('stok_batch').select(kepala ? 'id' : '*, produk:produk_id(nama,kode,satuan:satuan_id(nama)), gudang:gudang_id(nama)', opsi)
    .eq('outlet_id', o).gt('qty', 0).not('ed', 'is', null).lte('ed', tglPlus(Number(k.persediaan.peringatan_ed_hari || 90))).order('ed');
  let q = sb.from('peringatan_produk').select('*', opsi).eq('outlet_id', o);
  if (jenis === 'rugi') q = q.gt('harga_jual', 0).lt('margin', Number(k.persediaan.batas_margin_persen || 0)).order('margin');
  if (jenis === 'menipis') q = q.eq('menipis', true).order('nama');
  if (jenis === 'habis') q = q.eq('habis', true).order('nama');
  if (jenis === 'harga') q = q.eq('tanpa_harga', true).order('nama');
  return q;
}
let peringatanAkhir = null, peringatanWaktu = 0, peringatanOutlet = null;
export function hitungPeringatan() {          // dipakai bersama lonceng & beranda, disimpan 1 menit
  if (peringatanAkhir && peringatanOutlet === S.pengguna.outlet_id && Date.now() - peringatanWaktu < 60000) return peringatanAkhir;
  peringatanWaktu = Date.now(); peringatanOutlet = S.pengguna.outlet_id;
  peringatanAkhir = (async () => {
    const k = await ambilKonfig();
    const hasil = await Promise.all(JENIS_PERINGATAN.map(([j]) => kueriPeringatan(j, k, true)));
    const rusak = hasil.find(h => h.error); if (rusak) throw rusak.error;
    return Object.fromEntries(JENIS_PERINGATAN.map(([j], i) => [j, hasil[i].count || 0]));
  })();
  peringatanAkhir.catch(() => { peringatanAkhir = null; });
  return peringatanAkhir;
}

const bolehHarga = () => bisa('master.produk') || bisa('persediaan.produk');
async function simpanHargaJual(id, harga) {
  const { error } = await sb.from('produk').update({ harga_jual: harga }).eq('id', id);
  if (error) throw error;
}
// Jendela "cek harga jual" (dipakai setelah faktur diposting & di halaman peringatan)
export function tampilCekHarga(daftar, batas, saran) {
  const boleh = bolehHarga();
  const saranHarga = x => Math.ceil(x.harga_beli * (1 + saran / 100) / 100) * 100;
  modal({ judul: 'Cek Harga Jual', ukuran: 'besar', isi: `<p class="pesan peringatan" style="margin-top:0">Produk berikut <b>belum punya harga jual</b> atau marginnya <b>di bawah ${angka(batas)}%</b> setelah harga beli terbaru. Periksa harga jualnya.</p>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Produk</th><th class="angka">Harga beli</th><th class="angka">Harga jual</th><th class="angka">Margin</th><th class="angka">Saran (${angka(saran)}%)</th>${boleh ? '<th>Harga jual baru</th><th></th>' : ''}</tr></thead><tbody>
    ${daftar.map((x, i) => { const m = x.harga_beli > 0 ? (x.harga_jual - x.harga_beli) / x.harga_beli * 100 : null; return `<tr><td><b>${esc(x.nama)}</b></td><td class="angka">${rupiah(x.harga_beli)}</td>
      <td class="angka">${x.harga_jual > 0 ? rupiah(x.harga_jual) : '<span class="chip oranye">belum ada</span>'}</td><td class="angka">${m === null || x.harga_jual <= 0 ? '-' : `<span class="chip ${m < 0 ? 'merah' : 'oranye'}">${angka(m)}%</span>`}</td>
      <td class="angka">${rupiah(saranHarga(x))}</td>${boleh ? `<td><input type="number" class="input" style="width:120px;text-align:right" min="0" data-harga="${i}" value="${saranHarga(x)}"></td>
      <td><button class="tombol kecil" data-simpan-harga="${i}">Simpan</button></td>` : ''}</tr>`; }).join('')}</tbody></table></div>`,
    tombol: [{ teks: 'Tutup', kelas: 'kedua' }],
    saatBuka: m => m.addEventListener('click', async e => {
      const b = e.target.closest('[data-simpan-harga]'); if (!b) return;
      const i = b.dataset.simpanHarga, v = Number(m.querySelector(`[data-harga="${i}"]`).value);
      if (!(v > 0)) return toast('Isi harga jual', 'galat');
      b.disabled = true;
      try { await simpanHargaJual(daftar[i].id || daftar[i].produk_id, v); b.textContent = '✓ Tersimpan'; b.classList.add('kedua'); } catch (er) { toast(pesanGalat(er), 'galat'); b.disabled = false; }
    }),
  });
}

rute('persediaan/peringatan', async (el, [tab]) => {
  const k = await ambilKonfig();
  const aktif = JENIS_PERINGATAN.some(j => j[0] === tab) ? tab : 'ed';
  const jumlah = await hitungPeringatan();
  el.innerHTML = judulHalaman('Peringatan Stok', 'Persediaan / Peringatan Stok', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${JENIS_PERINGATAN.map(([j, l, w]) => `<a href="#/persediaan/peringatan/${j}" class="tombol ${j === aktif ? '' : 'kedua'} kecil">${esc(l)} <span class="chip ${jumlah[j] ? w : ''}" style="margin-left:4px">${jumlah[j]}</span></a>`).join('')}</div>
    <p style="color:var(--teks-2);margin:0 0 10px" data-ket></p>
    <div class="bungkus-tabel"><table class="tabel kartu-hp" data-tabel></table></div></div>`;
  const ket = {
    ed: `Batch yang ED-nya ≤ ${k.persediaan.peringatan_ed_hari} hari lagi atau sudah lewat. Atur batas hari di Pengaturan → Konfigurasi.`,
    rugi: `Produk dengan margin di bawah ${k.persediaan.batas_margin_persen}% (dari harga beli termasuk PPN). Atur batas di Pengaturan → Konfigurasi.`,
    menipis: 'Stok masih ada tapi sudah di bawah atau sama dengan stok minimum produk.',
    habis: 'Stok habis padahal produk diberi stok minimum.',
    harga: 'Produk aktif yang harga jualnya masih 0.',
  };
  el.querySelector('[data-ket]').textContent = ket[aktif];
  let data;
  try { data = await ambilSemua(() => kueriPeringatan(aktif, k).order(aktif === 'ed' ? 'id' : 'produk_id')); } catch (e) { return toast(pesanGalat(e), 'galat'); }
  const t = el.querySelector('[data-tabel]');
  const boleh = bolehHarga();
  if (aktif === 'ed') {
    t.innerHTML = `<thead><tr><th>Produk</th><th>Batch</th><th>ED</th><th>Sisa waktu</th><th class="angka">Stok</th><th class="angka">Nilai HPP</th><th>Gudang</th></tr></thead><tbody>${data.length ? data.map(x => { const h = selisihHari(x.ed);
      return `<tr><td data-label="Produk"><b>${esc(x.produk?.nama)}</b>${x.konsinyasi ? ' <span class="chip oranye">titipan</span>' : ''}</td><td data-label="Batch">${esc(x.no_batch)}</td><td data-label="ED">${tanggal(x.ed)}</td>
      <td data-label="Sisa waktu"><span class="chip ${h < 0 ? 'merah' : 'oranye'}">${h < 0 ? `lewat ${-h} hari` : h === 0 ? 'hari ini' : `${h} hari lagi`}</span></td><td data-label="Stok" class="angka">${angka(x.qty)} ${esc(x.produk?.satuan?.nama || '')}</td>
      <td data-label="Nilai" class="angka">${rupiah(x.qty * x.hpp)}</td><td data-label="Gudang">${esc(x.gudang?.nama || '')}</td></tr>`; }).join('') : '<tr><td class="kosong" colspan="7">Aman, tidak ada. 👍</td></tr>'}</tbody>`;
    if (data.length) el.querySelector('[data-ket]').innerHTML += ' <a href="#/persediaan/kedaluwarsa">Proses di halaman Stok Kedaluwarsa →</a>';
  } else {
    const hargaKolom = aktif === 'rugi' || aktif === 'harga';
    t.innerHTML = `<thead><tr><th>Produk</th><th class="angka">Stok</th><th class="angka">Stok min</th><th class="angka">Harga beli</th><th class="angka">Harga jual</th><th class="angka">Margin</th><th></th></tr></thead><tbody>${data.length ? data.map((x, i) => `<tr>
      <td data-label="Produk"><b>${esc(x.nama)}</b> <small style="color:var(--teks-2)">${esc(x.kode || '')}</small></td><td data-label="Stok" class="angka">${angka(x.stok)} ${esc(x.satuan || '')}</td>
      <td data-label="Stok min" class="angka">${angka(x.stok_min)}</td><td data-label="Harga beli" class="angka">${rupiah(x.harga_beli)}</td><td data-label="Harga jual" class="angka">${rupiah(x.harga_jual)}</td>
      <td data-label="Margin" class="angka">${x.margin === null || x.harga_jual <= 0 ? '-' : `<span class="chip ${x.margin < 0 ? 'merah' : x.margin < k.persediaan.batas_margin_persen ? 'oranye' : ''}">${angka(x.margin)}%</span>`}</td>
      <td class="aksi">${hargaKolom && boleh ? `<button class="tombol kecil kedua" data-cek="${i}">Ubah harga</button>` : ''}${['menipis', 'habis'].includes(aktif) ? `<button class="tombol kecil kedua" data-pesan="${i}">Pesan</button>` : ''}</td></tr>`).join('')
      : '<tr><td class="kosong" colspan="7">Aman, tidak ada. 👍</td></tr>'}</tbody>`;
    if (['menipis', 'habis'].includes(aktif) && data.length) el.querySelector('[data-ket]').innerHTML += ' <a href="#/persediaan/defecta">Buat pesanan dari halaman Defecta →</a>';
  }
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-cek]');
    if (c) { const x = data[c.dataset.cek]; tampilCekHarga([{ ...x, id: x.produk_id }], Number(k.persediaan.batas_margin_persen), Number(k.persediaan.margin_saran_persen)); }
    if (e.target.closest('[data-pesan]')) location.hash = '#/persediaan/defecta';
    if (e.target.closest('[data-csv]')) unduhCSV('peringatan-' + aktif, aktif === 'ed'
      ? [{ label: 'Produk', nilai: x => x.produk?.nama }, { label: 'Batch', nilai: x => x.no_batch }, { label: 'ED', nilai: x => x.ed }, { label: 'Stok', nilai: x => x.qty }]
      : [{ label: 'Kode', nilai: x => x.kode }, { label: 'Produk', nilai: x => x.nama }, { label: 'Stok', nilai: x => x.stok }, { label: 'Stok min', nilai: x => x.stok_min },
        { label: 'Harga beli', nilai: x => x.harga_beli }, { label: 'Harga jual', nilai: x => x.harga_jual }, { label: 'Margin %', nilai: x => x.margin }], data);
  });
  return 'Peringatan Stok';
});

// ---------- Dokumen persediaan ----------
const gudangOutlet = (label, wajib = false) => ({ f: 'gudang_id', label, tipe: 'ref', ref: 'gudang', refKolom: 'id,nama,outlet_id', saring: o => o.outlet_id === S.pengguna.outlet_id, wajib, ubahBatch: true });
const filterGudang = h => ({ gudang_id: h.gudang_id || undefined });
const kolomGudang = { label: 'Gudang', nilai: r => esc(r.gudang?.nama || 'Utama') };

rutekanDokumen({
  jenis: 'opname', rute: 'persediaan/opname', judul: 'Stok Opname', satuan: 'Stok Opname', remah: 'Persediaan / Stok Opname', stok: true,
  tabel: 'stok_opname', tabelItem: 'stok_opname_item', fk: 'opname_id', kunci: 'persediaan.opname',
  labelPosting: 'Selesaikan Opname', pesanPosting: 'Stok sistem akan disamakan dengan jumlah fisik yang diisi. Baris yang jumlah fisiknya kosong tidak diubah. Lanjutkan?',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, gudang:gudang_id(nama)', daftarKolom: [kolomGudang, { label: 'Catatan', nilai: r => esc(r.catatan || '') }],
  header: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, gudangOutlet('Gudang'), { f: 'catatan', label: 'Catatan', tipe: 'area' }],
  filterBatch: filterGudang,
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'batch', label: 'Batch', tipe: 'batch', kosong: '— batch baru —' },
    { f: 'no_batch', label: 'No. Batch Baru', tipe: 'teks', lebar: 90 }, { f: 'ed', label: 'ED Baru', tipe: 'tanggal' },
    { f: 'qty_sistem', label: 'Stok Sistem', tipe: 'info', simpan: true }, { f: 'qty_fisik', label: 'Jumlah Fisik', tipe: 'angka', bolehKosong: true },
    { f: 'sel', label: 'Selisih', tipe: 'hitung', hitung: r => r.qty_fisik === null || r.qty_fisik === undefined ? '' : (() => { const s = r.qty_fisik - (r.qty_sistem || 0); return `<span class="chip ${s < 0 ? 'merah' : s > 0 ? 'hijau' : ''}">${s > 0 ? '+' : ''}${angka(s)}</span>`; })() },
  ],
  itemBaru: () => ({ qty_sistem: 0, qty_fisik: null }), fokus: 'qty_fisik', gabung: false,
  saatPilihBatch: (r, b) => { r.qty_sistem = Number(b?.qty || 0); r.no_batch = b ? null : r.no_batch; r.ed = b ? null : r.ed; },
  aksiItem: [{ teks: 'Muat semua stok gudang', fn: async st => {
    const data = await ambilSemua(() => { const q = sb.from('stok_batch').select('id,produk_id,no_batch,ed,qty,hpp,gudang_id,konsinyasi,gudang:gudang_id(nama), produk:produk_id(nama)').eq('outlet_id', S.pengguna.outlet_id).gt('qty', 0).order('id'); return st.header.gudang_id ? q.eq('gudang_id', st.header.gudang_id) : q; });
    const ada = new Set(st.items.map(r => r.batch_id));
    const baris = data.filter(b => !ada.has(b.id)).sort((a, b) => a.produk.nama.localeCompare(b.produk.nama)).map(b => ({ produk_id: b.produk_id, batch_id: b.id, qty_sistem: Number(b.qty), qty_fisik: null, _batch: [b] }));
    toast(`${baris.length} batch dimuat`); return baris;
  } }],
  total: (h, it) => { const isi = it.filter(r => r.qty_fisik !== null && r.qty_fisik !== undefined); const sel = isi.reduce((a, r) => a + (r.qty_fisik - (r.qty_sistem || 0)), 0);
    return barisTotal([['Baris dihitung', `${isi.length} dari ${it.length}`], ['Total selisih (satuan)', angka(sel), true]]); },
  ttdKiri: 'Petugas Hitung',
});

const ALASAN = [['Koreksi', 'Koreksi'], ['Stok awal', 'Stok awal'], ['Rusak', 'Rusak'], ['Hilang', 'Hilang'], ['Kedaluwarsa', 'Kedaluwarsa'], ['Pemakaian sendiri', 'Pemakaian sendiri'], ['Lainnya', 'Lainnya']];
rutekanDokumen({
  jenis: 'penyesuaian', rute: 'persediaan/penyesuaian', judul: 'Penyesuaian Stok', satuan: 'Penyesuaian Stok', remah: 'Persediaan / Penyesuaian Stok', stok: true,
  tabel: 'penyesuaian_stok', tabelItem: 'penyesuaian_item', fk: 'penyesuaian_id', kunci: 'persediaan.penyesuaian',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, gudang:gudang_id(nama)', daftarKolom: [kolomGudang, { label: 'Catatan', nilai: r => esc(r.catatan || '') }],
  header: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, gudangOutlet('Gudang (untuk batch baru)'), { f: 'catatan', label: 'Catatan', tipe: 'area' }],
  filterBatch: filterGudang,
  item: [
    { f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'arah', label: 'Jenis', tipe: 'pilih', opsi: [['kurang', 'Kurangi'], ['tambah', 'Tambah']] },
    { f: 'batch', label: 'Batch', tipe: 'batch', kosong: '— batch baru (tambah) —' },
    { f: 'no_batch', label: 'No. Batch Baru', tipe: 'teks', lebar: 90 }, { f: 'ed', label: 'ED Baru', tipe: 'tanggal' },
    { f: 'qty', label: 'Jumlah (satuan dasar)', tipe: 'angka' }, { f: 'hpp', label: 'HPP/satuan (batch baru)', tipe: 'uang', lebar: 100, bolehKosong: true },
    { f: 'alasan', label: 'Alasan', tipe: 'pilih', opsi: ALASAN },
  ],
  itemBaru: p => ({ arah: 'kurang', qty: 1, hpp: Math.round(p.harga_beli || 0), alasan: 'Koreksi' }), gabung: false,
  validasi: (h, it) => it.some(r => r.arah === 'kurang' && !r.batch_id) ? 'Pengurangan stok wajib memilih batch.' : it.some(r => !(r.qty > 0)) ? 'Jumlah harus lebih dari 0.' : null,
  total: (h, it) => barisTotal([['Ditambah', angka(it.filter(r => r.arah === 'tambah').reduce((a, r) => a + (r.qty || 0), 0))], ['Dikurangi', angka(it.filter(r => r.arah === 'kurang').reduce((a, r) => a + (r.qty || 0), 0))]]),
});

rutekanDokumen({
  jenis: 'perpindahan', rute: 'persediaan/perpindahan', judul: 'Perpindahan Stok', satuan: 'Perpindahan Stok', remah: 'Persediaan / Perpindahan Stok', stok: true,
  tabel: 'perpindahan_stok', tabelItem: 'perpindahan_item', fk: 'perpindahan_id', kunci: 'persediaan.perpindahan', labelPosting: 'Simpan & Pindahkan',
  statusOpsi: ['draft', 'posting', 'batal'], selectDaftar: '*, gudang:gudang_id(nama), tujuan:outlet_tujuan_id(nama), gtujuan:gudang_tujuan_id(nama)',
  daftarKolom: [{ label: 'Dari', nilai: r => esc(r.gudang?.nama || 'Semua gudang') }, { label: 'Ke', nilai: r => esc(`${r.tujuan?.nama || ''} · ${r.gtujuan?.nama || 'gudang utama'}`) }],
  header: [
    { f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, gudangOutlet('Dari Gudang'),
    { f: 'outlet_tujuan_id', label: 'Ke Outlet', tipe: 'ref', ref: 'outlet', wajib: true },
    { f: 'gudang_tujuan_id', label: 'Ke Gudang', tipe: 'ref', ref: 'gudang', refKolom: 'id,nama,outlet_id', saring: (o, h) => o.outlet_id === h.outlet_tujuan_id, bantu: 'Kosongkan untuk gudang utama outlet tujuan.' },
    { f: 'catatan', label: 'Catatan', tipe: 'area' },
  ],
  bawaan: () => ({ outlet_tujuan_id: S.pengguna.outlet_id }), filterBatch: filterGudang,
  item: [{ f: 'produk', label: 'Produk', tipe: 'produk' }, { f: 'batch', label: 'Batch', tipe: 'batch' }, { f: 'qty', label: 'Jumlah (satuan dasar)', tipe: 'angka' }],
  itemBaru: () => ({ qty: 1 }), gabung: false,
  validasi: (h, it) => it.some(r => !r.batch_id) ? 'Pilih batch setiap barang.' : it.some(r => !(r.qty > 0)) ? 'Jumlah harus lebih dari 0.' : null,
  ttdKiri: 'Pengirim', ttdKanan: 'Penerima',
});
