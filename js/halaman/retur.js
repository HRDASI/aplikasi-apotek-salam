// Retur penjualan: jendela retur (dipakai di Kasir, Daftar Penjualan, dan halaman Retur), persetujuan, struk retur.
import { rute, sb, S, bisa, ambilRef, KONEKSI } from '../inti.js?v=1.19.0';
import { ikon } from '../menu.js?v=1.19.0';
import { esc, angka, rupiah, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.19.0';
import { cetakStrukHtml } from '../cetak.js?v=1.19.0';
import { ambilKonfig } from './pengaturan.js?v=1.19.0';

const ALASAN = ['Salah beli', 'Salah ambil / salah input', 'Tidak cocok / alergi', 'Kelebihan jumlah', 'Lainnya'];
const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const awalBulan = () => hariIni().slice(0, 8) + '01';
export const polaNota = v => /^(PJ|OFF)[-A-Z0-9]{6,}$/i.test(String(v || '').trim()) && /\d{3}/.test(v);
const bar = (a, b) => `<div class="r"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;

export async function cetakStrukRetur(id) {
  const [{ data: r, error }, k] = await Promise.all([
    sb.from('retur_jual').select('*, item:retur_jual_item(*, pi:penjualan_item_id(nama,satuan_nama)), jual:penjualan_id(no), metode:metode_bayar_id(nama), outlet:outlet_id(*)').eq('id', id).single(), ambilKonfig()]);
  if (error) return toast(pesanGalat(error), 'galat');
  const o = r.outlet;
  const isi = `<div class="c"><b>${esc(o.nama)}</b><br>${esc(o.alamat || '')}</div><hr><div class="c"><b>STRUK RETUR</b></div>
    ${bar(r.no, waktu(r.waktu))}${bar('Nota asal', r.jual?.no || '-')}${bar('Kasir', r.pengguna_nama || '')}${r.shift_nama ? bar('Shift', r.shift_nama) : ''}<hr>
    ${r.item.map(i => `<div class="n">${esc(i.pi?.nama || '')}</div>${bar(`  ${angka(i.qty)} ${i.pi?.satuan_nama || ''} x ${angka(i.harga)}`, angka(i.subtotal))}`).join('')}<hr>
    <div class="r besar"><span>UANG KEMBALI</span><span>${angka(r.total)}</span></div>${bar('Lewat', r.metode?.nama || 'Tunai')}${bar('Alasan', r.alasan || '-')}${r.disetujui_oleh ? bar('Disetujui', r.disetujui_oleh) : ''}<hr>
    <div style="display:flex;justify-content:space-around;text-align:center"><span>Pelanggan<br><br><br>(..........)</span><span>Kasir<br><br><br>(..........)</span></div>`;
  return cetakStrukHtml(isi, 'Retur ' + r.no, k.struk.lebar || '80');
}

// Jendela retur. awal: nomor nota / {id}. Keranjang kasir tidak disentuh.
export async function bukaRetur(awal, selesai) {
  if (KONEKSI.putus) return toast('Retur perlu internet supaya satu nota tidak diretur dua kali.', 'galat');
  if (!bisa('penjualan.retur')) return toast('Peran Anda tidak punya akses retur', 'galat');
  const metode = (await ambilRef('metode_bayar', 'id,nama,jenis,aktif,urutan', 'urutan')).filter(m => m.aktif !== false);
  let N = null, jeda, ke = 0, uuid = crypto.randomUUID(), tunggu = null, sibuk = false;
  const m = modal({ judul: 'Retur Penjualan', ukuran: 'besar', isi: `<form data-cari-nota onsubmit="return false" style="display:flex;gap:8px"><input class="input input-besar" name="q" autocomplete="off" placeholder="Scan barcode struk, ketik nomor nota, nama/HP pelanggan, atau scan barang"><button class="tombol">${ikon('cari')} Cari</button></form><div data-hasil style="margin-top:12px"><p class="kosong">Scan barcode di struk untuk langsung membuka notanya.</p></div>` });
  const el = m.el, w = el.querySelector('[data-hasil]'), f = el.querySelector('[data-cari-nota]');
  const hidup = () => document.body.contains(el);
  const galat = e => { w.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; };
  async function rpc(n, p) { const { data, error } = await sb.rpc(n, p); if (error) throw error; return data; }

  async function cari() {
    const q = f.q.value.trim(), ini = ++ke; if (q.length < 3) return toast('Ketik minimal 3 huruf/angka', 'galat');
    w.innerHTML = '<div class="kerangka-muat"><i></i><i></i></div>';
    try {
      const d = await rpc('cari_nota_retur', { p_q: q }); if (ini !== ke || !hidup()) return;
      const tepat = d.filter(x => x.tepat); if (tepat.length === 1) return buka(tepat[0].id);
      w.innerHTML = d.length ? `<div class="daftar-nota">${d.map(x => `<button type="button" class="nota-retur" data-nota="${x.id}"><b>${esc(x.no)}</b><span>${waktu(x.waktu)} · ${esc(x.pelanggan || 'Umum')} · kasir ${esc(x.kasir || '-')}</span><small>${esc(x.barang || '')}${x.jml > 4 ? ` +${x.jml - 4} lagi` : ''}</small></button>`).join('')}</div>${d.length === 10 ? '<p style="color:var(--teks-2)">Hanya 10 nota terbaru. Ketik lebih lengkap bila belum ketemu.</p>' : ''}`
        : '<p class="kosong">Nota tidak ditemukan. Coba nomor nota lengkap, atau nama/HP pelanggan (60 hari terakhir).</p>';
    } catch (e) { if (ini === ke) galat(e); }
  }
  async function buka(id) {
    const ini = ++ke; w.innerHTML = '<div class="kerangka-muat"><i></i><i></i><i></i></div>'; uuid = crypto.randomUUID();
    try {
      N = await rpc('nota_retur', { p_id: id }); if (ini !== ke || !hidup()) return;
      N.item.forEach(i => { i.sisa = Math.max(0, Number(i.qty) - Number(i.sudah)); i.n = 0; });
      const asal = N.bayar[0]?.jenis === 'piutang' ? N.bayar[0].id : metode.find(x => x.jenis === 'tunai')?.id;
      const dipakai = new Set(N.bayar.map(b => b.id)), opsi = metode.filter(x => x.jenis === 'tunai' || dipakai.has(x.id) || (x.jenis !== 'piutang' && N.penyetuju));
      w.innerHTML = `<div class="kepala-nota"><div><b>${esc(N.no)}</b><br><small>${waktu(N.waktu)} · ${esc(N.pelanggan || 'Umum')} · ${N.umur ? N.umur + ' hari lalu' : 'hari ini'}</small></div><span style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="tombol kedua kecil" data-semua>Retur semua</button><button type="button" class="tombol kedua kecil" data-ganti>Ganti nota</button></span></div>
        <div data-baris></div>
        <div class="form-grid" style="margin-top:12px"><label class="isian"><span>Alasan <i>*</i></span><select name="alasan"><option value="">- pilih -</option>${ALASAN.map(a => `<option>${a}</option>`).join('')}</select></label>
        <label class="isian"><span>Uang dikembalikan lewat</span><select name="metode">${opsi.map(x => `<option value="${x.id}" ${x.id === asal ? 'selected' : ''}>${esc(x.jenis === 'piutang' ? 'Potong piutang' : x.nama)}</option>`).join('')}</select></label>
        <label class="isian lebar sembunyi" data-lain><span>Jelaskan alasan <i>*</i></span><input name="ket" maxlength="150"></label></div>
        <label class="cek" style="margin:4px 0 10px"><input type="checkbox" name="layak"> <b>Sudah saya periksa: barang bagus/layak jual, segel dan kemasan utuh</b></label><p class="pesan info" style="margin-top:0">Barang rusak, kedaluwarsa, atau segelnya terbuka <b>tidak bisa diretur</b>.</p><div data-batas></div><div class="total-bayar"><small>Uang dikembalikan</small><b data-nilai>Rp 0</b></div><button type="button" class="tombol penuh tombol-bayar" data-proses disabled>Proses Retur</button>`;
      gambar();
    } catch (e) { if (ini === ke) galat(e); }
  }
  const nilai = () => N.item.reduce((a, i) => a + Math.round(Number(i.harga) * i.n * 100) / 100, 0);
  const sebab = () => N.penyetuju ? [] : [...N.item.filter(i => i.n > 0 && i.khusus).map(i => `${i.nama} termasuk obat keras/khusus`), ...(N.umur > N.maks_hari ? [`Nota sudah ${N.umur} hari (batas ${N.maks_hari} hari)`] : []), ...(nilai() && Number(N.sudah) + nilai() > Number(N.maks_nilai) ? [`Nilai retur di atas batas ${rupiah(N.maks_nilai)}`] : [])];
  function gambar() {
    w.querySelector('[data-baris]').innerHTML = N.item.map((i, n) => { const mati = i.paket || i.sisa <= 0; return `<div class="brs-retur ${i.n > 0 ? 'pilih' : ''}"><div class="nm"><b>${esc(i.nama)}</b>${i.khusus ? ' <span class="chip merah">obat keras</span>' : ''}<br><small>${i.paket ? 'Paket tidak bisa diretur sebagian; minta Pemilik/Apoteker membatalkan notanya.' : `dibeli ${angka(i.qty)} ${esc(i.satuan || '')}${Number(i.sudah) ? ` · sudah diretur ${angka(i.sudah)}` : ''} · ${rupiah(i.harga)}`}</small></div>
      ${mati ? (i.paket ? '' : '<span class="chip">habis diretur</span>') : `<div class="qty"><button type="button" data-min="${n}" aria-label="Kurangi">−</button><input type="number" inputmode="decimal" min="0" max="${i.sisa}" step="any" data-n="${n}" value="${i.n}" aria-label="Jumlah retur ${esc(i.nama)}"><button type="button" data-plus="${n}" aria-label="Tambah">+</button></div>
      <b class="nl">${i.n > 0 ? rupiah(i.harga * i.n) : ''}</b>`}</div>`; }).join('');
    segar();
  }
  function segar() {
    const v = nilai(), sb_ = v > 0 ? sebab() : [];
    w.querySelector('[data-nilai]').textContent = rupiah(v);
    w.querySelector('[data-batas]').innerHTML = sb_.length ? `<p class="pesan peringatan">Perlu persetujuan Pemilik/Apoteker: ${esc(sb_.join('; '))}.</p>` : '';
    const b = w.querySelector('[data-proses]'); b.disabled = !(v > 0) || sibuk; b.textContent = sb_.length ? 'Minta Persetujuan' : v > 0 ? `Proses Retur ${rupiah(v)}` : 'Proses Retur';
  }
  const setN = (n, v) => { const i = N.item[n]; i.n = Math.max(0, Math.min(i.sisa, Math.round((Number(v) || 0) * 1e4) / 1e4)); };
  const muatan = () => { const a = w.querySelector('[name=alasan]').value, k = w.querySelector('[name=ket]').value.trim(); if (!a || (a === 'Lainnya' && !k)) { toast('Isi alasan retur', 'galat'); return null; }
    if (!w.querySelector('[name=layak]').checked) { toast('Periksa barangnya dulu: harus layak jual dan segel utuh', 'galat'); return null; }
    return { uuid, layak: true, penjualan_id: N.id, metode_bayar_id: Number(w.querySelector('[name=metode]').value), shift_id: S.shift?.id ?? null, alasan: a === 'Lainnya' ? k : a + (k ? ': ' + k : ''), items: N.item.filter(i => i.n > 0).map(i => ({ penjualan_item_id: i.id, qty: i.n, kondisi: 'layak' })) }; };
  async function proses() {
    if (sibuk) return; const p = muatan(); if (!p) return;
    const perlu = sebab().length > 0; sibuk = true; segar();
    try { if (perlu) { const id = await rpc('ajukan_retur', { p }); menunggu(id); } else berhasil(await rpc('retur_penjualan', { p })); }
    catch (e) { toast(/fetch|network/i.test(e.message) ? 'Internet putus. Tekan Proses lagi setelah tersambung (tidak akan dobel).' : pesanGalat(e), 'galat'); }
    finally { sibuk = false; if (hidup() && w.querySelector('[data-proses]')) segar(); }
  }
  function berhasil(d) {
    clearTimeout(tunggu); if (hidup()) m.tutup();
    toast('Retur ' + d.no + ' tersimpan', 'sukses');
    modal({ judul: 'Retur tersimpan', ukuran: 'kecil', isi: `<div style="text-align:center"><div style="font-size:42px">✅</div><b>${esc(d.no)}</b><div class="total-bayar" style="margin-top:12px"><small>Uang dikembalikan ke pelanggan</small><b>${rupiah(d.total)}</b></div></div>`,
      tombol: [{ teks: 'Cetak Struk Retur', kelas: 'kedua', aksi: () => { cetakStrukRetur(d.id); return false; } }, { teks: 'Selesai' }] });
    selesai?.(d);
  }
  function menunggu(id) {
    const idUuid = crypto.randomUUID();
    f.classList.add('sembunyi');
    w.innerHTML = `<div style="text-align:center;padding:18px 0"><div class="kerangka-muat" style="max-width:240px;margin:0 auto 14px"><i></i></div><h3 style="margin:0">Menunggu persetujuan</h3><p style="color:var(--teks-2)">Minta Pemilik/Apoteker membuka <b>Penjualan → Retur Penjualan</b> di HP-nya. Layar ini berubah sendiri setelah disetujui. Jendela boleh ditutup; ajuan tetap ada di halaman Retur.</p><button type="button" class="tombol kedua" data-batal-ajuan>Batalkan ajuan</button></div>`;
    w.querySelector('[data-batal-ajuan]').onclick = async () => { try { await rpc('batal_ajuan_retur', { p_id: id }); clearTimeout(tunggu); m.tutup(); toast('Ajuan dibatalkan'); } catch (e) { toast(pesanGalat(e), 'galat'); } };
    const cek = async () => {
      if (!hidup()) return;
      const { data } = await sb.from('retur_ajuan').select('status,diputus_oleh,catatan,nilai').eq('id', id).maybeSingle(); if (!hidup()) return;
      if (data?.status === 'disetujui') { w.innerHTML = `<div style="text-align:center;padding:14px 0"><div style="font-size:42px">👍</div><h3 style="margin:0">Disetujui ${esc(data.diputus_oleh)}</h3>${data.catatan ? `<p>${esc(data.catatan)}</p>` : ''}<div class="total-bayar" style="margin-top:12px"><small>Uang dikembalikan</small><b>${rupiah(data.nilai)}</b></div><button type="button" class="tombol penuh" data-lanjut>Proses Retur</button></div>`; w.querySelector('[data-lanjut]').onclick = async e => { e.target.disabled = true; try { berhasil(await rpc('retur_penjualan', { p: { uuid: idUuid, ajuan_id: id } })); } catch (x) { e.target.disabled = false; toast(pesanGalat(x), 'galat'); } }; return; }
      if (data?.status === 'ditolak') { w.innerHTML = `<p class="pesan galat">Ditolak ${esc(data.diputus_oleh || '')}${data.catatan ? ': ' + esc(data.catatan) : ''}</p>`; return; }
      tunggu = setTimeout(cek, 4000);
    };
    cek();
  }
  f.onsubmit = e => { e.preventDefault(); cari(); };
  w.addEventListener('click', e => {
    const q = s => e.target.closest(s), nt = q('[data-nota]'), a = q('[data-min]'), b = q('[data-plus]');
    if (nt) buka(Number(nt.dataset.nota));
    if (a) { setN(a.dataset.min, N.item[a.dataset.min].n - 1); gambar(); }
    if (b) { setN(b.dataset.plus, N.item[b.dataset.plus].n + 1); gambar(); }
    if (q('[data-semua]')) { N.item.forEach((i, n) => { if (!i.paket) setN(n, i.sisa); }); gambar(); }
    if (q('[data-ganti]')) { ke++; N = null; w.innerHTML = '<p class="kosong">Scan barcode di struk untuk langsung membuka notanya.</p>'; f.q.value = ''; f.q.focus(); }
    if (q('[data-proses]')) proses();
  });
  w.addEventListener('input', e => { const t = e.target; if (t.dataset.n !== undefined) { setN(t.dataset.n, t.value); const r = t.closest('.brs-retur'), i = N.item[t.dataset.n]; r.classList.toggle('pilih', i.n > 0); r.querySelector('.nl').textContent = i.n > 0 ? rupiah(i.harga * i.n) : ''; segar(); } });
  w.addEventListener('change', e => { const t = e.target; if (t.dataset.n !== undefined) t.value = N.item[t.dataset.n].n;
    if (t.name === 'alasan') { w.querySelector('[data-lain]').classList.toggle('sembunyi', t.value !== 'Lainnya'); } });
  if (awal?.id) buka(awal.id); else if (awal) { f.q.value = awal; cari(); }
}

// ================= Halaman Retur =================
rute('penjualan/retur', async (el, [p]) => {
  const setuju = bisa('penjualan.retur_setuju');
  el.innerHTML = judulHalaman('Retur Penjualan', 'Penjualan / Retur Penjualan', bisa('penjualan.retur') ? `<button class="tombol" data-buat>${ikon('tambah')} Buat Retur</button>` : '') +
    `<div data-ajuan></div><div class="kartu"><div class="alat-tabel"><label>Dari <input type="date" class="input" style="width:auto" data-dari value="${awalBulan()}"></label><label>Sampai <input type="date" class="input" style="width:auto" data-sampai value="${hariIni()}"></label></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>No. Retur</th><th>Waktu</th><th>Dari Nota</th><th>Oleh</th><th>Alasan</th><th class="angka">Nilai</th><th></th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const muat = async () => {
    const { data, error } = await sb.from('retur_jual').select('*, jual:penjualan_id(id,no), item:retur_jual_item(qty,kondisi,pi:penjualan_item_id(nama))').eq('outlet_id', S.pengguna.outlet_id)
      .gte('tanggal', el.querySelector('[data-dari]').value).lte('tanggal', el.querySelector('[data-sampai]').value).order('waktu', { ascending: false }).limit(1000);
    if (error) return toast(pesanGalat(error), 'galat');
    el.querySelector('[data-isi]').innerHTML = data.length ? data.map(r => `<tr><td data-label="No"><b>${esc(r.no)}</b>${r.disetujui_oleh ? `<br><small>disetujui ${esc(r.disetujui_oleh)}</small>` : ''}</td><td data-label="Waktu">${waktu(r.waktu)}${r.shift_nama ? `<br><small>${esc(r.shift_nama)}</small>` : ''}</td>
      <td data-label="Nota">${esc(r.jual?.no || '-')}</td><td data-label="Oleh">${esc(r.pengguna_nama || '')}</td><td data-label="Alasan"><span>${esc(r.alasan || '')}<br><small>${r.item.map(i => `${esc(i.pi?.nama || '')} ×${angka(i.qty)}`).join(', ')}</small></span></td><td data-label="Nilai" class="angka">${rupiah(r.total)}</td>
      <td class="aksi"><button class="tombol kedua kecil" data-cetak="${r.id}">Struk</button></td></tr>`).join('') : '<tr><td class="kosong" colspan="7">Belum ada retur pada rentang ini.</td></tr>';
  };
  let jam;
  const muatAjuan = async () => {
    clearTimeout(jam); if (!document.body.contains(el) || !location.hash.startsWith('#/penjualan/retur')) return;
    const { data } = await sb.from('retur_ajuan').select('*').in('status', ['menunggu', 'disetujui']).gte('dibuat', new Date(Date.now() - 3 * 864e5).toISOString()).order('dibuat');
    const d = (data || []).filter(a => setuju ? a.status === 'menunggu' || a.pengaju_id === S.pengguna.id : true);
    const w = el.querySelector('[data-ajuan]'); if (!w.contains(document.activeElement)) w.innerHTML = d.length ? `<div class="kartu"><h3>Persetujuan retur (${d.length})</h3>${d.map(a => `<div class="brs-ajuan"><div class="nm"><b>${esc(a.nota)}</b> · ${esc(a.pengaju_nama)} · ${waktu(a.dibuat)}<br>${(a.rincian || []).map(i => `${esc(i.nama)} ×${angka(i.qty)}`).join(', ')}<br><small>Alasan: ${esc(a.alasan || '-')} · ${esc(a.sebab)}</small></div><b>${rupiah(a.nilai)}</b>
      <span style="display:flex;gap:6px;flex-wrap:wrap">${a.status === 'menunggu' && setuju ? `<button class="tombol kecil" data-ya="${a.id}">Setujui</button><button class="tombol kedua kecil" data-tidak="${a.id}">Tolak</button>` : a.status === 'disetujui' && a.pengaju_id === S.pengguna.id ? `<button class="tombol kecil" data-pakai="${a.id}">Proses</button>` : '<span class="chip oranye">Menunggu</span>'}</span></div>`).join('')}</div>` : '';
    jam = setTimeout(muatAjuan, 10000);
  };
  el.addEventListener('change', e => { if (e.target.matches('[data-dari],[data-sampai]')) muat(); });
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), ya = q('[data-ya]'), tdk = q('[data-tidak]'), pk = q('[data-pakai]'), c = q('[data-cetak]');
    if (q('[data-buat]')) bukaRetur(null, () => { muat(); muatAjuan(); });
    if (c) cetakStrukRetur(Number(c.dataset.cetak));
    if (ya || tdk) {
      if (!await konfirmasi(ya ? 'Setujui retur' : 'Tolak retur', ya ? 'Kasir boleh memproses retur ini dan mengembalikan uangnya. Lanjutkan?' : 'Tolak ajuan retur ini?', ya ? 'Setujui' : 'Tolak', ya ? '' : 'bahaya')) return;
      const { error } = await sb.rpc('putus_retur', { p_id: Number((ya || tdk).dataset[ya ? 'ya' : 'tidak']), p_setuju: !!ya }); toast(error ? pesanGalat(error) : ya ? 'Disetujui' : 'Ditolak', error ? 'galat' : 'sukses'); document.activeElement?.blur(); muatAjuan();
    }
    if (pk) { pk.disabled = true; const { data, error } = await sb.rpc('retur_penjualan', { p: { uuid: crypto.randomUUID(), ajuan_id: Number(pk.dataset.pakai) } }); if (error) { pk.disabled = false; return toast(pesanGalat(error), 'galat'); } toast(`Retur ${data.no} tersimpan. Kembalikan ${rupiah(data.total)}`, 'sukses'); cetakStrukRetur(data.id); document.activeElement?.blur(); muat(); muatAjuan(); }
  });
  muat(); muatAjuan();
  if (p === 'baru') { history.replaceState(null, '', '#/penjualan/retur'); bukaRetur(null, muat); }
  return 'Retur Penjualan';
});
