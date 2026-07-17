const { createClient } = require("@libsql/client");
require("dotenv").config();

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  try {
    await client.execute("ALTER TABLE LoreEntry ADD COLUMN imageUrl TEXT;");
    console.log("Successfully added imageUrl column to Turso database.");
  } catch (error) {
    if (error.message.includes("duplicate column name")) {
       console.log("Column already exists.");
    } else {
       console.error("Error:", error);
    }
  }
}

main();
