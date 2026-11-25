// Program Member model stamp: daftar member, kartu member (gambar + link publik), kirim WhatsApp,
// katalog hadiah, penukaran, aturan stamp.
import { rute, sb, S, bisa } from '../inti.js?v=1.24.0';
import { ikon } from '../menu.js?v=1.24.0';
import { esc, angka, rupiah, tanggal, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.24.0';
import { halamanCrud } from '../crud.js?v=1.24.0';

// ---------- QR code (pustaka dimuat saat perlu) ----------
let janjiQR;
function muatQR() {
  janjiQR ||= new Promise((res, rej) => {
    if (window.qrcode) return res(window.qrcode);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.onload = () => res(window.qrcode); s.onerror = rej;
    document.head.append(s);
  });
  return janjiQR;
}
function gambarQR(ctx, teks, x, y, ukuran) {
  const q = window.qrcode(0, 'M'); q.addData(teks); q.make();
  const n = q.getModuleCount(), m = ukuran / (n + 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, ukuran, ukuran);
  ctx.fillStyle = '#0a2a33';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + (c + 1) * m, y + (r + 1) * m, Math.ceil(m), Math.ceil(m));
}
let janjiLogo;
const muatLogo = () => janjiLogo ||= new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'img/logo-b-tebal.png'; });

export const linkKartu = token => location.origin + location.pathname.replace(/index\.html$/, '') + '#/kartu/' + token;

// Gambar kartu member ke canvas (1000 x 620)
export async function gambarKartu(d) {
  await muatQR();
  const logo = await muatLogo();
  const c = document.createElement('canvas'); c.width = 1000; c.height = 620;
  const x = c.getContext('2d');
  const r = (X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); };
  const g = x.createLinearGradient(0, 0, 1000, 620); g.addColorStop(0, '#16ada6'); g.addColorStop(1, '#0a5f5b');
  r(0, 0, 1000, 620, 36); x.fillStyle = g; x.fill();
  x.fillStyle = 'rgba(255,255,255,.07)'; x.beginPath(); x.arc(930, 40, 220, 0, 7); x.fill(); x.beginPath(); x.arc(60, 640, 180, 0, 7); x.fill();
  if (logo) x.drawImage(logo, 42, 42, 100, 100);
  x.fillStyle = '#fff'; x.font = '800 34px "Nunito Sans", Arial'; x.fillText(d.apotek?.nama || 'Apotek Salam', 160, 84);
  x.font = '600 20px "Nunito Sans", Arial'; x.globalAlpha = .9; x.fillText('Teman Sehat Keluarga', 160, 114); x.globalAlpha = 1;
  x.fillStyle = '#f5a01a'; r(760, 52, 190, 46, 23); x.fill();
  x.fillStyle = '#fff'; x.font = '800 22px "Nunito Sans", Arial'; x.textAlign = 'center'; x.fillText('KARTU MEMBER', 855, 83); x.textAlign = 'left';
  x.font = '800 46px "Nunito Sans", Arial'; x.fillText((d.nama || '').toUpperCase().slice(0, 26), 56, 215);
  x.font = '700 26px "Nunito Sans", Arial'; x.globalAlpha = .95; x.fillText(d.kode || '', 56, 255);
  x.font = '600 19px "Nunito Sans", Arial'; x.globalAlpha = .85; x.fillText(d.sejak ? 'Member sejak ' + tanggal(d.sejak) : '', 56, 285); x.globalAlpha = 1;
  // stamp
  const isi = Math.max(1, Math.min(20, d.isi_kartu || 10)), punya = d.stamp || 0, aktifKartu = punya % isi === 0 && punya > 0 ? isi : punya % isi;
  const kolom = Math.min(isi, 10), baris = Math.ceil(isi / kolom), uk = 52, jarak = 14, x0 = 56, y0 = 318;
  for (let i = 0; i < isi; i++) {
    const cx = x0 + (i % kolom) * (uk + jarak) + uk / 2, cy = y0 + Math.floor(i / kolom) * (uk + jarak) + uk / 2;
    x.beginPath(); x.arc(cx, cy, uk / 2, 0, 7);
    if (i < aktifKartu) { x.fillStyle = '#f5a01a'; x.fill(); x.fillStyle = '#fff'; x.font = '800 28px Arial'; x.textAlign = 'center'; x.fillText('✓', cx, cy + 10); x.textAlign = 'left'; }
    else { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; x.setLineDash([6, 5]); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '700 18px Arial'; x.textAlign = 'center'; x.fillText(String(i + 1), cx, cy + 6); x.textAlign = 'left'; }
  }
  const yTeks = y0 + baris * (uk + jarak) + 22;
  x.fillStyle = '#fff'; x.font = '800 26px "Nunito Sans", Arial'; x.fillText(`Stamp: ${angka(punya)}`, 56, yTeks);
  x.font = '600 18px "Nunito Sans", Arial'; x.globalAlpha = .9;
  x.fillText(`Dapat 1 stamp setiap belanja ${d.kelipatan ? 'kelipatan ' : 'minimal '}${rupiah(d.rp_per_stamp || 50000)}`, 56, yTeks + 30); x.globalAlpha = 1;
  // QR kode member
  r(760, 330, 190, 190, 18); x.fillStyle = '#fff'; x.fill();
  gambarQR(x, d.kode || '', 770, 340, 170);
  x.fillStyle = '#fff'; x.font = '600 16px "Nunito Sans", Arial'; x.textAlign = 'center'; x.fillText('Tunjukkan ke kasir', 855, 548); x.textAlign = 'left';
  x.font = '500 16px "Nunito Sans", Arial'; x.globalAlpha = .85;
  x.fillText([d.apotek?.alamat, d.apotek?.telp ? 'Telp ' + d.apotek.telp : ''].filter(Boolean).join(' · ').slice(0, 80), 56, 592); x.globalAlpha = 1;
  return c;
}

