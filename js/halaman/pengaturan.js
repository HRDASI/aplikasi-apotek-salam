// Pengaturan: Profil Bisnis (outlet aktif) & Konfigurasi.
import { rute, sb, S, bisa } from '../inti.js?v=1.4.2';
import { esc, toast, pesanGalat, bacaForm, judulHalaman } from '../ui.js?v=1.4.2';

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

// Konfigurasi disimpan di tabel konfigurasi (kunci -> jsonb)
export const KONFIG_BAWAAN = {
  struk: { lebar: '58', cetak_otomatis: false, tampil_logo: true, tampil_apoteker: true },
  penjualan: { stok_minus: false, pembulatan: 0, wajib_resep_obat_keras: true, diskon_maks_persen: 20 },
  persediaan: { peringatan_ed_hari: 90, metode_keluar: 'FEFO', batas_margin_persen: 5, margin_saran_persen: 20 },
  pembelian: { ppn_mode: 'tambah', pajak_id: null },
};
export const MODE_PPN = [['tambah', 'Belum termasuk PPN (PPN ditambahkan)'], ['termasuk', 'Sudah termasuk PPN'], ['tanpa', 'Tidak kena PPN']];
export async function ambilKonfig() {
  const { data } = await sb.from('konfigurasi').select('*');
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
    <div class="kartu"><h3>Persediaan</h3><div class="form-grid">
      <label class="isian"><span>Peringatan kedaluwarsa (hari sebelum ED)</span><input type="number" min="1" name="persediaan.peringatan_ed_hari" value="${k.persediaan.peringatan_ed_hari}"></label>
      <label class="isian"><span>Urutan stok keluar</span><select name="persediaan.metode_keluar"><option value="FEFO" ${k.persediaan.metode_keluar === 'FEFO' ? 'selected' : ''}>FEFO (ED terdekat dulu)</option><option value="FIFO" ${k.persediaan.metode_keluar === 'FIFO' ? 'selected' : ''}>FIFO (masuk duluan dulu)</option></select></label>
      <label class="isian"><span>Peringatan berpotensi rugi bila margin di bawah (%)</span><input type="number" step="any" min="0" name="persediaan.batas_margin_persen" value="${k.persediaan.batas_margin_persen}">
        <small>Margin = (harga jual − harga beli) ÷ harga beli. Harga beli sudah termasuk PPN.</small></label>
      <label class="isian"><span>Saran margin harga jual (%)</span><input type="number" step="any" min="0" name="persediaan.margin_saran_persen" value="${k.persediaan.margin_saran_persen}">
        <small>Dipakai untuk menyarankan harga jual saat margin terlalu kecil.</small></label>
    </div></div>
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
    e.target.disabled = false;
    if (error) return toast(pesanGalat(error), 'galat');
    toast('Konfigurasi disimpan', 'sukses');
  });
});
