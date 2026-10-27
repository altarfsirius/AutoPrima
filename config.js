/* Altair Auto — konfigurasi koneksi OPSIONAL (berkas ini sejajar dengan index.html).
   Bila diisi, setiap perangkat langsung terhubung ke database Anda tanpa mengisi "Connect to Database".
   Biarkan kosong untuk tetap mengisi manual sekali per perangkat.

   KEAMANAN — baca dulu: nilai di sini TERLIHAT oleh siapa pun yang bisa membuka alamat aplikasi Anda
   (GitHub Pages dari repositori publik = publik). Publishable key memang dirancang publik, tetapi data Anda
   hanya terlindungi bila RLS ketat sudah dijalankan (Settings → langkah 41 dan hardening: login wajib, akun disetujui admin).
   Isi hanya bila (a) hardening itu sudah berjalan, atau (b) repositori/hosting Anda privat.
   JANGAN pernah mengisi kunci service_role atau password di sini (aplikasi menolaknya).

   Contoh:
   window.ALTAIR_CONFIG = { url: 'https://xxxx.supabase.co', key: 'sb_publishable_...' };
*/
window.ALTAIR_CONFIG = { url: '', key: '' };
