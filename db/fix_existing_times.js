import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening db:", err);
    process.exit(1);
  }
  console.log("Connected to db for time cleanup.");
});

function formatTime24h(rawTime) {
  if (!rawTime) return null;
  let str = String(rawTime).trim().toUpperCase();
  
  const parts = str.split(/\s+/);
  let timePart = '';
  let ampmPart = '';
  
  parts.forEach(p => {
    if (p.includes(':')) {
      timePart = p;
    }
    if (p === 'AM' || p === 'PM') {
      ampmPart = p;
    }
  });
  
  if (!timePart) return rawTime; // Fallback if no colon
  
  const timeSubparts = timePart.split(':');
  let hours = parseInt(timeSubparts[0], 10);
  let minutes = parseInt(timeSubparts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return rawTime;
  
  if (ampmPart === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampmPart === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

db.serialize(() => {
  // 1. Clean pointages
  db.all("SELECT id, heure_entree, heure_sortie FROM pointages", [], (err, rows) => {
    if (err) return console.error(err);
    let count = 0;
    rows.forEach(row => {
      const entry24 = formatTime24h(row.heure_entree);
      const exit24 = formatTime24h(row.heure_sortie);
      if (entry24 !== row.heure_entree || exit24 !== row.heure_sortie) {
        db.run("UPDATE pointages SET heure_entree = ?, heure_sortie = ? WHERE id = ?", [entry24, exit24, row.id], (err) => {
          if (err) console.error("Error updating pointages:", err);
        });
        count++;
      }
    });
    console.log(`Cleaned ${count} records in pointages table.`);
  });

  // 2. Clean employees reference shifts
  db.all("SELECT matricule, horaire_debut, horaire_fin FROM employees", [], (err, rows) => {
    if (err) return console.error(err);
    let count = 0;
    rows.forEach(row => {
      const start24 = formatTime24h(row.horaire_debut);
      const end24 = formatTime24h(row.horaire_fin);
      if (start24 !== row.horaire_debut || end24 !== row.horaire_fin) {
        db.run("UPDATE employees SET horaire_debut = ?, horaire_fin = ? WHERE matricule = ?", [start24, end24, row.matricule], (err) => {
          if (err) console.error("Error updating employees:", err);
        });
        count++;
      }
    });
    console.log(`Cleaned ${count} records in employees table.`);
  });
});
