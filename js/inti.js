import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=1.16.0';

// ---------- Koneksi ----------
// putus = server tidak terjangkau DAN perangkat ini siap offline (perangkat biasa tetap seperti semula)
export const HOOK = { offline: null };
export const KONEKSI = { putus: false, saatBerubah: [] };
const galatJaringan = () => new TypeError('Failed to fetch');
function aturKoneksi(putus) {
  putus = putus && !!HOOK.offline?.perangkatAktif();
  if (KONEKSI.putus === putus) return;
  KONEKSI.putus = putus;
  document.body.classList.toggle('offline', putus);
  KONEKSI.saatBerubah.forEach(f => f());
}
export async function cekServer(batas = 4000) {
  let hidup = false;
  if (navigator.onLine) try { const r = await fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(batas), cache: 'no-store' }); hidup = r.status < 500; } catch { /* mati */ }
  aturKoneksi(!hidup);
  return hidup;
}
addEventListener('offline', () => aturKoneksi(true));
addEventListener('online', () => cekServer());
async function ambilJaringan(url, opsi = {}) {
  if (KONEKSI.putus) throw galatJaringan();
  // perangkat siap offline tidak menunggu internet macet terlalu lama
  const batas = HOOK.offline?.perangkatAktif() && !String(url).includes('/storage/') ? AbortSignal.timeout(15000) : null;
  try { return await fetch(url, batas ? { ...opsi, signal: opsi.signal ? AbortSignal.any([opsi.signal, batas]) : batas } : opsi); }
  catch (e) {
    if (opsi.signal?.aborted) throw e;
    if (e.name === 'TypeError' || batas?.aborted) { cekServer(); throw galatJaringan(); }
    throw e;
  }
}
export const putusJaringan = e => /Failed to fetch|NetworkError|Load failed/i.test(e?.message || String(e || ''));
// jalankan online; bila jaringan putus dan perangkat siap, pakai cara offline
export async function atauOffline(online, offline) {
  const siap = () => HOOK.offline?.siap();
  if (KONEKSI.putus && siap()) return offline();
  try { return await online(); } catch (e) { if (putusJaringan(e) && siap()) return offline(); throw e; }
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: ambilJaringan },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'apotek-salam-auth' },
});

export const DOMAIN_AKUN = '@apoteksalam.app';
export const VERSI = '1.16.0';

// Status sesi aplikasi
export const S = { pengguna: null, peran: null, outlet: null, akses: [] };

export function bisa(kunci) {
  const a = S.akses;
  if (!a.length) return false;
  if (a.includes('*')) return true;
  if (a.includes(kunci)) return true;
  return a.some(x => kunci.startsWith(x + '.'));
}
// total penjualan disembunyikan dari peran tanpa salah satu hak ini (sama dengan _nominal() di server)
export const lihatNominal = () => ['akses.nominal', 'laporan.penjualan', 'dashboard.umum', 'dashboard.penjualan', 'keuangan.laba', 'penjualan.batal'].some(bisa);
export const bisaSalahSatu = daftar => daftar.some(k => k === '*semua' || bisa(k));

// Rute: '#/grup/item' -> fungsi(el, param)
export const RUTE = {};
export const rute = (pola, fn) => { RUTE[pola] = fn; };

// Cache data referensi kecil (kategori, satuan, dll.)
const cache = {};
export async function ambilRef(tabel, kolom = 'id,nama', urut = 'nama', paksa = false) {
  const kunci = tabel + '|' + kolom;
  if (!paksa && cache[kunci]) return cache[kunci];
  if (KONEKSI.putus && HOOK.offline?.siap()) { const l = HOOK.offline.refL(tabel, urut); if (l) return l; }
  const p = ambilSemua(() => sb.from(tabel).select(kolom).order(urut).order('id')).catch(e => { const l = putusJaringan(e) && HOOK.offline?.siap() && HOOK.offline.refL(tabel, urut); if (l) { delete cache[kunci]; return l; } throw e; });
  cache[kunci] = p;                       // simpan janjinya: permintaan bersamaan tidak dobel
  p.catch(() => { delete cache[kunci]; });
  return p;
}
// Server membatasi 1.000 baris per permintaan. buat() harus membuat kueri baru yang sudah diurutkan.
export async function ambilSemua(buat, maks = 20000) {
  const hasil = [];
  for (let i = 0; i < maks; i += 1000) {
    const { data, error } = await buat().range(i, i + 999);
    if (error) throw error;
    hasil.push(...data);
    if (data.length < 1000) break;
  }
  return hasil;
}
export async function muatSesi() {
  const off = await import('./offline.js?v=1.16.0');
  if (KONEKSI.putus) S.sesi = off.bacaSesi();
  else {
    const { data, error } = await sb.rpc('sesi_aktif');
    if (error) { if (!putusJaringan(error) || !HOOK.offline?.siap()) throw error; S.sesi = off.bacaSesi(); }
    else {
      S.sesi = data && data.id ? data : null;
      // sesi yang dibuka offline dan belum terkirim tetap dipakai
      const lokal = off.bacaSesi();
      if (!S.sesi && lokal?.uuid && (await off.daftarAntre()).some(a => a.id === lokal.uuid)) S.sesi = lokal;
      off.simpanSesi();
    }
  }
  document.querySelectorAll('[data-info-sesi]').forEach(x => x.textContent = S.sesi ? S.sesi.kode : '-');
  return S.sesi;
}
export const hapusCache = tabel => { for (const k of Object.keys(cache)) if (k.startsWith(tabel + '|')) delete cache[k]; };

export async function log(modul, aksi, ket) {
  try { await sb.rpc('catat_log', { p_modul: modul, p_aksi: aksi, p_ket: ket }); } catch { /* abaikan */ }
}
