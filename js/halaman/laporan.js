// Dashboard, Laporan (penjualan, pembelian, persediaan), Analisis (pareto, pembelian, harga).
import { rute, S, bisa } from '../inti.js?v=1.10.0';
import { ikon } from '../menu.js?v=1.10.0';
import { esc, angka, rupiah, tanggal, pesanGalat, judulHalaman } from '../ui.js?v=1.10.0';
import { rpc, hariIni, geserHari, barPeriode, tabelHtml, halamanLaporan, grafikBatang, grafikGaris, isiHari } from '../tabel.js?v=1.10.0';
import { GOLONGAN } from './master.js?v=1.10.0';
import { labaRugi } from './akuntansi.js?v=1.10.0';
import { ambilKonfig } from './pengaturan.js?v=1.10.0';

const laba = () => bisa('keuangan.laba');
const jml = (a, f) => a.reduce((x, r) => x + Number(r[f] || 0), 0);
const namaGol = g => (GOLONGAN.find(x => x[0] === g) || [, g])[1];
const kLaba = () => laba() ? [{ l: 'HPP', n: r => r.hpp, t: 'uang', jml: true }, { l: 'Laba Kotor', n: r => r.laba, t: 'uang', jml: true }, { l: 'Margin', n: r => Number(r.netto) ? Math.round(r.laba / r.netto * 1000) / 10 : null, t: 'persen' }] : [];

// ================= Laporan Penjualan =================
const KEL = [['hari', 'Per hari', 'Tanggal'], ['bulan', 'Per bulan', 'Bulan'], ['jam', 'Per jam', 'Jam'], ['kasir', 'Per kasir', 'Kasir'], ['shift', 'Per shift', 'Shift'], ['pelanggan', 'Per pelanggan', 'Pelanggan'], ['dokter', 'Per dokter', 'Dokter'], ['sales', 'Per sales/pelayan', 'Sales'], ['pelayanan', 'Per jenis pelayanan', 'Pelayanan']];
const ITEM = [['produk', 'Per produk', 'Produk'], ['kategori', 'Per kategori', 'Kategori'], ['golongan', 'Per golongan', 'Golongan']];
const jual = k => p => rpc('lap_penjualan', { ...p, p_kelompok: k });
const label = (k, v) => k === 'hari' ? tanggal(v) : k === 'golongan' ? namaGol(v) : v;
rute('laporan/penjualan', halamanLaporan({ judul: 'Laporan Penjualan', remah: 'Laporan / Laporan Penjualan', tab: [
  ...KEL.map(([k, l, h]) => ({ k, l, muat: jual(k), kolom: () => [{ l: h, n: r => label(k, r.label) }, { l: 'Transaksi', n: r => r.trx, t: 'angka', jml: true }, { l: 'Penjualan', n: r => r.bruto, t: 'uang', jml: true }, { l: 'Retur', n: r => r.retur, t: 'uang', jml: true }, { l: 'Netto', n: r => r.netto, t: 'uang', jml: true }, ...kLaba()],
    grafik: (g, d) => ['hari', 'bulan', 'jam'].includes(k) ? grafikGaris(g, d.map(r => ({ label: label(k, r.label), nilai: Number(r.netto) }))) : grafikBatang(g, [...d].sort((a, b) => b.netto - a.netto).map(r => ({ label: r.label, nilai: Number(r.netto) }))) })),
  ...ITEM.map(([k, l, h]) => ({ k, l, muat: jual(k), ket: 'Setelah diskon dan retur; belum termasuk jasa dan pembulatan.', kolom: () => [...(k === 'produk' ? [{ l: 'Kode', n: r => r.kode }] : []), { l: h, n: r => label(k, r.label) }, { l: 'Transaksi', n: r => r.trx, t: 'angka' }, { l: 'Jumlah', n: r => r.qty, t: 'angka' }, { l: 'Netto', n: r => r.netto, t: 'uang', jml: true }, ...kLaba()],
    grafik: (g, d) => grafikBatang(g, d.map(r => ({ label: label(k, r.label), nilai: Number(r.netto) }))) })),
  { k: 'metode', l: 'Per metode bayar', muat: jual('metode'), ket: 'Uang diterima saat transaksi, sebelum retur.', kolom: [{ l: 'Metode', n: r => r.label }, { l: 'Transaksi', n: r => r.trx, t: 'angka' }, { l: 'Jumlah', n: r => r.netto, t: 'uang', jml: true }], grafik: (g, d) => grafikBatang(g, d.map(r => ({ label: r.label, nilai: Number(r.netto) }))) },
] }));

