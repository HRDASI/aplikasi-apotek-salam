// Beranda karyawan: sapaan, target, rencana kerja, motivasi, visi-misi-budaya.
import { sb, S, bisa } from './inti.js?v=1.23.0';
import { ikon } from './menu.js?v=1.23.0';
import { esc, angka, rupiah, tanggal, toast, pesanGalat } from './ui.js?v=1.23.0';
import BAWAAN from './beranda-isi.js?v=1.23.0';

export const isiBeranda = isi => ({ ...BAWAAN, ...(isi || {}), tampil: { ...BAWAAN.tampil, ...(isi?.tampil || {}) } });
const rpc = async (n, p) => { const { data, error } = await sb.rpc(n, p); if (error) throw error; return data; };
const ULANG = { harian: 'Harian', pekanan: 'Pekanan', bulanan: 'Bulanan', sekali: '' }, PER = [['pekan', 'Pekan ini'], ['bulan', 'Bulan ini'], ['tahun', 'Tahun ini']];
const tenang = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const simpan = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } }, baca = k => { try { return localStorage.getItem(k); } catch { return null; } };
const waktuSalam = () => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam'; };

function konfeti() {
  if (tenang()) return;
  const w = document.createElement('div'); w.className = 'konfeti'; w.setAttribute('aria-hidden', 'true');
  w.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${['#16ada6', '#f5a01a', '#1f9d55', '#0a5f5b'][i % 4]};animation-delay:${Math.random() * .5}s;animation-duration:${1.8 + Math.random() * 1.4}s"></i>`).join('');
  document.body.append(w); setTimeout(() => w.remove(), 4000);
}
const cincin = (p, warna) => { const r = 42, k = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p || 0)); return `<svg viewBox="0 0 100 100" class="cincin" role="img" aria-label="${p ?? 0} persen"><circle cx="50" cy="50" r="${r}" class="alas"/><circle cx="50" cy="50" r="${r}" class="isi" style="stroke:${warna};stroke-dasharray:${k};--dari:${k};--ke:${k * (1 - v / 100)}"/><text x="50" y="56">${p === null || p === undefined ? '-' : p + '%'}</text></svg>`; };

