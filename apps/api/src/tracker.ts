import { DBFFile } from 'dbffile';
import path from 'path';

async function testMemo() {
  const filePath = path.join(__dirname, '../../../../Citrasoft Bypasser/data-dropzone/PKARTSO1.DBF');
  
  // dbffile otomatis nyari PKARTSO1.FPT di folder yang sama
  const dbf = await DBFFile.open(filePath);
  const records = await dbf.readRecords();

  // Cari SO dari gambar lu: SO/2611/0138
  const target = records.find((r: any) => String(r.SO).trim() === 'SO/2611/0138');

  if (target) {
    console.log('🎉 SO DITEMUKAN!');
    console.log('No SO       :', target.SO);
    console.log('Customer    :', target.CUST);
    console.log('Isi Kolom KET:\n', target.KET);
    console.log('\n--- Semua Data Kolom SO Ini ---');
    console.log(target);
  } else {
    console.log('SO tidak ketemu, coba tampilkan 1 data teratas:');
    console.log(records[0]);
  }
}

testMemo();