// ================= Laporan Pembelian =================
const beli = k => p => rpc('lap_pembelian', { ...p, p_kelompok: k });
const kBeli = h => [{ l: h, n: r => r.label }, { l: 'Faktur', n: r => r.faktur, t: 'angka', jml: true }, { l: 'Pembelian', n: r => r.total, t: 'uang', jml: true }, { l: 'PPN', n: r => r.ppn, t: 'uang', jml: true }, { l: 'Retur', n: r => r.retur, t: 'uang', jml: true }, { l: 'Netto', n: r => r.netto, t: 'uang', jml: true }];
rute('laporan/pembelian', halamanLaporan({ judul: 'Laporan Pembelian', remah: 'Laporan / Laporan Pembelian', tab: [
  ...[['supplier', 'Per supplier', 'Supplier'], ['hari', 'Per tanggal faktur', 'Tanggal'], ['bulan', 'Per bulan', 'Bulan'], ['faktur', 'Per faktur', 'No. Faktur']].map(([k, l, h]) => ({ k, l, muat: beli(k), kolom: kBeli(h).map((c, i) => i || k !== 'hari' ? c : { ...c, n: r => tanggal(r.label) }), grafik: k === 'supplier' ? (g, d) => grafikBatang(g, [...d].sort((a, b) => b.netto - a.netto).map(r => ({ label: r.label, nilai: Number(r.netto) }))) : null })),
  { k: 'produk', l: 'Per produk', muat: beli('produk'), ket: 'Nilai = HPP termasuk PPN.', kolom: [{ l: 'Produk', n: r => r.label }, { l: 'Faktur', n: r => r.faktur, t: 'angka' }, { l: 'Jumlah', n: r => r.qty, t: 'angka' }, { l: 'Nilai', n: r => r.total, t: 'uang', jml: true }, { l: 'HPP terakhir', n: r => r.terakhir, t: 'uang' }] },
] }));

// ================= Laporan Persediaan =================
const stok = p => rpc('lap_persediaan', p);
const kStok = [{ l: 'Kode', n: r => r.kode }, { l: 'Produk', n: r => r.label }, { l: 'Kategori', n: r => r.kategori }];
rute('laporan/persediaan', halamanLaporan({ judul: 'Laporan Persediaan', remah: 'Laporan / Laporan Persediaan', tab: [
  { k: 'nilai', l: 'Nilai stok saat ini', muat: async p => (await stok(p)).filter(r => Number(r.stok) !== 0), ket: 'Posisi sekarang. Barang titipan tidak dihitung nilainya.', kolom: [...kStok, { l: 'Stok', n: r => r.stok, t: 'angka' }, { l: 'Satuan', n: r => r.satuan }, { l: 'Titipan', n: r => r.titipan, t: 'angka' }, { l: 'Nilai (HPP)', n: r => r.nilai, t: 'uang', jml: true }] },
  { k: 'mutasi', l: 'Mutasi stok periode', muat: async p => (await stok(p)).filter(r => Number(r.awal) || Number(r.masuk) || Number(r.keluar)), kolom: [...kStok, { l: 'Awal', n: r => r.awal, t: 'angka' }, { l: 'Masuk', n: r => r.masuk, t: 'angka' }, { l: 'Keluar', n: r => r.keluar, t: 'angka' }, { l: 'Akhir', n: r => r.akhir, t: 'angka' }, { l: 'Satuan', n: r => r.satuan }] },
  { k: 'ed', l: 'Urut kedaluwarsa', muat: async p => (await stok(p)).filter(r => r.ed && Number(r.stok) > 0).sort((a, b) => a.ed < b.ed ? -1 : 1), kolom: [...kStok, { l: 'ED terdekat', n: r => r.ed, t: 'tgl' }, { l: 'Stok', n: r => r.stok, t: 'angka' }, { l: 'Nilai', n: r => r.nilai, t: 'uang', jml: true }] },
  { k: 'mati', l: 'Tidak terjual di periode', muat: async p => (await stok(p)).filter(r => Number(r.stok) > 0 && Number(r.terjual) <= 0).sort((a, b) => b.nilai - a.nilai), kolom: [...kStok, { l: 'Stok', n: r => r.stok, t: 'angka' }, { l: 'Nilai', n: r => r.nilai, t: 'uang', jml: true }, { l: 'Terakhir terjual', n: r => r.jual_akhir ? tanggal(r.jual_akhir) : 'Belum pernah' }] },
] }));

