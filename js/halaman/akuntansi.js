// Akuntansi: Daftar Akun, Buku Besar & Jurnal, Aktiva Tetap; Laporan Keuangan (laba rugi, neraca, arus kas).
import { rute, sb, S, bisa } from '../inti.js?v=1.17.0';
import { ikon } from '../menu.js?v=1.17.0';
import { esc, rupiah, tanggal, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.17.0';
import { rpc, hariIni, geserHari, barPeriode, tabelHtml, unduhTabel, cetakHtml } from '../tabel.js?v=1.17.0';
import { akunKas, opsiKas } from './keuangan.js?v=1.17.0';

const TIPE = [['aset', 'Aset'], ['kewajiban', 'Kewajiban'], ['ekuitas', 'Ekuitas'], ['pendapatan', 'Pendapatan'], ['hpp', 'HPP'], ['beban', 'Beban']];
const galat = (el, e) => { el.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; };
const ambilAkun = async () => { const { data, error } = await sb.from('akun').select('*').order('kode'); if (error) throw error; return data; };

rute('akuntansi/akun', async el => {
  let data = [];
  const form = a => modal({ judul: a ? 'Ubah Akun' : 'Tambah Akun', isi: `<form class="form-grid" onsubmit="return false"><label class="isian"><span>Kode <i>*</i></span><input name="kode" required pattern="[1-6][0-9]{3}" maxlength="4" ${a ? 'disabled' : ''} value="${a?.kode || ''}"><small>4 angka. 1 aset, 2 kewajiban, 3 ekuitas, 4 pendapatan, 5 HPP, 6 beban.</small></label>
    <label class="isian"><span>Nama <i>*</i></span><input name="nama" required value="${esc(a?.nama || '')}"></label><label class="isian"><span>Tipe</span><select name="tipe" ${a ? 'disabled' : ''}>${TIPE.map(([k, l]) => `<option value="${k}" ${k === (a?.tipe || 'beban') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${a && !a.sistem ? `<label class="cek"><input type="checkbox" name="aktif" ${a.aktif ? 'checked' : ''}> Aktif</label>` : ''}</form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_akun', { p_kode: f.kode.value, p_nama: f.nama.value, p_tipe: f.tipe.value, p_aktif: f.aktif?.checked ?? true, p_baru: !a }); toast('Tersimpan', 'sukses'); muat(); } }] });
  const muat = async () => {
    try {
      data = await ambilAkun();
      el.innerHTML = judulHalaman('Daftar Akun', 'Akuntansi / Daftar Akun', `<button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>`) + `<div class="kartu">${tabelHtml([{ l: 'Kode', n: r => r.kode }, { l: 'Nama', n: r => r.nama, h: r => `<a href="#/akuntansi/buku_besar/${r.kode}">${esc(r.nama)}</a>` }, { l: 'Tipe', n: r => TIPE.find(t => t[0] === r.tipe)[1] },
        { l: '', n: () => '', h: r => (r.sistem ? '<span class="chip">otomatis</span> ' : '') + (r.aktif ? '' : '<span class="chip">nonaktif</span> ') + (r.kas ? '' : `<button class="ikon-aksi" data-ubah="${r.kode}" title="Ubah">${ikon('ubah')}</button>`) }], data)}</div>`;
    } catch (e) { galat(el, e); }
  };
  el.addEventListener('click', e => { if (e.target.closest('[data-tambah]')) form(); const b = e.target.closest('[data-ubah]'); if (b) form(data.find(a => a.kode === b.dataset.ubah)); });
  await muat();
});

rute('akuntansi/buku_besar', async (el, [kodeAwal] = []) => {
  const bp = await barPeriode('bulan'), ak = await ambilAkun(); let mode = kodeAwal || 'jurnal', data = [], kol = [];
  el.innerHTML = judulHalaman('Buku Besar', 'Akuntansi / Buku Besar', `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>${bisa('akuntansi.kunci') ? '<button class="tombol kedua" data-kunci>Mulai & Kunci Buku</button>' : ''}<button class="tombol" data-baru>${ikon('tambah')} Jurnal Umum</button>`) +
    `<div class="kartu">${bp.html}<div class="alat-tabel"><select class="input" style="width:auto" data-mode><option value="jurnal">Jurnal (semua akun)</option><option value="saldo">Neraca saldo</option>${ak.map(a => `<option value="${a.kode}" ${a.kode === mode ? 'selected' : ''}>${a.kode} ${esc(a.nama)}</option>`).join('')}</select><span data-ket></span></div><div data-isi></div></div>`;
  const isi = el.querySelector('[data-isi]'), ket = el.querySelector('[data-ket]');
  const DK = [{ l: 'Debit', n: r => r.jml > 0 ? r.jml : 0, t: 'uang', jml: true }, { l: 'Kredit', n: r => r.jml < 0 ? -r.jml : 0, t: 'uang', jml: true }];
  const muat = async () => {
    try {
      const n = bp.nilai(); ket.textContent = '';
      if (mode === 'jurnal') {
        data = await rpc('daftar_jurnal', n);
        if (data.length >= 4000) ket.textContent = 'Hanya 4.000 baris terbaru. Persempit tanggal untuk melihat semuanya.';
        kol = [{ l: 'Tanggal', n: r => r.tgl, t: 'tgl' }, { l: 'No.', n: r => r.no }, { l: 'Keterangan', n: r => r.ket }, { l: 'Akun', n: r => r.kode + ' ' + r.nama }, ...DK, { l: '', n: () => '', h: r => r.tabel === 'jurnal_umum' ? `<button class="ikon-aksi hapus" data-batal="${r.id}" title="Batalkan">${ikon('hapus')}</button>` : '' }];
      } else if (mode === 'saldo') {
        data = (await rpc('neraca_saldo', n)).map(r => ({ ...r, akhir: Number(r.awal) + Number(r.debit) - Number(r.kredit) })).filter(r => r.awal || r.debit || r.kredit);
        kol = [{ l: 'Akun', n: r => r.kode + ' ' + r.nama }, { l: 'Saldo awal', n: r => r.awal, t: 'uang', jml: true }, { l: 'Debit', n: r => r.debit, t: 'uang', jml: true }, { l: 'Kredit', n: r => r.kredit, t: 'uang', jml: true }, { l: 'Saldo akhir', n: r => r.akhir, t: 'uang', jml: true }];
        ket.textContent = 'Saldo minus = saldo kredit. Total harus 0.';
      } else {
        const d = await rpc('buku_akun', { p_kode: mode, ...n }); let s = Number(d.awal); data = d.baris.map(r => ({ ...r, saldo: s += Number(r.jml) }));
        if (data.length >= 5000) ket.textContent = 'Data terlalu banyak, persempit tanggal. ';
        ket.textContent += `Saldo awal ${rupiah(d.awal)} · saldo akhir ${rupiah(s)}`;
        kol = [{ l: 'Tanggal', n: r => r.tgl, t: 'tgl' }, { l: 'No.', n: r => r.no }, { l: 'Keterangan', n: r => r.ket }, ...DK, { l: 'Saldo', n: r => r.saldo, t: 'uang' }];
      }
      isi.innerHTML = tabelHtml(kol, data);
    } catch (e) { galat(isi, e); }
  };
  const formJurnal = () => {
    const op = ak.filter(a => a.aktif && !['1201', '2101', '2102', '1301', '1501', '1502'].includes(a.kode)).map(a => `<option value="${a.kode}">${a.kode} ${esc(a.nama)}</option>`).join('');
    const brs = () => `<tr><td><select class="input" data-a><option value="">- akun -</option>${op}</select></td><td><input class="input" type="number" min="0" step="any" data-d></td><td><input class="input" type="number" min="0" step="any" data-k></td></tr>`;
    modal({ judul: 'Jurnal Umum', ukuran: 'besar', isi: `<form onsubmit="return false"><div class="form-grid"><label class="isian"><span>Tanggal</span><input type="date" name="tgl" required max="${hariIni()}" value="${hariIni()}"></label><label class="isian"><span>Keterangan <i>*</i></span><input name="ket" required></label></div>
      <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Akun</th><th>Debit</th><th>Kredit</th></tr></thead><tbody>${brs() + brs()}</tbody></table></div><button type="button" class="tombol kedua kecil" data-brs style="margin-top:8px">+ Baris</button> <b data-sel style="margin-left:12px"></b></form>`,
      saatBuka: m => { m.querySelector('[data-brs]').onclick = () => m.querySelector('tbody').insertAdjacentHTML('beforeend', brs()); m.addEventListener('input', () => { const j = s => [...m.querySelectorAll(s)].reduce((a, i) => a + Number(i.value || 0), 0), x = j('[data-d]') - j('[data-k]'); m.querySelector('[data-sel]').textContent = x ? '⚠ Selisih ' + rupiah(x) : '✓ Seimbang'; }); },
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false;
        const items = [...m.querySelectorAll('tbody tr')].map(t => ({ akun_kode: t.querySelector('[data-a]').value, debit: Number(t.querySelector('[data-d]').value || 0), kredit: Number(t.querySelector('[data-k]').value || 0) }));
        const r = await rpc('simpan_jurnal', { p: { tanggal: f.tgl.value, keterangan: f.ket.value, items } }); toast('Tersimpan: ' + r.no, 'sukses'); muat(); } }] });
  };
  const formKunci = async () => {
    const { data: k } = await sb.from('konfigurasi').select('nilai').eq('kunci', 'akuntansi').maybeSingle();
    modal({ judul: 'Mulai & Kunci Pembukuan', ukuran: 'kecil', isi: `<form onsubmit="return false"><label class="isian"><span>Mulai pembukuan</span><input type="date" name="m" max="${hariIni()}" value="${k?.nilai?.mulai || ''}"><small>Laba rugi dan kas dihitung mulai tanggal ini. Stok, utang, piutang, dan aktiva sebelumnya dibawa sebagai saldo awal. Kosongkan bila semua transaksi dihitung. Catat saldo awal kas lewat Kas Masuk ke Ekuitas Saldo Awal.</small></label><label class="isian"><span>Kunci sampai tanggal</span><input type="date" name="t" max="${geserHari(hariIni(), -1)}" value="${k?.nilai?.kunci_sampai || ''}"><small>Transaksi keuangan sampai tanggal ini tidak bisa ditambah atau dibatalkan. Kosongkan untuk membuka kunci.</small></label></form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { if (!m.querySelector('form').reportValidity()) return false; await rpc('atur_buku', { p_mulai: m.querySelector('[name=m]').value || null, p_kunci: m.querySelector('[name=t]').value || null }); toast('Tersimpan', 'sukses'); muat(); } }] });
  };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), b = q('[data-batal]');
    if (q('[data-baru]')) formJurnal();
    if (q('[data-kunci]')) formKunci();
    if (q('[data-unduh]')) unduhTabel('buku-besar-' + mode, kol, data);
    if (q('[data-cetak]')) cetakHtml('Buku Besar: ' + el.querySelector('[data-mode]').selectedOptions[0].text, bp.teks(), tabelHtml(kol, data, { maks: 5000 }));
    if (b && await konfirmasi('Batalkan jurnal', 'Jurnal ini dihapus dari pembukuan. Lanjutkan?', 'Batalkan')) try { await rpc('batal_keuangan', { p_tabel: 'jurnal_umum', p_id: Number(b.dataset.batal) }); toast('Dibatalkan'); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); }
  });
  el.querySelector('[data-mode]').onchange = e => { mode = e.target.value; muat(); };
  bp.pasang(el, muat); await muat();
});

rute('akuntansi/aktiva', async el => {
  const ks = await akunKas(); let data = [];
  const susut = a => { const akhir = a.tanggal_lepas || geserHari(hariIni(), 1); let n = 0; const [y, b] = a.tanggal.split('-').map(Number); for (let i = 1; i <= a.umur_bulan; i++) { if (new Date(Date.UTC(y, b - 1 + i, 0)).toISOString().slice(0, 10) < akhir) n++; else break; } return Math.round((a.nilai - a.residu) * n / a.umur_bulan); };
  const form = () => modal({ judul: 'Tambah Aktiva Tetap', isi: `<form class="form-grid" onsubmit="return false"><label class="isian lebar"><span>Nama <i>*</i></span><input name="nama" required placeholder="mis. Kulkas obat"></label><label class="isian"><span>Tanggal beli</span><input type="date" name="tanggal" required max="${hariIni()}" value="${hariIni()}"></label><label class="isian"><span>Harga beli <i>*</i></span><input type="number" name="nilai" min="1" step="any" required></label>
    <label class="isian"><span>Nilai sisa di akhir umur</span><input type="number" name="residu" min="0" step="any" value="0" required></label><label class="isian"><span>Umur (bulan) <i>*</i></span><input type="number" name="umur_bulan" min="1" max="600" step="1" required value="48"></label>
    <label class="isian"><span>Dibayar dari</span><select name="akun_kas_id"><option value="">Sudah dimiliki (saldo awal)</option>${opsiKas(ks)}</select></label><label class="isian"><span>Catatan</span><input name="catatan"></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_aktiva', { p: Object.fromEntries(new FormData(f)) }); toast('Tersimpan', 'sukses'); muat(); } }] });
  const lepas = a => modal({ judul: 'Lepas / Jual ' + a.nama, isi: `<form class="form-grid" onsubmit="return false"><label class="isian"><span>Tanggal</span><input type="date" name="t" required min="${a.tanggal}" max="${hariIni()}" value="${hariIni()}"></label><label class="isian"><span>Hasil jual (0 bila rusak/dibuang)</span><input type="number" name="n" min="0" step="any" value="0" required></label><label class="isian"><span>Uang masuk ke</span><select name="k">${opsiKas(ks)}</select></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Lepas', kelas: 'bahaya', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('lepas_aktiva', { p_id: a.id, p_tanggal: f.t.value, p_nilai: Number(f.n.value), p_kas: Number(f.k.value) }); toast('Tersimpan', 'sukses'); muat(); } }] });
  const kol = [{ l: 'Kode', n: r => r.kode }, { l: 'Nama', n: r => r.nama }, { l: 'Tgl Beli', n: r => r.tanggal, t: 'tgl' }, { l: 'Harga Beli', n: r => r.nilai, t: 'uang', jml: true }, { l: 'Umur (bln)', n: r => r.umur_bulan, t: 'angka' }, { l: 'Akum. Susut', n: r => susut(r), t: 'uang', jml: true }, { l: 'Nilai Buku', n: r => r.nilai - susut(r), t: 'uang', jml: true },
    { l: '', n: () => '', h: r => r.status === 'lepas' ? `<span class="chip">Dilepas ${tanggal(r.tanggal_lepas)}</span>` : `<button class="tombol kedua kecil" data-lepas="${r.id}">Lepas</button><button class="ikon-aksi hapus" data-batal="${r.id}" title="Batalkan (salah input)">${ikon('hapus')}</button>` }];
  const muat = async () => {
    try {
      const { data: d, error } = await sb.from('aktiva_tetap').select('*').eq('outlet_id', S.pengguna.outlet_id).neq('status', 'batal').order('tanggal'); if (error) throw error; data = d;
      el.innerHTML = judulHalaman('Aktiva Tetap', 'Akuntansi / Aktiva Tetap', `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>`) + `<div class="kartu"><p class="pesan info" style="margin-top:0">Penyusutan garis lurus, tercatat otomatis tiap akhir bulan mulai bulan pembelian.</p>${tabelHtml(kol, data, { kosong: 'Belum ada aktiva tetap.' })}</div>`;
    } catch (e) { galat(el, e); }
  };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), l = q('[data-lepas]'), b = q('[data-batal]');
    if (q('[data-tambah]')) form(); if (l) lepas(data.find(a => a.id === Number(l.dataset.lepas))); if (q('[data-unduh]')) unduhTabel('aktiva-tetap', kol, data);
    if (b && await konfirmasi('Batalkan aktiva', 'Aktiva dan penyusutannya dihapus dari pembukuan. Lanjutkan?', 'Batalkan')) try { await rpc('batal_keuangan', { p_tabel: 'aktiva_tetap', p_id: Number(b.dataset.batal) }); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); }
  });
  await muat();
});

// ---------- Laporan Keuangan ----------
// d = neraca_saldo. Laba rugi memakai mutasi periode; neraca memakai saldo akhir.
export function labaRugi(d) {
  const mut = r => Number(r.kredit) - Number(r.debit), g = t => d.filter(r => r.tipe === t && mut(r) !== 0);
  const jml = t => g(t).reduce((a, r) => a + mut(r), 0), pend = jml('pendapatan'), hpp = -jml('hpp'), beban = -jml('beban');
  return { pend, hpp, kotor: pend - hpp, beban, bersih: pend - hpp - beban, rinci: { pendapatan: g('pendapatan').map(r => [r, mut(r)]), hpp: g('hpp').map(r => [r, -mut(r)]), beban: g('beban').map(r => [r, -mut(r)]) } };
}
rute('laporan/keuangan', async el => {
  const bp = await barPeriode('bulan'); let mode = 'laba', html = '';
  el.innerHTML = judulHalaman('Laporan Keuangan', 'Laporan / Laporan Keuangan', `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>`) + `<div class="kartu">${bp.html}<div class="alat-tabel"><select class="input" style="width:auto" data-mode><option value="laba">Laba Rugi</option><option value="neraca">Neraca</option><option value="arus">Arus Kas</option></select></div><div data-isi style="max-width:760px"></div></div>`;
  const isi = el.querySelector('[data-isi]'); let rows = [];
  const susun = () => `<div class="bungkus-tabel"><table class="tabel"><tbody>${rows.map(([t, v, g]) => `<tr style="${g ? 'font-weight:800;background:var(--latar)' : ''}"><td style="${g ? '' : 'padding-left:24px'}">${esc(t)}</td><td class="angka">${v === null ? '' : rupiah(v)}</td></tr>`).join('')}</tbody></table></div>`;
  const muat = async () => {
    try {
      const n = bp.nilai(); rows = []; let catatan = '';
      if (mode === 'laba') {
        const l = labaRugi(await rpc('neraca_saldo', n)), isiG = a => a.forEach(([r, v]) => rows.push([r.nama, v]));
        rows.push(['Pendapatan', null, 1]); isiG(l.rinci.pendapatan); rows.push(['Penjualan bersih', l.pend, 1], ['Harga pokok', null, 1]); isiG(l.rinci.hpp); rows.push(['Laba kotor', l.kotor, 1], ['Beban', null, 1]); isiG(l.rinci.beban); rows.push(['Total beban', l.beban, 1], ['Laba bersih', l.bersih, 1]);
        catatan = 'Harga pokok sudah termasuk PPN masukan. MDR QRIS/bank tidak dipotong otomatis: catat lewat Kas Keluar ke akun Beban Admin Bank & MDR.';
      } else if (mode === 'neraca') {
        const d = (await rpc('neraca_saldo', { ...n, p_dari: n.p_sampai })).map(r => ({ ...r, s: Number(r.awal) + Number(r.debit) - Number(r.kredit) }));
        const g = t => d.filter(r => r.tipe === t && r.s !== 0), as = g('aset'), kw = g('kewajiban'), ek = g('ekuitas'), sum = a => a.reduce((x, r) => x + r.s, 0);
        const laba = -sum(d.filter(r => ['pendapatan', 'hpp', 'beban'].includes(r.tipe)));
        rows.push(['Aset', null, 1]); as.forEach(r => rows.push([r.nama, r.s])); rows.push(['Total aset', sum(as), 1], ['Kewajiban', null, 1]); kw.forEach(r => rows.push([r.nama, -r.s])); rows.push(['Total kewajiban', -sum(kw), 1], ['Ekuitas', null, 1]); ek.forEach(r => rows.push([r.nama, -r.s]));
        rows.push(['Laba berjalan & ditahan', laba], ['Total ekuitas', laba - sum(ek), 1], ['Total kewajiban + ekuitas', laba - sum(ek) - sum(kw), 1]);
        catatan = 'Posisi per tanggal akhir periode.';
      } else {
        const a = await rpc('arus_kas', n); let m = 0, k = 0;
        rows.push(['Saldo awal kas & bank', a.awal, 1], ['Uang masuk', null, 1]); a.baris.filter(b => b.masuk > 0).forEach(b => { rows.push([b.kat, b.masuk]); m += Number(b.masuk); });
        rows.push(['Total masuk', m, 1], ['Uang keluar', null, 1]); a.baris.filter(b => b.keluar > 0).forEach(b => { rows.push([b.kat, b.keluar]); k += Number(b.keluar); });
        rows.push(['Total keluar', k, 1], ['Saldo akhir kas & bank', Number(a.awal) + m - k, 1]);
      }
      html = susun(); isi.innerHTML = html + (catatan ? `<p style="color:var(--teks-2);font-size:13px">${esc(catatan)}</p>` : '');
    } catch (e) { galat(isi, e); }
  };
  el.querySelector('[data-mode]').onchange = e => { mode = e.target.value; muat(); };
  el.querySelector('[data-unduh]').onclick = () => unduhTabel('laporan-' + mode, [{ l: 'Uraian', n: r => r[0] }, { l: 'Jumlah', n: r => r[1] ?? '' }], rows);
  el.querySelector('[data-cetak]').onclick = () => cetakHtml(el.querySelector('[data-mode]').selectedOptions[0].text, bp.teks(), html);
  bp.pasang(el, muat); await muat();
});
