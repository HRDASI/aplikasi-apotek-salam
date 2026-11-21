import { sb, S, RUTE, rute, bisaSalahSatu, DOMAIN_AKUN, VERSI } from './inti.js?v=1.0.1';
import { MENU, ITEM, ikon } from './menu.js?v=1.0.1';
import { $, $$, esc, toast, modal, pesanGalat } from './ui.js?v=1.0.1';
import './halaman/home.js?v=1.0.1';
import './halaman/master.js?v=1.0.1';
import './halaman/pengguna.js?v=1.0.1';
import './halaman/pengaturan.js?v=1.0.1';
import { halamanSegera } from './halaman/home.js?v=1.0.1';

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
    <button class="tombol penuh">Masuk</button>
    <p style="text-align:center;color:var(--teks-2);font-size:12px;margin:16px 0 0">Lupa kata sandi? Minta Pemilik mengatur ulang dari menu Daftar Pengguna.</p>
  </form></div>`;
  const f = $('form', app);
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button', f); b.disabled = true; b.textContent = 'Memeriksa...';
    const u = f.u.value.trim().toLowerCase();
    const { error } = await sb.auth.signInWithPassword({ email: u.includes('@') ? u : u + DOMAIN_AKUN, password: f.p.value });
    if (error) { $('[data-pesan]', f).innerHTML = `<div class="pesan galat">${esc(pesanGalat(error))}</div>`; b.disabled = false; b.textContent = 'Masuk'; return; }
    await sb.rpc('catat_masuk'); // builder supabase baru jalan saat di-await
    mulai();
  };
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
        <div class="kanan">
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
    <button data-sandi>${ikon('kunci')} Ganti Kata Sandi</button><button data-keluar style="color:var(--merah)">${ikon('keluar')} Keluar</button>
    <div style="padding:6px 16px 10px;color:var(--teks-2);font-size:11px">Versi ${VERSI}</div>`;
  $('.topbar').append(m);
  m.onclick = e => {
    if (e.target.closest('[data-sandi]')) { m.remove(); gantiSandi(); }
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
  const item = ITEM.find(i => i.url === url);

  // Tandai menu aktif
  $$('.menu a.aktif').forEach(a => a.classList.remove('aktif'));
  $$('.menu .grup.aktif-grup').forEach(a => a.classList.remove('aktif-grup'));
  const a = $(`.menu a[data-url="${url}"]`);
  if (a) { a.classList.add('aktif'); const g = a.closest('.grup'); if (g) g.classList.add('buka', 'aktif-grup'); }
  $$('.nav-bawah a').forEach(n => n.classList.toggle('aktif', hash === n.dataset.nav || hash.startsWith(n.dataset.nav + '/')));

  let fn = RUTE[hash], param = [];
  if (!fn && RUTE[bagian[0]]) { fn = RUTE[bagian[0]]; param = bagian.slice(1); }
  let judul = item?.judul || 'Home';
  if (item && !bisaSalahSatu(item.akses)) fn = el => { el.innerHTML = '<div class="kartu segera"><h3>Tidak punya akses</h3><p>Menu ini tidak dibuka untuk peran Anda. Hubungi Pemilik bila perlu.</p></div>'; };
  else if (item && item.tahap > 1) fn = halamanSegera(item);
  if (!fn) { location.hash = '#/home'; return; }

  konten.innerHTML = '';
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
}

function kepalaHp(hash, judul) {
  const k = $('[data-kepala-hp]');
  if (hash === 'home') {
    k.innerHTML = `<div class="baris"><img src="${LOGO}" alt=""><div><b>${esc(S.outlet?.nama || 'Apotek Salam')}</b><small>ID: ${esc(S.outlet?.kode || '')}</small></div>
      <div class="kanan"><button class="tombol-ikon" onclick="location.reload()">${ikon('muat')}</button><a class="tombol-ikon" href="#/lainnya" style="color:#fff">${ikon('akun')}</a></div></div>
      <div class="sambut-hp"><div><b>Hi, ${esc(S.pengguna.nama.toUpperCase())}!</b><small>Selamat datang di Aplikasi Apotek Salam</small></div>
      <div class="sesi">Peran:<br><span>${esc(S.peran.nama)}</span></div></div>`;
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
  kerangka();
  tampilkan();
}

window.addEventListener('hashchange', () => { if (S.pengguna) tampilkan(); });
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && S.pengguna) { S.pengguna = null; layarMasuk(); } });
mulai();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
