// Pengaturan: Profil Bisnis (outlet aktif) & Konfigurasi.
import { rute, sb, S, bisa, atauOffline, KONEKSI, HOOK } from '../inti.js?v=1.13.0';
import { esc, toast, pesanGalat, bacaForm, judulHalaman } from '../ui.js?v=1.13.0';
import { bacaPrinter, simpanPrinter, statusAgen, cetakStrukHtml, cetakLabelHtml } from '../cetak.js?v=1.13.0';

rute('pengaturan/profil', async el => {
  const boleh = bisa('pengaturan.profil');
  const { data: o, error } = await sb.from('outlet').select('*').eq('id', S.pengguna.outlet_id).single();
  if (error) { el.innerHTML = `<div class="pesan galat">${esc(pesanGalat(error))}</div>`; return; }
  const isian = (f, label, tipe = 'text', bantu = '') => `<label class="isian ${tipe === 'area' ? 'lebar' : ''}"><span>${label}</span>${tipe === 'area'
    ? `<textarea name="${f}" rows="2">${esc(o[f] || '')}</textarea>` : `<input name="${f}" type="${tipe}" value="${esc(o[f] || '')}">`}${bantu ? `<small>${bantu}</small>` : ''}</label>`;
  el.innerHTML = judulHalaman('Profil Bisnis', 'Pengaturan / Profil Bisnis') + `<div class="kartu" style="max-width:820px">
    <p class="pesan info">Data ini tampil di struk, faktur, dan laporan untuk outlet <b>${esc(o.nama)}</b>. Outlet lain diatur dari menu Multi Outlet.</p>
    <form class="form-grid" onsubmit="return false">
      ${isian('nama', 'Nama Apotek')}${isian('kode', 'Kode Outlet')}
      ${isian('alamat', 'Alamat', 'area')}
      ${isian('telp', 'Telepon / WhatsApp', 'tel')}${isian('email', 'Email', 'email')}
      ${isian('apoteker', 'Apoteker Penanggung Jawab')}${isian('sipa', 'No. SIPA')}
      ${isian('no_sia', 'No. SIA')}${isian('npwp', 'NPWP')}
      ${isian('catatan_struk', 'Catatan di bawah struk', 'area', 'Mis. "Terima kasih, semoga lekas sembuh".')}
    </form>
    ${boleh ? '<button class="tombol" data-simpan>Simpan</button>' : '<p class="pesan peringatan">Anda hanya bisa melihat.</p>'}</div>`;
  if (!boleh) el.querySelectorAll('input,textarea').forEach(i => i.disabled = true);
  el.querySelector('[data-simpan]')?.addEventListener('click', async e => {
    e.target.disabled = true;
    const { error } = await sb.from('outlet').update(bacaForm(el.querySelector('form'))).eq('id', o.id);
    e.target.disabled = false;
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Profil disimpan', 'sukses');
  });
});

