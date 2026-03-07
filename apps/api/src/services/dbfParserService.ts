import { DBFFile } from 'dbffile';
import path from 'path';
import { AppError } from '../utils/AppError';

// ---------------------------------------------------------
// TYPE DEFINITIONS (Strict TS)
// ---------------------------------------------------------

export interface RawProduct {
  BRG: string;
  NBRG: string;
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
  KETBRG: string;
}

export interface RawSalesOrder {
  SO: string;
  TGSO: string | Date;
  CUST: string;
  KET: string;
  TSUB: number | string;
  POT: number | string;
  PPN: number | string;
  TTL: number | string;
  items: RawOrderItem[];
}

// ---------------------------------------------------------
// SERVICE CLASS
// ---------------------------------------------------------

export class DbfParserService {
  private dropzonePath = path.join(__dirname, '../../../../data-dropzone');

  public async parseProducts(): Promise<RawProduct[]> {
    const filePath = path.join(this.dropzonePath, 'PKSTFMAS.DBF');
    try {
      const dbf = await DBFFile.open(filePath);
      return await dbf.readRecords() as unknown as RawProduct[];
    } catch (error) {
      throw new AppError(`Gagal baca PKSTFMAS.DBF: ${(error as Error).message}`, 500);
    }
  }

  public async parseCustomers(): Promise<RawCustomer[]> {
    const filePath = path.join(this.dropzonePath, 'PKARFCUS.DBF');
    try {
      const dbf = await DBFFile.open(filePath);
      return await dbf.readRecords() as unknown as RawCustomer[];
    } catch (error) {
      throw new AppError(`Gagal baca PKARFCUS.DBF: ${(error as Error).message}`, 500);
    }
  }

  public async parseSalesOrders(): Promise<RawSalesOrder[]> {
    const headerPath = path.join(this.dropzonePath, 'PKARTSO1.DBF');
    const detailPath = path.join(this.dropzonePath, 'PKARTSO2.DBF');

    try {
      // 1. Read Header
      const headerDbf = await DBFFile.open(headerPath);
      const headers = await headerDbf.readRecords() as unknown as RawSalesOrder[];
      
      // 2. Read Detail
      const detailDbf = await DBFFile.open(detailPath);
      const details = await detailDbf.readRecords() as unknown as RawOrderItem[];

      // 3. Group detail items by SO Number using Map for O(1) lookup
      const detailMap = new Map<string, RawOrderItem[]>();
      
      for (const item of details) {
        if (!item.SO) continue;
        const soNo = String(item.SO).trim();
        
        if (!detailMap.has(soNo)) {
          detailMap.set(soNo, []);
        }
        detailMap.get(soNo)!.push(item);
      }

      // 4. Merge items into their respective headers
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
      throw new AppError(`Gagal baca file Sales Order (PKARTSO1/PKARTSO2): ${(error as Error).message}`, 500);
    }
  }
}