const noWA = t => { let n = String(t || '').replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); else if (n.startsWith('8')) n = '62' + n; return n; };
function pesanWA(d) {
  return `Halo ${d.nama}! 🎉\nIni kartu member *${d.apotek?.nama || 'Apotek Salam'}* Anda.\n\nKode member: *${d.kode}*\nStamp terkumpul: *${angka(d.stamp)}*\n\nLihat kartu & stamp Anda kapan saja:\n${d.link}\n\nKumpulkan stamp setiap belanja ${d.kelipatan ? 'kelipatan' : 'minimal'} ${rupiah(d.rp_per_stamp)} dan tukarkan dengan hadiah menarik. Terima kasih 🙏`;
}

async function dataKartu(p) {
  const [{ data: km }, { data: o }] = await Promise.all([sb.from('konfigurasi').select('nilai').eq('kunci', 'member').maybeSingle(), sb.from('outlet').select('nama,alamat,telp').eq('id', S.pengguna.outlet_id).single()]);
  const m = km?.nilai || {};
  return { nama: p.nama, kode: p.kode, stamp: p.stamp, sejak: p.tgl_member, isi_kartu: m.isi_kartu || 10, rp_per_stamp: m.rp_per_stamp || 50000, kelipatan: !!m.kelipatan, apotek: o, telp: p.telp, link: linkKartu(p.token_kartu) };
}

