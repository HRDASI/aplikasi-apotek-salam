// Unduh data sebagai Excel, PDF, atau CSV. Dipakai semua laporan lewat unduhCSV()/unduhTabel().
// kolom: { label, nilai(r), t: 'uang'|'angka'|'persen'|'tgl', jml }
import { sb, S } from './inti.js?v=1.23.0';
import { esc, angka, tanggal, toast, modal, pesanGalat } from './ui.js?v=1.23.0';

const skrip = {};
const muatSkrip = (url, ada) => skrip[url] ||= ada() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => { delete skrip[url]; rej(new Error('Gagal memuat pembuat berkas. Cek internet.')); }; document.head.append(s); });
export const muatExcel = async () => { await muatSkrip('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', () => window.XLSX); return window.XLSX; };
const muatPdf = async () => { await muatSkrip('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf); await muatSkrip('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', () => window.jspdf?.jsPDF?.API?.autoTable); return window.jspdf.jsPDF; };
const simpanBlob = (blob, nama) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const tglBerkas = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const ISO = /^\d{4}-\d{2}-\d{2}$/, RP = /^-?\s*Rp\s?-?[\d.]+$/;

// satu sel -> { v, jenis: 'angka'|'uang'|'persen'|'tgl'|'teks' }
export function sel(k, r) {
  let v = k.nilai(r); if (v === null || v === undefined) return { v: '', jenis: 'teks' };
  if (typeof v === 'boolean') v = v ? 'Ya' : 'Tidak';
  if (typeof v === 'string' && RP.test(v.trim())) return { v: Number(v.replace(/[^\d-]/g, '')), jenis: 'uang' };
  if (['uang', 'angka', 'persen'].includes(k.t) && v !== '' && Number.isFinite(Number(v))) return { v: Number(v), jenis: k.t };
  if (typeof v === 'number' && Number.isFinite(v)) return { v, jenis: 'angka' };
  if (typeof v === 'string' && ISO.test(v)) return { v, jenis: 'tgl' };
  return { v: String(v), jenis: 'teks' };
}
const tampil = c => c.jenis === 'uang' ? 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(c.v) : c.jenis === 'angka' ? angka(c.v) : c.jenis === 'persen' ? angka(c.v) + '%' : c.jenis === 'tgl' ? tanggal(c.v) : c.v;

export function buatCsv(kolom, baris) {
  // teks berawalan = + @ diberi kutip supaya tidak dijalankan sebagai rumus saat dibuka di Excel
  const s = v => { let x = String(v ?? ''); if (/^[=+@\t\r]/.test(x)) x = "'" + x; return /[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  return '﻿' + [kolom.map(k => s(k.label)).join(';'), ...baris.map(r => kolom.map(k => s(sel(k, r).v)).join(';'))].join('\r\n');
}
// kepala: array teks di atas tabel ([] = judul kolom di baris pertama, supaya bisa diimpor lagi)
export async function buatExcel(daftar) {
  const X = await muatExcel(), wb = X.utils.book_new(), pakai = new Set();
  for (const { nama, kepala = [], kolom, baris } of daftar) {
    const ws = {}, a = kepala.length ? kepala.length + 1 : 0, lebar = kolom.map(k => String(k.label).length), taruh = (r, c, x) => { ws[X.utils.encode_cell({ r, c })] = x; };
    kepala.forEach((t, i) => taruh(i, 0, { t: 's', v: t })); kolom.forEach((k, c) => taruh(a, c, { t: 's', v: String(k.label) }));
    baris.forEach((r, i) => kolom.forEach((k, c) => { const s = sel(k, r); if (s.v === '') return; lebar[c] = Math.max(lebar[c], Math.min(60, tampil(s).length));
      if (s.jenis === 'tgl') { const [y, m, d] = s.v.split('-').map(Number); taruh(a + 1 + i, c, { t: 'n', v: Math.round(Date.UTC(y, m - 1, d) / 864e5) + 25569, z: 'dd/mm/yyyy' }); }
      else if (s.jenis === 'teks') taruh(a + 1 + i, c, { t: 's', v: s.v.slice(0, 32000) }); else taruh(a + 1 + i, c, { t: 'n', v: s.v, z: s.jenis === 'uang' ? '#,##0' : s.jenis === 'persen' ? '0.0' : Number.isInteger(s.v) ? '#,##0' : '#,##0.##' }); }));
    let akhir = a + baris.length;
    if (baris.length && kolom.some(k => k.jml)) { akhir++; kolom.forEach((k, c) => { if (k.jml) { const kol = X.utils.encode_col(c); taruh(akhir, c, { t: 'n', f: `SUM(${kol}${a + 2}:${kol}${a + 1 + baris.length})`, v: baris.reduce((x, r) => x + (Number(sel(k, r).v) || 0), 0), z: '#,##0' }); } else if (c === 0) taruh(akhir, 0, { t: 's', v: 'Total' }); }); }
    ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(akhir, a), c: Math.max(0, kolom.length - 1) } }); ws['!cols'] = lebar.map(w => ({ wch: w + 2 })); ws['!autofilter'] = baris.length ? { ref: X.utils.encode_range({ s: { r: a, c: 0 }, e: { r: a + baris.length, c: kolom.length - 1 } }) } : undefined;
    let n = nama.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Data', i = 2; const n0 = n; while (pakai.has(n.toLowerCase())) n = `${n0} ${i++}`; pakai.add(n.toLowerCase());
    X.utils.book_append_sheet(wb, ws, n);
  }
  return new Blob([X.write(wb, { type: 'array', bookType: 'xlsx', compression: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
let logoPdf; const ambilLogo = () => logoPdf ||= fetch('img/logo-b-256.png').then(r => r.blob()).then(b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); })).catch(() => null);
const bersih = s => String(s).replace(/[–—−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/ /g, ' ').replace(/[^\x09\x0a\x20-\x7e¡-ÿ]/g, '');
export async function buatPdf({ judul, sub = [], kolom, baris, mendatar }) {
  const J = await muatPdf(), doc = new J({ orientation: mendatar ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), logo = await ambilLogo(), o = S.outlet || {};
  const C = baris.map(r => kolom.map(k => sel(k, r))), kanan = kolom.map((k, c) => ['uang', 'angka', 'persen'].includes(k.t) || (C.some(b => b[c].jenis !== 'teks') && C.every(b => b[c].v === '' || ['uang', 'angka', 'persen'].includes(b[c].jenis))));
  if (logo) doc.addImage(logo, 'PNG', 12, 8, 16, 16, 'logo', 'FAST');
  doc.setFont('helvetica', 'bold').setFontSize(13).text(bersih(o.nama || 'Apotek Salam'), logo ? 31 : 12, 14); doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90).text(bersih([o.alamat, o.telp ? 'Telp ' + o.telp : ''].filter(Boolean).join(' · ')), logo ? 31 : 12, 19, { maxWidth: W - 50 });
  doc.setDrawColor(14, 125, 120).setLineWidth(.6).line(12, 26, W - 12, 26); doc.setTextColor(0).setFont('helvetica', 'bold').setFontSize(13).text(bersih(judul), 12, 33); let y = 38; doc.setFont('helvetica', 'normal').setFontSize(9); for (const t of sub) { doc.text(bersih(t), 12, y, { maxWidth: W - 24 }); y += 4.5; }
  const jml = kolom.some(k => k.jml) && baris.length ? [kolom.map((k, c) => k.jml ? bersih(tampil({ v: C.reduce((a, b) => a + (Number(b[c].v) || 0), 0), jenis: k.t || 'angka' })) : c === 0 ? 'Total' : '')] : undefined;
  doc.autoTable({ startY: y + 1, margin: { left: 12, right: 12, top: 14, bottom: 15 }, head: [kolom.map(k => bersih(k.label))], body: C.map(b => b.map(x => bersih(tampil(x)))), foot: jml, showFoot: 'lastPage', styles: { font: 'helvetica', fontSize: kolom.length > 11 ? 6.5 : kolom.length > 7 ? 7.5 : 8.5, cellPadding: 1.5, overflow: 'linebreak' }, headStyles: { fillColor: [14, 125, 120], textColor: 255 }, footStyles: { fillColor: [230, 247, 246], textColor: 0, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [247, 250, 250] }, columnStyles: Object.fromEntries(kanan.map((x, c) => [c, { halign: x ? 'right' : 'left' }])), didParseCell: d => { if (d.section !== 'body' && kanan[d.column.index]) d.cell.styles.halign = 'right'; } });
  const n = doc.getNumberOfPages(), cap = `Dicetak ${new Date().toLocaleString('id-ID')} oleh ${S.pengguna?.nama || ''}`;
  for (let i = 1; i <= n; i++) { doc.setPage(i).setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(110).text(bersih(cap), 12, H - 7); doc.text(`Halaman ${i} dari ${n}`, W - 12, H - 7, { align: 'right' }); }
  return doc.output('blob');
}

// judul & periode diambil dari halaman yang sedang dibuka
function konteks(nama) {
  const judul = document.querySelector('.konten .judul-halaman h2')?.textContent?.trim() || nama, v = s => [...document.querySelectorAll('.konten ' + s)].find(x => x.offsetParent && x.value)?.value, a = v('[data-dari]'), b = v('[data-sampai]');
  return { judul, sub: [a && b ? `Periode ${tanggal(a)} s.d. ${tanggal(b)}` : '', S.outlet?.nama ? 'Outlet: ' + S.outlet.nama : ''].filter(Boolean) };
}
export async function catatUnduh(ket) { try { await sb.rpc('catat_log', { p_modul: 'unduh', p_aksi: 'Unduh', p_ket: ket }); } catch { /* tidak menggagalkan unduhan */ } }
export function unduhData(nama, kolom, baris) {
  kolom = kolom.filter(k => k.label);
  if (!baris.length) return toast('Tidak ada data untuk diunduh', 'galat');
  const k = konteks(nama), berkas = `${nama}-${tglBerkas()}`, panjang = baris.length > 5000; let format = 'xlsx'; try { format = localStorage.getItem('apotek-unduh') || 'xlsx'; } catch { /* */ }
  if (panjang && format === 'pdf') format = 'xlsx';
  const F = [['xlsx', 'Excel (.xlsx)', 'Bisa dihitung dan disaring'], ['pdf', 'PDF (.pdf)', panjang ? 'Maksimal 5.000 baris' : 'Siap dibaca dan dikirim'], ['csv', 'CSV (.csv)', 'Untuk program lain']];
  modal({ judul: 'Unduh ' + k.judul, ukuran: 'kecil', isi: `<p style="margin-top:0">${angka(baris.length)} baris${k.sub.length ? ' · ' + esc(k.sub[0]) : ''}</p><form onsubmit="return false"><div class="pilih-model satu">${F.map(f => `<label class="${f[0] === format ? 'aktif' : ''}"><input type="radio" name="f" value="${f[0]}" ${f[0] === format ? 'checked' : ''} ${f[0] === 'pdf' && panjang ? 'disabled' : ''}><b>${f[1]}</b><small>${f[2]}</small></label>`).join('')}</div><label class="isian ${format === 'pdf' ? '' : 'sembunyi'}" data-arah style="margin-top:10px"><span>Kertas A4</span><select name="o"><option value="0" ${kolom.length <= 7 ? 'selected' : ''}>Tegak</option><option value="1" ${kolom.length > 7 ? 'selected' : ''}>Mendatar</option></select></label></form>`,
    saatBuka: m => m.addEventListener('change', () => { const f = m.querySelector('[name=f]:checked').value; m.querySelector('[data-arah]').classList.toggle('sembunyi', f !== 'pdf'); m.querySelectorAll('.pilih-model label').forEach(l => l.classList.toggle('aktif', l.querySelector('input').checked)); }),
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Unduh', aksi: async m => {
      const f = m.querySelector('[name=f]:checked').value; try { localStorage.setItem('apotek-unduh', f); } catch { /* */ }
      if (f === 'csv') simpanBlob(new Blob([buatCsv(kolom, baris)], { type: 'text/csv;charset=utf-8' }), berkas + '.csv');
      else if (f === 'xlsx') simpanBlob(await buatExcel([{ nama: k.judul, kepala: [S.outlet?.nama || 'Apotek Salam', k.judul, ...k.sub], kolom, baris }]), berkas + '.xlsx');
      else simpanBlob(await buatPdf({ judul: k.judul, sub: k.sub, kolom, baris, mendatar: m.querySelector('[name=o]').value === '1' }), berkas + '.pdf');
      catatUnduh(`${k.judul} (${f}, ${baris.length} baris)`); toast('Berkas diunduh', 'sukses');
    } }] });
}
export { simpanBlob, tglBerkas, pesanGalat };
