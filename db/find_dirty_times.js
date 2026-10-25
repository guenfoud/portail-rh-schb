import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM pointages WHERE heure_entree LIKE '%AM%' OR heure_entree LIKE '%PM%' OR heure_sortie LIKE '%AM%' OR heure_sortie LIKE '%PM%'", [], (err, rows) => {
  if (err) console.error(err);
  console.log("Dirty Pointages found:", rows.length, rows);
  db.close();
});