export async function bukaKartu(p) {
  const d = await dataKartu(p);
  const c = await gambarKartu(d);
  const url = c.toDataURL('image/png');
  const bisaBagi = !!(navigator.canShare && navigator.share);
  modal({ judul: 'Kartu Member ' + p.nama, ukuran: 'besar', isi: `<img src="${url}" style="width:100%;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.15)" alt="Kartu member">
    <div class="form-grid" style="margin-top:14px"><label class="isian"><span>No. WhatsApp member</span><input data-wa value="${esc(p.telp || '')}" placeholder="08xxxxxxxxxx"></label>
    <label class="isian"><span>Link kartu (tanpa login)</span><input value="${esc(d.link)}" readonly onclick="this.select()"></label></div>
    <p style="color:var(--teks-2);font-size:13px;margin:0">${bisaBagi ? 'Di HP: tombol <b>Bagikan</b> mengirim gambar kartu langsung ke WhatsApp.' : 'Di komputer: <b>Kirim WhatsApp</b> membuka WhatsApp dengan pesan + link kartu. Gambar kartu bisa diunduh lalu dilampirkan.'}</p>`,
    tombol: [
      { teks: 'Unduh Gambar', kelas: 'kedua', aksi: () => { const a = document.createElement('a'); a.href = url; a.download = `kartu-member-${p.kode}.png`; a.click(); return false; } },
      { teks: 'Salin Link', kelas: 'kedua', aksi: async () => { try { await navigator.clipboard.writeText(d.link); toast('Link disalin', 'sukses'); } catch { toast('Salin manual dari kotak link', 'galat'); } return false; } },
      ...(bisaBagi ? [{ teks: 'Bagikan', kelas: 'kedua', aksi: async () => {
        const blob = await (await fetch(url)).blob(); const file = new File([blob], `kartu-member-${p.kode}.png`, { type: 'image/png' });
        const data = { files: [file], text: pesanWA(d) };
        try { if (navigator.canShare(data)) await navigator.share(data); else await navigator.share({ text: pesanWA(d) }); } catch { /* dibatalkan */ }
        return false;
      } }] : []),
      { teks: 'Kirim WhatsApp', aksi: m => {
        const n = noWA(m.querySelector('[data-wa]').value);
        if (n.length < 10) { toast('Isi nomor WhatsApp yang benar', 'galat'); return false; }
        window.open(`https://wa.me/${n}?text=${encodeURIComponent(pesanWA(d))}`, '_blank');
        sb.rpc('catat_log', { p_modul: 'pelanggan', p_aksi: 'Kirim', p_ket: 'Kirim kartu member ke WA: ' + p.nama }).then(() => {});
        return false;
      } },
    ] });
}

// ---------- Halaman publik kartu (dibuka member tanpa login) ----------
export async function tampilKartuPublik(el, token) {
  document.title = 'Kartu Member';
  el.innerHTML = '<div class="layar-masuk"><div style="color:#fff">Memuat kartu...</div></div>';
  const { data, error } = await sb.rpc('kartu_member', { p_token: token });
  if (error || !data) { el.innerHTML = '<div class="layar-masuk"><div class="kotak-masuk"><h1>Kartu tidak ditemukan</h1><p class="sub">Link kartu tidak valid atau keanggotaan sudah tidak aktif. Silakan hubungi apotek.</p></div></div>'; return; }
  const c = await gambarKartu(data);
  el.innerHTML = `<div class="layar-masuk" style="align-items:start"><div style="width:100%;max-width:560px">
    <img src="${c.toDataURL('image/png')}" style="width:100%;border-radius:18px;box-shadow:0 12px 32px rgba(0,0,0,.25)" alt="Kartu member">
    <div class="kotak-masuk" style="max-width:none;margin-top:16px;padding:20px">
      <h3 style="margin:0 0 6px">Hadiah yang bisa ditukar</h3>
      ${data.hadiah.length ? data.hadiah.map(h => `<div class="baris-total"><span>${esc(h.nama)}${h.keterangan ? `<br><small>${esc(h.keterangan)}</small>` : ''}</span><span style="color:${data.stamp >= h.stamp ? 'var(--hijau)' : 'var(--teks-2)'}">${h.stamp} stamp${data.stamp >= h.stamp ? ' ✓' : ''}</span></div>`).join('') : '<p style="color:var(--teks-2)">Daftar hadiah segera hadir.</p>'}
      <p style="color:var(--teks-2);font-size:13px">Tukar stamp langsung di apotek dengan menunjukkan kartu ini.</p>
      ${data.riwayat.length ? `<h3 style="margin:14px 0 6px">Riwayat stamp</h3>${data.riwayat.map(r => `<div class="baris-total"><span>${waktu(r.waktu)} · ${esc(r.keterangan || '')}</span><span style="color:${r.stamp < 0 ? 'var(--merah)' : 'var(--hijau)'}">${r.stamp > 0 ? '+' : ''}${r.stamp}</span></div>`).join('')}` : ''}
      <p style="text-align:center;margin:16px 0 0;font-size:13px;color:var(--teks-2)">${esc(data.apotek?.nama || '')}${data.apotek?.telp ? ' · ' + esc(data.apotek.telp) : ''}<br>${esc(data.apotek?.alamat || '')}</p></div></div></div>`;
}

