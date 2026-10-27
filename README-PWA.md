# Altair Auto sebagai PWA — panduan hosting dan pemakaian

Status: **lulus uji lokal** (Chrome: manifest, ikon, service worker, installability tanpa galat; buka offline; pembaruan versi). **Belum di-hosting oleh saya**; PWA hanya bisa dipasang bila halaman dibuka lewat HTTPS (atau `localhost`).

## Isi paket (semua sejajar, satu tingkat, tanpa subfolder)

Susunan ini sama dengan repositori GitHub Anda: berkas aplikasi, manifest, service worker, dan gambar/ikon berada di satu tingkat.

| Berkas | Fungsi |
|---|---|
| `index.html` | Aplikasi, tanpa URL/kunci Supabase tertanam (versi dengan kunci tertanam untuk pemakaian sendiri: `index.html` di folder utama keluaran) |
| `manifest.webmanifest` | Nama, ikon, mode standalone, bahasa |
| `sw.js` | Service worker: menyimpan cangkang aplikasi agar terbuka offline |
| `icon-192.png`, `icon-512.png`, `maskable-512.png` | Ikon aplikasi (manifest merujuk langsung ke berkas ini) |
| `apple-touch-icon-180.png` | Ikon iPhone/iPad (dirujuk `index.html`) |
| `apple-touch-icon.png` | Salinan yang sama; iOS otomatis memintanya di `/apple-touch-icon.png` — wajib ikut diunggah |
| `config.js` | **Opsional.** Isi `url` dan `key` Supabase agar setiap perangkat langsung terhubung tanpa mengisi "Connect to Database". Bawaannya kosong. Baca peringatan keamanan di dalamnya |
| `404.html` | Halaman "tidak ditemukan" yang juga mengalihkan tautan nama lama (berguna di GitHub Pages) |
| `autoprima.html`, `aldebaracura.html`, `aldebarancura.html`, `identifikasi-kendaraan.html` | Pengalih tautan nama lama ke `index.html` |
| `opsional-host-lain/` | `_headers`, `_redirects`, `vercel.json` — hanya bila memakai Cloudflare Pages, Netlify, atau Vercel; salin isinya ke akar hosting itu. **GitHub Pages tidak memerlukannya.** |

Di repositori Anda, `icon.svg`, `index.ts`, dan `manifest.json` lama tidak dipakai oleh `index.html` ini (yang dirujuk adalah `manifest.webmanifest` dan ikon PNG di atas); simpan atau hapus sesuai kebutuhan Anda.

## Penting sebelum hosting (keamanan)

- Aplikasi asli menanam URL dan kunci publishable tiga proyek Supabase (utama, Tuntas, Groundwork). **Di paket ini nilai itu dikosongkan.** Alasannya: database masih memakai kebijakan RLS prototipe (akses anon terbuka), jadi siapa pun yang punya URL proyek dan kunci itu bisa membaca dan menulis data. Dengan paket ini URL hosting yang bocor tidak otomatis membuka database Anda.
- Pada pemakaian pertama di tiap perangkat, popup awal meminta **Connect to Database**: isi Project URL dan Publishable key, lalu Connect. Setelah itu muncul popup **Login** / **Create New Account**. Nilai koneksi disimpan di perangkat (localStorage). Pengaturan Tuntas dan Groundwork diisi sekali di kartu masing-masing (Settings, hanya admin).
- Login wajib. Akun baru menunggu persetujuan admin; panduan akun, admin, dan fasilitas ada di `akun-admin/README-AKUN.md`. **Popup login saja bukan pengaman data**: database baru benar-benar menolak akun tanpa izin bila `akun-admin/sql/rls_fasilitas_optin.sql` dijalankan.
- Di Supabase (Authentication → URL Configuration) tambahkan alamat hosting ini ke *Site URL* dan *Redirect URLs* agar tautan konfirmasi email dan reset password kembali ke aplikasi.
- Disarankan sebelum membagikan alamatnya: jalankan hardening RLS dan login (Settings), atau taruh hosting di belakang kata sandi (Cloudflare Access, proteksi sandi Netlify, atau repositori privat).