// ================= Analisis =================
rute('analisis/pareto', halamanLaporan({ judul: 'Analisis Pareto (ABC)', remah: 'Analisis / Pareto', periode: '90', tab: [['netto', 'Berdasarkan omzet'], ['qty', 'Berdasarkan jumlah'], ...[['laba', 'Berdasarkan laba']]].map(([f, l]) => ({ k: f, l, ket: 'A = penyumbang 80% pertama, B = 15% berikutnya, C = sisanya.', muat: async p => {
  if (f === 'laba' && !laba()) throw new Error('Analisis laba perlu akses Laba & HPP');
  const d = (await rpc('lap_penjualan', { ...p, p_kelompok: 'produk' })).filter(r => Number(r[f]) > 0).sort((a, b) => b[f] - a[f]), t = jml(d, f); let k = 0;
  return d.map(r => { const sebelum = k / t; k += Number(r[f]); return { ...r, porsi: Math.round(r[f] / t * 1000) / 10, kum: Math.round(k / t * 1000) / 10, kelas: sebelum < .8 ? 'A' : sebelum < .95 ? 'B' : 'C' }; });
}, kolom: [{ l: 'Kelas', n: r => r.kelas, h: r => `<span class="chip ${{ A: 'hijau', B: 'oranye', C: '' }[r.kelas]}">${r.kelas}</span>` }, { l: 'Produk', n: r => r.label }, { l: 'Jumlah', n: r => r.qty, t: 'angka' }, { l: f === 'laba' ? 'Laba' : 'Omzet', n: r => r[f === 'laba' ? 'laba' : 'netto'], t: 'uang', jml: true }, { l: 'Porsi', n: r => r.porsi, t: 'persen' }, { l: 'Kumulatif', n: r => r.kum, t: 'persen' }] })) }));

rute('analisis/pembelian', halamanLaporan({ judul: 'Analisis Pembelian', remah: 'Analisis / Pembelian', periode: '90', tab: [
  { k: 'saran', l: 'Saran order', ket: 'Kebutuhan 30 hari dari rata-rata penjualan di periode, dikurangi stok (atau sampai stok maksimum bila diisi).', muat: async p => {
    const hari = Math.round((new Date(p.p_sampai) - new Date(p.p_dari)) / 864e5) + 1;
    return (await stok(p)).map(r => { const rata = Math.max(0, r.terjual) / hari, target = Number(r.stok_maks) > 0 ? Number(r.stok_maks) : Math.max(rata * 30, Number(r.stok_min)); return { ...r, rata: Math.round(rata * 100) / 100, cukup: rata > 0 ? Math.floor(Math.max(0, r.stok) / rata) : null, saran: Math.ceil(Math.max(0, target - r.stok)) }; })
      .filter(r => r.saran > 0 && (r.rata > 0 || Number(r.stok_min) > 0) && (r.stok <= r.stok_min || (r.cukup !== null && r.cukup < 14))).sort((a, b) => (a.cukup ?? 999) - (b.cukup ?? 999));
  }, kolom: [...kStok.slice(0, 2), { l: 'Stok', n: r => r.stok, t: 'angka' }, { l: 'Terjual/hari', n: r => r.rata, t: 'angka' }, { l: 'Cukup (hari)', n: r => r.cukup, t: 'angka' }, { l: 'Saran order', n: r => r.saran, t: 'angka' }, { l: 'Satuan', n: r => r.satuan }] },
  { k: 'harga', l: 'Bandingkan harga supplier', muat: async p => { const d = await rpc('lap_pembelian', { ...p, p_kelompok: 'harga' }), m = {}; for (const r of d) m[r.produk_id] = Math.min(m[r.produk_id] ?? Infinity, r.terakhir); return d.map(r => ({ ...r, murah: Number(r.terakhir) === m[r.produk_id] })); }, ket: 'HPP per satuan dasar, termasuk PPN, diskon, dan bonus.',
    kolom: [{ l: 'Produk', n: r => r.label }, { l: 'Supplier', n: r => r.supplier }, { l: 'Harga terakhir', n: r => r.terakhir, t: 'uang' }, { l: '', n: r => r.murah ? 'Termurah' : '', h: r => r.murah ? '<span class="chip hijau">✓ Termurah</span>' : '' }, { l: 'Termurah', n: r => r.termurah, t: 'uang' }, { l: 'Termahal', n: r => r.termahal, t: 'uang' }, { l: 'Beli terakhir', n: r => r.tgl, t: 'tgl' }, { l: 'Jumlah', n: r => r.qty, t: 'angka' }] },
] }));

