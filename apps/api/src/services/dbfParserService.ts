import { DBFFile } from 'dbffile';
import path from 'path';
import fs from 'fs'; // Tambahan untuk ngecek file
import { AppError } from '../utils/AppError';

export interface RawProduct {
  BRG: string;
  NBRG: string;
  NBRG2?: string;
  NBRG3?: string;
  ISJASA?: boolean | string;
  OUTDISKON?: boolean | string;
}

export interface RawCustomer {
  CUST: string;
  NCUST: string;
}

export interface RawOrderItem {
  SO: string;
  NUR: number | string;
  BRG: string;
  QTY: number | string;
  LB: number | string;
  TG: number | string;
  M2: number | string;
  HS: number | string;
  DIS1: number | string;
  DIS2: number | string;
  DIS3: number | string;
  DIS4?: number | string;
  KETBRG: string;
}

export interface RawSalesOrder {
  SO: string;
  TGSO: string | Date;
  CUST: string;
  KET: string;
  TSUB: number | string;
  POT: number | string;
  POT2?: number | string;
  DIS1?: number | string;
  DIS2?: number | string;
  DIS3?: number | string;
  DIS4?: number | string;
  PPN: number | string;
  TTL: number | string;
  items: RawOrderItem[];
}

export class DbfParserService {
  private dropzonePath = path.join(__dirname, '../../../../data-dropzone');

  // HELPER: Fungsi pintar untuk nyari file .DBF atau .dbf
  private getActualFilePath(baseName: string): string {
    const upperPath = path.join(this.dropzonePath, `${baseName}.DBF`);
    const lowerPath = path.join(this.dropzonePath, `${baseName}.dbf`);
    
    if (fs.existsSync(upperPath)) return upperPath;
    if (fs.existsSync(lowerPath)) return lowerPath;
    
    throw new AppError(`File ${baseName}.DBF atau ${baseName}.dbf tidak ditemukan di folder data-dropzone!`, 404);
  }

  public async parseProducts(): Promise<RawProduct[]> {
    const filePath = this.getActualFilePath('PKSTFMAS');
    try {
      const dbf = await DBFFile.open(filePath);
      return await dbf.readRecords() as unknown as RawProduct[];
    } catch (error) {
      throw new AppError(`Gagal baca Master Barang: ${(error as Error).message}`, 500);
    }
  }

  public async parseCustomers(): Promise<RawCustomer[]> {
    const filePath = this.getActualFilePath('PKARFCUS');
    try {
      const dbf = await DBFFile.open(filePath);
      return await dbf.readRecords() as unknown as RawCustomer[];
    } catch (error) {
      throw new AppError(`Gagal baca Master Customer: ${(error as Error).message}`, 500);
    }
  }

  public async parseSalesOrders(): Promise<RawSalesOrder[]> {
    const headerPath = this.getActualFilePath('PKARTSO1');
    const detailPath = this.getActualFilePath('PKARTSO2');

    try {
      const headerDbf = await DBFFile.open(headerPath);
      const headers = await headerDbf.readRecords() as unknown as RawSalesOrder[];
      
      const detailDbf = await DBFFile.open(detailPath);
      const details = await detailDbf.readRecords() as unknown as RawOrderItem[];

      const detailMap = new Map<string, RawOrderItem[]>();
      
      for (const item of details) {
        if (!item.SO) continue;
        const soNo = String(item.SO).trim();
        
        if (!detailMap.has(soNo)) {
          detailMap.set(soNo, []);
        }
        detailMap.get(soNo)!.push(item);
      }

      const joinedOrders = headers.map(header => {
        const soNo = header.SO ? String(header.SO).trim() : '';
        const items = detailMap.get(soNo) || [];
        
        return {
          ...header,
          items: items
        };
      });

      return joinedOrders;

    } catch (error) {
      throw new AppError(`Gagal baca file Sales Order: ${(error as Error).message}`, 500);
    }
  }
}