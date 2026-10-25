import { initDB, dbConfig } from './db.js';

console.log(`[Init DB] Initialisation de la base de données MySQL '${dbConfig.database}'...`);

initDB().then(() => {
  console.log(`[Init DB] Base de données MySQL '${dbConfig.database}' et tables initialisées avec succès.`);
  process.exit(0);
}).catch((err) => {
  console.error(`[Init DB Error] Échec de l'initialisation de la base de données MySQL '${dbConfig.database}' :`, err);
  process.exit(1);
});