rute('analisis/harga', halamanLaporan({ judul: 'Analisis Harga', remah: 'Analisis / Harga', tab: [
  { k: 'margin', l: 'Margin terendah', ket: 'Margin = (jual - beli) / beli, beli sudah termasuk PPN. Posisi sekarang, tanggal tidak berpengaruh.' }, { k: 'naik', l: 'Harga beli naik', ket: 'Dibanding pembelian sebelumnya.' }].map(t => ({ ...t, muat: async p => {
    const [d, k] = await Promise.all([rpc('analisis_harga', { p_outlet: p.p_outlet }), ambilKonfig()]), s = Number(k.persediaan.margin_saran_persen || 20);
    const r = d.map(x => ({ ...x, saran: x.harga_beli > 0 ? Math.ceil(x.harga_beli * (1 + s / 100) / 100) * 100 : null }));
    return t.k === 'naik' ? r.filter(x => Number(x.naik) > 0).sort((a, b) => b.naik - a.naik) : r.filter(x => x.margin !== null);
  }, kolom: [{ l: 'Kode', n: r => r.kode }, { l: 'Produk', n: r => r.label }, { l: 'Beli sebelumnya', n: r => r.beli_lalu, t: 'uang' }, { l: 'Harga beli', n: r => r.harga_beli, t: 'uang' }, { l: 'Naik', n: r => r.naik, t: 'persen' }, { l: 'Harga jual', n: r => r.harga_jual, t: 'uang' }, { l: 'Margin', n: r => r.margin, t: 'persen' }, { l: 'Saran harga', n: r => r.saran, t: 'uang' }] })) }));

