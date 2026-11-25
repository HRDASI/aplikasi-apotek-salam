// Program & MOU dari sales / PBF / pabrik: periode, target (dihitung dari faktur), bukti MOU, dan insentif.
import { rute, sb, S, ambilRef } from '../inti.js?v=1.25.0';
import { ikon } from '../menu.js?v=1.25.0';
import { esc, angka, rupiah, tanggal, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.25.0';
import { rpc, hariIni, geserHari, tabelHtml, barPeriode, unduhTabel } from '../tabel.js?v=1.25.0';
import { pasangCariProduk } from '../dokumen.js?v=1.25.0';

const PIHAK = [['pbf', 'PBF / Distributor'], ['pabrik', 'Pabrik / Prinsipal'], ['sales', 'Sales perorangan'], ['lainnya', 'Lainnya']];
export const JENIS = [['diskon', 'Diskon'], ['bonus', 'Bonus barang'], ['target', 'Target pembelian'], ['display', 'Display / sewa rak'], ['cashback', 'Cashback'], ['retur_ed', 'Retur ED'], ['lainnya', 'Lainnya']];
const BENTUK = [['uang', 'Uang / transfer'], ['barang', 'Barang'], ['potongan', 'Potongan faktur'], ['voucher', 'Voucher'], ['perjalanan', 'Perjalanan'], ['lainnya', 'Lainnya']];
const KEADAAN = { berjalan: ['Berjalan', 'hijau'], segera: ['Segera berakhir', 'oranye'], belum: ['Belum mulai', ''], berakhir: ['Berakhir', 'merah'], dihentikan: ['Dihentikan', 'merah'] };
const nama = (d, k) => (d.find(x => x[0] === k) || [k, k])[1];
const opsi = (d, v) => d.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
const galat = (el, e) => { el.innerHTML = `<div class="kartu"><p class="pesan galat">${esc(pesanGalat(e))}</p></div>`; };
const nilaiT = (p, v) => p.target_jenis === 'qty' ? angka(v) + ' satuan' : rupiah(v);
const aktif = p => ['berjalan', 'segera'].includes(p.keadaan);
const pihakNama = p => p.supplier || p.pabrik || p.kontak_nama || '-';
const sisaHari = p => p.selesai ? p.keadaan === 'berakhir' ? `berakhir ${tanggal(p.selesai)}` : p.sisa_hari === 0 ? 'berakhir hari ini' : `sisa ${p.sisa_hari} hari` : 'tanpa tanggal akhir';
const bar = p => { const s = Math.min(100, Math.max(0, Number(p.capai) / Number(p.target) * 100)); return `<span class="bar-kpi" style="width:140px"><i style="width:${s}%"></i></span> <b>${Math.floor(Number(p.capai) / Number(p.target) * 100)}%</b>`; };

// ---------- Berkas ----------
const kecil = file => new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); const k = Math.min(1, 1800 / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height); c.toBlob(b => b ? res(b) : rej(new Error('Gambar tidak terbaca')), 'image/jpeg', .85); }; i.onerror = () => rej(new Error('Gambar tidak terbaca: ' + file.name)); i.src = u; });
async function unggah(files, folder) {
  const hasil = [];
  for (const f of files) {
    const pdf = f.type === 'application/pdf';
    if (!pdf && !f.type.startsWith('image/')) throw new Error('Hanya foto atau PDF: ' + f.name);
    if (pdf && f.size > 10485760) throw new Error('PDF maksimal 10 MB: ' + f.name);
    const isi = pdf ? f : await kecil(f), path = `${S.pengguna.outlet_id}/${folder}/${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`;
    const { error } = await sb.storage.from('mou').upload(path, isi, { contentType: pdf ? 'application/pdf' : 'image/jpeg' });
    if (error) throw error;
    hasil.push({ path, nama: f.name.slice(0, 120) });
  }
  return hasil;
}
async function bukaBerkas(path) {
  const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('mou').createSignedUrl(path, 300);
  if (error) { w?.close(); return toast('Berkas tidak bisa dibuka: ' + pesanGalat(error), 'galat'); }
  if (w) { w.opener = null; w.location.href = data.signedUrl; } else location.href = data.signedUrl;
}
const daftarBerkas = (b, hapus) => b.length ? b.map((x, i) => `<span class="chip" style="margin:2px">${/\.pdf$/.test(x.path) ? '📄' : '📷'} <a href="#" data-buka="${esc(x.path)}">${esc(x.nama)}</a>${hapus ? ` <a href="#" data-buang="${i}" title="Hapus" style="color:var(--merah)">✕</a>` : ''}</span>`).join('') : '<span style="color:var(--teks-2)">Belum ada berkas.</span>';

