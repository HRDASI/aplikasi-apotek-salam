// Gaji Karyawan: setting, gaji pokok, tunjangan, potongan, kasbon, perhitungan, pembayaran, slip.
import { rute, S, bisa } from '../inti.js?v=1.19.0';
import { ikon } from '../menu.js?v=1.19.0';
import { esc, angka, rupiah, tanggal, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.19.0';
import { rpc, hariIni, tabelHtml, unduhTabel, cetakHtml } from '../tabel.js?v=1.19.0';
import { cetakKertasBiasa } from '../cetak.js?v=1.19.0';
import { akunKas, opsiKas } from './keuangan.js?v=1.19.0';

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const namaBulan = b => `${BLN[Number(b.slice(5)) - 1]} ${b.slice(0, 4)}`;
const CARA = { bulanan: 'Tetap per bulan', per_hadir: 'Per hari hadir', persen_pokok: 'Persen dari gaji pokok', manual: 'Diisi tiap bulan' };
const nilaiK = k => k.cara === 'persen_pokok' ? angka(k.nilai) + '%' : rupiah(k.nilai);
const STATUS = { draf: ['oranye', 'Draf'], final: ['teal', 'Final'], dibayar: ['hijau', 'Dibayar'] };
const chip = s => `<span class="chip ${STATUS[s][0]}">${STATUS[s][1]}</span>`;
const coba = async f => { try { return await f(); } catch (e) { toast(pesanGalat(e), 'galat'); return undefined; } };
const opsi = (a, v) => a.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
const jml = (a, f) => a.reduce((x, r) => x + Number(r[f] || 0), 0);
const galat = (el, e) => { el.querySelector('[data-isi]').innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; };
const kerangka = '<div class="kerangka-muat"><i></i><i></i><i></i></div>';

// ================= Setting =================
rute('gaji/setting', async el => {
  el.innerHTML = judulHalaman('Setting Gaji', 'Gaji Karyawan / Setting Gaji', '<button class="tombol" data-simpan>Simpan</button>') + `<form data-isi onsubmit="return false">${kerangka}</form>`;
  let s; try { s = (await rpc('data_gaji')).setting; } catch (e) { return galat(el, e); }
  const num = (n, l, k = '', o = '') => `<label class="isian" ${o}><span>${l}</span><input type="number" min="0" step="any" name="${n}" value="${Number(s[n])}" required>${k ? `<small>${k}</small>` : ''}</label>`;
  const sel = (n, l, a, k = '') => `<label class="isian"><span>${l}</span><select name="${n}">${opsi(a, s[n])}</select>${k ? `<small>${k}</small>` : ''}</label>`;
  const TELAT = [['tidak', 'Tidak dipotong'], ['per_kejadian', 'Nominal per kejadian'], ['per_menit', 'Nominal per menit']], ABSEN = [['tidak', 'Tidak dipotong'], ['harian', 'Dipotong gaji sehari'], ['nominal', 'Nominal per hari']];
  const f = el.querySelector('form');
  f.innerHTML = `<div class="kartu"><h3>Periode & pembayaran</h3><div class="form-grid">${num('mulai_tgl', 'Periode mulai tanggal', '1 = sebulan penuh. Misal 26 = tanggal 26 bulan lalu sampai 25 bulan ini.')}${num('tanggal_bayar', 'Tanggal gajian', 'Sebagai pengingat di halaman pembayaran.')}
      ${sel('pembulatan', 'Pembulatan gaji bersih', [[0, 'Tanpa pembulatan'], [100, 'Kelipatan Rp 100'], [500, 'Kelipatan Rp 500'], [1000, 'Kelipatan Rp 1.000']])}${sel('pembagi', 'Gaji sehari = gaji pokok dibagi', [['tetap', 'Jumlah hari tetap'], ['jadwal', 'Jumlah hari kerja di jadwal']])}<div data-tampil="pembagi:tetap">${num('pembagi_hari', 'Jumlah hari pembagi')}</div>
      <label class="cek lebar"><input type="checkbox" name="prorata" ${s.prorata ? 'checked' : ''}> Karyawan baru yang masuk di tengah periode digaji sesuai jumlah harinya (prorata)</label></div></div>
    <div class="kartu"><h3>Potongan kehadiran</h3><p style="color:var(--teks-2);margin-top:0">Data dari Presensi dan Jadwal Kerja. Cuti yang disetujui tidak pernah dipotong.</p><div class="form-grid">
      ${sel('telat_cara', 'Terlambat', TELAT)}<div data-tampil="telat_cara:per_kejadian,per_menit">${num('telat_nilai', 'Nominal (Rp)')}</div><div data-tampil="telat_cara:per_kejadian,per_menit">${num('telat_toleransi', 'Toleransi terlambat (menit)', 'Lewat toleransi, seluruh menitnya dihitung.')}</div><div data-tampil="telat_cara:per_kejadian,per_menit">${num('telat_maks', 'Potongan terlambat paling banyak (Rp)', '0 = tanpa batas')}</div></div><hr class="pisah"><div class="form-grid">
      ${sel('awal_cara', 'Pulang awal', TELAT)}<div data-tampil="awal_cara:per_kejadian,per_menit">${num('awal_nilai', 'Nominal (Rp)')}</div><div data-tampil="awal_cara:per_kejadian,per_menit">${num('awal_toleransi', 'Toleransi pulang awal (menit)')}</div></div><hr class="pisah"><div class="form-grid">
      ${sel('alpa_cara', 'Tidak masuk tanpa keterangan', ABSEN)}<div data-tampil="alpa_cara:nominal">${num('alpa_nilai', 'Nominal per hari (Rp)')}</div>${sel('izin_cara', 'Izin', ABSEN)}<div data-tampil="izin_cara:nominal">${num('izin_nilai', 'Nominal per hari (Rp)')}</div>${sel('sakit_cara', 'Sakit', ABSEN)}<div data-tampil="sakit_cara:nominal">${num('sakit_nilai', 'Nominal per hari (Rp)')}</div>${num('tanpa_pulang_nilai', 'Tidak absen pulang (Rp per kejadian)', '0 = tidak dipotong')}</div></div>
    <div class="kartu"><h3>Lembur</h3><div class="form-grid">${sel('lembur_cara', 'Cara hitung', [['tidak', 'Tidak ada lembur'], ['nominal', 'Nominal per jam'], ['upah173', 'Gaji pokok ÷ 173 × pengali']], 'Jam lembur diisi saat perhitungan; aplikasi menampilkan jam lebih dari presensi sebagai acuan.')}<div data-tampil="lembur_cara:nominal">${num('lembur_nilai', 'Nominal per jam (Rp)')}</div><div data-tampil="lembur_cara:upah173">${num('lembur_pengali', 'Pengali')}</div></div></div>
    <p class="pesan info">Perubahan berlaku saat gaji dihitung atau dihitung ulang. Gaji yang sudah final atau dibayar tidak berubah.</p>`;
  const segar = () => f.querySelectorAll('[data-tampil]').forEach(d => { const [n, v] = d.dataset.tampil.split(':'); d.classList.toggle('sembunyi', !v.split(',').includes(f.elements[n].value)); });
  f.addEventListener('change', segar); segar();
  const boleh = bisa('gaji.setting'); if (!boleh) { el.querySelector('[data-simpan]').remove(); f.querySelectorAll('input,select').forEach(i => { i.disabled = true; }); return; }
  el.querySelector('[data-simpan]').onclick = async e => {
    if (!f.reportValidity()) return; const p = {};
    for (const i of f.elements) if (i.name) p[i.name] = i.type === 'checkbox' ? i.checked : i.type === 'number' || i.name === 'pembulatan' ? Number(i.value) : i.value;
    e.target.disabled = true; await coba(async () => { await rpc('simpan_setting_gaji', { p }); toast('Setting gaji disimpan', 'sukses'); }); e.target.disabled = false;
  };
});

// ================= Gaji pokok =================
rute('gaji/pokok', async el => {
  el.innerHTML = judulHalaman('Daftar Gaji Pokok', 'Gaji Karyawan / Daftar Gaji Pokok') + `<div class="kartu"><p class="pesan info" style="margin-top:0">Daftar diambil dari <a href="#/pengguna/karyawan">Data Karyawan</a>. Perubahan gaji dicatat per tanggal berlaku, jadi riwayatnya tidak hilang.</p><div data-isi>${kerangka}</div></div>`;
  let d;
  const kini = k => k.riwayat?.find(r => r.berlaku <= hariIni());
  const muat = async () => { try {
    d = await rpc('data_gaji');
    el.querySelector('[data-isi]').innerHTML = tabelHtml([{ l: 'Karyawan', n: k => k.nama, h: k => `<span><b>${esc(k.nama)}</b><br><small>${esc(k.jabatan || '')}</small></span>` }, { l: 'Cara', n: k => kini(k)?.cara === 'harian' ? 'Harian' : kini(k) ? 'Bulanan' : '' }, { l: 'Gaji pokok', n: k => kini(k)?.nilai, t: 'uang', h: k => kini(k) ? rupiah(kini(k).nilai) : '<span class="chip merah">belum diisi</span>' }, { l: 'Berlaku sejak', n: k => kini(k)?.berlaku, t: 'tgl' },
      { l: 'Tunjangan & potongan', n: () => '', h: k => { const n = d.komponen.filter(c => c.aktif && pakai(k, c)).length; return `${n} komponen`; } }, { l: '', n: () => '', h: k => `<button class="tombol kedua kecil" data-atur="${k.id}">Atur</button>` }], d.karyawan, { kosong: 'Belum ada karyawan. Isi dulu di Data Karyawan.' });
  } catch (e) { galat(el, e); } };
  const pakai = (k, c) => { const x = k.komponen.find(y => y.id === c.id); return x ? x.pakai : c.semua; };
  el.addEventListener('click', e => { const b = e.target.closest('[data-atur]'); if (b) atur(d.karyawan.find(k => k.id === Number(b.dataset.atur))); });
  function atur(k) {
    const g = kini(k);
    modal({ judul: 'Gaji ' + k.nama, ukuran: 'besar', isi: `<form onsubmit="return false"><div class="form-grid"><label class="isian"><span>Cara</span><select name="cara">${opsi([['bulanan', 'Bulanan'], ['harian', 'Harian (× hari hadir)']], g?.cara || 'bulanan')}</select></label>
      <label class="isian"><span>Nilai (Rp)</span><input type="number" min="0" step="any" name="nilai" value="${g ? Number(g.nilai) : ''}" autocomplete="off"></label><label class="isian"><span>Berlaku sejak</span><input type="date" name="berlaku" value="${g ? g.berlaku : hariIni().slice(0, 8) + '01'}"></label><label class="isian"><span>Catatan</span><input name="catatan" value="${esc(g?.catatan || '')}" maxlength="100"></label></div>
      <p style="color:var(--teks-2);margin-top:0">Untuk kenaikan gaji, isi nilai baru dengan tanggal berlaku yang baru.</p>
      ${d.komponen.filter(c => c.aktif).length ? `<h4 style="margin:6px 0">Tunjangan & potongan</h4>${d.komponen.filter(c => c.aktif).map(c => { const x = k.komponen.find(y => y.id === c.id); return `<div class="brs-ajuan"><label class="cek nm" style="margin:0"><input type="checkbox" data-k="${c.id}" ${pakai(k, c) ? 'checked' : ''}> <span>${esc(c.nama)} <span class="chip ${c.jenis === 'potongan' ? 'merah' : 'hijau'}">${c.jenis}</span><br><small>${CARA[c.cara]} · umum ${nilaiK(c)}</small></span></label><input class="input" style="width:150px" type="number" min="0" step="any" data-n="${c.id}" value="${x?.nilai ?? ''}" placeholder="nilai umum" aria-label="Nilai khusus ${esc(c.nama)}"></div>`; }).join('')}` : ''}
      ${k.riwayat.length ? `<h4 style="margin:14px 0 6px">Riwayat</h4>${k.riwayat.map(r => `<div class="baris-total"><span>${tanggal(r.berlaku)} · ${r.cara}${r.catatan ? ' · ' + esc(r.catatan) : ''}${r.oleh ? ` · <small>${esc(r.oleh)}</small>` : ''}</span><span>${rupiah(r.nilai)} <button type="button" class="ikon-aksi hapus" data-hapus="${r.id}" aria-label="Hapus">${ikon('hapus')}</button></span></div>`).join('')}` : ''}</form>`,
    saatBuka: (m, tutup) => m.addEventListener('click', async e => { const h = e.target.closest('[data-hapus]'); if (h && await konfirmasi('Hapus riwayat', 'Hapus gaji pokok ini dari riwayat?', 'Hapus')) await coba(async () => { await rpc('simpan_gaji_karyawan', { p: { karyawan_id: k.id, hapus_pokok: Number(h.dataset.hapus) } }); tutup(); muat(); }); }),
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
      const f = m.querySelector('form'), p = { karyawan_id: k.id };
      if (f.nilai.value !== '') { if (!f.berlaku.value) { toast('Isi tanggal berlaku', 'galat'); return false; } const b = { berlaku: f.berlaku.value, cara: f.cara.value, nilai: Number(f.nilai.value), catatan: f.catatan.value }; if (!g || b.berlaku !== g.berlaku || b.cara !== g.cara || b.nilai !== Number(g.nilai) || b.catatan !== (g.catatan || '')) p.pokok = b; }
      p.komponen = [...m.querySelectorAll('[data-k]')].map(c => ({ id: Number(c.dataset.k), pakai: c.checked, nilai: m.querySelector(`[data-n="${c.dataset.k}"]`).value || null }));
      await rpc('simpan_gaji_karyawan', { p }); toast('Disimpan', 'sukses'); muat();
    } }] });
  }
  await muat();
});

