// Pelayanan Apotek: Penerimaan Resep (foto + ketik, skrining, R/ jadi & racikan), Penebusan (ke kasir),
// Template Racikan, Swamedikasi, Home Pharmacy Care, PIO, MESO, Catatan Pengobatan, Konseling,
// cetak etiket (printer label) & copy resep (thermal / A5).
import { rute, sb, S, bisa, ambilRef, KONEKSI, atauOffline } from '../inti.js?v=1.11.0';
import * as OFF from '../offline.js?v=1.11.0';
import { ikon } from '../menu.js?v=1.11.0';
import { esc, angka, rupiah, tanggal, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.11.0';
import { pasangCariProduk, infoProduk } from '../dokumen.js?v=1.11.0';
import { halamanCrud } from '../crud.js?v=1.11.0';
import { ambilKonfig } from './pengaturan.js?v=1.11.0';
import { cetakStrukHtml, cetakLabelHtml, cetakKertasBiasa } from '../cetak.js?v=1.11.0';

const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const awalBulan = () => hariIni().slice(0, 8) + '01';
const BENTUK = ['puyer', 'kapsul', 'salep', 'krim', 'sirup', 'lainnya'];
const ATURAN = ['', 'sebelum makan', 'sesudah makan', 'saat makan', 'bila perlu', 'pagi hari', 'malam hari'];
const STATUS_R = { diterima: ['Diterima', ''], disiapkan: ['Disiapkan', 'teal'], diserahkan: ['Diserahkan', 'hijau'], batal: ['Batal', 'merah'] };
const TEBUS = { belum: ['Belum ditebus', 'oranye'], sebagian: ['Ditebus sebagian', 'teal'], penuh: ['Ditebus', 'hijau'] };
const chipR = s => `<span class="chip ${STATUS_R[s]?.[1] || ''}">${STATUS_R[s]?.[0] || s}</span>`;
const chipT = s => `<span class="chip ${TEBUS[s]?.[1] || ''}">${TEBUS[s]?.[0] || s}</span>`;
const romawi = n => { n = Math.round(Number(n)); if (!(n > 0 && n < 4000) || Number(n) !== Math.round(Number(n))) return angka(n); const r = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, l] of r) while (n >= v) { s += l; n -= v; } return s; };

const SKRINING = {
  administratif: ['Nama, umur, jenis kelamin pasien', 'Berat badan (untuk anak)', 'Nama, SIP & paraf dokter', 'Tanggal resep', 'Ruangan/asal resep jelas'],
  farmasetik: ['Bentuk & kekuatan sediaan', 'Stabilitas sediaan', 'Kompatibilitas (ketercampuran) obat'],
  klinis: ['Ketepatan indikasi & dosis', 'Aturan, cara & lama penggunaan', 'Duplikasi pengobatan', 'Alergi & efek samping', 'Interaksi obat', 'Kontraindikasi'],
};

// ================= Data resep lengkap =================
export async function ambilResep(id) {
  const { data: r, error } = await sb.from('resep').select('*, item:resep_item(*, produk:produk_id(nama,kode,golongan,satuan_id,harga_jual), satuan:satuan_id(nama), komponen:resep_komponen(*, produk:produk_id(nama,satuan:satuan_id(nama))))').eq('id', id).single();
  if (error) throw error;
  r.item.sort((a, b) => a.urutan - b.urutan);
  return r;
}
const namaItem = i => i.jenis === 'racikan' ? (i.nama_racikan || `Racikan ${i.bentuk || ''}`) : (i.produk?.nama || '');

// ================= Cetak etiket & copy resep =================
export async function cetakEtiket(r, itemIds) {
  const o = await atauOffline(async () => { const { data, error } = await sb.from('outlet').select('nama,telp').eq('id', r.outlet_id).single(); if (error) throw error; return data; }, OFF.outletL);
  const items = r.item.filter(i => !itemIds || itemIds.includes(i.id));
  if (!items.length) return toast('Tidak ada R/ yang dicetak etiketnya', 'galat');
  const labels = items.map(i => `<div class="kop"><span>${esc(o?.nama || 'Apotek')}</span><span>${esc(r.no)} · ${tanggal(r.tanggal)}</span></div>
    <div class="nm">${esc(r.pasien_nama)}${r.pasien_umur ? ' (' + esc(r.pasien_umur) + ')' : ''}</div>
    <div class="kecil">${esc(namaItem(i))}${i.jenis === 'racikan' ? ` · ${angka(i.qty)} ${esc(i.bentuk || '')}` : ` · ${angka(i.qty)} ${esc(i.satuan?.nama || '')}`}</div>
    <div class="signa">${esc(i.signa || '')}</div>
    <div class="kecil" style="text-align:center">${esc(i.aturan || '')}${i.keterangan ? ' · ' + esc(i.keterangan) : ''}</div>
    <div class="jenis">${i.pemakaian === 'luar' ? 'OBAT LUAR' : 'OBAT DALAM'}</div>`);
  const cara = await cetakLabelHtml(labels, 'Etiket ' + r.no);
  if (cara === 'agen') toast(`${labels.length} etiket dikirim ke printer label`, 'sukses');
}

function isiCopyResep(r, o) {
  const det = i => { const q = Number(i.qty), d = Number(i.qty_ditebus); return d >= q ? 'det' : d <= 0 ? 'nedet' : `det ${romawi(d)}`; };
  const baris = r.item.map(i => i.jenis === 'racikan'
    ? `<div class="n">R/ ${i.komponen.map(k => `${esc(k.produk?.nama || '')} ${esc(k.dosis || angka(k.qty) + ' ' + (k.produk?.satuan?.nama || ''))}`).join('<br>&nbsp;&nbsp;&nbsp;')}<br>&nbsp;&nbsp;&nbsp;m.f. ${esc(i.bentuk || 'pulv')} dtd No. ${romawi(i.qty)}</div>
       <div>&nbsp;&nbsp;S ${esc(i.signa || '')}${i.aturan ? ' (' + esc(i.aturan) + ')' : ''}</div><div style="text-align:right">— ${det(i)}</div>`
    : `<div class="n">R/ ${esc(i.produk?.nama || '')} No. ${romawi(i.qty)}</div><div>&nbsp;&nbsp;S ${esc(i.signa || '')}${i.aturan ? ' (' + esc(i.aturan) + ')' : ''}</div><div style="text-align:right">— ${det(i)}</div>`).join('<hr style="border-top:1px dotted #000">');
  return `<div class="c"><b>${esc(o.nama)}</b><br>${esc(o.alamat || '')}${o.telp ? '<br>Telp ' + esc(o.telp) : ''}${o.no_sia ? '<br>SIA ' + esc(o.no_sia) : ''}${o.apoteker ? '<br>APA: ' + esc(o.apoteker) : ''}</div><hr>
    <div class="c b">SALINAN RESEP</div><hr>
    <div class="r"><span>No</span><span>${esc(r.no)}</span></div><div class="r"><span>Dari dokter</span><span>${esc(r.dokter_nama || '')}</span></div>
    <div class="r"><span>Tgl resep</span><span>${tanggal(r.tanggal_resep || r.tanggal)}</span></div><div class="r"><span>Pasien</span><span>${esc(r.pasien_nama)}${r.pasien_umur ? ' / ' + esc(r.pasien_umur) : ''}</span></div>
    ${r.iter ? `<div class="r"><span>Iter</span><span>${r.iter}x</span></div>` : ''}<hr>${baris}<hr>
    <div class="r"><span>p.c.c</span><span>${tanggal(hariIni())}</span></div>
    <div class="c" style="margin-top:28px">( ${esc(o.apoteker || '........................')} )${o.sipa ? '<br>SIPA ' + esc(o.sipa) : ''}</div>`;
}
export async function cetakCopyResep(r, kertas = 'thermal') {
  const [o, k] = await Promise.all([atauOffline(async () => { const { data, error } = await sb.from('outlet').select('*').eq('id', r.outlet_id).single(); if (error) throw error; return data; }, OFF.outletL), ambilKonfig()]);
  const isi = isiCopyResep(r, o);
  if (kertas === 'thermal') return cetakStrukHtml(isi, 'Copy resep ' + r.no, k.struk.lebar);
  cetakKertasBiasa(isi, `.kertas{font:13px/1.5 Georgia,serif;width:128mm;margin:0 auto}.c{text-align:center}.b{font-weight:bold;letter-spacing:2px}.r{display:flex;justify-content:space-between}hr{border:0;border-top:1px solid #000;margin:6px 0}.n{margin-top:6px}`, 'Copy resep ' + r.no, 'A5');
}

