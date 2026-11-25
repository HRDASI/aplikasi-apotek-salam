// Layar penuh Kasir: menu & bar disembunyikan, lalu layar penuh browser (bila didukung) pada sentuhan pertama.
// Peran Kasir: menyala sejak awal. Pilihan diingat per akun sampai logout.
import { S } from './inti.js?v=1.22.1';
import { toast } from './ui.js?v=1.22.1';

const KUNCI = 'apotek-fokus', akar = document.documentElement;
const diKasir = () => location.hash.startsWith('#/penjualan/kasir');
const pilihan = () => { try { const p = JSON.parse(localStorage.getItem(KUNCI) || 'null'); return p && p.uid === S.pengguna?.id ? p.v : null; } catch { return null; } };
export const peranKasir = () => (S.peran?.nama || '').trim().toLowerCase() === 'kasir';
export const aktif = () => !!S.pengguna && (pilihan() ?? peranKasir());
const penuhAsli = () => !!document.fullscreenElement;
const penuhF11 = () => !penuhAsli() && matchMedia('(display-mode: fullscreen)').matches;
let kunciEsc = false, cetakPada = 0;

async function masukPenuh() {
  if (penuhAsli() || penuhF11() || !akar.requestFullscreen) return;
  try { await akar.requestFullscreen({ navigationUI: 'hide' }); } catch { return; }
  try { await navigator.keyboard.lock(['Escape']); kunciEsc = true; } catch { kunciEsc = false; }      // Esc tetap dipakai menutup jendela
}
function keluarPenuh() { if (penuhAsli()) document.exitFullscreen().catch(() => {}); }

export function terapkan() {
  const ya = aktif() && diKasir();
  document.body.classList.toggle('fokus-kasir', ya);
  document.querySelectorAll('.keluar-fokus').forEach(x => x.remove());
  if (!ya) keluarPenuh();
  // formulir buka sesi belum punya tombolnya
  else if (!document.querySelector('.kasir [data-fokus]')) document.querySelector('[data-konten]')?.insertAdjacentHTML('beforeend', '<button class="tombol kedua kecil keluar-fokus" data-fokus>Keluar layar penuh (Esc)</button>');
  document.querySelectorAll('.kasir [data-fokus]').forEach(b => { b.textContent = ya ? '⛶ Keluar layar penuh' : '⛶ Layar penuh'; b.title = ya ? 'Esc atau F11' : 'F11'; });
}
export function atur(v) {
  try { localStorage.setItem(KUNCI, JSON.stringify({ uid: S.pengguna?.id, v })); } catch { /* abaikan */ }
  if (!v && penuhF11()) toast('Tekan F11 untuk menampilkan kembali taskbar.');
  terapkan();
  if (v) masukPenuh();
}
export function lupakan() { try { localStorage.removeItem(KUNCI); } catch { /* abaikan */ } document.body.classList.remove('fokus-kasir'); keluarPenuh(); }

const menyala = () => document.body.classList.contains('fokus-kasir');
document.addEventListener('click', e => { if (e.target.closest('[data-fokus]')) { e.preventDefault(); atur(!menyala()); } });
// layar penuh browser hanya boleh diminta setelah ada klik / tombol
addEventListener('pointerup', e => { if (menyala() && !e.target.closest?.('[data-fokus],a')) masukPenuh(); }, true);
document.addEventListener('keydown', e => {
  if (!S.pengguna || !diKasir()) return;
  if (e.key === 'F11') {
    if (penuhF11()) { if (menyala()) atur(false); return; }      // dibiarkan: Chrome sendiri yang keluar
    e.preventDefault(); return atur(!menyala());
  }
  if (!menyala()) return;
  if (e.key !== 'Escape') return void (e.key.length === 1 || e.key === 'Enter' ? masukPenuh() : 0);
  if (document.querySelector('.latar-modal') || document.querySelector('.konten .hasil-cari:not(.sembunyi)') || (e.target.matches?.('input,textarea') && e.target.value && e.target.matches('[data-cari],[data-cari-pelanggan]'))) return;
  atur(false);
}, true);
addEventListener('beforeprint', () => { cetakPada = Date.now(); });
addEventListener('afterprint', () => { cetakPada = Date.now(); });
// browser tanpa kunci Esc: keluar lewat Esc berarti keluar dari mode ini, kecuali sedang mencetak atau ada jendela
document.addEventListener('fullscreenchange', () => {
  if (penuhAsli()) return;
  const terkunci = kunciEsc; kunciEsc = false;
  if (menyala() && !terkunci && Date.now() - cetakPada > 4000 && !document.querySelector('.latar-modal') && !document.hidden) atur(false);
});
