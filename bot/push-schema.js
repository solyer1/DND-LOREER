const { createClient } = require('@libsql/client');
require('dotenv').config();

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const sql1 = `
    CREATE TABLE IF NOT EXISTS "LoreEntry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "author" TEXT NOT NULL,
        "channelId" TEXT,
        "channelName" TEXT,
        "messageId" TEXT,
        "tags" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const sql2 = `
    CREATE UNIQUE INDEX IF NOT EXISTS "LoreEntry_messageId_key" ON "LoreEntry"("messageId");
  `;

  console.log("Creating table...");
  await client.execute(sql1);
  console.log("Creating index...");
  await client.execute(sql2);
  
  console.log("Successfully pushed schema to Turso!");
}

main().catch(console.error);
