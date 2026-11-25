// Keuangan: Akun Kas, Buku Kas, Utang Usaha, Piutang Usaha.
import { rute, sb, S, bisa, ambilRef, hapusCache } from '../inti.js?v=1.14.0';
import { ikon } from '../menu.js?v=1.14.0';
import { esc, angka, rupiah, tanggal, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.14.0';
import { rpc, hariIni, barPeriode, tabelHtml, unduhTabel, cetakHtml } from '../tabel.js?v=1.14.0';

const galat = (el, e) => { el.innerHTML = `<p class="pesan galat">${esc(pesanGalat(e))}</p>`; };
export async function akunKas() {
  const { data, error } = await sb.from('akun_kas').select('*').eq('aktif', true).order('akun_kode');
  if (error) throw error;
  return data.filter(k => k.outlet_id === null || k.outlet_id === S.pengguna.outlet_id);
}
export const opsiKas = (ks, v) => ks.map(k => `<option value="${k.id}" data-jenis="${k.jenis}" ${k.id === v ? 'selected' : ''}>${esc(k.nama)}</option>`).join('');
const CEK_LACI = `<label class="cek lebar" data-laci-wadah><input type="checkbox" name="laci"> Uang keluar/masuk lewat laci kasir yang sesinya sedang buka (ikut dihitung saat tutup sesi)</label>`;
// tampilkan pilihan laci hanya bila akun Kas Kasir dipakai
function pasangLaci(f) {
  const w = f.querySelector('[data-laci-wadah]');
  const cek = () => { const ada = [...f.querySelectorAll('select[name^=kas]')].some(s => !s.closest('.sembunyi') && s.selectedOptions[0]?.dataset.jenis === 'kasir'); w.classList.toggle('sembunyi', !ada); if (!ada) f.laci.checked = false; };
  f.addEventListener('change', cek); cek();
}
const saldoTeks = v => `<b style="color:${v < 0 ? 'var(--merah)' : 'inherit'}">${rupiah(v)}</b>`;

// ---------- Akun Kas ----------
rute('keuangan/akun_kas', async el => {
  const boleh = bisa('keuangan.akun_kas');
  const form = k => modal({ judul: k ? 'Ubah Akun Kas' : 'Tambah Akun Kas', isi: `<form class="form-grid" onsubmit="return false"><label class="isian"><span>Nama <i>*</i></span><input name="nama" required value="${esc(k?.nama || '')}" placeholder="mis. Bank BCA"></label>
    ${k ? `<label class="cek"><input type="checkbox" name="aktif" ${k.aktif ? 'checked' : ''}> Aktif</label>` : `<label class="isian"><span>Jenis</span><select name="jenis"><option value="bank">Bank / e-wallet</option><option value="kas">Kas tunai</option></select></label><label class="cek"><input type="checkbox" name="semua" checked> Bank dipakai semua outlet</label>`}</form>`,
    tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false;
      await rpc('simpan_akun_kas', { p_id: k?.id ?? null, p_nama: f.nama.value, p_jenis: f.jenis?.value ?? null, p_semua: f.semua?.checked ?? false, p_aktif: f.aktif?.checked ?? true }); hapusCache('akun_kas'); toast('Tersimpan', 'sukses'); muat(); } }] });
  let data = [];
  const muat = async () => {
    try {
      data = await rpc('saldo_kas');
      const semua = data.filter(k => k.aktif).reduce((a, k) => a + Number(k.saldo), 0);
      el.innerHTML = judulHalaman('Daftar Akun Kas', 'Keuangan / Daftar Akun Kas', boleh ? `<button class="tombol" data-tambah>${ikon('tambah')} Tambah</button>` : '') +
        `<div class="kartu"><div class="statistik" style="max-width:320px;margin-bottom:14px"><small>Total uang</small>${saldoTeks(semua)}</div>` + tabelHtml([
          { l: 'Kode', n: r => r.kode }, { l: 'Nama', n: r => r.nama, h: r => `<a href="#/keuangan/buku_kas/${r.kode}"><b>${esc(r.nama)}</b></a>${r.aktif ? '' : ' <span class="chip">nonaktif</span>'}` }, { l: 'Jenis', n: r => ({ kasir: 'Laci kasir', kas: 'Kas tunai', bank: 'Bank' })[r.jenis] },
          { l: 'Outlet', n: r => r.outlet || 'Semua' }, { l: 'Saldo', n: r => r.saldo, t: 'uang', h: r => saldoTeks(r.saldo) }, { l: '', n: () => '', h: r => boleh ? `<button class="ikon-aksi" data-ubah="${r.id}" title="Ubah">${ikon('ubah')}</button>` : '' }], data) +
        `<p style="color:var(--teks-2);font-size:13px">Saldo awal: catat lewat Buku Kas → Kas Masuk dengan akun lawan <b>Ekuitas Saldo Awal</b>. Uang hasil tutup sesi dicatat manual saat disetor: Buku Kas → Transfer dari Kas Kasir.</p></div>`;
    } catch (e) { galat(el, e); }
  };
  el.addEventListener('click', e => { if (e.target.closest('[data-tambah]')) form(); const b = e.target.closest('[data-ubah]'); if (b) form(data.find(k => k.id === Number(b.dataset.ubah))); });
  await muat();
});

