import { Router } from 'express';
import { syncSalesOrders, getSalesOrders, exportSalesOrders, getBulkSalesOrders } from '../controllers/soController';

const router = Router();

// Endpoint: POST /api/sales-orders/sync
router.post('/sync', syncSalesOrders);

// Endpoint: GET /api/sales-orders/export (Download Excel)
router.get('/export', exportSalesOrders);

// Endpoint: POST /api/sales-orders/bulk (Pencarian banyak SO sekaligus)
router.post('/bulk', getBulkSalesOrders);

// Endpoint: GET /api/sales-orders
router.get('/', getSalesOrders);

export default router;