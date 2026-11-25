// Halaman dokumen transaksi (daftar + editor) yang dipakai ulang:
// rencana pembelian, SP, faktur, retur, penyesuaian, opname, perpindahan, konsinyasi.
import { sb, S, bisa, ambilRef, rute, atauOffline } from './inti.js?v=1.24.0';
import { cariProdukL, infoProdukL } from './offline.js?v=1.24.0';
import { ikon } from './menu.js?v=1.24.0';
import { esc, angka, rupiah, tanggal, waktu, toast, konfirmasi, pesanGalat, judulHalaman, unduhCSV } from './ui.js?v=1.24.0';

export const STATUS = {
  draft: ['Draft', ''], posting: ['Diposting', 'hijau'], batal: ['Batal', 'merah'], diproses: ['Diproses', 'teal'],
  dipesan: ['Dipesan', 'teal'], sebagian: ['Diterima sebagian', 'oranye'], selesai: ['Selesai', 'hijau'],
};
export const chipStatus = s => `<span class="chip ${STATUS[s]?.[1] || ''}">${esc(STATUS[s]?.[0] || s)}</span>`;
const hariIni = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const awalBulan = () => hariIni().slice(0, 8) + '01';
const bulat = (v, d = 4) => Math.round(Number(v || 0) * 10 ** d) / 10 ** d;

// ---------- Data produk untuk baris item ----------
const cacheSatuan = {};
export async function infoProduk(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  return ids.length ? atauOffline(() => infoProdukServer(ids), () => infoProdukL(ids)) : {};
}
async function infoProdukServer(ids) {
  const [{ data: p, error }, { data: ps, error: e2 }] = await Promise.all([
    sb.from('produk').select('id,kode,nama,golongan,satuan_id,harga_beli,harga_jual,satuan:satuan_id(nama)').in('id', ids),
    sb.from('produk_satuan').select('produk_id,satuan_id,isi,harga_jual,satuan:satuan_id(nama)').in('produk_id', ids).order('isi'),
  ]);
  if (error || e2) throw error || e2;
  const hasil = {};
  for (const x of p || []) {
    const opsi = [{ satuan_id: x.satuan_id, nama: x.satuan?.nama || 'satuan', isi: 1 }];
    for (const s of (ps || []).filter(s => s.produk_id === x.id)) opsi.push({ satuan_id: s.satuan_id, nama: s.satuan?.nama, isi: Number(s.isi) });
    hasil[x.id] = { ...x, satuanDasar: x.satuan?.nama || '', satuanOpsi: opsi };
    cacheSatuan[x.id] = hasil[x.id];
  }
  return hasil;
}

export async function cariProduk(q, batas = 15) { return atauOffline(() => cariProdukServer(q, batas), () => cariProdukL(q, batas)); }
async function cariProdukServer(q, batas) {
  const c = q.replace(/[,()%*]/g, ' ').trim();
  if (!c) return [];
  const { data, error } = await sb.from('produk').select('id,kode,nama,barcode,nama_generik,harga_beli,harga_jual,satuan:satuan_id(nama)')
    .eq('aktif', true).or(`nama.ilike.%${c}%,kode.ilike.%${c}%,barcode.eq.${c},nama_generik.ilike.%${c}%`).order('nama').limit(batas);
  if (error) throw error;
  if (data.length) {
    const { data: st } = await sb.from('stok_produk').select('produk_id,qty').eq('outlet_id', S.pengguna.outlet_id).in('produk_id', data.map(d => d.id));
    for (const d of data) d.stok = Number(st?.find(s => s.produk_id === d.id)?.qty || 0);
  }
  return data;
}

