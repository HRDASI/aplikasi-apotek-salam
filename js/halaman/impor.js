// Impor data dari Excel/CSV: pilih berkas → cocokkan kolom → pratinjau → simpan (bisa dibatalkan).
import { rute, sb, S, hapusCache } from '../inti.js?v=1.16.0';
import { ikon } from '../menu.js?v=1.16.0';
import { esc, angka, waktu, toast, konfirmasi, pesanGalat, judulHalaman, unduhCSV } from '../ui.js?v=1.16.0';
import { GOLONGAN } from './master.js?v=1.16.0';

let janji;
const muatXlsx = () => janji ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { janji = null; rej(new Error('Gagal memuat pembaca Excel. Cek internet.')); }; document.head.append(s); });

// kolom: [kunci, label, tipe, wajib, kata kunci judul]
const K = {
  produk: [['kode', 'Kode/SKU', 't', 0, 'kode sku kodeproduk kodeobat kodebarang'], ['barcode', 'Barcode', 't', 0, 'barcode'], ['nama', 'Nama produk', 't', 1, 'nama namaproduk namaobat namabarang produk'], ['nama_generik', 'Zat aktif', 't', 0, 'generik zataktif namagenerik komposisi kandungan'], ['pabrik', 'Pabrik', 't', 0, 'pabrik produsen manufaktur principal'],
    ['kategori', 'Kategori', 't', 0, 'kategori kategoriproduk kategori1'], ['golongan', 'Golongan', 'g', 0, 'golongan golonganobat jenisobat'], ['satuan', 'Satuan dasar (terkecil)', 't', 1, 'satuan satuandasar satuanterkecil satuanutama unit'], ['rak', 'Rak', 't', 0, 'rak lokasi namarak'], ['harga_beli', 'Harga beli per satuan dasar', 'n', 0, 'hargabeli hpp hargapokokmax hargapokok'], ['harga_jual', 'Harga jual per satuan dasar', 'n', 0, 'hargajualutama hargajual harga hargaumum'],
    ['stok_min', 'Stok minimum', 'n', 0, 'stokminimum stokmin minimumstok stokminimal'], ['stok_maks', 'Stok maksimum', 'n', 0, 'stokmaksimum stokmaksimal stokmaks stokmax'], ['wajib_resep', 'Wajib resep', 'b', 0, 'wajibresep'], ['aktif', 'Status dijual', 'b', 0, 'status'], ['satuan2', 'Satuan ke-2', 't', 0, 'satuan2 satuankedua'], ['isi2', 'Isi satuan ke-2', 'n', 0, 'isi2 konversi2'], ['harga2', 'Harga jual satuan ke-2', 'n', 0, 'harga2 hargajual2'], ['satuan3', 'Satuan ke-3', 't', 0, 'satuan3'], ['isi3', 'Isi satuan ke-3', 'n', 0, 'isi3 konversi3'], ['harga3', 'Harga jual satuan ke-3', 'n', 0, 'harga3 hargajual3']],
  supplier: [['kode', 'Kode', 't', 0, 'kode kodesupplier'], ['nama', 'Nama', 't', 1, 'nama namasupplier supplier pbf'], ['alamat', 'Alamat', 't', 0, 'alamat'], ['telp', 'Telepon', 't', 0, 'telp telepon nohp hp notelp notelepon noteleponhp'], ['email', 'Email', 't', 0, 'email'], ['kontak_person', 'Kontak person', 't', 0, 'kontakperson pic kontak'], ['npwp', 'NPWP', 't', 0, 'npwp'], ['tempo_hari', 'Tempo (hari)', 'n', 0, 'tempo tempohari jatuhtempo']],
  pelanggan: [['kode', 'Kode', 't', 0, 'kode kodepelanggan'], ['nama', 'Nama', 't', 1, 'nama namapelanggan pelanggan'], ['telp', 'No. HP', 't', 0, 'telp telepon nohp hp notelp whatsapp noteleponhp'], ['alamat', 'Alamat', 't', 0, 'alamat'], ['tgl_lahir', 'Tanggal lahir', 'd', 0, 'tanggallahir tgllahir'], ['jenis_kelamin', 'Jenis kelamin', 'k', 0, 'jeniskelamin gender kelamin jk'], ['alergi', 'Alergi', 't', 0, 'alergi'], ['catatan', 'Catatan', 't', 0, 'catatan keterangan']],
  stok: [['kode', 'Kode/SKU', 't', 0, 'kode sku kodeproduk kodeobat kodebarang'], ['barcode', 'Barcode', 't', 0, 'barcode'], ['nama', 'Nama produk', 't', 0, 'nama namaproduk namaobat namabarang produk'], ['qty', 'Jumlah stok', 'n', 1, 'stok qty jumlah jumlahstok stokakhir sisastok kuantitas'], ['satuan', 'Satuan (kosong = dasar)', 't', 0, 'satuan unit'], ['batch', 'No. batch', 't', 0, 'batch nobatch nomorbatch kodebatch'], ['ed', 'Kedaluwarsa', 'e', 0, 'ed exp expired kedaluwarsa kadaluarsa tglkadaluarsa tanggalkedaluwarsa expireddate expdate tanggalexpired'], ['hpp', 'HPP per satuan', 'n', 0, 'hpp hargabeli hargapokok'], ['pemilik', 'Pemilik (titipan)', 't', 0, 'pemilik penitip']],
  utang: [['kode', 'Kode supplier', 't', 0, 'kodesupplier kode'], ['nama', 'Nama supplier', 't', 1, 'supplier namasupplier kreditur nama pbf'], ['no_faktur', 'No. faktur', 't', 0, 'nofaktur faktur nomorfaktur'], ['tanggal', 'Tanggal', 'd', 0, 'tanggalfaktur tglfaktur tanggal'], ['jatuh_tempo', 'Jatuh tempo', 'd', 0, 'jatuhtempo tgljatuhtempo tanggaljatuhtempo'], ['jumlah', 'Sisa utang', 'n', 1, 'nominalsisa sisa sisautang sisahutang jumlah utang hutang total']],
  piutang: [['kode', 'Kode pelanggan', 't', 0, 'kodepelanggan kode'], ['nama', 'Nama pelanggan', 't', 1, 'pelanggan namapelanggan debitur nama'], ['no_faktur', 'No. nota', 't', 0, 'nonota nota nofaktur'], ['tanggal', 'Tanggal', 'd', 0, 'tanggalfaktur tanggal tglnota'], ['jatuh_tempo', 'Jatuh tempo', 'd', 0, 'jatuhtempo tgljatuhtempo'], ['jumlah', 'Sisa piutang', 'n', 1, 'nominalsisa sisa sisapiutang jumlah piutang total']],
};
const JUDUL = { produk: 'Produk', supplier: 'Supplier', pelanggan: 'Pelanggan', stok: 'Stok awal', utang: 'Utang (saldo awal)', piutang: 'Piutang (saldo awal)' };
const bersih = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function bacaAngka(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, ''); if (s === '' || s === '-') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');       // 1.500.000,50
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');                      // 1,500,000.50
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
const BLN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
export function bacaTanggal(v, akhirBulan) {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  let y, m, d;
  if (typeof v === 'number') { if (v < 20000 || v > 90000) return NaN; const t = new Date(Math.round((v - 25569) * 864e5)); return t.toISOString().slice(0, 10); }
  const s = String(v).trim(); let x;
  if ((x = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) [, y, m, d] = x.map(Number);
  else if ((x = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/))) [, d, m, y] = x.map(Number);
  else if ((x = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{2,4})/))) { d = +x[1]; m = BLN[x[2].slice(0, 3).toLowerCase()]; y = +x[3]; }
  else if (akhirBulan && (x = s.match(/^(\d{1,2})[-/](\d{4}|\d{2})$/))) { m = +x[1]; y = +x[2]; }
  else if (akhirBulan && (x = s.match(/^([A-Za-z]{3,})[-/ ](\d{4}|\d{2})$/))) { m = BLN[x[1].slice(0, 3).toLowerCase()]; y = +x[2]; }
  else return NaN;
  if (y < 100) y += 2000;
  if (!d) d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1, d));
  return m && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : NaN;
}
function bacaGolongan(v) {
  const s = bersih(v); if (!s) return null;
  const tepat = GOLONGAN.find(([k, l]) => bersih(k) === s || bersih(l) === s); if (tepat) return tepat[0];
  return /terbatas|^bt$/.test(s) ? 'bebas_terbatas' : /bebas|^b$/.test(s) ? 'bebas' : /narkot/.test(s) ? 'narkotika' : /psiko/.test(s) ? 'psikotropika' : /^okt|obatobattertentu|oot/.test(s) ? 'okt' : /keras|^k$|^g$/.test(s) ? 'keras' : /jamu|herbal|fitofarmaka|oht/.test(s) ? 'jamu' : /alkes|alatkesehatan/.test(s) ? 'alkes' : /kosmetik/.test(s) ? 'kosmetik' : /suplemen|vitamin/.test(s) ? 'suplemen' : 'lainnya';
}
const bacaJk = v => { const s = bersih(v); return !s ? null : /^(l|lk|laki|pria|male|m)/.test(s) ? 'L' : /^(p|pr|perempuan|wanita|female|f)/.test(s) ? 'P' : NaN; };
function ubahBaris(jenis, peta, data, awal) {
  const hasil = []; const kode = new Map();
  data.forEach((r, i) => {
    const o = { _no: awal + i }, salah = [], ingat = [];
    if (r.every(c => String(c ?? '').trim() === '')) return;
    for (const [k, l, t, wajib] of K[jenis]) {
      const c = peta[k]; if (c === '' || c === undefined) { continue; }
      const v = r[c]; let n;
      if (t === 't') { n = v === null || v === undefined ? '' : String(v).trim(); if (n === '-') n = ''; if ((k === 'barcode' || k === 'kode') && /e\+\d+$/i.test(n)) { salah.push(`${l} rusak (${n})`); n = ''; } }
      else if (t === 'n') { n = bacaAngka(v); if (Number.isNaN(n)) salah.push(`${l} bukan angka: ${v}`); else if (n < 0 && k !== 'qty') salah.push(`${l} minus`); }
      else if (t === 'd' || t === 'e') { n = bacaTanggal(v, t === 'e'); if (Number.isNaN(n)) (k === 'jatuh_tempo' || k === 'tgl_lahir' ? ingat : salah).push(`${l} tidak terbaca: ${v}`); }
      else if (t === 'b') { const s = bersih(v); n = s === '' ? null : /^(ya|dijual|aktif|true|1)$/.test(s) ? true : /^(tidak|tidakdijual|nonaktif|false|0)$/.test(s) ? false : NaN; if (Number.isNaN(n)) salah.push(`${l} tidak dikenal: ${v}`); }
      else if (t === 'g') { n = bacaGolongan(v); if (n === 'lainnya' && peta.golongan !== peta.kategori && String(v ?? '').trim()) ingat.push(`Golongan "${v}" → Lainnya`); }
      else { n = bacaJk(v); if (Number.isNaN(n)) salah.push(`${l} tidak dikenal: ${v}`); }
      if (wajib && (n === '' || n === null || n === undefined)) salah.push(`${l} kosong`);
      if (n !== '' && n !== null && n !== undefined && !Number.isNaN(n)) o[k] = n;
    }
    if (jenis === 'stok' && !o.kode && !o.barcode && !o.nama) salah.push('Kode/barcode/nama kosong');
    if (jenis === 'stok' && o.pemilik) salah.push(`Barang titipan (${o.pemilik}): catat lewat Konsinyasi Masuk`);
    if (o.jumlah !== undefined) o.jumlah = Math.round(o.jumlah * 100) / 100;
    if (jenis === 'stok' && o.ed && o.ed < new Date().toISOString().slice(0, 10)) ingat.push('Sudah kedaluwarsa');
    if (jenis === 'stok' && o.qty > 0 && !o.ed) ingat.push('Tanpa ED');
    if (jenis === 'produk' && !(o.harga_jual > 0)) ingat.push('Harga jual kosong');
    if (jenis === 'produk' && o.harga_jual > 0 && o.harga_beli > o.harga_jual) ingat.push('Harga beli di atas harga jual (cek satuannya)');
    if (['produk', 'supplier', 'pelanggan'].includes(jenis) && o.kode) { const x = o.kode.toLowerCase(); if (kode.has(x)) salah.push(`Kode sama dengan baris ${kode.get(x)}`); else kode.set(x, o._no); }
    hasil.push({ o, salah, ingat });
  });
  return hasil;
}

