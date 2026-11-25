// Bantuan laporan: periode, tabel + unduh + cetak, grafik satu warna dengan tooltip.
import { sb, S, bisa, ambilRef } from './inti.js?v=1.18.1';
import { ikon } from './menu.js?v=1.18.1';
import { esc, angka, rupiah, tanggal, toast, pesanGalat, judulHalaman, unduhCSV } from './ui.js?v=1.18.1';
import { cetakKertasBiasa } from './cetak.js?v=1.18.1';

export const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const geserHari = (t, n) => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const awalBulan = (t = hariIni()) => t.slice(0, 8) + '01';
const bulanLalu = () => { const akhir = geserHari(awalBulan(), -1); return [awalBulan(akhir), akhir]; };
export const PERIODE = { hari: ['Hari ini', () => [hariIni(), hariIni()]], '7': ['7 hari', () => [geserHari(hariIni(), -6), hariIni()]], bulan: ['Bulan ini', () => [awalBulan(), hariIni()]],
  lalu: ['Bulan lalu', bulanLalu], '90': ['90 hari', () => [geserHari(hariIni(), -89), hariIni()]], tahun: ['Tahun ini', () => [hariIni().slice(0, 4) + '-01-01', hariIni()]] };

export async function rpc(nama, p) { const { data, error } = await sb.rpc(nama, p); if (error) throw error; return data; }

// Bar periode + outlet. Mengembalikan { html, pasang(el, ubah), nilai() }
export async function barPeriode(bawaan = 'bulan', denganTanggal = true) {
  const outlet = bisa('outlet.daftar') ? await ambilRef('outlet') : [];
  const st = { p: bawaan, rentang: PERIODE[bawaan][1](), outlet: null };
  return {
    html: `<div class="alat-tabel" data-bar>${denganTanggal ? `<select class="input" style="width:auto" data-per>${Object.entries(PERIODE).map(([k, v]) => `<option value="${k}" ${k === bawaan ? 'selected' : ''}>${v[0]}</option>`).join('')}<option value="atur">Atur tanggal</option></select>
      <input type="date" class="input" style="width:auto" data-dari value="${st.rentang[0]}" aria-label="Dari tanggal"><input type="date" class="input" style="width:auto" data-sampai value="${st.rentang[1]}" aria-label="Sampai tanggal">` : ''}
      ${outlet.length > 1 ? `<select class="input" style="width:auto" data-outlet>${outlet.map(o => `<option value="${o.id}" ${o.id === S.pengguna.outlet_id ? 'selected' : ''}>${esc(o.nama)}</option>`).join('')}<option value="-1">Semua outlet</option></select>` : ''}</div>`,
    pasang(el, ubah) {
      const q = s => el.querySelector(s);
      if (q('[data-per]')) {
        q('[data-per]').onchange = e => { if (e.target.value === 'atur') return; st.rentang = PERIODE[e.target.value][1](); q('[data-dari]').value = st.rentang[0]; q('[data-sampai]').value = st.rentang[1]; ubah(); };
        q('[data-dari]').onchange = q('[data-sampai]').onchange = () => {
          const a = q('[data-dari]').value, b = q('[data-sampai]').value;
          if (!a || !b) return; if (a > b) return toast('Tanggal awal melewati tanggal akhir', 'galat');
          st.rentang = [a, b]; q('[data-per]').value = 'atur'; ubah();
        };
      }
      if (q('[data-outlet]')) q('[data-outlet]').onchange = e => { st.outlet = Number(e.target.value); ubah(); };
    },
    nilai: () => ({ p_dari: st.rentang[0], p_sampai: st.rentang[1], p_outlet: st.outlet }),
    teks: () => st.rentang[0] === st.rentang[1] ? tanggal(st.rentang[0]) : `${tanggal(st.rentang[0])} s.d. ${tanggal(st.rentang[1])}`,
  };
}