// ---------- Halaman Program Member ----------
const TAB = [['member', 'Member'], ['hadiah', 'Katalog Hadiah'], ['penukaran', 'Riwayat Penukaran'], ['aturan', 'Aturan Stamp']];
rute('promo/member', async (el, [tab]) => {
  const aktif = TAB.some(t => t[0] === tab) ? tab : 'member';
  const { data: km } = await sb.from('konfigurasi').select('nilai').eq('kunci', 'member').maybeSingle();
  const m = { aktif: false, rp_per_stamp: 50000, kelipatan: false, maks_per_transaksi: 0, isi_kartu: 10, ...(km?.nilai || {}) };
  el.innerHTML = judulHalaman('Program Member', 'Program Promo / Program Member') +
    `${!m.aktif ? '<p class="pesan peringatan">Program member <b>belum aktif</b>, jadi stamp belum diberikan saat belanja. Aktifkan di tab <a href="#/promo/member/aturan">Aturan Stamp</a>.</p>' : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${TAB.map(([k, l]) => `<a class="tombol kecil ${k === aktif ? '' : 'kedua'}" href="#/promo/member/${k}">${l}</a>`).join('')}</div><div data-isi></div>`;
  const isi = el.querySelector('[data-isi]');
  if (aktif === 'member') return tabMember(isi, m);
  if (aktif === 'hadiah') return halamanCrud(cfgHadiah)(isi);
  if (aktif === 'penukaran') return tabPenukaran(isi);
  return tabAturan(isi, m);
});

