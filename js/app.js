import { sb, S, RUTE, rute, bisa, bisaSalahSatu, DOMAIN_AKUN, VERSI } from './inti.js?v=1.3.2';
import { MENU, ITEM, ikon } from './menu.js?v=1.3.2';
import { $, $$, esc, toast, modal, pesanGalat } from './ui.js?v=1.3.2';
import './halaman/home.js?v=1.3.2';
import './halaman/master.js?v=1.3.2';
import './halaman/pengguna.js?v=1.3.2';
import './halaman/pengaturan.js?v=1.3.2';
import './halaman/persediaan.js?v=1.3.2';
import './halaman/pembelian.js?v=1.3.2';
import './halaman/konsinyasi.js?v=1.3.2';
import { halamanSegera } from './halaman/home.js?v=1.3.2';
import { hitungPeringatan } from './halaman/persediaan.js?v=1.3.2';

const app = $('#app');
const LOGO = 'img/logo-128.png';

// ================= Login & penyiapan =================
function layarMasuk(pesan = '') {
  document.title = 'Masuk | Apotek Salam';
  app.innerHTML = `<div class="layar-masuk"><form class="kotak-masuk" autocomplete="on">
    <img class="logo" src="${LOGO}" alt="">
    <h1>Apotek Salam</h1><p class="sub">Masuk ke aplikasi apotek</p>
    ${pesan ? `<div class="pesan galat">${esc(pesan)}</div>` : ''}<div data-pesan></div>
    <label class="isian"><span>Username</span><input name="u" autocomplete="username" autocapitalize="none" required></label>
    <label class="isian"><span>Kata Sandi</span><input name="p" type="password" autocomplete="current-password" required></label>
    <label class="isian"><span>Shift</span><select name="s" data-shift><option value="">Memuat shift...</option></select></label>
    <button class="tombol penuh">Masuk</button>
    <p style="text-align:center;color:var(--teks-2);font-size:12px;margin:16px 0 0">Lupa kata sandi? Minta Pemilik mengatur ulang dari menu Daftar Pengguna.</p>
  </form></div>`;
  const f = $('form', app);
  isiPilihanShift($('[data-shift]', f));
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button', f); b.disabled = true; b.textContent = 'Memeriksa...';
    const salah = m => { $('[data-pesan]', f).innerHTML = `<div class="pesan galat">${esc(m)}</div>`; b.disabled = false; b.textContent = 'Masuk'; };
    const u = f.u.value.trim().toLowerCase();
    const { data: masuk, error } = await sb.auth.signInWithPassword({ email: u.includes('@') ? u : u + DOMAIN_AKUN, password: f.p.value });
    if (error) return salah(pesanGalat(error));
    const shiftId = f.s.value ? Number(f.s.value) : null;
    const { data: namaShift, error: e2 } = await sb.rpc('catat_masuk', { p_shift_id: shiftId });
    if (e2) { await sb.auth.signOut(); return salah(pesanGalat(e2)); }
    simpanShift(masuk.user.id, shiftId ? { id: shiftId, nama: namaShift } : { id: null, nama: 'Tanpa shift' });
    mulai();
  };
}