// ================= Penerimaan Resep: daftar =================
rute('pelayanan/penerimaan_resep', async (el, [p]) => {
  if (p) return editorResep(el, p);
  return daftarResep(el, { judul: 'Penerimaan Resep', remah: 'Pelayanan Apotek / Penerimaan Resep', tombolBaru: bisa('pelayanan.penerimaan_resep') });
});
rute('pelayanan/penebusan_resep', async el => daftarResep(el, { judul: 'Penebusan Resep', remah: 'Pelayanan Apotek / Penebusan Resep', modeTebus: true }));

async function daftarResep(el, o) {
  el.innerHTML = judulHalaman(o.judul, o.remah, o.tombolBaru ? `<a class="tombol" href="#/pelayanan/penerimaan_resep/baru">${ikon('tambah')} Resep Baru</a>` : '') +
    `<div class="kartu">${o.modeTebus ? '<p class="pesan info" style="margin-top:0">Resep yang belum/baru sebagian ditebus. Klik <b>Tebus</b> untuk memilih jumlah yang diambil pasien lalu bayar di Kasir.</p>' : ''}
    <div class="alat-tabel"><div class="cari">${ikon('cari')}<input class="input" data-q placeholder="Cari no. resep / pasien / dokter..."></div>
      <label>Dari <input type="date" class="input" style="width:auto" data-dari value="${o.modeTebus ? '' : awalBulan()}"></label><label>Sampai <input type="date" class="input" style="width:auto" data-sampai value="${hariIni()}"></label>
      <select class="input" style="width:auto" data-status>${o.modeTebus ? '<option value="aktif">Belum/sebagian ditebus</option><option value="">Semua</option>' : '<option value="">Semua status</option><option value="diterima">Diterima</option><option value="disiapkan">Disiapkan</option><option value="diserahkan">Diserahkan</option><option value="batal">Batal</option>'}</select></div>
    <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>No. Resep</th><th>Waktu</th><th>Pasien</th><th>Dokter</th><th>R/</th><th>Status</th><th>Tebus</th><th></th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  let data = [];
  const muat = async () => {
    let q = sb.from('resep').select('*, item:resep_item(id)').eq('outlet_id', S.pengguna.outlet_id).order('waktu', { ascending: false }).limit(300);
    const dari = el.querySelector('[data-dari]').value, sampai = el.querySelector('[data-sampai]').value, st = el.querySelector('[data-status]').value;
    const qq = el.querySelector('[data-q]').value.replace(/[,()%*]/g, ' ').trim();
    if (dari) q = q.gte('tanggal', dari); if (sampai) q = q.lte('tanggal', sampai);
    if (st === 'aktif') q = q.in('ditebus', ['belum', 'sebagian']).neq('status', 'batal'); else if (st) q = q.eq('status', st);
    if (qq) q = q.or(`no.ilike.%${qq}%,pasien_nama.ilike.%${qq}%,dokter_nama.ilike.%${qq}%`);
    const { data: d, error } = await q;
    if (error) return toast(pesanGalat(error), 'galat');
    data = d;
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map((r, i) => `<tr style="cursor:pointer" data-buka="${r.id}"><td data-label="No"><b>${esc(r.no)}</b>${r.foto?.length ? ' 📷' : ''}</td>
      <td data-label="Waktu">${waktu(r.waktu)}</td><td data-label="Pasien">${esc(r.pasien_nama)}</td><td data-label="Dokter">${esc(r.dokter_nama || '-')}</td><td data-label="R/">${r.item.length}</td>
      <td data-label="Status">${chipR(r.status)}</td><td data-label="Tebus">${chipT(r.ditebus)}</td>
      <td class="aksi">${r.status !== 'batal' && r.ditebus !== 'penuh' && bisa('pelayanan.penebusan_resep') ? `<button class="tombol kecil oranye" data-tebus="${i}">Tebus</button>` : ''}</td></tr>`).join('')
      : '<tr><td class="kosong" colspan="8">Belum ada resep.</td></tr>';
  };
  el.addEventListener('click', async e => {
    const tb = e.target.closest('[data-tebus]');
    if (tb) { e.stopPropagation(); const r = await ambilResep(data[tb.dataset.tebus].id); return tebusResep(r); }
    const tr = e.target.closest('[data-buka]'); if (tr) location.hash = '#/pelayanan/penerimaan_resep/' + tr.dataset.buka;
  });
  el.addEventListener('change', muat);
  let jeda; el.querySelector('[data-q]').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(muat, 300); });
  muat();
  return o.judul;
}

// ================= Tebus: pilih jumlah lalu kirim ke Kasir =================
export async function tebusResep(r) {
  const k = await ambilKonfig();
  const sisa = i => Math.max(Number(i.qty) - Number(i.qty_ditebus), 0);
  modal({ judul: 'Tebus Resep ' + r.no, isi: `<p style="margin-top:0">Pasien <b>${esc(r.pasien_nama)}</b>. Isi jumlah yang diambil sekarang (sisa bisa ditebus nanti, copy resep mencatat <i>det/nedet</i>).</p>
    <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>R/</th><th class="angka">Diresepkan</th><th class="angka">Sudah</th><th class="angka">Ambil sekarang</th></tr></thead><tbody>
    ${r.item.map(i => `<tr><td><b>${esc(namaItem(i))}</b><br><small style="color:var(--teks-2)">${esc(i.signa || '')}</small></td><td class="angka">${angka(i.qty)} ${esc(i.jenis === 'racikan' ? (i.bentuk || '') : (i.satuan?.nama || ''))}</td>
      <td class="angka">${angka(i.qty_ditebus)}</td><td class="angka"><input type="number" class="input" style="width:90px;text-align:right" min="0" max="${sisa(i)}" step="any" data-ambil="${i.id}" value="${sisa(i)}"></td></tr>`).join('')}</tbody></table></div>
    <label class="cek" style="margin-top:12px"><input type="checkbox" data-etiket ${k.pelayanan.cetak_etiket ? 'checked' : ''}> Cetak etiket setelah pembayaran</label>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Lanjut ke Kasir', aksi: async m => {
      const ambil = r.item.map(i => ({ i, q: Math.min(Number(m.querySelector(`[data-ambil="${i.id}"]`).value || 0), sisa(i)) })).filter(x => x.q > 0);
      if (!ambil.length) { toast('Isi jumlah yang diambil', 'galat'); return false; }
      const items = [];
      for (const { i, q } of ambil) {
        if (i.jenis === 'racikan') for (const kp of i.komponen) items.push({ produk_id: kp.produk_id, qty: Math.round(Number(kp.qty) * q / Number(i.qty) * 10000) / 10000 });
        else items.push({ produk_id: i.produk_id, satuan_id: i.satuan_id, qty: q });
      }
      sessionStorage.setItem('resep-ke-kasir', JSON.stringify({ resep_id: r.id, no: r.no, pasien: r.pasien_nama, pelanggan_id: r.pelanggan_id, dokter_id: r.dokter_id,
        racikan_ditebus: ambil.filter(x => x.i.jenis === 'racikan').length, resep_tebus: ambil.map(x => ({ resep_item_id: x.i.id, qty: x.q })),
        etiket: m.querySelector('[data-etiket]').checked, etiket_item: ambil.map(x => x.i.id), items }));
      location.hash = '#/penjualan/kasir';
    } }] });
}