## Hosting (pilih salah satu; semuanya gratis dan HTTPS otomatis)

**Cloudflare Pages (mendukung `_headers`; salin dulu isi `opsional-host-lain/` ke akar)**
1. dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets.
2. Beri nama proyek, unggah isi folder `altair-auto-pwa` (bukan foldernya, tetapi isinya), lalu Deploy.
3. Buka alamat `https://<nama>.pages.dev`.

**Netlify**
1. app.netlify.com/drop, seret folder `altair-auto-pwa`.
2. Buka alamat yang diberikan.

**GitHub Pages**
1. Unggah semua berkas di folder ini ke akar repositori (sejajar, seperti `index.html` dan `sw.js` Anda sekarang), lalu Settings → Pages → Deploy from branch.
2. `_headers` tidak didukung di sini; `sw.js` tetap bekerja, hanya cache bisa terasa lebih lama saat memperbarui. Tautan nama lama dengan huruf besar ditangani `404.html`.

Aplikasi harus berada di akar atau subfolder dengan semua berkas sejajar; jalur manifest dan service worker bersifat relatif.

## Memasang di perangkat

- **iPhone/iPad:** buka alamatnya di Safari → tombol Bagikan → Tambahkan ke Layar Utama. Penyimpanan aplikasi terpasang terpisah dari Safari, jadi isi Project URL dan key sekali lagi.
- **Android (Chrome):** muncul tombol Install app di Settings → Aplikasi (PWA), atau menu ⋮ → Instal aplikasi.
- **Windows/Mac (Chrome atau Edge):** ikon pasang di bilah alamat, atau Settings → Aplikasi (PWA) → Install app.

## Yang bisa dan tidak bisa saat offline

- Bisa: membuka tampilan aplikasi bila sebelumnya pernah login di perangkat ini (hak akses terakhir disimpan 7 hari di perangkat; hanya untuk tampilan). Penanda kuning "Offline" muncul di atas. Tanpa login sebelumnya, atau tanpa hak akses tersimpan, aplikasi tetap terkunci.
- Tidak bisa: memuat atau menyimpan data database, sinkronisasi Polaris One, Tuntas/Groundwork, dan impor dari web. Data tidak pernah disimpan di cache aplikasi; hanya cangkang dan pustaka statis (supabase-js, font).
- Pustaka dari CDN baru tersimpan setelah dibuka sekali saat online.

## Memperbarui aplikasi

1. Ganti `index.html` (dan berkas lain bila berubah) di hosting.
2. Naikkan `VERSION` di `sw.js` (misalnya `2026-11-02-r1`) agar cache cangkang lama dibuang.
3. Pengguna melihat pemberitahuan "Versi baru siap" → Muat ulang. Manual: Settings → Aplikasi (PWA) → Check for update.
4. Masalah tampilan lama: Settings → Aplikasi (PWA) → Clear offline cache, lalu muat ulang saat online.

## Batasan

- Mode offline hanya untuk tampilan; belum ada antrean tulis offline atau salinan data lokal.
- Pada Safari non-terpasang, iOS dapat menghapus cache situs yang lama tidak dibuka.
- Notifikasi push dan sinkron latar belakang tidak termasuk.

## Tautan nama lama (AutoPrima, AldebaranCura, versi awal)

Nama aplikasi sekarang **Altair Auto**. Tautan yang masih memakai nama lama tetap bekerja:

