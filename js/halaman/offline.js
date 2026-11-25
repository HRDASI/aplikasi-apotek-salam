// Mode Offline & Sinkron: status perangkat, antrean, cadangan, daftar periksa, dan beranda saat offline.
import { rute, sb, S, bisa, KONEKSI } from '../inti.js?v=1.14.0';
import { ikon } from '../menu.js?v=1.14.0';
import { esc, angka, rupiah, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.14.0';
import * as OFF from '../offline.js?v=1.14.0';

const JENIS = { jual: 'Penjualan', resep: 'Resep', sesi_buka: 'Buka sesi', sesi_tutup: 'Tutup sesi' };
const tabelAntre = a => a.length ? `<div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Data</th><th>Waktu</th><th>Oleh</th><th class="angka">Nilai</th><th>Status</th></tr></thead><tbody>${a.map(x => `<tr><td data-label="Data"><b>${JENIS[x.jenis]}</b>&nbsp;${esc(x.data.no_offline || '')}</td>
  <td data-label="Waktu">${waktu(x.waktu)}</td><td data-label="Oleh">${esc(x.pengguna_nama)}</td><td data-label="Nilai" class="angka">${x.jenis === 'jual' ? rupiah(x.data.hasil.total) : x.jenis === 'sesi_tutup' ? rupiah(x.data.kas_fisik) : ''}</td>
  <td data-label="Status">${x.pesan ? `<span class="chip merah">${esc(x.pesan)}</span>` : '<span class="chip oranye">Menunggu internet</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="aman-semua">✓ Semua data sudah tersinkron.</p>';

rute('pengaturan/offline', async el => {
  const bolehAtur = bisa('pengaturan.perangkat');
  const gambar = async () => {
    const p = OFF.perangkat(), antre = await OFF.daftarAntre(), tetap = await OFF.penyimpananTetap();
    el.innerHTML = judulHalaman('Mode Offline & Sinkron', 'Pengaturan / Mode Offline') + `
      <div class="kartu"><h3>Perangkat ini</h3>${!p ? '<p class="pesan peringatan">Perangkat ini <b>belum ditandai</b> untuk offline.</p>' : !p.aktif ? '<p class="pesan galat">Perangkat ini dinonaktifkan untuk offline. Data yang masih antre tetap akan dikirim.</p>'
        : `<p class="pesan info">✓ <b>${esc(p.nama)}</b> siap dipakai offline. Data terakhir diperbarui ${OFF.waktuData() ? waktu(OFF.waktuData()) : '-'}.</p>`}
        ${p?.aktif ? `<p class="pesan ${tetap ? 'info' : 'peringatan'}">${tetap ? '✓ Browser menjaga data ini dari pembersihan otomatis.' : 'Browser belum menjamin data ini. <b>Pasang aplikasi ke layar utama</b> (menu browser → Instal aplikasi), lalu buka dari ikonnya.'} Jangan hapus data situs secara manual selama masih ada antrean.</p>` : ''}
        <div class="judul-halaman" style="margin:0">${bolehAtur && !KONEKSI.putus ? `<button class="tombol" data-daftar>${p ? 'Daftarkan ulang / ganti nama' : 'Tandai perangkat ini'}</button>` : !p ? '<span>Minta Pemilik menandai perangkat ini.</span>' : ''}${p?.aktif && !KONEKSI.putus ? '<button class="tombol kedua" data-segar>Perbarui data sekarang</button>' : ''}</div></div>
      <div class="kartu"><div class="kepala-blok"><h3>Menunggu dikirim (${antre.length})</h3></div>${tabelAntre(antre)}
        <div class="judul-halaman" style="margin:12px 0 0">${antre.length ? `<button class="tombol" data-kirim ${KONEKSI.putus ? 'disabled' : ''}>Kirim sekarang</button><button class="tombol kedua" data-unduh>${ikon('unduh')} Unduh cadangan</button>` : ''}<label class="tombol kedua" style="cursor:pointer">Pulihkan cadangan<input type="file" accept="application/json,.json" hidden data-pulih></label></div>
        <p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Di PC kasir, setiap transaksi offline juga disalin ke berkas lewat Agen Cetak dan dipulihkan otomatis bila data browser hilang. Di HP, unduh cadangan bila offline lama.</p></div>
      <div data-online></div>`;
    if (KONEKSI.putus) return;
    const w = el.querySelector('[data-online]');
    if (bisa('penjualan.batal')) {
      const { data } = await sb.from('penjualan').select('id,no,no_offline,waktu,pengguna_nama,total,periksa').eq('outlet_id', S.pengguna.outlet_id).not('periksa', 'is', null).order('waktu', { ascending: false }).limit(200);
      w.insertAdjacentHTML('beforeend', `<div class="kartu"><h3>Perlu diperiksa (${data?.length || 0})</h3>${data?.length ? `<div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Nota</th><th>Waktu</th><th>Kasir</th><th class="angka">Total</th><th>Catatan</th><th></th></tr></thead><tbody>${data.map(r => `<tr><td data-label="Nota"><b>${esc(r.no)}</b>&nbsp;${esc(r.no_offline || '')}</td><td data-label="Waktu">${waktu(r.waktu)}</td><td data-label="Kasir">${esc(r.pengguna_nama)}</td><td data-label="Total" class="angka">${rupiah(r.total)}</td><td data-label="Catatan">${esc(r.periksa)}</td><td class="aksi"><button class="tombol kecil" data-selesai="${r.id}">Sudah diperiksa</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="aman-semua">✓ Tidak ada.</p>'}</div>`);
    }
    if (bolehAtur) {
      const { data } = await sb.from('perangkat').select('*').order('dibuat');
      w.insertAdjacentHTML('beforeend', `<div class="kartu"><h3>Semua perangkat offline</h3>${data?.length ? `<div class="bungkus-tabel"><table class="tabel kartu-hp"><thead><tr><th>Nama</th><th>Didaftarkan</th><th>Terakhir online</th><th>Status</th><th></th></tr></thead><tbody>${data.map(r => `<tr><td data-label="Nama"><b>${esc(r.nama)}</b>${r.id === p?.id ? '&nbsp;(ini)' : ''}</td><td data-label="Oleh">${esc(r.didaftarkan_nama || '')}</td><td data-label="Terakhir">${waktu(r.terakhir)}</td><td data-label="Status"><span class="chip ${r.aktif ? 'hijau' : 'merah'}">${r.aktif ? 'Aktif' : 'Nonaktif'}</span></td><td class="aksi"><button class="tombol kedua kecil" data-atur="${r.id}:${r.aktif ? 0 : 1}">${r.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="kosong">Belum ada.</p>'}<p style="color:var(--teks-2);font-size:13px">Bila HP hilang: nonaktifkan di sini. Data di HP itu terhapus saat tersambung internet, dan login offline habis sendiri setelah 3 hari.</p></div>`);
    }
  };
  el.addEventListener('click', async e => {
    const q = s => e.target.closest(s), coba = async f => { try { await f(); } catch (x) { toast(pesanGalat(x), 'galat'); } };
    if (q('[data-daftar]')) modal({ judul: 'Tandai perangkat untuk offline', ukuran: 'kecil', isi: `<p style="margin-top:0">Daftar produk, harga, dan nama/no. HP pelanggan akan disimpan di perangkat ini. Pakai hanya di perangkat milik apotek.</p><form onsubmit="return false"><label class="isian"><span>Nama perangkat</span><input name="n" required value="${esc(OFF.perangkat()?.nama || '')}" placeholder="mis. PC Kasir 1"></label></form>`,
      tombol: [{ teks: 'Batal', kelas: 'kedua' }, { teks: 'Simpan', aksi: async m => { if (!m.querySelector('form').reportValidity()) return false; await OFF.daftarkan(m.querySelector('[name=n]').value.trim()); OFF.mulaiOffline(); toast('Perangkat siap. Setiap karyawan perlu login online sekali di sini.', 'sukses'); gambar(); } }] });
    if (q('[data-segar]')) await coba(async () => { toast('Memperbarui data...'); await OFF.unduhData(true); toast('Data diperbarui', 'sukses'); gambar(); });
    if (q('[data-kirim]')) await coba(async () => { await OFF.sinkron(true); gambar(); });
    if (q('[data-unduh]')) await coba(OFF.unduhCadangan);
    const a = q('[data-atur]'), s = q('[data-selesai]');
    if (a && await konfirmasi('Perangkat', a.dataset.atur.endsWith('0') ? 'Nonaktifkan perangkat ini dari mode offline?' : 'Aktifkan lagi?', 'Ya')) await coba(async () => { const [id, n] = a.dataset.atur.split(':'); const { error } = await sb.rpc('atur_perangkat', { p_id: id, p_aktif: n === '1' }); if (error) throw error; await OFF.periksaPerangkat(); gambar(); });
    if (s) await coba(async () => { const { error } = await sb.rpc('selesai_periksa', { p_id: Number(s.dataset.selesai) }); if (error) throw error; toast('Ditandai sudah diperiksa', 'sukses'); gambar(); });
  });
  el.addEventListener('change', async e => { if (e.target.matches('[data-pulih]') && e.target.files[0]) try { const n = await OFF.pulihkanBerkas(e.target.files[0]); toast(n ? `${n} data dipulihkan` : 'Tidak ada data baru', 'sukses'); gambar(); } catch (x) { toast(pesanGalat(x), 'galat'); } });
  await gambar();
});

// Beranda saat tidak ada internet
export async function berandaOffline(el) {
  const antre = await OFF.daftarAntre(), hari = new Date().toDateString(), jual = antre.filter(a => a.jenis === 'jual' && new Date(a.waktu).toDateString() === hari);
  el.innerHTML = `<div class="sapaan" style="display:flex"><div><h2>Mode offline</h2><p>Pelayanan tetap jalan. Data terkirim otomatis saat internet kembali.</p><div class="aksi-cepat"><a href="#/penjualan/kasir">${ikon('kasir')} Buka Kasir</a>${bisa('pelayanan.penerimaan_resep') ? `<a href="#/pelayanan/penerimaan_resep/baru">${ikon('pelayanan')} Resep Baru</a>` : ''}</div></div></div>
    <div class="kartu blok"><div class="angka-utama"><div><small>Penjualan offline hari ini (perangkat ini)</small><b>${rupiah(jual.reduce((a, x) => a + x.data.hasil.total, 0))}</b></div><div><small>Transaksi</small><b>${angka(jual.length)}</b></div><div><small>Menunggu dikirim</small><b>${angka(antre.length)}</b></div></div></div>
    <div class="kartu blok"><h3>Cek harga & stok</h3><input class="input input-besar" data-cek placeholder="Nama / kode / scan barcode"><div data-hasil style="margin-top:10px"></div><p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Data per ${OFF.waktuData() ? waktu(OFF.waktuData()) : '-'}; penjualan di perangkat lain belum ikut terhitung.</p></div>`;
  el.querySelector('[data-cek]').oninput = e => { el.querySelector('[data-hasil]').innerHTML = OFF.adaData() ? OFF.cariProdukL(e.target.value, 20).map(p => `<div class="baris-total"><span><b>${esc(p.nama)}</b> ${esc(p.kode || '')}</span><span>${rupiah(p.harga_jual)} · stok ${angka(p.stok)} ${esc(p.satuan?.nama || '')}</span></div>`).join('') : 'Data belum ada.'; };
}
