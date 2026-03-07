import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  // Kita paksa kasih datasources lewat type casting 'any' 
  // biar TypeScript nggak komplain, tapi Prisma dapet URL-nya.
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
} as any); 

export default prisma;