// ---------- Printer & Cetak (per perangkat) ----------
rute('pengaturan/printer', async el => {
  const p = bacaPrinter();
  el.innerHTML = judulHalaman('Printer & Cetak', 'Pengaturan / Printer & Cetak') + `<div style="max-width:820px">
    <div class="kartu"><h3>Agen Cetak di perangkat ini</h3><div data-agen>Memeriksa...</div></div>
    <form onsubmit="return false">
    <div class="kartu"><h3>Cara mencetak</h3>
      <label class="isian"><span>Mode</span><select name="mode"><option value="otomatis" ${p.mode !== 'dialog' ? 'selected' : ''}>Otomatis: langsung ke printer lewat Agen Cetak (bila menyala)</option><option value="dialog" ${p.mode === 'dialog' ? 'selected' : ''}>Selalu pakai dialog cetak browser</option></select></label></div>
    <div class="kartu"><h3>Struk, rekap sesi & copy resep (thermal)</h3><div class="form-grid">
      <label class="isian"><span>Printer</span><select name="struk_printer" data-daftar></select></label>
      <label class="isian"><span>Lebar kertas</span><select name="struk_lebar"><option value="">Ikuti Konfigurasi</option><option value="58" ${p.struk.lebar === '58' ? 'selected' : ''}>58 mm</option><option value="80" ${p.struk.lebar === '80' ? 'selected' : ''}>80 mm</option></select></label></div>
      <button type="button" class="tombol kedua kecil" data-tes="struk">Tes cetak struk</button></div>
    <div class="kartu"><h3>Etiket & label (printer label)</h3><div class="form-grid">
      <label class="isian"><span>Printer</span><select name="label_printer" data-daftar></select></label>
      <label class="isian"><span>Salinan per etiket</span><input type="number" min="1" max="5" name="salinan" value="${p.salinanEtiket}"></label>
      <label class="isian"><span>Lebar stiker (mm)</span><input type="number" min="20" max="110" name="label_lebar" value="${p.label.lebar}"></label>
      <label class="isian"><span>Tinggi stiker (mm)</span><input type="number" min="15" max="150" name="label_tinggi" value="${p.label.tinggi}"></label></div>
      <p style="color:var(--teks-2);font-size:13px;margin-top:0">Atur ukuran yang sama di driver printer label (Printing Preferences → ukuran kertas) agar tidak bergeser.</p>
      <button type="button" class="tombol kedua kecil" data-tes="label">Tes cetak etiket</button></div>
    <button class="tombol" data-simpan>Simpan untuk perangkat ini</button></form></div>`;
  const s = await statusAgen();
  el.querySelector('[data-agen]').innerHTML = s
    ? `<p class="pesan info" style="margin:0">✅ Agen Cetak <b>terhubung</b> (versi ${esc(s.versi)}, komputer ${esc(s.komputer)}). ${s.printer.length} printer terdeteksi.</p>`
    : `<p class="pesan peringatan" style="margin:0">Agen Cetak <b>tidak terdeteksi</b> di perangkat ini, jadi dicetak lewat dialog browser. Untuk cetak langsung tanpa dialog, pasang Agen Cetak di PC kasir (file <code>pasang-agen-cetak.ps1</code>). Di HP selalu memakai dialog cetak.</p>`;
  const daftar = s?.printer || [];
  el.querySelectorAll('[data-daftar]').forEach(sel => {
    const v = sel.name === 'struk_printer' ? p.struk.printer : p.label.printer;
    const opsi = [...new Set([...daftar, ...(v ? [v] : [])])];
    sel.innerHTML = `<option value="">- pilih / dialog cetak -</option>` + opsi.map(n => `<option ${n === v ? 'selected' : ''}>${esc(n)}</option>`).join('');
  });
  const baca = () => { const f = el.querySelector('form'); return { mode: f.mode.value, struk: { printer: f.struk_printer.value, lebar: f.struk_lebar.value },
    label: { ...p.label, printer: f.label_printer.value, lebar: Number(f.label_lebar.value || 50), tinggi: Number(f.label_tinggi.value || 30) }, salinanEtiket: Number(f.salinan.value || 1) }; };
  el.querySelector('[data-simpan]').onclick = () => { simpanPrinter(baca()); toast('Pengaturan printer disimpan untuk perangkat ini', 'sukses'); };
  el.querySelectorAll('[data-tes]').forEach(b => b.onclick = async () => {
    simpanPrinter(baca());
    const k = await ambilKonfig();
    if (b.dataset.tes === 'struk') await cetakStrukHtml(`<div class="c"><b>${esc(S.outlet?.nama || 'Apotek Salam')}</b><br>TES CETAK STRUK</div><hr><div class="r"><span>Tanggal</span><span>${new Date().toLocaleString('id-ID')}</span></div><div class="r"><span>Printer</span><span>${esc(baca().struk.printer || 'dialog')}</span></div><hr><div class="c">Jika tulisan ini rapi, printer siap.</div>`, 'Tes struk', k.struk.lebar);
    else await cetakLabelHtml([`<div class="kop"><span>${esc(S.outlet?.nama || 'Apotek Salam')}</span><span>No. 001</span></div><div class="nm">TES ETIKET</div><div class="signa">3 x sehari 1 tablet</div><div class="kecil">Sesudah makan · ${new Date().toLocaleDateString('id-ID')}</div><div class="jenis">OBAT DALAM</div>`], 'Tes etiket');
    toast('Perintah cetak dikirim');
  });
});

