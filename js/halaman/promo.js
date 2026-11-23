// Program Promo: Diskon Produk, Bundel/Paket, Voucher, Program Member.
import { rute, sb, bisa, ambilRef } from '../inti.js?v=1.4.2';
import { esc, angka, rupiah, waktu, toast, judulHalaman, pesanGalat } from '../ui.js?v=1.4.2';
import { halamanCrud } from '../crud.js?v=1.4.2';

const status = r => {
  const h = new Date().toISOString().slice(0, 10);
  if (!r.aktif) return '<span class="chip">Nonaktif</span>';
  if (r.mulai && h < r.mulai) return '<span class="chip oranye">Belum mulai</span>';
  if (r.selesai && h > r.selesai) return '<span class="chip merah">Berakhir</span>';
  return '<span class="chip hijau">Berjalan</span>';
};
const periode = [{ f: 'mulai', label: 'Mulai', tipe: 'tanggal', bantu: 'Kosongkan bila langsung berlaku.' }, { f: 'selesai', label: 'Selesai', tipe: 'tanggal', bantu: 'Kosongkan bila tanpa batas.' }];

// ---------- Diskon Produk ----------
rute('promo/diskon', halamanCrud({
  judul: 'Diskon Produk', remah: 'Program Promo / Diskon Produk', tabel: 'promo_diskon', satuan: 'Diskon Produk', kunciTulis: ['promo.diskon'],
  kolom: [
    { f: 'nama', label: 'Nama Promo', wajib: true, lebar: true },
    { f: 'produk_id', label: 'Produk', tipe: 'ref', ref: 'produk', bantu: 'Pilih produk, ATAU kosongkan lalu pilih kategori (berlaku untuk semua produk di kategori itu).' },
    { f: 'kategori_id', label: 'Kategori', tipe: 'ref', ref: 'kategori' },
    { f: 'jenis', label: 'Jenis Diskon', tipe: 'pilih', wajib: true, opsi: [['persen', 'Persen (%)'], ['rupiah', 'Rupiah per satuan terkecil']] },
    { f: 'nilai', label: 'Nilai', tipe: 'angka', wajib: true, min: 0, tampil: r => r.jenis === 'persen' ? angka(r.nilai) + '%' : rupiah(r.nilai) + '/satuan' },
    { f: 'min_qty', label: 'Minimal Beli (satuan terkecil)', tipe: 'angka', min: 0, daftar: false, bantu: 'mis. 10 = diskon berlaku bila beli minimal 10 tablet.' },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status },
  ],
  bawaan: { jenis: 'persen', aktif: true, min_qty: 0 }, urut: 'dibuat', naik: false,
  sebelumSimpan: d => { if (!d.produk_id && !d.kategori_id) throw new Error('Pilih produk atau kategori.'); if (d.jenis === 'persen' && d.nilai > 100) throw new Error('Diskon persen maksimal 100.'); },
}));