// ================= Shift =================
let daftarShift = null;
async function ambilShift() {
  if (!daftarShift) { const { data, error } = await sb.rpc('daftar_shift'); if (error) throw error; daftarShift = data || []; }
  return daftarShift;
}
// Shift yang sedang berjalan menurut jam sekarang (dipilih otomatis)
function shiftSekarang(list) {
  const j = new Date().toTimeString().slice(0, 5);
  const cocok = list.filter(s => s.jam_mulai && s.jam_selesai && j >= s.jam_mulai.slice(0, 5) && j < s.jam_selesai.slice(0, 5));
  return (cocok[cocok.length - 1] || list[0])?.id;
}
async function isiPilihanShift(sel, terpilih) {
  try {
    const list = await ambilShift();
    const pilih = terpilih !== undefined ? terpilih : shiftSekarang(list);
    sel.innerHTML = list.map(s => `<option value="${s.id}" ${s.id === pilih ? 'selected' : ''}>${esc(s.nama)}${s.jam_mulai ? ` (${s.jam_mulai.slice(0, 5)}–${(s.jam_selesai || '').slice(0, 5)})` : ''}</option>`).join('')
      + `<option value="" ${pilih === null ? 'selected' : ''}>Tanpa shift (khusus Pemilik/Admin)</option>`;
  } catch { sel.innerHTML = '<option value="">Tanpa shift (khusus Pemilik/Admin)</option>'; }
}
const kunciShift = uid => 'apotek-shift:' + uid;
function simpanShift(uid, s) { try { localStorage.setItem(kunciShift(uid), JSON.stringify({ ...s, tgl: new Date().toDateString() })); } catch { /* abaikan */ } }
function bacaShift(uid) {
  try { const s = JSON.parse(localStorage.getItem(kunciShift(uid)) || 'null'); return s && s.tgl === new Date().toDateString() ? s : null; } catch { return null; }
}
// Minta shift bila belum ada (mis. dibuka di perangkat lain / hari berganti)
function mintaShift(wajib) {
  return new Promise(res => {
    const m = modal({ judul: 'Pilih Shift', ukuran: 'kecil',
      isi: `<p style="margin-top:0">Pilih shift kerja Anda hari ini.</p><form onsubmit="return false"><label class="isian"><span>Shift</span><select name="s" data-shift></select></label></form>`,
      saatBuka: el => isiPilihanShift($('[data-shift]', el), S.shift ? S.shift.id : undefined),
      tombol: [...(wajib ? [{ teks: 'Keluar', kelas: 'kedua', aksi: () => { keluar(); res(null); } }] : [{ teks: 'Batal', kelas: 'kedua', aksi: () => res(null) }]),
        { teks: 'Simpan', aksi: async el => {
          const v = $('[name=s]', el).value, id = v ? Number(v) : null;
          if (id === null && !bisa('akses.tanpa_shift')) { toast('Login tanpa shift hanya untuk Pemilik/Admin. Pilih shift.', 'galat'); return false; }
          const nama = id ? (await ambilShift()).find(s => s.id === id)?.nama : 'Tanpa shift';
          await sb.rpc('catat_log', { p_modul: 'sistem', p_aksi: 'Shift', p_ket: 'Shift: ' + nama });
          S.shift = { id, nama }; simpanShift(S.pengguna.id, S.shift);
          $$('[data-info-shift]').forEach(x => x.textContent = nama);
          res(S.shift);
        } }] });
    if (wajib) m.el.querySelector('[data-tutup]').remove();
  });
}

function layarSiapkan() {
  document.title = 'Penyiapan | Apotek Salam';
  app.innerHTML = `<div class="layar-masuk"><form class="kotak-masuk">
    <img class="logo" src="${LOGO}" alt="">
    <h1>Selamat datang</h1><p class="sub">Penyiapan pertama: buat akun <b>Pemilik</b>.<br>Akun ini punya semua akses dan bisa menambah pengguna lain.</p>
    <div data-pesan></div>
    <label class="isian"><span>Nama Apotek</span><input name="apotek" value="Apotek Salam" required></label>
    <label class="isian"><span>Nama Lengkap Anda</span><input name="nama" required></label>
    <label class="isian"><span>Username</span><input name="u" required pattern="[a-z0-9._]{3,30}" autocapitalize="none" autocomplete="username"><small>Huruf kecil/angka/titik, 3-30 karakter.</small></label>
    <label class="isian"><span>Kata Sandi</span><input name="p" type="password" minlength="6" required autocomplete="new-password"></label>
    <label class="isian"><span>Ulangi Kata Sandi</span><input name="p2" type="password" minlength="6" required autocomplete="new-password"></label>
    <button class="tombol penuh">Buat Akun Pemilik</button></form></div>`;
  const f = $('form', app);
  f.onsubmit = async e => {
    e.preventDefault();
    const tampil = m => $('[data-pesan]', f).innerHTML = `<div class="pesan galat">${esc(m)}</div>`;
    if (f.p.value !== f.p2.value) return tampil('Kata sandi tidak sama.');
    const b = $('button', f); b.disabled = true;
    const u = f.u.value.trim().toLowerCase();
    const { error } = await sb.rpc('siapkan_apotek', { p_nama_apotek: f.apotek.value.trim(), p_username: u, p_nama: f.nama.value.trim(), p_sandi: f.p.value });
    if (error) { b.disabled = false; return tampil(pesanGalat(error)); }
    const { error: e2 } = await sb.auth.signInWithPassword({ email: u + DOMAIN_AKUN, password: f.p.value });
    if (e2) { b.disabled = false; return tampil(pesanGalat(e2)); }
    mulai();
  };
}