// ---------- Buku Kas ----------
rute('keuangan/buku_kas', async (el, [kodeAwal] = []) => {
  const bp = await barPeriode('bulan'), ks = await akunKas(); const boleh = bisa('keuangan.buku_kas');
  let kode = ks.some(k => k.akun_kode === kodeAwal) ? kodeAwal : ks[0]?.akun_kode, baris = [];
  const kol = [{ l: 'Tanggal', n: r => r.tgl, t: 'tgl' }, { l: 'No.', n: r => r.no }, { l: 'Keterangan', n: r => r.ket }, { l: 'Masuk', n: r => r.jml > 0 ? r.jml : 0, t: 'uang', jml: true }, { l: 'Keluar', n: r => r.jml < 0 ? -r.jml : 0, t: 'uang', jml: true }, { l: 'Saldo', n: r => r.saldo, t: 'uang' },
    { l: '', n: () => '', h: r => boleh && r.tabel === 'kas_transaksi' ? `<button class="ikon-aksi hapus" data-batal="${r.id}" title="Batalkan">${ikon('hapus')}</button>` : '' }];
  el.innerHTML = judulHalaman('Buku Kas', 'Keuangan / Buku Kas', `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-cetak>Cetak</button>${boleh ? '<button class="tombol kedua" data-form="transfer">Transfer</button><button class="tombol kedua" data-form="keluar">Kas Keluar</button><button class="tombol" data-form="masuk">Kas Masuk</button>' : ''}`) +
    `<div class="kartu">${bp.html}<div class="alat-tabel"><select class="input" style="width:auto" data-kas>${ks.map(k => `<option value="${k.akun_kode}" ${k.akun_kode === kode ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select><span data-saldo></span></div><div data-isi></div></div>`;
  const isi = el.querySelector('[data-isi]');
  const muat = async () => {
    try {
      const n = bp.nilai(), d = await rpc('buku_akun', { p_kode: kode, p_dari: n.p_dari, p_sampai: n.p_sampai });
      let s = Number(d.awal); baris = d.baris.map(r => ({ ...r, saldo: s += Number(r.jml) }));
      el.querySelector('[data-saldo]').innerHTML = `Saldo awal ${rupiah(d.awal)} · saldo akhir ${saldoTeks(s)}`;
      isi.innerHTML = tabelHtml(kol, baris);
    } catch (e) { galat(isi, e); }
  };
  async function form(jenis) {
    const { data: ak } = await sb.from('akun').select('kode,nama,tipe,sistem').eq('aktif', true).eq('kas', false).order('kode');
    const lawan = (ak || []).filter(a => !a.sistem || ['1202', '3900'].includes(a.kode));
    modal({ judul: { masuk: 'Kas Masuk', keluar: 'Kas Keluar', transfer: 'Transfer Antar Kas' }[jenis], isi: `<form class="form-grid" onsubmit="return false"><label class="isian"><span>Tanggal <i>*</i></span><input type="date" name="tgl" required max="${hariIni()}" value="${hariIni()}"></label>
      <label class="isian"><span>${jenis === 'masuk' ? 'Masuk ke' : 'Dari'}</span><select name="kas">${opsiKas(ks, ks.find(k => k.akun_kode === kode)?.id)}</select></label>
      ${jenis === 'transfer' ? `<label class="isian"><span>Ke</span><select name="kas2">${opsiKas(ks, ks.find(k => k.jenis === 'kas')?.id)}</select></label>` : `<label class="isian"><span>Untuk / akun lawan <i>*</i></span><select name="akun" required><option value="">- pilih -</option>${lawan.map(a => `<option value="${a.kode}">${a.kode} ${esc(a.nama)}</option>`).join('')}</select></label>`}
      <label class="isian"><span>Jumlah <i>*</i></span><input type="number" name="jml" min="1" step="any" required></label><label class="isian lebar"><span>Keterangan</span><input name="ket"></label>${CEK_LACI}</form>`,
      saatBuka: m => pasangLaci(m.querySelector('form')), tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
        const f = m.querySelector('form'); if (!f.reportValidity()) return false;
        const r = await rpc('simpan_kas', { p: { jenis, tanggal: f.tgl.value, akun_kas_id: Number(f.kas.value), akun_kas_tujuan_id: f.kas2 ? Number(f.kas2.value) : null, akun_kode: f.akun?.value ?? null, jumlah: Number(f.jml.value), keterangan: f.ket.value, laci: f.laci.checked } });
        toast('Tersimpan: ' + r.no, 'sukses'); muat();
      } }] });
  }
  el.addEventListener('click', async e => {
    const f = e.target.closest('[data-form]'), b = e.target.closest('[data-batal]');
    if (f) form(f.dataset.form).catch(x => toast(pesanGalat(x), 'galat'));
    if (b && await konfirmasi('Batalkan transaksi kas', 'Transaksi ini dihapus dari pembukuan. Lanjutkan?', 'Batalkan')) try { await rpc('batal_keuangan', { p_tabel: 'kas_transaksi', p_id: Number(b.dataset.batal) }); toast('Dibatalkan'); muat(); } catch (x) { toast(pesanGalat(x), 'galat'); }
    if (e.target.closest('[data-unduh]')) unduhTabel('buku-kas', kol, baris);
    if (e.target.closest('[data-cetak]')) cetakHtml('Buku Kas ' + (ks.find(k => k.akun_kode === kode)?.nama || ''), bp.teks(), tabelHtml(kol, baris, { maks: 5000 }));
  });
  el.querySelector('[data-kas]').onchange = e => { kode = e.target.value; muat(); };
  bp.pasang(el, muat); el.querySelector('[data-outlet]')?.remove();
  await muat();
});

// ---------- Utang & Piutang ----------
const umur = r => { if (!r.jatuh_tempo) return ['Tanpa tempo', '']; const h = Math.round((new Date(r.jatuh_tempo) - new Date(hariIni())) / 864e5); return h < 0 ? [`Lewat ${-h} hari`, 'merah'] : h <= 7 ? [h === 0 ? 'Hari ini' : `${h} hari lagi`, 'oranye'] : [`${h} hari lagi`, 'hijau']; };
function halamanTagihan(piutang) {
  const K = piutang ? { judul: 'Piutang Usaha', nm: 'pelanggan', tb: 'pelanggan', kunci: 'keuangan.piutang', jenis: 'piutang', aksi: 'Terima' } : { judul: 'Utang Usaha', nm: 'supplier', tb: 'supplier', kunci: 'keuangan.utang', jenis: 'utang', aksi: 'Bayar' };
  return async el => {
    const ks = await akunKas(); let d = [], kredit = [], kons = [];
    const kol = [{ l: piutang ? 'Pelanggan' : 'Supplier', n: r => r[K.nm] || '-' }, { l: 'No.', n: r => r.no, h: r => `<span>${esc(r.no)}${r.ref ? `<br><small style="color:var(--teks-2)">${esc(r.ref)}</small>` : ''}</span>` }, { l: 'Tanggal', n: r => r.tanggal, t: 'tgl' }, { l: 'Jatuh Tempo', n: r => r.jatuh_tempo, t: 'tgl' },
      { l: 'Status', n: r => umur(r)[0], h: r => `<span class="chip ${umur(r)[1]}">${umur(r)[0]}</span>` }, { l: 'Total', n: r => r.total, t: 'uang', jml: true }, { l: 'Dibayar', n: r => r.dibayar, t: 'uang', jml: true }, { l: 'Sisa', n: r => r.sisa, t: 'uang', jml: true },
      { l: '', n: () => '', h: r => `<button class="tombol kecil" data-bayar="${r.sumber}:${r.id}">${K.aksi}</button>${r.sumber === 'awal' && Number(r.dibayar) === 0 ? `<button class="ikon-aksi hapus" data-hapus-awal="${r.id}" title="Batalkan saldo awal">${ikon('hapus')}</button>` : ''}` }];
    const form = (t, jenis) => {
      const kr = jenis === 'utang' ? kredit.filter(k => k.supplier_id === t.supplier_id) : [];
      modal({ judul: `${K.aksi} ${t.no || 'konsinyasi'} · ${t[K.nm] || ''}`, isi: `<p style="margin-top:0">Sisa tagihan <b>${rupiah(t.sisa)}</b></p><form class="form-grid" onsubmit="return false"><label class="isian"><span>Tanggal</span><input type="date" name="tgl" required max="${hariIni()}" value="${hariIni()}"></label>
        <label class="isian"><span>${piutang ? 'Masuk ke' : 'Dibayar dari'}</span><select name="kas">${opsiKas(ks, ks.find(k => k.jenis === (piutang ? 'kasir' : 'kas'))?.id)}${kr.map(k => `<option value="r${k.id}">Kredit retur ${esc(k.no)} (${rupiah(k.sisa)})</option>`).join('')}</select></label>
        <label class="isian"><span>Jumlah</span><input type="number" name="jml" min="1" step="any" max="${t.sisa}" required value="${t.sisa}"></label><label class="isian"><span>Keterangan</span><input name="ket" placeholder="mis. no. transfer"></label>${CEK_LACI}</form>`,
        saatBuka: m => { const f = m.querySelector('form'); pasangLaci(f); f.kas.addEventListener('change', () => { const k = kr.find(x => 'r' + x.id === f.kas.value); if (k) f.jml.value = Math.min(Number(t.sisa), Number(k.sisa)); }); },
        tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => {
          const f = m.querySelector('form'); if (!f.reportValidity()) return false; const ret = f.kas.value.startsWith('r');
          const r = await rpc('bayar_usaha', { p: { jenis, sumber: t.sumber || null, id: t.id ?? null, supplier_id: t.supplier_id ?? null, retur_id: ret ? Number(f.kas.value.slice(1)) : null, akun_kas_id: ret ? null : Number(f.kas.value), jumlah: Number(f.jml.value), tanggal: f.tgl.value, keterangan: f.ket.value, laci: f.laci.checked } });
          toast('Tersimpan: ' + r.no, 'sukses'); muat();
        } }] });
    };
    const formAwal = async () => {
      const kontak = await ambilRef(K.tb);
      modal({ judul: 'Saldo Awal ' + (piutang ? 'Piutang' : 'Utang'), isi: `<p style="margin-top:0">Untuk tagihan lama sebelum memakai aplikasi ini.</p><form class="form-grid" onsubmit="return false"><label class="isian"><span>${piutang ? 'Pelanggan' : 'Supplier'} <i>*</i></span><select name="kontak" required><option value="">- pilih -</option>${kontak.map(k => `<option value="${k.id}">${esc(k.nama)}</option>`).join('')}</select></label>
        <label class="isian"><span>Tanggal</span><input type="date" name="tgl" required max="${hariIni()}" value="${hariIni()}"></label><label class="isian"><span>Jatuh tempo</span><input type="date" name="jt"></label><label class="isian"><span>Jumlah</span><input type="number" name="jml" min="1" step="any" required></label><label class="isian lebar"><span>No. faktur lama / keterangan</span><input name="ket"></label></form>`,
        tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { const f = m.querySelector('form'); if (!f.reportValidity()) return false;
          await rpc('simpan_saldo_awal', { p: { jenis: K.jenis, kontak_id: Number(f.kontak.value), tanggal: f.tgl.value, jatuh_tempo: f.jt.value || null, jumlah: Number(f.jml.value), keterangan: f.ket.value } }); toast('Tersimpan', 'sukses'); muat(); } }] });
    };
    const muat = async () => {
      try {
        const r = await rpc(piutang ? 'daftar_piutang' : 'daftar_utang');
        d = piutang ? r : r.utang; kredit = piutang ? [] : r.kredit; kons = piutang ? [] : r.konsinyasi;
        const { data: riw, error } = await sb.from('pembayaran_usaha').select('*, supplier:supplier_id(nama), pelanggan:pelanggan_id(nama), kas:akun_kas_id(nama), retur:retur_id(no)').eq('outlet_id', S.pengguna.outlet_id).in('jenis', piutang ? ['piutang'] : ['utang', 'konsinyasi']).order('id', { ascending: false }).limit(100);
        if (error) throw error;
        const jml = f => d.filter(f).reduce((a, x) => a + Number(x.sisa), 0), h = hariIni(), st = (l, v, w) => `<div class="statistik"><small>${l}</small><b style="color:${w && v > 0 ? w : 'inherit'}">${rupiah(v)}</b></div>`;
        el.innerHTML = judulHalaman(K.judul, 'Keuangan / ' + K.judul, `<button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh</button><button class="tombol kedua" data-awal>Saldo Awal</button>`) +
          `<div class="kartu" style="margin-bottom:16px"><div class="grid-4">${st('Total sisa', jml(() => true))}${st('⚠ Lewat jatuh tempo', jml(x => x.jatuh_tempo && x.jatuh_tempo < h), 'var(--merah)')}${piutang ? '' : st('Kredit retur', kredit.reduce((a, x) => a + Number(x.sisa), 0)) + st('Utang konsinyasi', kons.reduce((a, x) => a + Number(x.sisa), 0))}</div></div>
          <div class="kartu">${tabelHtml(kol, d, { kosong: 'Tidak ada tagihan yang belum lunas.' })}${piutang ? '<p style="color:var(--teks-2);font-size:13px">Batas kredit per pelanggan diatur di Kontak → Pelanggan. Tanpa batas kredit, pelanggan tidak bisa membeli secara kredit.</p>' : ''}</div>
          ${kons.length ? `<div class="kartu"><h3>Barang konsinyasi yang sudah laku</h3>${tabelHtml([{ l: 'Penitip', n: r => r.supplier }, { l: 'Harus dibayar', n: r => r.sisa, t: 'uang', jml: true }, { l: '', n: () => '', h: r => r.sisa > 0 ? `<button class="tombol kecil" data-kons="${r.supplier_id}">Bayar</button>` : '' }], kons)}</div>` : ''}
          <div class="kartu"><h3>Riwayat pembayaran (100 terakhir)</h3>${tabelHtml([{ l: 'Tanggal', n: r => r.tanggal, t: 'tgl' }, { l: 'No.', n: r => r.no }, { l: 'Nama', n: r => r.supplier?.nama || r.pelanggan?.nama || '-' }, { l: 'Lewat', n: r => r.kas?.nama || 'Kredit retur ' + (r.retur?.no || '') }, { l: 'Jumlah', n: r => r.jumlah, t: 'uang' }, { l: 'Keterangan', n: r => r.keterangan },
            { l: '', n: () => '', h: r => r.status === 'batal' ? '<span class="chip merah">Batal</span>' : `<button class="ikon-aksi hapus" data-batal="${r.id}" title="Batalkan">${ikon('hapus')}</button>` }], riw, { kosong: 'Belum ada pembayaran.' })}</div>`;
      } catch (e) { galat(el, e); }
    };
    el.addEventListener('click', async e => {
      const q = s => e.target.closest(s), b = q('[data-bayar]'), k = q('[data-kons]'), x = q('[data-batal]'), a = q('[data-hapus-awal]');
      if (b) { const [s, id] = b.dataset.bayar.split(':'); form(d.find(t => t.sumber === s && t.id === Number(id)), K.jenis); }
      if (k) form(kons.find(t => t.supplier_id === Number(k.dataset.kons)), 'konsinyasi');
      if (q('[data-awal]')) formAwal().catch(z => toast(pesanGalat(z), 'galat'));
      if (q('[data-unduh]')) unduhTabel(K.judul.toLowerCase().replace(' ', '-'), kol, d);
      if ((x || a) && await konfirmasi('Batalkan', x ? 'Batalkan pembayaran ini? Sisa tagihan akan kembali bertambah.' : 'Batalkan saldo awal ini?', 'Batalkan')) try { await rpc('batal_keuangan', { p_tabel: x ? 'pembayaran_usaha' : 'saldo_awal', p_id: Number(x ? x.dataset.batal : a.dataset.hapusAwal) }); toast('Dibatalkan'); muat(); } catch (z) { toast(pesanGalat(z), 'galat'); }
    });
    await muat();
  };
}
rute('keuangan/utang', halamanTagihan(false));
rute('keuangan/piutang', halamanTagihan(true));
