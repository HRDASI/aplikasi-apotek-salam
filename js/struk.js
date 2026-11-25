// Desain struk: model, font, ukuran, dan bagian yang tampil. Dipakai nota, retur, rekap sesi, copy resep, dan pratinjau.
import { esc, angka, waktu } from './ui.js?v=1.23.0';

export const MODEL = [['klasik', 'Klasik', 'Seperti struk selama ini'], ['ringkas', 'Ringkas', 'Hemat kertas, satu baris per barang'], ['lengkap', 'Lengkap', 'Kop besar, rincian dan jumlah barang'], ['modern', 'Modern', 'Logo besar, total menonjol']];
export const FONT = [['courier', 'Courier (mesin kasir)', "'Courier New',monospace"], ['consolas', 'Consolas', "Consolas,'Courier New',monospace"], ['arial', 'Arial', 'Arial,sans-serif'], ['verdana', 'Verdana (lebar, jelas)', 'Verdana,sans-serif'], ['tahoma', 'Tahoma', 'Tahoma,sans-serif'], ['sempit', 'Arial Narrow (sempit)', "'Arial Narrow',Arial,sans-serif"]];
export const GARIS = [['putus', 'Putus-putus'], ['lurus', 'Lurus'], ['ganda', 'Ganda'], ['kosong', 'Tanpa garis']];
export const STRUK_BAWAAN = { lebar: '58', cetak_otomatis: false, tampil_logo: true, tampil_apoteker: true, model: 'klasik', font: 'courier', uk_nama: 11, uk_isi: 11, uk_total: 13, tebal: false, jarak: 1.35, garis: 'putus', uk_logo: 40, tampil_barcode: true, tampil_kasir: true, tampil_pelanggan: true, tampil_stamp: true, kaki: '' };
const batas = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(b, Math.max(a, n)) : d; };
export const rapikanStruk = s => { const x = { ...STRUK_BAWAAN, ...(s || {}) }; return { ...x, model: MODEL.some(m => m[0] === x.model) ? x.model : 'klasik', font: FONT.some(f => f[0] === x.font) ? x.font : 'courier', garis: GARIS.some(g => g[0] === x.garis) ? x.garis : 'putus', uk_nama: batas(x.uk_nama, 8, 26, 11), uk_isi: batas(x.uk_isi, 7, 18, 11), uk_total: batas(x.uk_total, 8, 28, 13), jarak: batas(x.jarak, 1, 2, 1.35), uk_logo: batas(x.uk_logo, 16, 160, 40), kaki: String(x.kaki || '').slice(0, 300) }; };