rute('pengaturan/impor', async el => {
  const st = { jenis: 'produk', file: null, sheets: {}, sheet: '', awal: 0, peta: {}, hasil: null, sibuk: false };
  el.innerHTML = judulHalaman('Impor Data', 'Pengaturan / Impor Data') + `<div class="kartu"><p class="pesan info" style="margin-top:0">Urutan yang benar: <b>Supplier → Pelanggan → Produk → Stok awal → Utang → Piutang</b>. Stok awal diambil dari Apotek Digital setelah apotek tutup.</p>
    <div class="form-grid"><label class="isian"><span>Data yang diimpor</span><select data-jenis>${Object.entries(JUDUL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="isian"><span>Berkas Excel / CSV</span><input type="file" accept=".xlsx,.xls,.csv" data-file></label></div><button class="tombol kedua kecil" data-contoh>${ikon('unduh')} Contoh format</button></div><div data-langkah></div><div data-riwayat></div>`;
  const w = el.querySelector('[data-langkah]');
  const tebak = judul => { const p = {}, pakai = new Set(); for (const [k, , , , kata] of K[st.jenis]) { const d = kata.split(' '); let c = -1; for (const x of d) { c = judul.findIndex((j, i) => !pakai.has(i) && bersih(j) === x); if (c >= 0) break; } if (c >= 0) { p[k] = c; pakai.add(c); } } if (st.jenis === 'produk' && p.golongan === undefined && p.kategori !== undefined) p.golongan = p.kategori; return p; };
  // baris judul = baris dengan kecocokan kolom terbanyak di 15 baris pertama
  const cariJudul = d => { let b = 0, s = -1; d.slice(0, 15).forEach((r, i) => { const n = Object.keys(tebak(r)).length; if (n > s) { s = n; b = i; } }); return b; };
  function pilihSheet(n) { st.sheet = n; st.awal = cariJudul(st.sheets[n]); st.peta = tebak(st.sheets[n][st.awal] || []); st.hasil = null; gambar(); }
  function gambar() {
    const d = st.sheets[st.sheet] || [], judul = d[st.awal] || [];
    w.innerHTML = `<div class="kartu"><h3>Cocokkan kolom</h3><div class="alat-tabel">${Object.keys(st.sheets).length > 1 ? `<select class="input" style="width:auto" data-sheet>${Object.keys(st.sheets).map(n => `<option ${n === st.sheet ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}<label>Baris judul <input type="number" class="input" style="width:80px" min="1" max="${Math.max(1, d.length)}" data-awal value="${st.awal + 1}"></label><span>${angka(Math.max(0, d.length - st.awal - 1))} baris data</span></div>
      <div class="form-grid">${K[st.jenis].map(([k, l, , wajib]) => `<label class="isian"><span>${l}${wajib ? ' <i>*</i>' : ''}</span><select data-peta="${k}"><option value="">- tidak ada -</option>${judul.map((j, i) => `<option value="${i}" ${st.peta[k] === i ? 'selected' : ''}>${esc(j || 'Kolom ' + (i + 1))}</option>`).join('')}</select></label>`).join('')}</div>
      ${st.jenis === 'produk' ? '<label class="cek"><input type="checkbox" data-perbarui> Perbarui produk yang sudah ada (tanpa centang: dilewati)</label><p class="pesan peringatan">Harga beli dan jual harus <b>per satuan dasar</b>. Bila di berkas harganya per strip/box, sesuaikan dulu.</p>' : ''}
      <button class="tombol" data-lihat>Pratinjau</button></div><div data-pratinjau></div>`;
  }
  function pratinjau() {
    const kurang = K[st.jenis].filter(([k, , , wajib]) => wajib && st.peta[k] === undefined); if (kurang.length) return toast('Cocokkan kolom: ' + kurang.map(k => k[1]).join(', '), 'galat');
    st.hasil = ubahBaris(st.jenis, st.peta, st.sheets[st.sheet].slice(st.awal + 1), st.awal + 2);
    const ok = st.hasil.filter(x => !x.salah.length), salah = st.hasil.filter(x => x.salah.length), ingat = ok.filter(x => x.ingat.length), kol = K[st.jenis].filter(([k]) => st.peta[k] !== undefined);
    const urut = [...salah, ...ingat, ...ok.filter(x => !x.ingat.length)].slice(0, 100);
    w.querySelector('[data-pratinjau]').innerHTML = `<div class="kartu"><div class="grid-4" style="margin-bottom:14px"><div class="statistik"><small>Siap diimpor</small><b>${angka(ok.length)}</b></div><div class="statistik"><small>⚠ Perlu dilihat</small><b>${angka(ingat.length)}</b></div><div class="statistik"><small>✕ Tidak diimpor</small><b style="color:${salah.length ? 'var(--merah)' : 'inherit'}">${angka(salah.length)}</b></div></div>
      <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Baris</th><th>Keterangan</th>${kol.map(k => `<th>${k[1]}</th>`).join('')}</tr></thead><tbody>${urut.map(x => `<tr><td>${x.o._no}</td><td>${x.salah.map(s => `<span class="chip merah">${esc(s)}</span>`).join(' ')}${x.ingat.map(s => `<span class="chip oranye">${esc(s)}</span>`).join(' ')}</td>${kol.map(([k, , t]) => `<td class="${t === 'n' ? 'angka' : ''}">${esc(t === 'n' && x.o[k] !== undefined ? angka(x.o[k]) : t === 'b' && x.o[k] !== undefined ? (x.o[k] ? 'Ya' : 'Tidak') : x.o[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p style="color:var(--teks-2)">Ditampilkan ${urut.length} dari ${angka(st.hasil.length)} baris; yang bermasalah lebih dulu. Cek beberapa harga dan jumlah sebelum menyimpan.</p>
      <div class="judul-halaman" style="margin:0"><button class="tombol" data-simpan ${ok.length ? '' : 'disabled'}>Impor ${angka(ok.length)} baris</button>${salah.length ? `<button class="tombol kedua" data-unduh-salah>${ikon('unduh')} Unduh baris bermasalah</button>` : ''}</div><div data-maju></div></div>`;
  }
  const unduhSalah = (nama, a) => unduhCSV(nama, [{ label: 'Baris', nilai: x => x.no }, { label: 'Nama', nilai: x => x.nama }, { label: 'Masalah', nilai: x => x.pesan }], a);
  async function simpan() {
    const ok = st.hasil.filter(x => !x.salah.length).map(x => x.o);
    if (!await konfirmasi('Impor ' + JUDUL[st.jenis], `Simpan <b>${angka(ok.length)}</b> baris ke ${esc(S.outlet?.nama || 'outlet ini')}? Bisa dibatalkan selama belum dipakai transaksi.`, 'Impor', '')) return;
    const per = 200, uuid = crypto.randomUUID(), maju = w.querySelector('[data-maju]'), tot = { baru: 0, ubah: 0, lewati: 0, galat: [] };
    st.sibuk = true; w.querySelectorAll('button,select,input').forEach(b => { b.disabled = true; });
    const jaga = e => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', jaga);
    try {
      for (let i = 0; i < ok.length; i += per) {
        const p = { uuid, jenis: st.jenis, nama_file: st.file, bagian: i / per + 1, perbarui: w.querySelector('[data-perbarui]')?.checked || false, baris: ok.slice(i, i + per) };
        let h, coba = 0;
        for (;;) { const { data, error } = await sb.rpc('impor_data', { p }); if (!error) { h = data; break; } if (++coba > 3 || !/fetch|network|timeout/i.test(error.message)) throw error; await new Promise(r => setTimeout(r, 2000 * coba)); }
        tot.baru += h.baru; tot.ubah += h.ubah; tot.lewati += h.lewati; tot.galat.push(...h.galat);
        maju.innerHTML = `<p class="pesan info" style="margin-top:12px">Menyimpan ${angka(Math.min(i + per, ok.length))} dari ${angka(ok.length)}…</p>`;
      }
      w.innerHTML = `<div class="kartu"><h3>Selesai</h3><p class="pesan ${tot.galat.length ? 'peringatan' : 'info'}">${angka(tot.baru)} baru, ${angka(tot.ubah)} diperbarui, ${angka(tot.lewati)} dilewati (sudah ada / nol), <b>${angka(tot.galat.length)} gagal</b>.</p>${tot.galat.length ? `<ul>${tot.galat.slice(0, 20).map(g => `<li>Baris ${g.no}: ${esc(g.nama || '')} — ${esc(g.pesan)}</li>`).join('')}</ul><button class="tombol kedua" data-unduh-gagal>${ikon('unduh')} Unduh daftar gagal</button>` : ''}</div>`;
      w.querySelector('[data-unduh-gagal]')?.addEventListener('click', () => unduhSalah('gagal-impor-' + st.jenis, tot.galat));
      ['satuan', 'kategori', 'rak', 'supplier', 'pelanggan'].forEach(hapusCache);
    } catch (e) { maju.innerHTML = `<p class="pesan galat" style="margin-top:12px">Berhenti: ${esc(pesanGalat(e))}. ${tot.baru + tot.ubah ? 'Sebagian sudah tersimpan; batalkan lewat Riwayat bila ingin mengulang.' : ''}</p>`; w.querySelectorAll('button,select,input').forEach(b => { b.disabled = false; }); }
    finally { st.sibuk = false; removeEventListener('beforeunload', jaga); riwayat(); }
  }
  async function riwayat() {
    const { data, error } = await sb.from('impor').select('*').order('id', { ascending: false }).limit(50);
    el.querySelector('[data-riwayat]').innerHTML = error ? `<p class="pesan galat">${esc(pesanGalat(error))}</p>` : `<div class="kartu"><h3>Riwayat impor</h3>${data.length ? `<div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Waktu</th><th>Data</th><th>Berkas</th><th>Hasil</th><th>Oleh</th><th></th></tr></thead><tbody>${data.map(r => `<tr><td data-label="Waktu">${waktu(r.dibuat)}</td><td data-label="Data"><b>${JUDUL[r.jenis]}</b></td><td data-label="Berkas">${esc(r.nama_file || '')}</td><td data-label="Hasil">${angka(r.baru)} baru, ${angka(r.ubah)} ubah, ${angka(r.gagal)} gagal</td><td data-label="Oleh">${esc(r.pengguna_nama || '')}</td><td class="aksi">${r.status === 'batal' ? '<span class="chip">Dibatalkan</span>' : `<button class="tombol kedua kecil" data-batal="${r.id}">Batalkan</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="kosong">Belum ada impor.</p>'}</div>`;
  }
  el.querySelector('[data-jenis]').onchange = e => { st.jenis = e.target.value; if (st.sheet) pilihSheet(st.sheet); };
  el.querySelector('[data-file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15e6) return toast('Berkas lebih dari 15 MB', 'galat');
    w.innerHTML = '<div class="kartu">Membaca berkas…</div>';
    try {
      const X = await muatXlsx(), csv = /\.csv$/i.test(f.name);
      let wb;
      if (csv) { const teks = new TextDecoder('utf-8').decode(await f.arrayBuffer()), bar1 = teks.split('\n').slice(0, 5).join('\n'), n = c => bar1.split(c).length; wb = X.read(teks, { type: 'string', raw: true, FS: n(';') > n(',') ? ';' : n('\t') > n(',') ? '\t' : ',' }); }
      else wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
      st.sheets = {}; for (const n of wb.SheetNames) { const d = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }); if (d.length) st.sheets[n] = d; }
      if (!Object.keys(st.sheets).length) throw new Error('Berkas kosong');
      st.file = f.name; pilihSheet(Object.keys(st.sheets).sort((a, b) => st.sheets[b].length - st.sheets[a].length)[0]);
    } catch (x) { w.innerHTML = `<p class="pesan galat">Berkas tidak bisa dibaca: ${esc(x.message)}</p>`; }
  };
  el.querySelector('[data-contoh]').onclick = () => unduhCSV('contoh-' + st.jenis, K[st.jenis].map(([k, l]) => ({ label: l, nilai: () => '' })), []);
  el.addEventListener('change', e => {
    if (st.sibuk) return;
    if (e.target.matches('[data-sheet]')) pilihSheet(e.target.value);
    if (e.target.matches('[data-awal]')) { st.awal = Math.max(0, Number(e.target.value || 1) - 1); st.peta = tebak(st.sheets[st.sheet][st.awal] || []); gambar(); }
    if (e.target.dataset.peta) { if (e.target.value === '') delete st.peta[e.target.dataset.peta]; else st.peta[e.target.dataset.peta] = Number(e.target.value); w.querySelector('[data-pratinjau]').innerHTML = ''; }
  });
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), b = q('[data-batal]'); if (st.sibuk) return;
    if (q('[data-lihat]')) pratinjau();
    if (q('[data-simpan]')) simpan();
    if (q('[data-unduh-salah]')) unduhSalah('bermasalah-' + st.jenis, st.hasil.filter(x => x.salah.length).map(x => ({ no: x.o._no, nama: x.o.nama || x.o.kode, pesan: x.salah.join('; ') })));
    if (b && await konfirmasi('Batalkan impor', 'Semua data dari impor ini dihapus/dikembalikan. Lanjutkan?', 'Batalkan impor')) { b.disabled = true; const { error } = await sb.rpc('batal_impor', { p_id: Number(b.dataset.batal) }); if (error) { b.disabled = false; return toast(pesanGalat(error), 'galat'); } toast('Impor dibatalkan', 'sukses'); riwayat(); }
  });
  riwayat();
});
