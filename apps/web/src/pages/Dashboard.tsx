import { useEffect, useState } from 'react';
import axios from 'axios';
import { GridColDef } from '@mui/x-data-grid';
import { TableGrid } from '../components/TableGrid';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------
interface OrderItem {
  soNumber: string;
  sequence: number;
  productCode: string;
  qty: number;
  width: number | null;
  height: number | null;
  area: number | null;
  itemNotes: string | null;
  unitPrice: number;
  discount1: number | null;
  discount2: number | null;
  discount3: number | null;
  product: { name: string };
}

interface SalesOrder {
  soNumber: string;
  soDate: string;
  customerCode: string;
  customer?: { name: string };
  notes: string | null;
  subTotal: number;
  discountAmount: number;
  taxPercent: number;
  grandTotal: number;
  items: OrderItem[];
}

interface FlattenedRow {
  id: string;
  soNumber: string;
  soDate: string;
  customerCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  qty: number;
  width: number | null;
  height: number | null;
  area: number | null;
  unitPrice: number;
  disc1: number;
  disc2: number;
  disc3: number;
  jumlahNet: number;
  itemNotes: string;
}

interface SummaryRow {
  id: string;
  soNumber: string;
  soDate: string;
  customerCode: string;
  customerName: string;
  totalItems: number;
  subTotal: number;
  discountAmount: number;
  taxPercent: number;
  grandTotal: number;
}

// ---------------------------------------------------------
// FORMATTER & DATE UTILS
// ---------------------------------------------------------
const formatIDR = (value: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value || 0);
};

const formatPercent = (value: unknown) => {
  const num = Number(value);
  return num > 0 ? num.toFixed(2) : '0.00';
};