// kolom: { l, n(r), t: 'uang'|'angka'|'persen'|'tgl'|undefined, jml: true, h(r) html }
const tampil = (k, r) => { if (k.h) return k.h(r); const v = k.n(r); if (v === null || v === undefined || v === '') return ''; return k.t === 'uang' ? rupiah(v) : k.t === 'angka' ? angka(v) : k.t === 'persen' ? angka(v) + '%' : k.t === 'tgl' ? tanggal(v) : esc(v); };
const kanan = k => ['uang', 'angka', 'persen'].includes(k.t) ? 'angka' : '';
export function tabelHtml(kolom, baris, { maks = 500, kosong = 'Tidak ada data pada periode ini.' } = {}) {
  const total = kolom.some(k => k.jml) && baris.length ? `<tr style="font-weight:800;background:var(--latar)">${kolom.map((k, i) => `<td data-label="${esc(k.l)}" class="${kanan(k)}">${i === 0 ? 'Total' : k.jml ? (k.t === 'uang' ? rupiah : angka)(baris.reduce((a, r) => a + Number(k.n(r) || 0), 0)) : ''}</td>`).join('')}</tr>` : '';
  return `<div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr>${kolom.map(k => `<th class="${kanan(k)}">${esc(k.l)}</th>`).join('')}</tr></thead><tbody>${baris.length
    ? baris.slice(0, maks).map(r => `<tr>${kolom.map(k => `<td data-label="${esc(k.l)}" class="${kanan(k)}">${tampil(k, r)}</td>`).join('')}</tr>`).join('') + total : `<tr><td class="kosong" colspan="99">${kosong}</td></tr>`}</tbody></table></div>
    ${baris.length > maks ? `<p style="color:var(--teks-2)">Ditampilkan ${maks} dari ${angka(baris.length)} baris. Unduh untuk semua data.</p>` : ''}`;
}
export function unduhTabel(nama, kolom, baris) { unduhCSV(nama, kolom.filter(k => k.l).map(k => ({ label: k.l, nilai: k.n })), baris); }
export const CSS_A4 = `body{font:11px Arial;color:#000}h2,h3{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #bbb;padding:3px 5px;text-align:left}.angka{text-align:right}.ikon-aksi,button,svg{display:none}thead{display:table-header-group}`;
export function cetakHtml(judul, sub, html) { cetakKertasBiasa(`<h2>${esc(S.outlet?.nama || 'Apotek Salam')}</h2><h3>${esc(judul)}</h3><div>${esc(sub)}</div>${html}`, CSS_A4, judul, 'A4'); }

// Halaman laporan dengan beberapa tab
export function halamanLaporan({ judul, remah, periode = 'bulan', tab }) {
  return async (el, [awal] = []) => {
    const bp = await barPeriode(periode); let kini = tab.find(t => t.k === awal) || tab[0], data = [], kol = [], ke = 0;
    el.innerHTML = judulHalaman(judul, remah, `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>`) +
      `<div class="kartu">${bp.html}<div class="alat-tabel">${tab.length > 1 ? `<select class="input" style="width:auto" data-tab>${tab.map(t => `<option value="${t.k}" ${t === kini ? 'selected' : ''}>${esc(t.l)}</option>`).join('')}</select>` : ''}<span style="color:var(--teks-2)" data-ket></span></div><div data-grafik></div><div data-isi></div></div>`;
    const muat = async () => {
      const ini = ++ke, isi = el.querySelector('[data-isi]'); isi.innerHTML = '<div class="kerangka-muat"><i></i><i></i><i></i><i></i></div>'; el.querySelector('[data-grafik]').innerHTML = '';
      try {
        const d = await kini.muat(bp.nilai()); if (ini !== ke) return;
        data = d; kol = typeof kini.kolom === 'function' ? kini.kolom(d) : kini.kolom;
        el.querySelector('[data-ket]').textContent = kini.ket || '';
        isi.innerHTML = tabelHtml(kol, data);
        if (kini.grafik && data.length) kini.grafik(el.querySelector('[data-grafik]'), data);
      } catch (e) { if (ini === ke) isi.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; }
    };
    bp.pasang(el, muat);
    if (tab.length > 1) el.querySelector('[data-tab]').onchange = e => { kini = tab.find(t => t.k === e.target.value); muat(); };
    el.querySelector('[data-unduh]').onclick = () => unduhTabel(`${judul}-${kini.k}`.toLowerCase().replace(/\W+/g, '-'), kol, data);
    el.querySelector('[data-cetak]').onclick = () => cetakHtml(`${judul}${tab.length > 1 ? ' - ' + kini.l : ''}`, bp.teks(), tabelHtml(kol, data, { maks: 5000 }));
    muat();
  };
}

