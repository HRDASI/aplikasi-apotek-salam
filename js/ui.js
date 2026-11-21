import { ikon } from './menu.js?v=1.2.0';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtAngka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
export const angka = v => fmtAngka.format(Number(v || 0));
export const rupiah = v => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(v || 0)));
export const tanggal = v => v ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '';
export const waktu = v => v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-').replace(',', '') : '';

// ---------- Toast ----------
export function toast(pesan, jenis = '') {
  let w = $('.toast-wadah');
  if (!w) { w = document.createElement('div'); w.className = 'toast-wadah'; document.body.append(w); }
  const t = document.createElement('div');
  t.className = 'toast ' + jenis; t.textContent = pesan;
  w.append(t);
  setTimeout(() => t.remove(), jenis === 'galat' ? 5000 : 2800);
}

// ---------- Modal ----------
// modal({ judul, isi (html), ukuran, tombol: [{teks, kelas, aksi(tutup) -> bool|Promise}] })
export function modal({ judul, isi, ukuran = '', tombol = [], saatBuka }) {
  const latar = document.createElement('div');
  latar.className = 'latar-modal';
  latar.innerHTML = `<div class="modal ${ukuran}" role="dialog" aria-modal="true">
    <header><h3>${esc(judul)}</h3><button class="ikon-aksi" data-tutup aria-label="Tutup">${ikon('tutup')}</button></header>
    <div class="isi">${isi}</div>
    ${tombol.length ? '<footer></footer>' : ''}</div>`;
  const tutup = () => { latar.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') tutup(); };
  document.addEventListener('keydown', esc_);
  latar.querySelector('[data-tutup]').onclick = tutup;
  latar.addEventListener('mousedown', e => { if (e.target === latar) latar.dataset.klik = '1'; });
  latar.addEventListener('click', e => { if (e.target === latar && latar.dataset.klik) tutup(); delete latar.dataset.klik; });
  const footer = latar.querySelector('footer');
  for (const b of tombol) {
    const el = document.createElement('button');
    el.className = 'tombol ' + (b.kelas || '');
    el.textContent = b.teks;
    el.onclick = async () => {
      if (!b.aksi) return tutup();
      el.disabled = true;
      try { const r = await b.aksi(latar, tutup); if (r !== false) tutup(); }
      catch (e) { toast(pesanGalat(e), 'galat'); }
      finally { el.disabled = false; }
    };
    footer.append(el);
  }
  document.body.append(latar);
  saatBuka?.(latar, tutup);
  setTimeout(() => latar.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea')?.focus(), 50);
  return { el: latar, tutup };
}

export function konfirmasi(judul, pesan, teksYa = 'Ya', kelas = 'bahaya') {
  return new Promise(res => {
    const m = modal({ judul, ukuran: 'kecil', isi: `<p style="margin:0">${pesan}</p>`, tombol: [
      { teks: 'Batal', kelas: 'kedua', aksi: () => { res(false); } },
      { teks: teksYa, kelas, aksi: () => { res(true); } },
    ] });
    m.el.querySelector('[data-tutup]').addEventListener('click', () => res(false));
  });
}

// ---------- Pesan galat dari Supabase/Postgres ----------
export function pesanGalat(e) {
  const m = e?.message || String(e);
  const kode = e?.code;
  if (kode === '23505') return 'Data dengan nilai yang sama sudah ada (kode/nama/username tidak boleh dobel).';
  if (kode === '23503') return 'Data ini masih dipakai di data lain, jadi tidak bisa dihapus. Nonaktifkan saja.';
  if (kode === '42501' || /row-level security/i.test(m)) return 'Anda tidak punya hak akses untuk aksi ini.';
  if (/Invalid login credentials/i.test(m)) return 'Username atau kata sandi salah.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak ada koneksi internet. Coba lagi.';
  return m;
}

// ---------- Form ----------
export function bacaForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') d[el.name] = el.checked;
    else if (el.type === 'number' || el.dataset.tipe === 'angka') d[el.name] = el.value === '' ? null : Number(el.value);
    else d[el.name] = el.value.trim() === '' ? null : el.value.trim();
  }
  return d;
}

export function unduhCSV(nama, kolom, baris) {
  const sel = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const isi = [kolom.map(k => sel(k.label)).join(';'), ...baris.map(r => kolom.map(k => sel(k.nilai(r))).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' }));
  a.download = nama + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function judulHalaman(judul, remah, aksiHtml = '') {
  return `<div class="judul-halaman"><div class="remah">${esc(remah)}</div><h2>${esc(judul)}</h2><div class="aksi">${aksiHtml}</div></div>`;
}