// Konfigurasi disimpan di tabel konfigurasi (kunci -> jsonb)
export const KONFIG_BAWAAN = {
  struk: { lebar: '58', cetak_otomatis: false, tampil_logo: true, tampil_apoteker: true },
  penjualan: { stok_minus: false, pembulatan: 0, wajib_resep_obat_keras: true, diskon_maks_persen: 20 },
  persediaan: { peringatan_ed_hari: 90, metode_keluar: 'FEFO', batas_margin_persen: 5, margin_saran_persen: 20 },
  pelayanan: { tarif_racik: 5000, persen_resep: 0, cetak_etiket: true },
  retur: { maks_hari: 7, maks_nilai: 200000 },
  pembelian: { ppn_mode: 'tambah', pajak_id: null },
};
export const MODE_PPN = [['tambah', 'Belum termasuk PPN (PPN ditambahkan)'], ['termasuk', 'Sudah termasuk PPN'], ['tanpa', 'Tidak kena PPN']];
let konfigAkhir = null, konfigWaktu = 0;
export const lupakanKonfig = () => { konfigAkhir = null; };
export async function ambilKonfig() {
  // gambar QRIS (besar) tidak ikut; halaman kasir mengambilnya sendiri saat perlu
  if (!konfigAkhir || Date.now() - konfigWaktu > 30000) {
    konfigWaktu = Date.now();
    konfigAkhir = sb.from('konfigurasi').select('*').neq('kunci', 'qris').then(r => { if (r.error) throw r.error; return r.data; });
    konfigAkhir.catch(() => { konfigAkhir = null; });
  }
  const data = await atauOffline(async () => { const j = konfigAkhir; if (KONEKSI.putus) throw new TypeError('Failed to fetch'); return j; }, () => HOOK.offline.konfigL());
  const k = structuredClone(KONFIG_BAWAAN);
  for (const r of data || []) k[r.kunci] = { ...(k[r.kunci] || {}), ...r.nilai };
  return k;
}