const getTodayDate = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getPastDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ---------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------
export const Dashboard = () => {
  // UI States
  const [activeTab, setActiveTab] = useState<'detail' | 'summary'>('detail');
  const [viewMode, setViewMode] = useState<'dateRange' | 'bulk'>('dateRange'); // Penanda mode data
  
  const [detailData, setDetailData] = useState<FlattenedRow[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Inputs
  const [startDate, setStartDate] = useState<string>(getPastDate(30));
  const [endDate, setEndDate] = useState<string>(getTodayDate());
  const [bulkInput, setBulkInput] = useState<string>('');

  // Columns
  const detailColumns: GridColDef[] = [
    { field: 'soNumber', headerName: 'No. SO', width: 130 },
    { field: 'customerName', headerName: 'Customer', width: 200 },
    { field: 'productName', headerName: 'Nama Barang', width: 250 },
    { field: 'width', headerName: 'L', type: 'number', width: 70 },
    { field: 'height', headerName: 'T', type: 'number', width: 70 },
    { field: 'area', headerName: '[ M2 ]', type: 'number', width: 80 },
    { field: 'qty', headerName: 'Qty Order', type: 'number', width: 90 },
    { field: 'unitPrice', headerName: '@ Harga', type: 'number', width: 120, valueFormatter: (value) => formatIDR(value as number) },
    { field: 'disc1', headerName: 'Disc-1', type: 'number', width: 70, valueFormatter: formatPercent },
    { field: 'disc2', headerName: 'Disc-2', type: 'number', width: 70, valueFormatter: formatPercent },
    { field: 'disc3', headerName: 'Disc-3', type: 'number', width: 70, valueFormatter: formatPercent },
    { field: 'jumlahNet', headerName: '[ Jumlah ]', type: 'number', width: 140, valueFormatter: (value) => formatIDR(value as number) },
    { field: 'itemNotes', headerName: 'Notes / Ket', width: 200 },
  ];

  const summaryColumns: GridColDef[] = [
    { field: 'soNumber', headerName: 'No. SO', width: 130 },
    { field: 'soDate', headerName: 'Tanggal', width: 110 },
    { field: 'customerName', headerName: 'Customer', width: 200 },
    { field: 'totalItems', headerName: 'Total Macam Item', type: 'number', width: 150 },
    { field: 'subTotal', headerName: 'Sub Total', type: 'number', width: 150, valueFormatter: (value) => formatIDR(value as number) },
    { field: 'discountAmount', headerName: 'Diskon SO', type: 'number', width: 150, valueFormatter: (value) => formatIDR(value as number) },
    { field: 'taxPercent', headerName: 'PPN (%)', type: 'number', width: 100 },
    { field: 'grandTotal', headerName: 'Grand Total', type: 'number', width: 180, valueFormatter: (value) => formatIDR(value as number) },
  ];

  // Helper to map raw API data to DataGrid rows
  const mapDataToRows = (rawData: SalesOrder[]) => {
    const flattenedRows: FlattenedRow[] = rawData.flatMap((order) => 
      order.items.map((item) => {
        const multiplier = (item.area && item.area > 0) ? item.area : item.qty;
        let netTotal = multiplier * Number(item.unitPrice);
        
        if (item.discount1) netTotal -= netTotal * (Number(item.discount1) / 100);
        if (item.discount2) netTotal -= netTotal * (Number(item.discount2) / 100);
        if (item.discount3) netTotal -= netTotal * (Number(item.discount3) / 100);

        return {
          id: `${order.soNumber}-${item.sequence}`, 
          soNumber: order.soNumber,
          soDate: new Date(order.soDate).toLocaleDateString('id-ID'),
          customerCode: order.customerCode,
          customerName: order.customer?.name || order.customerCode,
          productCode: item.productCode,
          productName: item.product.name,
          qty: item.qty,
          width: item.width,
          height: item.height,
          area: item.area,
          unitPrice: Number(item.unitPrice),
          disc1: Number(item.discount1 || 0),
          disc2: Number(item.discount2 || 0),
          disc3: Number(item.discount3 || 0),
          jumlahNet: netTotal,
          itemNotes: item.itemNotes || '-',
        };
      })
    );

    const mappedSummary: SummaryRow[] = rawData.map((order) => ({
      id: order.soNumber,
      soNumber: order.soNumber,
      soDate: new Date(order.soDate).toLocaleDateString('id-ID'),
      customerCode: order.customerCode,
      customerName: order.customer?.name || order.customerCode,
      totalItems: order.items.length,
      subTotal: Number(order.subTotal),
      discountAmount: Number(order.discountAmount),
      taxPercent: Number(order.taxPercent),
      grandTotal: Number(order.grandTotal)
    }));

    setDetailData(flattenedRows);
    setSummaryData(mappedSummary);
  };

  // 1. Fetch by Date Range
  const fetchSalesOrders = async () => {
    try {
      setLoading(true);
      setViewMode('dateRange');
      const response = await axios.get(`http://localhost:3001/api/sales-orders?startDate=${startDate}&endDate=${endDate}`);
      mapDataToRows(response.data.data);
    } catch (error) {
      console.error('Fetch Error:', error);
      alert('Gagal mengambil data dari server database.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch by Bulk SO Numbers (Paste from Excel)
  const handleBulkSearch = async () => {
    if (!bulkInput.trim()) {
      alert('Silakan paste daftar No. SO terlebih dahulu.');
      return;
    }

    // Split by newline, trim spaces, remove empty lines
    const soArray = bulkInput.split('\n').map(so => so.trim()).filter(so => so !== '');

    try {
      setLoading(true);
      setViewMode('bulk');
      const response = await axios.post('http://localhost:3001/api/sales-orders/bulk', {
        soNumbers: soArray
      });
      
      mapDataToRows(response.data.data);
      
      if (response.data.data.length === 0) {
        alert('Tidak ada SO yang ditemukan dari daftar yang dimasukkan.');
      }
    } catch (error) {
      console.error('Bulk Fetch Error:', error);
      alert('Gagal mencari data SO.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    if (startDate > endDate) {
      alert('Start Date tidak boleh lebih besar dari End Date bro!');
      return;
    }
    const confirmWipe = window.confirm(`Yakin mau SYNC data dari ${startDate} sampai ${endDate}?\n(Data lama di rentang ini akan direplace dari DBF)`);
    if (!confirmWipe) return;
    
    try {
      setIsSyncing(true);
      const response = await axios.post('http://localhost:3001/api/sales-orders/sync', { startDate, endDate });
      alert(response.data.data.message); 
      await fetchSalesOrders(); 
    } catch (error) {
      if (axios.isAxiosError(error)) alert(error.response?.data?.error || 'Gagal sinkronisasi');
      else alert('Terjadi kesalahan tak terduga di UI');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export Logic (Conditional based on View Mode)
  const handleExport = () => {
    if (summaryData.length === 0 || detailData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }

    if (viewMode === 'dateRange') {
      // Mode Bulanan: Download langsung dari Backend (Aman dari RAM Crash)
      window.open(`http://localhost:3001/api/sales-orders/export?startDate=${startDate}&endDate=${endDate}`, '_blank');
    } else {
      // Mode Bulk Search: Generate Excel di Frontend (Karena datanya kecil)
      const excelSummary = summaryData.map((row) => ({
        'No. SO': row.soNumber,
        'Tanggal': row.soDate,
        'Customer': row.customerName,
        'Kode Cust': row.customerCode,
        'Total Macam Item': row.totalItems,
        'Sub Total': row.subTotal,
        'Diskon SO': row.discountAmount,
        'PPN (%)': row.taxPercent,
        'Grand Total': row.grandTotal,
      }));

      const excelDetail = detailData.map((row) => ({
        'No. SO': row.soNumber,
        'Customer': row.customerName,
        'Kode Barang': row.productCode,
        'Nama Barang': row.productName,
        'Lebar': row.width || 0,
        'Tinggi': row.height || 0,
        'Luas (M2)': row.area || 0,
        'Qty Order': row.qty,
        '@ Harga': row.unitPrice,
        'Disc-1 (%)': row.disc1,
        'Disc-2 (%)': row.disc2,
        'Disc-3 (%)': row.disc3,
        '[ Jumlah Net ]': row.jumlahNet,
        'Notes': row.itemNotes,
      }));

      const workbook = XLSX.utils.book_new();
      const worksheetSummary = XLSX.utils.json_to_sheet(excelSummary);
      XLSX.utils.book_append_sheet(workbook, worksheetSummary, 'Summary SO');
      
      const worksheetDetail = XLSX.utils.json_to_sheet(excelDetail);
      XLSX.utils.book_append_sheet(workbook, worksheetDetail, 'Detail Item');

      XLSX.writeFile(workbook, `Laporan_SO_Bulk_Picking.xlsx`);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Sales Order Dashboard</h1>
        <p className="text-gray-500 mt-1">Sinkronisasi DBF, Laporan Bulanan, dan Pencarian Bulk SO.</p>
      </div>

      {/* Top Controls Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Left Panel: Date Range & Sync */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Mode Laporan Bulanan</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1 font-semibold">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 h-[38px]" />
            </div>
            <span className="mb-2 text-gray-500 font-bold">-</span>
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1 font-semibold">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 h-[38px]" />
            </div>
            
            <button onClick={fetchSalesOrders} disabled={loading || isSyncing} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded shadow text-sm h-[38px]">
              Load View
            </button>
            <button onClick={handleSync} disabled={isSyncing} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm h-[38px]">
              {isSyncing ? 'Syncing...' : 'Sync DBF'}
            </button>
          </div>
        </div>

        {/* Right Panel: Bulk Search (Paste from Excel) */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Mode Pencarian Bulk (Picking)</h2>
          <div className="flex gap-3 items-start">
            <textarea 
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Paste daftar No. SO dari Excel di sini...&#10;SO-001&#10;SO-002"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full h-[76px] resize-none"
            />
            <button onClick={handleBulkSearch} disabled={loading || isSyncing} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow text-sm h-[76px] whitespace-nowrap">
              Cari SO
            </button>
          </div>
        </div>

      </div>

      {/* Action Bar & Tabs */}
      <div className="flex justify-between items-center border-b border-gray-200 mb-4">
        <div className="flex">
          <button onClick={() => setActiveTab('detail')} className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'detail' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            Detail Barang (Item Level)
          </button>
          <button onClick={() => setActiveTab('summary')} className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'summary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            Summary Penjualan (Header)
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Menampilkan: {viewMode === 'dateRange' ? 'Laporan Bulanan' : 'Hasil Pencarian Bulk'}
          </span>
          <button onClick={handleExport} disabled={loading || isSyncing || detailData.length === 0} className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-2 rounded shadow font-medium text-sm">
            Export to Excel
          </button>
        </div>
      </div>
      
      {/* DataGrid */}
      {activeTab === 'summary' ? (
        <TableGrid rows={summaryData} columns={summaryColumns} loading={loading || isSyncing} />
      ) : (
        <TableGrid rows={detailData} columns={detailColumns} loading={loading || isSyncing} />
      )}
    </div>
  );
};