// ================= Dashboard =================
const kotak = (l, v, ket = '') => `<div class="statistik"><small>${esc(l)}</small><b>${v}</b>${ket ? `<small>${ket}</small>` : ''}</div>`;
const banding = (a, b) => !b ? '' : (a >= b ? '▲ ' : '▼ ') + angka(Math.round(Math.abs(a - b) / Math.abs(b) * 1000) / 10) + '% dari periode sebelumnya';
const kartu = (judul, k) => `<div class="kartu" style="margin:0;min-width:0"><h3 style="margin-top:0">${esc(judul)}</h3><div data-g="${k}">Memuat...</div></div>`;
function dashboard(judul, isi) {
  return async el => {
    const bp = await barPeriode('bulan'); let ke = 0;
    el.innerHTML = judulHalaman(judul, 'Dashboard / ' + judul) + `<div class="kartu" style="margin-bottom:14px">${bp.html}</div><div data-isi></div>`;
    const muat = async () => {
      const ini = ++ke, w = document.createElement('div'); w.innerHTML = '<p class="kosong">Memuat...</p>'; el.querySelector('[data-isi]').replaceChildren(w);
      try { const r = await isi(bp.nilai()); if (ini !== ke) return; w.innerHTML = `<div class="kartu" style="margin-bottom:16px"><div class="grid-4">${r.kotak.join("")}</div></div><div class="grid-2 rapat">${r.kartu.map(([j], i) => kartu(j, i)).join('')}</div>`; r.kartu.forEach(([, f], i) => f(w.querySelector(`[data-g="${i}"]`))); }
      catch (e) { if (ini === ke) w.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; }
    };
    bp.pasang(el, muat); await muat();
  };
}
const lalu = p => { const n = Math.round((new Date(p.p_sampai) - new Date(p.p_dari)) / 864e5) + 1; return { ...p, p_dari: geserHari(p.p_dari, -n), p_sampai: geserHari(p.p_dari, -1) }; };
const kJual = (d, l) => { const o = jml(d, 'netto'), t = jml(d, 'trx'); return [kotak('Penjualan bersih', rupiah(o), banding(o, jml(l, 'netto'))), kotak('Transaksi', angka(t), banding(t, jml(l, 'trx'))), kotak('Rata-rata per transaksi', rupiah(t ? o / t : 0)), ...(laba() ? [kotak('Laba kotor', rupiah(jml(d, 'laba')), o ? `margin ${angka(Math.round(jml(d, 'laba') / o * 1000) / 10)}% dari penjualan` : '')] : [kotak('Retur', rupiah(jml(d, 'retur')))])]; };
const garis = (p, d, f = 'netto') => g => grafikGaris(g, isiHari(p.p_dari, p.p_sampai, d, f));
const batang = (d, f = 'netto', k) => g => grafikBatang(g, [...d].sort((a, b) => b[f] - a[f]).map(r => ({ label: k ? label(k, r.label) : r.label, nilai: Number(r[f]) })), f === 'qty' || f === 'trx' ? angka : rupiah);
const pj = (p, k) => rpc('lap_penjualan', { ...p, p_kelompok: k });