async function tabMember(el, m) {
  const boleh = bisa('promo.member');
  el.innerHTML = `<div class="kartu"><div class="alat-tabel"><div class="cari">${ikon('cari')}<input class="input" data-q placeholder="Cari nama / kode / no. HP member..."></div>
    ${boleh ? `<button class="tombol" data-daftar style="margin-left:auto">${ikon('tambah')} Daftarkan Member</button>` : ''}</div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Kode</th><th>Nama</th><th>No. HP</th><th class="angka">Stamp</th><th>Member sejak</th><th></th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  let data = [];
  const muat = async () => {
    const q = el.querySelector('[data-q]').value.replace(/[,()%*]/g, ' ').trim();
    let k = sb.from('pelanggan').select('id,kode,nama,telp,stamp,tgl_member,token_kartu').eq('member', true).order('nama').limit(500);
    if (q) k = k.or(`nama.ilike.%${q}%,kode.ilike.%${q}%,telp.ilike.%${q}%`);
    const { data: d, error } = await k;
    if (error) return toast(pesanGalat(error), 'galat');
    data = d;
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map((p, i) => `<tr><td data-label="Kode"><b>${esc(p.kode || '')}</b></td><td data-label="Nama">${esc(p.nama)}</td><td data-label="No. HP">${esc(p.telp || '')}</td>
      <td data-label="Stamp" class="angka"><span class="chip ${p.stamp > 0 ? 'oranye' : ''}">${angka(p.stamp)}</span></td><td data-label="Sejak">${tanggal(p.tgl_member)}</td>
      <td class="aksi"><button class="tombol kecil" data-kartu="${i}">Kartu</button> <button class="tombol kecil kedua" data-tukar="${i}">Tukar</button>${boleh ? ` <button class="tombol kecil kedua" data-stamp="${i}">± Stamp</button>` : ''}</td></tr>`).join('')
      : '<tr><td class="kosong" colspan="6">Belum ada member. Klik <b>Daftarkan Member</b>.</td></tr>';
  };
  let jeda; el.querySelector('[data-q]').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(muat, 300); });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kartu) bukaKartu(data[b.dataset.kartu]).catch(er => toast(pesanGalat(er), 'galat'));
    if (b.dataset.tukar) tukarHadiah(data[b.dataset.tukar], muat);
    if (b.dataset.stamp) stampManual(data[b.dataset.stamp], muat);
    if (b.hasAttribute('data-daftar')) daftarMember(muat);
  });
  muat();
}

function daftarMember(setelah) {
  let pilih = null, hasil = [];
  modal({ judul: 'Daftarkan Member', isi: `<p style="margin-top:0;color:var(--teks-2)">Cari pelanggan yang sudah ada, atau isi data pelanggan baru.</p>
    <label class="isian"><span>Cari pelanggan lama</span><div style="position:relative"><input class="input" data-cari placeholder="Nama / no. HP"><div class="hasil-cari sembunyi" data-hasil style="left:0;right:0;top:44px"></div></div></label>
    <div data-terpilih></div>
    <form class="form-grid" onsubmit="return false" data-baru><label class="isian"><span>Nama lengkap <i>*</i></span><input name="nama"></label>
      <label class="isian"><span>No. WhatsApp <i>*</i></span><input name="telp" type="tel" placeholder="08xxxxxxxxxx"></label>
      <label class="isian"><span>Tanggal lahir</span><input name="tgl" type="date"></label>
      <label class="isian"><span>Jenis kelamin</span><select name="jk"><option value="">-</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
      <label class="isian lebar"><span>Alamat</span><input name="alamat"></label></form>`,
    saatBuka: m => {
      const i = m.querySelector('[data-cari]'), h = m.querySelector('[data-hasil]'); let jd;
      i.oninput = () => { clearTimeout(jd); const q = i.value.replace(/[,()%*]/g, ' ').trim(); if (!q) { h.classList.add('sembunyi'); return; }
        jd = setTimeout(async () => { const { data } = await sb.from('pelanggan').select('id,nama,telp,member,kode').or(`nama.ilike.%${q}%,telp.ilike.%${q}%`).limit(8); hasil = data || [];
          h.innerHTML = hasil.length ? hasil.map((p, n) => `<a data-p="${n}"><b>${esc(p.nama)}</b> <small>${esc(p.telp || '')}${p.member ? ' · sudah member' : ''}</small></a>`).join('') : '<a>Tidak ditemukan, isi data baru di bawah</a>';
          h.classList.remove('sembunyi'); }, 250); };
      h.onmousedown = e => { const a = e.target.closest('[data-p]'); if (!a) return; e.preventDefault(); pilih = hasil[a.dataset.p]; h.classList.add('sembunyi'); i.value = pilih.nama;
        m.querySelector('[data-terpilih]').innerHTML = `<p class="pesan info">Dipilih: <b>${esc(pilih.nama)}</b>${pilih.member ? ' (sudah member)' : ''}</p>`; m.querySelector('[data-baru]').classList.add('sembunyi'); };
    },
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Daftarkan', aksi: async m => {
      let id = pilih?.id;
      if (!id) {
        const f = m.querySelector('[data-baru]');
        if (!f.nama.value.trim() || !f.telp.value.trim()) { toast('Isi nama dan no. WhatsApp', 'galat'); return false; }
        const { data, error } = await sb.from('pelanggan').insert({ nama: f.nama.value.trim(), telp: f.telp.value.trim(), tgl_lahir: f.tgl.value || null, jenis_kelamin: f.jk.value || null, alamat: f.alamat.value || null, aktif: true }).select('id').single();
        if (error) throw error; id = data.id;
      }
      const { data: p, error } = await sb.rpc('jadikan_member', { p_pelanggan_id: id }); if (error) throw error;
      toast('Member ' + p.kode + ' terdaftar', 'sukses'); setelah?.();
      setTimeout(() => bukaKartu(p).catch(() => {}), 300);
    } }] });
}

async function tukarHadiah(p, setelah) {
  const { data: h } = await sb.from('member_hadiah').select('*, produk:produk_id(nama)').eq('aktif', true).order('stamp');
  if (!h?.length) return toast('Katalog hadiah masih kosong. Isi di tab Katalog Hadiah.', 'galat');
  const m = modal({ judul: `Tukar Stamp: ${p.nama}`, isi: `<p style="margin-top:0">Stamp dimiliki: <b>${angka(p.stamp)}</b></p>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Hadiah</th><th class="angka">Stamp</th><th></th></tr></thead><tbody>
    ${h.map((x, i) => `<tr><td><b>${esc(x.nama)}</b>${x.produk ? `<br><small style="color:var(--teks-2)">Produk: ${esc(x.produk.nama)} ×${angka(x.qty)} (stok berkurang otomatis)</small>` : ''}</td><td class="angka">${x.stamp}</td>
      <td class="aksi"><button class="tombol kecil" data-h="${i}" ${p.stamp < x.stamp ? 'disabled' : ''}>Tukar</button></td></tr>`).join('')}</tbody></table></div>`, tombol: [{ teks: 'Tutup', kelas: 'kedua' }] });
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-h]'); if (!b) return;
    const x = h[b.dataset.h];
    if (!await konfirmasi('Tukar hadiah', `Tukar <b>${x.stamp} stamp</b> milik ${esc(p.nama)} dengan <b>${esc(x.nama)}</b>?`, 'Ya, tukar', '')) return;
    const { data, error } = await sb.rpc('tukar_hadiah', { p_pelanggan_id: p.id, p_hadiah_id: x.id });
    if (error) return toast(pesanGalat(error), 'galat');
    m.tutup(); toast(`Berhasil (${data.no}). Sisa stamp ${data.sisa_stamp}`, 'sukses'); setelah?.();
  });
}

function stampManual(p, setelah) {
  modal({ judul: 'Tambah / Kurangi Stamp', ukuran: 'kecil', isi: `<p style="margin-top:0">${esc(p.nama)} · stamp sekarang <b>${angka(p.stamp)}</b></p>
    <form onsubmit="return false"><label class="isian"><span>Jumlah (minus untuk mengurangi)</span><input name="n" type="number" step="1" required></label>
    <label class="isian"><span>Keterangan <i>*</i></span><input name="k" required placeholder="mis. pindahan kartu kertas lama"></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
      const f = m.querySelector('form'); if (!f.reportValidity()) return false;
      const { error } = await sb.rpc('tambah_stamp_manual', { p_pelanggan_id: p.id, p_jumlah: Number(f.n.value), p_keterangan: f.k.value }); if (error) throw error;
      toast('Stamp diperbarui', 'sukses'); setelah?.();
    } }] });
}