// ---------- Bundel / Paket ----------
async function isiPaketHtml(baris) {
  const produk = await ambilRef('produk', 'id,nama');
  let rows = [];
  if (baris) rows = (await sb.from('promo_bundel_item').select('*').eq('bundel_id', baris.id).order('id')).data || [];
  const opsi = v => produk.map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nama)}</option>`).join('');
  window.__barisPaket = r => `<tr><td><select class="input" name="_pk_produk">${opsi(r.produk_id)}</select></td><td><input class="input" type="number" min="0.0001" step="any" name="_pk_qty" value="${r.qty ?? 1}" style="width:90px"></td><td><button type="button" class="ikon-aksi hapus" data-hapus-pk>✕</button></td></tr>`;
  return `<b>Isi paket</b> <small style="color:var(--teks-2)">(jumlah dalam satuan terkecil, mis. 10 tablet)</small>
    <div class="bungkus-tabel" style="margin-top:8px"><table class="tabel"><thead><tr><th>Produk</th><th>Jumlah</th><th></th></tr></thead><tbody data-pk>${rows.map(window.__barisPaket).join('')}</tbody></table></div>
    <button type="button" class="tombol kedua kecil" style="margin-top:8px" data-tambah-pk>+ Tambah produk</button>`;
}
rute('promo/bundel', halamanCrud({
  judul: 'Bundel/Paket Produk', remah: 'Program Promo / Bundel/Paket Produk', tabel: 'promo_bundel', satuan: 'Paket', kunciTulis: ['promo.bundel'], ukuranForm: 'besar',
  kolom: [{ f: 'kode', label: 'Kode' }, { f: 'nama', label: 'Nama Paket', wajib: true }, { f: 'harga', label: 'Harga Paket', tipe: 'uang', wajib: true, min: 0 },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status }],
  bawaan: { aktif: true }, cari: ['nama', 'kode'],
  ekstraForm: isiPaketHtml,
  saatBukaForm: m => m.addEventListener('click', e => {
    if (e.target.closest('[data-tambah-pk]')) m.querySelector('[data-pk]').insertAdjacentHTML('beforeend', window.__barisPaket({}));
    if (e.target.closest('[data-hapus-pk]')) e.target.closest('tr').remove();
  }),
  sebelumSimpan: () => { if (!document.querySelectorAll('[name=_pk_produk]').length) throw new Error('Isi paket minimal 1 produk.'); },
  setelahSimpan: async (id, m) => {
    const p = [...m.querySelectorAll('[name=_pk_produk]')], q = [...m.querySelectorAll('[name=_pk_qty]')];
    const rows = p.map((s, i) => ({ bundel_id: id, produk_id: Number(s.value), qty: Number(q[i].value) })).filter(r => r.qty > 0);
    const { error: e1 } = await sb.from('promo_bundel_item').delete().eq('bundel_id', id); if (e1) throw e1;
    if (rows.length) { const { error } = await sb.from('promo_bundel_item').insert(rows); if (error) throw error; }
  },
}));

// ---------- Voucher ----------
rute('promo/voucher', halamanCrud({
  judul: 'Voucher Diskon', remah: 'Program Promo / Voucher Diskon', tabel: 'voucher', satuan: 'Voucher', kunciTulis: ['promo.voucher'], labelBaris: 'kode',
  kolom: [
    { f: 'kode', label: 'Kode Voucher', wajib: true, bantu: 'Yang diketik kasir, mis. SEHAT10.' }, { f: 'nama', label: 'Keterangan' },
    { f: 'jenis', label: 'Jenis', tipe: 'pilih', wajib: true, opsi: [['rupiah', 'Potongan Rupiah'], ['persen', 'Potongan Persen']] },
    { f: 'nilai', label: 'Nilai', tipe: 'angka', wajib: true, min: 0, tampil: r => r.jenis === 'persen' ? angka(r.nilai) + '%' : rupiah(r.nilai) },
    { f: 'maks_potongan', label: 'Maksimal Potongan (Rp)', tipe: 'uang', min: 0, daftar: false, bantu: 'Untuk voucher persen. 0 = tanpa batas.' },
    { f: 'min_belanja', label: 'Minimal Belanja', tipe: 'uang', min: 0 },
    { f: 'kuota', label: 'Kuota Pemakaian', tipe: 'angka', min: 0, bantu: 'Kosongkan bila tanpa batas.', tampil: r => r.kuota === null ? '∞' : `${angka(r.terpakai)} / ${angka(r.kuota)}` },
    ...periode, { f: 'aktif', label: 'Aktif', tipe: 'bool' }, { f: '_st', label: 'Status', form: false, tampil: status },
  ],
  bawaan: { jenis: 'rupiah', aktif: true }, cari: ['kode', 'nama'], urut: 'dibuat', naik: false,
  sebelumSimpan: d => { d.kode = (d.kode || '').toUpperCase().replace(/\s+/g, ''); if (d.kuota === 0) d.kuota = null; },
}));

// ---------- Program Member ----------
rute('promo/member', async el => {
  const boleh = bisa('promo.member');
  const { data: k } = await sb.from('konfigurasi').select('nilai').eq('kunci', 'member').maybeSingle();
  const m = { aktif: false, rp_per_poin: 10000, nilai_poin: 100, min_tukar: 10, ...(k?.nilai || {}) };
  el.innerHTML = judulHalaman('Program Member', 'Program Promo / Program Member') + `<div class="grid-2">
    <div class="kartu"><h3>Aturan Poin</h3><form onsubmit="return false">
      <label class="cek"><input type="checkbox" name="aktif" ${m.aktif ? 'checked' : ''}> Program member aktif</label>
      <label class="isian"><span>Belanja per 1 poin (Rp)</span><input type="number" min="1" name="rp_per_poin" value="${m.rp_per_poin}"><small>mis. 10.000 = tiap belanja Rp 10.000 dapat 1 poin.</small></label>
      <label class="isian"><span>Nilai 1 poin saat ditukar (Rp)</span><input type="number" min="0" name="nilai_poin" value="${m.nilai_poin}"></label>
      <label class="isian"><span>Minimal poin sekali tukar</span><input type="number" min="0" name="min_tukar" value="${m.min_tukar}"></label>
      <p class="pesan info" data-contoh></p>
      ${boleh ? '<button class="tombol" data-simpan>Simpan</button>' : ''}</form>
      <p style="color:var(--teks-2);font-size:13px">Poin hanya untuk transaksi yang memilih pelanggan. Pelanggan didaftarkan di menu Kontak → Pelanggan.</p></div>
    <div class="kartu"><h3>Poin Terbanyak</h3><div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Pelanggan</th><th>No. HP</th><th class="angka">Poin</th></tr></thead><tbody data-top></tbody></table></div>
      <h3 style="margin-top:16px">Riwayat Poin Terakhir</h3><div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Waktu</th><th>Pelanggan</th><th>Keterangan</th><th class="angka">Poin</th></tr></thead><tbody data-riwayat></tbody></table></div></div></div>`;
  const f = el.querySelector('form');
  if (!boleh) f.querySelectorAll('input').forEach(i => i.disabled = true);
  const contoh = () => { const rp = Number(f.rp_per_poin.value || 0), n = Number(f.nilai_poin.value || 0); el.querySelector('[data-contoh]').textContent = rp > 0 ? `Contoh: belanja Rp 100.000 → ${angka(Math.floor(100000 / rp))} poin, bernilai ${rupiah(Math.floor(100000 / rp) * n)} saat ditukar (${angka(n / rp * 100)}% kembali).` : ''; };
  f.oninput = contoh; contoh();
  el.querySelector('[data-simpan]')?.addEventListener('click', async e => {
    e.target.disabled = true;
    const nilai = { aktif: f.aktif.checked, rp_per_poin: Number(f.rp_per_poin.value), nilai_poin: Number(f.nilai_poin.value), min_tukar: Number(f.min_tukar.value) };
    const { error } = await sb.from('konfigurasi').upsert({ kunci: 'member', nilai, diubah: new Date().toISOString() });
    e.target.disabled = false;
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Aturan member disimpan', 'sukses');
  });
  const [{ data: top }, { data: rw }] = await Promise.all([
    sb.from('pelanggan').select('nama,telp,poin').gt('poin', 0).order('poin', { ascending: false }).limit(10),
    sb.from('poin_mutasi').select('*, pelanggan:pelanggan_id(nama)').order('waktu', { ascending: false }).limit(15),
  ]);
  el.querySelector('[data-top]').innerHTML = (top || []).length ? top.map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.telp || '')}</td><td class="angka"><b>${angka(p.poin)}</b></td></tr>`).join('') : '<tr><td colspan="3" class="kosong">Belum ada.</td></tr>';
  el.querySelector('[data-riwayat]').innerHTML = (rw || []).length ? rw.map(r => `<tr><td>${waktu(r.waktu)}</td><td>${esc(r.pelanggan?.nama || '')}</td><td>${esc(r.keterangan || '')}</td><td class="angka" style="color:${r.poin < 0 ? 'var(--merah)' : 'var(--hijau)'}">${r.poin > 0 ? '+' : ''}${angka(r.poin)}</td></tr>`).join('') : '<tr><td colspan="4" class="kosong">Belum ada.</td></tr>';
});