// ================= Tunjangan & potongan =================
for (const [jenis, judul] of [['tunjangan', 'Daftar Tunjangan'], ['potongan', 'Daftar Potongan Gaji']]) rute('gaji/' + jenis, async el => {
  const boleh = bisa('gaji.' + jenis); let d = [];
  el.innerHTML = judulHalaman(judul, 'Gaji Karyawan / ' + judul, boleh ? `<button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>` : '') + `<div class="kartu">${jenis === 'potongan' ? '<p class="pesan info" style="margin-top:0">Potongan terlambat, tidak masuk, dan kasbon dihitung otomatis (Setting Gaji & Kasbon). Di sini untuk potongan lain, misal BPJS, PPh 21, atau arisan. PPh 21 dan BPJS diisi manual.</p>' : ''}<div data-isi>${kerangka}</div></div>`;
  const muat = async () => { try { d = (await rpc('data_gaji')).komponen.filter(c => c.jenis === jenis);
    el.querySelector('[data-isi]').innerHTML = tabelHtml([{ l: 'Nama', n: c => c.nama, h: c => `<span><b>${esc(c.nama)}</b>${c.aktif ? '' : ' <span class="chip">nonaktif</span>'}${c.titipan ? '<br><small>dititipkan (utang ke BPJS/pajak)</small>' : ''}</span>` }, { l: 'Cara', n: c => CARA[c.cara] }, { l: 'Nilai umum', n: c => c.nilai, t: 'uang', h: nilaiK }, { l: 'Berlaku untuk', n: c => c.semua ? 'Semua karyawan' : `${c.orang} karyawan` }, { l: '', n: () => '', h: c => boleh ? `<button class="ikon-aksi" data-ubah="${c.id}" aria-label="Ubah">${ikon('ubah')}</button>` : '' }], d, { kosong: 'Belum ada.' });
  } catch (e) { galat(el, e); } };
  const form = c => modal({ judul: (c ? 'Ubah ' : 'Tambah ') + jenis, isi: `<form onsubmit="return false"><label class="isian"><span>Nama <i>*</i></span><input name="nama" required maxlength="60" value="${esc(c?.nama || '')}" placeholder="${jenis === 'tunjangan' ? 'mis. Uang makan, Transport, THR' : 'mis. BPJS Kesehatan'}"></label>
    <div class="form-grid"><label class="isian"><span>Cara hitung</span><select name="cara">${opsi(Object.entries(CARA), c?.cara || 'bulanan')}</select></label><label class="isian"><span data-lb>Nilai umum</span><input type="number" min="0" step="any" name="nilai" required value="${c ? Number(c.nilai) : 0}"></label></div>
    <label class="cek"><input type="checkbox" name="semua" ${c?.semua ? 'checked' : ''}> Berlaku untuk semua karyawan (bisa dikecualikan per orang)</label>${jenis === 'potongan' ? `<label class="cek"><input type="checkbox" name="titipan" ${c?.titipan ? 'checked' : ''}> Uangnya dititipkan untuk disetor (BPJS/PPh), dicatat sebagai utang di akun 2202</label>` : ''}${c ? `<label class="cek"><input type="checkbox" name="aktif" ${c.aktif ? 'checked' : ''}> Aktif</label>` : ''}</form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_komponen_gaji', { p: { id: c?.id || null, jenis, nama: f.nama.value, cara: f.cara.value, nilai: Number(f.nilai.value), semua: f.semua.checked, titipan: f.titipan?.checked || false, aktif: c ? f.aktif.checked : true, urutan: c?.urutan || 0 } }); toast('Disimpan', 'sukses'); muat(); } }] });
  el.addEventListener('click', e => { if (e.target.closest('[data-tambah]')) form(); const b = e.target.closest('[data-ubah]'); if (b) form(d.find(c => c.id === Number(b.dataset.ubah))); });
  await muat();
});

// ================= Kasbon =================
rute('gaji/kasbon', async el => {
  const boleh = bisa('gaji.kasbon'); let d = [];
  el.innerHTML = judulHalaman('Kasbon Karyawan', 'Gaji Karyawan / Kasbon', boleh ? `<button class="tombol" data-tambah>${ikon('tambah')} Kasbon Baru</button>` : '') + `<div class="kartu"><div data-isi>${kerangka}</div></div>`;
  const muat = async () => { try { d = await rpc('daftar_kasbon');
    el.querySelector('[data-isi]').innerHTML = tabelHtml([{ l: 'No', n: r => r.no, h: r => `<span><b>${esc(r.no)}</b>${r.status === 'batal' ? ' <span class="chip merah">batal</span>' : ''}</span>` }, { l: 'Tanggal', n: r => r.tanggal, t: 'tgl' }, { l: 'Karyawan', n: r => r.nama }, { l: 'Keterangan', n: r => r.keterangan || '' }, { l: 'Jumlah', n: r => r.jumlah, t: 'uang' }, { l: 'Potong per gaji', n: r => r.cicilan, t: 'uang' }, { l: 'Sisa', n: r => r.sisa, t: 'uang', h: r => Number(r.sisa) > 0 ? `<b>${rupiah(r.sisa)}</b>` : r.status === 'batal' ? '-' : '<span class="chip hijau">lunas</span>' },
      { l: '', n: () => '', h: r => `<button class="tombol kedua kecil" data-lihat="${r.id}">Rincian</button>` }], d, { kosong: 'Belum ada kasbon.' }); } catch (e) { galat(el, e); } };
  el.addEventListener('click', async e => {
    const l = e.target.closest('[data-lihat]');
    if (e.target.closest('[data-tambah]')) await coba(async () => {
      const [g, ks] = await Promise.all([rpc('data_gaji'), akunKas()]), kas = ks.filter(k => k.jenis !== 'kasir');
      modal({ judul: 'Kasbon Baru', isi: `<form class="form-grid" onsubmit="return false"><label class="isian lebar"><span>Karyawan <i>*</i></span><select name="k" required><option value="">- pilih -</option>${g.karyawan.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select></label><label class="isian"><span>Jumlah (Rp) <i>*</i></span><input type="number" min="1" name="jumlah" required></label><label class="isian"><span>Potong per gaji (Rp) <i>*</i></span><input type="number" min="1" name="cicilan" required></label>
        <label class="isian"><span>Tanggal</span><input type="date" name="tanggal" value="${hariIni()}" max="${hariIni()}" required></label><label class="isian"><span>Uang diambil dari</span><select name="kas" required>${opsiKas(kas)}</select></label><label class="isian lebar"><span>Keterangan</span><input name="ket" maxlength="120"></label></form>`,
        tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_kasbon', { p: { karyawan_id: Number(f.k.value), jumlah: Number(f.jumlah.value), cicilan: Number(f.cicilan.value), tanggal: f.tanggal.value, akun_kas_id: Number(f.kas.value), keterangan: f.ket.value } }); toast('Kasbon dicatat, kas berkurang', 'sukses'); muat(); } }] });
    });
    if (l) await coba(async () => {
      const r = d.find(x => x.id === Number(l.dataset.lihat)), kas = boleh && Number(r.sisa) > 0 ? (await akunKas()).filter(k => k.jenis !== 'kasir') : [];
      modal({ judul: 'Kasbon ' + r.no, isi: `<div class="baris-total"><span>${esc(r.nama)}</span><span>${rupiah(r.jumlah)}</span></div>${r.bayar.map(b => `<div class="baris-total"><span>${tanggal(b.tanggal)} · ${esc(b.cara)}</span><span>- ${rupiah(b.jumlah)}</span></div>`).join('')}<div class="baris-total besar"><span>Sisa</span><span>${rupiah(r.sisa)}</span></div>
        ${kas.length ? `<form class="form-grid" onsubmit="return false" style="margin-top:14px"><label class="isian"><span>Bayar langsung (Rp)</span><input type="number" min="1" max="${Number(r.sisa)}" name="j" required></label><label class="isian"><span>Masuk ke</span><select name="kas">${opsiKas(kas)}</select></label></form>` : ''}`,
      tombol: [...(boleh && r.status === 'aktif' && !r.bayar.length ? [{ teks: 'Batalkan Kasbon', kelas: 'bahaya', aksi: async () => { if (!await konfirmasi('Batalkan kasbon', 'Kas dikembalikan seperti semula. Lanjutkan?', 'Batalkan')) return false; await rpc('batal_kasbon', { p_id: r.id }); toast('Kasbon dibatalkan'); muat(); } }] : []), ...(kas.length ? [{ teks: 'Terima Pembayaran', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('bayar_kasbon', { p_id: r.id, p_jumlah: Number(f.j.value), p_kas: Number(f.kas.value), p_tanggal: hariIni() }); toast('Pembayaran dicatat', 'sukses'); muat(); } }] : []), { teks: 'Tutup', kelas: 'kedua' }] });
    });
  });
  await muat();
});

// ================= Perhitungan & pembayaran =================
async function daftar(el, judul, remah, atas, klik) {
  el.innerHTML = judulHalaman(judul, remah) + `${atas}<div class="kartu"><h3 style="margin-top:0">Periode gaji</h3><div data-isi>${kerangka}</div></div>`;
  try { const d = await rpc('daftar_gaji');
    el.querySelector('[data-isi]').innerHTML = tabelHtml([{ l: 'Bulan', n: g => g.bulan, h: g => `<b>${namaBulan(g.bulan)}</b>` }, { l: 'Periode', n: g => `${tanggal(g.dari)} s.d. ${tanggal(g.sampai)}` }, { l: 'Karyawan', n: g => g.orang, t: 'angka' }, { l: 'Total bersih', n: g => g.total, t: 'uang' }, { l: 'Status', n: g => g.status, h: g => chip(g.status) }, { l: 'Dibayar', n: g => g.dibayar, t: 'tgl' }, { l: '', n: () => '', h: g => klik(g) }], d, { kosong: 'Belum ada perhitungan gaji.' });
    return d; } catch (e) { galat(el, e); return []; }
}
rute('gaji/hitung', async (el, [id]) => {
  if (id) return lihat(el, Number(id), 'hitung');
  const n = new Date(), kini = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  await daftar(el, 'Perhitungan Gaji', 'Gaji Karyawan / Perhitungan Gaji', bisa('gaji.hitung') ? `<div class="kartu"><form data-hitung onsubmit="return false" class="alat-tabel" style="margin:0"><label>Gaji bulan <input type="month" class="input" style="width:auto" name="b" value="${kini}" max="${kini}" required></label><button class="tombol">Hitung</button></form><p style="color:var(--teks-2);margin:8px 0 0">Kehadiran, jadwal, izin, tunjangan, potongan, dan kasbon digabung otomatis. Draf bisa dihitung ulang kapan saja.</p></div>` : '', g => `<a class="tombol kedua kecil" href="#/gaji/hitung/${g.id}">Buka</a>`);
  const f = el.querySelector('[data-hitung]'); if (f) f.onsubmit = async e => { e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; const x = await coba(() => rpc('hitung_gaji', { p_bulan: f.b.value })); b.disabled = false; if (x) location.hash = '#/gaji/hitung/' + x; };
  return 'Perhitungan Gaji';
});
rute('gaji/bayar', async (el, [id]) => {
  if (id) return lihat(el, Number(id), 'bayar');
  await daftar(el, 'Pembayaran Gaji', 'Gaji Karyawan / Pembayaran Gaji', '<p class="pesan info">Gaji bisa dibayar setelah berstatus <b>Final</b>. Di Buku Kas tercatat satu transaksi gabungan, jadi nominal per orang tidak terlihat.</p>', g => g.status === 'draf' ? '' : `<a class="tombol ${g.status === 'final' ? '' : 'kedua'} kecil" href="#/gaji/bayar/${g.id}">${g.status === 'final' ? 'Bayar' : 'Buka'}</a>`);
  return 'Pembayaran Gaji';
});

async function lihat(el, id, mode) {
  let g; const bolehH = bisa('gaji.hitung') && mode === 'hitung', bolehB = bisa('gaji.bayar') && mode === 'bayar';
  const gambar = () => {
    const s = g.slip, draf = g.status === 'draf' && bolehH;
    el.innerHTML = judulHalaman('Gaji ' + namaBulan(g.bulan), `Gaji Karyawan / ${mode === 'bayar' ? 'Pembayaran' : 'Perhitungan'} Gaji`, `<a class="tombol kedua" href="#/gaji/${mode}">${ikon('kiri')} Daftar</a><button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak Rekap</button><button class="tombol kedua" data-semua>Cetak Semua Slip</button>`) +
      `<div class="kartu"><div class="alat-tabel">${chip(g.status)}<span>${tanggal(g.dari)} s.d. ${tanggal(g.sampai)}</span>${g.dibayar ? `<span>Dibayar ${tanggal(g.dibayar)} dari ${esc(g.kas || '-')} oleh ${esc(g.dibayar_oleh || '')}</span>` : mode === 'bayar' ? `<span>Tanggal gajian: ${angka(g.setting.tanggal_bayar)}</span>` : ''}<span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        ${draf ? '<button class="tombol kedua" data-ulang>Hitung Ulang</button><button class="tombol kedua" data-hapus>Hapus Draf</button><button class="tombol" data-final>Finalkan</button>' : ''}${bolehH && g.status === 'final' ? '<button class="tombol kedua" data-draf>Buka Kembali</button>' : ''}${bolehB && g.status === 'final' ? '<button class="tombol" data-bayar>Bayar Gaji</button>' : ''}${bolehB && g.status === 'dibayar' ? '<button class="tombol kedua" data-batal>Batalkan Pembayaran</button>' : ''}</span></div>
        ${g.status === 'draf' && g.peringatan.length ? `<div class="pesan peringatan"><b>Perlu dicek</b><ul style="margin:6px 0 0;padding-left:18px">${g.peringatan.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="grid-4"><div class="statistik"><small>Total gaji bersih</small><b>${rupiah(jml(s, 'bersih'))}</b></div><div class="statistik"><small>Gaji pokok</small><b>${rupiah(jml(s, 'pokok'))}</b></div><div class="statistik"><small>Tunjangan & lembur</small><b>${rupiah(jml(s, 'tunjangan'))}</b></div><div class="statistik"><small>Potongan</small><b>${rupiah(jml(s, 'potongan'))}</b></div></div></div>
      <div class="kartu">${tabelHtml(kolom(true, draf), s, { kosong: 'Belum ada karyawan.' })}</div>`;
  };
  const kolom = (aksi, draf) => [{ l: 'Karyawan', n: q => q.nama, h: q => `<span><b>${esc(q.nama)}</b><br><small>${esc(q.jabatan || '')}</small></span>` }, { l: 'Hadir', n: q => q.hadir.hadir, t: 'angka' }, { l: 'Terlambat', n: q => q.hadir.telat_n, t: 'angka' }, { l: 'Tanpa ket.', n: q => q.hadir.alpa, t: 'angka' }, { l: 'Izin/Sakit/Cuti', n: q => `${q.hadir.izin}/${q.hadir.sakit}/${q.hadir.cuti}` }, { l: 'Gaji pokok', n: q => q.pokok, t: 'uang', jml: true }, { l: 'Tunjangan', n: q => q.tunjangan, t: 'uang', jml: true }, { l: 'Potongan', n: q => q.potongan, t: 'uang', jml: true },
    { l: 'Bersih', n: q => q.bersih, t: 'uang', jml: true, h: q => `<b style="${Number(q.bersih) < 0 ? 'color:var(--merah)' : ''}">${rupiah(q.bersih)}</b>` }, ...(aksi ? [{ l: '', n: () => '', h: q => `<button class="tombol kedua kecil" data-slip="${q.id}">${draf ? 'Ubah' : 'Slip'}</button>` }] : [])];
  const muat = async () => { try { g = await rpc('lihat_gaji', { p_id: id }); gambar(); } catch (e) { el.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; } };
  const lakukan = async (nama, p, pesan) => { const ok = await coba(async () => { await rpc(nama, p); return 1; }); if (ok) { toast(pesan, 'sukses'); await muat(); } return ok; };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), sl = q('[data-slip]');
    if (sl) { const x = g.slip.find(y => y.id === Number(sl.dataset.slip)); g.status === 'draf' && bolehH ? ubah(x) : slip({ ...x, bulan: g.bulan, dari: g.dari, sampai: g.sampai, dibayar: g.dibayar, status: g.status }); }
    if (q('[data-unduh]')) unduhTabel('gaji-' + g.bulan, kolom(), g.slip);
    if (q('[data-cetak]')) cetakHtml('Rekap Gaji ' + namaBulan(g.bulan), `${tanggal(g.dari)} s.d. ${tanggal(g.sampai)} · ${STATUS[g.status][1]}`, tabelHtml(kolom(), g.slip));
    if (q('[data-semua]')) cetakSlip(g.slip.map(x => ({ ...x, bulan: g.bulan, dari: g.dari, sampai: g.sampai, dibayar: g.dibayar, status: g.status })));
    if (q('[data-ulang]')) { q('[data-ulang]').disabled = true; if (!await lakukan('hitung_gaji', { p_bulan: g.bulan }, 'Dihitung ulang')) gambar(); }
    if (q('[data-final]') && await konfirmasi('Finalkan gaji', `Kunci perhitungan gaji ${namaBulan(g.bulan)} sebesar <b>${rupiah(jml(g.slip, 'bersih'))}</b>?${g.peringatan.length ? `<br><br>Masih ada ${g.peringatan.length} hal yang perlu dicek.` : ''}`, 'Finalkan', '')) lakukan('status_gaji', { p_id: id, p_status: 'final' }, 'Gaji difinalkan');
    if (q('[data-draf]')) lakukan('status_gaji', { p_id: id, p_status: 'draf' }, 'Dibuka kembali');
    if (q('[data-hapus]') && await konfirmasi('Hapus draf', 'Hapus perhitungan bulan ini beserta isian lembur dan tambahannya? Tidak bisa dikembalikan.', 'Hapus')) { if (await coba(async () => { await rpc('status_gaji', { p_id: id, p_status: 'hapus' }); return 1; })) location.hash = '#/gaji/hitung'; }
    if (q('[data-batal]') && await konfirmasi('Batalkan pembayaran', 'Kas, jurnal, dan potongan kasbon dikembalikan. Slip tidak terlihat lagi oleh karyawan. Lanjutkan?', 'Batalkan pembayaran')) lakukan('batal_bayar_gaji', { p_id: id }, 'Pembayaran dibatalkan');
    if (q('[data-bayar]')) await coba(async () => {
      const kas = (await akunKas()).filter(k => k.jenis !== 'kasir');
      modal({ judul: 'Bayar Gaji ' + namaBulan(g.bulan), ukuran: 'kecil', isi: `<div class="total-bayar"><small>Total ${g.slip.length} karyawan</small><b>${rupiah(jml(g.slip, 'bersih'))}</b></div><form onsubmit="return false"><label class="isian"><span>Dibayar dari</span><select name="kas" required>${opsiKas(kas)}</select></label><label class="isian"><span>Tanggal bayar</span><input type="date" name="t" value="${hariIni()}" max="${hariIni()}" required></label></form><p class="pesan info">Aplikasi hanya mencatat. Transfer uangnya tetap Anda lakukan sendiri. Setelah ini karyawan bisa melihat slip masing-masing.</p>`,
        tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Catat Dibayar', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('bayar_gaji', { p_id: id, p_kas: Number(f.kas.value), p_tanggal: f.t.value }); toast('Gaji tercatat dibayar', 'sukses'); muat(); } }] });
    });
  });
  function ubah(x) {
    const kb = x.rincian.filter(r => r.kasbon), mn = x.rincian.filter(r => r.manual), lebih = Number(x.hadir.lebih_menit || 0);
    const barisLain = (r = {}) => `<div class="alat-tabel" data-lain style="margin:0 0 8px"><select class="input" style="width:auto" data-j>${opsi([['tunjangan', 'Tambah'], ['potongan', 'Potong']], r.jenis || 'tunjangan')}</select><input class="input" style="flex:1;min-width:130px" data-nm placeholder="Nama, mis. Bonus" value="${esc(r.nama || '')}" maxlength="60"><input class="input" style="width:140px" type="number" min="1" data-v placeholder="Rp" value="${r.nilai ?? ''}"><button type="button" class="ikon-aksi hapus" data-buang aria-label="Hapus">${ikon('hapus')}</button></div>`;
    modal({ judul: 'Gaji ' + x.nama, ukuran: 'besar', isi: `${rincianHtml(x)}<form onsubmit="return false" style="margin-top:16px"><div class="form-grid">${g.setting.lembur_cara === 'tidak' ? '' : `<label class="isian"><span>Lembur (jam)</span><input type="number" min="0" max="200" step="0.5" name="lembur" value="${Number(x.isian.lembur || 0)}"><small>Jam lebih menurut presensi: ${angka((lebih / 60).toFixed(1))} jam</small></label>`}
      ${mn.map(r => `<label class="isian"><span>${esc(r.nama)} (Rp)</span><input type="number" min="0" data-kom="${r.kunci.slice(1)}" value="${Number(r.nilai)}"></label>`).join('')}${kb.map(r => `<label class="isian"><span>Potong ${esc(r.nama)} (Rp)</span><input type="number" min="0" data-kb="${r.kasbon}" value="${Number(r.nilai)}"><small>${esc(r.ket)}</small></label>`).join('')}</div>
      <b>Tambahan / potongan lain bulan ini</b><div data-wadah style="margin-top:8px">${(x.isian.lain || []).map(barisLain).join('')}</div><button type="button" class="tombol kedua kecil" data-tambah-lain>${ikon('tambah')} Tambah baris</button><label class="isian" style="margin-top:12px"><span>Catatan di slip</span><input name="cat" value="${esc(x.catatan || '')}" maxlength="200"></label></form>`,
      saatBuka: m => m.addEventListener('click', e => { if (e.target.closest('[data-tambah-lain]')) m.querySelector('[data-wadah]').insertAdjacentHTML('beforeend', barisLain()); const b = e.target.closest('[data-buang]'); if (b) b.closest('[data-lain]').remove(); }),
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form'); if (!f.reportValidity()) return false; const lain = [...m.querySelectorAll('[data-lain]')].map(b => ({ jenis: b.querySelector('[data-j]').value, nama: b.querySelector('[data-nm]').value.trim(), nilai: Number(b.querySelector('[data-v]').value || 0) })).filter(r => r.nama || r.nilai);
        await rpc('ubah_slip', { p: { slip_id: x.id, lembur: f.lembur ? Number(f.lembur.value || 0) : Number(x.isian.lembur || 0), komponen: Object.fromEntries([...m.querySelectorAll('[data-kom]')].map(i => [i.dataset.kom, Number(i.value || 0)])), kasbon: Object.fromEntries([...m.querySelectorAll('[data-kb]')].map(i => [i.dataset.kb, Number(i.value || 0)])), lain, catatan: f.cat.value } });
        toast('Disimpan', 'sukses'); muat();
      } }] });
  }
  await muat();
  return 'Gaji ' + (g ? namaBulan(g.bulan) : '');
}

