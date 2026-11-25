// Laporan penjualan per shift. Tanpa hak nominal (kasir): hanya sesi sendiri dan jumlah transaksi, tanpa rupiah penjualan.
import { rute, S, bisa, lihatNominal } from '../inti.js?v=1.25.0';
import { ikon } from '../menu.js?v=1.25.0';
import { esc, angka, rupiah, tanggal, waktu, toast, modal, pesanGalat, judulHalaman } from '../ui.js?v=1.25.0';
import { rpc, barPeriode, tabelHtml, unduhTabel, cetakHtml, grafikBatang } from '../tabel.js?v=1.25.0';
import { cetakStrukHtml } from '../cetak.js?v=1.25.0';
import { ambilKonfig } from './pengaturan.js?v=1.25.0';

const jml = (a, f) => a.reduce((x, r) => x + Number(r[f] || 0), 0);
const kotak = (l, v, k = '') => `<div class="statistik"><small>${esc(l)}</small><b>${v}</b>${k ? `<small>${k}</small>` : ''}</div>`;
const bar = (a, b) => `<div class="r"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
const selisih = v => v === null || v === undefined ? '-' : `<span class="chip ${Number(v) === 0 ? 'hijau' : 'merah'}">${Number(v) > 0 ? '+' : ''}${rupiah(v)}</span>`;

rute('laporan/shift', async el => {
  const nm = lihatNominal(), lb = nm && bisa('keuangan.laba'), bp = await barPeriode('7'); let d = [], ke = 0, filter = '';
  const kolom = () => [
    { l: 'Tanggal', n: r => r.tgl, t: 'tgl' }, { l: 'Shift', n: r => r.shift, h: r => `<b>${esc(r.shift)}</b>${r.buka ? ' <span class="chip oranye">masih buka</span>' : ''}` }, { l: 'Kasir', n: r => r.kasir || '' },
    { l: 'Nota', n: r => r.trx, t: 'angka', jml: true }, { l: 'Retur', n: r => r.n_retur, t: 'angka', jml: true }, { l: 'Batal', n: r => r.n_batal, t: 'angka', jml: true },
    ...(nm ? [{ l: 'Penjualan', n: r => r.bruto, t: 'uang', jml: true }, { l: 'Nilai retur', n: r => r.retur, t: 'uang', jml: true }, { l: 'Netto', n: r => r.netto, t: 'uang', jml: true }, { l: 'Rata-rata/nota', n: r => Number(r.trx) ? Math.round(r.bruto / r.trx) : 0, t: 'uang' }, ...(lb ? [{ l: 'Laba kotor', n: r => r.laba, t: 'uang', jml: true }] : []), { l: 'Selisih kas', n: r => r.selisih ?? '', h: r => selisih(r.selisih) }] : []),
    { l: '', n: () => '', h: r => `<button class="tombol kedua kecil" data-rinci="${d.indexOf(r)}">Rincian</button>` }];
  const kolomUnduh = () => kolom().filter(k => k.l);
  const tampil = () => d.filter(r => !filter || r.shift === filter);
  el.innerHTML = judulHalaman('Laporan Penjualan per Shift', 'Laporan / Laporan per Shift', `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>`) +
    `<div class="kartu">${bp.html}<div class="alat-tabel"><select class="input" style="width:auto" data-shift aria-label="Shift"><option value="">Semua shift</option></select></div>${nm ? '' : '<p class="pesan info">Menampilkan sesi Anda sendiri. Nilai penjualan hanya bisa dilihat Pemilik/Admin.</p>'}<div data-kotak></div></div>
    ${nm ? '<div class="kartu" data-kg><h3 style="margin-top:0">Perbandingan netto antar shift</h3><div data-grafik></div></div>' : ''}<div class="kartu"><div data-isi></div><p style="color:var(--teks-2);margin-bottom:0">Tanggal mengikuti saat sesi dibuka, jadi shift malam yang lewat tengah malam tetap satu baris. Retur dicatat di shift saat retur dilakukan.</p></div>`;
  const gambar = () => {
    const t = tampil(), n = jml(t, 'trx');
    el.querySelector('[data-kotak]').innerHTML = `<div class="grid-4">${(nm ? [kotak('Netto', rupiah(jml(t, 'netto')), `penjualan ${rupiah(jml(t, 'bruto'))}`), kotak('Nota', angka(n), `rata-rata ${rupiah(n ? jml(t, 'bruto') / n : 0)}`), kotak('Retur', rupiah(jml(t, 'retur')), `${angka(jml(t, 'n_retur'))} retur · ${angka(jml(t, 'n_batal'))} batal`), lb ? kotak('Laba kotor', rupiah(jml(t, 'laba'))) : kotak('Selisih kas', rupiah(jml(t, 'selisih')))] : [kotak('Sesi', angka(jml(t, 'sesi'))), kotak('Nota', angka(n)), kotak('Retur', angka(jml(t, 'n_retur'))), kotak('Batal', angka(jml(t, 'n_batal')))]).join('')}</div>`;
    el.querySelector('[data-isi]').innerHTML = tabelHtml(kolom(), t);
    if (nm) { const g = {}; for (const r of t) g[r.shift] = (g[r.shift] || 0) + Number(r.netto); grafikBatang(el.querySelector('[data-grafik]'), Object.entries(g).map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai)); }
  };
  const muat = async () => {
    const ini = ++ke; el.querySelector('[data-isi]').innerHTML = '<div class="kerangka-muat"><i></i><i></i><i></i></div>';
    try {
      const x = await rpc('lap_shift', bp.nilai()); if (ini !== ke) return; d = x;
      const s = [...new Set(d.map(r => r.shift))]; if (filter && !s.includes(filter)) filter = '';
      el.querySelector('[data-shift]').innerHTML = '<option value="">Semua shift</option>' + s.map(v => `<option ${v === filter ? 'selected' : ''}>${esc(v)}</option>`).join('');
      gambar();
    } catch (e) { if (ini === ke) el.querySelector('[data-isi]').innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; }
  };
  bp.pasang(el, muat);
  el.querySelector('[data-shift]').onchange = e => { filter = e.target.value; gambar(); };
  el.querySelector('[data-unduh]').onclick = () => unduhTabel('laporan-per-shift', kolomUnduh(), tampil());
  el.querySelector('[data-cetak]').onclick = () => cetakHtml('Laporan Penjualan per Shift' + (filter ? ' - ' + filter : ''), bp.teks(), tabelHtml(kolomUnduh(), tampil(), { maks: 5000 }));
  el.addEventListener('click', e => { const b = e.target.closest('[data-rinci]'); if (b) rincian(d[b.dataset.rinci], bp.nilai().p_outlet).catch(x => toast(pesanGalat(x), 'galat')); });
  await muat();
  return 'Laporan per Shift';
});

async function rincian(r, outlet) {
  const x = await rpc('rinci_shift', { p_tgl: r.tgl, p_shift: r.shift, p_outlet: outlet }), nm = x.nominal;
  const uang = l => [{ l, n: y => y.label }, { l: 'Nota', n: y => y.trx, t: 'angka', jml: true }, { l: 'Nilai', n: y => y.netto, t: 'uang', jml: true }];
  const blok = (j, h) => `<div style="margin-top:14px;min-width:0"><h4 style="margin:0 0 6px">${esc(j)}</h4>${h}</div>`;
  const nota = jenis => (x.nota || []).filter(y => y.jenis === jenis);
  const kNota = ket => [{ l: 'No', n: y => y.no }, { l: 'Waktu', n: y => waktu(y.waktu) }, { l: 'Kasir', n: y => y.kasir }, ...(ket ? [{ l: 'Keterangan', n: y => y.ket }] : [{ l: 'Pelanggan', n: y => y.pelanggan || '-' }]), { l: 'Nilai', n: y => y.nilai, t: 'uang', jml: true }];
  const sesi = x.sesi.map(s => { const k = s.ringkasan; return `<div class="kartu-sesi"><b>${esc(s.kode)}</b> · ${esc(s.kasir)} <span class="chip ${s.status === 'buka' ? 'oranye' : ''}">${s.status === 'buka' ? 'Masih buka' : 'Tutup'}</span><br><small>${waktu(s.dibuka)} – ${s.ditutup ? waktu(s.ditutup) : 'sekarang'}</small>
    ${[['Kas awal', s.kas_awal], ...(k ? [['Tunai masuk', k.tunai_masuk], ['Kembalian', -k.kembalian], ['Retur tunai', -k.retur_tunai], ...(Number(k.kas_lain) ? [['Kas lain lewat laci', k.kas_lain]] : []), ['Kas seharusnya', k.kas_sistem]] : []), ['Kas fisik', s.kas_fisik]].filter(([, v]) => v !== null && v !== undefined).map(([l, v]) => `<div class="baris-total"><span>${l}</span><span>${rupiah(v)}</span></div>`).join('')}
    ${nm && s.selisih !== null ? `<div class="baris-total"><span>Selisih</span><span>${selisih(s.selisih)}</span></div>` : ''}${s.catatan ? `<small>Catatan: ${esc(s.catatan)}</small>` : ''}</div>`; }).join('') || '<p class="kosong">Tidak ada sesi.</p>';
  modal({ judul: `${r.shift} · ${tanggal(r.tgl)}`, ukuran: 'besar', isi: `<div class="grid-4">${(nm ? [kotak('Netto', rupiah(r.netto)), kotak('Nota', angka(r.trx)), kotak('Retur', rupiah(r.retur), angka(r.n_retur) + ' retur'), r.laba !== null && r.laba !== undefined ? kotak('Laba kotor', rupiah(r.laba)) : kotak('Batal', angka(r.n_batal))] : [kotak('Nota', angka(r.trx)), kotak('Retur', angka(r.n_retur)), kotak('Batal', angka(r.n_batal))]).join('')}</div>
    <div class="grid-2 rapat">${blok('Per kasir', tabelHtml([{ l: 'Kasir', n: y => y.label }, { l: 'Nota', n: y => y.trx, t: 'angka' }, { l: 'Retur', n: y => y.n_retur, t: 'angka' }, ...(nm ? [{ l: 'Netto', n: y => y.netto, t: 'uang' }] : [])], x.kasir))}
    ${blok('Jam ramai (jumlah nota)', '<div data-jam></div>')}${nm ? blok('Metode bayar', tabelHtml(uang('Metode'), x.metode)) + (x.metode_retur.length ? blok('Uang retur keluar lewat', tabelHtml(uang('Metode'), x.metode_retur)) : '') : ''}</div>
    ${blok('Kas per sesi', `<div class="grid-2 rapat">${sesi}</div>`)}
    ${nm ? blok('15 produk terlaris', tabelHtml([{ l: 'Produk', n: y => y.label }, { l: 'Jumlah', n: y => y.qty, t: 'angka' }, { l: 'Nilai', n: y => y.netto, t: 'uang' }], x.produk)) + blok('Retur', tabelHtml(kNota(true), nota('retur'), { kosong: 'Tidak ada retur.' })) + blok('Batal', tabelHtml(kNota(true), nota('batal'), { kosong: 'Tidak ada nota batal.' })) + blok('Semua nota', tabelHtml(kNota(false), nota('jual'))) : ''}`,
    saatBuka: m => grafikBatang(m.querySelector('[data-jam]'), x.jam.map(j => ({ label: j.label, nilai: Number(j.trx) })), angka, 24),
    tombol: [{ teks: 'Cetak Struk', kelas: 'kedua', aksi: () => { cetakRingkas(r, x); return false; } }, ...(nm ? [{ teks: 'Cetak A4', kelas: 'kedua', aksi: () => { cetakA4(r, x, uang, kNota, nota); return false; } }] : []), { teks: 'Tutup' }] });
}
async function cetakRingkas(r, x) {
  const k = await ambilKonfig(), nm = x.nominal;
  cetakStrukHtml(`<div class="c"><b>${esc(S.outlet?.nama || 'Apotek Salam')}</b><br>LAPORAN SHIFT</div><hr>${bar('Shift', r.shift)}${bar('Tanggal', tanggal(r.tgl))}${bar('Dicetak', waktu(new Date()))}<hr>
    ${bar('Nota', angka(r.trx))}${bar('Retur', angka(r.n_retur))}${bar('Batal', angka(r.n_batal))}${nm ? bar('Penjualan', rupiah(r.bruto)) + bar('Nilai retur', '-' + rupiah(r.retur)) + `<div class="r besar"><span>NETTO</span><span>${rupiah(r.netto)}</span></div><hr>` + x.metode.map(y => bar(y.label, rupiah(y.netto))).join('') : ''}
    ${x.sesi.map(s => `<hr><b>${esc(s.kode)} ${esc(s.kasir)}</b>${bar('Kas awal', rupiah(s.kas_awal))}${s.ringkasan ? bar('Kas seharusnya', rupiah(s.ringkasan.kas_sistem)) : ''}${s.kas_fisik !== null ? bar('Kas fisik', rupiah(s.kas_fisik)) : ''}${nm && s.selisih !== null ? bar('Selisih', rupiah(s.selisih)) : ''}`).join('')}<hr>
    <div style="display:flex;justify-content:space-around;text-align:center"><span>Serah<br><br><br>(..........)</span><span>Terima<br><br><br>(..........)</span></div>`, 'Shift ' + r.shift, k.struk.lebar || '80');
}
function cetakA4(r, x, uang, kNota, nota) {
  cetakHtml(`Laporan Shift ${r.shift}`, tanggal(r.tgl), `<p>Nota ${angka(r.trx)} · Penjualan ${rupiah(r.bruto)} · Retur ${rupiah(r.retur)} · <b>Netto ${rupiah(r.netto)}</b></p><h3>Metode bayar</h3>${tabelHtml(uang('Metode'), x.metode)}
    <h3>Kas per sesi</h3>${tabelHtml([{ l: 'Sesi', n: s => s.kode }, { l: 'Kasir', n: s => s.kasir }, { l: 'Kas awal', n: s => s.kas_awal, t: 'uang' }, { l: 'Kas seharusnya', n: s => s.ringkasan?.kas_sistem, t: 'uang' }, { l: 'Kas fisik', n: s => s.kas_fisik, t: 'uang' }, { l: 'Selisih', n: s => s.selisih, t: 'uang' }], x.sesi)}
    <h3>Retur</h3>${tabelHtml(kNota(true), nota('retur'), { kosong: 'Tidak ada.' })}<h3>Nota</h3>${tabelHtml(kNota(false), nota('jual'), { maks: 2000 })}<p style="margin-top:30px">Diserahkan: ____________________ &nbsp;&nbsp;&nbsp; Diterima: ____________________</p>`);
}