export function cssStruk(s) {
  const x = rapikanStruk(s), g = { putus: '1px dashed #000', lurus: '1px solid #000', ganda: '3px double #000', kosong: '0' }[x.garis];
  return `.kertas{font:${x.tebal ? 'bold ' : ''}${x.uk_isi}px/${x.jarak} ${FONT.find(f => f[0] === x.font)[2]};color:#000}.c{text-align:center}.r{display:flex;justify-content:space-between;gap:6px}
  .r span:first-child{min-width:0;overflow-wrap:anywhere}.r span:last-child{text-align:right;white-space:nowrap}hr{border:0;border-top:${g};margin:4px 0}.n{margin-top:3px;overflow-wrap:anywhere}img{max-width:60%}.b{font-weight:bold}.besar,.tot{font-size:${x.uk_total}px;font-weight:bold}
  .nm{font-size:${x.uk_nama}px;font-weight:bold;line-height:1.2}.kcl{font-size:${Math.max(7, x.uk_isi - 2)}px}.logo{width:${x.uk_logo}px;max-width:100%}.kotak{background:#000;color:#fff;padding:5px 6px;margin:5px 0}`;
}
const br = (a, b) => `<div class="r"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
const akar = () => location.href.split('#')[0].replace(/[^/]*$/, '');

// barcode: HTML barcode yang sudah jadi (boleh kosong)
export function isiNota(j, s, barcode = '') {
  const x = rapikanStruk(s), o = j.outlet || {}, m = x.model, logo = x.tampil_logo ? `<img class="logo" src="${akar()}img/logo-b-256.png" alt=""${m === 'modern' ? ` style="width:${Math.round(x.uk_logo * 1.6)}px"` : ''}><br>` : '';
  const diskon = i => (i.diskon_promo > 0 ? br('  Promo', '-' + angka(i.diskon_promo)) : '') + (i.diskon_manual > 0 ? br(`  Diskon ${angka(i.diskon_persen)}%`, '-' + angka(i.diskon_manual)) : '');
  const item = [...j.item].sort((a, b) => a.id - b.id), qty = i => `${angka(i.qty)} ${i.satuan_nama || ''}`.trim();
  const baris = m === 'ringkas' ? item.map(i => br(`${i.nama} (${qty(i)})`, angka(i.qty * i.harga)) + diskon(i)).join('')
    : m === 'lengkap' ? item.map((i, n) => `<div class="n"><b>${n + 1}. ${esc(i.nama)}</b></div>${br(`   ${qty(i)} x ${angka(i.harga)}`, angka(i.qty * i.harga))}${diskon(i)}`).join('')
      : item.map(i => `<div class="n">${m === 'modern' ? `<b>${esc(i.nama)}</b>` : esc(i.nama)}</div>${br(`  ${qty(i)} x ${angka(i.harga)}`, angka(i.qty * i.harga))}${diskon(i)}`).join('');
  const pot = [['Diskon pelanggan', j.diskon_pelanggan], ['Diskon', j.diskon_nota], ['Voucher', j.potongan_voucher], [`Tukar ${angka(j.poin_dipakai)} poin`, j.potongan_poin]].filter(y => y[1] > 0).map(([a, b]) => br(a, '-' + angka(b))).join('');
  const biaya = [['Jasa racik', j.jasa_racik], ['Jasa resep', j.jasa_resep], ['Embalase', j.embalase], ['Tuslah', j.tuslah]].filter(y => y[1] > 0).map(([a, b]) => br(a, angka(b))).join('') + (Number(j.pembulatan) ? br('Pembulatan', angka(j.pembulatan)) : '');
  const ada = pot || biaya, total = `<div class="r tot${m === 'modern' ? ' kotak' : ''}"><span>TOTAL</span><span>${m === 'modern' || m === 'lengkap' ? 'Rp ' : ''}${angka(j.total)}</span></div>`;
  const kop = m === 'ringkas' ? `<div class="c">${logo}<span class="nm">${esc(o.nama)}</span>${o.telp ? `<br><span class="kcl">${esc(o.telp)}</span>` : ''}</div>` : `<div class="c">${logo}<span class="nm">${esc(o.nama)}</span><br>${esc(o.alamat || '')}${o.telp ? '<br>Telp ' + esc(o.telp) : ''}${m === 'lengkap' && o.no_sia ? '<br>SIA ' + esc(o.no_sia) : ''}</div>`;
  const kepala = m === 'ringkas' ? `<div class="r kcl"><span>${esc(j.no)}</span><span>${waktu(j.waktu)}</span></div>` : br(j.no, waktu(j.waktu));
  return `${j.contoh ? '<div class="c b">*** CONTOH ***</div>' : ''}${kop}<hr>${kepala}${x.tampil_kasir ? br('Kasir', j.pengguna_nama || '') : ''}${x.tampil_pelanggan && j.pelanggan ? br('Pelanggan', j.pelanggan.nama) : ''}${j.dokter ? br('Dokter', j.dokter.nama) : ''}${j.no_resep ? br('No. resep', j.no_resep) : ''}<hr>
    ${baris}<hr>${m === 'lengkap' ? br('Jumlah jenis barang', angka(item.length)) : ''}${m !== 'ringkas' || ada ? br('Subtotal', angka(j.subtotal)) : ''}${pot}${biaya}${total}
    ${j.bayar.map(b => br(b.metode?.nama || 'Bayar', angka(b.jumlah))).join('')}${m !== 'ringkas' || Number(j.kembalian) ? br('Kembali', angka(j.kembalian)) : ''}
    ${x.tampil_stamp && j.stamp_didapat > 0 ? br('Stamp member', `+${angka(j.stamp_didapat)} (total ${angka(j.pelanggan?.stamp)})`) : ''}${j.status === 'batal' ? '<div class="c"><b>*** DIBATALKAN ***</b></div>' : ''}${j.no.startsWith('OFF-') ? '<div class="c">Nota sementara (offline)</div>' : ''}<hr>
    ${x.tampil_apoteker && o.apoteker ? `<div class="c${m === 'ringkas' ? ' kcl' : ''}">Apoteker: ${esc(o.apoteker)}${o.sipa ? '<br>SIPA ' + esc(o.sipa) : ''}</div>` : ''}<div class="c">${esc(o.catatan_struk || '')}</div>${x.kaki ? `<div class="c" style="white-space:pre-line">${esc(x.kaki)}</div>` : ''}
    ${x.tampil_barcode ? `${barcode}<div class="c kcl">${esc(j.no)} · simpan struk untuk retur</div>` : `<div class="c kcl">${esc(j.no)}</div>`}${j.contoh ? '<div class="c b">*** CONTOH, BUKAN NOTA ***</div>' : ''}`;
}
export const notaContoh = (outlet, kasir) => ({ contoh: true, no: 'CONTOH-0001', waktu: new Date().toISOString(), outlet: outlet || { nama: 'Apotek Salam' }, pengguna_nama: kasir || 'Kasir', pelanggan: { nama: 'Pelanggan Contoh', stamp: 7 }, subtotal: 61500, diskon_nota: 1500, total: 60000, kembalian: 40000, stamp_didapat: 2, status: 'selesai',
  item: [{ id: 1, nama: 'Paracetamol 500 mg', qty: 2, satuan_nama: 'Strip', harga: 5000 }, { id: 2, nama: 'Vitamin C 500 mg Rasa Jeruk Isi 30 Tablet', qty: 1, satuan_nama: 'Botol', harga: 41500 }, { id: 3, nama: 'Minyak Kayu Putih 60 ml', qty: 1, satuan_nama: 'Botol', harga: 10000 }], bayar: [{ metode: { nama: 'Tunai' }, jumlah: 100000 }] });
