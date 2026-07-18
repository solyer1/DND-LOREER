require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

// Make sure process.env.DATABASE_URL is set (from .env)
const dbUrl = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:../../', 'file:../')
  : 'file:./prisma/dev.db';

const adapter = new PrismaLibSql({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const prisma = new PrismaClient({ adapter });

async function clear() {
  console.log("Connecting to database:", dbUrl);
  console.log("Deleting all records...");
  const result = await prisma.loreEntry.deleteMany({});
  console.log(`Deleted ${result.count} records.`);
}

clear()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