const cfgHadiah = {
  judul: 'Katalog Hadiah', remah: 'Program Member / Katalog Hadiah', tabel: 'member_hadiah', satuan: 'Hadiah', kunciTulis: ['promo.member'],
  kolom: [{ f: 'nama', label: 'Nama Hadiah', wajib: true }, { f: 'stamp', label: 'Jumlah Stamp', tipe: 'angka', wajib: true, min: 1 },
    { f: 'produk_id', label: 'Produk (bila hadiah dari stok)', tipe: 'ref', ref: 'produk', bantu: 'Kosongkan bila hadiah bukan barang stok (mis. voucher/merchandise).' },
    { f: 'qty', label: 'Jumlah produk (satuan terkecil)', tipe: 'angka', min: 0, daftar: false },
    { f: 'keterangan', label: 'Keterangan', tipe: 'area', daftar: false }, { f: 'urutan', label: 'Urutan', tipe: 'angka', daftar: false }, { f: 'aktif', label: 'Aktif', tipe: 'bool' }],
  urut: 'stamp', bawaan: { aktif: true, qty: 1, urutan: 0 },
};

async function tabPenukaran(el) {
  el.innerHTML = `<div class="kartu"><div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>No</th><th>Waktu</th><th>Member</th><th>Hadiah</th><th class="angka">Stamp</th><th>Oleh</th><th>Status</th><th></th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const muat = async () => {
    const { data, error } = await sb.from('penukaran_hadiah').select('*, pelanggan:pelanggan_id(nama,kode)').order('waktu', { ascending: false }).limit(300);
    if (error) return toast(pesanGalat(error), 'galat');
    el.querySelector('[data-isi]').innerHTML = data.length ? data.map(t => `<tr><td data-label="No"><b>${esc(t.no)}</b></td><td data-label="Waktu">${waktu(t.waktu)}</td><td data-label="Member">${esc(t.pelanggan?.nama || '')}</td>
      <td data-label="Hadiah">${esc(t.nama_hadiah || '')}</td><td data-label="Stamp" class="angka">${t.stamp}</td><td data-label="Oleh">${esc(t.pengguna_nama || '')}</td>
      <td data-label="Status"><span class="chip ${t.status === 'batal' ? 'merah' : 'hijau'}">${t.status}</span></td>
      <td class="aksi">${t.status === 'selesai' && bisa('promo.member') ? `<button class="tombol kecil kedua" data-batal="${t.id}">Batalkan</button>` : ''}</td></tr>`).join('') : '<tr><td class="kosong" colspan="8">Belum ada penukaran.</td></tr>';
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-batal]'); if (!b) return;
    if (!await konfirmasi('Batalkan penukaran', 'Stamp dikembalikan ke member dan stok hadiah dikembalikan. Lanjutkan?', 'Batalkan')) return;
    const { error } = await sb.rpc('batal_penukaran', { p_id: Number(b.dataset.batal) }); if (error) return toast(pesanGalat(error), 'galat');
    toast('Dibatalkan'); muat();
  });
  muat();
}

function tabAturan(el, m) {
  const boleh = bisa('promo.member');
  el.innerHTML = `<div class="kartu" style="max-width:640px"><form onsubmit="return false">
    <label class="cek"><input type="checkbox" name="aktif" ${m.aktif ? 'checked' : ''}> <b>Program member aktif</b> (stamp diberikan otomatis di kasir)</label>
    <label class="isian"><span>Belanja untuk 1 stamp (Rp)</span><input type="number" min="1" name="rp_per_stamp" value="${m.rp_per_stamp}"></label>
    <label class="cek"><input type="checkbox" name="kelipatan" ${m.kelipatan ? 'checked' : ''}> Berlaku kelipatan (mis. belanja Rp 100.000 = 2 stamp)</label>
    <label class="isian"><span>Maksimal stamp per transaksi</span><input type="number" min="0" name="maks_per_transaksi" value="${m.maks_per_transaksi}"><small>0 = tanpa batas. Hanya berlaku bila kelipatan aktif.</small></label>
    <label class="isian"><span>Jumlah kotak stamp di kartu</span><input type="number" min="1" max="20" name="isi_kartu" value="${m.isi_kartu}"></label>
    <p class="pesan info" data-contoh></p>${boleh ? '<button class="tombol" data-simpan>Simpan Aturan</button>' : ''}</form></div>`;
  const f = el.querySelector('form');
  if (!boleh) f.querySelectorAll('input').forEach(i => i.disabled = true);
  const contoh = () => { const rp = Number(f.rp_per_stamp.value || 0), mk = Number(f.maks_per_transaksi.value || 0);
    const hit = t => t < rp ? 0 : f.kelipatan.checked ? (mk ? Math.min(Math.floor(t / rp), mk) : Math.floor(t / rp)) : 1;
    el.querySelector('[data-contoh]').textContent = rp > 0 ? `Contoh: belanja ${rupiah(rp - 1000)} → ${hit(rp - 1000)} stamp · ${rupiah(rp)} → ${hit(rp)} stamp · ${rupiah(rp * 3)} → ${hit(rp * 3)} stamp.` : ''; };
  f.oninput = contoh; f.onchange = contoh; contoh();
  el.querySelector('[data-simpan]')?.addEventListener('click', async e => {
    e.target.disabled = true;
    const nilai = { aktif: f.aktif.checked, rp_per_stamp: Number(f.rp_per_stamp.value), kelipatan: f.kelipatan.checked, maks_per_transaksi: Number(f.maks_per_transaksi.value || 0), isi_kartu: Number(f.isi_kartu.value || 10) };
    const { error } = await sb.from('konfigurasi').upsert({ kunci: 'member', nilai, diubah: new Date().toISOString() });
    e.target.disabled = false;
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Aturan disimpan', 'sukses'); window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
