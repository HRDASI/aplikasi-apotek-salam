import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=1.5.1';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'apotek-salam-auth' },
});

export const DOMAIN_AKUN = '@apoteksalam.app';
export const VERSI = '1.5.1';

// Status sesi aplikasi
export const S = { pengguna: null, peran: null, outlet: null, akses: [] };

export function bisa(kunci) {
  const a = S.akses;
  if (!a.length) return false;
  if (a.includes('*')) return true;
  if (a.includes(kunci)) return true;
  return a.some(x => kunci.startsWith(x + '.'));
}
export const bisaSalahSatu = daftar => daftar.some(k => k === '*semua' || bisa(k));

// Rute: '#/grup/item' -> fungsi(el, param)
export const RUTE = {};
export const rute = (pola, fn) => { RUTE[pola] = fn; };

// Cache data referensi kecil (kategori, satuan, dll.)
const cache = {};
export async function ambilRef(tabel, kolom = 'id,nama', urut = 'nama', paksa = false) {
  const kunci = tabel + '|' + kolom;
  if (!paksa && cache[kunci]) return cache[kunci];
  const { data, error } = await sb.from(tabel).select(kolom).order(urut).limit(2000);
  if (error) throw error;
  cache[kunci] = data;
  return data;
}
export const hapusCache = tabel => { for (const k of Object.keys(cache)) if (k.startsWith(tabel + '|')) delete cache[k]; };

export async function log(modul, aksi, ket) {
  try { await sb.rpc('catat_log', { p_modul: modul, p_aksi: aksi, p_ket: ket }); } catch { /* abaikan */ }
}
