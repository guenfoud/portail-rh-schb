import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration de la connexion MySQL (Base de données : GICA)
export const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : '',
  database: process.env.MYSQL_DATABASE || 'gica'
};

let pool = null;

// Adapter les requêtes SQLite vers la syntaxe MySQL
function adaptSql(sql) {
  let adapted = sql;

  // 1. Remplacer INSERT OR REPLACE INTO settings (key, value)
  adapted = adapted.replace(/INSERT OR REPLACE INTO settings \((?:`?key`?|\bkey\b),\s*(?:`?value`?|\bvalue\b)\)\s*VALUES\s*\('config',\s*\?\)/gi,
    "INSERT INTO settings (`key`, `value`) VALUES ('config', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)"
  );

  // 2. Échapper les colonnes réservées `key` et `value` dans la table settings
  adapted = adapted.replace(/\bWHERE key =/gi, "WHERE `key` =");
  adapted = adapted.replace(/\bFROM settings WHERE key/gi, "FROM settings WHERE `key`=");
  adapted = adapted.replace(/\bSELECT value FROM settings/gi, "SELECT `value` FROM settings");
  adapted = adapted.replace(/\bSELECT key, value FROM settings/gi, "SELECT `key`, `value` FROM settings");

  // 3. Convertir ON CONFLICT(id) DO UPDATE SET (SQLite) vers ON DUPLICATE KEY UPDATE (MySQL)
  if (adapted.includes('ON CONFLICT(id) DO UPDATE SET')) {
    adapted = adapted.replace(/ON CONFLICT\(id\) DO UPDATE SET[\s\S]*/gi, `
      ON DUPLICATE KEY UPDATE
      heure_entree=VALUES(heure_entree), heure_sortie=VALUES(heure_sortie),
      retard=VALUES(retard), heures_supp=VALUES(heures_supp),
      heures_travaillees=VALUES(heures_travaillees), anomalie=VALUES(anomalie),
      notes=VALUES(notes), shift_type=VALUES(shift_type)
    `);
  }

  return adapted;
}

// Ajoute une colonne à une table existante si elle n'existe pas déjà (MySQL 8.0.17 ne
// supporte pas "ALTER TABLE ... ADD COLUMN IF NOT EXISTS", introduit seulement en 8.0.29).
async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbConfig.database, table, column]
  );
  if (rows[0].count > 0) return;

  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`[MySQL] Colonne '${column}' ajoutée à la table '${table}'.`);
}