rute('pembelian/program', async (el, [id]) => {
  let d, tab = 'program', st = { q: '', k: 'aktif' };
  const ambil = async () => { d = await rpc('daftar_program'); };
  const cari = i => d.program.find(p => p.id === Number(i));
  const saring = () => d.program.filter(p => (st.k === 'semua' || (st.k === 'aktif' ? ['berjalan', 'segera', 'belum'].includes(p.keadaan) : p.keadaan === st.k)) && (!st.q || [p.nama, pihakNama(p), p.pabrik, p.kontak_nama, p.syarat, ...p.produk.map(x => x.nama)].join(' ').toLowerCase().includes(st.q)));
  const tanda = p => [p.perlu_cek ? '<span class="chip oranye">cek masih berlaku?</span>' : '', aktif(p) && !p.jml_berkas ? '<span class="chip oranye">belum ada MOU</span>' : '', p.insentif.some(i => i.lewat) ? '<span class="chip merah">insentif lewat tempo</span>' : ''].join(' ');
  const kolom = [{ l: 'Program', n: p => p.nama, h: p => `<a href="#/pembelian/program/${p.id}"><b>${esc(p.nama)}</b></a><br><small>${esc(pihakNama(p))} · ${esc(nama(JENIS, p.jenis))}</small>` }, { l: 'Periode', n: p => p.mulai + ' s.d. ' + (p.selesai || '-'), h: p => `<span>${tanggal(p.mulai)} s.d. ${p.selesai ? tanggal(p.selesai) : '-'}<br><small>${sisaHari(p)}</small></span>` },
    { l: 'Status', n: p => KEADAAN[p.keadaan][0], h: p => `<span><span class="chip ${KEADAAN[p.keadaan][1]}">${KEADAAN[p.keadaan][0]}</span> ${tanda(p)}</span>` }, { l: 'Pencapaian', n: p => p.target_jenis === 'tidak' ? '' : `${p.capai} / ${p.target}`, h: p => p.target_jenis === 'tidak' ? '-' : `<span>${bar(p)}<br><small>${nilaiT(p, p.capai)} dari ${nilaiT(p, p.target)}</small></span>` },
    { l: 'Insentif', n: p => `${p.insentif.filter(i => i.status === 'diterima').length}/${p.insentif.length}`, h: p => p.insentif.length ? `<span>${p.insentif.filter(i => i.status === 'diterima').length} dari ${p.insentif.length} diterima</span>` : '-' }];

  // ---------- Formulir program ----------
  const form = async p => {
    const [sup, sales] = await Promise.all([ambilRef('supplier'), ambilRef('sales', 'id,nama,telp').catch(() => [])]); let produk = p ? [...p.produk] : [];
    modal({ judul: p ? 'Ubah Program' : 'Program Baru', ukuran: 'besar', isi: `<form class="form-grid" onsubmit="return false"><label class="isian lebar"><span>Nama program <i>*</i></span><input name="nama" required maxlength="150" value="${esc(p?.nama || '')}" placeholder="mis. Target Q1 Pabrik A"></label>
      <label class="isian"><span>Dari</span><select name="pihak">${opsi(PIHAK, p?.pihak || 'pbf')}</select></label><label class="isian"><span>Jenis</span><select name="jenis">${opsi(JENIS, p?.jenis || 'target')}</select></label>
      <label class="isian"><span>PBF / supplier</span><select name="supplier_id"><option value="">- semua / tidak ada -</option>${sup.map(x => `<option value="${x.id}" ${x.id === p?.supplier_id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select></label>
      <label class="isian"><span>Pabrik</span><input name="pabrik" value="${esc(p?.pabrik || '')}"><small>Bila diisi, yang dihitung hanya produk dengan pabrik yang sama persis.</small></label>
      <label class="isian"><span>Nama sales</span><input name="kontak_nama" list="dl-sales" value="${esc(p?.kontak_nama || '')}"><datalist id="dl-sales">${sales.map(x => `<option value="${esc(x.nama)}">`).join('')}</datalist></label><label class="isian"><span>No. HP sales</span><input name="kontak_telp" inputmode="tel" value="${esc(p?.kontak_telp || '')}"></label>
      <label class="isian"><span>Mulai <i>*</i></span><input type="date" name="mulai" required value="${p?.mulai || hariIni()}"></label><label class="isian"><span>Berakhir</span><input type="date" name="selesai" value="${p?.selesai || ''}"><small>Kosong = tanpa tanggal akhir, diingatkan tiap 90 hari.</small></label>
      <label class="isian lebar"><span>Syarat program</span><textarea name="syarat" rows="3">${esc(p?.syarat || '')}</textarea><small>Jangan menulis nominal insentif di sini; isi di bagian Insentif.</small></label>
      <label class="isian"><span>Target</span><select name="target_jenis">${opsi([['tidak', 'Tanpa target'], ['rupiah', 'Rupiah pembelian'], ['qty', 'Jumlah (satuan dasar)']], p?.target_jenis || 'tidak')}</select></label><label class="isian" data-t><span>Besar target</span><input type="number" name="target" min="0" step="any" value="${p && Number(p.target) ? Number(p.target) : ''}"></label>
      <label class="isian" data-t><span>Pencapaian awal</span><input type="number" name="awal" min="0" step="any" value="${p ? Number(p.awal) || '' : ''}"><small>Pembelian sebelum memakai aplikasi ini.</small></label>
      <label class="isian lebar"><span>Produk yang ikut</span><input class="input" data-cari-produk placeholder="Cari produk (kosong = semua produk dari supplier/pabrik)"><span data-produk style="display:block;margin-top:6px"></span></label>
      <label class="isian"><span>Penanggung jawab</span><input name="penanggung" value="${esc(p?.penanggung || '')}"></label><label class="isian"><span>Catatan</span><input name="catatan" value="${esc(p?.catatan || '')}"></label></form>`,
      saatBuka: m => {
        const f = m.querySelector('form'), w = m.querySelector('[data-produk]'), g = () => { w.innerHTML = produk.map((x, i) => `<span class="chip" style="margin:2px">${esc(x.nama)} <a href="#" data-lepas="${i}" style="color:var(--merah)">✕</a></span>`).join(''); };
        const t = () => f.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('sembunyi', f.target_jenis.value === 'tidak'));
        f.target_jenis.onchange = t; t(); g();
        w.onclick = e => { const a = e.target.closest('[data-lepas]'); if (a) { e.preventDefault(); produk.splice(a.dataset.lepas, 1); g(); } };
        f.kontak_nama.onchange = () => { const s = sales.find(x => x.nama === f.kontak_nama.value); if (s?.telp && !f.kontak_telp.value) f.kontak_telp.value = s.telp; };
        pasangCariProduk(m.querySelector('[data-cari-produk]'), x => { if (!produk.some(y => y.id === x.id)) produk.push({ id: x.id, nama: x.nama }); g(); });
      },
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form'); if (!f.reportValidity()) return false; const o = Object.fromEntries(new FormData(f)); delete o.undefined;
        const v = await rpc('simpan_program', { p: { ...o, id: p?.id ?? null, supplier_id: o.supplier_id || null, selesai: o.selesai || null, target: o.target || 0, awal: o.awal || 0, produk: produk.map(x => x.id) } });
        toast('Program disimpan', 'sukses'); await ambil(); if (p) gambar(); else location.hash = '#/pembelian/program/' + v;
      } }] });
  };
  const perpanjang = p => modal({ judul: 'Perpanjang ' + p.nama, ukuran: 'kecil', isi: `<p style="margin-top:0">Program disalin ke periode baru. Periode lama tetap tersimpan sebagai riwayat. MOU baru diunggah di program yang baru.</p><form onsubmit="return false"><label class="isian"><span>Mulai</span><input type="date" name="a" required value="${p.selesai ? geserHari(p.selesai, 1) : hariIni()}"></label><label class="isian"><span>Berakhir</span><input type="date" name="b"></label>${p.target_jenis === 'tidak' ? '' : `<label class="isian"><span>Target</span><input type="number" name="t" min="1" step="any" value="${Number(p.target)}"></label>`}</form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Buat periode baru', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; const v = await rpc('perpanjang_program', { p_id: p.id, p_mulai: f.a.value, p_selesai: f.b.value || null, p_target: f.t ? Number(f.t.value) : null }); toast('Periode baru dibuat', 'sukses'); location.hash = '#/pembelian/program/' + v; } }] });
  const henti = p => modal({ judul: 'Hentikan program', ukuran: 'kecil', isi: '<form onsubmit="return false"><label class="isian"><span>Alasan <i>*</i></span><textarea name="a" rows="2" required></textarea></label></form>', tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Hentikan', kelas: 'bahaya', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('atur_program', { p_id: p.id, p_aksi: 'henti', p_alasan: f.a.value }); toast('Program dihentikan'); await ambil(); gambar(); } }] });

  // ---------- Insentif ----------
  const formInsentif = (p, i) => modal({ judul: i ? 'Ubah Insentif' : 'Tambah Insentif', isi: `<form class="form-grid" onsubmit="return false"><label class="isian lebar"><span>Uraian <i>*</i></span><input name="uraian" required maxlength="300" value="${esc(i?.uraian || '')}" placeholder="mis. Cashback 3% bila target tercapai"></label><label class="isian"><span>Bentuk</span><select name="bentuk">${opsi(BENTUK, i?.bentuk || 'uang')}</select></label><label class="isian"><span>Perkiraan nilai (Rp)</span><input type="number" name="nilai" min="0" step="any" value="${i ? Number(i.nilai) : ''}"></label><label class="isian"><span>Dijanjikan paling lambat</span><input type="date" name="jatuh_tempo" value="${i?.jatuh_tempo || ''}"></label><label class="isian"><span>Catatan</span><input name="catatan" value="${esc(i?.catatan || '')}"></label></form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; await rpc('simpan_insentif', { p: { ...Object.fromEntries(new FormData(f)), nilai: f.nilai.value || 0, id: i?.id ?? null, program_id: p.id } }); toast('Insentif disimpan', 'sukses'); await ambil(); gambar(); } }] });
  const formTerima = i => modal({ judul: 'Terima Insentif', isi: `<p style="margin-top:0"><b>${esc(i.uraian)}</b><br>Perkiraan ${rupiah(i.nilai)}</p><form class="form-grid" onsubmit="return false"><label class="isian"><span>Tanggal terima</span><input type="date" name="t" required max="${hariIni()}" value="${hariIni()}"></label><label class="isian"><span>Nilai diterima (Rp)</span><input type="number" name="n" min="0" step="any" required value="${Number(i.nilai)}"></label><label class="cek lebar sembunyi" data-s><input type="checkbox" name="s" checked> Sisanya masih akan diterima</label><label class="isian lebar"><span>Catatan</span><input name="c"></label><label class="isian lebar"><span>Bukti terima (foto/PDF)</span><input type="file" name="b" multiple accept="image/*,application/pdf"></label></form><p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Uang tidak otomatis masuk Buku Kas. Catat terpisah di Keuangan → Buku Kas bila perlu.</p>`,
    saatBuka: m => { const f = m.querySelector('form'); f.n.oninput = () => m.querySelector('[data-s]').classList.toggle('sembunyi', !(Number(f.n.value) < Number(i.nilai))); },
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false; const b = await unggah(f.b.files, 'terima'); await rpc('terima_insentif', { p_id: i.id, p_tanggal: f.t.value, p_nilai: Number(f.n.value), p_catatan: f.c.value || null, p_berkas: b, p_sisa: f.s.checked && Number(f.n.value) < Number(i.nilai) }); toast('Insentif tercatat diterima', 'sukses'); await ambil(); gambar(); } }] });

  const rinci = p => {
    const ii = p.insentif, baris = (l, v) => v ? `<div class="baris-total"><span>${l}</span><span style="text-align:right">${v}</span></div>` : '';
    el.innerHTML = judulHalaman(p.nama, 'Pembelian / Program & MOU', `<a class="tombol kedua" href="#/pembelian/program">${ikon('kiri')} Daftar</a>${d.ubah ? `<button class="tombol kedua" data-aksi="ubah">Ubah</button>${p.selesai ? '<button class="tombol kedua" data-aksi="perpanjang">Perpanjang</button>' : ''}${p.status === 'aktif' ? '<button class="tombol bahaya" data-aksi="henti">Hentikan</button>' : '<button class="tombol kedua" data-aksi="aktif">Aktifkan lagi</button>'}` : ''}`)
      + `<div class="kartu"><p style="margin-top:0"><span class="chip ${KEADAAN[p.keadaan][1]}">${KEADAAN[p.keadaan][0]}</span> ${tanda(p)}</p>${p.alasan_henti ? `<p class="pesan galat">Dihentikan: ${esc(p.alasan_henti)}</p>` : ''}${p.perlu_cek && d.ubah ? '<p class="pesan peringatan">Program ini tanpa tanggal akhir. Tanyakan ke sales apakah masih berlaku. <button class="tombol kecil" data-aksi="cek">Masih berlaku</button></p>' : ''}
        ${baris('Pihak', esc(nama(PIHAK, p.pihak)) + ' · ' + esc(pihakNama(p)))}${baris('Pabrik', p.supplier && p.pabrik ? esc(p.pabrik) : '')}${baris('Sales', p.kontak_nama ? esc(p.kontak_nama) + (p.kontak_telp ? ` · <a href="tel:${esc(p.kontak_telp.replace(/[^\d+]/g, ''))}">${esc(p.kontak_telp)}</a>` : '') : '')}${baris('Jenis', esc(nama(JENIS, p.jenis)))}${baris('Periode', `${tanggal(p.mulai)} s.d. ${p.selesai ? tanggal(p.selesai) : '-'} (${sisaHari(p)})`)}${baris('Penanggung jawab', esc(p.penanggung || ''))}${baris('Produk', p.produk.length ? p.produk.map(x => esc(x.nama)).join(', ') : '')}${baris('Catatan', esc(p.catatan || ''))}
        ${p.syarat ? `<h3>Syarat</h3><p style="white-space:pre-wrap;margin:0">${esc(p.syarat)}</p>` : ''}</div>
      ${p.target_jenis === 'tidak' ? '' : `<div class="kartu"><h3 style="margin-top:0">Pencapaian</h3><p style="margin:0">${bar(p)}</p><div class="grid-4" style="margin-top:12px"><div class="statistik"><small>Tercapai</small><b>${nilaiT(p, p.capai)}</b></div><div class="statistik"><small>Target</small><b>${nilaiT(p, p.target)}</b></div><div class="statistik"><small>Kurang</small><b>${nilaiT(p, Math.max(0, p.target - p.capai))}</b></div><div class="statistik"><small>Sisa waktu</small><b>${p.selesai && aktif(p) ? p.sisa_hari + ' hari' : '-'}</b></div></div><p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Dari faktur yang sudah diterima dikurangi retur${p.target_jenis === 'rupiah' ? ', setelah diskon barang, sebelum PPN dan diskon faktur' : ', tanpa barang bonus'}${Number(p.awal) ? `; termasuk pencapaian awal ${nilaiT(p, p.awal)}` : ''}. Cocokkan dengan hitungan sales.</p></div>`}
      <div class="kartu"><h3 style="margin-top:0">Bukti MOU</h3>${d.ubah || d.nominal ? `<div data-berkas>${daftarBerkas(p.berkas, d.ubah)}</div>${d.ubah ? '<label class="tombol kedua" style="margin-top:10px;display:inline-flex;cursor:pointer">+ Unggah foto/PDF<input type="file" multiple accept="image/*,application/pdf" data-unggah hidden></label>' : ''}` : `<p style="margin:0">${p.jml_berkas ? p.jml_berkas + ' berkas tersimpan (hanya bisa dibuka Pemilik/petugas program).' : 'Belum ada.'}</p>`}</div>
      <div class="kartu"><div class="kepala-blok"><h3 style="margin:0">Insentif / benefit</h3>${d.nominal ? '<button class="tombol kecil" data-aksi="insentif">+ Tambah</button>' : ''}</div>${tabelHtml([...(d.nominal ? [{ l: 'Uraian', n: i => i.uraian, h: i => `<span><b>${esc(i.uraian)}</b>${i.catatan ? `<br><small>${esc(i.catatan)}</small>` : ''}${i.berkas?.length ? '<br>' + daftarBerkas(i.berkas) : ''}</span>` }] : []), { l: 'Bentuk', n: i => nama(BENTUK, i.bentuk) }, { l: 'Dijanjikan', n: i => i.jatuh_tempo, t: 'tgl' }, { l: 'Status', n: i => i.status, h: i => `<span class="chip ${i.status === 'diterima' ? 'hijau' : i.lewat ? 'merah' : 'oranye'}">${i.status === 'diterima' ? 'Diterima ' + tanggal(i.diterima) : i.lewat ? 'Lewat tempo' : 'Belum diterima'}</span>` },
        ...(d.nominal ? [{ l: 'Perkiraan', n: i => i.nilai, t: 'uang', jml: true }, { l: 'Diterima', n: i => i.diterima_nilai, t: 'uang', jml: true }, { l: '', n: () => '', h: i => i.status === 'belum' ? `<span><button class="tombol kecil" data-terima="${i.id}">Terima</button> <button class="ikon-aksi" data-ubah-i="${i.id}" title="Ubah">${ikon('ubah')}</button><button class="ikon-aksi hapus" data-batal-i="${i.id}" title="Hapus">${ikon('hapus')}</button></span>` : `<button class="tombol kedua kecil" data-urung="${i.id}">Batalkan terima</button>` }] : [])], ii, { kosong: 'Belum ada insentif dicatat.' })}</div>`;
  };
  const gambar = async () => {
    if (id) { const p = cari(id); if (!p) { el.innerHTML = '<div class="kartu segera"><h3>Program tidak ditemukan</h3><a class="tombol" href="#/pembelian/program">Kembali</a></div>'; return; } return rinci(p); }
    const jml = k => d.program.filter(k).length, stat = (l, v, w) => `<div class="statistik ${v && w ? w : ''}"><small>${l}</small><b>${v}</b></div>`, belum = d.program.flatMap(p => p.insentif).filter(i => i.status === 'belum');
    el.innerHTML = judulHalaman('Program & MOU', 'Pembelian / Program & MOU', (tab === 'lap' ? '<button class="tombol kedua" data-aksi="unduh">Unduh</button>' : '') + (d.ubah ? `<button class="tombol" data-aksi="baru">${ikon('tambah')} Program Baru</button>` : ''))
      + `<div class="kartu" style="margin-bottom:16px"><div class="grid-4">${stat('Sedang berjalan', jml(aktif))}${stat('Segera berakhir (30 hari)', jml(p => p.keadaan === 'segera'), 'oranye')}${stat('Target belum tercapai', jml(p => aktif(p) && p.target_jenis !== 'tidak' && Number(p.capai) < Number(p.target)), 'oranye')}${d.nominal ? `<div class="statistik"><small>Insentif belum diterima (${belum.length})</small><b>${rupiah(belum.reduce((a, i) => a + Number(i.nilai), 0))}</b></div>` : stat('Insentif belum diterima', belum.length)}</div></div>
      <div class="kartu"><div class="alat-tabel">${d.nominal ? `<select class="input" style="width:auto" data-tab>${opsi([['program', 'Daftar program'], ['lap', 'Laporan insentif']], tab)}</select>` : ''}${tab === 'program' ? `<select class="input" style="width:auto" data-k>${opsi([['aktif', 'Masih aktif'], ['berjalan', 'Berjalan'], ['segera', 'Segera berakhir'], ['belum', 'Belum mulai'], ['berakhir', 'Berakhir'], ['dihentikan', 'Dihentikan'], ['semua', 'Semua']], st.k)}</select><div class="cari">${ikon('cari')}<input class="input" data-q placeholder="Cari program, PBF, pabrik, produk..." value="${esc(st.q)}"></div>` : ''}</div><div data-isi></div></div>`;
    if (tab === 'program') isi(); else laporan();
  };
  const isi = () => { el.querySelector('[data-isi]').innerHTML = tabelHtml(kolom, saring(), { kosong: 'Tidak ada program.' }); };
  let lap = [], kolLap = [];
  const laporan = async () => {
    const bp = await barPeriode('tahun'), w = el.querySelector('[data-isi]'); w.innerHTML = bp.html + '<div data-lap></div>'; w.querySelector('[data-outlet]')?.remove();
    kolLap = [{ l: 'Tanggal', n: r => r.tanggal, t: 'tgl' }, { l: 'Pihak', n: r => r.pihak }, { l: 'Program', n: r => r.program }, { l: 'Uraian', n: r => r.uraian }, { l: 'Bentuk', n: r => nama(BENTUK, r.bentuk) }, { l: 'Status', n: r => r.status === 'diterima' ? 'Diterima' : r.lewat ? 'Lewat tempo' : 'Belum' }, { l: 'Perkiraan', n: r => r.nilai, t: 'uang', jml: true }, { l: 'Diterima', n: r => r.diterima_nilai, t: 'uang', jml: true }];
    const muat = async () => { const x = bp.nilai(), t = w.querySelector('[data-lap]'); try { lap = await rpc('lap_insentif', { p_dari: x.p_dari, p_sampai: x.p_sampai }); const g = {}; for (const r of lap) { const k = r.pihak || '-', b = r.status === 'diterima' ? r.diterima.slice(0, 7) : 'belum diterima'; ((g[k] ||= {})[b] ||= 0); g[k][b] += Number(r.status === 'diterima' ? r.diterima_nilai : r.nilai); }
      const rk = Object.entries(g).flatMap(([p, o]) => Object.entries(o).map(([b, n]) => ({ p, b, n }))).sort((a, b) => a.p.localeCompare(b.p) || a.b.localeCompare(b.b));
      t.innerHTML = `<p style="color:var(--teks-2)">Yang diterima mengikuti periode; yang belum diterima selalu ditampilkan.</p><h3>Per pihak dan bulan</h3>${tabelHtml([{ l: 'Pihak', n: r => r.p }, { l: 'Bulan', n: r => r.b }, { l: 'Nilai', n: r => r.n, t: 'uang' }], rk)}<h3>Rincian</h3>${tabelHtml(kolLap, lap)}`; } catch (e) { t.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; } };
    bp.pasang(w, muat); muat();
  };
  const jalankan = async (fn, pesan) => { try { await fn(); if (pesan) toast(pesan, 'sukses'); await ambil(); gambar(); } catch (e) { toast(pesanGalat(e), 'galat'); } };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), p = id && d ? cari(id) : null, a = q('[data-aksi]')?.dataset.aksi, i = k => p.insentif.find(x => x.id === Number(k));
    if (q('[data-buka]')) { e.preventDefault(); return bukaBerkas(q('[data-buka]').dataset.buka); }
    if (a === 'baru') return form().catch(x => toast(pesanGalat(x), 'galat')); if (a === 'unduh') return unduhTabel('insentif-program', kolLap, lap); if (!p) return;
    if (a === 'ubah') form(p).catch(x => toast(pesanGalat(x), 'galat')); if (a === 'perpanjang') perpanjang(p); if (a === 'henti') henti(p); if (a === 'insentif') formInsentif(p);
    if (a === 'aktif' || a === 'cek') jalankan(() => rpc('atur_program', { p_id: p.id, p_aksi: a }), 'Tersimpan');
    if (q('[data-buang]')) { e.preventDefault(); const n = Number(q('[data-buang]').dataset.buang), b = p.berkas[n]; if (await konfirmasi('Hapus berkas', `Hapus <b>${esc(b.nama)}</b>? Tidak bisa dikembalikan.`, 'Hapus')) jalankan(async () => { await rpc('berkas_program', { p_id: p.id, p_berkas: p.berkas.filter((_, x) => x !== n) }); await sb.storage.from('mou').remove([b.path]); }, 'Berkas dihapus'); }
    if (q('[data-terima]')) formTerima(i(q('[data-terima]').dataset.terima)); if (q('[data-ubah-i]')) formInsentif(p, i(q('[data-ubah-i]').dataset.ubahI));
    if (q('[data-batal-i]') && await konfirmasi('Hapus insentif', 'Hapus insentif ini dari program?', 'Hapus')) jalankan(() => rpc('batal_insentif', { p_id: Number(q('[data-batal-i]').dataset.batalI), p_aksi: 'batal' }), 'Dihapus');
    if (q('[data-urung]') && await konfirmasi('Batalkan terima', 'Insentif kembali berstatus belum diterima. Lanjutkan?', 'Ya', '')) jalankan(() => rpc('batal_insentif', { p_id: Number(q('[data-urung]').dataset.urung), p_aksi: 'belum_terima' }), 'Dibatalkan');
  });
  el.addEventListener('change', e => {
    if (e.target.matches('[data-tab]')) { tab = e.target.value; gambar(); } if (e.target.matches('[data-k]')) { st.k = e.target.value; isi(); }
    if (e.target.matches('[data-unggah]')) { const p = cari(id), fs = [...e.target.files]; e.target.disabled = true; toast('Mengunggah…'); jalankan(async () => { const b = await unggah(fs, 'mou'); await rpc('berkas_program', { p_id: p.id, p_berkas: [...p.berkas, ...b] }); }, 'Berkas tersimpan'); }
  });
  el.addEventListener('input', e => { if (e.target.matches('[data-q]')) { st.q = e.target.value.trim().toLowerCase(); isi(); } });
  try { await ambil(); } catch (e) { return galat(el, e); }
  await gambar();
  return 'Program & MOU';
});

// Info di Faktur & SP: program yang berjalan untuk supplier terpilih
export async function infoProgram(h) {
  if (!h.supplier_id) return '';
  const r = await rpc('program_supplier', { p_supplier: h.supplier_id });
  return r.length ? `<div class="pesan info"><b>${r.length} program berjalan dari supplier ini</b><ul style="margin:6px 0 0;padding-left:18px">${r.map(p => `<li><a href="#/pembelian/program/${p.id}" target="_blank" rel="noopener">${esc(p.nama)}</a> · ${esc(nama(JENIS, p.jenis))}${p.selesai ? ' · s.d. ' + tanggal(p.selesai) : ''}${p.target_jenis !== 'tidak' ? ` · ${Number(p.capai) >= Number(p.target) ? 'target tercapai' : 'kurang ' + nilaiT(p, p.target - p.capai)}` : ''}${p.produk ? `<br><small>Produk: ${esc(p.produk)}</small>` : ''}</li>`).join('')}</ul></div>` : '';
}
