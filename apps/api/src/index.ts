import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import soRoutes from './routes/soRoutes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
// Default port 3001 biar ga tabrakan sama React (biasanya jalan di 3000/5173)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// 1. Global Middlewares
app.use(cors());
app.use(express.json()); // Wajib biar bisa baca req.body format JSON

// 2. Mount Routes
app.use('/api/sales-orders', soRoutes);

// 3. Mount Global Error Handler (Wajib di urutan paling bawah)
app.use(errorHandler);

// 4. Start Server
app.listen(PORT, () => {
  console.log(`🚀 API Server VFP-Extractor jalan di http://localhost:${PORT}`);
});