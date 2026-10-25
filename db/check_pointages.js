import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

db.all("SELECT * FROM pointages LIMIT 10", [], (err, rows) => {
  if (err) console.error(err);
  console.log("Pointages in DB:", rows);
  db.close();
});
