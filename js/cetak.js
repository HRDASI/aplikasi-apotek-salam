// Cetak terpadu: lewat Agen Cetak (langsung ke printer, tanpa dialog) bila tersedia,
// atau dialog cetak browser sebagai cadangan.
// Pengaturan printer disimpan PER PERANGKAT (localStorage), karena tiap PC punya printer sendiri.
import { toast } from './ui.js?v=1.6.1';

export const AGEN = 'http://localhost:8766';
const KUNCI = 'apotek-printer';
export const BAWAAN_PRINTER = {
  mode: 'otomatis',                                   // otomatis (agen bila ada) | dialog
  struk: { printer: '', lebar: '' },                  // lebar '' = ikut Konfigurasi
  label: { printer: '', lebar: 50, tinggi: 30, celah: 2 },
  salinanEtiket: 1,
};
export function bacaPrinter() {
  try { const s = JSON.parse(localStorage.getItem(KUNCI) || 'null') || {}; return { ...BAWAAN_PRINTER, ...s, struk: { ...BAWAAN_PRINTER.struk, ...(s.struk || {}) }, label: { ...BAWAAN_PRINTER.label, ...(s.label || {}) } }; }
  catch { return structuredClone(BAWAAN_PRINTER); }
}
export function simpanPrinter(p) { try { localStorage.setItem(KUNCI, JSON.stringify(p)); } catch { /* */ } }

export async function statusAgen(batasMs = 1500) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), batasMs);
    const r = await fetch(AGEN + '/status', { signal: c.signal }); clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

let janjiH2C;
function muatHtml2canvas() {
  janjiH2C ||= new Promise((res, rej) => {
    if (window.html2canvas) return res(window.html2canvas);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = () => res(window.html2canvas); s.onerror = rej; document.head.append(s);
  });
  return janjiH2C;
}

// Ubah HTML (dengan CSS sendiri) menjadi PNG hitam-putih selebar `lebarMm` pada 203 dpi.
export async function htmlKePng(html, css, lebarMm, tinggiMm) {
  const h2c = await muatHtml2canvas();
  const wadah = document.createElement('div');
  wadah.style.cssText = `position:fixed;left:-10000px;top:0;width:${lebarMm}mm;${tinggiMm ? `height:${tinggiMm}mm;overflow:hidden;` : ''}background:#fff;color:#000`;
  wadah.innerHTML = `<style>${css}</style><div class="kertas">${html}</div>`;
  document.body.append(wadah);
  try {
    await Promise.all([...wadah.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    const c = await h2c(wadah, { scale: 203 / 96, backgroundColor: '#fff', logging: false, useCORS: true });
    // hitam-putih tegas supaya tajam di printer thermal/label
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const v = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) < 170 ? 0 : 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  } finally { wadah.remove(); }
}

function dialogCetak(html, css, judul, ukuranHalaman) {
  document.querySelector('iframe[data-cetak]')?.remove();
  const f = document.createElement('iframe');
  f.dataset.cetak = '1';
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(f);
  f.contentDocument.open();
  f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${judul}</title><style>@page{size:${ukuranHalaman};margin:2mm}${css}</style></head><body><div class="kertas">${html}</div></body></html>`);
  f.contentDocument.close();
  let sudah = false;
  const go = () => { if (sudah) return; sudah = true; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Gagal mencetak: ' + e.message, 'galat'); } };
  const img = f.contentDocument.images;
  if (img.length && !img[0].complete) { img[0].onload = img[0].onerror = () => setTimeout(go, 50); setTimeout(go, 2000); } else setTimeout(go, 150);
}

async function kirimAgen(printer, png, lebarMm, tinggiMm, salinan = 1) {
  const r = await fetch(AGEN + '/cetak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ printer, png, lebar_mm: lebarMm, tinggi_mm: tinggiMm || 0, salinan }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.pesan || 'Agen cetak gagal');
}

// ---------------- Kertas struk (thermal 58/80 mm) ----------------
export const CSS_STRUK = `.kertas{font:11px/1.35 'Courier New',monospace;color:#000}.c{text-align:center}.r{display:flex;justify-content:space-between;gap:6px}
  .r span:last-child{text-align:right;white-space:nowrap}hr{border:0;border-top:1px dashed #000;margin:4px 0}.n{margin-top:3px}img{max-width:60%}.b{font-weight:bold}.besar{font-size:13px;font-weight:bold}`;
export async function cetakStrukHtml(isi, judul, lebarKonfig = '80') {
  const p = bacaPrinter();
  const lebar = p.struk.lebar || lebarKonfig || '80';
  const cetakMm = lebar === '80' ? 72 : 48;               // lebar area cetak
  if (p.mode !== 'dialog' && p.struk.printer) {
    try { await kirimAgen(p.struk.printer, await htmlKePng(isi, CSS_STRUK, cetakMm), cetakMm, 0); return 'agen'; }
    catch (e) { toast('Agen cetak tidak tersedia (' + e.message + '). Memakai dialog cetak.', 'galat'); }
  }
  dialogCetak(isi, CSS_STRUK + `.kertas{width:${cetakMm}mm;margin:0 auto}`, judul, `${lebar}mm auto`);
  return 'dialog';
}

// ---------------- Label / etiket (Xprinter) ----------------
export const CSS_LABEL = `.kertas{font:9px/1.25 Arial,sans-serif;color:#000}.lbl{box-sizing:border-box;padding:1.2mm 1.5mm;overflow:hidden;page-break-after:always;break-after:page}
  .lbl:last-child{page-break-after:auto;break-after:auto}.lbl .kop{display:flex;justify-content:space-between;border-bottom:1px solid #000;font-weight:bold;font-size:8px;padding-bottom:.5mm}
  .lbl .nm{font-weight:bold;font-size:10px;margin-top:.6mm}.lbl .signa{font-weight:bold;font-size:13px;text-align:center;margin:.8mm 0}.lbl .kecil{font-size:7.5px}
  .lbl .jenis{border:1px solid #000;text-align:center;font-weight:bold;font-size:8px;margin-top:.5mm}`;
// labels: array HTML, satu elemen = satu stiker
export async function cetakLabelHtml(labels, judul) {
  const p = bacaPrinter();
  const { lebar, tinggi } = p.label;
  const salinan = Math.max(1, Number(p.salinanEtiket || 1));
  if (p.mode !== 'dialog' && p.label.printer) {
    try {
      for (const l of labels) await kirimAgen(p.label.printer, await htmlKePng(`<div class="lbl" style="width:${lebar}mm;height:${tinggi}mm">${l}</div>`, CSS_LABEL, lebar, tinggi), lebar, tinggi, salinan);
      return 'agen';
    } catch (e) { toast('Agen cetak tidak tersedia (' + e.message + '). Memakai dialog cetak.', 'galat'); }
  }
  const semua = labels.flatMap(l => Array(salinan).fill(`<div class="lbl" style="width:${lebar}mm;height:${tinggi}mm">${l}</div>`)).join('');
  dialogCetak(semua, CSS_LABEL, judul, `${lebar}mm ${tinggi}mm`);
  return 'dialog';
}

// ---------------- Kertas biasa (A5/A4) lewat dialog ----------------
export function cetakKertasBiasa(html, css, judul, ukuran = 'A5') { dialogCetak(html, css, judul, ukuran); }