export async function initDB() {
  if (pool) return pool;

  console.log(`[MySQL] Connexion au serveur MySQL (${dbConfig.host}:${dbConfig.port}, Utilisateur: '${dbConfig.user}')...`);

  try {
    // 1. Connexion au serveur MySQL pour vérifier/créer la base de données GICA
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    console.log(`[MySQL] Base de données '${dbConfig.database}' vérifiée/prête.`);

    pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      multipleStatements: true,
      dateStrings: true
    });

    // 3. Créer la structure des tables dans la base GICA
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        matricule VARCHAR(50) PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        departement VARCHAR(100) NOT NULL,
        poste VARCHAR(100) NOT NULL,
        date_embauche VARCHAR(20) NOT NULL,
        solde_recuperation DOUBLE DEFAULT 0,
        solde_conge DOUBLE DEFAULT 30.0,
        horaire_debut VARCHAR(10) DEFAULT '08:00',
        horaire_fin VARCHAR(10) DEFAULT '16:00',
        role ENUM('employee', 'supervisor', 'hr') DEFAULT 'employee',
        actif INT DEFAULT 1,
        password VARCHAR(255) NOT NULL,
        cycle_travail INT DEFAULT 0,
        cycle_repos INT DEFAULT 0,
        cycle_debut VARCHAR(20) DEFAULT ''
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS pointages (
        id VARCHAR(100) PRIMARY KEY,
        matricule VARCHAR(50) NOT NULL,
        date VARCHAR(20) NOT NULL,
        heure_entree VARCHAR(10),
        heure_sortie VARCHAR(10),
        retard INT DEFAULT 0,
        heures_supp DOUBLE DEFAULT 0,
        heures_travaillees DOUBLE DEFAULT 0,
        anomalie INT DEFAULT 0,
        notes TEXT,
        shift_type ENUM('standard', 'matin', 'apresmidi', 'nuit') DEFAULT 'standard',
        FOREIGN KEY (matricule) REFERENCES employees(matricule) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS recuperations (
        id VARCHAR(100) PRIMARY KEY,
        matricule VARCHAR(50) NOT NULL,
        date_demande VARCHAR(20) NOT NULL,
        date_debut VARCHAR(20) NOT NULL,
        date_fin VARCHAR(20) NOT NULL,
        duree DOUBLE NOT NULL,
        motif TEXT NOT NULL,
        statut ENUM('En attente', 'Approuvé', 'Refusé') DEFAULT 'En attente',
        decide_par VARCHAR(100),
        date_decision VARCHAR(20),
        FOREIGN KEY (matricule) REFERENCES employees(matricule) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS absences (
        id VARCHAR(100) PRIMARY KEY,
        matricule VARCHAR(50) NOT NULL,
        date_demande VARCHAR(20) NOT NULL,
        date_debut VARCHAR(20) NOT NULL,
        date_fin VARCHAR(20) NOT NULL,
        duree_jours DOUBLE NOT NULL,
        type_conge ENUM('Annuel', 'Maladie', 'Maternité', 'Sans Solde', 'Spécial') NOT NULL,
        motif TEXT,
        statut ENUM('En attente', 'Approuvé', 'Refusé') DEFAULT 'En attente',
        decide_par VARCHAR(100),
        date_decision VARCHAR(20),
        FOREIGN KEY (matricule) REFERENCES employees(matricule) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        \`value\` LONGTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(64) PRIMARY KEY,
        matricule_acteur VARCHAR(50),
        nom_acteur VARCHAR(150),
        action VARCHAR(100) NOT NULL,
        cible VARCHAR(150),
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS employee_documents (
        id VARCHAR(64) PRIMARY KEY,
        matricule VARCHAR(50) NOT NULL,
        nom_fichier VARCHAR(255) NOT NULL,
        type_doc VARCHAR(50) DEFAULT 'Autre',
        contenu LONGTEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (matricule) REFERENCES employees(matricule) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS user_notifications (
        id VARCHAR(64) PRIMARY KEY,
        matricule_destinataire VARCHAR(50) NOT NULL,
        titre VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('conge', 'recuperation', 'email', 'system') DEFAULT 'conge',
        lien VARCHAR(100) DEFAULT '#absences',
        lu INT DEFAULT 0,
        email_sent INT DEFAULT 0,
        email_destinataire VARCHAR(150) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dest_lu (matricule_destinataire, lu)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS interims (
        id VARCHAR(64) PRIMARY KEY,
        matricule_titulaire VARCHAR(50) NOT NULL,
        matricule_interimaire VARCHAR(50) NOT NULL,
        date_debut VARCHAR(20) NOT NULL,
        date_fin VARCHAR(20) NOT NULL,
        statut ENUM('Actif', 'Inactif', 'Terminé') DEFAULT 'Actif',
        motif VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_titulaire (matricule_titulaire),
        INDEX idx_interimaire (matricule_interimaire)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log(`[MySQL] Tables de la base '${dbConfig.database}' prêtes.`);

    // 3bis. Ajouter les colonnes des nouvelles fonctionnalités sur les tables existantes
    // (MySQL 8.0.17 ne supporte pas "ADD COLUMN IF NOT EXISTS", d'où cette vérification manuelle).
    await ensureColumn('employees', 'photo', 'LONGTEXT NULL');
    await ensureColumn('employees', 'last_accrual_date', "VARCHAR(20) DEFAULT NULL");
    await ensureColumn('absences', 'justificatif', 'LONGTEXT NULL');
    await ensureColumn('absences', 'statut_superviseur', "ENUM('En attente','Approuvé','Refusé') DEFAULT NULL");
    await ensureColumn('absences', 'decide_par_superviseur', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('absences', 'date_decision_superviseur', 'VARCHAR(20) DEFAULT NULL');
    await ensureColumn('recuperations', 'statut_superviseur', "ENUM('En attente','Approuvé','Refusé') DEFAULT NULL");
    await ensureColumn('recuperations', 'decide_par_superviseur', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('recuperations', 'date_decision_superviseur', 'VARCHAR(20) DEFAULT NULL');

    // 4. Importation automatique depuis database.sqlite si disponible
    await migrateFromSQLiteIfAvailable();

    // 5. Injection des données par défaut si la base MySQL est toujours vide
    await seedDefaultDataIfEmpty();

    return pool;
  } catch (err) {
    console.error(`[MySQL Error] Erreur de connexion/initialisation de la base '${dbConfig.database}':`, err.message);
    throw err;
  }
}

// Migrer automatiquement SQLite -> MySQL si disponible
async function migrateFromSQLiteIfAvailable() {
  const sqlitePath = join(__dirname, 'database.sqlite');
  if (!fs.existsSync(sqlitePath)) return;

  try {
    const [empRows] = await pool.query("SELECT COUNT(*) as count FROM employees");
    if (empRows[0].count > 0) return; // MySQL contient déjà des données

    console.log("[Migration] Migration détectée : Copie des données depuis database.sqlite vers MySQL `gica`...");
    const sqlite3 = (await import('sqlite3')).default;
    const sqliteDb = new sqlite3.Database(sqlitePath);
    const getSqliteAll = (sql) => new Promise((res, rej) => sqliteDb.all(sql, (e, r) => e ? rej(e) : res(r)));

    // 1. Employees
    const employees = await getSqliteAll("SELECT * FROM employees");
    for (const e of employees) {
      await pool.query(
        `INSERT IGNORE INTO employees (matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation, solde_conge, horaire_debut, horaire_fin, role, actif, password, cycle_travail, cycle_repos, cycle_debut)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.matricule, e.nom, e.prenom, e.departement, e.poste, e.date_embauche, e.solde_recuperation || 0, e.solde_conge || 30.0, e.horaire_debut || '08:00', e.horaire_fin || '16:00', e.role || 'employee', e.actif ?? 1, e.password, e.cycle_travail || 0, e.cycle_repos || 0, e.cycle_debut || '']
      );
    }

    // 2. Pointages
    const pointages = await getSqliteAll("SELECT * FROM pointages");
    for (const p of pointages) {
      await pool.query(
        `INSERT IGNORE INTO pointages (id, matricule, date, heure_entree, heure_sortie, retard, heures_supp, heures_travaillees, anomalie, notes, shift_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.matricule, p.date, p.heure_entree, p.heure_sortie, p.retard || 0, p.heures_supp || 0, p.heures_travaillees || 0, p.anomalie || 0, p.notes || '', p.shift_type || 'standard']
      );
    }

    // 3. Recuperations
    const recuperations = await getSqliteAll("SELECT * FROM recuperations");
    for (const r of recuperations) {
      await pool.query(
        `INSERT IGNORE INTO recuperations (id, matricule, date_demande, date_debut, date_fin, duree, motif, statut, decide_par, date_decision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.matricule, r.date_demande, r.date_debut, r.date_fin, r.duree, r.motif, r.statut, r.decide_par, r.date_decision]
      );
    }

    // 4. Absences
    const absences = await getSqliteAll("SELECT * FROM absences");
    for (const a of absences) {
      await pool.query(
        `INSERT IGNORE INTO absences (id, matricule, date_demande, date_debut, date_fin, duree_jours, type_conge, motif, statut, decide_par, date_decision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.id, a.matricule, a.date_demande, a.date_debut, a.date_fin, a.duree_jours, a.type_conge, a.motif, a.statut, a.decide_par, a.date_decision]
      );
    }

    // 5. Settings
    const settings = await getSqliteAll("SELECT * FROM settings");
    for (const s of settings) {
      await pool.query(
        `INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES (?, ?)`,
        [s.key, s.value]
      );
    }

    sqliteDb.close();
    console.log("[Migration] Migration SQLite -> MySQL effectuée avec succès.");
  } catch (err) {
    console.error("[Migration Error] Erreur de migration :", err.message);
  }
}

// Injecter des données de démonstration dans MySQL si aucune donnée n'existe
async function seedDefaultDataIfEmpty() {
  const [rows] = await pool.query("SELECT COUNT(*) as count FROM employees");
  if (rows[0].count > 0) return;

  console.log("[MySQL Seed] Injection des données de démonstration dans MySQL `gica`...");
  const bcrypt = (await import('bcryptjs')).default;

  const sampleEmployees = [
    ['1001', 'Benali', 'Ahmed', 'Production', 'Chef de Poste (Shift)', '2022-01-15', 8.0, 30.0, '06:00', '14:00', 'supervisor', bcrypt.hashSync('1001', 10)],
    ['1002', 'Zohra', 'Fatma', 'Ressources Humaines', 'Directrice RH', '2023-03-10', 4.5, 25.5, '08:00', '16:00', 'hr', bcrypt.hashSync('1002', 10)],
    ['1003', 'Mansouri', 'Mohamed', 'Maintenance', 'Technicien Supérieur', '2021-11-01', 12.0, 22.0, '08:00', '16:00', 'employee', bcrypt.hashSync('1003', 10)],
    ['1004', 'Laribi', 'Amina', 'Administration', 'Secrétaire de Direction', '2024-06-01', 0.0, 28.0, '08:00', '16:30', 'employee', bcrypt.hashSync('1004', 10)],
    ['1005', 'Khadraoui', 'Yacine', 'Production', 'Opérateur Machine', '2023-09-15', 2.0, 18.0, '14:00', '22:00', 'employee', bcrypt.hashSync('1005', 10)]
  ];

  for (const emp of sampleEmployees) {
    await pool.query(`INSERT INTO employees
      (matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation, solde_conge, horaire_debut, horaire_fin, role, password, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, emp);
  }

  const defaultSettings = {
    horaires: {
      debutNormal: '08:00',
      finNormale: '16:00',
      toleranceRetard: 15,
      seuilHeuresSupp: 60,
      nuitDebut: '22:00',
      nuitFin: '06:00',
      coeffNuit: 1.25
    },
    shifts: {
      matin: { debut: '06:00', fin: '14:00' },
      apresmidi: { debut: '14:00', fin: '22:00' },
      nuit: { debut: '22:00', fin: '06:00' }
    },
    joursFeries: ['2026-05-01', '2026-07-05', '2026-11-01']
  };

  await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('config', ?)", [JSON.stringify(defaultSettings)]);
  console.log("[MySQL Seed] Données de démonstration prêtes.");
}

