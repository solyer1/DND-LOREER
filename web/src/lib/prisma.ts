import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

import { PrismaLibSql } from '@prisma/adapter-libsql'

const dbUrl = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:../../', 'file:../') 
  : 'file:./dev.db'

const adapter = new PrismaLibSql({
  url: dbUrl,
})

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