// ================= Slip =================
const barisR = r => `<div class="baris-total"><span>${esc(r.nama)}${r.ket ? ` <small style="color:var(--teks-2)">(${esc(r.ket)})</small>` : ''}</span><span>${r.jenis === 'potongan' ? '- ' : ''}${rupiah(r.nilai)}</span></div>`;
function rincianHtml(x) {
  const a = x.rincian.filter(r => r.jenis !== 'potongan'), b = x.rincian.filter(r => r.jenis === 'potongan');
  return `<div class="grid-2 rapat"><div class="kartu-sesi"><b>Penerimaan</b>${a.map(barisR).join('') || '<p class="kosong">Gaji pokok belum diisi.</p>'}<div class="baris-total" style="font-weight:800"><span>Jumlah</span><span>${rupiah(Number(x.pokok) + Number(x.tunjangan))}</span></div></div><div class="kartu-sesi"><b>Potongan</b>${b.map(barisR).join('') || '<p class="kosong">Tidak ada.</p>'}<div class="baris-total" style="font-weight:800"><span>Jumlah</span><span>${rupiah(x.potongan)}</span></div></div></div><div class="total-bayar" style="margin-top:12px"><small>Gaji bersih</small><b>${rupiah(x.bersih)}</b></div>`;
}
const slip = x => modal({ judul: `Slip Gaji ${namaBulan(x.bulan)}`, ukuran: 'besar', isi: `<p style="margin-top:0"><b>${esc(x.nama)}</b>${x.jabatan ? ' · ' + esc(x.jabatan) : ''}<br><small>${tanggal(x.dari)} s.d. ${tanggal(x.sampai)} · hadir ${angka(x.hadir.hadir)} hari${x.dibayar ? ' · dibayar ' + tanggal(x.dibayar) : ''}</small></p>${rincianHtml(x)}${x.catatan ? `<p>Catatan: ${esc(x.catatan)}</p>` : ''}`, tombol: [{ teks: 'Cetak / PDF', kelas: 'kedua', aksi: () => { cetakSlip([x]); return false; } }, { teks: 'Tutup' }] });
function cetakSlip(d) {
  const b = r => `<tr><td>${esc(r.nama)}${r.ket ? ` (${esc(r.ket)})` : ''}</td><td class="k">${rupiah(r.nilai)}</td></tr>`;
  cetakKertasBiasa(d.map(x => `<section><h2>${esc(S.outlet?.nama || 'Apotek Salam')}</h2><h3>SLIP GAJI ${namaBulan(x.bulan).toUpperCase()}${x.status === 'dibayar' ? '' : ' (BELUM DIBAYAR)'}</h3><p>Nama: <b>${esc(x.nama)}</b>${x.jabatan ? ` · ${esc(x.jabatan)}` : ''}<br>Periode: ${tanggal(x.dari)} s.d. ${tanggal(x.sampai)} · Hadir ${angka(x.hadir.hadir)} hari · Izin ${x.hadir.izin} · Sakit ${x.hadir.sakit} · Cuti ${x.hadir.cuti} · Terlambat ${x.hadir.telat_n} kali</p>
    <div class="dua"><table><tr><th colspan="2">Penerimaan</th></tr>${x.rincian.filter(r => r.jenis !== 'potongan').map(b).join('')}<tr class="j"><td>Jumlah</td><td class="k">${rupiah(Number(x.pokok) + Number(x.tunjangan))}</td></tr></table><table><tr><th colspan="2">Potongan</th></tr>${x.rincian.filter(r => r.jenis === 'potongan').map(b).join('')}<tr class="j"><td>Jumlah</td><td class="k">${rupiah(x.potongan)}</td></tr></table></div>
    <p class="b">Gaji bersih: ${rupiah(x.bersih)}</p>${x.catatan ? `<p>Catatan: ${esc(x.catatan)}</p>` : ''}<div class="dua ttd"><span>Penerima<br><br><br>( ${esc(x.nama)} )</span><span>Apotek Salam<br><br><br>( ____________ )</span></div></section>`).join(''),
  `body{font:11px Arial;color:#000}h2,h3{margin:0 0 3px;text-align:center}section{break-after:page}section:last-child{break-after:auto}.dua{display:flex;gap:14px}.dua>*{flex:1}table{border-collapse:collapse;width:100%;align-self:flex-start}td,th{border-bottom:1px solid #bbb;padding:3px;text-align:left}.k{text-align:right;white-space:nowrap}.j{font-weight:bold}.b{font-size:14px;font-weight:bold;text-align:right}.ttd{text-align:center;margin-top:16px}`, 'Slip Gaji', 'A5 landscape');
}
rute('gaji/slip', async el => {
  el.innerHTML = judulHalaman('Slip Gaji Saya', 'Gaji Karyawan / Slip Gaji Saya') + `<div class="kartu"><div data-isi>${kerangka}</div></div>`;
  try { const d = await rpc('slip_saya');
    el.querySelector('[data-isi]').innerHTML = tabelHtml([{ l: 'Bulan', n: x => x.bulan, h: x => `<b>${namaBulan(x.bulan)}</b>` }, { l: 'Dibayar', n: x => x.dibayar, t: 'tgl' }, { l: 'Gaji bersih', n: x => x.bersih, t: 'uang' }, { l: '', n: () => '', h: x => `<button class="tombol kedua kecil" data-slip="${x.id}">Lihat Slip</button>` }], d, { kosong: 'Belum ada slip. Slip muncul setelah gaji dibayar dan akun Anda dihubungkan di Data Karyawan.' });
    el.addEventListener('click', e => { const b = e.target.closest('[data-slip]'); if (b) slip(d.find(x => x.id === Number(b.dataset.slip))); });
  } catch (e) { galat(el, e); }
});