// Wrapper de compatibilité pour server.js
export const db = {
  async get(sql, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      if (!pool) await initDB();
      const adapted = adaptSql(sql);
      const [rows] = await pool.query(adapted, params);
      const row = rows && rows.length > 0 ? rows[0] : null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      if (callback) callback(err, null);
      else throw err;
    }
  },

  async all(sql, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      if (!pool) await initDB();
      const adapted = adaptSql(sql);
      const [rows] = await pool.query(adapted, params);
      if (callback) callback(null, rows);
      return rows;
    } catch (err) {
      if (callback) callback(err, null);
      else throw err;
    }
  },

  async run(sql, params = [], callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      if (!pool) await initDB();
      const adapted = adaptSql(sql);
      const [result] = await pool.query(adapted, params);
      const resObj = { lastID: result.insertId, changes: result.affectedRows };
      if (callback) callback.call(resObj, null);
      return resObj;
    } catch (err) {
      if (callback) callback.call({ lastID: 0, changes: 0 }, err);
      else throw err;
    }
  },

  serialize(fn) {
    if (typeof fn === 'function') {
      fn();
    }
  },

  prepare(sql) {
    const adapted = adaptSql(sql);
    return {
      run: (params, cb) => {
        if (typeof params === 'function') {
          cb = params;
          params = [];
        }
        db.run(adapted, params, cb);
      },
      finalize: (cb) => {
        if (cb) cb(null);
      }
    };
  }
};
