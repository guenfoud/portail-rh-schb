import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

db.all("SELECT matricule, nom, prenom, horaire_debut, horaire_fin FROM employees WHERE horaire_debut LIKE '%AM%' OR horaire_debut LIKE '%PM%' OR horaire_fin LIKE '%AM%' OR horaire_fin LIKE '%PM%'", [], (err, rows) => {
  if (err) console.error(err);
  console.log("Dirty Employees found:", rows.length, rows);
  db.close();
});
