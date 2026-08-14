import { PrismaClient, Prisma } from '@prisma/client';
import { DbfParserService } from './dbfParserService';
import { AppError } from '../utils/AppError';

const prisma = new PrismaClient();
const parser = new DbfParserService();

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

interface MappedProduct { productCode: string; name: string; aliasName: string | null; unit: string | null; categoryCode: string | null; basePrice: number; isJasa: boolean; outDiskon: boolean; }
interface MappedCustomer { customerCode: string; name: string; }
interface MappedOrder { soNumber: string; soDate: Date; customerCode: string; salesmanCode: string | null; notes: string | null; subTotal: number; discountAmount: number; discountAmt2: number; headerDisc1: number; headerDisc2: number; headerDisc3: number; headerDisc4: number; taxPercent: number; grandTotal: number; }
interface MappedItem { soNumber: string; sequence: number; productCode: string; qty: number; width: number | null; height: number | null; area: number | null; unitPrice: number; discount1: number | null; discount2: number | null; discount3: number | null; discount4: number | null; itemNotes: string | null; }

export class EtlService {
  public async syncData(startDate: string, endDate: string) {
    try {
      console.log(`\n==================================================`);
      console.log(`[DEBUG] MEMULAI SYNC ETL...`);
      console.log(`[DEBUG] Target Date Range dari UI : ${startDate} s/d ${endDate}`);
      console.log(`==================================================`);

      const rawProducts = await parser.parseProducts();
      const rawCustomers = await parser.parseCustomers();
      const rawOrders = await parser.parseSalesOrders();

      const filteredOrders = rawOrders.filter(o => {
        if (!o.TGSO) return false; 
        const d = o.TGSO instanceof Date ? o.TGSO : new Date(o.TGSO);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const orderDateStr = `${yyyy}-${mm}-${dd}`;
        return orderDateStr >= startDate && orderDateStr <= endDate;
      });

      console.log(`[DEBUG] Total Orders setelah filter tanggal: ${filteredOrders.length} baris`);

      const mappedProducts: MappedProduct[] = rawProducts
        .filter(p => p.BRG && String(p.BRG).trim() !== '')
        .map(p => ({
          productCode: String(p.BRG).trim(),
          name: p.NBRG ? String(p.NBRG).trim() : 'UNKNOWN',
          aliasName: null, unit: null, categoryCode: null, basePrice: 0,
          isJasa: p.ISJASA === true || p.ISJASA === 'T' || p.ISJASA === 'Y',
          outDiskon: p.OUTDISKON === true || p.OUTDISKON === 'T' || p.OUTDISKON === 'Y',
        }));

      const mappedCustomers: MappedCustomer[] = rawCustomers
        .filter(c => c.CUST && String(c.CUST).trim() !== '')
        .map(c => ({
          customerCode: String(c.CUST).trim(),
          name: c.NCUST ? String(c.NCUST).trim() : 'UNKNOWN',
        }));

      const mappedOrders: MappedOrder[] = [];
      const mappedItems: MappedItem[] = [];

      for (const order of filteredOrders) {
        if (!order.SO) continue;
        const soNumber = String(order.SO).trim();
        
        const d = order.TGSO instanceof Date ? order.TGSO : new Date(order.TGSO as string);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const safeUtcDate = new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`);

        mappedOrders.push({
          soNumber: soNumber,
          soDate: safeUtcDate,
          customerCode: order.CUST ? String(order.CUST).trim() : 'UNKNOWN',
          salesmanCode: null,
          notes: order.KET ? String(order.KET).trim() : null,
          subTotal: Number(order.TSUB || 0),
          discountAmount: Number(order.POT || 0),
          discountAmt2: Number(order.POT2 || 0),
          headerDisc1: Number(order.DIS1 || 0),
          headerDisc2: Number(order.DIS2 || 0),
          headerDisc3: Number(order.DIS3 || 0),
          headerDisc4: Number(order.DIS4 || 0),
          taxPercent: Number(order.PPN || 0),
          grandTotal: Number(order.TTL || 0),
        });

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item, index) => {
            mappedItems.push({
              soNumber: soNumber,
              sequence: item.NUR ? Number(item.NUR) : index + 1,
              productCode: item.BRG ? String(item.BRG).trim() : 'UNKNOWN',
              qty: Number(item.QTY || 0),
              width: item.LB ? Number(item.LB) : null,
              height: item.TG ? Number(item.TG) : null,
              area: item.M2 ? Number(item.M2) : null,
              unitPrice: Number(item.HS || 0),
              discount1: item.DIS1 ? Number(item.DIS1) : null,
              discount2: item.DIS2 ? Number(item.DIS2) : null,
              discount3: item.DIS3 ? Number(item.DIS3) : null,
              discount4: item.DIS4 ? Number(item.DIS4) : null,
              itemNotes: item.KETBRG ? String(item.KETBRG).trim() : null,
            });
          });
        }
      }

      const existingProductCodes = new Set(mappedProducts.map(p => p.productCode));
      const missingProducts: MappedProduct[] = [];
      for (const item of mappedItems) {
        if (!existingProductCodes.has(item.productCode)) {
          missingProducts.push({
            productCode: item.productCode, name: 'UNKNOWN PRODUCT (MISSING IN MASTER)',
            aliasName: null, unit: null, categoryCode: null, basePrice: 0,
            isJasa: false, outDiskon: false
          });
          existingProductCodes.add(item.productCode); 
        }
      }
      const finalProducts = [...mappedProducts, ...missingProducts];

      const existingCustomerCodes = new Set(mappedCustomers.map(c => c.customerCode));
      const missingCustomers: MappedCustomer[] = [];
      for (const order of mappedOrders) {
        if (!existingCustomerCodes.has(order.customerCode)) {
          missingCustomers.push({
            customerCode: order.customerCode, name: 'UNKNOWN CUSTOMER (MISSING IN MASTER)',
          });
          existingCustomerCodes.add(order.customerCode);
        }
      }
      const finalCustomers = [...mappedCustomers, ...missingCustomers];

      const startIso = new Date(`${startDate}T00:00:00.000Z`);
      const endIso = new Date(`${endDate}T23:59:59.999Z`);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const sosToDelete = await tx.salesOrder.findMany({
          where: { soDate: { gte: startIso, lte: endIso } },
          select: { soNumber: true }
        });
        const soIds = sosToDelete.map(so => so.soNumber);
        
        await tx.orderItem.deleteMany({ where: { soNumber: { in: soIds } } });
        await tx.salesOrder.deleteMany({ where: { soNumber: { in: soIds } } });

        // 1. TRUE UPSERT untuk Master Barang (Update nama & flag jika ada perubahan)
        for (const p of finalProducts) {
          await tx.product.upsert({
            where: { productCode: p.productCode },
            update: { 
              name: p.name,
              isJasa: p.isJasa,
              outDiskon: p.outDiskon
            },
            create: p
          });
        }

        // 2. TRUE UPSERT untuk Master Customer (Update nama jika ada perubahan)
        for (const c of finalCustomers) {
          await tx.customer.upsert({
            where: { customerCode: c.customerCode },
            update: { name: c.name },
            create: c
          });
        }

        const orderChunks = chunkArray(mappedOrders, 1000);
        for (const chunk of orderChunks) { await tx.salesOrder.createMany({ data: chunk, skipDuplicates: true }); }

        const itemChunks = chunkArray(mappedItems, 2000);
        for (const chunk of itemChunks) { await tx.orderItem.createMany({ data: chunk, skipDuplicates: true }); }
      }, { timeout: 120000 });

      console.log(`[DEBUG] SYNC BERHASIL!\n`);

      return {
        message: `Sinkronisasi sukses untuk periode ${startDate} sampai ${endDate}`,
        stats: { productsImported: finalProducts.length, customersImported: finalCustomers.length, ordersImported: mappedOrders.length, itemsImported: mappedItems.length }
      };

    } catch (error) {
      console.error('ETL Sync Error:', error);
      throw new AppError(`Proses ETL Gagal: \n${(error as Error).message}`, 500);
    }
  }
}