// Penjualan: Kasir (dengan sesi), Pesanan, Daftar, Retur, Tertolak, QRIS, Riwayat Sesi, cetak struk.
import { rute, sb, S, bisa, lihatNominal, ambilRef, ambilSemua, muatSesi, KONEKSI, HOOK, atauOffline, putusJaringan } from '../inti.js?v=1.16.0';
import * as OFF from '../offline.js?v=1.16.0';
import { ikon } from '../menu.js?v=1.16.0';
import { esc, angka, rupiah, tanggal, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman, unduhCSV, bacaForm } from '../ui.js?v=1.16.0';
import { pasangCariProduk, infoProduk, chipStatus } from '../dokumen.js?v=1.16.0';
import { halamanCrud } from '../crud.js?v=1.16.0';
import { ambilKonfig } from './pengaturan.js?v=1.16.0';
import { cetakStrukHtml } from '../cetak.js?v=1.16.0';
import { ambilResep, cetakEtiket } from './pelayanan.js?v=1.16.0';
import { bukaRetur, polaNota } from './retur.js?v=1.16.0';
import { barcodeHtml } from '../label.js?v=1.16.0';

const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const awalBulan = () => hariIni().slice(0, 8) + '01';

// ================= Sesi =================

function bukaSesiForm(el, selesai) {
  el.innerHTML = judulHalaman('Kasir', 'Penjualan / Kasir') + `<div class="kartu" style="max-width:460px;margin:20px auto">
    <h3>Buka Sesi Kasir</h3><p style="color:var(--teks-2);margin-top:0">Hitung uang di laci kasir sebelum mulai berjualan.</p>
    <form onsubmit="return false"><label class="isian"><span>Kas awal (uang di laci)</span><input name="kas" type="number" min="0" step="any" value="0" required></label>
    <label class="isian"><span>Shift</span><input value="${esc(S.shift?.nama || 'Tanpa shift')}" disabled><small>Shift mengikuti pilihan saat login (bisa diganti lewat menu akun).</small></label>
    <button class="tombol penuh">Buka Sesi</button></form></div>`;
  const f = el.querySelector('form');
  f.onsubmit = async e => {
    e.preventDefault();
    const b = f.querySelector('button'); b.disabled = true;
    try {
      const data = await atauOffline(async () => { const { data, error } = await sb.rpc('buka_sesi', { p_kas_awal: Number(f.kas.value || 0), p_shift_id: S.shift?.id ?? null }); if (error) throw error; return data; }, () => OFF.bukaSesiL(Number(f.kas.value || 0)));
      toast('Sesi ' + data.kode + ' dibuka', 'sukses');
      await muatSesi(); selesai();
    } catch (x) { b.disabled = false; toast(pesanGalat(x), 'galat'); }
  };
  setTimeout(() => f.kas.select(), 50);
}

async function tampilRingkasanSesi(s, r) {
  const per = Object.entries(r.per_metode || {});
  if (r.tertutup || !lihatNominal()) return `<table class="tabel" style="margin-bottom:12px"><tbody><tr><td>Kode sesi</td><td class="angka"><b>${esc(s.kode)}</b></td></tr><tr><td>Kasir</td><td class="angka">${esc(s.pengguna_nama)}${s.shift_nama ? ' · ' + esc(s.shift_nama) : ''}</td></tr><tr><td>Dibuka</td><td class="angka">${waktu(s.dibuka)}</td></tr><tr><td>Jumlah transaksi</td><td class="angka">${r.transaksi}${r.batal ? ` (+${r.batal} batal)` : ''}</td></tr><tr><td>Retur</td><td class="angka">${angka(r.retur_jml)}</td></tr><tr><td>Kas awal</td><td class="angka">${rupiah(r.kas_awal)}</td></tr></tbody></table>`;
  return `<table class="tabel" style="margin-bottom:12px"><tbody>
    <tr><td>Kode sesi</td><td class="angka"><b>${esc(s.kode)}</b></td></tr><tr><td>Kasir</td><td class="angka">${esc(s.pengguna_nama)}${s.shift_nama ? ' · ' + esc(s.shift_nama) : ''}</td></tr>
    <tr><td>Dibuka</td><td class="angka">${waktu(s.dibuka)}</td></tr><tr><td>Jumlah transaksi</td><td class="angka">${r.transaksi}${r.batal ? ` (+${r.batal} batal)` : ''}</td></tr>
    <tr><td>Total penjualan</td><td class="angka"><b>${rupiah(r.omzet)}</b></td></tr>
    ${per.map(([m, v]) => `<tr><td style="padding-left:24px">${esc(m)}</td><td class="angka">${rupiah(v)}</td></tr>`).join('')}
    <tr><td>Kas awal</td><td class="angka">${rupiah(r.kas_awal)}</td></tr><tr><td>Tunai masuk</td><td class="angka">${rupiah(r.tunai_masuk)}</td></tr>
    <tr><td>Kembalian</td><td class="angka">- ${rupiah(r.kembalian)}</td></tr><tr><td>Retur dibayar tunai</td><td class="angka">- ${rupiah(r.retur_tunai)}</td></tr>
    ${Number(r.kas_lain) ? `<tr><td>Kas lain lewat laci (Buku Kas)</td><td class="angka">${rupiah(r.kas_lain)}</td></tr>` : ''}
    <tr><td><b>Uang seharusnya di laci</b></td><td class="angka"><b>${rupiah(r.kas_sistem)}</b></td></tr></tbody></table>`;
}

async function tutupSesi(s, setelah) {
  if (KONEKSI.putus || !s.id) return tutupSesiOffline(s, setelah);
  if ((await OFF.daftarAntre()).length) { await OFF.sinkron(); if ((await OFF.daftarAntre()).some(a => a.jenis === 'jual' && a.data.sesi_id === s.id)) toast('Ada penjualan offline yang belum terkirim. Rekap sesi akan dihitung ulang setelah sinkron.', 'galat'); }
  const { data: r, error } = await sb.rpc('ringkasan_sesi', { p_id: s.id });
  if (error) return putusJaringan(error) && OFF.siap() ? tutupSesiOffline(s, setelah) : toast(pesanGalat(error), 'galat');
  modal({ judul: 'Tutup Sesi ' + s.kode, isi: await tampilRingkasanSesi(s, r) + `<form onsubmit="return false">
      <label class="isian"><span>Uang fisik di laci (hasil hitung) <i>*</i></span><input name="fisik" type="number" step="any" min="0" required></label>
      <p data-selisih style="font-weight:700;margin:-4px 0 10px"></p>
      <label class="isian"><span>Catatan</span><textarea name="cat" rows="2"></textarea></label></form>`,
    saatBuka: m => { const i = m.querySelector('[name=fisik]'); if (lihatNominal()) i.oninput = () => { const d = Number(i.value || 0) - r.kas_sistem; m.querySelector('[data-selisih]').innerHTML = i.value === '' ? '' : `Selisih: <span style="color:${d === 0 ? 'var(--hijau)' : 'var(--merah)'}">${d > 0 ? '+' : ''}${rupiah(d)}</span>`; }; },
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Tutup Sesi', kelas: 'bahaya', aksi: async m => {
      const f = m.querySelector('form'); if (!f.reportValidity()) return false;
      const { data: t, error: e2 } = await sb.rpc('tutup_sesi', { p_id: s.id, p_kas_fisik: Number(f.fisik.value), p_catatan: f.cat.value || null });
      if (e2) throw e2;
      toast('Sesi ditutup', 'sukses');
      await muatSesi();
      cetakRekapSesi(t);
      setelah?.();
    } }] });
}

