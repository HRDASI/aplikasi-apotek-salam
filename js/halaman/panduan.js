// Panduan pemakaian. Isinya dibuat dari online/panduan/*.md lewat buat-panduan.js (jangan diubah di sini).
import { rute } from '../inti.js?v=1.20.0';
import { ikon } from '../menu.js?v=1.20.0';
import { esc, judulHalaman } from '../ui.js?v=1.20.0';
import isi from '../panduan-isi.js?v=1.20.0';

rute('panduan', async el => {
  el.innerHTML = judulHalaman('Panduan', '', isi.pdf.map(p => `<a class="tombol kedua" href="${p.url}" target="_blank" rel="noopener">${ikon('unduh')} ${esc(p.nama)}</a>`).join(' '))
    + `<div class="kartu panduan"><div class="alat-tabel"><div class="cari">${ikon('cari')}<input class="input" data-q placeholder="Cari di panduan..."></div></div>${isi.bagian.map(b => `<details><summary>${esc(b.judul)}</summary><div class="isi-bab">${b.html}</div></details>`).join('')}<p class="kosong sembunyi" data-kosong>Tidak ditemukan.</p></div>`;
  const bab = [...el.querySelectorAll('details')];
  el.querySelector('[data-q]').oninput = e => {
    const q = e.target.value.trim().toLowerCase(); let n = 0;
    for (const d of bab) { const ya = !q || d.textContent.toLowerCase().includes(q); d.classList.toggle('sembunyi', !ya); d.open = !!q && ya; n += ya; }
    el.querySelector('[data-kosong]').classList.toggle('sembunyi', n > 0);
  };
  return 'Panduan';
});