// ---------- Grafik (satu seri, satu warna; tabelnya selalu tersedia) ----------
const W = '#0e7d78';
const ringkas = v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return s + (a >= 1e9 ? angka((a / 1e9).toFixed(1)) + ' M' : a >= 1e6 ? angka((a / 1e6).toFixed(1)) + ' jt' : a >= 1e3 ? angka(Math.round(a / 1e3)) + ' rb' : angka(a)); };
function tip(wadah) { let t = wadah.querySelector('.tip-grafik'); if (!t) { t = document.createElement('div'); t.className = 'tip-grafik sembunyi'; wadah.style.position = 'relative'; wadah.append(t); } return t; }
export function grafikBatang(el, data, fmt = rupiah, maks = 10) {
  const d = data.slice(0, maks), m = Math.max(...d.map(x => Math.abs(x.nilai)), 1);
  el.innerHTML = d.length ? `<div class="batang-grafik">${d.map(x => `<div class="brs" title="${esc(x.label)}: ${esc(fmt(x.nilai))}"><span class="nm">${esc(x.label)}</span><span class="jalur"><i style="width:${Math.max(0.5, Math.abs(x.nilai) / m * 100)}%;background:${x.nilai < 0 ? '#8a97a0' : W}"></i></span><b>${esc(fmt(x.nilai))}</b></div>`).join('')}</div>` : '<p class="kosong">Belum ada data.</p>';
}
export function grafikGaris(el, data, fmt = rupiah) {
  if (data.length < 2) { el.innerHTML = data.length ? `<p class="kosong">${esc(data[0].label)}: <b>${esc(fmt(data[0].nilai))}</b></p>` : '<p class="kosong">Belum ada data.</p>'; return; }
  const L = el.clientWidth && el.clientWidth < 500 ? 360 : 640, T = 200, kiri = 56, bawah = 24, v = data.map(x => x.nilai), mx = Math.max(...v, 0) || 1, mn = Math.min(...v, 0), r = mx - mn;
  const X = i => kiri + i * (L - kiri - 14) / (data.length - 1), Y = n => 10 + (mx - n) / r * (T - 10 - bawah);
  const garis = [0, .5, 1].map(f => mn + r * f), lbl = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((x, i, a) => a.indexOf(x) === i);
  el.innerHTML = `<svg viewBox="0 0 ${L} ${T}" style="width:100%;height:auto;display:block;touch-action:pan-y" role="img" aria-label="Grafik">
    ${garis.map(g => `<line x1="${kiri}" x2="${L - 14}" y1="${Y(g)}" y2="${Y(g)}" stroke="#e3e9ee"/><text x="${kiri - 6}" y="${Y(g) + 4}" text-anchor="end" font-size="11" fill="#5b6b76">${ringkas(g)}</text>`).join('')}
    ${lbl.map((i, n) => `<text x="${X(i)}" y="${T - 6}" text-anchor="${n === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}" font-size="11" fill="#5b6b76">${esc(data[i].label)}</text>`).join('')}
    <polyline points="${data.map((d, i) => X(i) + ',' + Y(d.nilai)).join(' ')}" fill="none" stroke="${W}" stroke-width="2" stroke-linejoin="round"/>
    <line data-x y1="10" y2="${T - bawah}" stroke="#5b6b76" stroke-dasharray="3 3" visibility="hidden"/><circle data-t r="5" fill="${W}" stroke="#fff" stroke-width="2" visibility="hidden"/></svg>`;
  const svg = el.querySelector('svg'), gx = svg.querySelector('[data-x]'), gt = svg.querySelector('[data-t]'), t = tip(el);
  svg.onpointermove = e => {
    const b = svg.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * L, i = Math.max(0, Math.min(data.length - 1, Math.round((px - kiri) / ((L - kiri - 14) / (data.length - 1)))));
    gx.setAttribute('x1', X(i)); gx.setAttribute('x2', X(i)); gt.setAttribute('cx', X(i)); gt.setAttribute('cy', Y(data[i].nilai)); gx.setAttribute('visibility', 'visible'); gt.setAttribute('visibility', 'visible');
    t.textContent = `${data[i].label}: ${fmt(data[i].nilai)}`; t.classList.remove('sembunyi'); t.style.left = Math.min(X(i) / L * b.width + 8, b.width - 170) + 'px'; t.style.top = '4px';
  };
  svg.onpointerleave = () => { t.classList.add('sembunyi'); gx.setAttribute('visibility', 'hidden'); gt.setAttribute('visibility', 'hidden'); };
}
// isi hari kosong agar garis tidak menyesatkan
export function isiHari(dari, sampai, data, f = 'netto') {
  const m = Object.fromEntries(data.map(r => [r.label, Number(r[f] || 0)])), h = [];
  for (let t = dari, n = 0; t <= sampai && n < 400; t = geserHari(t, 1), n++) h.push({ label: t.slice(8) + '/' + t.slice(5, 7), nilai: m[t] || 0 });
  return h;
}