export async function pasangBeranda(w) {
  let d; try { d = await rpc('beranda_saya'); } catch (e) { w.innerHTML = `<div class="kartu"><p class="pesan galat" style="margin:0">${esc(pesanGalat(e))}</p></div>`; return; }
  if (!document.body.contains(w)) return;
  const I = isiBeranda(d.isi), kartuNilai = I.nilai || [], mot = (I.motivasi || []).filter(Boolean); let per = baca('beranda-per') || (PER.find(([k]) => d.target.some(t => t.periode === k)) || PER[1])[0], nm = mot.length ? Math.floor(Date.now() / 864e5) % mot.length : 0, tab = 'visi';
  const j = d.jadwal, jadwal = !j ? '' : j.kerja ? `Jadwal hari ini <b>${esc(j.kode)} ${esc(j.masuk || '')}–${esc(j.pulang || '')}</b>` : 'Jadwal hari ini <b>libur</b>';
  w.innerHTML = `<div class="brd">
    <section class="brd-hero"><div><p class="kecil">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h2>${waktuSalam()}, ${esc(S.pengguna.nama)} 👋</h2><p>${[S.shift?.id ? `Shift <b>${esc(S.shift.nama)}</b>` : '', jadwal].filter(Boolean).join(' · ') || 'Semoga harimu menyenangkan.'}</p><p class="motto">${esc(I.motto || '')}</p><div class="brd-aksi">${bisa('penjualan.kasir') ? `<a class="tombol brd-mulai" href="#/penjualan/kasir">${ikon('kasir')} Mulai Kasir</a>` : ''}<a class="tombol kedua" href="#/pengguna/jadwal">Jadwal</a><a class="tombol kedua" href="#/panduan">Panduan</a></div></div><img src="img/lamlam.png" alt="Si Lamlam" width="150" height="150"></section>
    <div class="brd-grid"><section class="kartu ${I.tampil.target ? '' : 'sembunyi'}" data-target></section><section class="kartu ${I.tampil.rencana ? '' : 'sembunyi'}" data-rencana></section></div>
    <section class="brd-mot ${I.tampil.motivasi && mot.length ? '' : 'sembunyi'}" data-mot></section>
    <section class="kartu ${I.tampil.budaya ? '' : 'sembunyi'}" data-budaya></section></div>`;
  const q = s => w.querySelector(s);

  // ---------- Target ----------
  const gambarTarget = () => {
    const t = d.target.filter(x => x.periode === per);
    q('[data-target]').innerHTML = `<div class="kepala-blok"><h3>🎯 Target</h3><div class="brd-tab" role="tablist">${PER.map(([k, l]) => `<button role="tab" aria-selected="${k === per}" class="${k === per ? 'aktif' : ''}" data-per="${k}">${l}</button>`).join('')}</div></div>${t.length ? `<div class="brd-cincin">${t.map(x => { const p = x.persen === null || x.persen === undefined ? null : Number(x.persen), capai = p !== null && p >= 100, f = v => x.uang ? rupiah(v) : angka(v); return `<div class="brd-target ${capai ? 'capai' : ''}">${cincin(p, capai ? '#1f9d55' : p >= 70 ? '#16ada6' : '#f5a01a')}<b>${esc(x.nama)}</b><small>${x.tertutup ? 'capaian dalam persen' : `${f(x.capai || 0)} dari ${f(x.target)} ${esc(x.satuan || '')}`}</small><small>${capai ? '🎉 Tercapai!' : x.sisa > 0 ? `sisa ${angka(x.sisa)} hari` : 'hari terakhir'} · ${x.tim ? 'tim' : 'saya'}</small></div>`; }).join('')}</div>` : '<p class="kosong" style="text-align:center">Belum ada target untuk periode ini.</p>'}`;
    for (const x of t) if (Number(x.persen) >= 100) { const k = `beranda-capai:${S.pengguna.id}:${x.id}:${x.kunci}`; if (!baca(k)) { simpan(k, '1'); konfeti(); } }
  };
  // ---------- Rencana kerja ----------
  const gambarRencana = () => {
    const t = d.tugas, n = t.filter(x => x.selesai).length, p = t.length ? Math.round(n / t.length * 100) : 0;
    q('[data-rencana]').innerHTML = `<div class="kepala-blok"><h3>📋 Rencana kerja</h3><b style="color:var(--teal-tua)">${n}/${t.length}</b></div><div class="brd-bar"><i style="width:${p}%"></i></div><ul class="brd-tugas">${t.length ? t.map(x => `<li class="${x.selesai ? 'selesai' : ''}"><label><input type="checkbox" data-tugas="${x.id}" ${x.selesai ? 'checked' : ''}><span><b>${esc(x.judul)}</b>${x.rincian ? `<small>${esc(x.rincian)}</small>` : ''}<small>${[ULANG[x.ulang], x.pribadi ? 'Pribadi' : '', x.tenggat ? `<span class="${x.lewat ? 'lewat' : ''}">${x.lewat ? 'lewat ' : 's.d. '}${tanggal(x.tenggat)}</span>` : ''].filter(Boolean).join(' · ')}</small></span></label>${x.pribadi ? `<button class="ikon-aksi hapus" data-buang-tugas="${x.id}" title="Hapus">${ikon('tutup')}</button>` : ''}</li>`).join('') : '<li class="kosong">Belum ada tugas.</li>'}</ul>
      <form class="brd-tambah" data-tambah onsubmit="return false"><input class="input" name="t" maxlength="200" placeholder="Tambah tugas pribadi…" aria-label="Tugas pribadi"><input class="input" type="date" name="d" aria-label="Tenggat"><button class="tombol kecil">Tambah</button></form>`;
  };
  // ---------- Motivasi ----------
  const gambarMot = () => { if (!mot.length) return; q('[data-mot]').innerHTML = `<img src="img/salma.png" alt="Kak Salma" height="170"><div class="balon"><button class="brd-geser" data-geser="-1" aria-label="Sebelumnya">${ikon('kiri')}</button><p aria-live="polite">${esc(mot[nm])}</p><button class="brd-geser" data-geser="1" aria-label="Berikutnya">${ikon('panah')}</button><small>${nm + 1} / ${mot.length}</small></div>`; };
  // ---------- Visi, misi, budaya ----------
  const gambarBudaya = () => { q('[data-budaya]').innerHTML = `<div class="kepala-blok"><h3>🌿 Tentang kita</h3><div class="brd-tab">${[['visi', 'Visi & Misi'], ['nilai', 'Budaya S.A.L.A.M.']].map(([k, l]) => `<button class="${k === tab ? 'aktif' : ''}" data-tab="${k}">${l}</button>`).join('')}</div></div>${tab === 'visi' ? `<blockquote class="brd-visi">${esc(I.visi || '')}</blockquote><ol class="brd-misi">${(I.misi || []).map(m => `<li>${esc(m)}</li>`).join('')}</ol>` : `<p style="color:var(--teks-2);margin:0 0 10px">Ketuk kartu untuk membaliknya.</p><div class="brd-nilai">${kartuNilai.map(n => `<button class="brd-kartu" aria-pressed="false" data-balik><span class="dalam"><span class="depan"><b>${esc(n.huruf)}</b><strong>${esc(n.nama)}</strong><small>${esc(n.sub || '')}</small></span><span class="belakang"><em>${esc(n.makna || '')}</em>${(n.contoh || []).map(c => `<span>✓ ${esc(c)}</span>`).join('')}</span></span></button>`).join('')}</div>`}`; };
  gambarTarget(); gambarRencana(); gambarMot(); gambarBudaya();

  const ulang = async () => { d = await rpc('beranda_saya'); if (document.body.contains(w)) gambarRencana(); };
  const coba = async f => { try { await f(); } catch (e) { toast(pesanGalat(e), 'galat'); ulang().catch(() => {}); } };
  w.addEventListener('click', e => {
    const c = s => e.target.closest(s);
    if (c('[data-per]')) { per = c('[data-per]').dataset.per; simpan('beranda-per', per); gambarTarget(); }
    if (c('[data-tab]')) { tab = c('[data-tab]').dataset.tab; gambarBudaya(); }
    if (c('[data-balik]')) { const k = c('[data-balik]'), y = k.classList.toggle('balik'); k.setAttribute('aria-pressed', y); }
    if (c('[data-geser]')) { nm = (nm + Number(c('[data-geser]').dataset.geser) + mot.length) % mot.length; gambarMot(); }
    if (c('[data-buang-tugas]')) coba(async () => { await rpc('hapus_tugas_pribadi', { p_id: Number(c('[data-buang-tugas]').dataset.buangTugas) }); await ulang(); });
  });
  w.addEventListener('change', e => {
    const id = e.target.dataset.tugas; if (!id) return;
    const t = d.tugas.find(x => x.id === Number(id)), v = e.target.checked; t.selesai = v; gambarRencana();
    if (v && d.tugas.length > 1 && d.tugas.every(x => x.selesai)) konfeti();
    coba(() => rpc('centang_tugas', { p_id: t.id, p_selesai: v }));
  });
  w.addEventListener('submit', e => { const f = e.target.closest('[data-tambah]'); if (!f) return; e.preventDefault(); if (!f.t.value.trim()) return f.t.focus(); coba(async () => { await rpc('tugas_pribadi', { p_judul: f.t.value, p_tenggat: f.d.value || null }); await ulang(); q('[data-tambah] [name=t]')?.focus(); }); });
  let x0 = null; q('[data-mot]').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  q('[data-mot]').addEventListener('touchend', e => { if (x0 === null || !mot.length) return; const s = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(s) > 40) { nm = (nm + (s < 0 ? 1 : -1) + mot.length) % mot.length; gambarMot(); } });
}
