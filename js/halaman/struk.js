// Pengaturan → Struk Nota: model, font, ukuran, bagian yang tampil, dan pratinjau langsung.
import { rute, sb, S, bisa } from '../inti.js?v=1.23.0';
import { esc, toast, pesanGalat, judulHalaman, konfirmasi } from '../ui.js?v=1.23.0';
import { bacaPrinter, cetakStrukHtml } from '../cetak.js?v=1.23.0';
import { barcodeHtml } from '../label.js?v=1.23.0';
import { MODEL, FONT, GARIS, STRUK_BAWAAN, rapikanStruk, cssStruk, isiNota, notaContoh } from '../struk.js?v=1.23.0';
import { ambilKonfig, lupakanKonfig } from './pengaturan.js?v=1.23.0';

export async function cetakNotaContoh(gaya) {
  const { data: o } = await sb.from('outlet').select('*').eq('id', S.pengguna.outlet_id).single();
  const lebar = bacaPrinter().struk.lebar || gaya.lebar || '80', j = notaContoh(o || S.outlet, S.pengguna.nama);
  return cetakStrukHtml(isiNota(j, gaya, gaya.tampil_barcode ? await barcodeHtml(j.no, lebar === '58' ? 48 : 72) : ''), 'Contoh nota', gaya.lebar, gaya);
}

