// Membaca Excel jadwal Apotek Salam: judul "... BULAN DESEMBER 2026", baris tanggal 1..31, baris Plan/Actual per nama.
const BLN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
let janji;
const muatXlsx = () => janji ||= new Promise((res, rej) => { if (window.XLSX) return res(window.XLSX); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { janji = null; rej(new Error('Gagal memuat pembaca Excel. Cek internet.')); }; document.head.append(s); });

export function uraiJadwal(d) {
  let bulan = null;
  for (const r of d.slice(0, 10)) for (const c of r) { const m = String(c ?? '').toLowerCase().match(/([a-z]+)\s+(20\d\d)/); const i = m ? BLN.indexOf(m[1]) : -1; if (i >= 0) { bulan = `${m[2]}-${String(i + 1).padStart(2, '0')}`; break; } }
  if (!bulan) throw new Error('Bulan dan tahun tidak ditemukan di judul jadwal');
  const akhir = new Date(Date.UTC(...bulan.split('-').map(Number), 0)).getUTCDate();
  // baris tanggal = baris dengan angka berurutan 1,2,3,...
  let bt = -1, kolom = [];
  for (let i = 0; i < Math.min(d.length, 15) && bt < 0; i++) { const k = []; d[i].forEach((c, n) => { if (Number(c) === k.length + 1) k.push(n); }); if (k.length >= akhir) { bt = i; kolom = k.slice(0, akhir); } }
  if (bt < 0) throw new Error('Baris tanggal 1 sampai ' + akhir + ' tidak ditemukan');
  const baris = [], nama = [];
  for (let i = bt + 1; i < d.length; i++) {
    const r = d[i], p = r.findIndex(c => String(c ?? '').trim().toLowerCase() === 'plan'); if (p < 1) continue;
    const nm = r.slice(0, p).map(c => String(c ?? '').trim()).filter(Boolean).pop(); if (!nm) continue;
    const act = d[i + 1]?.some(c => String(c ?? '').trim().toLowerCase() === 'actual') ? d[i + 1] : [];
    nama.push(nm);
    kolom.forEach((k, n) => { const kode = (String(act[k] ?? '').trim() || String(r[k] ?? '').trim()).toUpperCase(); if (kode) baris.push({ nama: nm, tanggal: `${bulan}-${String(n + 1).padStart(2, '0')}`, kode }); });
  }
  if (!nama.length) throw new Error('Baris "Plan" per karyawan tidak ditemukan');
  return { bulan, nama, baris };
}
export async function bacaJadwal(file) {
  const X = await muatXlsx(), wb = X.read(await file.arrayBuffer(), { type: 'array' });
  let galat; for (const n of wb.SheetNames) { try { return uraiJadwal(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })); } catch (e) { galat ||= e; } }
  throw galat;
}