rute('dashboard/umum', dashboard('Dashboard Umum', async p => {
  const [d, l, pr, b, s] = await Promise.all([pj(p, 'hari'), pj(lalu(p), 'hari'), pj(p, 'produk'), rpc('lap_pembelian', { ...p, p_kelompok: 'total' }), stok(p)]);
  return { kotak: [...kJual(d, l), kotak('Pembelian bersih', rupiah(jml(b, 'netto'))), kotak('Nilai stok', rupiah(jml(s, 'nilai'))), kotak('Produk habis', angka(s.filter(r => Number(r.stok) <= 0).length)), kotak('⚠ Stok menipis', angka(s.filter(r => Number(r.stok_min) > 0 && Number(r.stok) > 0 && Number(r.stok) <= Number(r.stok_min)).length))],
    kartu: [['Penjualan harian', garis(p, d)], ['10 produk terlaris (omzet)', batang(pr)], ...(laba() ? [['Laba kotor harian', garis(p, d, 'laba')]] : [])] };
}));
rute('dashboard/penjualan', dashboard('Dashboard Penjualan', async p => {
  const [d, l, pr, jam, ks, mt, kt] = await Promise.all([pj(p, 'hari'), pj(lalu(p), 'hari'), pj(p, 'produk'), pj(p, 'jam'), pj(p, 'kasir'), pj(p, 'metode'), pj(p, 'kategori')]);
  return { kotak: kJual(d, l), kartu: [['Penjualan harian', garis(p, d)], ['Transaksi per jam', g => grafikBatang(g, jam.filter(r => r.trx > 0).map(r => ({ label: r.label, nilai: Number(r.trx) })), angka, 24)], ['10 produk terlaris (omzet)', batang(pr)], ['Per kategori', batang(kt)], ['Per kasir', batang(ks)], ['Per metode bayar', batang(mt)]] };
}));
rute('dashboard/pembelian', dashboard('Dashboard Pembelian', async p => {
  const [d, l, sp, pr] = await Promise.all([rpc('lap_pembelian', { ...p, p_kelompok: 'hari' }), rpc('lap_pembelian', { ...lalu(p), p_kelompok: 'hari' }), rpc('lap_pembelian', { ...p, p_kelompok: 'supplier' }), rpc('lap_pembelian', { ...p, p_kelompok: 'produk' })]);
  return { kotak: [kotak('Pembelian bersih', rupiah(jml(d, 'netto')), banding(jml(d, 'netto'), jml(l, 'netto'))), kotak('Faktur', angka(jml(d, 'faktur'))), kotak('PPN', rupiah(jml(d, 'ppn'))), kotak('Retur', rupiah(jml(d, 'retur')))], kartu: [['Pembelian harian', garis(p, d)], ['Per supplier', batang(sp)], ['10 produk terbesar', batang(pr, 'total')]] };
}));
rute('dashboard/persediaan', dashboard('Dashboard Persediaan', async p => {
  const s = await stok(p), h = hariIni(), b90 = geserHari(h, 90), ada = s.filter(r => Number(r.stok) > 0), kat = {};
  for (const r of ada) kat[r.kategori || 'Tanpa kategori'] = (kat[r.kategori || 'Tanpa kategori'] || 0) + Number(r.nilai);
  return { kotak: [kotak('Nilai stok', rupiah(jml(s, 'nilai'))), kotak('Produk berstok', angka(ada.length)), kotak('⚠ Sudah kedaluwarsa', angka(ada.filter(r => r.ed && r.ed < h).length)), kotak('⚠ ED ≤ 90 hari', angka(ada.filter(r => r.ed && r.ed >= h && r.ed <= b90).length))],
    kartu: [['Nilai stok per kategori', batang(Object.entries(kat).map(([l, v]) => ({ label: l, netto: v })))], ['10 produk nilai stok terbesar', batang(ada, 'nilai')], ['Tidak terjual di periode (nilai stok)', batang(ada.filter(r => Number(r.terjual) <= 0), 'nilai')]] };
}));
rute('dashboard/keuangan', dashboard('Dashboard Keuangan', async p => {
  const aman = f => f.catch(() => null);
  const [n, ak, kas, u, pi] = await Promise.all([rpc('neraca_saldo', p), rpc('arus_kas', p), aman(rpc('saldo_kas')), aman(rpc('daftar_utang', { p_outlet: p.p_outlet })), aman(rpc('daftar_piutang', { p_outlet: p.p_outlet }))]);
  const l = labaRugi(n), h = hariIni(), jt = (a, f) => jml((a || []).filter(f), 'sisa');
  return { kotak: [kotak('Penjualan bersih', rupiah(l.pend)), kotak('Laba kotor', rupiah(l.kotor)), kotak('Beban', rupiah(l.beban)), kotak('Laba bersih', rupiah(l.bersih)), ...(kas ? [kotak('Kas & bank', rupiah(jml(kas, 'saldo')))] : []), ...(u ? [kotak('Utang usaha', rupiah(jml(u.utang, 'sisa')), '⚠ lewat tempo ' + rupiah(jt(u.utang, x => x.jatuh_tempo && x.jatuh_tempo < h)))] : []), ...(pi ? [kotak('Piutang usaha', rupiah(jml(pi, 'sisa')), '⚠ lewat tempo ' + rupiah(jt(pi, x => x.jatuh_tempo && x.jatuh_tempo < h)))] : [])],
    kartu: [['Beban terbesar', g => grafikBatang(g, l.rinci.beban.sort((a, b) => b[1] - a[1]).map(([r, v]) => ({ label: r.nama, nilai: v })))], ['Uang masuk', g => grafikBatang(g, ak.baris.filter(b => b.masuk > 0).map(b => ({ label: b.kat, nilai: Number(b.masuk) })))], ['Uang keluar', g => grafikBatang(g, ak.baris.filter(b => b.keluar > 0).map(b => ({ label: b.kat, nilai: Number(b.keluar) })))], ...(u ? [['Utang jatuh tempo terdekat', g => { g.innerHTML = tabelHtml([{ l: 'Supplier', n: r => r.supplier }, { l: 'Jatuh tempo', n: r => r.jatuh_tempo, t: 'tgl' }, { l: 'Sisa', n: r => r.sisa, t: 'uang' }], u.utang.slice(0, 8), { kosong: 'Tidak ada utang.' }); }]] : [])] };
}));
