import { Request, Response } from 'express';
import { EtlService } from '../services/etlService';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const etlService = new EtlService();
const prisma = new PrismaClient();

// Endpoint to trigger ETL Sync based on Date Range
export const syncSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    throw new AppError('startDate dan endDate wajib dikirim dengan format YYYY-MM-DD', 400);
  }

  const result = await etlService.syncData(startDate as string, endDate as string);

  res.status(200).json({
    success: true,
    data: result
  });
});

// Endpoint to fetch data for Frontend DataGrid
export const getSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  let whereClause = {};
  
  if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
    whereClause = {
      soDate: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      }
    };
  }

  const orders = await prisma.salesOrder.findMany({
    where: whereClause,
    include: {
      customer: true,
      items: { include: { product: true } }
    },
    orderBy: { soDate: 'desc' }
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// Endpoint to fetch specific SOs based on Array of SO Numbers (Bulk Search)
export const getBulkSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const { soNumbers } = req.body;

  if (!soNumbers || !Array.isArray(soNumbers)) {
    throw new AppError('soNumbers wajib dikirim dalam bentuk array', 400);
  }

  const orders = await prisma.salesOrder.findMany({
    where: {
      soNumber: { in: soNumbers }
    },
    include: {
      customer: true,
      items: { include: { product: true } }
    },
    orderBy: { soDate: 'desc' }
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// Endpoint to Export Excel directly from Backend
export const exportSalesOrders = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    throw new AppError('startDate dan endDate wajib dikirim', 400);
  }

  const orders = await prisma.salesOrder.findMany({
    where: {
      soDate: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      }
    },
    include: {
      customer: true,
      items: { include: { product: true } }
    },
    orderBy: { soDate: 'desc' }
  });

  const workbook = new ExcelJS.Workbook();
  
  // 1. SUMMARY SHEET
  const summarySheet = workbook.addWorksheet('Summary SO');
  summarySheet.columns = [
    { header: 'No. SO', key: 'soNumber', width: 15 },
    { header: 'Tanggal', key: 'soDate', width: 15 },
    { header: 'Customer', key: 'customerName', width: 30 },
    { header: 'Kode Cust', key: 'customerCode', width: 15 },
    { header: 'Total Macam Item', key: 'totalItems', width: 20 },
    { header: 'Sub Total', key: 'subTotal', width: 20 },
    { header: 'Diskon SO', key: 'discountAmount', width: 20 },
    { header: 'PPN (%)', key: 'taxPercent', width: 15 },
    { header: 'Grand Total', key: 'grandTotal', width: 20 },
  ];

  // 2. DETAIL SHEET
  const detailSheet = workbook.addWorksheet('Detail Item');
  detailSheet.columns = [
    { header: 'No. SO', key: 'soNumber', width: 15 },
    { header: 'Customer', key: 'customerName', width: 30 },
    { header: 'Kode Barang', key: 'productCode', width: 20 },
    { header: 'Nama Barang', key: 'productName', width: 40 },
    { header: 'Lebar', key: 'width', width: 10 },
    { header: 'Tinggi', key: 'height', width: 10 },
    { header: 'Luas (M2)', key: 'area', width: 15 },
    { header: 'Qty Order', key: 'qty', width: 15 },
    { header: '@ Harga', key: 'unitPrice', width: 20 },
    { header: 'Disc-1 (%)', key: 'disc1', width: 15 },
    { header: 'Disc-2 (%)', key: 'disc2', width: 15 },
    { header: 'Disc-3 (%)', key: 'disc3', width: 15 },
    { header: '[ Jumlah Net ]', key: 'jumlahNet', width: 20 },
    { header: 'Notes', key: 'itemNotes', width: 30 },
  ];

  // Populate Data
  orders.forEach(order => {
    const customerName = order.customer?.name || order.customerCode;
    const soDateStr = order.soDate.toLocaleDateString('id-ID');

    // Add Summary Row
    summarySheet.addRow({
      soNumber: order.soNumber,
      soDate: soDateStr,
      customerName: customerName,
      customerCode: order.customerCode,
      totalItems: order.items.length,
      subTotal: Number(order.subTotal),
      discountAmount: Number(order.discountAmount),
      taxPercent: Number(order.taxPercent),
      grandTotal: Number(order.grandTotal),
    });

    // Add Detail Rows
    order.items.forEach(item => {
      const multiplier = (Number(item.area) > 0) ? Number(item.area) : Number(item.qty);
      let netTotal = multiplier * Number(item.unitPrice);
      
      if (item.discount1) netTotal -= netTotal * (Number(item.discount1) / 100);
      if (item.discount2) netTotal -= netTotal * (Number(item.discount2) / 100);
      if (item.discount3) netTotal -= netTotal * (Number(item.discount3) / 100);

      detailSheet.addRow({
        soNumber: order.soNumber,
        customerName: customerName,
        productCode: item.productCode,
        productName: item.product.name,
        width: Number(item.width || 0),
        height: Number(item.height || 0),
        area: Number(item.area || 0),
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
        disc1: Number(item.discount1 || 0),
        disc2: Number(item.discount2 || 0),
        disc3: Number(item.discount3 || 0),
        jumlahNet: netTotal,
        itemNotes: item.itemNotes || '-',
      });
    });
  });

  // Make headers bold
  summarySheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).font = { bold: true };

  // Set Response Headers for File Download
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Laporan_SO_${startDate}_sampai_${endDate}.xlsx`);

  // Write to stream
  await workbook.xlsx.write(res);
  res.end();
});