// Kotak cari produk dengan daftar pilihan. pilih(produk) dipanggil saat dipilih.
export function pasangCariProduk(input, pilih) {
  const wadah = document.createElement('div');
  wadah.className = 'hasil-cari sembunyi';
  wadah.style.cssText = 'left:0;right:0;top:44px';
  input.parentElement.style.position = 'relative';
  input.after(wadah);
  let hasil = [], aktif = 0, jeda;
  const tampil = () => {
    wadah.innerHTML = hasil.length ? hasil.map((p, i) => `<a data-i="${i}" class="${i === aktif ? 'aktif' : ''}"><b>${esc(p.nama)}</b>
      <small>${esc(p.kode || '')} · stok ${angka(p.stok)} ${esc(p.satuan?.nama || '')} · ${rupiah(p.harga_jual)}</small></a>`).join('') : '<a>Tidak ditemukan</a>';
    wadah.classList.remove('sembunyi');
  };
  const ambil = async () => { try { hasil = await cariProduk(input.value); aktif = 0; tampil(); } catch (e) { toast(pesanGalat(e), 'galat'); } };
  input.addEventListener('input', () => { clearTimeout(jeda); if (!input.value.trim()) { wadah.classList.add('sembunyi'); return; } jeda = setTimeout(ambil, 250); });
  input.addEventListener('keydown', async e => {
    if (e.key === 'ArrowDown') { aktif = Math.min(aktif + 1, hasil.length - 1); tampil(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { aktif = Math.max(aktif - 1, 0); tampil(); e.preventDefault(); }
    if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(jeda);
      if (wadah.classList.contains('sembunyi') || !hasil.length) await ambil();
      // barcode persis -> langsung pilih
      const tepat = hasil.find(p => p.barcode && p.barcode === input.value.trim()) || hasil.find(p => p.kode && p.kode.toLowerCase() === input.value.trim().toLowerCase()) || hasil[aktif];
      if (tepat) { pilih(tepat); input.value = ''; wadah.classList.add('sembunyi'); }
    }
    if (e.key === 'Escape') { wadah.classList.add('sembunyi'); }
  });
  wadah.addEventListener('mousedown', e => {
    const a = e.target.closest('[data-i]'); if (!a) return;
    e.preventDefault(); pilih(hasil[a.dataset.i]); input.value = ''; wadah.classList.add('sembunyi'); input.focus();
  });
  input.addEventListener('blur', () => setTimeout(() => wadah.classList.add('sembunyi'), 150));
}

async function opsiBatch(produkIds, filter) {
  if (!produkIds.length) return {};
  let q = sb.from('stok_batch').select('id,produk_id,no_batch,ed,qty,hpp,gudang_id,konsinyasi,supplier_id,gudang:gudang_id(nama)')
    .in('produk_id', [...new Set(produkIds)]).eq('outlet_id', filter.outlet_id || S.pengguna.outlet_id).order('ed', { nullsFirst: false });
  if (!filter.termasukNol) q = q.gt('qty', 0);
  if (filter.gudang_id) q = q.eq('gudang_id', filter.gudang_id);
  if (filter.konsinyasi !== undefined) q = q.eq('konsinyasi', filter.konsinyasi);
  if (filter.supplier_id) q = q.eq('supplier_id', filter.supplier_id);
  const { data, error } = await q;
  if (error) throw error;
  const h = {};
  for (const b of data) (h[b.produk_id] ||= []).push(b);
  return h;
}
const labelBatch = b => `${b.no_batch}${b.ed ? ' · ED ' + tanggal(b.ed) : ''} · sisa ${angka(b.qty)}${b.konsinyasi ? ' · titipan' : ''}${b.gudang?.nama ? ' · ' + b.gudang.nama : ''}`;

// ---------- Daftar dokumen ----------
function halamanDaftar(cfg) {
  return async el => {
    const boleh = bisa(cfg.kunci);
    el.innerHTML = judulHalaman(cfg.judul, cfg.remah,
      `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>` + (boleh ? `<a class="tombol" href="#/${cfg.rute}/baru">${ikon('tambah')} Buat Baru</a>` : '')) +
      `<div class="kartu"><div class="alat-tabel">
        <div class="cari">${ikon('cari')}<input class="input" placeholder="Cari nomor${cfg.cariSupplier !== false ? ' / no. faktur' : ''}..." data-q></div>
        <label>Dari <input type="date" class="input" style="width:auto" data-dari value="${awalBulan()}"></label>
        <label>Sampai <input type="date" class="input" style="width:auto" data-sampai value="${hariIni()}"></label>
        <select class="input" style="width:auto" data-status><option value="">Semua status</option>${cfg.statusOpsi.map(s => `<option value="${s}">${STATUS[s][0]}</option>`).join('')}</select>
        <span style="margin-left:auto;color:var(--teks-2)" data-info></span></div>
        <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Nomor</th><th>Tanggal</th>${cfg.daftarKolom.map(k => `<th class="${k.angka ? 'angka' : ''}">${esc(k.label)}</th>`).join('')}<th>Status</th></tr></thead>
        <tbody data-isi></tbody></table></div></div>`;
    let data = [];
    async function muat() {
      const isi = el.querySelector('[data-isi]');
      isi.innerHTML = '<tr><td class="kosong" colspan="20">Memuat...</td></tr>';
      let q = sb.from(cfg.tabel).select(cfg.selectDaftar || '*').order('tanggal', { ascending: false }).order('id', { ascending: false }).limit(300);
      const dari = el.querySelector('[data-dari]').value, sampai = el.querySelector('[data-sampai]').value, st = el.querySelector('[data-status]').value;
      const qq = el.querySelector('[data-q]').value.replace(/[,()%*]/g, ' ').trim();
      if (dari) q = q.gte('tanggal', dari);
      if (sampai) q = q.lte('tanggal', sampai);
      if (st) q = q.eq('status', st);
      if (qq) q = q.or(cfg.cariKolom ? cfg.cariKolom.map(c => `${c}.ilike.%${qq}%`).join(',') : `no.ilike.%${qq}%`);
      q = q.eq('outlet_id', S.pengguna.outlet_id);
      const { data: d, error } = await q;
      if (error) { isi.innerHTML = `<tr><td class="kosong" colspan="20">${esc(pesanGalat(error))}</td></tr>`; return; }
      data = d;
      el.querySelector('[data-info]').textContent = `${angka(d.length)} dokumen`;
      isi.innerHTML = d.length ? d.map(r => `<tr style="cursor:pointer" data-buka="${r.id}"><td data-label="Nomor"><b>${esc(r.no)}</b></td><td data-label="Tanggal">${tanggal(r.tanggal)}</td>
        ${cfg.daftarKolom.map(k => `<td data-label="${esc(k.label)}" class="${k.angka ? 'angka' : ''}">${k.nilai(r)}</td>`).join('')}<td data-label="Status">${chipStatus(r.status)}</td></tr>`).join('')
        : `<tr><td class="kosong" colspan="20">Belum ada dokumen pada rentang ini.${boleh ? ` <a href="#/${cfg.rute}/baru">Buat baru</a>` : ''}</td></tr>`;
    }
    el.addEventListener('click', e => {
      const tr = e.target.closest('[data-buka]'); if (tr) location.hash = `#/${cfg.rute}/${tr.dataset.buka}`;
      if (e.target.closest('[data-csv]')) unduhCSV(cfg.judul.toLowerCase().replace(/\W+/g, '-'),
        [{ label: 'Nomor', nilai: r => r.no }, { label: 'Tanggal', nilai: r => r.tanggal }, ...cfg.daftarKolom.map(k => ({ label: k.label, nilai: r => (k.csv || k.nilai)(r).toString().replace(/<[^>]+>/g, '') })), { label: 'Status', nilai: r => STATUS[r.status]?.[0] }], data);
    });
    el.addEventListener('change', muat);
    let jeda; el.querySelector('[data-q]').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(muat, 300); });
    muat();
  };
}

