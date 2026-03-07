import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    // Error operasional yang kita definisikan (misal: input salah)
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // Error sistem / tidak terduga (misal: DB down)
  console.error('💥 SYSTEM ERROR:', err);
  return res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan pada server internal'
  });
};