// ================= Kerangka aplikasi =================
function htmlMenu() {
  const tampilItem = i => bisaSalahSatu(i.akses);
  let h = '';
  for (const g of MENU) {
    if (!g.anak) { if (tampilItem(ITEM.find(i => i.kunci === g.k))) h += `<a href="${g.url}" data-url="${g.url}">${ikon(g.i)} ${esc(g.t)}</a>`; continue; }
    const anak = ITEM.filter(i => i.url.startsWith(`#/${g.k}/`) && tampilItem(i));
    if (!anak.length) continue;
    h += `<div class="grup" data-grup="${g.k}"><button type="button">${ikon(g.i)} ${esc(g.t)} <span class="panah">${ikon('panah')}</span></button>
      <div class="anak">${anak.map(i => `<a href="${i.url}" data-url="${i.url}">${esc(i.judul)}${i.tahap > 1 ? ` <span class="lencana segera">T${i.tahap}</span>` : ''}</a>`).join('')}</div></div>`;
  }
  return h;
}

function kerangka() {
  const o = S.outlet;
  app.innerHTML = `<div class="kerangka">
    <aside class="sidebar">
      <div class="merek"><img src="${LOGO}" alt=""><div><b>${esc(o?.nama || 'Apotek Salam')}</b><span>${esc(o?.kode || '')}</span></div></div>
      <div class="cari-fitur"><input placeholder="Cari fitur disini" data-cari-fitur><div class="hasil-cari sembunyi" data-hasil-cari></div></div>
      <nav class="menu">${htmlMenu()}</nav>
    </aside>
    <div class="tutup-sidebar" data-tutup-sidebar></div>
    <div class="utama">
      <header class="topbar">
        <button class="tombol-ikon" data-toggle-sidebar title="Menu">${ikon('menu')}</button>
        <div class="info"><small>Outlet</small><b>${esc(o?.nama || '-')}</b></div>
        <div class="info"><small>Pengguna</small><b>${esc(S.pengguna.nama.toUpperCase())}</b></div>
        <div class="info"><small>Peran</small><b>${esc(S.peran.nama)}</b></div>
        <div class="info"><small>Shift</small><b data-info-shift>${esc(S.shift?.nama || '-')}</b></div>
        <div class="kanan">
          <a class="tombol-ikon" href="#/persediaan/peringatan" data-lonceng title="Peringatan stok" style="color:#fff">${ikon('lonceng')}</a>
          <button class="tombol-ikon" data-muat title="Muat ulang">${ikon('muat')}</button>
          <button class="tombol-ikon" data-akun title="Akun">${ikon('akun')}</button>
        </div>
      </header>
      <header class="kepala-hp" data-kepala-hp></header>
      <main class="konten" data-konten></main>
      <nav class="nav-bawah">
        <a href="#/home" data-nav="home">${ikon('home')}Home</a>
        <a href="#/persediaan/produk" data-nav="persediaan">${ikon('produk')}Produk</a>
        <a href="#/penjualan/kasir" data-nav="penjualan/kasir">${ikon('kasir')}Kasir</a>
        <a href="#/penjualan/daftar" data-nav="penjualan/daftar">${ikon('penjualan')}Penjualan</a>
        <a href="#/lainnya" data-nav="lainnya">${ikon('lainnya')}Lainnya</a>
      </nav>
    </div></div>`;

  // Buka/tutup grup menu
  $('.menu').addEventListener('click', e => {
    const b = e.target.closest('.grup > button');
    if (b) b.parentElement.classList.toggle('buka');
    if (e.target.closest('a')) document.body.classList.remove('sidebar-buka');
  });
  $('[data-toggle-sidebar]').onclick = () => {
    if (innerWidth <= 900) document.body.classList.toggle('sidebar-buka');
    else { const s = $('.sidebar'); const sembunyi = s.style.transform === 'translateX(-100%)'; s.style.transform = sembunyi ? '' : 'translateX(-100%)'; $('.utama').style.marginLeft = sembunyi ? '' : '0'; }
  };
  $('[data-tutup-sidebar]').onclick = () => document.body.classList.remove('sidebar-buka');
  $('[data-muat]').onclick = () => location.reload();
  $('[data-akun]').onclick = e => { e.stopPropagation(); menuAkun(); };

  // Cari fitur
  const inp = $('[data-cari-fitur]'), hasil = $('[data-hasil-cari]');
  const daftarCari = ITEM.filter(i => bisaSalahSatu(i.akses));
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { hasil.classList.add('sembunyi'); return; }
    const cocok = daftarCari.filter(i => (i.judul + ' ' + i.grup).toLowerCase().includes(q)).slice(0, 12);
    hasil.innerHTML = cocok.length ? cocok.map((i, n) => `<a href="${i.url}" class="${n ? '' : 'aktif'}">${esc(i.judul)} <small>· ${esc(i.grup)}</small></a>`).join('') : '<a>Tidak ditemukan</a>';
    hasil.classList.remove('sembunyi');
  };
  inp.onkeydown = e => { if (e.key === 'Enter') { const a = $('a[href]', hasil); if (a) location.hash = a.getAttribute('href'); inp.value = ''; hasil.classList.add('sembunyi'); } if (e.key === 'Escape') { inp.value = ''; hasil.classList.add('sembunyi'); } };
  hasil.onclick = () => { inp.value = ''; hasil.classList.add('sembunyi'); document.body.classList.remove('sidebar-buka'); };
  document.addEventListener('click', e => { if (!e.target.closest('.cari-fitur')) hasil.classList.add('sembunyi'); if (!e.target.closest('.menu-akun')) $('.menu-akun')?.remove(); });
}