- **Hosting statis (semua jenis):** berkas pengalih `autoprima.html`, `aldebaracura.html`, `aldebarancura.html`, dan `identifikasi-kendaraan.html` mengarahkan ke `index.html` dengan query string dan fragmen (`?...#...`) tetap utuh.
- **Netlify / Cloudflare Pages:** `opsional-host-lain/_redirects` (301) untuk nama-nama itu, dengan atau tanpa `.html`, termasuk `AutoPrima` dan `AldebaranCura` berhuruf besar (hosting membedakan huruf besar-kecil).
- **Vercel:** `opsional-host-lain/vercel.json` berisi pengalihan permanen yang sama.
- **Service worker (`sw.js`):** pengunjung yang sudah memasang aplikasi dialihkan di perangkatnya sendiri walau server tidak punya berkas itu; cache bernama lama (`autoprima*`, `aldebaracura*`, `aldebarancura*`, `identifikasi*`) dihapus saat versi baru aktif.
- **GitHub Pages:** `404.html` mengalihkan jalur lama (huruf besar/kecil apa pun) ke `index.html` dengan query dan fragmen utuh.
- **PWA yang sudah terpasang:** `id`, `start_url`, dan `scope` tidak berubah, jadi ikon yang terpasang tetap dipakai; namanya ikut menjadi Altair Auto saat manifest diperbarui.
- **Backup lama:** berkas backup bertanda `AldebaranCura` atau `AutoPrima` tetap bisa dipulihkan; backup baru bertanda `Altair Auto`.
- **Fungsi Edge:** `altair-hub` dan `altair-hub-push`; alamat lama `cura-hub` tetap dilayani bila kode yang sama di-deploy juga dengan nama itu (lihat `polaris-hub/README.md`).

## Pindah dari susunan lama (ikon di subfolder `icons/`)

Ikon kini sejajar. Setelah mengunggah paket ini, hapus folder `icons/` lama di hosting. Service worker versi baru (`2026-10-27-r7`) membuang cache lama otomatis; pengguna yang sudah memasang aplikasi akan melihat "Versi baru siap".

## Tidak ingin mengisi "Connect to Database" lagi

Aplikasi menyimpan Project URL dan Publishable key di perangkat; logout tidak menghapusnya. Bila iPhone/iPad memintanya lagi, hampir pasti iOS yang menghapus penyimpanan situs (tab Safari dan ikon Layar Utama memakai penyimpanan terpisah; Safari membersihkan situs yang tidak dibuka ± 7 hari). Pilihan, dari yang paling aman:

1. **Pasang ke Layar Utama dan selalu buka dari ikon itu.** Aplikasi terpasang tidak terkena pembersihan 7 hari. Isi sekali di dalam aplikasi terpasang.
2. **Cadangan otomatis.** Koneksi kini juga disalin ke IndexedDB dan penyimpanan persisten diminta; bila localStorage saja yang dihapus, koneksi pulih sendiri. (Bila iOS menghapus seluruh penyimpanan situs sekaligus, ini tidak menolong.)
3. **Tautan penyiapan.** Settings → Connections → Database → **Salin tautan penyiapan**. Tautan itu (`…#cfg=…`) memuat URL dan key; membukanya, atau menempelkannya di kolom Project URL pada gerbang Connect, mengisi keduanya sekaligus. Bagian `#…` tidak dikirim ke server hosting. Simpan tautan secara pribadi (catatan pribadi/pengelola kata sandi).
4. **`config.js` (tanpa mengisi di perangkat mana pun).** Isi `window.ALTAIR_CONFIG = { url:'…', key:'…' }`. Nilai ini **terlihat oleh siapa pun yang bisa membuka alamat aplikasi**; pakai hanya bila RLS ketat/hardening dan login sudah berjalan, atau repositori/hosting privat. Perubahan `config.js` diterapkan sekali per perubahan, jadi pilihan manual di Settings tidak ditimpa tiap muat. Kunci service_role ditolak.


## Ikon tidak tampil di Layar Utama iPhone
Penyebab: iOS **mengabaikan ikon berbentuk `data:` URI**; ikon harus berupa berkas PNG sungguhan yang bisa diunduh dari situs. Versi paket ini memakai berkas (`apple-touch-icon-180.png`, `apple-touch-icon.png`, `icon-192.png`). Langkah: (1) unggah **semua** berkas termasuk `apple-touch-icon.png`; (2) buka situs di **Safari** (bukan browser di dalam aplikasi lain); (3) **hapus pintasan lama** dari Layar Utama lalu Bagikan → Tambah ke Layar Utama lagi — iOS menyimpan ikon saat pintasan dibuat, jadi pintasan lama tidak berubah sendiri.