// ---------- Editor dokumen ----------
/* cfg.item kolom: { f, label, tipe: produk|satuan|batch|angka|uang|persen|teks|tanggal|pilih|hitung|info, opsi, hitung(r,h), lebar, min, placeholder } */
function halamanEditor(cfg) {
  return async (el, idParam) => {
    const st = { header: {}, items: [], status: 'draft' };
    const baru = idParam === 'baru';
    if (baru) {
      st.header = { tanggal: hariIni(), ...(typeof cfg.bawaan === 'function' ? await cfg.bawaan() : cfg.bawaan || {}) };
      const pre = sessionStorage.getItem('prefill:' + cfg.jenis);
      if (pre) { sessionStorage.removeItem('prefill:' + cfg.jenis); const p = JSON.parse(pre); Object.assign(st.header, p.header || {}); st.items = p.items || []; }
    } else {
      const { data: h, error } = await sb.from(cfg.tabel).select('*').eq('id', idParam).single();
      if (error) { el.innerHTML = `<div class="pesan galat">${esc(pesanGalat(error))}</div>`; return; }
      const adaBatch = !['rencana', 'pesanan'].includes(cfg.jenis);
      const { data: it, error: e2 } = await sb.from(cfg.tabelItem).select(adaBatch ? '*, batch:batch_id(no_batch,ed,qty,konsinyasi,gudang:gudang_id(nama))' : '*').eq(cfg.fk, idParam).order('id');
      if (e2) { el.innerHTML = `<div class="pesan galat">${esc(pesanGalat(e2))}</div>`; return; }
      st.header = h; st.items = it; st.status = h.status;
    }
    const boleh = bisa(cfg.kunci);
    const bisaUbah = () => boleh && st.status === 'draft';
    await hidrasi(st.items);

    async function hidrasi(items) {
      const info = await infoProduk(items.filter(r => !r._p).map(r => r.produk_id));
      for (const r of items) if (!r._p && info[r.produk_id]) r._p = info[r.produk_id];
      if (cfg.item.some(k => k.tipe === 'batch') && bisaUbah()) {
        const perlu = items.filter(r => !r._batch).map(r => r.produk_id);
        const ob = await opsiBatch(perlu, { ...(cfg.filterBatch?.(st.header) || {}) });
        for (const r of items) if (!r._batch) r._batch = ob[r.produk_id] || [];
      }
    }

    const judul = baru ? 'Buat ' + cfg.satuan : `${cfg.satuan} ${st.header.no}`;
    el.innerHTML = judulHalaman(judul, cfg.remah, `<a class="tombol kedua" href="#/${cfg.rute}">${ikon('kiri')} Daftar</a>`) +
      `<div class="kartu"><div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><b>${esc(st.header.no || 'Dokumen baru')}</b>${chipStatus(st.status)}
        ${st.header.diposting ? `<small style="color:var(--teks-2)">diposting ${waktu(st.header.diposting)}</small>` : ''}</div>
        <form class="form-grid" data-header onsubmit="return false"></form><div data-info-header></div></div>
      <div class="kartu"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><h3 style="margin:0">Barang</h3>
        ${bisaUbah() ? `<div style="flex:1;min-width:240px;max-width:520px"><input class="input" data-cari-produk placeholder="Ketik nama/kode atau scan barcode, lalu Enter"></div>` : ''}
        <span data-tombol-item style="display:flex;gap:8px"></span></div>
        <div class="bungkus-tabel"><table class="tabel" data-tabel-item></table></div>
        <div data-total style="margin-top:14px"></div></div>
      <div class="kartu" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end" data-aksi></div>`;

    // ----- header -----
    const formH = el.querySelector('[data-header]');
    async function gambarHeader() {
      let html = '';
      for (const k of cfg.header) {
        if (k.tampilJika && !k.tampilJika(st.header)) continue;
        const v = st.header[k.f] ?? '';
        let inp;
        if (k.tipe === 'ref') {
          let opsi = await ambilRef(k.ref, k.refKolom || 'id,nama', k.refUrut || 'nama');
          if (k.saring) opsi = opsi.filter(o => k.saring(o, st.header));
          inp = `<select name="${k.f}" ${k.wajib ? 'required' : ''}><option value="">- pilih -</option>${opsi.map(o => `<option value="${o.id}" ${String(o.id) === String(v) ? 'selected' : ''}>${esc(k.label2 ? k.label2(o) : o.nama)}</option>`).join('')}</select>`;
        } else if (k.tipe === 'pilih') inp = `<select name="${k.f}">${k.opsi.map(([o, l]) => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        else if (k.tipe === 'area') inp = `<textarea name="${k.f}" rows="2">${esc(v)}</textarea>`;
        else if (['angka', 'uang', 'persen'].includes(k.tipe)) inp = `<input type="number" step="any" min="0" name="${k.f}" value="${esc(v)}">`;
        else inp = `<input type="${k.tipe === 'tanggal' ? 'date' : 'text'}" name="${k.f}" value="${esc(v)}" ${k.wajib ? 'required' : ''}>`;
        html += `<label class="isian ${k.lebar || k.tipe === 'area' ? 'lebar' : ''}"><span>${esc(k.label)}${k.wajib ? ' <i>*</i>' : ''}</span>${inp}${k.bantu ? `<small>${k.bantu}</small>` : ''}</label>`;
      }
      formH.innerHTML = html;
      if (!bisaUbah()) formH.querySelectorAll('input,select,textarea').forEach(i => i.disabled = true);
    }
    let keInfo = 0;
    const gambarInfo = async () => { if (!cfg.infoHeader) return; const n = ++keInfo; const h = await cfg.infoHeader(st.header).catch(() => ''); const w = el.querySelector('[data-info-header]'); if (n === keInfo && w) w.innerHTML = h; };
    gambarInfo();
    formH.addEventListener('change', async e => {
      const k = cfg.header.find(x => x.f === e.target.name); if (!k) return;
      st.header[k.f] = e.target.value === '' ? null : (['ref', 'angka', 'uang', 'persen'].includes(k.tipe) ? Number(e.target.value) : e.target.value);
      if (k.saatUbah) {
        const obj = k.tipe === 'ref' ? (await ambilRef(k.ref, k.refKolom || 'id,nama', k.refUrut || 'nama')).find(o => o.id === st.header[k.f]) : null;
        k.saatUbah(st.header, obj);
      }
      if (k.ubahBatch) { for (const r of st.items) { r._batch = null; } await hidrasi(st.items); gambarItem(); }
      if (k.tipe === 'ref' || k.tipe === 'pilih') await gambarHeader();
      if (k.f === 'supplier_id') gambarInfo();
      gambarTotal();
    });

    // ----- item -----
    const tabel = el.querySelector('[data-tabel-item]');
    const nilaiHitung = (k, r) => k.hitung(r, st.header);
    function selItem(k, r, i) {
      const dis = bisaUbah() ? '' : 'disabled';
      const v = r[k.f] ?? '';
      switch (k.tipe) {
        case 'produk': return `<b>${esc(r._p?.nama || '(produk #' + r.produk_id + ')')}</b><br><small style="color:var(--teks-2)">${esc(r._p?.kode || '')}</small>`;
        case 'satuan': {
          const o = r._p?.satuanOpsi || [];
          return `<select class="input" data-f="satuan_id" data-i="${i}" ${dis} style="min-width:90px">${o.map(s => `<option value="${s.satuan_id}" ${String(s.satuan_id) === String(r.satuan_id) ? 'selected' : ''}>${esc(s.nama)}${s.isi !== 1 ? ' (' + angka(s.isi) + ')' : ''}</option>`).join('')}</select>`;
        }
        case 'batch': {
          if (!bisaUbah() || !r._batch) return r.batch ? esc(`${r.batch.no_batch}${r.batch.ed ? ' · ED ' + tanggal(r.batch.ed) : ''}`) : esc(k.kosong || '-');
          const kos = k.kosong ?? '- pilih batch -';
          return `<select class="input" data-f="batch_id" data-i="${i}" style="min-width:200px"><option value="">${esc(kos)}</option>${r._batch.map(b => `<option value="${b.id}" ${String(b.id) === String(r.batch_id) ? 'selected' : ''}>${esc(labelBatch(b))}</option>`).join('')}</select>`;
        }
        case 'pilih': return `<select class="input" data-f="${k.f}" data-i="${i}" ${dis}>${k.opsi.map(([o, l]) => `<option value="${o}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        case 'hitung': return `<span data-h="${i}:${k.f}">${nilaiHitung(k, r)}</span>`;
        case 'info': return k.tampil ? k.tampil(r) : esc(angka(v));
        case 'tanggal': return `<input class="input" type="date" data-f="${k.f}" data-i="${i}" value="${esc(v)}" ${dis} style="min-width:140px">`;
        case 'teks': return `<input class="input" data-f="${k.f}" data-i="${i}" value="${esc(v)}" ${dis} placeholder="${esc(k.placeholder || '')}" style="min-width:${k.lebar || 100}px">`;
        default: return `<input class="input" type="number" step="any" min="${k.min ?? 0}" data-f="${k.f}" data-i="${i}" value="${esc(v)}" ${dis} style="width:${k.lebar || 90}px;text-align:right">`;
      }
    }
    function gambarItem() {
      tabel.innerHTML = `<thead><tr><th>#</th>${cfg.item.map(k => `<th class="${['angka', 'uang', 'persen', 'hitung', 'info'].includes(k.tipe) ? 'angka' : ''}">${esc(k.label)}</th>`).join('')}${bisaUbah() ? '<th></th>' : ''}</tr></thead>
        <tbody>${st.items.length ? st.items.map((r, i) => `<tr><td>${i + 1}</td>${cfg.item.map(k => `<td class="${['hitung', 'info'].includes(k.tipe) ? 'angka' : ''}">${selItem(k, r, i)}</td>`).join('')}
          ${bisaUbah() ? `<td><button class="ikon-aksi hapus" data-hapus-item="${i}" title="Hapus baris">${ikon('hapus')}</button></td>` : ''}</tr>`).join('')
          : `<tr><td colspan="30" class="kosong">${bisaUbah() ? 'Belum ada barang. Cari produk di kotak atas.' : 'Tidak ada barang.'}</td></tr>`}</tbody>`;
      gambarTotal();
    }
    function gambarTotal() {
      el.querySelectorAll('[data-h]').forEach(s => { const [i, f] = s.dataset.h.split(':'); const k = cfg.item.find(x => x.f === f); s.innerHTML = nilaiHitung(k, st.items[i]); });
      el.querySelector('[data-total]').innerHTML = cfg.total ? cfg.total(st.header, st.items) : '';
    }
    tabel.addEventListener('input', e => {
      const t = e.target; if (t.dataset.i === undefined) return;
      const r = st.items[t.dataset.i]; const f = t.dataset.f;
      if (t.type === 'number') r[f] = t.value === '' ? null : Number(t.value); else if (t.tagName !== 'SELECT') r[f] = t.value || null;
      gambarTotal();
    });
    tabel.addEventListener('change', e => {
      const t = e.target; if (t.tagName !== 'SELECT' || t.dataset.i === undefined) return;
      const r = st.items[t.dataset.i]; const f = t.dataset.f;
      if (f === 'satuan_id') {
        const s = r._p.satuanOpsi.find(x => String(x.satuan_id) === t.value);
        r.satuan_id = s.satuan_id; r.isi = s.isi;
        if (cfg.hargaSatuan) r.harga = cfg.hargaSatuan(r._p, s.isi, st.header);
        gambarItem(); return;
      }
      if (f === 'batch_id') { r.batch_id = t.value ? Number(t.value) : null; cfg.saatPilihBatch?.(r, r._batch.find(b => String(b.id) === t.value)); gambarItem(); return; }
      r[f] = t.value; cfg.saatUbah?.(r, f); gambarItem();
    });
    tabel.addEventListener('click', e => { const b = e.target.closest('[data-hapus-item]'); if (b) { st.items.splice(b.dataset.hapusItem, 1); gambarItem(); } });

    async function tambahProduk(p) {
      const r = { produk_id: p.id, ...(cfg.itemBaru ? cfg.itemBaru(p, st.header) : {}) };
      await hidrasi([r]);
      if (cfg.item.some(k => k.tipe === 'satuan')) { r.satuan_id ??= r._p.satuan_id; r.isi ??= 1; }
      if (cfg.item.some(k => k.tipe === 'batch') && cfg.batchOtomatis !== false && r._batch?.length && !r.batch_id) { r.batch_id = r._batch[0].id; cfg.saatPilihBatch?.(r, r._batch[0]); }
      if (cfg.gabung !== false) {
        const ada = st.items.find(x => x.produk_id === r.produk_id && x.satuan_id === r.satuan_id && !cfg.item.some(k => k.tipe === 'batch'));
        if (ada && 'qty' in ada) { ada.qty = Number(ada.qty || 0) + 1; gambarItem(); return; }
      }
      st.items.push(r);
      gambarItem();
      const baris = tabel.querySelectorAll('tbody tr'); baris[baris.length - 1]?.querySelector(`[data-f="${cfg.fokus || 'qty'}"]`)?.focus();
    }
    const cari = el.querySelector('[data-cari-produk]');
    if (cari) pasangCariProduk(cari, p => tambahProduk(p).catch(e => toast(pesanGalat(e), 'galat')));

    // ----- aksi -----
    const bersih = () => {
      const angkaTipe = ['angka', 'uang', 'persen'];
      const h = { ...st.header };
      for (const k of Object.keys(h)) if (!cfg.header.some(x => x.f === k) && !(cfg.headerTambahan || []).includes(k) && k !== 'id') delete h[k];
      for (const k of cfg.header) if (angkaTipe.includes(k.tipe) && (h[k.f] === null || h[k.f] === undefined || h[k.f] === '')) h[k.f] = 0;
      const kolomItem = new Set([...cfg.item.filter(k => !['produk', 'hitung', 'info'].includes(k.tipe) || k.simpan).map(k => k.tipe === 'satuan' ? 'satuan_id' : k.tipe === 'batch' ? 'batch_id' : k.f), 'produk_id', ...(cfg.item.some(k => k.tipe === 'satuan') ? ['isi'] : []), ...(cfg.itemTambahan || [])]);
      const items = st.items.map(r => {
        const o = {};
        for (const c of kolomItem) {
          const k = cfg.item.find(x => x.f === c);
          let v = r[c];
          if ((v === null || v === undefined || v === '') && k && angkaTipe.includes(k.tipe) && !k.bolehKosong) v = 0;
          if (v !== undefined) o[c] = v === '' ? null : v;
        }
        return o;
      });
      return { h, items };
    };
    async function simpan() {
      if (!formH.reportValidity()) throw new Error('Lengkapi isian yang wajib.');
      if (cfg.validasi) { const m = cfg.validasi(st.header, st.items); if (m) throw new Error(m); }
      const { h, items } = bersih();
      const { data: id, error } = await sb.rpc('simpan_dok', { p_jenis: cfg.jenis, p_header: h, p_item: items });
      if (error) throw error;
      return id;
    }
    const aksi = el.querySelector('[data-aksi]');
    const tombol = (teks, kelas, fn, ik) => { const b = document.createElement('button'); b.className = 'tombol ' + kelas; b.innerHTML = (ik ? ikon(ik) : '') + esc(teks);
      b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { toast(pesanGalat(e), 'galat'); } finally { b.disabled = false; } }; aksi.append(b); };
    const muatUlang = id => { if (String(id) === String(idParam)) tampilUlang(); else location.hash = `#/${cfg.rute}/${id}`; };
    const tampilUlang = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

    function gambarAksi() {
      aksi.innerHTML = '';
      if (bisaUbah()) {
        if (!baru) tombol('Batalkan Dokumen', 'bahaya', async () => {
          if (!await konfirmasi('Batalkan dokumen', `Batalkan <b>${esc(st.header.no)}</b>?`, 'Batalkan')) return;
          const { error } = await sb.rpc('batal_dok', { p_jenis: cfg.jenis, p_id: st.header.id }); if (error) throw error; toast('Dibatalkan'); tampilUlang();
        });
        tombol('Simpan Draft', 'kedua', async () => { const id = await simpan(); toast('Draft tersimpan', 'sukses'); muatUlang(id); });
        if (cfg.stok) tombol(cfg.labelPosting || 'Simpan & Posting', '', async () => {
          if (!st.items.length) throw new Error('Belum ada barang.');
          if (!await konfirmasi(cfg.labelPosting || 'Posting', cfg.pesanPosting || 'Setelah diposting, stok langsung berubah dan dokumen tidak bisa diubah lagi (hanya bisa dibatalkan). Lanjutkan?', 'Ya, posting', '')) return;
          const id = await simpan();
          const { error } = await sb.rpc('posting_dok', { p_jenis: cfg.jenis, p_id: id });
          if (error) { toast(pesanGalat(error), 'galat'); muatUlang(id); return; }
          toast('Berhasil diposting', 'sukses'); muatUlang(id);
          if (cfg.setelahPosting) setTimeout(() => cfg.setelahPosting(id).catch(e => toast(pesanGalat(e), 'galat')), 600);
        });
      } else if (boleh && cfg.stok && st.status === 'posting' && cfg.bolehBatalPosting !== false) {
        tombol('Batalkan (kembalikan stok)', 'bahaya', async () => {
          if (!await konfirmasi('Batalkan dokumen', `Batalkan <b>${esc(st.header.no)}</b>? Stok akan dikembalikan seperti sebelum dokumen ini.`, 'Batalkan')) return;
          const { error } = await sb.rpc('batal_dok', { p_jenis: cfg.jenis, p_id: st.header.id }); if (error) throw error; toast('Dibatalkan'); tampilUlang();
        });
      }
      for (const a of cfg.aksiEkstra || []) if (!a.jika || a.jika(st, boleh)) tombol(a.teks, a.kelas || 'kedua', () => a.fn(st, { simpan, tampilUlang }), a.ikon);
      if (!baru) tombol('Cetak', 'kedua', () => cetakDokumen(cfg, st), 'laporan');
    }
    const tombolItem = el.querySelector('[data-tombol-item]');
    for (const a of cfg.aksiItem || []) if (bisaUbah()) {
      const b = document.createElement('button'); b.className = 'tombol kedua kecil'; b.textContent = a.teks;
      b.onclick = async () => { b.disabled = true; try { const baris = await a.fn(st); if (baris) { await hidrasi(baris); st.items.push(...baris); gambarItem(); } } catch (e) { toast(pesanGalat(e), 'galat'); } finally { b.disabled = false; } };
      tombolItem.append(b);
    }

    await gambarHeader();
    gambarItem();
    gambarAksi();
    return judul;
  };
}

// ---------- Cetak ----------
export async function cetakDokumen(cfg, st) {
  const { data: o } = await sb.from('outlet').select('*').eq('id', st.header.outlet_id).single();
  const info = [];
  for (const k of cfg.header) {
    let v = st.header[k.f];
    if (v === null || v === undefined || v === '') continue;
    if (k.tipe === 'ref') { const l = await ambilRef(k.ref, k.refKolom || 'id,nama', k.refUrut || 'nama'); const x = l.find(z => z.id === v); v = x ? (k.label2 ? k.label2(x) : x.nama) : v; }
    else if (k.tipe === 'pilih') v = (k.opsi.find(z => z[0] === v) || [, v])[1];
    else if (k.tipe === 'tanggal') v = tanggal(v);
    else if (k.tipe === 'uang') v = rupiah(v);
    info.push([k.label, v]);
  }
  const kolom = cfg.item.filter(k => k.cetak !== false && !(k.tipe === 'teks' && k.f === 'catatan'));
  const isi = st.items.map((r, i) => `<tr><td>${i + 1}</td>${kolom.map(k => {
    let v;
    if (k.tipe === 'produk') v = esc(r._p?.nama || '');
    else if (k.tipe === 'satuan') v = esc(r._p?.satuanOpsi.find(s => String(s.satuan_id) === String(r.satuan_id))?.nama || '');
    else if (k.tipe === 'batch') v = esc(r.batch ? `${r.batch.no_batch}${r.batch.ed ? ' / ' + tanggal(r.batch.ed) : ''}` : (r._batch || []).find(b => b.id === r.batch_id)?.no_batch || '');
    else if (k.tipe === 'hitung') v = k.hitung(r, st.header);
    else if (k.tipe === 'info') v = k.tampil ? k.tampil(r) : angka(r[k.f]);
    else if (k.tipe === 'uang') v = rupiah(r[k.f]);
    else if (k.tipe === 'tanggal') v = tanggal(r[k.f]);
    else if (k.tipe === 'pilih') v = esc((k.opsi.find(z => z[0] === r[k.f]) || [, r[k.f]])[1]);
    else if (['angka', 'persen'].includes(k.tipe)) v = angka(r[k.f]);
    else v = esc(r[k.f] ?? '');
    return `<td>${v}</td>`;
  }).join('')}</tr>`).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(st.header.no)}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#000} h1{font-size:18px;text-align:center;margin:14px 0 4px} .kop{display:flex;gap:12px;align-items:center;border-bottom:2px solid #000;padding-bottom:8px}
    .kop b{font-size:16px} table{width:100%;border-collapse:collapse;margin-top:10px} td,th{border:1px solid #444;padding:4px 6px;text-align:left} .info td{border:0;padding:2px 6px}
    .ttd{display:flex;justify-content:space-between;margin-top:40px} .ttd div{text-align:center;width:40%} @media print{button{display:none}}</style></head><body>
    <div class="kop"><img src="${location.href.split('#')[0].replace(/index\.html$/, '')}img/logo-b-256.png" width="56"><div><b>${esc(o?.nama || '')}</b><br>${esc(o?.alamat || '')}<br>${esc(o?.telp || '')}${o?.no_sia ? ' · SIA ' + esc(o.no_sia) : ''}</div></div>
    <h1>${esc(cfg.judulCetak || cfg.satuan.toUpperCase())}</h1><div style="text-align:center">No. ${esc(st.header.no)} · ${tanggal(st.header.tanggal)}</div>
    <table class="info">${info.map(([a, b]) => `<tr><td style="width:160px">${esc(a)}</td><td>: ${esc(b)}</td></tr>`).join('')}</table>
    <table><thead><tr><th>No</th>${kolom.map(k => `<th>${esc(k.label)}</th>`).join('')}</tr></thead><tbody>${isi}</tbody></table>
    <div style="margin-top:10px">${cfg.total ? cfg.total(st.header, st.items) : ''}</div>
    <div class="ttd"><div>${esc(cfg.ttdKiri || 'Dibuat oleh')}<br><br><br><br>(..............................)</div>
      <div>${esc(cfg.ttdKanan || 'Apoteker Penanggung Jawab')}<br><br><br><br>${esc(o?.apoteker || '(..............................)')}${o?.sipa ? '<br>SIPA ' + esc(o.sipa) : ''}</div></div>
    <button onclick="print()" style="margin-top:20px;padding:8px 16px">Cetak</button><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

// ---------- Daftarkan rute dokumen ----------
export function rutekanDokumen(cfg) {
  const daftar = halamanDaftar(cfg), editor = halamanEditor(cfg);
  rute(cfg.rute, (el, p) => p[0] ? editor(el, p[0]) : daftar(el));
}

// ---------- Ringkasan total (dipakai beberapa dokumen) ----------
export const barisTotal = baris => `<div style="display:flex;justify-content:flex-end"><table style="min-width:280px">${baris.map(([l, v, tebal]) =>
  `<tr><td style="padding:3px 12px;color:var(--teks-2)">${esc(l)}</td><td style="padding:3px 0;text-align:right;${tebal ? 'font-weight:800;font-size:16px' : ''}">${v}</td></tr>`).join('')}</table></div>`;
export { bulat };
