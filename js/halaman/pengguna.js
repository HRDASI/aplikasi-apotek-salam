// Manajemen Pengguna: daftar pengguna, peran & hak akses, log aktivitas.
import { rute, sb, S, bisa, ambilRef, hapusCache } from '../inti.js?v=1.21.0';
import { MENU, ikon } from '../menu.js?v=1.21.0';
import { esc, waktu, toast, modal, konfirmasi, pesanGalat, bacaForm, judulHalaman, unduhCSV } from '../ui.js?v=1.21.0';

// ---------- Daftar Pengguna ----------
rute('pengguna/daftar', async el => {
  const boleh = bisa('pengguna.daftar');
  el.innerHTML = judulHalaman('Daftar Pengguna', 'Manajemen Pengguna / Daftar Pengguna',
    boleh ? `<button class="tombol" data-tambah>${ikon('tambah')} Tambah Pengguna</button>` : '') +
    `<div class="kartu"><div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr>
      <th>Nama</th><th>Username</th><th>Peran</th><th>Outlet</th><th>No. HP</th><th>Status</th><th></th></tr></thead>
      <tbody data-isi><tr><td class="kosong" colspan="9">Memuat...</td></tr></tbody></table></div></div>`;
  let data = [];
  async function muat() {
    const { data: d, error } = await sb.from('pengguna').select('*, peran:peran_id(nama), outlet:outlet_id(nama)').order('nama');
    if (error) return toast(pesanGalat(error), 'galat');
    data = d;
    el.querySelector('[data-isi]').innerHTML = d.map((r, i) => `<tr>
      <td data-label="Nama"><b>${esc(r.nama)}</b>${r.id === S.pengguna.id ? ' <span class="chip teal">Anda</span>' : ''}</td>
      <td data-label="Username">${esc(r.username)}</td><td data-label="Peran">${esc(r.peran?.nama)}</td>
      <td data-label="Outlet">${esc(r.outlet?.nama || 'Semua')}</td><td data-label="No. HP">${esc(r.telp || '')}</td>
      <td data-label="Status">${r.aktif ? '<span class="chip hijau">Aktif</span>' : '<span class="chip merah">Nonaktif</span>'}</td>
      <td class="aksi">${boleh ? `<button class="ikon-aksi" data-ubah="${i}" title="Ubah">${ikon('ubah')}</button>
        <button class="ikon-aksi" data-sandi="${i}" title="Atur ulang kata sandi">${ikon('kunci')}</button>` : ''}</td></tr>`).join('');
  }
  async function form(r) {
    const peran = await ambilRef('peran', 'id,nama', 'id', true), outlet = await ambilRef('outlet', 'id,nama', 'id', true);
    const op = (l, v) => l.map(o => `<option value="${o.id}" ${String(o.id) === String(v) ? 'selected' : ''}>${esc(o.nama)}</option>`).join('');
    modal({
      judul: r ? 'Ubah Pengguna' : 'Tambah Pengguna',
      isi: `<form class="form-grid" onsubmit="return false">
        <label class="isian"><span>Nama Lengkap <i>*</i></span><input name="nama" required value="${esc(r?.nama || '')}"></label>
        <label class="isian"><span>Username <i>*</i></span><input name="username" required pattern="[a-z0-9._]{3,30}" value="${esc(r?.username || '')}" ${r ? 'disabled' : ''}>
          <small>Huruf kecil/angka/titik, 3-30 karakter. Dipakai untuk login.</small></label>
        ${r ? '' : `<label class="isian"><span>Kata Sandi <i>*</i></span><input name="sandi" type="password" minlength="6" required autocomplete="new-password"><small>Minimal 6 karakter.</small></label><label class="cek lihat-sandi"><input type="checkbox" data-lihat-sandi> Tampilkan kata sandi</label>`}
        <label class="isian"><span>No. HP</span><input name="telp" type="tel" value="${esc(r?.telp || '')}"></label>
        <label class="isian"><span>Peran <i>*</i></span><select name="peran_id" data-tipe="angka" required>${op(peran, r?.peran_id)}</select></label>
        <label class="isian"><span>Outlet <i>*</i></span><select name="outlet_id" data-tipe="angka" required>${op(outlet, r?.outlet_id ?? S.pengguna.outlet_id)}</select></label>
        ${r ? `<label class="cek lebar"><input type="checkbox" name="aktif" ${r.aktif ? 'checked' : ''} ${r.id === S.pengguna.id ? 'disabled' : ''}> Akun aktif (bisa login)</label>` : ''}
      </form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form'); if (!f.reportValidity()) return false;
        const d = bacaForm(f);
        if (r) {
          const ubah = { nama: d.nama, telp: d.telp, peran_id: d.peran_id, outlet_id: d.outlet_id };
          if (r.id !== S.pengguna.id) ubah.aktif = d.aktif;
          const { error } = await sb.from('pengguna').update(ubah).eq('id', r.id); if (error) throw error;
        } else {
          const { error } = await sb.rpc('buat_pengguna', { p_username: d.username.toLowerCase(), p_nama: d.nama, p_sandi: d.sandi, p_peran_id: d.peran_id, p_outlet_id: d.outlet_id, p_telp: d.telp });
          if (error) throw error;
        }
        toast('Tersimpan', 'sukses'); muat();
      } }],
    });
  }
  el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.tambah !== undefined) form(null);
    if (t.dataset.ubah) form(data[t.dataset.ubah]);
    if (t.dataset.sandi) {
      const r = data[t.dataset.sandi];
      modal({ judul: 'Atur Ulang Kata Sandi', ukuran: 'kecil',
        isi: `<p style="margin-top:0">Kata sandi baru untuk <b>${esc(r.nama)}</b> (${esc(r.username)}).</p>
          <form onsubmit="return false"><label class="isian"><span>Kata sandi baru</span><input name="s" type="password" minlength="6" required autocomplete="new-password"></label><label class="cek lihat-sandi"><input type="checkbox" data-lihat-sandi> Tampilkan kata sandi</label></form>`,
        tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
          const f = m.querySelector('form'); if (!f.reportValidity()) return false;
          const { error } = await sb.rpc('atur_sandi_pengguna', { p_id: r.id, p_sandi: f.s.value }); if (error) throw error;
          toast('Kata sandi diganti', 'sukses');
        } }] });
    }
  });
  muat();
});

// ---------- Peran & Hak Akses ----------
function pohonAkses(akses) {
  const semua = akses.includes('*');
  const cek = k => semua || akses.includes(k);
  return `<label class="cek"><input type="checkbox" data-semua ${semua ? 'checked' : ''}> <b>Semua akses (Pemilik)</b></label>
    <div class="pohon-akses" ${semua ? 'style="opacity:.5;pointer-events:none"' : ''}>${MENU.filter(g => g.k !== 'panduan').map(g => {
      if (!g.anak) return `<div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="${g.k}" ${cek(g.k) ? 'checked' : ''}> ${esc(g.t)}</label></div>`;
      const grupPenuh = cek(g.k);
      return `<div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="${g.k}" data-grup ${grupPenuh ? 'checked' : ''}> ${esc(g.t)} <small style="color:var(--teks-2);font-weight:400">(semua submenu)</small></label>
        <div class="anak-akses">${g.anak.map(([k, t]) => `<label class="cek"><input type="checkbox" value="${g.k}.${k}" data-anak="${g.k}" ${grupPenuh || akses.includes(g.k + '.' + k) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div></div>`;
    }).join('')}
    <div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="akses.program_ubah" ${cek('akses.program_ubah') ? 'checked' : ''}> Boleh menginput Program & MOU</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="akses.program_nominal" ${cek('akses.program_nominal') ? 'checked' : ''}> Boleh melihat nominal insentif program</label></div>
    <div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="persediaan.lihat" ${cek('persediaan.lihat') ? 'checked' : ''}> Lihat daftar produk saja (tanpa mengubah)</label></div>
    <div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="penjualan.batal" ${cek('penjualan.batal') || cek('penjualan') ? 'checked' : ''}> Boleh membatalkan transaksi penjualan</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="penjualan.retur_setuju" ${cek('penjualan.retur_setuju') || cek('penjualan') ? 'checked' : ''}> Boleh menyetujui retur di luar batas kasir</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="akses.nominal" ${cek('akses.nominal') ? 'checked' : ''}> Boleh melihat total nilai penjualan & selisih kas</label></div>
    <div class="grup-akses"><label class="cek" style="margin:0"><input type="checkbox" value="akses.tanpa_shift" ${cek('akses.tanpa_shift') ? 'checked' : ''}> Boleh login tanpa memilih shift (untuk Admin)</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="keuangan.laba" ${cek('keuangan.laba') || cek('keuangan') ? 'checked' : ''}> Boleh melihat laba & HPP (Laporan Keuangan, Dashboard Keuangan, Analisis Harga)</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="akuntansi.kunci" ${cek('akuntansi.kunci') || cek('akuntansi') ? 'checked' : ''}> Boleh mengunci/membuka periode pembukuan</label>
      <label class="cek" style="margin:6px 0 0"><input type="checkbox" value="pengaturan.perangkat" ${cek('pengaturan.perangkat') || cek('pengaturan') ? 'checked' : ''}> Boleh menandai perangkat offline</label></div></div>`;
}
function bacaAkses(m) {
  if (m.querySelector('[data-semua]').checked) return ['*'];
  const hasil = [];
  for (const c of m.querySelectorAll('.pohon-akses input:checked')) {
    if (c.dataset.anak && m.querySelector(`[data-grup][value="${c.dataset.anak}"]`)?.checked) continue;
    hasil.push(c.value);
  }
  return hasil;
}
rute('pengguna/peran', async el => {
  const boleh = bisa('pengguna.peran');
  el.innerHTML = judulHalaman('Peran & Hak Akses', 'Manajemen Pengguna / Peran & Hak Akses',
    boleh ? `<button class="tombol" data-tambah>${ikon('tambah')} Tambah Peran</button>` : '') +
    `<div class="kartu"><div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Peran</th><th>Hak akses</th><th>Jumlah pengguna</th><th></th></tr></thead>
    <tbody data-isi></tbody></table></div></div>`;
  let data = [];
  async function muat() {
    const [{ data: p, error }, { data: g }] = await Promise.all([sb.from('peran').select('*').order('id'), sb.from('pengguna').select('peran_id')]);
    if (error) return toast(pesanGalat(error), 'galat');
    data = p;
    el.querySelector('[data-isi]').innerHTML = p.map((r, i) => `<tr>
      <td data-label="Peran"><b>${esc(r.nama)}</b> ${r.sistem ? '<span class="chip">bawaan</span>' : ''}</td>
      <td data-label="Hak akses">${r.akses.includes('*') ? '<span class="chip teal">Semua akses</span>' : `${r.akses.length} menu`}</td>
      <td data-label="Pengguna">${g.filter(x => x.peran_id === r.id).length}</td>
      <td class="aksi">${boleh ? `<button class="ikon-aksi" data-ubah="${i}">${ikon('ubah')}</button>${r.sistem ? '' : `<button class="ikon-aksi hapus" data-hapus="${i}">${ikon('hapus')}</button>`}` : ''}</td></tr>`).join('');
  }
  function form(r) {
    modal({ judul: r ? 'Ubah Peran: ' + r.nama : 'Tambah Peran', ukuran: 'besar',
      isi: `<form onsubmit="return false"><label class="isian"><span>Nama Peran <i>*</i></span><input name="nama" required value="${esc(r?.nama || '')}" ${r?.sistem ? 'disabled' : ''}></label>
        <p style="margin:4px 0 10px;color:var(--teks-2)">Centang menu yang boleh dibuka peran ini.</p>${pohonAkses(r?.akses || ['home'])}</form>`,
      saatBuka: m => m.addEventListener('change', e => {
        const c = e.target;
        if (c.dataset.semua !== undefined) { const p = m.querySelector('.pohon-akses'); p.style.opacity = c.checked ? .5 : 1; p.style.pointerEvents = c.checked ? 'none' : ''; }
        if (c.dataset.grup !== undefined) m.querySelectorAll(`[data-anak="${c.value}"]`).forEach(x => x.checked = c.checked);
        if (c.dataset.anak) { const semua = [...m.querySelectorAll(`[data-anak="${c.dataset.anak}"]`)].every(x => x.checked); m.querySelector(`[data-grup][value="${c.dataset.anak}"]`).checked = semua; }
      }),
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form'); if (!f.reportValidity()) return false;
        const akses = bacaAkses(m);
        if (r?.sistem && r.nama === 'Pemilik' && !akses.includes('*')) { toast('Peran Pemilik harus tetap punya semua akses.', 'galat'); return false; }
        const d = { akses }; if (!r?.sistem) d.nama = f.nama.value.trim();
        const { error } = r ? await sb.from('peran').update(d).eq('id', r.id) : await sb.from('peran').insert(d);
        if (error) throw error;
        hapusCache('peran'); toast('Tersimpan', 'sukses'); muat();
      } }] });
  }
  el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.tambah !== undefined) form(null);
    if (t.dataset.ubah) form(data[t.dataset.ubah]);
    if (t.dataset.hapus) {
      const r = data[t.dataset.hapus];
      if (!await konfirmasi('Hapus peran', `Hapus peran <b>${esc(r.nama)}</b>?`, 'Hapus')) return;
      const { error } = await sb.from('peran').delete().eq('id', r.id);
      if (error) return toast(pesanGalat(error), 'galat');
      muat();
    }
  });
  muat();
});

// ---------- Log Aktivitas ----------
rute('pengguna/log', async el => {
  const semua = bisa('pengguna.log');
  el.innerHTML = judulHalaman('Log Aktivitas', 'Manajemen Pengguna / Log Aktivitas', `<button class="tombol kedua" data-csv>${ikon('unduh')} Unduh</button>`) +
    `<div class="kartu"><div class="alat-tabel">
      <label>Dari <input type="date" class="input" style="width:auto" data-dari></label>
      <label>Sampai <input type="date" class="input" style="width:auto" data-sampai></label>
      ${semua ? '<select class="input" style="width:auto" data-orang><option value="">Semua pengguna</option></select>' : '<span class="chip">Hanya aktivitas Anda</span>'}
    </div><div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Modul</th></tr></thead><tbody data-isi></tbody></table></div></div>`;
  const hariIni = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  el.querySelector('[data-dari]').value = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  el.querySelector('[data-sampai]').value = hariIni;
  if (semua) {
    const { data } = await sb.from('pengguna').select('id,nama').order('nama');
    el.querySelector('[data-orang]').innerHTML += (data || []).map(p => `<option value="${p.id}">${esc(p.nama)}</option>`).join('');
  }
  let data = [];
  async function muat() {
    const dari = el.querySelector('[data-dari]').value, sampai = el.querySelector('[data-sampai]').value;
    let q = sb.from('log_aktivitas').select('*').order('waktu', { ascending: false }).limit(1000);
    if (dari) q = q.gte('waktu', new Date(dari + 'T00:00:00').toISOString());
    if (sampai) q = q.lt('waktu', new Date(new Date(sampai + 'T00:00:00').getTime() + 864e5).toISOString());
    const orang = el.querySelector('[data-orang]')?.value;
    if (orang) q = q.eq('pengguna_id', orang); else if (!semua) q = q.eq('pengguna_id', S.pengguna.id);
    const { data: d, error } = await q;
    if (error) return toast(pesanGalat(error), 'galat');
    data = d;
    el.querySelector('[data-isi]').innerHTML = d.length ? d.map(r => `<tr><td data-label="Waktu">${waktu(r.waktu)}</td><td data-label="Pengguna">${esc(r.pengguna_nama || '')}</td>
      <td data-label="Aktivitas">${esc(r.keterangan || r.aksi)}</td><td data-label="Modul"><span class="chip">${esc((r.modul || '').replace(/_/g, ' '))}</span></td></tr>`).join('')
      : '<tr><td class="kosong" colspan="4">Tidak ada aktivitas pada rentang ini.</td></tr>';
  }
  el.addEventListener('change', muat);
  el.querySelector('[data-csv]').onclick = () => unduhCSV('log-aktivitas', [
    { label: 'Waktu', nilai: r => waktu(r.waktu) }, { label: 'Pengguna', nilai: r => r.pengguna_nama },
    { label: 'Aktivitas', nilai: r => r.keterangan }, { label: 'Modul', nilai: r => r.modul }], data);
  muat();
});