// ================= Editor resep =================
async function editorResep(el, idParam) {
  const baru = idParam === 'baru';
  const st = baru ? { header: { tanggal_resep: hariIni(), iter: 0, skrining: {} }, items: [], foto: [] } : null;
  let r = null;
  if (!baru) {
    r = await ambilResep(idParam);
  }
  const S_ = baru ? st : {
    header: { ...r, skrining: r.skrining || {} }, foto: [...(r.foto || [])],
    items: r.item.map(i => ({ ...i, _nama: i.produk?.nama, komponen: i.komponen.map(k => ({ ...k, _nama: k.produk?.nama, _sat: k.produk?.satuan?.nama })) })),
  };
  const bisaUbah = bisa('pelayanan.penerimaan_resep') && (baru || (r.status !== 'diserahkan' && r.status !== 'batal' && r.ditebus === 'belum'));
  const dokter = await ambilRef('dokter', 'id,nama,no_sip');
  const tpl = await atauOffline(async () => { const { data, error } = await sb.from('template_racikan').select('*, item:template_racikan_item(*, produk:produk_id(nama,satuan:satuan_id(nama)))').eq('aktif', true).order('nama'); if (error) throw error; return data; }, OFF.templateL);
  const uuid = crypto.randomUUID(), fotoLokal = [];      // foto yang diambil saat offline
  // isi info satuan untuk item jadi
  const info = await infoProduk(S_.items.filter(i => i.produk_id).map(i => i.produk_id));
  S_.items.forEach(i => { if (i.produk_id) i._opsi = info[i.produk_id]?.satuanOpsi || []; });

  const h = S_.header;
  el.innerHTML = judulHalaman(baru ? 'Resep Baru' : 'Resep ' + r.no, 'Pelayanan Apotek / Penerimaan Resep', `<a class="tombol kedua" href="#/pelayanan/penerimaan_resep">${ikon('kiri')} Daftar</a>`) +
    `${!baru ? `<div class="kartu" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>${esc(r.no)}</b>${chipR(r.status)}${chipT(r.ditebus)}<span style="color:var(--teks-2)">${waktu(r.waktu)} · ${esc(r.dibuat_nama || '')}</span>
       ${r.penyiap ? `<span class="chip">disiapkan: ${esc(r.penyiap)}</span>` : ''}${r.penyerah ? `<span class="chip">diserahkan: ${esc(r.penyerah)}${r.konseling ? ' + konseling' : ''}</span>` : ''}</div>` : ''}
    <div class="grid-2" style="align-items:start">
      <div class="kartu"><h3>Pasien & Dokter</h3><form class="form-grid" data-h onsubmit="return false">
        <label class="isian lebar"><span>Nama pasien <i>*</i></span><div style="position:relative"><input class="input" name="pasien_nama" value="${esc(h.pasien_nama || '')}" placeholder="Ketik nama (bisa pilih pelanggan terdaftar)"><div class="hasil-cari sembunyi" data-hasil-pas style="left:0;right:0;top:44px"></div></div></label>
        <label class="isian"><span>Umur</span><input name="pasien_umur" value="${esc(h.pasien_umur || '')}" placeholder="mis. 7 th"></label>
        <label class="isian"><span>Jenis kelamin</span><select name="pasien_jk"><option value="">-</option><option value="L" ${h.pasien_jk === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${h.pasien_jk === 'P' ? 'selected' : ''}>Perempuan</option></select></label>
        <label class="isian"><span>Berat badan</span><input name="pasien_bb" value="${esc(h.pasien_bb || '')}" placeholder="kg"></label>
        <label class="isian"><span>No. HP</span><input name="pasien_telp" value="${esc(h.pasien_telp || '')}"></label>
        <label class="isian lebar"><span>Alamat</span><input name="pasien_alamat" value="${esc(h.pasien_alamat || '')}"></label>
        <label class="isian"><span>Dokter</span><select name="dokter_id"><option value="">- ketik manual -</option>${dokter.map(d => `<option value="${d.id}" ${d.id === h.dokter_id ? 'selected' : ''}>${esc(d.nama)}</option>`).join('')}</select></label>
        <label class="isian"><span>Nama dokter</span><input name="dokter_nama" value="${esc(h.dokter_nama || '')}"></label>
        <label class="isian"><span>SIP dokter</span><input name="dokter_sip" value="${esc(h.dokter_sip || '')}"></label>
        <label class="isian"><span>Tanggal resep</span><input type="date" name="tanggal_resep" value="${esc(h.tanggal_resep || '')}"></label>
        <label class="isian"><span>No. resep asli</span><input name="no_resep_asli" value="${esc(h.no_resep_asli || '')}"></label>
        <label class="isian"><span>Iter (diulang)</span><input type="number" min="0" name="iter" value="${h.iter || 0}"></label>
        <label class="isian lebar"><span>Catatan</span><textarea name="catatan" rows="2">${esc(h.catatan || '')}</textarea></label></form></div>
      <div><div class="kartu"><h3>Foto Resep</h3><div class="foto-resep" data-foto></div>
        ${bisaUbah ? `<label class="tombol kedua kecil" style="cursor:pointer;margin-top:8px">📷 Ambil / unggah foto<input type="file" accept="image/*" capture="environment" multiple hidden data-unggah></label>` : ''}</div>
        <div class="kartu"><h3>Skrining Resep</h3><div data-skrining></div></div></div>
    </div>
    <div class="kartu"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">Obat (R/)</h3>
      ${bisaUbah ? `<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"><button class="tombol kedua kecil" data-tambah="jadi">+ Obat jadi</button><button class="tombol kedua kecil" data-tambah="racikan">+ Racikan</button>
        ${tpl?.length ? `<select class="input" style="width:auto" data-template><option value="">+ Dari template racikan</option>${tpl.map(t => `<option value="${t.id}">${esc(t.nama)}</option>`).join('')}</select>` : ''}</span>` : ''}</div>
      <div data-r></div></div>
    <div class="kartu" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end" data-aksi></div>`;

  if (!bisaUbah) el.querySelectorAll('[data-h] input,[data-h] select,[data-h] textarea').forEach(i => i.disabled = true);
  const f = el.querySelector('[data-h]');
  f.addEventListener('change', e => {
    if (e.target.name === 'dokter_id') { const d = dokter.find(x => String(x.id) === e.target.value); if (d) { f.dokter_nama.value = d.nama; f.dokter_sip.value = d.no_sip || ''; } }
  });
  // pasien dari pelanggan terdaftar
  const ip = f.pasien_nama, hp = el.querySelector('[data-hasil-pas]'); let hasilP = [], jd;
  ip.addEventListener('input', () => { h.pelanggan_id = null; clearTimeout(jd); const q = ip.value.replace(/[,()%*]/g, ' ').trim(); if (q.length < 2) { hp.classList.add('sembunyi'); return; }
    jd = setTimeout(async () => { if (KONEKSI.putus) { hasilP = OFF.pelangganL(q); hp.innerHTML = hasilP.map((p, n) => `<a data-p="${n}"><b>${esc(p.nama)}</b> <small>${esc(p.telp || '')} · cek alergi ke pasien</small></a>`).join(''); hp.classList.toggle('sembunyi', !hasilP.length); return; } const { data } = await sb.from('pelanggan').select('id,nama,telp,alamat,tgl_lahir,jenis_kelamin,alergi').ilike('nama', `%${q}%`).limit(8); hasilP = data || [];
      hp.innerHTML = hasilP.map((p, n) => `<a data-p="${n}"><b>${esc(p.nama)}</b> <small>${esc(p.telp || '')}${p.alergi ? ' · alergi: ' + esc(p.alergi) : ''}</small></a>`).join(''); hp.classList.toggle('sembunyi', !hasilP.length); }, 250); });
  hp.addEventListener('mousedown', e => { const a = e.target.closest('[data-p]'); if (!a) return; e.preventDefault(); const p = hasilP[a.dataset.p]; h.pelanggan_id = p.id; ip.value = p.nama;
    if (p.telp) f.pasien_telp.value = p.telp; if (p.alamat) f.pasien_alamat.value = p.alamat; if (p.jenis_kelamin) f.pasien_jk.value = p.jenis_kelamin;
    if (p.tgl_lahir) f.pasien_umur.value = Math.floor((Date.now() - new Date(p.tgl_lahir)) / 3.15576e10) + ' th';
    if (p.alergi) toast('Perhatian, alergi pasien: ' + p.alergi, 'galat'); hp.classList.add('sembunyi'); });
  ip.addEventListener('blur', () => setTimeout(() => hp.classList.add('sembunyi'), 150));

  // ----- foto -----
  const wFoto = el.querySelector('[data-foto]');
  async function gambarFoto() {
    if (fotoLokal.length) { wFoto.innerHTML = fotoLokal.map((b, n) => `<div class="foto"><img src="${URL.createObjectURL(b)}" alt="Foto resep ${n + 1}"></div>`).join('') + '<p style="color:var(--teks-2);margin:0">Diunggah saat online.</p>'; return; }
    if (!S_.foto.length) { wFoto.innerHTML = '<p style="color:var(--teks-2);margin:0">Belum ada foto.</p>'; return; }
    const { data } = await sb.storage.from('resep').createSignedUrls(S_.foto, 3600);
    wFoto.innerHTML = (data || []).map((u, n) => `<div class="foto"><a href="${u.signedUrl}" target="_blank"><img src="${u.signedUrl}" alt="Foto resep ${n + 1}"></a>${bisaUbah ? `<button class="ikon-aksi hapus" data-hapus-foto="${n}" title="Hapus foto">${ikon('tutup')}</button>` : ''}</div>`).join('');
  }
  el.querySelector('[data-unggah]')?.addEventListener('change', async e => {
    for (const file of e.target.files) {
      try {
        const blob = await kecilkan(file, 1600);
        if (baru && KONEKSI.putus && OFF.siap()) { fotoLokal.push(blob); continue; }
        const path = `${S.pengguna.outlet_id}/${hariIni().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from('resep').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        S_.foto.push(path);
      } catch (er) { toast('Gagal unggah foto: ' + pesanGalat(er), 'galat'); }
    }
    e.target.value = ''; gambarFoto(); toast('Foto ditambahkan. Jangan lupa Simpan.', 'sukses');
  });
  wFoto.addEventListener('click', async e => { const b = e.target.closest('[data-hapus-foto]'); if (!b) return; const [p] = S_.foto.splice(b.dataset.hapusFoto, 1); sb.storage.from('resep').remove([p]); gambarFoto(); });
  gambarFoto();

  // ----- skrining -----
  const sk = h.skrining || {};
  el.querySelector('[data-skrining]').innerHTML = Object.entries(SKRINING).map(([g, daftar]) => `<b style="text-transform:capitalize">${g}</b><div style="margin:4px 0 10px">${daftar.map((t, n) => `<label class="cek" style="margin:2px 0"><input type="checkbox" data-sk="${g}.${n}" ${sk[`${g}.${n}`] ? 'checked' : ''} ${bisaUbah ? '' : 'disabled'}> ${esc(t)}</label>`).join('')}</div>`).join('')
    + `<label class="isian"><span>Catatan skrining / tindak lanjut (mis. konfirmasi ke dokter)</span><textarea rows="2" data-sk-cat ${bisaUbah ? '' : 'disabled'}>${esc(sk.catatan || '')}</textarea></label>`;

  // ----- R/ -----
  const wR = el.querySelector('[data-r]');
  const dis = bisaUbah ? '' : 'disabled';
  function gambarR() {
    wR.innerHTML = S_.items.length ? S_.items.map((i, n) => `<div class="kartu-r" data-ri="${n}">
      <div class="kepala-r"><b>R/ ${n + 1}</b> <span class="chip ${i.jenis === 'racikan' ? 'oranye' : 'teal'}">${i.jenis === 'racikan' ? 'Racikan' : 'Obat jadi'}</span>
        ${!baru && i.qty_ditebus > 0 ? `<span class="chip">ditebus ${angka(i.qty_ditebus)}</span>` : ''}${bisaUbah ? `<button class="ikon-aksi hapus" data-hapus-r="${n}" style="margin-left:auto">${ikon('hapus')}</button>` : ''}</div>
      ${i.jenis === 'racikan' ? `<div class="form-grid">
          <label class="isian"><span>Nama racikan</span><input data-f="nama_racikan" value="${esc(i.nama_racikan || '')}" ${dis} placeholder="mis. Puyer batuk pilek"></label>
          <label class="isian"><span>Bentuk</span><select data-f="bentuk" ${dis}>${BENTUK.map(b => `<option ${b === i.bentuk ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
          <label class="isian"><span>Jumlah (bungkus/kapsul/pot)</span><input type="number" min="0" step="any" data-f="qty" value="${i.qty ?? ''}" ${dis}></label></div>
        <div class="bungkus-tabel"><table class="tabel"><thead><tr><th>Komponen</th><th>Jumlah total (satuan terkecil)</th><th>Dosis tertulis</th><th></th></tr></thead><tbody>
          ${(i.komponen || []).map((k, m) => `<tr><td><b>${esc(k._nama || '')}</b></td><td><input type="number" class="input" style="width:110px" min="0" step="any" data-k="${m}" data-kf="qty" value="${k.qty ?? ''}" ${dis}> ${esc(k._sat || '')}</td>
            <td><input class="input" data-k="${m}" data-kf="dosis" value="${esc(k.dosis || '')}" ${dis} placeholder="mis. 250 mg"></td><td>${bisaUbah ? `<button class="ikon-aksi hapus" data-hapus-k="${m}">${ikon('tutup')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>${bisaUbah ? `<div style="max-width:420px;margin-top:8px"><input class="input" data-cari-k placeholder="+ Tambah komponen: cari obat lalu Enter"></div>` : ''}`
      : `<div class="form-grid">
          <label class="isian lebar"><span>Obat</span>${i.produk_id ? `<div style="display:flex;gap:8px;align-items:center"><b>${esc(i._nama || '')}</b>${bisaUbah ? '<button type="button" class="tombol kedua kecil" data-ganti>Ganti</button>' : ''}</div>` : `<input class="input" data-cari-j placeholder="Cari obat lalu Enter" ${dis}>`}</label>
          <label class="isian"><span>Satuan</span><select data-f="satuan_id" ${dis}>${(i._opsi || []).map(s => `<option value="${s.satuan_id}" data-isi="${s.isi}" ${s.satuan_id === i.satuan_id ? 'selected' : ''}>${esc(s.nama)}</option>`).join('')}</select></label>
          <label class="isian"><span>Jumlah</span><input type="number" min="0" step="any" data-f="qty" value="${i.qty ?? ''}" ${dis}></label></div>`}
      <div class="form-grid">
        <label class="isian"><span>Aturan pakai (signa)</span><input data-f="signa" value="${esc(i.signa || '')}" ${dis} placeholder="mis. 3 x sehari 1 tablet"></label>
        <label class="isian"><span>Waktu</span><select data-f="aturan" ${dis}>${ATURAN.map(a => `<option value="${a}" ${a === (i.aturan || '') ? 'selected' : ''}>${a || '-'}</option>`).join('')}</select></label>
        <label class="isian"><span>Pemakaian</span><select data-f="pemakaian" ${dis}><option value="dalam" ${i.pemakaian !== 'luar' ? 'selected' : ''}>Obat dalam (etiket putih)</option><option value="luar" ${i.pemakaian === 'luar' ? 'selected' : ''}>Obat luar (etiket biru)</option></select></label>
        <label class="isian"><span>Keterangan</span><input data-f="keterangan" value="${esc(i.keterangan || '')}" ${dis} placeholder="mis. dihabiskan"></label></div></div>`).join('')
      : '<p class="kosong" style="text-align:center;color:var(--teks-2)">Belum ada obat. Tambah obat jadi atau racikan.</p>';
    if (!bisaUbah) return;
    wR.querySelectorAll('[data-cari-j]').forEach(inp => pasangCariProduk(inp, async p => {
      const n = Number(inp.closest('[data-ri]').dataset.ri), it = S_.items[n];
      const inf = (await infoProduk([p.id]))[p.id];
      Object.assign(it, { produk_id: p.id, _nama: p.nama, _opsi: inf.satuanOpsi, satuan_id: inf.satuan_id, isi: 1 });
      if (['keras', 'psikotropika', 'narkotika'].includes(inf.golongan)) toast(`${p.nama}: golongan ${inf.golongan}`, '');
      gambarR();
    }));
    wR.querySelectorAll('[data-cari-k]').forEach(inp => pasangCariProduk(inp, p => {
      const it = S_.items[Number(inp.closest('[data-ri]').dataset.ri)];
      (it.komponen ||= []).push({ produk_id: p.id, _nama: p.nama, _sat: p.satuan?.nama, qty: null, dosis: '' });
      gambarR();
      const ri = wR.querySelector(`[data-ri="${S_.items.indexOf(it)}"]`); ri?.querySelectorAll('[data-kf="qty"]')[it.komponen.length - 1]?.focus();
    }));
  }
  wR.addEventListener('input', e => {
    const t = e.target, ri = t.closest('[data-ri]'); if (!ri) return; const it = S_.items[ri.dataset.ri];
    if (t.dataset.f) { if (t.dataset.f === 'satuan_id') { it.satuan_id = Number(t.value); it.isi = Number(t.selectedOptions[0]?.dataset.isi || 1); } else it[t.dataset.f] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value; }
    if (t.dataset.k !== undefined) it.komponen[t.dataset.k][t.dataset.kf] = t.dataset.kf === 'qty' ? (t.value === '' ? null : Number(t.value)) : t.value;
  });
  wR.addEventListener('click', e => {
    const ri = e.target.closest('[data-ri]'); if (!ri) return; const n = Number(ri.dataset.ri);
    if (e.target.closest('[data-hapus-r]')) { S_.items.splice(n, 1); gambarR(); }
    if (e.target.closest('[data-hapus-k]')) { S_.items[n].komponen.splice(e.target.closest('[data-hapus-k]').dataset.hapusK, 1); gambarR(); }
    if (e.target.closest('[data-ganti]')) { Object.assign(S_.items[n], { produk_id: null, _nama: null, _opsi: [] }); gambarR(); }
  });
  el.querySelectorAll('[data-tambah]').forEach(b => b.onclick = () => { S_.items.push(b.dataset.tambah === 'racikan' ? { jenis: 'racikan', bentuk: 'puyer', qty: 10, komponen: [], pemakaian: 'dalam' } : { jenis: 'jadi', pemakaian: 'dalam' }); gambarR(); });
  el.querySelector('[data-template]')?.addEventListener('change', e => {
    const t = tpl.find(x => String(x.id) === e.target.value); e.target.value = ''; if (!t) return;
    S_.items.push({ jenis: 'racikan', nama_racikan: t.nama, bentuk: t.bentuk, qty: Number(t.jumlah), signa: t.signa, aturan: t.aturan, pemakaian: t.pemakaian || 'dalam', keterangan: t.keterangan,
      komponen: t.item.map(x => ({ produk_id: x.produk_id, _nama: x.produk?.nama, _sat: x.produk?.satuan?.nama, qty: Number(x.qty), dosis: x.dosis })) });
    gambarR(); toast('Template ' + t.nama + ' ditambahkan');
  });
  gambarR();

  // ----- aksi -----
  const muatan = () => {
    const d = Object.fromEntries([...f.elements].filter(x => x.name).map(x => [x.name, x.value]));
    const skr = {}; el.querySelectorAll('[data-sk]').forEach(c => { if (c.checked) skr[c.dataset.sk] = true; }); skr.catatan = el.querySelector('[data-sk-cat]').value;
    return { ...d, id: baru ? null : r.id, pelanggan_id: h.pelanggan_id || null, foto: S_.foto, skrining: skr,
      items: S_.items.map(i => ({ jenis: i.jenis, produk_id: i.produk_id, satuan_id: i.satuan_id, isi: i.isi || 1, qty: i.qty, nama_racikan: i.nama_racikan, bentuk: i.bentuk,
        signa: i.signa, aturan: i.aturan, pemakaian: i.pemakaian, keterangan: i.keterangan, komponen: (i.komponen || []).map(k => ({ produk_id: k.produk_id, qty: k.qty, dosis: k.dosis })) })) };
  };
  const aksi = el.querySelector('[data-aksi]');
  const tombol = (teks, kelas, fn) => { const b = document.createElement('button'); b.className = 'tombol ' + kelas; b.textContent = teks; b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { toast(pesanGalat(e), 'galat'); } finally { b.disabled = false; } }; aksi.append(b); };
  const simpan = async () => {
    const p = muatan();
    if (S_.items.some(i => i.jenis === 'racikan' && (i.komponen || []).some(k => !(k.qty > 0)))) throw new Error('Isi jumlah setiap komponen racikan.');
    const kirim = async () => { const { data, error } = await sb.rpc('simpan_resep_u', { p: { ...p, uuid: baru ? uuid : null } }); if (error) throw error; return data; };
    if (!baru) return kirim();
    if (fotoLokal.length) return OFF.resepL(uuid, p, fotoLokal);   // foto belum terunggah: kirim lewat antrean
    return atauOffline(kirim, () => OFF.resepL(uuid, p, []));
  };
  const muatUlang = id => { if (String(id) === String(idParam)) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '#/pelayanan/penerimaan_resep/' + id; };
  const status = async (s, konseling = null) => { const { error } = await sb.rpc('ubah_status_resep', { p_id: r.id, p_status: s, p_konseling: konseling }); if (error) throw error; toast('Status diperbarui', 'sukses'); muatUlang(r.id); };
  if (bisaUbah) tombol('Simpan', '', async () => { const d = await simpan();
    if (!d.offline) { toast('Resep ' + d.no + ' tersimpan', 'sukses'); muatUlang(d.id); return; }
    OFF.sinkron();
    el.innerHTML = judulHalaman('Resep ' + d.no, 'Pelayanan Apotek / Resep offline') + `<div class="kartu"><p class="pesan info" style="margin-top:0">Resep tersimpan di perangkat dan dikirim otomatis saat online.</p><p><b>${esc(d.pasien_nama)}</b> · ${d.item.length} R/</p><div class="judul-halaman" style="margin:0"><button class="tombol" data-e>Cetak Etiket</button><button class="tombol kedua" data-c>Copy Resep</button><a class="tombol kedua" href="#/home">Selesai</a></div></div>`;
    el.querySelector('[data-e]').onclick = () => cetakEtiket(d).catch(x => toast(pesanGalat(x), 'galat')); el.querySelector('[data-c]').onclick = () => cetakCopyResep(d).catch(x => toast(pesanGalat(x), 'galat'));
  });
  if (!baru && r.status !== 'batal') {
    if (bisaUbah) tombol('Batalkan Resep', 'bahaya', async () => { if (await konfirmasi('Batalkan resep', `Batalkan resep <b>${esc(r.no)}</b>?`, 'Batalkan')) await status('batal'); });
    if (r.status === 'diterima' && bisa('pelayanan.penerimaan_resep')) tombol('Tandai Disiapkan', 'kedua', async () => { if (bisaUbah) await simpan(); await status('disiapkan'); });
    if (r.ditebus !== 'penuh' && bisa('pelayanan.penebusan_resep')) tombol('Tebus di Kasir', 'oranye', async () => { if (bisaUbah) await simpan(); tebusResep(await ambilResep(r.id)); });
    if (r.ditebus !== 'belum' && r.status !== 'diserahkan') tombol('Serahkan ke Pasien', '', () => new Promise(res => modal({ judul: 'Serahkan obat', ukuran: 'kecil',
      isi: `<p style="margin-top:0">Pastikan obat, etiket, dan identitas pasien sudah sesuai.</p><label class="cek"><input type="checkbox" data-k checked> Sudah diberi informasi / konseling cara pakai</label>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua', aksi: () => res() }, { teks: 'Serahkan', aksi: async m => { await status('diserahkan', m.querySelector('[data-k]').checked); res(); } }] })));
    tombol('Cetak Etiket', 'kedua', async () => cetakEtiket(await ambilResep(r.id)));
    tombol('Copy Resep (thermal)', 'kedua', async () => cetakCopyResep(await ambilResep(r.id), 'thermal'));
    tombol('Copy Resep (A5)', 'kedua', async () => cetakCopyResep(await ambilResep(r.id), 'a5'));
  }
  return baru ? 'Resep Baru' : 'Resep ' + r.no;
}

function kecilkan(file, maks) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const s = Math.min(1, maks / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? res(b) : rej(new Error('Gagal memproses foto')), 'image/jpeg', 0.82); URL.revokeObjectURL(img.src); };
    img.onerror = () => rej(new Error('File bukan gambar')); img.src = URL.createObjectURL(file);
  });
}

// ================= Template Racikan =================
async function isiTemplateHtml(baris) {
  const produk = await ambilRef('produk', 'id,nama');
  const rows = baris ? (await sb.from('template_racikan_item').select('*').eq('template_id', baris.id).order('id')).data || [] : [];
  const opsi = v => produk.map(p => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nama)}</option>`).join('');
  window.__barisTpl = r => `<tr><td><select class="input" name="_tp_produk">${opsi(r.produk_id)}</select></td><td><input class="input" type="number" min="0.0001" step="any" name="_tp_qty" value="${r.qty ?? ''}" style="width:100px"></td>
    <td><input class="input" name="_tp_dosis" value="${esc(r.dosis || '')}" placeholder="mis. 250 mg"></td><td><button type="button" class="ikon-aksi hapus" data-hapus-tp>✕</button></td></tr>`;
  return `<b>Komponen</b> <small style="color:var(--teks-2)">(jumlah total satuan terkecil untuk seluruh racikan)</small>
    <div class="bungkus-tabel" style="margin-top:8px"><table class="tabel"><thead><tr><th>Obat</th><th>Jumlah</th><th>Dosis</th><th></th></tr></thead><tbody data-tp>${rows.map(window.__barisTpl).join('')}</tbody></table></div>
    <button type="button" class="tombol kedua kecil" style="margin-top:8px" data-tambah-tp>+ Tambah komponen</button>`;
}
rute('pelayanan/racikan', halamanCrud({
  judul: 'Template Racikan', remah: 'Pelayanan Apotek / Template Racikan', tabel: 'template_racikan', satuan: 'Template Racikan', kunciTulis: ['pelayanan.racikan'], ukuranForm: 'besar',
  kolom: [{ f: 'nama', label: 'Nama', wajib: true }, { f: 'bentuk', label: 'Bentuk', tipe: 'pilih', opsi: BENTUK.map(b => [b, b]), wajib: true },
    { f: 'jumlah', label: 'Jumlah (bungkus/kapsul)', tipe: 'angka', min: 0 }, { f: 'signa', label: 'Aturan pakai' },
    { f: 'aturan', label: 'Waktu', tipe: 'pilih', opsi: ATURAN.filter(Boolean).map(a => [a, a]), daftar: false },
    { f: 'pemakaian', label: 'Pemakaian', tipe: 'pilih', opsi: [['dalam', 'Obat dalam'], ['luar', 'Obat luar']], daftar: false },
    { f: 'keterangan', label: 'Keterangan', tipe: 'area', daftar: false }, { f: 'aktif', label: 'Aktif', tipe: 'bool' }],
  bawaan: { bentuk: 'puyer', jumlah: 10, pemakaian: 'dalam', aktif: true },
  ekstraForm: isiTemplateHtml,
  saatBukaForm: m => m.addEventListener('click', e => {
    if (e.target.closest('[data-tambah-tp]')) m.querySelector('[data-tp]').insertAdjacentHTML('beforeend', window.__barisTpl({}));
    if (e.target.closest('[data-hapus-tp]')) e.target.closest('tr').remove();
  }),
  sebelumSimpan: () => { if (!document.querySelectorAll('[name=_tp_produk]').length) throw new Error('Isi minimal 1 komponen.'); },
  setelahSimpan: async (id, m) => {
    const p = [...m.querySelectorAll('[name=_tp_produk]')], q = [...m.querySelectorAll('[name=_tp_qty]')], d = [...m.querySelectorAll('[name=_tp_dosis]')];
    const rows = p.map((s, i) => ({ template_id: id, produk_id: Number(s.value), qty: Number(q[i].value), dosis: d[i].value || null })).filter(r => r.qty > 0);
    const { error: e1 } = await sb.from('template_racikan_item').delete().eq('template_id', id); if (e1) throw e1;
    if (rows.length) { const { error } = await sb.from('template_racikan_item').insert(rows); if (error) throw error; }
  },
}));

// ================= Catatan pelayanan (CRUD) =================
const pasienKolom = [{ f: 'pelanggan_id', label: 'Pasien terdaftar', tipe: 'ref', ref: 'pelanggan', daftar: false, bantu: 'Opsional. Pilih agar masuk Catatan Pengobatan pasien.' },
  { f: 'pasien_nama', label: 'Nama pasien', wajib: true }];
const umum = (kunci, judul, tabel, kolom, ekstra = {}) => rute('pelayanan/' + kunci, halamanCrud({
  judul, remah: 'Pelayanan Apotek / ' + judul, tabel, satuan: judul, kunciTulis: ['pelayanan.' + kunci], ukuranForm: 'besar',
  kolom: [{ f: 'tanggal', label: 'Tanggal', tipe: 'tanggal', wajib: true }, ...kolom, { f: 'petugas', label: 'Petugas', form: false }],
  urut: 'tanggal', naik: false, labelBaris: 'pasien_nama',
  bawaan: { get tanggal() { return hariIni(); } },
  saring: q => q.eq('outlet_id', S.pengguna.outlet_id),
  sebelumSimpan: async (d, baris) => {
    d.outlet_id = baris?.outlet_id ?? S.pengguna.outlet_id;
    if (!baris) d.petugas = S.pengguna.nama;
    if (d.pelanggan_id && !d.pasien_nama) { const { data } = await sb.from('pelanggan').select('nama').eq('id', d.pelanggan_id).single(); d.pasien_nama = data?.nama; }
  },
  ...ekstra,
}));

umum('swamedikasi', 'Swamedikasi', 'swamedikasi', [...pasienKolom, { f: 'pasien_umur', label: 'Umur', daftar: false }, { f: 'pasien_jk', label: 'Jenis kelamin', tipe: 'pilih', opsi: [['L', 'Laki-laki'], ['P', 'Perempuan']], daftar: false },
  { f: 'keluhan', label: 'Keluhan', tipe: 'area', wajib: true }, { f: 'lama_keluhan', label: 'Sudah berapa lama', daftar: false }, { f: 'obat_dipakai', label: 'Obat yang sudah dipakai', tipe: 'area', daftar: false },
  { f: 'alergi', label: 'Alergi', daftar: false }, { f: 'rekomendasi', label: 'Obat dianjurkan', tipe: 'area' }, { f: 'edukasi', label: 'Informasi / edukasi', tipe: 'area', daftar: false },
  { f: 'rujuk_dokter', label: 'Disarankan ke dokter', tipe: 'bool' }, { f: 'no_penjualan', label: 'No. nota penjualan', daftar: false }], { cari: ['pasien_nama', 'keluhan'] });

umum('hpc', 'Home Pharmacy Care', 'home_care', [...pasienKolom, { f: 'alamat', label: 'Alamat', daftar: false }, { f: 'telp', label: 'No. HP', daftar: false },
  { f: 'tujuan', label: 'Tujuan kunjungan', tipe: 'area' }, { f: 'obat_digunakan', label: 'Obat yang digunakan', tipe: 'area', daftar: false },
  { f: 'kepatuhan', label: 'Kepatuhan', tipe: 'pilih', opsi: [['patuh', 'Patuh'], ['kurang patuh', 'Kurang patuh'], ['tidak patuh', 'Tidak patuh']] },
  { f: 'temuan', label: 'Masalah / temuan', tipe: 'area', daftar: false }, { f: 'rekomendasi', label: 'Rekomendasi', tipe: 'area', daftar: false },
  { f: 'tindak_lanjut', label: 'Tindak lanjut', tipe: 'area', daftar: false }, { f: 'kunjungan_berikut', label: 'Kunjungan berikutnya', tipe: 'tanggal' }], { cari: ['pasien_nama'] });

umum('pio', 'Pelayanan Informasi Obat', 'pio', [{ f: 'penanya', label: 'Nama penanya', wajib: true },
  { f: 'status_penanya', label: 'Penanya', tipe: 'pilih', opsi: [['pasien', 'Pasien'], ['keluarga', 'Keluarga pasien'], ['dokter', 'Dokter'], ['perawat/bidan', 'Perawat/bidan'], ['lainnya', 'Lainnya']] },
  { f: 'metode', label: 'Cara bertanya', tipe: 'pilih', opsi: [['langsung', 'Langsung'], ['telepon', 'Telepon'], ['whatsapp', 'WhatsApp'], ['lainnya', 'Lainnya']], daftar: false },
  { f: 'telp', label: 'No. HP', daftar: false }, { f: 'pertanyaan', label: 'Pertanyaan', tipe: 'area', wajib: true }, { f: 'jawaban', label: 'Jawaban', tipe: 'area' },
  { f: 'referensi', label: 'Referensi', daftar: false }, { f: 'perlu_tindak_lanjut', label: 'Perlu tindak lanjut', tipe: 'bool' }], { cari: ['penanya', 'pertanyaan'], labelBaris: 'penanya' });

umum('meso', 'MESO (Efek Samping Obat)', 'meso', [...pasienKolom, { f: 'pasien_umur', label: 'Umur', daftar: false }, { f: 'pasien_jk', label: 'Jenis kelamin', tipe: 'pilih', opsi: [['L', 'Laki-laki'], ['P', 'Perempuan']], daftar: false },
  { f: 'pasien_bb', label: 'Berat badan', daftar: false }, { f: 'obat_dicurigai', label: 'Obat yang dicurigai', wajib: true }, { f: 'dosis', label: 'Dosis & frekuensi', daftar: false },
  { f: 'cara_pemberian', label: 'Cara pemberian', daftar: false }, { f: 'indikasi', label: 'Indikasi', daftar: false },
  { f: 'tgl_mulai_obat', label: 'Mulai pakai obat', tipe: 'tanggal', daftar: false }, { f: 'tgl_stop_obat', label: 'Berhenti pakai obat', tipe: 'tanggal', daftar: false },
  { f: 'reaksi', label: 'Reaksi / gejala efek samping', tipe: 'area', wajib: true }, { f: 'tgl_mulai_reaksi', label: 'Reaksi mulai', tipe: 'tanggal', daftar: false },
  { f: 'keparahan', label: 'Keparahan', tipe: 'pilih', opsi: [['ringan', 'Ringan'], ['sedang', 'Sedang'], ['berat', 'Berat']] },
  { f: 'tindakan', label: 'Tindakan yang dilakukan', tipe: 'area', daftar: false },
  { f: 'kesudahan', label: 'Kesudahan', tipe: 'pilih', opsi: [['sembuh', 'Sembuh'], ['sembuh dengan gejala sisa', 'Sembuh dengan gejala sisa'], ['belum sembuh', 'Belum sembuh'], ['meninggal', 'Meninggal'], ['tidak tahu', 'Tidak tahu']], daftar: false },
  { f: 'obat_lain', label: 'Obat lain yang dipakai bersamaan', tipe: 'area', daftar: false }, { f: 'riwayat', label: 'Riwayat penyakit / alergi', tipe: 'area', daftar: false },
  { f: 'dilaporkan_bpom', label: 'Sudah dilaporkan ke BPOM (e-MESO)', tipe: 'bool' }],
  { cari: ['pasien_nama', 'obat_dicurigai'], aksiBaris: [{ ikon: 'laporan', judul: 'Cetak formulir', fn: cetakMeso }] });

umum('konseling', 'Konseling', 'konseling', [...pasienKolom, { f: 'resep_no', label: 'No. resep', daftar: false }, { f: 'obat', label: 'Obat yang dikonselingkan', tipe: 'area' },
  { f: 'tpq1', label: '1. Apa yang dokter katakan tentang obat ini?', tipe: 'area', daftar: false },
  { f: 'tpq2', label: '2. Bagaimana dokter menjelaskan cara pakainya?', tipe: 'area', daftar: false },
  { f: 'tpq3', label: '3. Apa yang dokter katakan tentang harapan setelah minum obat?', tipe: 'area', daftar: false },
  { f: 'masalah', label: 'Masalah yang ditemukan', tipe: 'area', daftar: false }, { f: 'rekomendasi', label: 'Rekomendasi / informasi yang diberikan', tipe: 'area', daftar: false },
  { f: 'pemahaman', label: 'Pemahaman pasien', tipe: 'pilih', opsi: [['paham', 'Paham'], ['kurang paham', 'Kurang paham'], ['tidak paham', 'Tidak paham']] }], { cari: ['pasien_nama', 'obat'] });

async function cetakMeso(m) {
  const { data: o } = await sb.from('outlet').select('*').eq('id', m.outlet_id).single();
  const b = (l, v) => `<tr><td style="width:38%">${esc(l)}</td><td>${esc(v ?? '')}</td></tr>`;
  cetakKertasBiasa(`<h2 style="text-align:center;margin:0">FORMULIR PELAPORAN EFEK SAMPING OBAT (MESO)</h2><p style="text-align:center;margin:4px 0 14px">${esc(o.nama)} · ${esc(o.alamat || '')}</p>
    <h3>Data Pasien</h3><table>${b('Nama', m.pasien_nama)}${b('Umur', m.pasien_umur)}${b('Jenis kelamin', m.pasien_jk === 'L' ? 'Laki-laki' : m.pasien_jk === 'P' ? 'Perempuan' : '')}${b('Berat badan', m.pasien_bb)}${b('Riwayat penyakit/alergi', m.riwayat)}</table>
    <h3>Obat</h3><table>${b('Obat dicurigai', m.obat_dicurigai)}${b('Dosis & frekuensi', m.dosis)}${b('Cara pemberian', m.cara_pemberian)}${b('Indikasi', m.indikasi)}${b('Mulai / berhenti', `${tanggal(m.tgl_mulai_obat)} s.d. ${tanggal(m.tgl_stop_obat)}`)}${b('Obat lain bersamaan', m.obat_lain)}</table>
    <h3>Efek Samping</h3><table>${b('Reaksi / gejala', m.reaksi)}${b('Mulai terjadi', tanggal(m.tgl_mulai_reaksi))}${b('Keparahan', m.keparahan)}${b('Tindakan', m.tindakan)}${b('Kesudahan', m.kesudahan)}</table>
    <p style="margin-top:30px">Tanggal lapor: ${tanggal(m.tanggal)}</p><div style="text-align:right;margin-top:40px">Pelapor,<br><br><br>( ${esc(m.pelapor || m.petugas || o.apoteker || '')} )</div>`,
    `.kertas{font:12px/1.5 Arial,sans-serif}table{width:100%;border-collapse:collapse}td{border:1px solid #444;padding:4px 6px;vertical-align:top}h3{margin:14px 0 4px;font-size:13px}`, 'MESO ' + m.pasien_nama, 'A4');
}

// ================= Catatan Pengobatan (riwayat per pasien) =================
rute('pelayanan/catatan', async el => {
  el.innerHTML = judulHalaman('Catatan Pengobatan', 'Pelayanan Apotek / Catatan Pengobatan') + `<div class="kartu"><div style="position:relative;max-width:520px">
    <input class="input input-besar" data-cari placeholder="Cari pasien (pelanggan terdaftar) atau ketik nama pasien..."><div class="hasil-cari sembunyi" data-hasil style="left:0;right:0;top:50px"></div></div></div><div data-isi></div>`;
  const ip = el.querySelector('[data-cari]'), hp = el.querySelector('[data-hasil]'); let hasil = [], jd;
  ip.addEventListener('input', () => { clearTimeout(jd); const q = ip.value.replace(/[,()%*]/g, ' ').trim(); if (q.length < 2) { hp.classList.add('sembunyi'); return; }
    jd = setTimeout(async () => { const { data } = await sb.from('pelanggan').select('id,nama,telp,alergi,tgl_lahir,jenis_kelamin').or(`nama.ilike.%${q}%,telp.ilike.%${q}%,kode.ilike.%${q}%`).limit(8);
      hasil = data || []; hp.innerHTML = hasil.map((p, n) => `<a data-p="${n}"><b>${esc(p.nama)}</b> <small>${esc(p.telp || '')}</small></a>`).join('') + `<a data-nama="${esc(q)}">Cari berdasarkan nama "<b>${esc(q)}</b>" (pasien belum terdaftar)</a>`;
      hp.classList.remove('sembunyi'); }, 250); });
  hp.addEventListener('mousedown', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); hp.classList.add('sembunyi');
    if (a.dataset.p !== undefined) { ip.value = hasil[a.dataset.p].nama; riwayat(hasil[a.dataset.p], null); } else if (a.dataset.nama) riwayat(null, a.dataset.nama); });
  async function riwayat(p, nama) {
    const isi = el.querySelector('[data-isi]'); isi.innerHTML = '<div class="kartu">Memuat...</div>';
    const f = q => p ? q.eq('pelanggan_id', p.id) : q.ilike('pasien_nama', `%${nama}%`);
    const [rs, sw, ks, ms, hc, jl] = await Promise.all([
      f(sb.from('resep').select('*, item:resep_item(*, produk:produk_id(nama), komponen:resep_komponen(produk:produk_id(nama)))')).order('tanggal', { ascending: false }).limit(100),
      f(sb.from('swamedikasi').select('*')).order('tanggal', { ascending: false }).limit(100),
      f(sb.from('konseling').select('*')).order('tanggal', { ascending: false }).limit(100),
      f(sb.from('meso').select('*')).order('tanggal', { ascending: false }).limit(100),
      f(sb.from('home_care').select('*')).order('tanggal', { ascending: false }).limit(100),
      p ? sb.from('penjualan').select('no,tanggal,total,status,item:penjualan_item(nama,qty,satuan_nama)').eq('pelanggan_id', p.id).eq('status', 'selesai').order('tanggal', { ascending: false }).limit(100) : { data: [] },
    ]);
    const ev = [
      ...(rs.data || []).map(x => ({ t: x.tanggal, jenis: 'Resep', w: 'teal', isi: `<a href="#/pelayanan/penerimaan_resep/${x.id}">${esc(x.no)}</a> · ${esc(x.dokter_nama || 'dokter -')} ·${chipT(x.ditebus)}<br>${x.item.sort((a, b) => a.urutan - b.urutan).map(i => `R/ ${esc(namaItem(i))}${i.jenis === 'racikan' ? ' (' + i.komponen.map(k => esc(k.produk?.nama || '')).join(', ') + ')' : ''} — ${esc(i.signa || '')}`).join('<br>')}` })),
      ...(sw.data || []).map(x => ({ t: x.tanggal, jenis: 'Swamedikasi', w: '', isi: `Keluhan: ${esc(x.keluhan)}<br>Dianjurkan: ${esc(x.rekomendasi || '-')}${x.rujuk_dokter ? ' · <b>dirujuk ke dokter</b>' : ''}` })),
      ...(ks.data || []).map(x => ({ t: x.tanggal, jenis: 'Konseling', w: 'hijau', isi: `${esc(x.obat || '')}${x.masalah ? '<br>Masalah: ' + esc(x.masalah) : ''}${x.pemahaman ? ' · ' + esc(x.pemahaman) : ''}` })),
      ...(ms.data || []).map(x => ({ t: x.tanggal, jenis: 'MESO', w: 'merah', isi: `<b>${esc(x.obat_dicurigai)}</b>: ${esc(x.reaksi)} (${esc(x.keparahan || '-')})` })),
      ...(hc.data || []).map(x => ({ t: x.tanggal, jenis: 'Home Care', w: 'oranye', isi: `${esc(x.tujuan || '')}${x.kepatuhan ? ' · kepatuhan: ' + esc(x.kepatuhan) : ''}` })),
      ...(jl.data || []).map(x => ({ t: x.tanggal, jenis: 'Pembelian', w: '', isi: `${esc(x.no)} · ${rupiah(x.total)}<br><small>${x.item.map(i => esc(i.nama) + ' ×' + angka(i.qty)).join(', ')}</small>` })),
    ].sort((a, b) => (b.t || '').localeCompare(a.t || ''));
    isi.innerHTML = `<div class="kartu"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">${esc(p?.nama || nama)}</h3>
      ${p?.telp ? `<span>${esc(p.telp)}</span>` : ''}${p?.tgl_lahir ? `<span>${Math.floor((Date.now() - new Date(p.tgl_lahir)) / 3.15576e10)} th</span>` : ''}
      ${p?.alergi ? `<span class="chip merah">Alergi: ${esc(p.alergi)}</span>` : ''}<span style="margin-left:auto;color:var(--teks-2)">${ev.length} catatan</span></div></div>
      <div class="kartu">${ev.length ? ev.map(x => `<div class="garis-waktu"><div><small>${tanggal(x.t)}</small><br><span class="chip ${x.w}">${x.jenis}</span></div><div>${x.isi}</div></div>`).join('') : '<p class="kosong" style="text-align:center;color:var(--teks-2)">Belum ada catatan.</p>'}</div>`;
  }
  return 'Catatan Pengobatan';
});
