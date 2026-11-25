// Cadangan Data: status cadangan otomatis ke Google Drive, kunci, dan permintaan manual.
import { rute } from '../inti.js?v=1.19.0';
import { esc, angka, waktu, toast, modal, konfirmasi, pesanGalat, judulHalaman } from '../ui.js?v=1.19.0';
import { rpc, tabelHtml } from '../tabel.js?v=1.19.0';

const galat = (el, e) => { el.innerHTML = `<div class="kartu"><p class="pesan galat">${esc(pesanGalat(e))}</p></div>`; };
const ukuran = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : angka(Math.round(b / 1024)) + ' KB';
const ST = { selesai: ['Tersimpan', 'hijau'], siap: ['Siap, menunggu Google', 'oranye'], diminta: ['Disiapkan', 'oranye'], gagal: ['Gagal', 'merah'] };
rute('pengaturan/cadangan', async el => {
  let tunda;
  const muat = async () => {
    clearTimeout(tunda);
    let s; try { s = await rpc('status_cadangan'); } catch (e) { return galat(el, e); }
    const pesan = !s.kunci ? ['peringatan', 'Cadangan belum aktif. Buat kunci di bawah, lalu pasang di Google Sheet <b>Cadangan Apotek Salam</b>: menu <b>Cadangan → Pasang kunci &amp; mulai</b>.']
      : s.terlambat ? ['galat', 'Belum ada cadangan baru lebih dari 14 jam. Cek Google Sheet <b>Cadangan Apotek Salam</b> → menu Cadangan → Lihat status.']
        : !s.terhubung ? ['peringatan', 'Kunci sudah dibuat, tetapi belum dipasang di Google Sheet.'] : s.terakhir ? ['info', '✓ Cadangan terakhir: <b>' + waktu(s.terakhir) + '</b>'] : ['info', 'Terhubung. Menunggu cadangan pertama.'];
    el.innerHTML = judulHalaman('Cadangan Data', 'Pengaturan / Cadangan Data', `<button class="tombol kedua" data-muat>Muat ulang</button>${s.kunci ? '<button class="tombol" data-minta>Cadangkan sekarang</button>' : ''}`) + `
      <div class="kartu"><p class="pesan ${pesan[0]}" style="margin-top:0">${pesan[1]}</p><p style="margin:0">Disimpan ke Google Drive akun HRD setiap hari pukul 10.00, 13.00, 16.00, 19.00 (7 hari) dan 22.00 (30 hari, akhir bulan 12 bulan). Berkas masuk paling lambat sekitar 15 menit kemudian.</p>
        <p style="color:var(--teks-2);font-size:13px;margin-bottom:0">Isinya data pelanggan, gaji, dan penjualan: foldernya jangan dibagikan. Sandi login dan kunci integrasi tidak ikut dicadangkan.</p></div>
      ${s.pemilik ? `<div class="kartu"><h3 style="margin-top:0">Kunci cadangan</h3><p>${s.kunci ? 'Dibuat ' + waktu(s.kunci) + (s.terhubung ? ', terakhir dipakai ' + waktu(s.terhubung) : ', belum dipakai') + '.' : 'Belum ada.'} Kunci hanya bisa membaca data dan hanya tampil sekali.</p><button class="tombol kedua" data-kunci>${s.kunci ? 'Ganti kunci' : 'Buat kunci'}</button></div>` : ''}
      <div class="kartu"><h3 style="margin-top:0">Riwayat</h3>${tabelHtml([{ l: 'Waktu', n: r => r.dibuat, h: r => waktu(r.dibuat) }, { l: 'Jenis', n: r => ({ siang: 'Siang', malam: 'Malam', manual: 'Manual' })[r.jenis] }, { l: 'Status', n: r => r.status, h: r => `<span class="chip ${ST[r.status][1]}">${ST[r.status][0]}</span>` }, { l: 'Baris', n: r => r.baris, t: 'angka' }, { l: 'Ukuran berkas', n: r => ukuran(r.ukuran_file) }, { l: 'Oleh', n: r => r.oleh }, { l: 'Catatan', n: r => r.pesan }], s.riwayat, { kosong: 'Belum ada cadangan.' })}</div>`;
    el.querySelector('[data-kunci]')?.addEventListener('click', async () => {
      if (s.kunci && !await konfirmasi('Ganti kunci?', 'Kunci lama langsung tidak berlaku. Cadangan berhenti sampai kunci baru dipasang di Google Sheet.', 'Ganti', '')) return;
      let k; try { k = await rpc('buat_kunci_cadangan'); } catch (x) { return toast(pesanGalat(x), 'galat'); }
      modal({ judul: 'Kunci cadangan', ukuran: 'kecil', isi: `<p style="margin-top:0">Tempel di Google Sheet <b>Cadangan Apotek Salam</b> → Cadangan → Pasang kunci &amp; mulai. Jangan dikirim lewat chat atau WA.</p><input class="input" readonly value="${esc(k)}" onfocus="this.select()">`, tombol: [{ teks: 'Salin', aksi: async () => { try { await navigator.clipboard.writeText(k); toast('Kunci disalin', 'sukses'); } catch { toast('Pilih lalu salin manual', 'galat'); } return false; } }, { teks: 'Selesai', kelas: 'kedua' }] });
      muat();
    });
    if (s.riwayat.some(r => ['diminta', 'siap'].includes(r.status))) tunda = setTimeout(() => { if (el.isConnected && location.hash.startsWith('#/pengaturan/cadangan') && !document.querySelector('.latar-modal')) muat(); }, 15000);      // status berubah sendiri
    el.querySelector('[data-muat]').onclick = muat;
    el.querySelector('[data-minta]')?.addEventListener('click', async e => { e.target.disabled = true; try { await rpc('minta_cadangan'); toast('Disiapkan. Masuk ke Drive dalam ±15 menit.', 'sukses'); } catch (x) { toast(pesanGalat(x), 'galat'); } muat(); });
  };
  await muat();
});