rute('pengaturan/konfigurasi', async el => {
  const boleh = bisa('pengaturan.konfigurasi');
  const k = await ambilKonfig();
  const { data: pajak } = await sb.from('pajak').select('id,nama,persen').order('persen');
  if (!k.pembelian.pajak_id) k.pembelian.pajak_id = (pajak || []).find(p => Number(p.persen) === 11)?.id ?? null;
  const cek =(g, f, label) => `<label class="cek"><input type="checkbox" name="${g}.${f}" ${k[g][f] ? 'checked' : ''}> ${label}</label>`;
  el.innerHTML = judulHalaman('Konfigurasi', 'Pengaturan / Konfigurasi') + `<form onsubmit="return false" style="max-width:820px">
    <div class="kartu"><h3>Struk</h3>
      <label class="isian"><span>Lebar kertas</span><select name="struk.lebar"><option value="58" ${k.struk.lebar === '58' ? 'selected' : ''}>58 mm</option><option value="80" ${k.struk.lebar === '80' ? 'selected' : ''}>80 mm</option></select></label>
      ${cek('struk', 'cetak_otomatis', 'Cetak struk otomatis setiap transaksi')}
      ${cek('struk', 'tampil_logo', 'Tampilkan logo di struk')}
      ${cek('struk', 'tampil_apoteker', 'Tampilkan nama apoteker & SIPA di struk')}</div>
    <div class="kartu"><h3>Penjualan</h3>
      ${cek('penjualan', 'wajib_resep_obat_keras', 'Obat keras wajib dicatat resepnya saat dijual')}
      ${cek('penjualan', 'stok_minus', 'Izinkan menjual walau stok di sistem habis')}
      <div class="form-grid">
        <label class="isian"><span>Pembulatan total (Rp)</span><select name="penjualan.pembulatan">${[0, 100, 500, 1000].map(v => `<option value="${v}" ${Number(k.penjualan.pembulatan) === v ? 'selected' : ''}>${v ? 'Ke atas, kelipatan ' + v : 'Tanpa pembulatan'}</option>`).join('')}</select></label>
        <label class="isian"><span>Diskon maksimal kasir (%)</span><input type="number" min="0" max="100" name="penjualan.diskon_maks_persen" value="${k.penjualan.diskon_maks_persen}"></label>
      </div></div>
    <div class="kartu"><h3>Retur oleh kasir</h3><p style="margin-top:0;color:var(--teks-2)">Di luar batas ini, dan untuk obat keras/OKT/psikotropika/narkotika, kasir perlu persetujuan Pemilik/Apoteker.</p><div class="form-grid">
      <label class="isian"><span>Umur nota paling lama (hari)</span><input type="number" min="0" name="retur.maks_hari" value="${k.retur.maks_hari}"></label>
      <label class="isian"><span>Nilai retur paling besar per nota (Rp)</span><input type="number" min="0" name="retur.maks_nilai" value="${k.retur.maks_nilai}"></label></div></div>
    <div class="kartu"><h3>Persediaan</h3><div class="form-grid">
      <label class="isian"><span>Peringatan kedaluwarsa (hari sebelum ED)</span><input type="number" min="1" name="persediaan.peringatan_ed_hari" value="${k.persediaan.peringatan_ed_hari}"></label>
      <label class="isian"><span>Urutan stok keluar</span><select name="persediaan.metode_keluar"><option value="FEFO" ${k.persediaan.metode_keluar === 'FEFO' ? 'selected' : ''}>FEFO (ED terdekat dulu)</option><option value="FIFO" ${k.persediaan.metode_keluar === 'FIFO' ? 'selected' : ''}>FIFO (masuk duluan dulu)</option></select></label>
      <label class="isian"><span>Peringatan berpotensi rugi bila margin di bawah (%)</span><input type="number" step="any" min="0" name="persediaan.batas_margin_persen" value="${k.persediaan.batas_margin_persen}">
        <small>Margin = (harga jual − harga beli) ÷ harga beli. Harga beli sudah termasuk PPN.</small></label>
      <label class="isian"><span>Saran margin harga jual (%)</span><input type="number" step="any" min="0" name="persediaan.margin_saran_persen" value="${k.persediaan.margin_saran_persen}">
        <small>Dipakai untuk menyarankan harga jual saat margin terlalu kecil.</small></label>
    </div></div>
    <div class="kartu"><h3>Pelayanan Resep</h3><div class="form-grid">
      <label class="isian"><span>Tarif racik per racikan (Rp)</span><input type="number" min="0" name="pelayanan.tarif_racik" value="${k.pelayanan.tarif_racik}"><small>Dikali jumlah racikan (R/ racikan) yang ditebus.</small></label>
      <label class="isian"><span>Tambahan dari total nominal resep (%)</span><input type="number" step="any" min="0" name="pelayanan.persen_resep" value="${k.pelayanan.persen_resep}"><small>Persen dari total harga obat dalam resep, mis. 10.</small></label></div>
      ${cek('pelayanan', 'cetak_etiket', 'Centang "cetak etiket" secara bawaan saat menebus resep')}</div>
    <div class="kartu"><h3>Pembelian</h3><div class="form-grid">
      <label class="isian"><span>PPN bawaan di faktur baru</span><select name="pembelian.ppn_mode">${MODE_PPN.map(([v, l]) => `<option value="${v}" ${k.pembelian.ppn_mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="isian"><span>Tarif PPN bawaan</span><select name="pembelian.pajak_id">${pajak.filter(p => Number(p.persen) > 0).map(p => `<option value="${p.id}" ${String(k.pembelian.pajak_id) === String(p.id) ? 'selected' : ''}>${esc(p.nama)} (${p.persen}%)</option>`).join('')}</select>
        <small>Tarif baru (bila aturan pemerintah berubah) ditambahkan di Master Data → Master Pajak.</small></label>
    </div></div>
    ${boleh ? '<button class="tombol" style="margin-top:16px" data-simpan>Simpan Konfigurasi</button>' : ''}</form>`;
  if (!boleh) el.querySelectorAll('input,select').forEach(i => i.disabled = true);
  el.querySelector('[data-simpan]')?.addEventListener('click', async e => {
    const f = el.querySelector('form');
    const baru = structuredClone(k);
    for (const i of f.elements) {
      if (!i.name) continue;
      const [g, n] = i.name.split('.');
      baru[g][n] = i.type === 'checkbox' ? i.checked : i.type === 'number' || ['pembulatan', 'pajak_id'].includes(n) ? Number(i.value) : i.value;
    }
    e.target.disabled = true;
    const { error } = await sb.from('konfigurasi').upsert(Object.entries(baru).map(([kunci, nilai]) => ({ kunci, nilai, diubah: new Date().toISOString() })));
    lupakanKonfig();
    e.target.disabled = false;
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Konfigurasi disimpan', 'sukses');
  });
});
