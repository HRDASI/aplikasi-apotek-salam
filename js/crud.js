// Halaman daftar + form tambah/ubah/hapus yang dipakai ulang oleh semua master data.
import { sb, S, bisa, ambilRef, hapusCache, ambilSemua } from './inti.js?v=1.18.0';
import { ikon } from './menu.js?v=1.18.0';
import { esc, angka, rupiah, tanggal, toast, modal, konfirmasi, pesanGalat, bacaForm, unduhCSV, judulHalaman } from './ui.js?v=1.18.0';

/*
 cfg = {
   judul, remah, tabel, kunciTulis: ['master.produk', ...],
   kolom: [{ f, label, tipe: text|angka|uang|persen|bool|pilih|ref|tanggal|jam|area|email|telp,
             ref: 'kategori', refLabel: 'nama', opsi: [[nilai,label]], wajib, daftar: true|false, form: true|false,
             bantu: 'teks bantuan', lebar: true, tampil: r => html }],
   cari: ['nama','kode'], urut: 'nama', perHalaman: 25,
   outlet: true   // tabel punya outlet_id: default outlet pengguna & tampilkan kolom outlet
   bawaan: {}     // nilai awal form
   ekstraForm(form, baris) -> html ;  setelahSimpan(id, form, baris)
   pilihSelect: 'string select tambahan'
 }
*/
const KERANGKA = Array(6).fill('<tr class="kerangka-muat"><td colspan="99"><i></i></td></tr>').join('');
export function halamanCrud(cfg) {
  return async el => {
    let ke = 0;
    const bolehTulis = (cfg.kunciTulis || []).some(bisa);
    const st = { hal: 0, q: '', total: 0, filter: {} };
    const per = cfg.perHalaman || 25;
    const kolomDaftar = cfg.kolom.filter(k => k.daftar !== false);
    const refKolom = cfg.kolom.filter(k => k.tipe === 'ref');

    el.innerHTML = judulHalaman(cfg.judul, cfg.remah,
      (cfg.aksiAtas || []).map((a, i) => `<button class="tombol kedua" data-aksi-atas="${i}">${ikon(a.ikon)} ${esc(a.judul)}</button>`).join('') +
      `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>` +
      (bolehTulis ? `<button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>` : '')) +
      `<div class="kartu">
        <div class="alat-tabel">
          <div class="cari">${ikon('cari')}<input class="input" placeholder="Cari ${esc((cfg.cari || ['nama']).join(', ').replace(/nama_generik/g, 'zat aktif').replace(/_/g, ' '))}..." data-q></div>
          ${cfg.filterAktif ? `<select class="input" style="width:auto" data-aktif><option value="">Semua status</option><option value="1" selected>Aktif</option><option value="0">Nonaktif</option></select>` : ''}
          <span style="margin-left:auto;color:var(--teks-2)" data-info></span>
        </div>
        <div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr>
          ${kolomDaftar.map(k => `<th class="${['angka', 'uang', 'persen'].includes(k.tipe) ? 'angka' : ''}">${esc(k.label)}</th>`).join('')}
          ${cfg.outlet ? '<th>Outlet</th>' : ''}<th></th></tr></thead><tbody data-isi></tbody></table></div>
        <div class="paging" data-paging></div>
      </div>`;

    el.querySelectorAll('[data-aksi-atas]').forEach(b => b.onclick = () => cfg.aksiAtas[b.dataset.aksiAtas].fn());

    const selectStr = () => {
      const s = ['*', ...refKolom.map(k => `${k.f}__ref:${k.ref}!${k.f}(${k.refLabel || 'nama'})`)];
      if (cfg.outlet) s.push('outlet__ref:outlet!outlet_id(nama)');
      if (cfg.pilihSelect) s.push(cfg.pilihSelect);
      return s.join(',');
    };

    function kueri(q) {
      let k = q;
      const cari = st.q.replace(/[,()%*]/g, ' ').trim();
      if (cari) k = k.or((cfg.cari || ['nama']).map(f => `${f}.ilike.%${cari}%`).join(','));
      if (cfg.filterAktif && st.filter.aktif !== '') k = k.eq('aktif', st.filter.aktif === '1');
      if (cfg.saring) k = cfg.saring(k);
      return k.order(cfg.urut || 'nama', { ascending: cfg.naik !== false });
    }

    const tampilSel = (k, r) => {
      if (k.tampil) { const h = k.tampil(r); return /<br/.test(h || '') ? `<span>${h}</span>` : h; }
      const v = r[k.f];
      switch (k.tipe) {
        case 'ref': return esc(r[k.f + '__ref']?.[k.refLabel || 'nama'] ?? '');
        case 'uang': return rupiah(v);
        case 'angka': return angka(v);
        case 'persen': return angka(v) + '%';
        case 'bool': return v ? '<span class="chip hijau">Ya</span>' : '<span class="chip">Tidak</span>';
        case 'tanggal': return tanggal(v);
        case 'jam': return esc((v || '').slice(0, 5));
        case 'pilih': return esc((k.opsi.find(o => o[0] === v) || [, v ?? ''])[1]);
        default: return esc(v ?? '');
      }
    };

    async function muat() {
      const isi = el.querySelector('[data-isi]');
      const ini = ++ke;
      if (!st.data) isi.innerHTML = KERANGKA; else isi.classList.add('redup');
      const { data, error, count } = await kueri(sb.from(cfg.tabel).select(selectStr(), { count: 'exact' }))
        .range(st.hal * per, st.hal * per + per - 1);
      if (ini !== ke) return;
      isi.classList.remove('redup');
      if (error) { isi.innerHTML = `<tr><td class="kosong" colspan="99">${esc(pesanGalat(error))}</td></tr>`; return; }
      st.total = count || 0;
      if (cfg.setelahMuat) { await cfg.setelahMuat(data); if (ini !== ke) return; }
      st.data = data;
      isi.innerHTML = data.length ? data.map((r, i) => `<tr>
          ${kolomDaftar.map(k => `<td data-label="${esc(k.label)}" class="${['angka', 'uang', 'persen'].includes(k.tipe) ? 'angka' : ''}">${tampilSel(k, r)}</td>`).join('')}
          ${cfg.outlet ? `<td data-label="Outlet">${esc(r.outlet__ref?.nama || '')}</td>` : ''}
          <td class="aksi">${(cfg.aksiBaris || []).map((a, j) => `<button class="ikon-aksi" data-aksi-baris="${j}:${i}" title="${esc(a.judul)}">${ikon(a.ikon)}</button>`).join('')}${bolehTulis ? `<button class="ikon-aksi" data-ubah="${i}" title="Ubah">${ikon('ubah')}</button><button class="ikon-aksi hapus" data-hapus="${i}" title="Hapus">${ikon('hapus')}</button>`
            : `<button class="ikon-aksi" data-lihat="${i}" title="Lihat">${ikon('info')}</button>`}</td></tr>`).join('')
        : `<tr><td class="kosong" colspan="99">${st.q ? 'Tidak ada data yang cocok.' : 'Belum ada data.' + (bolehTulis ? ' Klik <b>Tambah</b> untuk mengisi.' : '')}</td></tr>`;
      const dari = st.total ? st.hal * per + 1 : 0, sampai = Math.min(st.total, (st.hal + 1) * per);
      el.querySelector('[data-info]').textContent = `${angka(st.total)} data`;
      el.querySelector('[data-paging]').innerHTML = st.total > per ? `${dari}-${sampai} dari ${angka(st.total)}
        <button class="tombol kedua kecil" data-hal="-1" ${st.hal ? '' : 'disabled'}>${ikon('kiri')}</button>
        <button class="tombol kedua kecil" data-hal="1" ${sampai >= st.total ? 'disabled' : ''}>${ikon('panah')}</button>` : '';
    }

    async function inputHtml(k, nilai) {
      const w = k.wajib ? 'required' : '';
      const v = nilai ?? '';
      switch (k.tipe) {
        case 'bool': return `<label class="cek ${k.lebar ? 'lebar' : ''}"><input type="checkbox" name="${k.f}" ${nilai ? 'checked' : ''}> ${esc(k.label)}</label>`;
        case 'ref': {
          const daftar = await ambilRef(k.ref, `id,${k.refLabel || 'nama'}`, k.refLabel || 'nama');
          return `<select name="${k.f}" data-tipe="angka" ${w}><option value="">- pilih -</option>${daftar.map(o => `<option value="${o.id}" ${String(o.id) === String(v) ? 'selected' : ''}>${esc(o[k.refLabel || 'nama'])}</option>`).join('')}</select>`;
        }
        case 'pilih': return `<select name="${k.f}" ${w}>${k.wajib ? '' : '<option value="">- pilih -</option>'}${k.opsi.map(([o, l]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        case 'area': return `<textarea name="${k.f}" rows="3" ${w}>${esc(v)}</textarea>`;
        case 'angka': case 'uang': case 'persen': return `<input type="number" step="any" name="${k.f}" value="${esc(v)}" ${w} ${k.min !== undefined ? `min="${k.min}"` : ''}>`;
        case 'tanggal': return `<input type="date" name="${k.f}" value="${esc(v)}" ${w}>`;
        case 'jam': return `<input type="time" name="${k.f}" value="${esc(String(v).slice(0, 5))}" ${w}>`;
        case 'email': return `<input type="email" name="${k.f}" value="${esc(v)}" ${w}>`;
        case 'telp': return `<input type="tel" name="${k.f}" value="${esc(v)}" ${w}>`;
        default: return `<input type="text" name="${k.f}" value="${esc(v)}" ${w} ${k.maks ? `maxlength="${k.maks}"` : ''}>`;
      }
    }

    async function bukaForm(baris, hanyaLihat = false) {
      const nilai = baris || { ...(cfg.bawaan || {}), ...(cfg.outlet ? { outlet_id: S.pengguna.outlet_id } : {}) };
      const kolomForm = cfg.kolom.filter(k => k.form !== false);
      if (cfg.outlet) kolomForm.push({ f: 'outlet_id', label: 'Outlet', tipe: 'ref', ref: 'outlet', wajib: true });
      let html = '<form class="form-grid" onsubmit="return false">';
      for (const k of kolomForm) {
        const inp = await inputHtml(k, nilai[k.f]);
        html += k.tipe === 'bool' ? inp
          : `<label class="isian ${k.lebar || k.tipe === 'area' ? 'lebar' : ''}"><span>${esc(k.label)}${k.wajib ? ' <i>*</i>' : ''}</span>${inp}${k.bantu ? `<small>${k.bantu}</small>` : ''}</label>`;
      }
      if (cfg.ekstraForm) html += `<div class="lebar">${await cfg.ekstraForm(baris)}</div>`;
      html += '</form>';
      modal({
        judul: (hanyaLihat ? 'Detail ' : baris ? 'Ubah ' : 'Tambah ') + (cfg.satuan || cfg.judul.replace(/^(Master |Daftar )/, '')),
        isi: html, ukuran: cfg.ukuranForm || '',
        saatBuka: m => { if (hanyaLihat) m.querySelectorAll('input,select,textarea').forEach(i => i.disabled = true); cfg.saatBukaForm?.(m, baris); },
        tombol: hanyaLihat ? [{ teks: 'Tutup', kelas: 'kedua' }] : [
          { teks: 'Batal', kelas: 'kedua' },
          { teks: 'Simpan', aksi: async m => {
            const form = m.querySelector('form');
            if (!form.reportValidity()) return false;
            const d = bacaForm(form);
            for (const k of Object.keys(d)) if (k.startsWith('_')) delete d[k];
            if (cfg.sebelumSimpan) await cfg.sebelumSimpan(d, baris);
            const q = baris ? sb.from(cfg.tabel).update(d).eq('id', baris.id) : sb.from(cfg.tabel).insert(d);
            const { data, error } = await q.select('id').single();
            if (error) throw error;
            if (cfg.setelahSimpan) await cfg.setelahSimpan(data.id, m, baris);
            hapusCache(cfg.tabel);
            toast('Tersimpan', 'sukses');
            muat();
          } },
        ],
      });
    }

    el.addEventListener('click', async e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.aksiBaris) { const [j, i] = t.dataset.aksiBaris.split(':'); cfg.aksiBaris[j].fn(st.data[i]); return; }
      if (t.dataset.tambah !== undefined) bukaForm(null);
      else if (t.dataset.ubah !== undefined) bukaForm(st.data[t.dataset.ubah]);
      else if (t.dataset.lihat !== undefined) bukaForm(st.data[t.dataset.lihat], true);
      else if (t.dataset.hapus !== undefined) {
        const r = st.data[t.dataset.hapus];
        if (!await konfirmasi('Hapus data', `Hapus <b>${esc(r[cfg.labelBaris || 'nama'] || '')}</b>? Tindakan ini tidak bisa dibatalkan.`, 'Hapus')) return;
        const { error } = await sb.from(cfg.tabel).delete().eq('id', r.id);
        if (error) return toast(pesanGalat(error), 'galat');
        hapusCache(cfg.tabel);
        toast('Terhapus'); muat();
      } else if (t.dataset.hal) { st.hal += Number(t.dataset.hal); muat(); }
      else if (t.dataset.csv !== undefined) {
        let data; try { data = await ambilSemua(() => kueri(sb.from(cfg.tabel).select(selectStr())).order('id')); } catch (x) { return toast(pesanGalat(x), 'galat'); }
        if (cfg.setelahMuat) for (let i = 0; i < data.length; i += 200) await cfg.setelahMuat(data.slice(i, i + 200));
        const kol = kolomDaftar.map(k => ({ label: k.label, nilai: r => k.tipe === 'ref' ? r[k.f + '__ref']?.[k.refLabel || 'nama'] : k.tipe === 'pilih' ? (k.opsi.find(o => o[0] === r[k.f]) || [, r[k.f]])[1] : k.tipe === 'bool' ? (r[k.f] ? 'Ya' : 'Tidak') : r[k.f] }));
        unduhCSV(cfg.judul.toLowerCase().replace(/\W+/g, '-'), kol, data);
      }
    });
    let jeda;
    el.querySelector('[data-q]').addEventListener('input', e => { clearTimeout(jeda); jeda = setTimeout(() => { st.q = e.target.value; st.hal = 0; muat(); }, 300); });
    el.querySelector('[data-aktif]')?.addEventListener('change', e => { st.filter.aktif = e.target.value; st.hal = 0; muat(); });
    if (cfg.filterAktif) st.filter.aktif = '1';
    muat();
  };
}
