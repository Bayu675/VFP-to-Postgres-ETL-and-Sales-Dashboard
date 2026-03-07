Berikut adalah dokumentasi yang telah diperbarui secara komprehensif, mencakup arsitektur terbaru, penambahan fitur Bulk Search (Picking Gudang), strategi Export Excel ganda, serta penanganan anomali data legacy.

📊 VFP to Postgres ETL & Sales Dashboard
🚀 Overview

Sistem ini adalah jembatan (ETL) yang mengekstrak data dari sistem legacy Visual FoxPro (.DBF) ke dalam database relasional modern (PostgreSQL), dan menampilkannya dalam bentuk Web Dashboard (React) berskala Enterprise.

Aplikasi ini dirancang untuk 2 Use Case utama:

Laporan Bulanan (Management): Sinkronisasi dan export data transaksi sebulan penuh.

Operasional Harian (Gudang): Fitur Bulk Search (Paste No. SO dari Excel) untuk mencetak daftar picking barang secara instan.

🛠️ Tech Stack

Frontend: React, TypeScript, Material-UI (MUI) DataGrid, Tailwind CSS, Axios, xlsx (Client-side Export).

Backend: Node.js, Express.js, TypeScript, Prisma ORM, dbffile (DBF Parser), exceljs (Server-side Export).

Database: PostgreSQL.

Architecture: Monorepo / Terpisah (Frontend & Backend).

🧠 Core Architecture & Mechanisms
1. Targeted Deletion (Wipe & Replace by Range)

Sistem tidak melakukan truncate (hapus total) pada database. Saat user melakukan Sync untuk rentang tanggal tertentu (misal: 1 April - 30 April), sistem hanya akan menghapus data Transaksi SO di rentang tersebut, lalu menggantinya dengan data segar dari file DBF.
(Catatan: Master Barang & Master Customer tidak pernah dihapus, hanya di-upsert).

2. Batch Processing (Chunking Array) untuk Mencegah OOM

File VFP bisa berukuran masif (ratusan ribu baris). Untuk mencegah Node.js mengalami Out of Memory (OOM) dan Postgres mengalami Timeout, proses Insert ke database dipotong menjadi sekumpulan batch:

Sales Order (Header): Di-insert per 1.000 baris.

Order Item (Detail): Di-insert per 2.000 baris.

3. Bulletproof Timezone Bypass

Visual FoxPro menyimpan tanggal tanpa Zona Waktu. Jika di-parse mentah oleh Javascript di zona waktu WIB (GMT+7), tanggal dapat bergeser mundur ke UTC (contoh: 01 April 00:00 WIB menjadi 31 Maret 17:00 UTC).
Solusi: Sistem ETL memaksa konversi string tanggal (YYYY-MM-DD) dan menetapkan jam menjadi 12:00 Siang UTC (T12:00:00.000Z) sebelum disimpan ke Prisma. Ini menjamin akurasi tanggal 100% di zona waktu manapun.

4. Dual-Engine Excel Export Strategy

Untuk menjaga performa browser user agar tidak crash (Tab Not Responding) saat memproses data besar, sistem menggunakan 2 mesin export yang berbeda:

Mode Bulanan (Backend Export): Menggunakan exceljs di Node.js. Server men-generate file Excel berisi puluhan ribu baris di memori server, lalu mengirimkannya sebagai File Stream ke browser.

Mode Bulk Search (Frontend Export): Menggunakan xlsx di React. Karena data pencarian spesifik (misal 100 SO) ukurannya kecil, Excel di-generate langsung di browser agar lebih cepat tanpa membebani server.
(Catatan: File Excel selalu menghasilkan 2 Sheet: Summary SO untuk Header, dan Detail Item untuk rincian barang).

5. Resilient Data Mapping (Penanganan Anomali VFP)

Sering terjadi kasus di mana Transaksi SO di VFP memiliki Kode Barang, namun kode tersebut tidak ada di tabel Master Barang. Sistem dirancang tahan banting (bulletproof) menggunakan Optional Chaining (?.) dan Fallback String (|| 'TIDAK ADA DI MASTER'). Ini mencegah aplikasi crash atau kolom Excel menghilang saat merender relasi data yang kosong/putus.

🗺️ Data Schema Mapping (VFP to Postgres)

Bagian ini adalah Source of Truth pemetaan nama kolom VFP yang disingkat ke dalam sistem Postgres kita.

1. Header Sales Order (PKARTSO1.DBF)
Kolom VFP	Tipe Data Asli	Mapping Prisma (Postgres)	Keterangan
SO	String	soNumber	Nomor Sales Order
TGSO	Date	soDate	Tanggal Transaksi
CUST	String	customerCode	Kode Customer
TSUB	Numeric	subTotal	Total Rupiah sebelum Diskon/PPN
POT	Numeric	discountAmount	Potongan Diskon (Rupiah)
PPN	Numeric	taxPercent	Nilai PPN (%)
TTL	Numeric	grandTotal	Grand Total Rupiah
KET	String	notes	Keterangan SO
2. Detail Item SO (PKARTSO2.DBF)
Kolom VFP	Tipe Data Asli	Mapping Prisma (Postgres)	Keterangan
SO	String	soNumber	Foreign Key ke Header
NUR	Numeric	sequence	Urutan Baris Item
BRG	String	productCode	Kode Barang
QTY	Numeric	qty	Jumlah Order
LB	Numeric	width	Dimensi Lebar
TG	Numeric	height	Dimensi Tinggi
M2	Numeric	area	Luasan (M2)
HS	Numeric	unitPrice	Harga Satuan (Rupiah)
KETBRG	String	itemNotes	Catatan/Keterangan per Item
DIS1-3	Numeric	discount1, 2, 3	Diskon Bertingkat (%)
3. Master Barang (PKSTFMAS.DBF)
Kolom VFP	Tipe Data Asli	Mapping Prisma (Postgres)	Keterangan
BRG	String	productCode	Kode Barang (Primary Key)
NBRG	String	name	Nama Barang
📡 API Reference
1. GET /api/sales-orders

Mengambil data Sales Order berdasarkan rentang tanggal untuk ditampilkan di DataGrid UI.

Query Params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD).

Response: JSON Array of Object (Sales Order).

2. POST /api/sales-orders/sync

Memicu engine ETL untuk membaca DBF, memfilter, membersihkan data lama, dan menyimpan data baru.

Body: { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }

Response: Success Message & Stats (Jumlah data tersimpan).

3. POST /api/sales-orders/bulk

Mengambil data spesifik berdasarkan daftar Nomor SO (Digunakan untuk fitur Paste dari Excel).

Body: { "soNumbers": ["SO-001", "SO-002"] }

Response: JSON Array of Object (Sales Order).

4. GET /api/sales-orders/export

Men-generate dan mengunduh file Excel secara langsung dari server berdasarkan rentang tanggal.

Query Params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD).

Response: File Stream (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet).

🚀 Deployment & Next Steps (Post-MVP)

Untuk membawa aplikasi ini ke level Production:

Auto-Start: Gunakan PM2 di server/OS Linux untuk menjaga Backend dan Frontend tetap berjalan di background.

Memory Tuning: Jika rentang tanggal export Excel sangat besar dan Backend mengalami crash, tingkatkan limit RAM Node.js di script start (contoh: node --max-old-space-size=4096 dist/index.js).

Auto-Sync (Optional): Integrasikan node-cron pada service ETL untuk melakukan sync otomatis setiap tengah malam (tanpa trigger manual dari UI).