function menuAkun() {
  if ($('.menu-akun')) return $('.menu-akun').remove();
  const m = document.createElement('div');
  m.className = 'menu-akun';
  m.innerHTML = `<div class="kepala"><b>${esc(S.pengguna.nama)}</b><br><small>${esc(S.pengguna.username)} · ${esc(S.peran.nama)}</small></div>
    <button data-ganti-shift>${ikon('muat')} Ganti Shift <small style="margin-left:auto;color:var(--teks-2)">${esc(S.shift?.nama || '')}</small></button>
    <button data-sandi>${ikon('kunci')} Ganti Kata Sandi</button><button data-keluar style="color:var(--merah)">${ikon('keluar')} Keluar</button>
    <div style="padding:6px 16px 10px;color:var(--teks-2);font-size:11px">Versi ${VERSI}</div>`;
  $('.topbar').append(m);
  m.onclick = e => {
    if (e.target.closest('[data-sandi]')) { m.remove(); gantiSandi(); }
    if (e.target.closest('[data-ganti-shift]')) { m.remove(); mintaShift(false); }
    if (e.target.closest('[data-keluar]')) keluar();
  };
}

function gantiSandi() {
  modal({ judul: 'Ganti Kata Sandi', ukuran: 'kecil',
    isi: `<form onsubmit="return false"><label class="isian"><span>Kata sandi baru</span><input name="a" type="password" minlength="6" required autocomplete="new-password"></label>
      <label class="isian"><span>Ulangi kata sandi baru</span><input name="b" type="password" minlength="6" required autocomplete="new-password"></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
      const f = $('form', m); if (!f.reportValidity()) return false;
      if (f.a.value !== f.b.value) { toast('Kata sandi tidak sama', 'galat'); return false; }
      const { error } = await sb.auth.updateUser({ password: f.a.value });
      if (error) throw error;
      await sb.rpc('catat_log', { p_modul: 'akun', p_aksi: 'Ubah', p_ket: 'Ganti kata sandi sendiri' });
      toast('Kata sandi diganti', 'sukses');
    } }] });
}

async function keluar() {
  await sb.auth.signOut();
  location.hash = '';
  layarMasuk();
}

// ================= Router =================
async function tampilkan() {
  const hash = location.hash.replace(/^#\/?/, '') || 'home';
  if (hash === 'keluar') return keluar();
  if (hash === 'akun') { history.replaceState(null, '', '#/lainnya'); gantiSandi(); return tampilkan(); }
  const bagian = hash.split('/');
  const konten = $('[data-konten]');
  const url = '#/' + hash;
  // menu yang cocok: persis, atau awalan terpanjang (mis. #/pembelian/faktur/12 -> Faktur Pembelian)
  const item = ITEM.find(i => i.url === url) || ITEM.filter(i => url.startsWith(i.url + '/')).sort((a, b) => b.url.length - a.url.length)[0];

  // Tandai menu aktif
  $$('.menu a.aktif').forEach(a => a.classList.remove('aktif'));
  $$('.menu .grup.aktif-grup').forEach(a => a.classList.remove('aktif-grup'));
  const a = $(`.menu a[data-url="${item?.url || url}"]`);
  if (a) { a.classList.add('aktif'); const g = a.closest('.grup'); if (g) g.classList.add('buka', 'aktif-grup'); }
  $$('.nav-bawah a').forEach(n => n.classList.toggle('aktif', hash === n.dataset.nav || hash.startsWith(n.dataset.nav + '/')));

  let fn = RUTE[hash], param = [];
  for (let n = bagian.length - 1; !fn && n >= 1; n--) {
    const k = bagian.slice(0, n).join('/');
    if (RUTE[k]) { fn = RUTE[k]; param = bagian.slice(n); }
  }
  let judul = item?.judul || 'Home';
  if (item && !bisaSalahSatu(item.akses)) fn = el => { el.innerHTML = '<div class="kartu segera"><h3>Tidak punya akses</h3><p>Menu ini tidak dibuka untuk peran Anda. Hubungi Pemilik bila perlu.</p></div>'; };
  else if (item && item.tahap > 1) fn = halamanSegera(item);
  if (!fn) { location.hash = '#/home'; return; }

  konten.innerHTML = '';
  $$('.latar-modal').forEach(m => m.remove()); // jendela dari halaman sebelumnya ikut ditutup
  window.scrollTo(0, 0);
  try {
    const j = await fn(konten, param);
    if (typeof j === 'string') judul = j;
    if (hash.startsWith('modul/')) judul = MENU.find(m => m.k === bagian[1])?.t || judul;
  } catch (e) {
    console.error(e);
    konten.innerHTML = `<div class="pesan galat">${esc(pesanGalat(e))}</div>`;
  }
  document.title = (hash === 'home' ? '' : judul + ' | ') + 'Apotek Salam';
  kepalaHp(hash, judul);
  perbaruiLonceng();
}

// Angka di ikon lonceng = jumlah semua peringatan stok (diperbarui paling sering tiap 2 menit)
let loncengTerakhir = 0, loncengAngka = null;
async function perbaruiLonceng() {
  const item = ITEM.find(i => i.kunci === 'persediaan.peringatan');
  const tampil = bisaSalahSatu(item.akses);
  $$('[data-lonceng]').forEach(a => a.classList.toggle('sembunyi', !tampil));
  if (!tampil) return;
  if (Date.now() - loncengTerakhir > 120000) {
    loncengTerakhir = Date.now();
    try { const j = await hitungPeringatan(); loncengAngka = Object.values(j).reduce((a, b) => a + b, 0); } catch { loncengAngka = null; }
  }
  $$('[data-lonceng]').forEach(a => { a.querySelector('.titik')?.remove(); if (loncengAngka) a.insertAdjacentHTML('beforeend', `<span class="titik">${loncengAngka > 99 ? '99+' : loncengAngka}</span>`); });
}

function kepalaHp(hash, judul) {
  const k = $('[data-kepala-hp]');
  if (hash === 'home') {
    k.innerHTML = `<div class="baris"><img src="${LOGO}" alt=""><div><b>${esc(S.outlet?.nama || 'Apotek Salam')}</b><small>ID: ${esc(S.outlet?.kode || '')}</small></div>
      <div class="kanan"><a class="tombol-ikon" href="#/persediaan/peringatan" data-lonceng style="color:#fff">${ikon('lonceng')}</a><button class="tombol-ikon" onclick="location.reload()">${ikon('muat')}</button><a class="tombol-ikon" href="#/lainnya" style="color:#fff">${ikon('akun')}</a></div></div>
      <div class="sambut-hp"><div><b>Hi, ${esc(S.pengguna.nama.toUpperCase())}!</b><small>Selamat datang di Aplikasi Apotek Salam</small></div>
      <div class="sesi">Shift:<br><span data-info-shift>${esc(S.shift?.nama || '-')}</span></div></div>`;
  } else {
    k.innerHTML = `<div class="judul-hp"><button class="tombol-ikon" onclick="history.length>1?history.back():location.hash='#/home'">${ikon('kiri')}</button><b>${esc(judul)}</b></div>`;
  }
}

// ================= Mulai =================
async function mulai() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const { data: siap, error } = await sb.rpc('sudah_disiapkan');
    if (error) { app.innerHTML = `<div class="layar-masuk"><div class="kotak-masuk"><div class="pesan galat">${esc(pesanGalat(error))}</div><button class="tombol penuh" onclick="location.reload()">Coba lagi</button></div></div>`; return; }
    return siap ? layarMasuk() : layarSiapkan();
  }
  const { data: p, error } = await sb.from('pengguna').select('*, peran:peran_id(*), outlet:outlet_id(*)').eq('id', session.user.id).maybeSingle();
  if (error || !p) { await sb.auth.signOut(); return layarMasuk(error ? pesanGalat(error) : 'Akun tidak terdaftar sebagai pengguna apotek.'); }
  if (!p.aktif) { await sb.auth.signOut(); return layarMasuk('Akun Anda dinonaktifkan. Hubungi Pemilik.'); }
  S.pengguna = p; S.peran = p.peran; S.outlet = p.outlet; S.akses = p.peran.akses || [];
  S.shift = bacaShift(p.id);
  kerangka();
  tampilkan();
  if (!S.shift) {
    if (bisa('akses.tanpa_shift')) { S.shift = { id: null, nama: 'Tanpa shift' }; $$('[data-info-shift]').forEach(x => x.textContent = S.shift.nama); }
    else await mintaShift(true);
  }
}

window.addEventListener('hashchange', () => { if (S.pengguna) tampilkan(); });
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && S.pengguna) { S.pengguna = null; layarMasuk(); } });
mulai();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
