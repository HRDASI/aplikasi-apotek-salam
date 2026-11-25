// Karyawan, Jadwal Kerja, Presensi (dari aplikasi Absensi), Izin/Sakit/Cuti, Laporan Presensi, Integrasi.
import { rute, sb, S, bisa } from '../inti.js?v=1.19.0';
import { ikon } from '../menu.js?v=1.19.0';
import { esc, angka, tanggal, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.19.0';
import { rpc, hariIni, geserHari, tabelHtml, halamanLaporan, unduhTabel, cetakHtml } from '../tabel.js?v=1.19.0';

const galat = (el, e) => { el.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; };
const STATUS = { hadir: ['Hadir', 'hijau'], terlambat: ['Terlambat', 'oranye'], alpa: ['Tanpa keterangan', 'merah'], tanpa_masuk: ['Tanpa absen masuk', 'merah'], izin: ['Izin', 'teal'], sakit: ['Sakit', 'teal'], cuti: ['Cuti', 'teal'], libur: ['Libur', ''], terjadwal: ['Terjadwal', ''], kosong: ['-', ''] };
const chip = s => `<span class="chip ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || s}</span>`;
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const hariKe = t => new Date(t + 'T00:00:00Z').getUTCDay();
const akhirBulan = b => { const [y, m] = b.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const jamMenit = m => m ? `${Math.floor(m / 60)} j ${m % 60} m` : '';

// ---------- Karyawan ----------
rute('pengguna/karyawan', async el => {
  let data = [], akun = [];
  const muat = async () => {
    const [{ data: k, error }, { data: a, error: e2 }] = await Promise.all([sb.from('karyawan').select('*, akun:pengguna_id(nama,username)').order('nama'), sb.from('pengguna').select('id,nama,username,aktif').order('nama')]);
    if (error || e2) return galat(el, error || e2);
    data = k; akun = a;
    el.innerHTML = judulHalaman('Data Karyawan', 'Manajemen Pengguna / Data Karyawan', `<button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>`) + `<div class="kartu"><p class="pesan info" style="margin-top:0"><b>Nama di Absensi</b> harus sama persis dengan aplikasi Absensi, dan <b>Nama di jadwal</b> sama dengan berkas Excel jadwal. <b>Akun</b> membuat karyawan bisa melihat presensinya dan mengajukan izin.</p>${tabelHtml([
      { l: 'Nama', n: r => r.nama, h: r => `<span><b>${esc(r.nama)}</b>${r.aktif ? '' : ' <span class="chip">nonaktif</span>'}</span>` }, { l: 'Jabatan', n: r => r.jabatan }, { l: 'Nama di Absensi', n: r => r.nama_absensi, h: r => r.nama_absensi ? esc(r.nama_absensi) : '<span class="chip oranye">belum diisi</span>' }, { l: 'Nama di jadwal', n: r => r.nama_jadwal },
      { l: 'Akun', n: r => r.akun?.username, h: r => r.akun ? esc(r.akun.username) : '<span class="chip">tidak ada</span>' }, { l: 'Mulai kerja', n: r => r.mulai_kerja, t: 'tgl' }, { l: 'Jatah cuti', n: r => r.jatah_cuti, t: 'angka' }, { l: '', n: () => '', h: r => `<button class="ikon-aksi" data-ubah="${r.id}" title="Ubah">${ikon('ubah')}</button>` }], data, { kosong: 'Belum ada karyawan.' })}</div>`;
  };
  const form = async r => {
    const tak = await rpc('status_integrasi').then(s => s.belum_terhubung).catch(() => []);
    modal({ judul: r ? 'Ubah Karyawan' : 'Tambah Karyawan', isi: `<form class="form-grid" onsubmit="return false"><label class="isian"><span>Nama <i>*</i></span><input name="nama" required value="${esc(r?.nama || '')}"></label><label class="isian"><span>Jabatan</span><input name="jabatan" list="jbt" value="${esc(r?.jabatan || '')}"><datalist id="jbt"><option>Apoteker<option>TTK<option>Asisten Apoteker<option>Kasir<option>Admin<option>Gudang</datalist></label>
      <label class="isian"><span>Nama di Absensi</span><input name="nama_absensi" list="nma" value="${esc(r?.nama_absensi || '')}"><datalist id="nma">${tak.map(n => `<option>${esc(n)}`).join('')}</datalist></label><label class="isian"><span>Nama di jadwal Excel</span><input name="nama_jadwal" value="${esc(r?.nama_jadwal || '')}"></label>
      <label class="isian"><span>Akun aplikasi</span><select name="pengguna_id"><option value="">- tidak ada -</option>${akun.filter(a => a.id === r?.pengguna_id || (a.aktif && !data.some(k => k.pengguna_id === a.id))).map(a => `<option value="${a.id}" ${a.id === r?.pengguna_id ? 'selected' : ''}>${esc(a.nama)} (${esc(a.username)})</option>`).join('')}</select></label>
      <label class="isian"><span>Mulai kerja</span><input type="date" name="mulai_kerja" value="${r?.mulai_kerja || ''}"></label><label class="isian"><span>Jatah cuti per tahun</span><input type="number" name="jatah_cuti" min="0" max="60" required value="${r?.jatah_cuti ?? 12}"></label>${r ? `<label class="cek"><input type="checkbox" name="aktif" ${r.aktif ? 'checked' : ''}> Masih bekerja</label>` : ''}</form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_karyawan', { p: { ...Object.fromEntries(new FormData(f)), id: r?.id ?? null, aktif: f.aktif?.checked ?? true } }); toast('Tersimpan', 'sukses'); muat(); } }] });
  };
  el.addEventListener('click', e => { if (e.target.closest('[data-tambah]')) form(); const b = e.target.closest('[data-ubah]'); if (b) form(data.find(k => k.id === Number(b.dataset.ubah))); });
  await muat();
});

// ---------- Jadwal ----------
rute('pengguna/jadwal', async el => {
  const boleh = bisa('pengguna.jadwal'); let bulan = hariIni().slice(0, 7), d = null, ubah = new Map(), J = new Map();
  const kunci = (k, t) => k + '|' + t;
  const muat = async () => {
    const b = bulan; let x; try { x = await rpc('daftar_jadwal', { p_dari: b + '-01', p_sampai: akhirBulan(b) }); } catch (e) { return galat(el, e); }
    if (b !== bulan) return; d = x; ubah = new Map(); J = new Map(d.jadwal.map(j => [kunci(j.k, j.t), j.c])); gambar();
  };
  const isiSel = (k, t) => { const kk = kunci(k, t); return ubah.has(kk) ? ubah.get(kk) : J.get(kk) || ''; };
  const izinSel = (k, t) => d.izin.find(i => i.k === k && t >= i.d && t <= i.s);
  const warna = c => { const x = d.kode.find(y => y.kode === c); return !c ? '' : !x?.kerja ? 'merah' : x.shift === 'Pagi' ? 'hijau' : x.shift === 'Sore' ? 'teal' : 'oranye'; };
  function gambar() {
    const hari = []; for (let t = bulan + '-01'; t <= akhirBulan(bulan); t = geserHari(t, 1)) hari.push(t);
    const [y, m] = bulan.split('-').map(Number), hr = hariIni();
    const saya = d.karyawan.find(k => k.id === d.saya), urut = saya ? [saya, ...d.karyawan.filter(k => k !== saya)] : d.karyawan;
    const jml = (t, s) => d.karyawan.filter(k => d.kode.find(c => c.kode === isiSel(k.id, t))?.shift === s && !izinSel(k.id, t)).length;
    el.innerHTML = judulHalaman('Jadwal Kerja', 'Manajemen Pengguna / Jadwal Kerja', `${boleh ? `<label class="tombol kedua" style="cursor:pointer">Impor Excel<input type="file" accept=".xlsx,.xls" hidden data-file></label>` : ''}<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>`) + `<div class="kartu"><div class="alat-tabel"><button class="ikon-aksi" data-geser="-1" aria-label="Bulan sebelumnya">${ikon('kiri')}</button><b>${BULAN[m - 1]} ${y}</b><button class="ikon-aksi" data-geser="1" aria-label="Bulan berikutnya">${ikon('panah')}</button>${ubah.size ? `<button class="tombol" data-simpan>Simpan ${ubah.size} perubahan</button><button class="tombol kedua" data-batal>Batal</button>` : ''}</div>
      ${d.karyawan.length ? `<div class="bungkus-tabel jadwal"><table class="tabel"><thead><tr><th class="lengket">Nama</th>${hari.map(t => `<th class="${hariKe(t) === 0 ? 'ahad' : ''} ${t === hr ? 'kini' : ''}">${HARI[hariKe(t)]}<br>${Number(t.slice(8))}</th>`).join('')}</tr></thead><tbody>
      ${urut.map(k => `<tr class="${k === saya ? 'baris-saya' : ''}"><td class="lengket"><b>${esc(k.nama)}</b></td>${hari.map(t => { const c = isiSel(k.id, t), i = izinSel(k.id, t), u = ubah.has(kunci(k.id, t)); return `<td class="${t === hr ? 'kini' : ''}"><button class="sel-jadwal chip ${i ? 'oranye' : warna(c)} ${u ? 'diubah' : ''}" ${boleh ? `data-sel="${k.id}|${t}"` : 'disabled'} title="${i ? i.j : esc(d.kode.find(x => x.kode === c)?.nama || 'Kosong')}" aria-label="${esc(k.nama)} ${tanggal(t)}: ${i ? i.j : c || 'kosong'}">${i ? i.j.slice(0, 1).toUpperCase() + i.j.slice(1, 3) : esc(c) || '·'}</button></td>`; }).join('')}</tr>`).join('')}
      ${['Pagi', 'Sore', 'Admin'].map(s => `<tr class="jumlah"><td class="lengket">Jumlah ${s.toLowerCase()}</td>${hari.map(t => { const n = jml(t, s); return `<td class="${s !== 'Admin' && n === 0 && d.jadwal.length ? 'nol' : ''}">${n || ''}${s !== 'Admin' && n === 0 && d.jadwal.length ? '0' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p style="color:var(--teks-2);font-size:13px">${d.kode.map(c => `<span class="chip ${warna(c.kode)}">${c.kode}</span> ${esc(c.nama)}${c.jam_masuk ? ` ${c.jam_masuk.slice(0, 5)}–${c.jam_pulang.slice(0, 5)}` : ''}`).join(' &nbsp; ')}</p>` : '<p class="kosong">Belum ada karyawan. Tambahkan di Data Karyawan.</p>'}</div>`;
    const w = el.querySelector('.jadwal'), k = w?.querySelector('th.kini'); if (w && k) w.scrollLeft = k.offsetLeft - 200;
  }
  const pilih = (kid, t) => modal({ judul: `${d.karyawan.find(k => k.id === kid).nama} · ${HARI[hariKe(t)]}, ${tanggal(t)}`, ukuran: 'kecil', isi: `<div class="aksi-cepat">${[...d.kode, { kode: '', nama: 'Kosongkan' }].map(c => `<button class="tombol kedua" data-k="${c.kode}">${c.kode ? `<b>${c.kode}</b> ` : ''}${esc(c.nama)}</button>`).join('')}</div>`,
    saatBuka: (m, tutup) => m.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; const kk = kunci(kid, t); if (b.dataset.k === (J.get(kk) || '')) ubah.delete(kk); else ubah.set(kk, b.dataset.k); const s = el.querySelector('.jadwal').scrollLeft; tutup(); gambar(); el.querySelector('.jadwal').scrollLeft = s; }) });
  const baca = async file => {
    const { bacaJadwal } = await import('./jadwal-excel.js?v=1.19.0'); const h = await bacaJadwal(file); const peta = new Map(), tak = [];
    for (const n of h.nama) { const x = n.toLowerCase(), c = d.karyawan.filter(k => (k.nama_jadwal || '').toLowerCase() === x); const c2 = c.length ? c : d.karyawan.filter(k => k.nama.toLowerCase() === x); if (c2.length === 1) peta.set(n, c2[0].id); else tak.push(n); }
    const kode = new Set(d.kode.map(c => c.kode)), salah = h.baris.filter(b => b.kode && !kode.has(b.kode));
    modal({ judul: `Impor jadwal ${BULAN[Number(h.bulan.slice(5)) - 1]} ${h.bulan.slice(0, 4)}`, isi: `<p style="margin-top:0"><b>${peta.size}</b> dari ${h.nama.length} nama cocok, <b>${h.baris.filter(b => peta.has(b.nama) && kode.has(b.kode)).length}</b> jadwal. Baris Actual dipakai bila terisi.</p>${tak.length ? `<p class="pesan peringatan">Nama belum dikenal: ${tak.map(esc).join(', ')}. Pilih karyawannya:</p><div class="form-grid">${tak.map((n, i) => `<label class="isian"><span>${esc(n)}</span><select data-n="${i}"><option value="">- lewati -</option>${d.karyawan.filter(k => ![...peta.values()].includes(k.id)).map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select></label>`).join('')}</div>` : ''}${salah.length ? `<p class="pesan galat">Kode tidak dikenal dan dilewati: ${[...new Set(salah.map(b => b.kode))].map(esc).join(', ')}</p>` : ''}`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan jadwal', aksi: async m => {
        tak.forEach((n, i) => { const v = m.querySelector(`[data-n="${i}"]`).value; if (v) peta.set(n, Number(v)); });
        if (new Set(peta.values()).size !== peta.size) throw new Error('Satu karyawan dipilih untuk dua nama');
        const b = h.baris.filter(x => peta.has(x.nama) && kode.has(x.kode)).map(x => ({ karyawan_id: peta.get(x.nama), tanggal: x.tanggal, kode: x.kode })); if (!b.length) throw new Error('Tidak ada jadwal yang cocok');
        await rpc('simpan_jadwal', { p_baris: b }); toast(`${b.length} jadwal disimpan`, 'sukses'); bulan = h.bulan; muat();
      } }] });
  };
  const tabel = () => { const hari = []; for (let t = bulan + '-01'; t <= akhirBulan(bulan); t = geserHari(t, 1)) hari.push(t); return [{ l: 'Nama', n: r => r.nama }, ...hari.map(t => ({ l: String(Number(t.slice(8))), n: r => izinSel(r.id, t)?.j || isiSel(r.id, t) }))]; };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), s = q('[data-sel]'), g = q('[data-geser]');
    if (s) { const [k, t] = s.dataset.sel.split('|'); pilih(Number(k), t); }
    if (g) { if (ubah.size && !await konfirmasi('Belum disimpan', 'Perubahan jadwal belum disimpan. Tinggalkan?', 'Tinggalkan')) return; const [y, m] = bulan.split('-').map(Number); bulan = new Date(Date.UTC(y, m - 1 + Number(g.dataset.geser), 1)).toISOString().slice(0, 7); muat(); }
    if (q('[data-batal]')) { ubah = new Map(); gambar(); }
    if (q('[data-simpan]')) try { await rpc('simpan_jadwal', { p_baris: [...ubah].map(([k, c]) => ({ karyawan_id: Number(k.split('|')[0]), tanggal: k.split('|')[1], kode: c || null })) }); toast('Jadwal disimpan', 'sukses'); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); }
    if (q('[data-unduh]')) unduhTabel('jadwal-' + bulan, tabel(), d.karyawan);
    if (q('[data-cetak]')) cetakHtml('Jadwal Kerja', `${BULAN[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}`, '<style>@page{size:A4 landscape}th,td{padding:2px!important;font-size:9px}</style>' + tabelHtml(tabel(), d.karyawan));
  });
  el.addEventListener('change', e => { if (e.target.matches('[data-file]') && e.target.files[0]) baca(e.target.files[0]).catch(x => toast(pesanGalat(x), 'galat')).finally(() => { e.target.value = ''; }); });
  await muat();
});

// ---------- Presensi ----------
rute('pengguna/presensi', async el => {
  const semua = bisa('pengguna.presensi'); let tgl = hariIni(), data = [];
  const st = { dari: geserHari(hariIni(), -6), sampai: hariIni(), nama: '' };
  el.innerHTML = judulHalaman('Riwayat Presensi', 'Manajemen Pengguna / Riwayat Presensi', semua ? `<button class="tombol" data-tarik>${ikon('muat')} Tarik dari Absensi</button>` : '') + `<div class="kartu"><div class="alat-tabel"><input type="date" class="input" style="width:auto" data-dari value="${st.dari}" aria-label="Dari"><input type="date" class="input" style="width:auto" data-sampai value="${st.sampai}" aria-label="Sampai"><select class="input" style="width:auto" data-nama><option value="">Semua karyawan</option></select><select class="input" style="width:auto" data-st><option value="">Semua status</option>${Object.entries(STATUS).filter(([k]) => k !== 'kosong').map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select><span data-ket style="color:var(--teks-2)"></span></div><div data-isi></div></div>`;
  const isi = el.querySelector('[data-isi]');
  const gambar = () => {
    const n = el.querySelector('[data-nama]').value, s = el.querySelector('[data-st]').value, r = data.filter(x => (!n || String(x.karyawan_id) === n) && (!s || x.status === s) && (s || !['kosong', 'terjadwal'].includes(x.status))).sort((a, b) => a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : a.nama.localeCompare(b.nama));
    isi.innerHTML = tabelHtml([{ l: 'Tanggal', n: x => x.tanggal, h: x => `<span>${HARI[hariKe(x.tanggal)]}, ${tanggal(x.tanggal)}</span>` }, { l: 'Nama', n: x => x.nama, h: x => `<b>${esc(x.nama)}</b>` }, { l: 'Jadwal', n: x => x.kode }, { l: 'Status', n: x => x.status, h: x => `<span>${chip(x.status)}${x.palsu ? ' <span class="chip merah">GPS palsu</span>' : ''}${x.luar ? ' <span class="chip oranye">luar lokasi</span>' : ''}${x.tanpa_pulang ? ' <span class="chip oranye">tanpa pulang</span>' : ''}${x.masuk && x.kerja === false ? ' <span class="chip">masuk saat libur</span>' : ''}</span>` }, { l: 'Masuk', n: x => x.masuk }, { l: 'Pulang', n: x => x.pulang }, { l: 'Kerja', n: x => jamMenit(x.menit) }, { l: 'Telat (m)', n: x => x.telat || '', t: 'angka' }, { l: 'Awal (m)', n: x => x.awal || '', t: 'angka' }], r, { kosong: 'Belum ada data presensi pada rentang ini.' });
    el.querySelector('[data-ket]').textContent = `${angka(r.length)} baris`;
  };
  const muat = async () => {
    const a = el.querySelector('[data-dari]').value, b = el.querySelector('[data-sampai]').value; if (!a || !b || a > b) return;
    isi.innerHTML = '<div class="kerangka-muat"><i></i><i></i><i></i></div>';
    try { data = await rpc('rekap_presensi', { p_dari: a, p_sampai: b }); } catch (e) { return galat(isi, e); }
    const s = el.querySelector('[data-nama]'), v = s.value, nm = new Map(data.map(x => [x.karyawan_id, x.nama])); s.innerHTML = '<option value="">Semua karyawan</option>' + [...nm].map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join(''); s.value = v; gambar();
  };
  el.addEventListener('change', e => e.target.matches('[data-dari],[data-sampai]') ? muat() : gambar());
  el.querySelector('[data-tarik]')?.addEventListener('click', async e => { const b = e.currentTarget; b.disabled = true; try { const n = await tarik(el.querySelector('[data-dari]').value, el.querySelector('[data-sampai]').value); toast(`${n} data presensi ditarik`, 'sukses'); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); } b.disabled = false; });
  await muat();
});
const tarik = async (dari, sampai) => tunggu(await rpc('tarik_presensi', { p_dari: dari, p_sampai: sampai }));
async function tunggu(id) {
  for (let i = 0; i < 45; i++) { await new Promise(r => setTimeout(r, 2000)); const s = await rpc('cek_tarikan', { p_id: id }); if (s.status === 'selesai') return s.jumlah; if (s.status === 'gagal') throw new Error(s.pesan || 'Gagal menarik data'); }
  throw new Error('Server belum menjawab. Proses tetap berjalan di belakang; cek lagi sebentar.');
}

// ---------- Izin ----------
const ST_IZIN = { diajukan: ['Menunggu', 'oranye'], disetujui: ['Disetujui', 'hijau'], ditolak: ['Ditolak', 'merah'], batal: ['Dibatalkan', ''] };
rute('pengguna/izin', async el => {
  const putus = bisa('pengguna.izin'); let data = [], kar = [];
  const muat = async () => {
    const [{ data: d, error }, { data: k, error: e2 }] = await Promise.all([sb.from('izin').select('*, karyawan:karyawan_id(nama,pengguna_id)').order('id', { ascending: false }).limit(300), sb.from('karyawan').select('id,nama,pengguna_id,aktif').order('nama')]);
    if (error || e2) return galat(el, error || e2);
    data = d; kar = k; const saya = kar.find(x => x.pengguna_id === S.pengguna.id); let sisa = null;
    if (saya) sisa = await rpc('sisa_cuti', { p_karyawan: saya.id, p_tahun: Number(hariIni().slice(0, 4)) }).catch(() => null);
    const tunggu = data.filter(x => x.status === 'diajukan');
    el.innerHTML = judulHalaman('Izin, Sakit & Cuti', 'Manajemen Pengguna / Izin, Sakit & Cuti', saya || putus ? `<button class="tombol" data-ajukan>${ikon('tambah')} Ajukan</button>` : '') + (sisa ? `<div class="kartu" style="margin-bottom:16px"><div class="grid-4"><div class="statistik"><small>Sisa cuti tahun ini</small><b>${sisa.sisa} hari</b></div><div class="statistik"><small>Terpakai</small><b>${sisa.terpakai} dari ${sisa.jatah}</b></div></div></div>` : '')
      + (!saya && !putus ? '<p class="pesan peringatan">Akun Anda belum dihubungkan ke data karyawan. Minta Pemilik menghubungkannya di Data Karyawan.</p>' : '') + (putus && tunggu.length ? `<p class="pesan peringatan">${tunggu.length} pengajuan menunggu keputusan.</p>` : '')
      + `<div class="kartu">${tabelHtml([{ l: 'Nama', n: r => r.karyawan?.nama, h: r => `<b>${esc(r.karyawan?.nama)}</b>` }, { l: 'Jenis', n: r => r.jenis, h: r => STATUS[r.jenis][0] }, { l: 'Tanggal', n: r => r.dari, h: r => r.dari === r.sampai ? tanggal(r.dari) : `<span>${tanggal(r.dari)} s.d. ${tanggal(r.sampai)}</span>` }, { l: 'Hari kerja', n: r => r.hari, t: 'angka' }, { l: 'Alasan', n: r => r.alasan }, { l: 'Status', n: r => r.status, h: r => `<span><span class="chip ${ST_IZIN[r.status][1]}">${ST_IZIN[r.status][0]}</span>${r.diputus_oleh ? `<br><small style="color:var(--teks-2)">${esc(r.diputus_oleh)}${r.catatan ? ': ' + esc(r.catatan) : ''}</small>` : ''}</span>` },
        { l: '', n: () => '', h: r => { const m = r.karyawan?.pengguna_id === S.pengguna.id, b = putus && r.status === 'diajukan' && (!m || bisa('*')); return `<span>${b ? `<button class="tombol kecil" data-putus="${r.id}|disetujui">Setujui</button> <button class="tombol kedua kecil" data-putus="${r.id}|ditolak">Tolak</button> ` : ''}${(m && r.status === 'diajukan') || (putus && ['diajukan', 'disetujui'].includes(r.status)) ? `<button class="tombol kedua kecil" data-putus="${r.id}|batal">Batalkan</button>` : ''}</span>`; } }], [...tunggu, ...data.filter(x => x.status !== 'diajukan')], { kosong: 'Belum ada pengajuan.' })}</div>`;
  };
  const form = () => { const saya = kar.find(x => x.pengguna_id === S.pengguna.id); modal({ judul: 'Ajukan Izin / Sakit / Cuti', isi: `<form class="form-grid" onsubmit="return false">${putus ? `<label class="isian lebar"><span>Karyawan</span><select name="karyawan_id" required>${kar.filter(k => k.aktif).map(k => `<option value="${k.id}" ${k.id === saya?.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></label>` : ''}<label class="isian"><span>Jenis</span><select name="jenis"><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="cuti">Cuti</option></select></label><span></span><label class="isian"><span>Dari</span><input type="date" name="dari" required value="${hariIni()}"></label><label class="isian"><span>Sampai</span><input type="date" name="sampai" required value="${hariIni()}"></label><label class="isian lebar"><span>Alasan <i>*</i></span><textarea name="alasan" rows="3" maxlength="500" required></textarea></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Ajukan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('ajukan_izin', { p: Object.fromEntries(new FormData(f)) }); toast('Pengajuan terkirim', 'sukses'); muat(); } }] }); };
  el.addEventListener('click', e => {
    if (e.target.closest('[data-ajukan]')) form(); const b = e.target.closest('[data-putus]'); if (!b) return; const [id, s] = b.dataset.putus.split('|'), r = data.find(x => x.id === Number(id));
    modal({ judul: { disetujui: 'Setujui', ditolak: 'Tolak', batal: 'Batalkan' }[s] + ' pengajuan', ukuran: 'kecil', isi: `<p style="margin-top:0"><b>${esc(r.karyawan?.nama)}</b> · ${STATUS[r.jenis][0]} ${tanggal(r.dari)} s.d. ${tanggal(r.sampai)}<br>${esc(r.alasan)}</p><label class="isian"><span>Catatan${s === 'ditolak' ? ' <i>*</i>' : ''}</span><input name="c"></label>`, tombol: [{ teks: 'Kembali', kelas: 'kedua' }, { teks: 'Ya', kelas: s === 'disetujui' ? '' : 'bahaya', aksi: async m => { const c = m.querySelector('[name=c]').value.trim(); if (s === 'ditolak' && !c) throw new Error('Isi alasan penolakan'); await rpc('putus_izin', { p_id: Number(id), p_status: s, p_catatan: c || null }); toast('Tersimpan', 'sukses'); muat(); } }] });
  });
  await muat();
});

// ---------- Laporan ----------
rute('laporan/presensi', halamanLaporan({ judul: 'Laporan Presensi', remah: 'Laporan / Laporan Presensi', tab: [
  { k: 'orang', l: 'Per karyawan', ket: 'Tanpa keterangan = dijadwalkan kerja, tidak absen, dan tidak ada izin.', muat: async p => {
    const d = await rpc('rekap_presensi', { p_dari: p.p_dari, p_sampai: p.p_sampai }), m = new Map();
    for (const x of d) { if (!m.has(x.karyawan_id)) m.set(x.karyawan_id, { nama: x.nama, jabatan: x.jabatan, jadwal: 0, hadir: 0, telatX: 0, telat: 0, awalX: 0, awal: 0, tp: 0, alpa: 0, izin: 0, sakit: 0, cuti: 0, lebih: 0, menit: 0, luar: 0, palsu: 0 }); const r = m.get(x.karyawan_id);
      if (x.kerja && x.tanggal <= hariIni()) r.jadwal++; if (x.masuk) { r.hadir++; if (x.kerja === false) r.lebih++; } if (x.telat) { r.telatX++; r.telat += x.telat; } if (x.awal) { r.awalX++; r.awal += x.awal; } if (x.tanpa_pulang) r.tp++; if (['alpa', 'izin', 'sakit', 'cuti'].includes(x.status) && x.kerja !== false) r[x.status]++; r.menit += x.menit; if (x.luar) r.luar++; if (x.palsu) r.palsu++; }
    return [...m.values()];
  }, kolom: [{ l: 'Nama', n: r => r.nama }, { l: 'Jabatan', n: r => r.jabatan }, { l: 'Dijadwalkan', n: r => r.jadwal, t: 'angka', jml: true }, { l: 'Hadir', n: r => r.hadir, t: 'angka', jml: true }, { l: 'Terlambat', n: r => r.telatX, t: 'angka', jml: true }, { l: 'Menit telat', n: r => r.telat, t: 'angka', jml: true }, { l: 'Pulang awal', n: r => r.awalX, t: 'angka', jml: true }, { l: 'Tanpa pulang', n: r => r.tp, t: 'angka', jml: true }, { l: 'Tanpa ket.', n: r => r.alpa, t: 'angka', jml: true }, { l: 'Izin', n: r => r.izin, t: 'angka', jml: true }, { l: 'Sakit', n: r => r.sakit, t: 'angka', jml: true }, { l: 'Cuti', n: r => r.cuti, t: 'angka', jml: true }, { l: 'Masuk saat libur', n: r => r.lebih, t: 'angka', jml: true }, { l: 'Jam kerja', n: r => Math.round(r.menit / 6) / 10, t: 'angka', jml: true }, { l: 'Luar lokasi', n: r => r.luar, t: 'angka' }, { l: 'GPS palsu', n: r => r.palsu, t: 'angka' }] },
  { k: 'rinci', l: 'Rincian harian', muat: async p => (await rpc('rekap_presensi', { p_dari: p.p_dari, p_sampai: p.p_sampai })).filter(x => !['kosong', 'terjadwal'].includes(x.status)), kolom: [{ l: 'Tanggal', n: r => r.tanggal, t: 'tgl' }, { l: 'Nama', n: r => r.nama }, { l: 'Jadwal', n: r => r.kode }, { l: 'Status', n: r => STATUS[r.status][0], h: r => chip(r.status) }, { l: 'Masuk', n: r => r.masuk }, { l: 'Pulang', n: r => r.pulang }, { l: 'Telat (m)', n: r => r.telat, t: 'angka', jml: true }, { l: 'Awal (m)', n: r => r.awal, t: 'angka', jml: true }] },
] }));

// ---------- Integrasi ----------
const SAMBUNG = {
  absensi: { judul: 'Aplikasi Absensi', menu: 'Absensi', url: 'https://script.google.com/macros/s/AKfycbyOUpFqIEK8_GEZFRhECpu58aTQ48-uKMLmFIrSEfblUwjST9uvKd4CsoDlmvE5xQI/exec', rpc: 'atur_integrasi_absensi', siap: 'Presensi 7 hari terakhir ditarik otomatis 3 kali sehari.', uji: 'Tarik 31 hari terakhir' },
  kinerja: { judul: 'Aplikasi Kinerja', menu: 'Kinerja', url: 'https://script.google.com/macros/s/AKfycbzICYK3JV92Wb3lXLOdAaijvZliUE3eVKX8dBSBuXmawHVW_CICfnlBUEQETv3S22Y6/exec', rpc: 'atur_integrasi_kinerja', siap: 'Nilai triwulan yang sudah Final ditarik otomatis setiap pagi.', uji: 'Tarik nilai sekarang' },
};
rute('pengaturan/integrasi', async el => {
  const kartu = (j, s, tambahan) => { const c = SAMBUNG[j], siap = s.url && s.kunci;
    return `<div class="kartu" data-sambung="${j}"><h3>${c.judul}</h3><p class="pesan ${siap ? 'info' : 'peringatan'}">${siap ? '✓ Kunci tersimpan. ' + c.siap : `Belum tersambung. Di Google Sheet ${c.menu}: menu <b>${c.menu} → Buat kunci baca Aplikasi Apotek</b>, lalu tempel kuncinya di sini.`}</p>
      <form class="form-grid" onsubmit="return false" autocomplete="off"><label class="isian lebar"><span>Alamat server ${c.menu}</span><input name="url" required value="${esc(s.url || c.url)}"></label><label class="isian lebar"><span>Kunci baca</span><input name="kunci" type="password" autocomplete="new-password" placeholder="${s.kunci ? 'Sudah tersimpan. Isi hanya bila diganti.' : 'Tempel 64 karakter'}"><small>Disimpan terenkripsi di server dan tidak bisa dilihat lagi dari aplikasi.</small></label></form>
      <div class="judul-halaman" style="margin:0"><button class="tombol" data-simpan>Simpan</button>${siap ? `<button class="tombol kedua" data-uji>${c.uji}</button>` : ''}</div>${tambahan}</div>`; };
  const muat = async () => {
    let s, n; try { [s, n] = await Promise.all([rpc('status_integrasi'), rpc('status_kinerja')]); } catch (e) { return galat(el, e); }
    const lepas = [...new Set(n.nilai.filter(x => !x.terhubung).map(x => x.nama))], belum = t => `<p class="pesan peringatan" style="margin-top:12px">Nama di ${t} yang belum dihubungkan ke Data Karyawan: <b>`;
    el.innerHTML = judulHalaman('Integrasi', 'Pengaturan / Integrasi') + kartu('absensi', s, s.belum_terhubung.length ? belum('Absensi') + s.belum_terhubung.map(esc).join(', ') + '</b></p>' : '')
      + kartu('kinerja', n, (lepas.length ? belum('Kinerja') + lepas.map(esc).join(', ') + '</b></p>' : '') + `<p style="color:var(--teks-2);margin:12px 0 0">Yang dibaca hanya nilai total dan nilai ujian. Bonus, catatan, dan PIN tidak ikut. Dipakai di Parameter KPI dengan sumber <b>Nilai triwulan (aplikasi Kinerja)</b>; bulan yang triwulannya belum berakhir memakai nilai triwulan sebelumnya.</p>`
        + (n.nilai.length ? `<div style="margin-top:12px">${tabelHtml([{ l: 'Triwulan', n: r => r.periode }, { l: 'Nama', n: r => r.nama }, { l: 'Nilai', n: r => r.total, t: 'angka' }, { l: 'Predikat', n: r => r.predikat }, { l: 'Ujian', n: r => r.ujian, t: 'angka' }], n.nilai)}</div>` : ''))
      + `<div class="kartu"><h3>Riwayat penarikan</h3>${tabelHtml([{ l: 'Waktu', n: r => r.dibuat, h: r => waktu(r.dibuat) }, { l: 'Aplikasi', n: r => r.jenis === 'kinerja' ? 'Kinerja' : 'Absensi' }, { l: 'Rentang', n: r => r.dari, h: r => `<span>${tanggal(r.dari)} s.d. ${tanggal(r.sampai)}</span>` }, { l: 'Status', n: r => r.status, h: r => `<span class="chip ${{ selesai: 'hijau', gagal: 'merah', jalan: 'oranye' }[r.status]}">${r.status}</span>` }, { l: 'Data', n: r => r.jumlah, t: 'angka' }, { l: 'Oleh', n: r => r.oleh }, { l: 'Catatan', n: r => r.pesan }], s.tarikan, { kosong: 'Belum ada.' })}</div>`;
  };
  el.addEventListener('click', async e => {
    const w = e.target.closest('[data-sambung]'); if (!w) return;
    const j = w.dataset.sambung, f = w.querySelector('form');
    if (e.target.closest('[data-simpan]')) { if (!f.reportValidity()) return; try { await rpc(SAMBUNG[j].rpc, { p_url: f.url.value.trim(), p_kunci: f.kunci.value.trim() || null }); toast('Tersimpan', 'sukses'); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); } }
    const u = e.target.closest('[data-uji]'); if (u) { u.disabled = true; u.textContent = 'Menarik…'; try { toast(j === 'kinerja' ? `${await tunggu(await rpc('tarik_kinerja'))} nilai Kinerja ditarik` : `${await tarik(geserHari(hariIni(), -30), hariIni())} data presensi ditarik`, 'sukses'); } catch (x) { toast(pesanGalat(x), 'galat'); } muat(); }
  });
  await muat();
});
