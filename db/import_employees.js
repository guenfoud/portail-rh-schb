import XLSX from 'xlsx';
import { db, initDB } from './db.js';

// Helper pour convertir les dates Excel en chaine YYYY-MM-DD
function parseExcelDate(excelDate) {
  if (!excelDate) return new Date().toISOString().split('T')[0];
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (typeof excelDate === 'string') {
    const cleanDate = excelDate.trim();
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (cleanDate.includes('-')) {
      return cleanDate;
    }
  }
  return new Date().toISOString().split('T')[0];
}

async function run() {
  await initDB();
  const filePath = "C:\\Users\\dz2\\Desktop\\Employee List EUROJAPAN17_ADMINISTRATEUR 2024-12-10T08_08_43.xlsx";
  
  console.log("Lecture du fichier Excel :", filePath);
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rows = XLSX.utils.sheet_to_json(worksheet);
  console.log(`Nombre total de lignes trouvées dans Excel : ${rows.length}`);

  let importedCount = 0;
  for (const row of rows) {
    const matricule = String(row['N°'] || '').trim();
    const nom = String(row['Nom'] || '').trim();
    const prenom = String(row['Prenom'] || '').trim();
    const poste = String(row['Fonction'] || '').trim();
    const departement = String(row['Code Departement'] || 'Exploitation').trim();
    
    const rawDateEntree = row["Date d'entrée"];
    const dateEmbauche = parseExcelDate(rawDateEntree);

    const soldeConge = parseFloat(row['Total Reliquat']) || 30.0;

    if (!matricule || !nom || !prenom) {
      continue;
    }

    await db.run(`INSERT INTO employees 
      (matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation, solde_conge, horaire_debut, horaire_fin, role, password, actif) 
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, '08:00', '16:00', 'employee', ?, 1)
      ON DUPLICATE KEY UPDATE 
      nom=VALUES(nom), prenom=VALUES(prenom), departement=VALUES(departement), 
      poste=VALUES(poste), date_embauche=VALUES(date_embauche), solde_conge=VALUES(solde_conge), actif=1`,
      [matricule, nom, prenom, departement, poste, dateEmbauche, soldeConge, matricule]
    );
    importedCount++;
  }

  console.log(`Importation complétée : ${importedCount} employés insérés/mis à jour avec succès dans MySQL (GICA) !`);
}

run().catch(console.error);