async function tutupSesiOffline(s, setelah) {
  const r = await OFF.ringkasanLokal(s);
  modal({ judul: 'Tutup Sesi ' + s.kode, ukuran: 'kecil', isi: `<p class="pesan info" style="margin-top:0">Offline: selisih kas dihitung setelah data tersinkron.</p>
    <div class="baris-total"><span>Penjualan offline di perangkat ini</span><span>${angka(r.transaksi)} nota</span></div>${!lihatNominal() ? '' : `<div class="baris-total"><span>Nilai</span><span>${rupiah(r.omzet)}</span></div>`}${!lihatNominal() ? '' : Object.entries(r.per_metode).map(([k, v]) => `<div class="baris-total"><span>${esc(k)}</span><span>${rupiah(v)}</span></div>`).join('')}
    <form onsubmit="return false" style="margin-top:12px"><label class="isian"><span>Uang fisik di laci <i>*</i></span><input name="fisik" type="number" step="any" min="0" required></label><label class="isian"><span>Catatan</span><textarea name="cat" rows="2"></textarea></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Tutup Sesi', kelas: 'bahaya', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await OFF.tutupSesiL(s, Number(f.fisik.value), f.cat.value || null); toast('Sesi ditutup, menunggu sinkron', 'sukses'); OFF.sinkron(); setelah?.(); } }] });
}

async function cetakRekapSesi(s) {
  const r = s.ringkasan || (await sb.rpc('ringkasan_sesi', { p_id: s.id })).data;
  const lebar = await lebarStruk();
  bukaJendelaCetak(`<div class="c"><b>REKAP SESI KASIR</b><br>${esc(s.kode)}</div><hr>
    ${baris('Kasir', s.pengguna_nama)}${s.shift_nama ? baris('Shift', s.shift_nama) : ''}${baris('Buka', waktu(s.dibuka))}${s.ditutup ? baris('Tutup', waktu(s.ditutup)) : ''}<hr>
    ${r.tertutup ? baris('Transaksi', r.transaksi) + baris('Retur', r.retur_jml ?? 0) + baris('Kas awal', rupiah(r.kas_awal)) + baris('Kas fisik', rupiah(s.kas_fisik)) : `${baris('Transaksi', r.transaksi)}${baris('Penjualan', rupiah(r.omzet))}${Object.entries(r.per_metode || {}).map(([k, v]) => baris('  ' + k, rupiah(v))).join('')}<hr>
    ${baris('Kas awal', rupiah(r.kas_awal))}${baris('Tunai masuk', rupiah(r.tunai_masuk))}${baris('Kembalian', '-' + rupiah(r.kembalian))}${baris('Retur tunai', '-' + rupiah(r.retur_tunai))}${Number(r.kas_lain) ? baris('Kas lain (laci)', rupiah(r.kas_lain)) : ''}
    ${baris('Kas sistem', rupiah(r.kas_sistem))}${s.kas_fisik !== null && s.kas_fisik !== undefined ? baris('Kas fisik', rupiah(s.kas_fisik)) + baris('Selisih', rupiah(s.selisih)) : ''}`}<hr>
    <div class="c">Ttd kasir<br><br><br>( ${esc(s.pengguna_nama)} )</div>`, lebar, 'Rekap ' + s.kode);
}

// ================= Struk =================
// Cetak lewat modul cetak.js: Agen Cetak (langsung ke printer) atau dialog cetak.
export async function lebarStruk() { return (await ambilKonfig()).struk.lebar || '80'; }
export const baris = (a, b) => `<div class="r"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
async function bukaJendelaCetak(isi, lebar, judul) { return cetakStrukHtml(isi, judul, lebar); }
export async function cetakStruk(id) {
  const [{ data: j, error }, k] = await Promise.all([
    sb.from('penjualan').select('*, item:penjualan_item(*), bayar:penjualan_bayar(*, metode:metode_bayar_id(nama)), pelanggan:pelanggan_id(nama,stamp), dokter:dokter_id(nama), outlet:outlet_id(*)').eq('id', id).single(),
    ambilKonfig(),
  ]);
  if (error) return toast(pesanGalat(error), 'galat');
  return cetakNota(j, k);
}
export async function cetakNota(j, k) {
  const o = j.outlet, ks = k.struk;
  const logo = ks.tampil_logo ? `<img src="${location.href.split('#')[0].replace(/[^/]*$/, '')}img/logo-128.png" style="width:40px"><br>` : '';
  const items = j.item.sort((a, b) => a.id - b.id).map(i => `<div class="n">${esc(i.nama)}</div>${baris(`  ${angka(i.qty)} ${i.satuan_nama || ''} x ${angka(i.harga)}`, angka(i.qty * i.harga))}
    ${i.diskon_promo > 0 ? baris('  Promo', '-' + angka(i.diskon_promo)) : ''}${i.diskon_manual > 0 ? baris(`  Diskon ${angka(i.diskon_persen)}%`, '-' + angka(i.diskon_manual)) : ''}`).join('');
  const pot = [['Diskon pelanggan', j.diskon_pelanggan], ['Diskon', j.diskon_nota], ['Voucher', j.potongan_voucher], [`Tukar ${angka(j.poin_dipakai)} poin`, j.potongan_poin]]
    .filter(x => x[1] > 0).map(([a, b]) => baris(a, '-' + angka(b))).join('');
  bukaJendelaCetak(`<div class="c">${logo}<b>${esc(o.nama)}</b><br>${esc(o.alamat || '')}${o.telp ? '<br>Telp ' + esc(o.telp) : ''}</div><hr>
    ${baris(j.no, waktu(j.waktu))}${baris('Kasir', j.pengguna_nama || '')}${j.pelanggan ? baris('Pelanggan', j.pelanggan.nama) : ''}${j.dokter ? baris('Dokter', j.dokter.nama) : ''}${j.no_resep ? baris('No. resep', j.no_resep) : ''}<hr>
    ${items}<hr>${baris('Subtotal', angka(j.subtotal))}${pot}${j.jasa_racik > 0 ? baris('Jasa racik', angka(j.jasa_racik)) : ''}${j.jasa_resep > 0 ? baris('Jasa resep', angka(j.jasa_resep)) : ''}${j.embalase > 0 ? baris('Embalase', angka(j.embalase)) : ''}${j.tuslah > 0 ? baris('Tuslah', angka(j.tuslah)) : ''}
    ${j.pembulatan !== 0 ? baris('Pembulatan', angka(j.pembulatan)) : ''}<div class="r" style="font-size:13px;font-weight:bold"><span>TOTAL</span><span>${angka(j.total)}</span></div>
    ${j.bayar.map(b => baris(b.metode?.nama || 'Bayar', angka(b.jumlah))).join('')}${baris('Kembali', angka(j.kembalian))}
    ${j.stamp_didapat > 0 ? baris('Stamp member', `+${angka(j.stamp_didapat)} (total ${angka(j.pelanggan?.stamp)})`) : ''}${j.status === 'batal' ? '<div class="c"><b>*** DIBATALKAN ***</b></div>' : ''}${j.no.startsWith('OFF-') ? '<div class="c">Nota sementara (offline)</div>' : ''}<hr>
    ${ks.tampil_apoteker && o.apoteker ? `<div class="c">Apoteker: ${esc(o.apoteker)}${o.sipa ? '<br>SIPA ' + esc(o.sipa) : ''}</div>` : ''}
    <div class="c">${esc(o.catatan_struk || '')}</div>${await barcodeHtml(j.no, Number(await lebarStruk()) === 58 ? 48 : 72)}<div class="c" style="font-size:9px">${esc(j.no)} · simpan struk untuk retur</div>`, await lebarStruk(), 'Struk ' + j.no);
}

// ================= Kasir =================
const kosongkan = () => ({ items: [], header: { jenis_pelayanan_id: null, pelanggan_id: null, dokter_id: null, no_resep: '', diskon_nota: 0, voucher_kode: '', poin_dipakai: 0 }, pelanggan: null, pesanan_id: null, resep: null, hasil: null });
let K = kosongkan();

rute('penjualan/kasir', async el => {
  await muatSesi();
  // resep yang dikirim dari Penebusan Resep
  const rk = sessionStorage.getItem('resep-ke-kasir');
  if (rk) {
    sessionStorage.removeItem('resep-ke-kasir');
    const d = JSON.parse(rk);
    K = kosongkan();
    K.resep = d;
    K.header.dokter_id = d.dokter_id || null;
    K.header.no_resep = d.no;
    if (d.pelanggan_id) K.pelanggan = (await sb.from('pelanggan').select('id,nama,telp,kode,member,stamp').eq('id', d.pelanggan_id).single()).data;
    const info = await infoProduk(d.items.map(i => i.produk_id));
    const jp = await ambilRef('jenis_pelayanan', 'id,nama,aktif');
    K.header.jenis_pelayanan_id = jp.find(x => x.nama === 'Resep')?.id || null;
    K.items = d.items.map(i => ({ produk_id: i.produk_id, nama: info[i.produk_id]?.nama, golongan: info[i.produk_id]?.golongan, satuan_id: i.satuan_id || info[i.produk_id]?.satuan_id,
      satuanDasar: info[i.produk_id]?.satuan_id, satuanOpsi: info[i.produk_id]?.satuanOpsi, qty: i.qty, diskon_persen: 0, resep: true }));
  }
  if (!S.sesi) { bukaSesiForm(el, () => tampilKasir(el)); return 'Kasir'; }
  await tampilKasir(el);
  return 'Kasir';
});

async function tampilKasir(induk) {
  // wadah baru setiap digambar ulang supaya event listener tidak menumpuk
  const el = document.createElement('div');
  induk.replaceChildren(el);
  induk = el.parentElement;
  const tampilKasir_ = () => tampilKasir(induk);
  const [jp, dokter, metode, k] = await Promise.all([ambilRef('jenis_pelayanan', 'id,nama,aktif'), ambilRef('dokter', 'id,nama'), ambilRef('metode_bayar', 'id,nama,jenis,aktif,urutan', 'urutan'), ambilKonfig()]);
  const bundel = await atauOffline(async () => { const { data, error } = await sb.from('promo_bundel').select('id,nama,harga').eq('aktif', true).order('nama'); if (error) throw error; return data; }, OFF.bundelL);
  if (!K.header.jenis_pelayanan_id) K.header.jenis_pelayanan_id = jp.find(x => x.nama === 'Umum')?.id || jp[0]?.id || null;
  el.innerHTML = `<div class="kasir">
    <div class="kartu kasir-kiri">
      <div class="kasir-atas"><b>Kasir</b><span class="chip teal">Sesi ${esc(S.sesi.kode)}</span>${S.sesi.shift_nama ? `<span class="chip">${esc(S.sesi.shift_nama)}</span>` : ''}
        <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
          <button class="tombol kedua kecil" data-pesanan>${ikon('penjualan')} Pesanan</button>
          ${bisa('penjualan.retur') ? '<button class="tombol kedua kecil" data-retur title="Retur penjualan (F4)">↩ Retur</button>' : ''}
          <button class="tombol kedua kecil" data-tertolak>Catat Tertolak</button>
          <button class="tombol kedua kecil" data-printer title="Ukuran printer perangkat ini">🖨</button>
          <button class="tombol kedua kecil" data-tutup-sesi>Tutup Sesi</button></span></div>
      <div style="display:flex;gap:8px;margin:10px 0"><div style="flex:1"><input class="input input-besar" data-cari placeholder="Cari nama/kode obat atau scan barcode (F2)"></div>
        ${bundel?.length ? `<select class="input" style="width:auto" data-paket><option value="">+ Paket</option>${bundel.map(b => `<option value="${b.id}">${esc(b.nama)} · ${rupiah(b.harga)}</option>`).join('')}</select>` : ''}</div>
      ${K.resep ? `<p class="pesan info" style="margin:0 0 8px">Menebus resep <b>${esc(K.resep.no)}</b> a.n. ${esc(K.resep.pasien)}${K.resep.racikan_ditebus ? ` · ${K.resep.racikan_ditebus} racikan` : ''}${K.resep.etiket ? ' · etiket dicetak setelah bayar' : ''}. <a href="#" data-lepas-resep>Lepas</a></p>` : ''}
      ${K.pesanan_id ? `<p class="pesan info" style="margin:0 0 8px">Mengerjakan pesanan <b>${esc(K.pesanan_no || '')}</b>${K.header.nama_pemesan ? ' atas nama ' + esc(K.header.nama_pemesan) : ''}. <a href="#" data-lepas-pesanan>Lepas</a></p>` : ''}
      <div class="bungkus-tabel"><table class="tabel tabel-kasir"><thead><tr><th>Produk</th><th>Satuan</th><th class="angka">Jumlah</th><th class="angka">Harga</th><th class="angka">Disk %</th><th class="angka">Subtotal</th><th></th></tr></thead><tbody data-keranjang></tbody></table></div>
    </div>
    <div class="kartu kasir-kanan">
      <label class="isian"><span>Pelanggan</span><div style="position:relative"><input class="input" data-cari-pelanggan placeholder="Cari nama / no. HP (opsional)" value="${esc(K.pelanggan?.nama || '')}"><div class="hasil-cari sembunyi" data-hasil-pelanggan style="left:0;right:0;top:44px"></div></div>
        <small data-info-pelanggan>${K.pelanggan ? `${K.pelanggan.member ? `<span class="chip oranye">Member ${esc(K.pelanggan.kode || '')}</span> stamp ${angka(K.pelanggan.stamp)} · ` : ''}<a href="#" data-hapus-pelanggan>hapus</a>` : ''}</small></label>
      <label class="isian"><span>Jenis Pelayanan</span><select data-h="jenis_pelayanan_id">${jp.filter(x => x.aktif !== false).map(x => `<option value="${x.id}" ${x.id === K.header.jenis_pelayanan_id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select></label>
      <div data-resep class="form-grid" style="gap:0 10px">
        <label class="isian"><span>Dokter</span><select data-h="dokter_id"><option value="">- pilih -</option>${dokter.map(d => `<option value="${d.id}" ${d.id === K.header.dokter_id ? 'selected' : ''}>${esc(d.nama)}</option>`).join('')}</select></label>
        <label class="isian"><span>No. Resep</span><input data-h="no_resep" value="${esc(K.header.no_resep || '')}"></label></div>
      <div class="form-grid" style="gap:0 10px">
        <label class="isian"><span>Diskon nota (Rp)</span><input type="number" min="0" step="any" data-h="diskon_nota" value="${K.header.diskon_nota || ''}"></label>
        <label class="isian"><span>Kode voucher</span><input data-h="voucher_kode" value="${esc(K.header.voucher_kode || '')}" style="text-transform:uppercase"></label></div>
      <div data-galat></div>
      <div data-total class="kasir-total"></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="tombol kedua" data-tunda title="Simpan sebagai pesanan / tunda">Tunda</button>
        <button class="tombol penuh tombol-bayar" data-bayar>BAYAR (F9)</button></div>
      <button class="tombol kedua kecil" style="margin-top:8px;width:100%" data-kosongkan>Kosongkan keranjang</button>
    </div>
    <div class="kasir-bawah hanya-hp"><div><small>Total</small><b data-total-hp>Rp 0</b></div><button class="tombol tombol-bayar" data-bayar>BAYAR</button></div>
  </div>`;

  const keranjang = el.querySelector('[data-keranjang]');
  let jedaHitung, urutHitung = 0;
  const gambarKeranjang = () => {
    keranjang.innerHTML = K.items.length ? K.items.map((r, i) => {
      const h = K.hasil?.items?.[i];
      const opsi = r.bundel_id ? `<span class="chip">paket</span>` : `<select class="input" data-i="${i}" data-f="satuan_id" style="min-width:90px">${(r.satuanOpsi || []).map(s => `<option value="${s.satuan_id}" ${s.satuan_id === r.satuan_id ? 'selected' : ''}>${esc(s.nama)}</option>`).join('')}</select>`;
      return `<tr><td data-label="Produk"><b>${esc(r.nama)}</b>${r.golongan === 'keras' ? ' <span class="gol keras" title="Obat keras"></span>' : ''}<br><small style="color:var(--teks-2)">${r.stok !== undefined ? 'stok ' + angka(r.stok) : ''}</small></td>
        <td data-label="Satuan">${opsi}</td>
        <td data-label="Jumlah" class="angka"><div class="qty"><button data-kurang="${i}">−</button><input type="number" min="0" step="any" data-i="${i}" data-f="qty" value="${r.qty}"><button data-tambah="${i}">+</button></div></td>
        <td data-label="Harga" class="angka">${h ? rupiah(h.harga) : '…'}${h?.diskon_promo > 0 ? `<br><small class="chip oranye">promo -${rupiah(h.diskon_promo)}</small>` : ''}</td>
        <td data-label="Disk %" class="angka"><input type="number" min="0" max="100" step="any" class="input" style="width:64px;text-align:right" data-i="${i}" data-f="diskon_persen" value="${r.diskon_persen || ''}"></td>
        <td data-label="Subtotal" class="angka"><b>${h ? rupiah(h.subtotal) : '…'}</b></td>
        <td class="aksi"><button class="ikon-aksi hapus" data-hapus="${i}">${ikon('hapus')}</button></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="kosong">Keranjang kosong. Cari obat atau scan barcode.</td></tr>';
  };
  const gambarTotal = () => {
    const h = K.hasil;
    const t = el.querySelector('[data-total]');
    if (!h || !K.items.length) { t.innerHTML = '<div class="baris-total besar"><span>TOTAL</span><span>Rp 0</span></div>'; el.querySelector('[data-total-hp]').textContent = 'Rp 0'; return; }
    const r = (l, v, c = '') => v ? `<div class="baris-total ${c}"><span>${l}</span><span>${v}</span></div>` : '';
    t.innerHTML = r('Subtotal', rupiah(h.subtotal)) + (h.diskon_pelanggan > 0 ? r('Diskon pelanggan', '- ' + rupiah(h.diskon_pelanggan)) : '') + (h.diskon_nota > 0 ? r('Diskon nota', '- ' + rupiah(h.diskon_nota)) : '')
      + (h.potongan_voucher > 0 ? r('Voucher', '- ' + rupiah(h.potongan_voucher)) : '') + (h.potongan_poin > 0 ? r(`Tukar ${angka(h.poin_dipakai)} poin`, '- ' + rupiah(h.potongan_poin)) : '')
      + (h.jasa_racik > 0 ? r('Jasa racik', rupiah(h.jasa_racik)) : '') + (h.jasa_resep > 0 ? r('Jasa pelayanan resep', rupiah(h.jasa_resep)) : '') + (h.embalase > 0 ? r('Embalase', rupiah(h.embalase)) : '') + (h.tuslah > 0 ? r('Tuslah', rupiah(h.tuslah)) : '') + (h.pembulatan ? r('Pembulatan', rupiah(h.pembulatan)) : '')
      + r('TOTAL', rupiah(h.total), 'besar') + (h.stamp_didapat > 0 ? r('Stamp member didapat', '+' + angka(h.stamp_didapat)) : '');
    el.querySelector('[data-total-hp]').textContent = rupiah(h.total);
    el.querySelector('[data-resep]').classList.toggle('wajib-resep', !!h.perlu_resep);
  };
  const muatanHitung = () => ({ ...K.header, pelanggan_id: K.pelanggan?.id || null, resep_id: K.resep?.resep_id || null, racikan_ditebus: K.resep?.racikan_ditebus || 0,
    items: K.items.map(r => r.bundel_id ? { bundel_id: r.bundel_id, qty: r.qty, diskon_persen: r.diskon_persen || 0 } : { produk_id: r.produk_id, satuan_id: r.satuan_id, qty: r.qty, diskon_persen: r.diskon_persen || 0, resep: !!r.resep }) });
  async function hitung() {
    const galat = el.querySelector('[data-galat]');
    if (!K.items.length) { K.hasil = null; galat.innerHTML = ''; gambarKeranjang(); gambarTotal(); return; }
    const n = ++urutHitung;
    let data, error = null; const p = muatanHitung();
    try { data = await atauOffline(async () => { const r = await sb.rpc('hitung_penjualan', { p }); if (r.error) throw r.error; return r.data; }, () => OFF.hitungL(p)); } catch (e) { error = e; }
    if (n !== urutHitung) return;
    if (error) { galat.innerHTML = `<div class="pesan galat">${esc(pesanGalat(error))}</div>`; K.hasil = null; }
    else { galat.innerHTML = data.perlu_resep && data.wajib_resep && !K.header.dokter_id && !K.header.no_resep ? '<div class="pesan peringatan">Ada obat keras: isi dokter atau nomor resep.</div>' : ''; K.hasil = data; }
    gambarKeranjang(); gambarTotal();
  }
  const hitungNanti = () => { clearTimeout(jedaHitung); jedaHitung = setTimeout(hitung, 250); };

  async function tambah(p) {
    const ada = K.items.find(r => !r.resep && r.produk_id === p.id && r.satuan_id === (r.satuanDasar));
    if (ada) { ada.qty = Number(ada.qty) + 1; hitung(); return; }
    const info = (await infoProduk([p.id]))[p.id];
    K.items.push({ produk_id: p.id, nama: p.nama, golongan: info?.golongan, satuan_id: info.satuan_id, satuanDasar: info.satuan_id, satuanOpsi: info.satuanOpsi, qty: 1, diskon_persen: 0, stok: p.stok });
    if (p.stok <= 0) toast(`Stok ${p.nama} di sistem habis`, 'galat');
    await hitung();
  }
  // scan barcode struk di kolom cari obat langsung membuka retur
  el.querySelector('[data-cari]').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !polaNota(e.target.value) || !bisa('penjualan.retur')) return;
    e.preventDefault(); e.stopImmediatePropagation(); const no = e.target.value.trim(); e.target.value = ''; e.target.dispatchEvent(new Event('input', { bubbles: true })); bukaRetur(no).catch(x => toast(pesanGalat(x), 'galat'));
  });
  pasangCariProduk(el.querySelector('[data-cari]'), p => tambah(p).catch(e => toast(pesanGalat(e), 'galat')));
  el.querySelector('[data-paket]')?.addEventListener('change', e => {
    const b = bundel.find(x => String(x.id) === e.target.value); e.target.value = '';
    if (!b) return;
    const ada = K.items.find(r => r.bundel_id === b.id);
    if (ada) ada.qty = Number(ada.qty) + 1; else K.items.push({ bundel_id: b.id, nama: 'Paket ' + b.nama, qty: 1, diskon_persen: 0 });
    hitung();
  });

  el.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.i !== undefined && t.tagName === 'INPUT') { K.items[t.dataset.i][t.dataset.f] = t.value === '' ? 0 : Number(t.value); hitungNanti(); }
    if (t.dataset.h && t.tagName === 'INPUT') { K.header[t.dataset.h] = t.type === 'number' ? Number(t.value || 0) : t.value.trim(); hitungNanti(); }
  });
  el.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.f === 'satuan_id') { K.items[t.dataset.i].satuan_id = Number(t.value); hitung(); }
    if (t.dataset.h && t.tagName === 'SELECT') { K.header[t.dataset.h] = t.value ? Number(t.value) : null; hitung(); }
  });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button, a'); if (!b) return;
    if (b.dataset.hapus) { K.items.splice(b.dataset.hapus, 1); hitung(); }
    if (b.dataset.tambah) { K.items[b.dataset.tambah].qty = Number(K.items[b.dataset.tambah].qty) + 1; hitung(); }
    if (b.dataset.kurang) { const r = K.items[b.dataset.kurang]; r.qty = Math.max(1, Number(r.qty) - 1); hitung(); }
    if (b.hasAttribute('data-bayar')) bayar();
    if (b.hasAttribute('data-tunda')) tunda();
    if (b.hasAttribute('data-kosongkan') && K.items.length && await konfirmasi('Kosongkan', 'Kosongkan keranjang?', 'Kosongkan')) { K = kosongkan(); tampilKasir_(); }
    if (b.hasAttribute('data-tutup-sesi')) tutupSesi(S.sesi, () => location.hash = '#/home');
    if (b.hasAttribute('data-pesanan')) daftarPesanan(el);
    if (b.hasAttribute('data-tertolak')) catatTertolak();
    if (b.hasAttribute('data-retur')) bukaRetur().catch(x => toast(pesanGalat(x), 'galat'));
    if (b.hasAttribute('data-printer')) aturPrinter();
    if (b.hasAttribute('data-hapus-pelanggan')) { e.preventDefault(); K.pelanggan = null; K.header.poin_dipakai = 0; tampilKasir_(); }
    if (b.hasAttribute('data-lepas-resep')) { e.preventDefault(); K = kosongkan(); tampilKasir_(); }
    if (b.hasAttribute('data-lepas-pesanan')) { e.preventDefault(); K.pesanan_id = null; K.pesanan_no = null; tampilKasir_(); }
  });

  // pelanggan
  const ip = el.querySelector('[data-cari-pelanggan]'), hp = el.querySelector('[data-hasil-pelanggan]');
  let jedaP, hasilP = [];
  ip.addEventListener('input', () => {
    clearTimeout(jedaP);
    const q = ip.value.replace(/[,()%*]/g, ' ').trim();
    if (!q) { hp.classList.add('sembunyi'); return; }
    jedaP = setTimeout(async () => {
      hasilP = await atauOffline(async () => { const { data, error } = await sb.from('pelanggan').select('id,nama,telp,kode,member,stamp,kategori:kategori_pelanggan_id(nama,diskon_persen)').eq('aktif', true).or(`nama.ilike.%${q}%,telp.ilike.%${q}%,kode.ilike.%${q}%`).limit(10); if (error) throw error; return data; }, () => OFF.pelangganL(q)).catch(() => []);
      hp.innerHTML = hasilP.length ? hasilP.map((p, i) => `<a data-p="${i}"><b>${esc(p.nama)}</b> <small>${esc(p.kode || '')} ${esc(p.telp || '')}${p.member ? ' · member, stamp ' + angka(p.stamp) : ''}${p.kategori ? ' · ' + esc(p.kategori.nama) : ''}</small></a>`).join('') : '<a>Tidak ditemukan</a>';
      hp.classList.remove('sembunyi');
    }, 250);
  });
  hp.addEventListener('mousedown', e => { const a = e.target.closest('[data-p]'); if (!a) return; e.preventDefault(); K.pelanggan = hasilP[a.dataset.p]; tampilKasir_(); });
  ip.addEventListener('blur', () => setTimeout(() => hp.classList.add('sembunyi'), 150));

  async function bayar() {
    if (!K.items.length) return toast('Keranjang masih kosong', 'galat');
    await hitung();
    if (!K.hasil) return toast('Periksa pesan di kanan dulu', 'galat');
    const h = K.hasil;
    if (h.perlu_resep && h.wajib_resep && !K.header.dokter_id && !K.header.no_resep) return toast('Ada obat keras: isi dokter atau nomor resep.', 'galat');
    const uuid = crypto.randomUUID();       // kode unik: menekan Bayar dua kali / internet putus tidak membuat nota dobel
    let pernahKirim = false;
    const aktif = metode.filter(m => m.aktif !== false && (!KONEKSI.putus || OFF.METODE_OFFLINE.includes(m.jenis)));
    const tunaiId = aktif.find(m => m.jenis === 'tunai')?.id ?? aktif[0]?.id;
    const qris = await atauOffline(async () => { const { data, error } = await sb.from('konfigurasi').select('nilai').eq('kunci', 'qris').maybeSingle(); if (error) throw error; return data?.nilai; }, () => OFF.konfigL('qris')).catch(() => null);
    const opsiMetode = v => aktif.map(m => `<option value="${m.id}" data-jenis="${m.jenis}" ${m.id === v ? 'selected' : ''}>${esc(m.nama)}</option>`).join('');
    const barisBayar = (v, j) => `<div class="baris-bayar"><select class="input" data-metode>${opsiMetode(v)}</select><input class="input" type="number" min="0" step="any" data-jumlah value="${j ?? ''}" placeholder="Jumlah"><input class="input" data-ref placeholder="No. ref (opsional)"><button class="ikon-aksi hapus" data-hapus-bayar>${ikon('tutup')}</button></div>`;
    const cepat = [h.total, ...[5000, 10000, 20000, 50000, 100000].filter(v => v > h.total)].slice(0, 5);
    modal({ judul: KONEKSI.putus ? 'Pembayaran (offline)' : 'Pembayaran', isi: `<div class="total-bayar"><small>Total bayar</small><b>${rupiah(h.total)}</b></div>
      <div data-daftar-bayar>${barisBayar(tunaiId, '')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${cepat.map((v, i) => `<button class="tombol kedua kecil" data-cepat="${v}">${i ? rupiah(v) : 'Uang pas'}</button>`).join('')}
        <button class="tombol kedua kecil" data-tambah-bayar style="margin-left:auto">+ Metode lain</button></div>
      <div data-qris class="sembunyi" style="text-align:center;margin:10px 0">${qris?.gambar ? `<img src="${qris.gambar}" style="max-width:260px;width:100%;border-radius:12px"><br><small>Minta pelanggan scan, lalu cek notifikasi dana masuk sebelum menekan Bayar.</small>` : '<p class="pesan peringatan">Gambar QRIS belum diunggah (menu Penjualan → QRIS).</p>'}</div>
      <div class="total-bayar kecil"><small>Dibayar</small><b data-dibayar>Rp 0</b><small>Kembalian</small><b data-kembali>Rp 0</b></div>`,
      saatBuka: m => {
        const segar = () => {
          const rows = [...m.querySelectorAll('.baris-bayar')];
          const tot = rows.reduce((a, r) => a + Number(r.querySelector('[data-jumlah]').value || 0), 0);
          m.querySelector('[data-dibayar]').textContent = rupiah(tot);
          const kembali = tot - h.total;
          m.querySelector('[data-kembali]').textContent = kembali >= 0 ? rupiah(kembali) : 'Kurang ' + rupiah(-kembali);
          m.querySelector('[data-kembali]').style.color = kembali >= 0 ? 'var(--hijau)' : 'var(--merah)';
          m.querySelector('[data-qris]').classList.toggle('sembunyi', !rows.some(r => r.querySelector('[data-metode]').selectedOptions[0]?.dataset.jenis === 'qris'));
        };
        m.addEventListener('input', segar); m.addEventListener('change', segar);
        m.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          const rows = m.querySelectorAll('.baris-bayar');
          if (b.dataset.cepat) { rows[0].querySelector('[data-jumlah]').value = b.dataset.cepat; segar(); }
          if (b.hasAttribute('data-tambah-bayar')) {
            const sudah = [...rows].reduce((a, r) => a + Number(r.querySelector('[data-jumlah]').value || 0), 0);
            m.querySelector('[data-daftar-bayar]').insertAdjacentHTML('beforeend', barisBayar(aktif.find(x => x.jenis === 'qris')?.id ?? aktif[1]?.id, Math.max(h.total - sudah, 0)));
            segar();
          }
          if (b.hasAttribute('data-hapus-bayar') && rows.length > 1) { b.closest('.baris-bayar').remove(); segar(); }
        });
        m.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); m.querySelector('footer .tombol:last-child').click(); } });
        setTimeout(() => m.querySelector('[data-jumlah]').focus(), 60);
      },
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Bayar', aksi: async m => {
        const byr = [...m.querySelectorAll('.baris-bayar')].map(r => ({ metode_bayar_id: Number(r.querySelector('[data-metode]').value), jumlah: Number(r.querySelector('[data-jumlah]').value || 0), referensi: r.querySelector('[data-ref]').value || null })).filter(x => x.jumlah > 0);
        if (!byr.length) { toast('Isi jumlah pembayaran', 'galat'); return false; }
        const p = { ...muatanHitung(), uuid, pesanan_id: K.pesanan_id, resep_tebus: K.resep?.resep_tebus || [], bayar: byr };
        const data = await atauOffline(async () => { pernahKirim = true; const { data, error } = await sb.rpc('bayar_penjualan_u', { p }); if (error) throw error; return data; }, async () => {
          const perluServer = p.resep_id || p.pesanan_id || p.voucher_kode || byr.some(b => !OFF.METODE_OFFLINE.includes(metode.find(m => m.id === b.metode_bayar_id)?.jenis));
          if (perluServer) throw new Error(pernahKirim ? 'Internet putus saat membayar. Biarkan jendela ini terbuka, lalu tekan Bayar lagi setelah tersambung (tidak akan dobel).' : 'Voucher, piutang, pesanan, dan tebus resep terdaftar perlu internet.');
          const nonTunai = byr.filter(b => metode.find(m => m.id === b.metode_bayar_id)?.jenis !== 'tunai');
          if (nonTunai.length && !await konfirmasi('Pastikan uang masuk', `Anda sedang offline. Sudah dicek di HP/mutasi bank bahwa <b>${rupiah(nonTunai.reduce((a, b) => a + b.jumlah, 0))}</b> benar-benar masuk?`, 'Sudah masuk', '')) throw new Error('Pembayaran belum dikonfirmasi.');
          const hl = pernahKirim ? h : OFF.hitungL(p);
          return OFF.jualL(uuid, p, hl, byr, byr.reduce((a, b) => a + b.jumlah, 0) - hl.total);
        });
        if (!data.offline) OFF.sinkron();
        const resepTadi = K.resep;
        K = kosongkan();
        tampilKasir_();
        selesaiBayar(data, k, resepTadi);
      } }] });
  }

  function selesaiBayar(d, k, resep) {
    const cetak = () => d.offline ? cetakNota(d.struk, k) : cetakStruk(d.id);
    if (k.struk.cetak_otomatis) cetak();
    if (resep?.etiket) ambilResep(resep.resep_id).then(r => cetakEtiket(r, resep.etiket_item)).catch(e => toast(pesanGalat(e), 'galat'));
    modal({ judul: 'Transaksi berhasil', ukuran: 'kecil', isi: `<div style="text-align:center"><div style="font-size:42px">✅</div><b>${esc(d.no)}</b>${d.offline ? '<p class="pesan info" style="margin:10px 0 0">Tersimpan di perangkat, dikirim otomatis saat online.</p>' : ''}
      <div class="total-bayar" style="margin-top:12px"><small>Total</small><b>${rupiah(d.total)}</b><small>Kembalian</small><b style="color:var(--hijau);font-size:28px">${rupiah(d.kembalian)}</b></div>
      ${d.stamp_didapat > 0 ? `<p class="pesan info">Member mendapat <b>+${angka(d.stamp_didapat)} stamp</b> (total ${angka(d.stamp_total)})</p>` : ''}</div>`,
      tombol: [{ teks: 'Cetak Struk', kelas: 'kedua', aksi: () => { cetak(); return false; } }, { teks: 'Transaksi Baru', aksi: () => setTimeout(() => document.querySelector('[data-cari]')?.focus(), 50) }] });
  }

  function tunda() {
    if (!K.items.length) return toast('Keranjang masih kosong', 'galat');
    modal({ judul: K.pesanan_id ? 'Perbarui Pesanan' : 'Tunda / Simpan Pesanan', ukuran: 'kecil', isi: `<form onsubmit="return false">
      <label class="isian"><span>Nama pemesan / keterangan</span><input name="nama" value="${esc(K.header.nama_pemesan || K.pelanggan?.nama || '')}" placeholder="mis. Bu Ani, ambil sore"></label>
      <label class="isian"><span>Catatan</span><textarea name="cat" rows="2"></textarea></label></form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form');
        const { data, error } = await sb.rpc('simpan_pesanan', { p: { ...muatanHitung(), id: K.pesanan_id, nama_pemesan: f.nama.value, catatan: f.cat.value } });
        if (error) throw error;
        toast('Disimpan sebagai pesanan ' + data.no, 'sukses');
        K = kosongkan(); tampilKasir_();
      } }] });
  }

  async function daftarPesanan() {
    const { data, error } = await sb.from('penjualan').select('*, item:penjualan_item(*)').eq('status', 'pesanan').eq('outlet_id', S.pengguna.outlet_id).order('waktu', { ascending: false });
    if (error) return toast(pesanGalat(error), 'galat');
    const m = modal({ judul: 'Pesanan / Transaksi Tertunda', ukuran: 'besar', isi: data.length ? `<div class="bungkus-tabel"><table class="tabel"><thead><tr><th>No</th><th>Waktu</th><th>Pemesan</th><th>Barang</th><th class="angka">Total</th><th></th></tr></thead><tbody>
      ${data.map((p, i) => `<tr><td>${esc(p.no)}</td><td>${waktu(p.waktu)}</td><td>${esc(p.nama_pemesan || '-')}</td><td>${p.item.length} item</td><td class="angka">${rupiah(p.total)}</td>
        <td class="aksi"><button class="tombol kecil" data-ambil="${i}">Ambil</button> <button class="ikon-aksi hapus" data-buang="${i}">${ikon('hapus')}</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="kosong" style="text-align:center;color:var(--teks-2)">Tidak ada pesanan tertunda.</p>', tombol: [{ teks: 'Tutup', kelas: 'kedua' }] });
    m.el.addEventListener('click', async e => {
      const a = e.target.closest('[data-ambil]'), d = e.target.closest('[data-buang]');
      if (a) {
        if (K.items.length && !await konfirmasi('Ganti keranjang', 'Keranjang sekarang akan diganti dengan pesanan ini. Lanjutkan?', 'Ya', '')) return;
        await muatPesanan(data[a.dataset.ambil]); m.tutup(); tampilKasir_();
      }
      if (d) {
        if (!await konfirmasi('Hapus pesanan', `Hapus pesanan <b>${esc(data[d.dataset.buang].no)}</b>?`, 'Hapus')) return;
        const { error: e2 } = await sb.rpc('hapus_pesanan', { p_id: data[d.dataset.buang].id }); if (e2) return toast(pesanGalat(e2), 'galat');
        m.tutup(); daftarPesanan();
      }
    });
  }

  document.onkeydown = e => {
    if (!location.hash.startsWith('#/penjualan/kasir')) { document.onkeydown = null; return; }
    if (document.querySelector('.latar-modal')) return;
    if (e.key === 'F2') { e.preventDefault(); el.querySelector('[data-cari]')?.focus(); }
    if (e.key === 'F4' && bisa('penjualan.retur')) { e.preventDefault(); bukaRetur().catch(x => toast(pesanGalat(x), 'galat')); }
    if (e.key === 'F9') { e.preventDefault(); bayar(); }
  };
  hitung();
  setTimeout(() => el.querySelector('[data-cari]')?.focus(), 50);
}

async function muatPesanan(p) {
  K = kosongkan();
  K.pesanan_id = p.id; K.pesanan_no = p.no;
  Object.assign(K.header, { jenis_pelayanan_id: p.jenis_pelayanan_id, dokter_id: p.dokter_id, no_resep: p.no_resep || '', diskon_nota: Number(p.diskon_nota || 0), nama_pemesan: p.nama_pemesan });
  if (p.pelanggan_id) K.pelanggan = (await sb.from('pelanggan').select('id,nama,telp,kode,member,stamp').eq('id', p.pelanggan_id).single()).data;
  const info = await infoProduk(p.item.filter(i => i.produk_id).map(i => i.produk_id));
  K.items = p.item.sort((a, b) => a.id - b.id).map(i => i.bundel_id ? { bundel_id: i.bundel_id, nama: i.nama, qty: Number(i.qty), diskon_persen: Number(i.diskon_persen) }
    : { produk_id: i.produk_id, nama: i.nama, golongan: i.golongan, satuan_id: i.satuan_id, satuanDasar: info[i.produk_id]?.satuan_id, satuanOpsi: info[i.produk_id]?.satuanOpsi, qty: Number(i.qty), diskon_persen: Number(i.diskon_persen) });
}

function aturPrinter() { location.hash = '#/pengaturan/printer'; }

const ALASAN_TOLAK = [['Stok habis', 'Stok habis'], ['Tidak dijual', 'Tidak dijual di apotek'], ['Harga', 'Pelanggan keberatan harga'], ['Butuh resep', 'Butuh resep dokter'], ['Lainnya', 'Lainnya']];
function catatTertolak() {
  let pilih = null;
  modal({ judul: 'Catat Penjualan Tertolak', isi: `<p style="margin-top:0;color:var(--teks-2)">Catat barang yang dicari pelanggan tapi tidak bisa dilayani, untuk bahan pembelian.</p>
    <form class="form-grid" onsubmit="return false"><label class="isian lebar"><span>Barang yang dicari <i>*</i></span><input name="nama" data-cari-tolak required placeholder="Ketik nama (bisa pilih dari daftar produk)"></label>
    <label class="isian"><span>Jumlah</span><input name="qty" type="number" min="0" step="any" value="1"></label>
    <label class="isian"><span>Alasan</span><select name="alasan">${ALASAN_TOLAK.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
    <label class="isian"><span>Pelanggan</span><input name="pel"></label><label class="isian"><span>Catatan</span><input name="cat"></label></form>`,
    saatBuka: m => pasangCariProduk(m.querySelector('[data-cari-tolak]'), p => { pilih = p; setTimeout(() => { m.querySelector('[data-cari-tolak]').value = p.nama; }, 0); }),
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
      const f = m.querySelector('form'); if (!f.reportValidity()) return false;
      const nama = f.nama.value.trim();
      const { error } = await sb.from('penjualan_tertolak').insert({ outlet_id: S.pengguna.outlet_id, produk_id: pilih && pilih.nama === nama ? pilih.id : null, nama_barang: nama,
        qty: Number(f.qty.value || 1), alasan: f.alasan.value, pelanggan: f.pel.value || null, catatan: f.cat.value || null, pengguna_nama: S.pengguna.nama });
      if (error) throw error;
      toast('Tercatat', 'sukses');
    } }] });
}

// ================= Pesanan Penjualan =================
rute('penjualan/pesanan', async el => {
  el.innerHTML = judulHalaman('Pesanan Penjualan', 'Penjualan / Pesanan Penjualan', `<a class="tombol" href="#/penjualan/kasir">${ikon('tambah')} Buat di Kasir</a>`) +
    `<div class="kartu"><p class="pesan info" style="margin-top:0">Pesanan = transaksi yang ditunda/dipesan pelanggan. Stok belum berkurang sampai pesanan dibayar di Kasir.</p>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>No</th><th>Waktu</th><th>Pemesan</th><th>Dibuat oleh</th><th>Barang</th><th class="angka">Perkiraan Total</th><th></th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const muat = async () => {
    const { data, error } = await sb.from('penjualan').select('*, item:penjualan_item(*)').eq('status', 'pesanan').eq('outlet_id', S.pengguna.outlet_id).order('waktu', { ascending: false });
    if (error) return toast(pesanGalat(error), 'galat');
    el.querySelector('[data-isi]').innerHTML = data.length ? data.map((p, i) => `<tr><td data-label="No"><b>${esc(p.no)}</b></td><td data-label="Waktu">${waktu(p.waktu)}</td><td data-label="Pemesan">${esc(p.nama_pemesan || '-')}</td>
      <td data-label="Oleh">${esc(p.pengguna_nama || '')}</td><td data-label="Barang">${p.item.map(x => esc(x.nama) + ' ×' + angka(x.qty)).join(', ')}</td><td data-label="Total" class="angka">${rupiah(p.total)}</td>
      <td class="aksi"><button class="tombol kecil" data-ambil="${i}">Proses di Kasir</button> <button class="ikon-aksi hapus" data-buang="${i}">${ikon('hapus')}</button></td></tr>`).join('')
      : '<tr><td class="kosong" colspan="7">Tidak ada pesanan.</td></tr>';
    el.onclick = async e => {
      const a = e.target.closest('[data-ambil]'), d = e.target.closest('[data-buang]');
      if (a) { await muatPesanan(data[a.dataset.ambil]); location.hash = '#/penjualan/kasir'; }
      if (d && await konfirmasi('Hapus pesanan', `Hapus pesanan <b>${esc(data[d.dataset.buang].no)}</b>?`, 'Hapus')) {
        const { error: e2 } = await sb.rpc('hapus_pesanan', { p_id: data[d.dataset.buang].id }); if (e2) return toast(pesanGalat(e2), 'galat'); muat();
      }
    };
  };
  muat();
});

// ================= Daftar Penjualan =================
export async function detailPenjualan(id, setelah) {
  const { data: j, error } = await sb.from('penjualan').select('*, item:penjualan_item(*), bayar:penjualan_bayar(*, metode:metode_bayar_id(nama)), pelanggan:pelanggan_id(nama), dokter:dokter_id(nama), jp:jenis_pelayanan_id(nama), retur:retur_jual(no,total,status,waktu)').eq('id', id).single();
  if (error) return toast(pesanGalat(error), 'galat');
  const tombol = [{ teks: 'Cetak Struk', kelas: 'kedua', aksi: () => { cetakStruk(j.id); return false; } }];
  if (j.status === 'selesai' && bisa('penjualan.retur')) tombol.push({ teks: 'Retur', kelas: 'kedua', aksi: () => { bukaRetur({ id: j.id }, () => setelah?.()); } });
  if (j.status === 'selesai' && bisa('penjualan.batal')) tombol.push({ teks: 'Batalkan Transaksi', kelas: 'bahaya', aksi: async () => {
    const alasan = await mintaTeks('Batalkan ' + j.no, 'Alasan pembatalan (wajib). Stok akan dikembalikan.');
    if (!alasan) return false;
    const { error: e2 } = await sb.rpc('batal_penjualan', { p_id: j.id, p_alasan: alasan }); if (e2) throw e2;
    toast('Transaksi dibatalkan'); setelah?.();
  } });
  tombol.push({ teks: 'Tutup', kelas: 'kedua' });
  modal({ judul: 'Penjualan ' + j.no, ukuran: 'besar', isi: `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">${chipStatus(j.status)}<span>${waktu(j.waktu)}</span><span>Kasir: ${esc(j.pengguna_nama || '')}</span>
      ${j.pelanggan ? `<span>Pelanggan: ${esc(j.pelanggan.nama)}</span>` : ''}${j.jp ? `<span>${esc(j.jp.nama)}</span>` : ''}${j.dokter ? `<span>Dokter: ${esc(j.dokter.nama)}</span>` : ''}${j.no_resep ? `<span>Resep: ${esc(j.no_resep)}</span>` : ''}</div>
    ${j.status === 'batal' ? `<p class="pesan galat">Dibatalkan oleh ${esc(j.dibatalkan_oleh || '')} (${waktu(j.dibatalkan)}): ${esc(j.alasan_batal || '')}</p>` : ''}
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Barang</th><th class="angka">Jumlah</th><th class="angka">Harga</th><th class="angka">Diskon</th><th class="angka">Subtotal</th>${bisa('laporan') || bisa('dashboard') ? '<th class="angka">HPP</th>' : ''}</tr></thead><tbody>
      ${j.item.map(i => `<tr><td>${esc(i.nama)}</td><td class="angka">${angka(i.qty)} ${esc(i.satuan_nama || '')}</td><td class="angka">${rupiah(i.harga)}</td><td class="angka">${rupiah(Number(i.diskon_promo) + Number(i.diskon_manual))}</td><td class="angka">${rupiah(i.subtotal)}</td>${bisa('laporan') || bisa('dashboard') ? `<td class="angka">${rupiah(i.hpp_total)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px"><div style="flex:1;min-width:220px"><b>Pembayaran</b>${j.bayar.map(b => `<div class="baris-total"><span>${esc(b.metode?.nama || '')}${b.referensi ? ' · ' + esc(b.referensi) : ''}</span><span>${rupiah(b.jumlah)}</span></div>`).join('')}
        <div class="baris-total"><span>Kembalian</span><span>${rupiah(j.kembalian)}</span></div>
        ${j.retur?.length ? `<b style="display:block;margin-top:10px">Retur</b>${j.retur.map(r => `<div class="baris-total"><span>${esc(r.no)} (${waktu(r.waktu)})</span><span>${rupiah(r.total)}</span></div>`).join('')}` : ''}</div>
      <div style="flex:1;min-width:220px">${[['Subtotal', j.subtotal], ['Diskon pelanggan', -j.diskon_pelanggan], ['Diskon nota', -j.diskon_nota], ['Voucher', -j.potongan_voucher], ['Tukar poin', -j.potongan_poin], ['Embalase', j.embalase], ['Tuslah', j.tuslah], ['Pembulatan', j.pembulatan]]
        .filter(([, v]) => Number(v)).map(([l, v]) => `<div class="baris-total"><span>${l}</span><span>${rupiah(v)}</span></div>`).join('')}<div class="baris-total besar"><span>TOTAL</span><span>${rupiah(j.total)}</span></div></div></div>`, tombol });
}
function mintaTeks(judul, label) {
  return new Promise(res => {
    const m = modal({ judul, ukuran: 'kecil', isi: `<form onsubmit="return false"><label class="isian"><span>${esc(label)}</span><textarea name="t" rows="3" required></textarea></label></form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua', aksi: () => res(null) }, { teks: 'Lanjut', kelas: 'bahaya', aksi: el => { const v = el.querySelector('[name=t]').value.trim(); if (!v) { toast('Wajib diisi', 'galat'); return false; } res(v); } }] });
    m.el.querySelector('[data-tutup]').addEventListener('click', () => res(null));
  });
}

rute('penjualan/daftar', async el => {
  el.innerHTML = judulHalaman('Daftar Penjualan', 'Penjualan / Daftar Penjualan', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div class="alat-tabel">
      <div class="cari">${ikon('cari')}<input class="input" placeholder="Cari no. nota / resep..." data-q></div>
      <label>Dari <input type="date" class="input" style="width:auto" data-dari value="${hariIni()}"></label><label>Sampai <input type="date" class="input" style="width:auto" data-sampai value="${hariIni()}"></label>
      <select class="input" style="width:auto" data-status><option value="selesai">Selesai</option><option value="batal">Batal</option><option value="">Semua</option></select>
      <select class="input" style="width:auto" data-kasir><option value="">Semua kasir</option></select></div>
      <div class="grid-4" style="margin-bottom:12px" data-ringkas></div>
      <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>No. Nota</th><th>Waktu</th><th>Kasir</th><th>Pelanggan</th><th>Bayar</th><th class="angka">Total</th><th>Status</th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const { data: kasir } = await sb.from('pengguna').select('id,nama').order('nama');
  el.querySelector('[data-kasir]').innerHTML += (kasir || []).map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('');
  let data = [], urutan = 0;
  async function muat() {
    const buat = () => { let q = sb.from('penjualan').select('*, pelanggan:pelanggan_id(nama), bayar:penjualan_bayar(jumlah, metode:metode_bayar_id(nama))').eq('outlet_id', S.pengguna.outlet_id).neq('status', 'pesanan')
      .gte('tanggal', el.querySelector('[data-dari]').value).lte('tanggal', el.querySelector('[data-sampai]').value).order('waktu', { ascending: false }).order('id', { ascending: false });
    const st = el.querySelector('[data-status]').value, ks = el.querySelector('[data-kasir]').value, qq = el.querySelector('[data-q]').value.replace(/[,()%*]/g, ' ').trim();
    if (st) q = q.eq('status', st);
    if (ks) q = q.eq('pengguna_id', ks);
    if (qq) q = q.or(`no.ilike.%${qq}%,no_resep.ilike.%${qq}%`);
    return q; };
    const ke = ++urutan; let d;
    try { d = await ambilSemua(buat); } catch (e) { return toast(pesanGalat(e), 'galat'); }
    if (ke !== urutan) return;
    data = d;
    const ok = d.filter(x => x.status === 'selesai');
    const omzet = ok.reduce((a, x) => a + Number(x.total), 0), laba = ok.reduce((a, x) => a + Number(x.total) - Number(x.hpp_total), 0);
    const nm = lihatNominal();
    el.querySelector('[data-ringkas]').innerHTML = (!nm ? [['Transaksi Anda', angka(ok.length)]] : [['Transaksi', angka(ok.length)], ['Penjualan', rupiah(omzet)], ['Rata-rata', rupiah(ok.length ? omzet / ok.length : 0)], ...(bisa('keuangan.laba') ? [['Laba kotor', rupiah(laba)]] : [])])
      .map(([l, v]) => `<div class="statistik"><small>${l}</small><b>${v}</b></div>`).join('');
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map(x => `<tr style="cursor:pointer" data-buka="${x.id}"><td data-label="No"><b>${esc(x.no)}</b></td><td data-label="Waktu">${waktu(x.waktu)}</td>
      <td data-label="Kasir">${esc(x.pengguna_nama || '')}</td><td data-label="Pelanggan">${esc(x.pelanggan?.nama || '-')}</td><td data-label="Bayar">${x.bayar.map(b => esc(b.metode?.nama || '')).join(', ')}</td>
      <td data-label="Total" class="angka">${nm ? rupiah(x.total) : '-'}</td><td data-label="Status">${chipStatus(x.status)}</td></tr>`).join('') : `<tr><td class="kosong" colspan="7">Belum ada penjualan pada rentang ini.${nm ? '' : ' Kasir hanya melihat nota sendiri hari ini.'}</td></tr>`;
  }
  el.addEventListener('click', e => {
    const tr = e.target.closest('[data-buka]'); if (tr) detailPenjualan(Number(tr.dataset.buka), muat);
    if (e.target.closest('[data-csv]')) unduhCSV('penjualan', [{ label: 'No', nilai: x => x.no }, { label: 'Waktu', nilai: x => waktu(x.waktu) }, { label: 'Kasir', nilai: x => x.pengguna_nama },
      { label: 'Pelanggan', nilai: x => x.pelanggan?.nama }, ...(lihatNominal() ? [{ label: 'Total', nilai: x => x.total }] : []), { label: 'Status', nilai: x => x.status }], data);
  });
  el.addEventListener('change', muat);
  let jeda; el.querySelector('[data-q]').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(muat, 300); });
  muat();
});

// ================= Penjualan Tertolak =================
rute('penjualan/tertolak', halamanCrud({
  judul: 'Penjualan Tertolak', remah: 'Penjualan / Penjualan Tertolak', tabel: 'penjualan_tertolak', satuan: 'Penjualan Tertolak', kunciTulis: ['penjualan.tertolak', 'penjualan.kasir'],
  kolom: [
    { f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true },
    { f: 'nama_barang', label: 'Barang yang dicari', wajib: true }, { f: 'qty', label: 'Jumlah', tipe: 'angka' },
    { f: 'alasan', label: 'Alasan', tipe: 'pilih', opsi: ALASAN_TOLAK, wajib: true }, { f: 'pelanggan', label: 'Pelanggan' },
    { f: 'catatan', label: 'Catatan', tipe: 'area', daftar: false }, { f: 'pengguna_nama', label: 'Dicatat oleh', form: false },
  ],
  urut: 'waktu', naik: false, cari: ['nama_barang', 'pelanggan'], labelBaris: 'nama_barang',
  bawaan: { get tanggal() { return hariIni(); } }, saring: q => q.eq('outlet_id', S.pengguna.outlet_id),
  sebelumSimpan: (d, baris) => { d.outlet_id = baris?.outlet_id ?? S.pengguna.outlet_id; if (!baris) d.pengguna_nama = S.pengguna.nama; },
}));

// ================= QRIS =================
rute('penjualan/qris', async el => {
  const boleh = bisa('penjualan.qris') || bisa('pengaturan.konfigurasi');
  const { data } = await sb.from('konfigurasi').select('nilai').eq('kunci', 'qris').maybeSingle();
  const q = data?.nilai || {};
  el.innerHTML = judulHalaman('QRIS', 'Penjualan / QRIS') + `<div class="kartu" style="max-width:520px;margin:0 auto;text-align:center">
    ${q.gambar ? `<img src="${q.gambar}" style="width:100%;max-width:420px;border-radius:14px" alt="QRIS">` : '<p class="pesan peringatan">Gambar QRIS belum diunggah.</p>'}
    ${q.catatan ? `<p style="color:var(--teks-2)">${esc(q.catatan)}</p>` : ''}
    <p style="color:var(--teks-2);font-size:13px">Tunjukkan ke pelanggan untuk di-scan. Pastikan dana sudah masuk (cek notifikasi BRImo/mutasi) sebelum transaksi diselesaikan.</p>
    ${boleh ? `<label class="tombol kedua" style="cursor:pointer">Unggah / ganti gambar QRIS<input type="file" accept="image/*" data-unggah hidden></label>` : ''}</div>`;
  el.querySelector('[data-unggah]')?.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const url = await kecilkanGambar(file, 900);
    const { error } = await sb.from('konfigurasi').upsert({ kunci: 'qris', nilai: { ...q, gambar: url, diubah: new Date().toISOString() } });
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Gambar QRIS disimpan', 'sukses'); window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
});
function kecilkanGambar(file, maks) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ================= Riwayat Shift / Sesi =================
rute('pengguna/sesi', async el => {
  el.innerHTML = judulHalaman('Riwayat Shift/Sesi', 'Manajemen Pengguna / Riwayat Shift/Sesi') + `<div class="kartu"><div class="alat-tabel">
    <label>Dari <input type="date" class="input" style="width:auto" data-dari value="${awalBulan()}"></label><label>Sampai <input type="date" class="input" style="width:auto" data-sampai value="${hariIni()}"></label></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Kode Sesi</th><th>Kasir</th><th>Shift</th><th>Dibuka</th><th>Ditutup</th><th class="angka">Penjualan</th><th class="angka">Selisih Kas</th><th>Status</th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  let data = [];
  const muat = async () => {
    const dari = el.querySelector('[data-dari]').value, sampai = el.querySelector('[data-sampai]').value;
    const { data: d, error } = await sb.from('sesi_kasir').select('*').eq('outlet_id', S.pengguna.outlet_id).gte('dibuka', new Date(dari + 'T00:00:00').toISOString())
      .lt('dibuka', new Date(new Date(sampai + 'T00:00:00').getTime() + 864e5).toISOString()).order('dibuka', { ascending: false });
    if (error) return toast(pesanGalat(error), 'galat');
    data = d;
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map((s, i) => `<tr style="cursor:pointer" data-buka="${i}"><td data-label="Kode"><b>${esc(s.kode)}</b></td><td data-label="Kasir">${esc(s.pengguna_nama || '')}</td>
      <td data-label="Shift">${esc(s.shift_nama || '-')}</td><td data-label="Dibuka">${waktu(s.dibuka)}</td><td data-label="Ditutup">${s.ditutup ? waktu(s.ditutup) : '-'}</td>
      <td data-label="Penjualan" class="angka">${s.ringkasan ? rupiah(s.ringkasan.omzet) : '-'}</td>
      <td data-label="Selisih" class="angka">${s.selisih === null ? '-' : `<span class="chip ${Number(s.selisih) === 0 ? 'hijau' : 'merah'}">${rupiah(s.selisih)}</span>`}</td>
      <td data-label="Status"><span class="chip ${s.status === 'buka' ? 'oranye' : ''}">${s.status === 'buka' ? 'Masih buka' : 'Tutup'}</span></td></tr>`).join('') : '<tr><td class="kosong" colspan="8">Belum ada sesi.</td></tr>';
  };
  el.addEventListener('change', muat);
  el.addEventListener('click', async e => {
    const tr = e.target.closest('[data-buka]'); if (!tr) return;
    const s = data[tr.dataset.buka];
    const r = s.ringkasan || (await sb.rpc('ringkasan_sesi', { p_id: s.id })).data;
    const tombol = [{ teks: 'Cetak Rekap', kelas: 'kedua', aksi: () => { cetakRekapSesi(s); return false; } }];
    if (s.status === 'buka' && (s.pengguna_id === S.pengguna.id || bisa('pengguna.sesi'))) tombol.push({ teks: 'Tutup Sesi', kelas: 'bahaya', aksi: () => { tutupSesi(s, muat); } });
    tombol.push({ teks: 'Tutup', kelas: 'kedua' });
    modal({ judul: 'Sesi ' + s.kode, isi: await tampilRingkasanSesi(s, r) + (s.kas_fisik !== null ? `<div class="baris-total"><span>Kas fisik</span><span>${rupiah(s.kas_fisik)}</span></div><div class="baris-total besar"><span>Selisih</span><span>${rupiah(s.selisih)}</span></div>${s.catatan ? `<p>${esc(s.catatan)}</p>` : ''}` : ''), tombol });
  });
  muat();
});