rute('pengaturan/struk', async el => {
  const boleh = bisa('pengaturan.struk') && bisa('pengaturan.konfigurasi'), k = await ambilKonfig(), { data: o } = await sb.from('outlet').select('*').eq('id', S.pengguna.outlet_id).single();
  let s = rapikanStruk(k.struk), bar = {}, jeda, lihat = s.lebar;
  const ops = (d, v) => d.map(x => `<option value="${x[0]}" ${x[0] === v ? 'selected' : ''}>${esc(x[1])}</option>`).join(''), cek = (n, l) => `<label class="cek"><input type="checkbox" name="${n}" ${s[n] ? 'checked' : ''}> ${l}</label>`, num = (n, l, a, b, st = 1) => `<label class="isian"><span>${l}</span><input type="number" name="${n}" min="${a}" max="${b}" step="${st}" value="${s[n]}"></label>`;
  const gambar = () => {
    el.innerHTML = judulHalaman('Struk Nota', 'Pengaturan / Struk Nota', `<button class="tombol kedua" data-tes>Tes print</button>${boleh ? '<button class="tombol kedua" data-bawaan>Kembalikan bawaan</button><button class="tombol" data-simpan>Simpan</button>' : ''}`) + `<div class="struk-atur"><form onsubmit="return false">
      <div class="kartu"><h3 style="margin-top:0">Model</h3><div class="pilih-model">${MODEL.map(m => `<label class="${m[0] === s.model ? 'aktif' : ''}"><input type="radio" name="model" value="${m[0]}" ${m[0] === s.model ? 'checked' : ''}><b>${m[1]}</b><small>${m[2]}</small></label>`).join('')}</div></div>
      <div class="kartu"><h3 style="margin-top:0">Huruf</h3><div class="form-grid"><label class="isian"><span>Font</span><select name="font">${ops(FONT, s.font)}</select></label><label class="isian"><span>Jarak baris</span><select name="jarak">${ops([[1.1, 'Rapat'], [1.25, 'Agak rapat'], [1.35, 'Normal'], [1.55, 'Longgar']].map(x => [String(x[0]), x[1]]), String(s.jarak))}</select></label>${num('uk_nama', 'Ukuran nama apotek', 8, 26)}${num('uk_isi', 'Ukuran isi', 7, 18)}${num('uk_total', 'Ukuran TOTAL', 8, 28)}<label class="isian"><span>Garis pemisah</span><select name="garis">${ops(GARIS, s.garis)}</select></label></div>${cek('tebal', 'Semua huruf tebal (untuk printer yang pudar)')}</div>
      <div class="kartu"><h3 style="margin-top:0">Isi struk</h3>${cek('tampil_logo', 'Logo')}<div class="form-grid">${num('uk_logo', 'Ukuran logo', 16, 160)}<label class="isian"><span>Lebar kertas</span><select name="lebar">${ops([['58', '58 mm'], ['80', '80 mm']], s.lebar)}</select><small>Bisa berbeda per PC di Printer & Cetak.</small></label></div>
        ${cek('tampil_kasir', 'Nama kasir')}${cek('tampil_pelanggan', 'Nama pelanggan')}${cek('tampil_stamp', 'Stamp member')}${cek('tampil_apoteker', 'Apoteker & SIPA')}${cek('tampil_barcode', 'Barcode nota')}<p class="pesan peringatan ${s.tampil_barcode ? 'sembunyi' : ''}" data-awas>Barcode dipakai untuk retur dengan scan. Tanpa barcode, kasir harus mengetik nomor nota.</p>
        <label class="isian"><span>Teks tambahan di bawah</span><textarea name="kaki" rows="3" maxlength="300">${esc(s.kaki)}</textarea><small>Tampil setelah catatan struk di Profil Bisnis.</small></label>${cek('cetak_otomatis', 'Cetak struk otomatis setiap transaksi')}</div></form>
      <div class="kartu struk-lihat"><div class="kepala-blok"><h3>Pratinjau</h3><div class="brd-tab">${['58', '80'].map(x => `<button type="button" data-lihat="${x}" class="${x === lihat ? 'aktif' : ''}">${x} mm</button>`).join('')}</div></div><div class="alas"><iframe title="Pratinjau struk" data-iframe></iframe></div><small style="color:var(--teks-2)">Ukuran sebenarnya bisa sedikit berbeda di tiap printer. Pakai Tes print.</small></div></div>`;
    if (!boleh) el.querySelectorAll('form input,form select,form textarea').forEach(i => { i.disabled = true; });
    pratinjau();
  };
  const pratinjau = async () => {
    const mm = lihat === '58' ? 48 : 72; bar[mm] ||= await barcodeHtml('CONTOH-0001', mm);
    const f = el.querySelector('[data-iframe]'); if (!f) return;
    f.style.width = `${Number(lihat)}mm`;
    f.onload = () => { try { f.style.height = f.contentDocument.documentElement.scrollHeight + 4 + 'px'; } catch { /* */ } };
    f.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}body{padding:3mm 0}${cssStruk(s)}.kertas{width:${mm}mm;margin:0 auto}</style><div class="kertas">${isiNota(notaContoh(o || S.outlet, S.pengguna.nama), s, bar[mm])}</div>`;
  };
  const baca = () => { const f = el.querySelector('form'), r = { ...s }; for (const i of f.elements) { if (!i.name || (i.type === 'radio' && !i.checked)) continue; r[i.name] = i.type === 'checkbox' ? i.checked : i.name === 'jarak' || i.type === 'number' ? Number(i.value) : i.value; } return r; };
  el.addEventListener('input', e => { if (!e.target.closest('form')) return; s = { ...baca() }; el.querySelector('[data-awas]').classList.toggle('sembunyi', s.tampil_barcode); el.querySelectorAll('.pilih-model label').forEach(l => l.classList.toggle('aktif', l.querySelector('input').checked)); clearTimeout(jeda); jeda = setTimeout(pratinjau, 150); });
  el.addEventListener('click', async e => {
    const c = x => e.target.closest(x);
    if (c('[data-lihat]')) { lihat = c('[data-lihat]').dataset.lihat; el.querySelectorAll('[data-lihat]').forEach(b => b.classList.toggle('aktif', b.dataset.lihat === lihat)); pratinjau(); }
    if (c('[data-tes]')) { try { const r = await cetakNotaContoh(rapikanStruk(s)); toast(r === 'agen' ? 'Contoh nota terkirim ke printer' : 'Dialog cetak dibuka', 'sukses'); } catch (x) { toast(pesanGalat(x), 'galat'); } }
    if (c('[data-bawaan]') && await konfirmasi('Kembalikan bawaan', 'Tampilan struk kembali seperti semula. Belum disimpan sampai Anda menekan Simpan.', 'Kembalikan', '')) { s = rapikanStruk({ lebar: s.lebar, cetak_otomatis: s.cetak_otomatis }); s = { ...STRUK_BAWAAN, ...s }; gambar(); }
    if (c('[data-simpan]')) { const b = c('[data-simpan]'); b.disabled = true; s = rapikanStruk(baca()); const { error } = await sb.from('konfigurasi').upsert([{ kunci: 'struk', nilai: s, diubah: new Date().toISOString() }]); lupakanKonfig(); b.disabled = false; if (error) return toast(pesanGalat(error), 'galat'); toast('Struk disimpan untuk semua PC', 'sukses'); gambar(); }
  });
  gambar();
});
