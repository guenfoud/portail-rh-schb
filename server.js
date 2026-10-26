import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { randomUUID, randomBytes } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { db, initDB } from './db/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 8081;

app.use(cors());
// Limite relevée par rapport au défaut (100kb) pour accepter les photos/documents en base64
app.use(express.json({ limit: '8mb' }));

// En-têtes de sécurité de base
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// --- SECRET JWT PERSISTANT ---
const secretPath = join(__dirname, 'db', '.jwt_secret');
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  try {
    if (fs.existsSync(secretPath)) {
      JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
    }
  } catch (e) {
    console.error("Impossible de lire le secret JWT :", e);
  }
  if (!JWT_SECRET) {
    JWT_SECRET = randomBytes(48).toString('hex');
    try {
      fs.writeFileSync(secretPath, JWT_SECRET, { mode: 0o600 });
    } catch (e) {
      console.error("Impossible d'écrire le secret JWT persistant :", e);
    }
  }
}

// Colonnes publiques de la table employees
const EMP_COLS = `matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation, solde_conge, horaire_debut, horaire_fin, role, actif, cycle_travail, cycle_repos, cycle_debut, SuperieurMatricule, Email`;
// Idem + photo (uniquement pour la fiche détaillée d'un seul employé, jamais pour la liste
// complète, afin de ne pas alourdir la réponse de /api/employees avec des images en base64).
const EMP_COLS_WITH_PHOTO = `${EMP_COLS}, photo`;

// --- JOURNAL D'AUDIT ---
// Trace les actions sensibles (création/modification/suppression, décisions d'approbation...)
// pour permettre à la RH de savoir qui a fait quoi et quand.
function logAudit(req, action, cible, details) {
  try {
    const id = randomUUID();
    db.run(
      `INSERT INTO audit_log (id, matricule_acteur, nom_acteur, action, cible, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user?.matricule || null, req.user?.matricule || 'Système', action, cible || null, details ? String(details) : null],
      (err) => { if (err) console.error("[Audit] Erreur d'écriture :", err.message); }
    );
  } catch (e) {
    console.error("[Audit] Erreur :", e.message);
  }
}

// --- CONFIGURATION SMTP POUR L'ENVOI D'EMAILS DE VALIDATION ---
// Serveur : mail.dz-com.com, Compte : it@dz-com.com
const smtpConfig = {
  host: process.env.SMTP_HOST || 'mail.dz-com.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER || 'it@dz-com.com',
    pass: process.env.SMTP_PASS || 'aze@2023'
  },
  tls: {
    rejectUnauthorized: false
  }
};

const mailTransporter = nodemailer.createTransport(smtpConfig);
console.log(`[SMTP] Service de messagerie configuré : ${smtpConfig.host}:${smtpConfig.port} (Expéditeur: ${smtpConfig.auth.user})`);

async function sendSmtpEmail({ to, subject, text, html }) {
  if (!to) return false;
  try {
    const adminCopy = smtpConfig.auth.user; // 'it@dz-com.com'
    const mailOptions = {
      from: `"Portail RH SCHB GICA" <${adminCopy}>`,
      replyTo: adminCopy,
      to,
      subject,
      text,
      html: html || `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
          <div style="background: #2563eb; color: #ffffff; padding: 20px 24px;">
            <h2 style="margin: 0; font-size: 1.25rem;">Portail RH — SCHB GICA</h2>
            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 4px;">Société des Ciments de Hamma Bouziane</div>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 1.1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">${subject}</h3>
            <p style="font-size: 0.95rem; line-height: 1.6; white-space: pre-line; color: #334155;">${text}</p>
            <div style="margin-top: 24px; padding: 14px 16px; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; font-size: 0.85rem; color: #475569;">
              <strong>Portail RH SCHB GICA :</strong> Connectez-vous sur votre espace sécurisé pour consulter vos demandes ou télécharger votre titre de congé officiel.
            </div>
          </div>
          <div style="padding: 14px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 0.78rem; color: #64748b; text-align: center;">
            Cet email a été transmis par le serveur de messagerie officiel <strong>mail.dz-com.com</strong> (&lt;${adminCopy}&gt;).
          </div>
        </div>
      `,
      headers: {
        'X-Priority': '1 (Highest)',
        'X-Mailer': 'SCHB-GICA-RH-Portal'
      }
    };

    // Copie de confirmation automatique vers it@dz-com.com pour suivi administrateur
    if (adminCopy && to.toLowerCase() !== adminCopy.toLowerCase()) {
      mailOptions.cc = adminCopy;
    }

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`[SMTP] Succès envoi email à ${to} (CC: ${mailOptions.cc || 'aucun'}) [MessageId: ${info.messageId}]`);
    return true;
  } catch (err) {
    console.error(`[SMTP] Échec envoi email à ${to} :`, err.message);
    return false;
  }
}

// --- NOTIFICATIONS UTILISATEURS & ENVOI D'EMAILS ---
function createNotification({ matricule_destinataire, titre, message, type = 'conge', lien = '#absences', email_destinataire = null, email_sent = 1, email_html = null }) {
  return new Promise((resolve) => {
    const notifId = randomUUID();
    db.run(
      `INSERT INTO user_notifications (id, matricule_destinataire, titre, message, type, lien, lu, email_sent, email_destinataire)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [notifId, matricule_destinataire, titre, message, type, lien, email_sent ? 1 : 0, email_destinataire || null],
      async (err) => {
        if (err) {
          console.error("[Notification] Erreur d'insertion :", err.message);
        } else {
          console.log(`[Notification/Email] Pour ${matricule_destinataire} : "${titre}" - Destinataire: ${email_destinataire || 'N/A'}`);
          broadcast({ type: 'update', path: '/api/notifications' });

          // Envoi effectif de l'email via le serveur SMTP en arrière-plan (non-bloquant)
          if (email_destinataire && email_sent) {
            sendSmtpEmail({
              to: email_destinataire,
              subject: `[SCHB GICA] ${titre}`,
              text: message,
              html: email_html
            }).catch(smtpErr => console.error("[SMTP Async] Erreur :", smtpErr.message));
          }
        }
        resolve(notifId);
      }
    );
  });
}

// Générateur d'email interactif avec boutons de décision rapide en 1 clic
function generateQuickDecisionEmailHtml({
  titre,
  empNom,
  empMatricule,
  empDepartement,
  empPoste,
  typeConge,
  dateDebut,
  dateFin,
  dureeJours,
  motif,
  hasJustificatif = false,
  conflicts = [],
  approveUrl,
  rejectUrl,
  deciderRoleLabel = 'Responsable Hiérarchique'
}) {
  const adminCopy = smtpConfig.auth.user;
  const conflictHtml = conflicts.length > 0 ? `
    <div style="margin: 18px 0; padding: 14px 16px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px;">
      <div style="color: #92400e; font-weight: 700; font-size: 0.92rem;">
        ⚠️ Risque de sous-effectif départemental (${conflicts.length} collègue(s) absent(s)) :
      </div>
      <p style="margin: 6px 0 8px 0; font-size: 0.85rem; color: #b45309;">
        Attention, des collègues de ce département (${empDepartement || 'Service'}) sont déjà absents sur cette même période :
      </p>
      <ul style="margin: 0; padding-left: 20px; font-size: 0.84rem; color: #78350f;">
        ${conflicts.map(c => `<li><strong>${c.prenom} ${c.nom}</strong> (${c.poste || 'Employé'}) : ${c.type_conge} du ${c.date_debut} au ${c.date_fin} (${c.duree_jours}j)</li>`).join('')}
      </ul>
    </div>
  ` : '';

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 22px 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Portail RH — SCHB GICA</h2>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">Validation Express 1 Clic</span>
        </div>
        <div style="font-size: 0.84rem; opacity: 0.9; margin-top: 5px;">Société des Ciments de Hamma Bouziane</div>
      </div>

      <div style="padding: 24px; color: #1e293b;">
        <h3 style="color: #0f172a; margin-top: 0; font-size: 1.15rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
          ${titre}
        </h3>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Collaborateur :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${empNom} <span style="font-size: 0.8rem; color: #64748b; font-weight: 500;">(Matricule: ${empMatricule})</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Département :</td>
              <td style="padding: 6px 0; font-weight: 600; color: #334155;">${empDepartement || 'GICA'} — ${empPoste || 'Non précisé'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Type de congé :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #2563eb;">${typeConge}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Période demandée :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">Du ${dateDebut} au ${dateFin} (${dureeJours} jour(s))</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Motif :</td>
              <td style="padding: 6px 0; color: #334155;">${motif || 'Aucun motif particulier précisé'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Justificatif :</td>
              <td style="padding: 6px 0;">
                ${hasJustificatif ? '<span style="color: #16a34a; font-weight: 600;">📎 Justificatif / Certificat médical joint</span>' : '<span style="color: #94a3b8;">Aucun fichier joint</span>'}
              </td>
            </tr>
          </table>
        </div>

        ${conflictHtml}

        <div style="margin: 26px 0 16px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
          <div style="font-weight: 700; color: #166534; font-size: 0.96rem; margin-bottom: 6px;">
            ⚡ Décision Rapide en 1 Clic (${deciderRoleLabel})
          </div>
          <div style="font-size: 0.82rem; color: #15803d; margin-bottom: 16px;">
            Cliquez directement sur l'une des deux options ci-dessous (sans besoin de vous connecter) :
          </div>
          <div style="margin: 12px 0;">
            <a href="${approveUrl}" style="background-color: #16a34a; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 0.95rem; display: inline-block; box-shadow: 0 3px 8px rgba(22, 163, 74, 0.4); margin: 6px;">
              ✓ ACCEPTER LA DEMANDE
            </a>
            <a href="${rejectUrl}" style="background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 0.95rem; display: inline-block; box-shadow: 0 3px 8px rgba(220, 38, 38, 0.4); margin: 6px;">
              ✗ REFUSER LA DEMANDE
            </a>
          </div>
          <div style="font-size: 0.74rem; color: #64748b; margin-top: 10px;">
            Ce clic sécurisé enregistre instantanément votre décision officielle sans nécessiter de mot de passe.
          </div>
        </div>

        <div style="margin-top: 20px; padding: 12px 14px; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; font-size: 0.82rem; color: #475569;">
          <strong>Accès complet :</strong> Vous pouvez également vous connecter sur le <a href="http://localhost:8082/#absences" style="color: #2563eb; font-weight: 600; text-decoration: none;">Portail RH GICA</a> pour consulter tous les dossiers.
        </div>
      </div>

      <div style="padding: 12px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 0.76rem; color: #64748b; text-align: center;">
        SCHB GICA — Serveur de messagerie officiel <strong>mail.dz-com.com</strong> (&lt;${adminCopy}&gt;)
      </div>
    </div>
  `;
}

// Générateur d'email de confirmation officielle de congé approuvé par la DRH
function generateApprovalEmailHtml({
  empNom,
  empMatricule,
  empDepartement,
  empPoste,
  typeConge,
  dateDebut,
  dateFin,
  dureeJours,
  drhDecidePar,
  dateDecision
}) {
  const adminCopy = smtpConfig.auth.user;
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: #ffffff; padding: 22px 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Portail RH — SCHB GICA</h2>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">✓ VALIDATION OFFICIELLE DRH</span>
        </div>
        <div style="font-size: 0.84rem; opacity: 0.9; margin-top: 5px;">Société des Ciments de Hamma Bouziane</div>
      </div>

      <div style="padding: 24px; color: #1e293b;">
        <div style="margin-bottom: 20px; padding: 14px 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-left: 5px solid #10b981; border-radius: 6px;">
          <h3 style="margin: 0 0 6px 0; color: #065f46; font-size: 1.1rem; font-weight: 700;">
            Félicitations, votre demande de congé est approuvée !
          </h3>
          <p style="margin: 0; font-size: 0.88rem; color: #047857; line-height: 1.5;">
            Votre demande de congé a été définitivement approuvée par la Direction des Ressources Humaines (<strong>${drhDecidePar}</strong>).
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Bénéficiaire :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${empNom} <span style="font-size: 0.8rem; color: #64748b; font-weight: 500;">(Matricule: ${empMatricule})</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Poste / Service :</td>
              <td style="padding: 6px 0; font-weight: 600; color: #334155;">${empPoste || 'Collaborateur'} · ${empDepartement || 'GICA'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Type de congé :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #059669;">Congé ${typeConge}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Période accordée :</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">Du ${dateDebut} au ${dateFin}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Durée officielle :</td>
              <td style="padding: 6px 0; font-weight: 800; color: #065f46; font-size: 0.95rem;">${dureeJours} jour(s) ouvrable(s)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Date de validation :</td>
              <td style="padding: 6px 0; font-weight: 600; color: #334155;">${dateDecision || 'Ce jour'}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 14px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.85rem; color: #166534; line-height: 1.5;">
          📄 <strong>Titre de congé officiel :</strong> Votre attestation officielle est disponible sur votre espace personnel dans la rubrique <strong>Historique des congés</strong>, où vous pouvez télécharger et imprimer le titre officiel signé.
        </div>
      </div>

      <div style="padding: 12px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 0.76rem; color: #64748b; text-align: center;">
        SCHB GICA — Société des Ciments de Hamma Bouziane · Serveur SMTP officiel <strong>mail.dz-com.com</strong> (&lt;${adminCopy}&gt;)
      </div>
    </div>
  `;
}

// Initialisation de la base de données MySQL `gica`
initDB().then(() => {
  console.log("Serveur connecté à la base MySQL (Base: GICA).");
  migratePlaintextPasswords();
}).catch(err => {
  console.error("Erreur lors de l'initialisation de MySQL :", err.message);
});

function migratePlaintextPasswords() {
  db.all("SELECT matricule, password FROM employees", [], (err, rows) => {
    if (err || !rows) return;
    const toMigrate = rows.filter(r => r.password && !/^\$2[aby]\$/.test(r.password));
    if (toMigrate.length === 0) return;

    console.log(`[Sécurité] Migration de ${toMigrate.length} mot(s) de passe en clair vers bcrypt...`);
    db.serialize(() => {
      const stmt = db.prepare("UPDATE employees SET password = ? WHERE matricule = ?");
      toMigrate.forEach(r => {
        const hash = bcrypt.hashSync(r.password, 10);
        stmt.run([hash, r.matricule]);
      });
      stmt.finalize(() => {
        console.log("[Sécurité] Migration des mots de passe terminée.");
      });
    });
  });
}

// --- HELPER FUNCTIONS ---

// Récupérer la configuration
function getConfig() {
  return new Promise((resolve) => {
    db.get("SELECT value FROM settings WHERE key = 'config'", (err, row) => {
      if (err || !row) {
        resolve(null);
      } else {
        resolve(JSON.parse(row.value));
      }
    });
  });
}

// Calculer les stats de pointage (nuit, retard, heures supp, 3x8)
function calculatePointageStats(employee, date, entree, sortie, config) {
  let retard = 0;
  let heuresSupp = 0;
  let heuresTravaillees = 0;
  let anomalie = 0;
  let shiftType = 'standard';

  if (!entree || !sortie) {
    return { retard, heuresSupp, heuresTravaillees, anomalie: 1, shiftType, notes: 'Pointage incomplet' };
  }

  // Convertir l'entrée en minutes
  const [hEntree, mEntree] = entree.split(':').map(Number);
  const minutesEntree = hEntree * 60 + mEntree;

  // Détecter le shift de l'employé
  // Si l'employé commence vers 06h -> Matin. Si 14h -> Après-midi. Si 22h -> Nuit.
  // Sinon standard.
  const heureCommencement = hEntree;
  if (heureCommencement >= 5 && heureCommencement < 7) {
    shiftType = 'matin';
  } else if (heureCommencement >= 13 && heureCommencement < 15) {
    shiftType = 'apresmidi';
  } else if (heureCommencement >= 21 && heureCommencement < 23) {
    shiftType = 'nuit';
  }

  // Obtenir l'horaire de référence (adapté si c'est un travailleur posté en rotation)
  let refDebut = employee.horaire_debut || '08:00';
  let refFin = employee.horaire_fin || '16:00';

  if (employee.cycle_travail > 0) {
    if (shiftType === 'matin') {
      refDebut = '06:00';
      refFin = '14:00';
    } else if (shiftType === 'apresmidi') {
      refDebut = '14:00';
      refFin = '22:00';
    } else if (shiftType === 'nuit') {
      refDebut = '22:00';
      refFin = '06:00';
    }
  }

  const [hDebutRef, mDebutRef] = refDebut.split(':').map(Number);
  const minutesRef = hDebutRef * 60 + mDebutRef;

  // Calcul du retard (uniquement sur le shift de départ)
  const diffRetard = minutesEntree - minutesRef;
  const tolerance = config?.horaires?.toleranceRetard || 15;
  if (diffRetard > tolerance) {
    retard = diffRetard;
  }

  // Convertir la sortie en minutes
  const [hSortie, mSortie] = sortie.split(':').map(Number);
  let minutesSortie = hSortie * 60 + mSortie;

  // Gérer le pointage de nuit / à cheval (ex: 22h00 - 06h00)
  if (minutesSortie < minutesEntree) {
    minutesSortie += 1440; // Ajouter 24 heures en minutes
  }

  const totalMinutes = minutesSortie - minutesEntree;
  heuresTravaillees = parseFloat((totalMinutes / 60).toFixed(2));

  // Détecter si la journée est un jour de repos hebdomadaire ou férié
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dateObj.getUTCDay(); // 0 = Dimanche, 5 = Vendredi, 6 = Samedi

  // Vérifier si un cycle de rotation est actif pour l'employé
  const hasCycle = employee.cycle_travail > 0 && employee.cycle_repos > 0 && employee.cycle_debut;
  let isReposDay = false;
  if (hasCycle) {
    const [cyY, cyM, cyD] = employee.cycle_debut.split('-').map(Number);
    const dateDebut = new Date(Date.UTC(cyY, cyM - 1, cyD));
    const diffTime = dateObj - dateDebut;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      const cycleLength = employee.cycle_travail + employee.cycle_repos;
      const cycleIndex = diffDays % cycleLength;
      if (cycleIndex >= employee.cycle_travail) {
        isReposDay = true;
      }
    }
  }

  const isFriday = hasCycle ? false : (dayOfWeek === 5);
  const isSaturday = hasCycle ? false : (dayOfWeek === 6);
  const isHoliday = config?.joursFeries?.includes(date) || false;
  const isReposOrHoliday = isReposDay || isFriday || isHoliday;

  // Déterminer la limite standard de la journée (0 pour Repos et Jours Fériés)
  let standardHoursLimit = 8.0;
  if (isReposOrHoliday || isSaturday) {
    standardHoursLimit = 0.0;
  } else if (refDebut && refFin) {
    const [hFinRef, mFinRef] = refFin.split(':').map(Number);
    let minutesFinRef = hFinRef * 60 + mFinRef;
    if (minutesFinRef < minutesRef) minutesFinRef += 1440;

    // Si l'entrée se fait après ou à la fin du shift standard (ex: heure sup seule)
    if (minutesEntree >= minutesFinRef - 15) {
      standardHoursLimit = 0.0;
    } else {
      standardHoursLimit = (minutesFinRef - minutesRef) / 60;
    }
  }

  const diffFin = heuresTravaillees - standardHoursLimit;
  const seuilMinutes = config?.horaires?.seuilHeuresSupp || 60;
  const seuilHeures = seuilMinutes / 60;

  // Calculer les minutes de nuit travaillées uniquement sur la partie standard (avant les heures supp)
  let minutesNuit = 0;
  const endStandardMinutes = minutesSortie - (diffFin >= seuilHeures ? Math.round(diffFin * 60) : 0);
  for (let m = minutesEntree; m < endStandardMinutes; m++) {
    const mod = m % 1440;
    if (mod < 300 || mod >= 1260) { // < 05:00 ou >= 21:00
      minutesNuit++;
    }
  }

  const heuresNuit = minutesNuit / 60;
  const coeffNuit = config?.horaires?.coeffNuit || 1.25;
  const bonusNuit = heuresNuit * (coeffNuit - 1.0); // +25% par défaut

  let notes = '';
  let recupDays = 0.0;

  // Calcul selon la Loi 90-11 relative aux relations de travail en Algérie :
  if (isReposOrHoliday) {
    // Article 32 & 33 : Le travail le jour de repos hebdomadaire (Vendredi) ou férié
    // donne droit à une majoration de 100% (les heures travaillées comptent double).

    // Échelle pour la récupération sur Vendredi/Férié :
    // > 8h -> 1.5 jours (12.0h)
    // > 4h et <= 8h -> 1.0 jour (8.0h)
    // > 0 et <= 4h -> 0.5 jour (4.0h)
    if (heuresTravaillees > 8) {
      recupDays = 1.5;
    } else if (heuresTravaillees > 4) {
      recupDays = 1.0;
    } else if (heuresTravaillees > 0) {
      recupDays = 0.5;
    }

    // Heures de récupération équivalentes créditées
    heuresSupp = recupDays * 8.0;

    notes = `${heuresTravaillees.toFixed(1).replace('.0','')}H x 100% -> ${recupDays}j`;
  } else {
    // Heures supplémentaires en semaine ou Samedi
    if (diffFin >= seuilHeures) {
      const overtimeMinutes = Math.round(diffFin * 60);
      let minutes50 = 0;
      let minutes75 = 0;
      let minutes100 = 0;

      const startOvertime = minutesSortie - overtimeMinutes;

      for (let m = startOvertime; m < minutesSortie; m++) {
        const mod = m % 1440;
        const isNight = (mod < 300 || mod >= 1260); // 21:00 à 05:00

        if (isNight) {
          minutes100++;
        } else {
          const overtimeIndex = m - startOvertime;
          if (overtimeIndex < 240) { // Les 4 premières heures d'heures sup de jour
            minutes50++;
          } else {
            minutes75++;
          }
        }
      }

      const hours50 = minutes50 / 60;
      const hours75 = minutes75 / 60;
      const hours100 = minutes100 / 60;

      // Equivalent heures de récupération créditées (avec majorations de 150%, 175%, 200%)
      heuresSupp = (hours50 * 1.5) + (hours75 * 1.75) + (hours100 * 2.0);

      const formulaParts = [];
      if (hours50 > 0) formulaParts.push(`${hours50.toFixed(1).replace('.0','')}H x 50%`);
      if (hours75 > 0) formulaParts.push(`${hours75.toFixed(1).replace('.0','')}H x 75%`);
      if (hours100 > 0) formulaParts.push(`${hours100.toFixed(1).replace('.0','')}H x 100%`);

      const formulaStr = formulaParts.join(' + ');
      notes = `${isSaturday ? 'Sat: ' : ''}${formulaStr} -> ${parseFloat((heuresSupp / 8).toFixed(2))}j`;
    } else {
      if (isSaturday) {
        notes = `Sat: 0H -> 0j`;
      } else {
        notes = `${heuresTravaillees.toFixed(1).replace('.0','')}H Std x 100%`;
      }
    }
  }

  // Ajouter la majoration de nuit sur le standard (+25%)
  if (bonusNuit > 0) {
    notes += ` + ${heuresNuit.toFixed(1).replace('.0','')}H x 125%`;
  }

  return { retard, heuresSupp, heuresTravaillees, anomalie: 0, shiftType, notes, recupDays };
}

// --- AUTHENTIFICATION & AUTORISATION ---

function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    // Utilisé uniquement par l'EventSource (SSE) qui ne peut pas envoyer d'en-têtes personnalisés
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentification requise." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Session invalide ou expirée. Veuillez vous reconnecter." });
    }
    req.user = decoded; // { matricule, role, iat, exp }
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé : vous n'avez pas les droits nécessaires pour cette action." });
    }
    next();
  };
}

// --- LIMITATION DES TENTATIVES DE CONNEXION (anti brute-force) ---
const loginAttempts = new Map(); // clé "matricule_ip" -> { count, firstAttemptAt }
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 6;

function isRateLimited(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordFailedAttempt(key) {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count++;
  }
}

function clearAttempts(key) {
  loginAttempts.delete(key);
}

// --- Real-time updates (SSE) ---
let sseClients = [];
function broadcast(event) {
  sseClients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (e) {
      console.error("Erreur d'envoi SSE:", e);
    }
  });
}

app.get('/api/events', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// Middleware d'interception pour diffuser les mises à jour de données en temps réel
app.use((req, res, next) => {
  if ((req.method === 'POST' || req.method === 'DELETE') && req.path.startsWith('/api') && req.path !== '/api/login' && req.path !== '/api/events') {
    const originalJson = res.json;
    res.json = function(data) {
      originalJson.apply(res, arguments);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Diffuser la notification de modification de données
        broadcast({ type: 'update', path: req.path });
      }
    };
  }
  next();
});

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send("Serveur API GICA (Backend) actif sur le port 8081. Accédez au frontend via le serveur Vite.");
});

app.get('/api', (req, res) => {
  res.json({ status: "ok", message: "Serveur API GICA en cours d'exécution sur le port 8081" });
});

// 1. Authentification
app.post('/api/login', (req, res) => {
  const { matricule, password } = req.body;
  if (!matricule || !password) {
    return res.status(400).json({ error: "Matricule et mot de passe requis." });
  }

  const rlKey = `${matricule}_${req.ip}`;
  if (isRateLimited(rlKey)) {
    return res.status(429).json({ error: "Trop de tentatives échouées. Veuillez réessayer dans quelques minutes." });
  }

  db.get("SELECT * FROM employees WHERE matricule = ? AND actif = 1", [matricule], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!user) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: "Matricule ou mot de passe incorrect." });
    }

    let match = false;
    try {
      match = await bcrypt.compare(password, user.password);
    } catch (e) {
      match = false;
    }

    if (!match) {
      recordFailedAttempt(rlKey);
      return res.status(401).json({ error: "Matricule ou mot de passe incorrect." });
    }

    clearAttempts(rlKey);

    const token = jwt.sign({ matricule: user.matricule, role: user.role }, JWT_SECRET, { expiresIn: '12h' });

    res.json({
      token,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      departement: user.departement,
      poste: user.poste,
      role: user.role,
      solde_recuperation: user.solde_recuperation,
      solde_conge: user.solde_conge,
      horaire_debut: user.horaire_debut,
      horaire_fin: user.horaire_fin,
      SuperieurMatricule: user.SuperieurMatricule || null,
      Email: user.Email || null
    });
  });
});

// 2. GET Employés (annuaire : le DRH voit tout, les autres ne voient que leur département)
app.get('/api/employees', authenticate, (req, res) => {
  // Seul le DRH peut accéder à l'annuaire complet de l'entreprise.
  // Les superviseurs et collaborateurs ne voient que les employés de leur propre département.
  if (req.user.role === 'hr') {
    db.all(`SELECT ${EMP_COLS} FROM employees WHERE actif = 1 ORDER BY departement, nom, prenom`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    // Récupérer le département de l'utilisateur connecté puis filtrer
    db.get(`SELECT departement FROM employees WHERE matricule = ?`, [req.user.matricule], (err, userRow) => {
      if (err) return res.status(500).json({ error: err.message });
      const dept = userRow?.departement || '';
      db.all(
        `SELECT ${EMP_COLS} FROM employees WHERE actif = 1 AND departement = ? ORDER BY nom, prenom`,
        [dept],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json(rows);
        }
      );
    });
  }
});

// GET un Employé spécifique (un simple collaborateur ne peut consulter que sa propre fiche)
app.get('/api/employees/:matricule', authenticate, (req, res) => {
  if (req.user.role === 'employee' && req.user.matricule !== req.params.matricule) {
    return res.status(403).json({ error: "Accès non autorisé à la fiche d'un autre employé." });
  }
  db.get(`SELECT ${EMP_COLS_WITH_PHOTO} FROM employees WHERE matricule = ? AND actif = 1`, [req.params.matricule], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Employé introuvable." });
    res.json(row);
  });
});

// POST Employé (Créer ou modifier) — réservé à hr / supervisor (cohérent avec la navigation existante)
app.post('/api/employees', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { matricule, nom, prenom, departement, poste, date_embauche, horaire_debut, horaire_fin, role, solde_recuperation, solde_conge, password, cycle_travail, cycle_repos, cycle_debut, photo, email, Email } = req.body;
  const cleanEmail = (email || Email || '').trim() || null;

  if (!matricule || !nom || !prenom || !departement || !poste || !date_embauche) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  if (role && !['employee', 'supervisor', 'hr'].includes(role)) {
    return res.status(400).json({ error: "Rôle invalide." });
  }
  // Limite raisonnable pour une photo encodée en base64 (~1.4 Mo de données brutes)
  if (photo && photo.length > 2_000_000) {
    return res.status(400).json({ error: "La photo est trop volumineuse (max ~1.5 Mo)." });
  }

  // Vérifier si l'employé existe déjà
  db.get("SELECT matricule FROM employees WHERE matricule = ?", [matricule], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    const cTravail = parseInt(cycle_travail) || 0;
    const cRepos = parseInt(cycle_repos) || 0;
    const cDebut = cycle_debut || '';

    try {
      if (row) {
        // Update — le mot de passe n'est modifié que si un nouveau a été explicitement saisi
        let sql = `UPDATE employees SET
          nom = ?, prenom = ?, departement = ?, poste = ?, date_embauche = ?,
          horaire_debut = ?, horaire_fin = ?, role = ?, solde_conge = ?,
          cycle_travail = ?, cycle_repos = ?, cycle_debut = ?, Email = ?`;
        const params = [nom, prenom, departement, poste, date_embauche, horaire_debut, horaire_fin, role, solde_conge, cTravail, cRepos, cDebut, cleanEmail];

        if (password && String(password).trim()) {
          const hash = await bcrypt.hash(String(password).trim(), 10);
          sql += `, password = ?`;
          params.push(hash);
        }
        if (photo !== undefined) {
          sql += `, photo = ?`;
          params.push(photo || null);
        }
        sql += ` WHERE matricule = ?`;
        params.push(matricule);

        db.run(sql, params, function(err) {
          if (err) return res.status(500).json({ error: err.message });
          logAudit(req, 'Modification employé', matricule, `${prenom} ${nom}`);
          res.json({ success: true, action: 'updated' });
        });
      } else {
        // Insert — mot de passe par défaut = matricule si non fourni, toujours haché avant stockage
        const pwdPlain = (password && String(password).trim()) || matricule;
        const hash = await bcrypt.hash(pwdPlain, 10);

        db.run(`INSERT INTO employees
          (matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation, solde_conge, horaire_debut, horaire_fin, role, password, cycle_travail, cycle_repos, cycle_debut, actif, photo, last_accrual_date, Email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [matricule, nom, prenom, departement, poste, date_embauche, solde_recuperation || 0, solde_conge || 30.0, horaire_debut, horaire_fin, role || 'employee', hash, cTravail, cRepos, cDebut, photo || null, date_embauche, cleanEmail],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            logAudit(req, 'Création employé', matricule, `${prenom} ${nom}`);
            res.json({ success: true, action: 'created' });
          }
        );
      }
    } catch (hashErr) {
      res.status(500).json({ error: "Erreur lors du traitement du mot de passe." });
    }
  });
});

// DELETE Employé (Désactiver actif = 0)
app.delete('/api/employees/:matricule', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  db.run("UPDATE employees SET actif = 0 WHERE matricule = ?", [req.params.matricule], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req, 'Suppression employé', req.params.matricule);
    res.json({ success: true });
  });
});

// --- ORGANIGRAMME & HIÉRARCHIE DES EMPLOYÉS ---
app.get('/api/hierarchy', authenticate, (req, res) => {
  let userFilter = '';
  const params = [];

  // Règle de confidentialité : un collaborateur ('employee') ne voit que son propre département
  // et son supérieur direct (ex: IT Manager ou DRH), il ne doit pas voir tous les départements.
  if (req.user.role === 'employee') {
    userFilter = `
      AND (
        e.departement = (SELECT departement FROM employees WHERE matricule = ?)
        OR e.matricule = (SELECT SuperieurMatricule FROM employees WHERE matricule = ?)
        OR e.matricule = ?
      )
    `;
    params.push(req.user.matricule, req.user.matricule, req.user.matricule);
  }

  const sql = `
    SELECT e.matricule, e.nom, e.prenom, e.departement, e.poste, e.role, e.Email, e.SuperieurMatricule, e.actif, e.photo,
           sup.nom AS sup_nom, sup.prenom AS sup_prenom, sup.poste AS sup_poste, sup.Email AS sup_email,
           i.id AS interim_id, i.matricule_interimaire, i.date_debut AS interim_date_debut, i.date_fin AS interim_date_fin, i.statut AS interim_statut,
           r.nom AS interimaire_nom, r.prenom AS interimaire_prenom, r.poste AS interimaire_poste, r.Email AS interimaire_email,
           (SELECT COUNT(*) FROM employees sub WHERE sub.SuperieurMatricule = e.matricule AND sub.actif = 1) AS subordonnes_count
    FROM employees e
    LEFT JOIN employees sup ON e.SuperieurMatricule = sup.matricule
    LEFT JOIN (
      SELECT i1.* FROM interims i1
      INNER JOIN (
        SELECT matricule_titulaire, MAX(created_at) as max_created
        FROM interims
        WHERE statut = 'Actif' AND CURDATE() BETWEEN date_debut AND date_fin
        GROUP BY matricule_titulaire
      ) i2 ON i1.matricule_titulaire = i2.matricule_titulaire AND i1.created_at = i2.max_created
    ) i ON e.matricule = i.matricule_titulaire
    LEFT JOIN employees r ON i.matricule_interimaire = r.matricule
    WHERE e.actif = 1 ${userFilter}
    ORDER BY e.departement, e.role DESC, e.nom, e.prenom
  `;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/employees/:matricule/supervisor', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { superieur_matricule } = req.body;
  if (superieur_matricule === req.params.matricule) {
    return res.status(400).json({ error: "Un employé ne peut pas être son propre supérieur hiérarchique." });
  }

  db.run(
    "UPDATE employees SET SuperieurMatricule = ? WHERE matricule = ?",
    [superieur_matricule || null, req.params.matricule],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req, 'Modification supérieur hiérarchique', req.params.matricule, `Nouveau responsable : ${superieur_matricule || 'Aucun'}`);
      broadcast({ type: 'update', path: '/api/hierarchy' });
      res.json({ success: true, matricule: req.params.matricule, superieur_matricule });
    }
  );
});

// --- GESTION DES INTÉRIMS (DÉLÉGATION DE POUVOIR DE VALIDATION) ---
app.get('/api/interims', authenticate, (req, res) => {
  let userFilter = '';
  const params = [];

  // Pour un employé, n'afficher que les intérims le concernant directement (son chef absent ou s'il est désigné intérimaire)
  if (req.user.role === 'employee') {
    userFilter = `
      WHERE i.matricule_interimaire = ?
         OR i.matricule_titulaire = (SELECT SuperieurMatricule FROM employees WHERE matricule = ?)
         OR i.matricule_titulaire IN (
           SELECT matricule FROM employees 
           WHERE departement = (SELECT departement FROM employees WHERE matricule = ?) AND role = 'supervisor'
         )
    `;
    params.push(req.user.matricule, req.user.matricule, req.user.matricule);
  }

  const sql = `
    SELECT i.*,
           t.nom AS titulaire_nom, t.prenom AS titulaire_prenom, t.poste AS titulaire_poste, t.departement AS titulaire_departement, t.Email AS titulaire_email,
           r.nom AS interimaire_nom, r.prenom AS interimaire_prenom, r.poste AS interimaire_poste, r.departement AS interimaire_departement, r.Email AS interimaire_email
    FROM interims i
    LEFT JOIN employees t ON i.matricule_titulaire = t.matricule
    LEFT JOIN employees r ON i.matricule_interimaire = r.matricule
    ${userFilter}
    ORDER BY i.created_at DESC
  `;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/interims', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { matricule_titulaire, matricule_interimaire, date_debut, date_fin, motif } = req.body;
  if (!matricule_titulaire || !matricule_interimaire || !date_debut || !date_fin) {
    return res.status(400).json({ error: "Titulaire, intérimaire, date début et date fin requis." });
  }
  if (matricule_titulaire === matricule_interimaire) {
    return res.status(400).json({ error: "Le titulaire et l'intérimaire ne peuvent pas être la même personne." });
  }

  if (req.user.role === 'supervisor' && req.user.matricule !== matricule_titulaire) {
    return res.status(403).json({ error: "Vous ne pouvez désigner un intérimaire que pour votre propre poste." });
  }

  const id = randomUUID();
  db.run(
    `INSERT INTO interims (id, matricule_titulaire, matricule_interimaire, date_debut, date_fin, statut, motif)
     VALUES (?, ?, ?, ?, ?, 'Actif', ?)`,
    [id, matricule_titulaire, matricule_interimaire, date_debut, date_fin, motif || "Délégation d'intérim pour congé"],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get("SELECT matricule, nom, prenom FROM employees WHERE matricule = ?", [matricule_titulaire], (e1, tit) => {
        db.get("SELECT matricule, nom, prenom, Email FROM employees WHERE matricule = ?", [matricule_interimaire], async (e2, intEmp) => {
          const titNom = tit ? `${tit.prenom} ${tit.nom}` : matricule_titulaire;
          if (intEmp) {
            await createNotification({
              matricule_destinataire: intEmp.matricule,
              titre: `Désignation d'Intérim — Remplacement de ${titNom}`,
              message: `Vous avez été désigné(e) comme responsable par intérim pour ${titNom} du ${date_debut} au ${date_fin}. Durant cette période, les demandes de congé de son équipe vous seront automatiquement transmises pour validation préalable.`,
              type: 'system',
              lien: '#organigramme',
              email_destinataire: intEmp.Email,
              email_sent: 1
            });
          }
        });
      });

      logAudit(req, "Création d'intérim", matricule_titulaire, `Intérimaire : ${matricule_interimaire} du ${date_debut} au ${date_fin}`);
      broadcast({ type: 'update', path: '/api/interims' });
      res.json({ success: true, id });
    }
  );
});

app.post('/api/interims/:id/terminate', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  db.run("UPDATE interims SET statut = 'Terminé' WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req, "Fin d'intérim", req.params.id, "Statut Terminé");
    broadcast({ type: 'update', path: '/api/interims' });
    res.json({ success: true });
  });
});


// --- Documents Employé (contrat, CNI, certificats...) ---
app.get('/api/employees/:matricule/documents', authenticate, (req, res) => {
  if (req.user.role === 'employee' && req.user.matricule !== req.params.matricule) {
    return res.status(403).json({ error: "Accès non autorisé." });
  }
  db.all(
    "SELECT id, matricule, nom_fichier, type_doc, uploaded_at FROM employee_documents WHERE matricule = ? ORDER BY uploaded_at DESC",
    [req.params.matricule],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/employees/:matricule/documents', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { nom_fichier, type_doc, contenu } = req.body;
  if (!nom_fichier || !contenu) {
    return res.status(400).json({ error: "Nom de fichier et contenu requis." });
  }
  if (contenu.length > 6_000_000) {
    return res.status(400).json({ error: "Fichier trop volumineux (max ~4.5 Mo)." });
  }
  const id = randomUUID();
  db.run(
    `INSERT INTO employee_documents (id, matricule, nom_fichier, type_doc, contenu) VALUES (?, ?, ?, ?, ?)`,
    [id, req.params.matricule, nom_fichier, type_doc || 'Autre', contenu],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAudit(req, 'Ajout document employé', req.params.matricule, nom_fichier);
      res.json({ success: true, id });
    }
  );
});

app.get('/api/documents/:id', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  db.get("SELECT * FROM employee_documents WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Document introuvable." });
    res.json(row);
  });
});

app.delete('/api/documents/:id', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  db.run("DELETE FROM employee_documents WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAudit(req, 'Suppression document employé', req.params.id);
    res.json({ success: true });
  });
});

// 3. GET Pointages (réservé à hr / supervisor, comme la page correspondante)
app.get('/api/pointages', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { date, matricule } = req.query;
  let sql = "SELECT * FROM pointages WHERE 1=1";
  const params = [];

  if (date) {
    sql += " AND date = ?";
    params.push(date);
  }
  if (matricule) {
    sql += " AND matricule = ?";
    params.push(matricule);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST Pointages (Sauvegarder lot de pointages importés ou un seul)
app.post('/api/pointages', authenticate, requireRole('hr', 'supervisor', 'admin', 'employee'), async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : [req.body];
  const config = await getConfig();

  // Récupérer tous les employés actifs pour accélérer les calculs
  db.all("SELECT * FROM employees WHERE actif = 1", [], (err, employees) => {
    if (err) return res.status(500).json({ error: err.message });

    db.serialize(() => {
      const stmt = db.prepare(`INSERT INTO pointages
        (id, matricule, date, heure_entree, heure_sortie, retard, heures_supp, heures_travaillees, anomalie, notes, shift_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
        heure_entree=excluded.heure_entree, heure_sortie=excluded.heure_sortie,
        retard=excluded.retard, heures_supp=excluded.heures_supp,
        heures_travaillees=excluded.heures_travaillees, anomalie=excluded.anomalie,
        notes=excluded.notes, shift_type=excluded.shift_type`);

      list.forEach(p => {
        const emp = employees.find(e => e.matricule === p.matricule);
        if (!emp) return; // Sauter si l'employé n'existe pas

        // Recalculer les statistiques de pointage côté serveur pour plus de sécurité
        const stats = calculatePointageStats(emp, p.date, p.heureEntree, p.heureSortie, config);

        const id = p.id || `p_${p.matricule}_${p.date}`;
        let finalNotes = stats.notes;
        if (p.notes) {
          const cleanPNote = p.notes.trim();
          if (cleanPNote !== 'Enregistrement' &&
              cleanPNote !== 'Import Pointeuse' &&
              cleanPNote !== 'Correction Manuelle' &&
              cleanPNote !== stats.notes &&
              !cleanPNote.includes(stats.notes)) {
            finalNotes = `${cleanPNote} (${stats.notes})`;
          }
        }
        stmt.run([
          id, p.matricule, p.date,
          p.heureEntree || null, p.heureSortie || null,
          stats.retard, stats.heuresSupp, stats.heuresTravaillees,
          stats.anomalie, finalNotes, stats.shiftType
        ]);
      });

      stmt.finalize((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: list.length });
      });
    });
  });
});

// DELETE Pointage
app.delete('/api/pointages/:id', authenticate, requireRole('hr', 'supervisor', 'admin', 'employee'), (req, res) => {
  db.run("DELETE FROM pointages WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 4. GET Récupérations (un collaborateur ne voit que ses propres demandes)
app.get('/api/recuperations', authenticate, (req, res) => {
  let { matricule } = req.query;
  if (req.user.role === 'employee') {
    matricule = req.user.matricule;
  }

  let sql = "SELECT * FROM recuperations WHERE 1=1";
  const params = [];

  if (matricule) {
    sql += " AND matricule = ?";
    params.push(matricule);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST Récupération (Créer une demande, ou HR/Superviseur : approuver/refuser)
app.post('/api/recuperations', authenticate, (req, res) => {
  const { id, matricule: bodyMatricule, date_demande, date_debut, date_fin, duree, motif, statut, decide_par, date_decision } = req.body;

  if (!id) {
    // Nouvelle demande : un collaborateur ne peut demander que pour lui-même
    const matricule = req.user.role === 'employee' ? req.user.matricule : bodyMatricule;

    if (!matricule || !duree || !motif) {
      return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    // Seuls hr/superviseur peuvent créer une demande déjà "Approuvé" (saisie manuelle)
    let finalStatut = statut || 'En attente';
    if (finalStatut === 'Approuvé' && req.user.role === 'employee') {
      finalStatut = 'En attente';
    }

    const newId = randomUUID();
    const today = new Date().toISOString().split('T')[0];
    const finalDecidePar = finalStatut === 'Approuvé' ? (decide_par || 'RH') : null;
    const finalDateDecision = finalStatut === 'Approuvé' ? (date_decision || today) : null;

    db.serialize(() => {
      db.run(`INSERT INTO recuperations
        (id, matricule, date_demande, date_debut, date_fin, duree, motif, statut, decide_par, date_decision)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, matricule, date_demande || today, date_debut, date_fin || date_debut, duree, motif, finalStatut, finalDecidePar, finalDateDecision],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });

          if (finalStatut === 'Approuvé') {
            db.run("UPDATE employees SET solde_recuperation = solde_recuperation - ? WHERE matricule = ?", [duree, matricule], (err) => {
              if (err) console.error(err);
            });
          }
          broadcast({ type: 'update', path: '/api/recuperations' });

          if (finalStatut === 'En attente') {
            db.get("SELECT matricule, nom, prenom, departement, SuperieurMatricule FROM employees WHERE matricule = ?", [matricule], (errE, empInfo) => {
              if (!errE && empInfo) {
                const targetSup = empInfo.SuperieurMatricule || '1002';
                createNotification({
                  matricule_destinataire: targetSup,
                  titre: `Nouvelle demande de récupération — ${empInfo.prenom} ${empInfo.nom}`,
                  message: `L'employé ${empInfo.prenom} ${empInfo.nom} a déposé une demande de récupération de ${(duree/8).toFixed(1)} jour(s) (${duree}h) pour le motif : ${motif || 'Non précisé'}.`,
                  type: 'recuperation',
                  lien: '#recuperation?tab=attente',
                  email_sent: 0
                });
              }
            });
          }
          res.json({ success: true, id: newId });
        }
      );
    });
  } else {
    // Mise à jour de statut (Approbation/Refus) — réservé à hr / superviseur
    if (req.user.role !== 'hr' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: "Seuls RH ou Superviseur peuvent approuver/refuser une demande." });
    }

    // 1. Récupérer l'ancienne demande pour comparer le statut. On se fie UNIQUEMENT à ces
    // valeurs stockées en base (jamais à celles envoyées par le client) pour ajuster le solde.
    db.get("SELECT * FROM recuperations WHERE id = ?", [id], (err, oldRequest) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldRequest) return res.status(404).json({ error: "Demande introuvable." });

      db.serialize(() => {
        db.run(`UPDATE recuperations SET
          statut = ?, decide_par = ?, date_decision = ?
          WHERE id = ?`,
          [statut, decide_par, date_decision, id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Gérer les impacts sur le solde d'employé à partir des valeurs FIABLES de la demande d'origine
            if (oldRequest.statut !== 'Approuvé' && statut === 'Approuvé') {
              db.run("UPDATE employees SET solde_recuperation = solde_recuperation - ? WHERE matricule = ?", [oldRequest.duree, oldRequest.matricule]);
            } else if (oldRequest.statut === 'Approuvé' && statut !== 'Approuvé') {
              db.run("UPDATE employees SET solde_recuperation = solde_recuperation + ? WHERE matricule = ?", [oldRequest.duree, oldRequest.matricule]);
            }

            logAudit(req, `Décision RH récupération : ${statut}`, oldRequest.matricule, `${oldRequest.duree}h — ${oldRequest.motif}`);
            broadcast({ type: 'update', path: '/api/recuperations' });

            createNotification({
              matricule_destinataire: oldRequest.matricule,
              titre: statut === 'Approuvé' ? 'Demande de récupération approuvée' : 'Demande de récupération refusée',
              message: `Votre demande de récupération de ${(oldRequest.duree/8).toFixed(1)} jour(s) (${oldRequest.duree}h) a été ${statut.toLowerCase()}e par ${decide_par || 'la Direction RH'}.`,
              type: 'recuperation',
              lien: '#recuperation?tab=historique',
              email_sent: 0
            });

            res.json({ success: true });
          }
        );
      });
    });
  }
});

// Pré-validation Superviseur (étape informative avant la décision finale RH — n'affecte pas le solde)
app.post('/api/recuperations/:id/supervisor-decision', authenticate, requireRole('supervisor'), (req, res) => {
  const { statut } = req.body;
  if (!['Approuvé', 'Refusé'].includes(statut)) {
    return res.status(400).json({ error: "Statut invalide." });
  }
  const today = new Date().toISOString().split('T')[0];
  db.get("SELECT * FROM recuperations WHERE id = ?", [req.params.id], (err, reqRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!reqRow) return res.status(404).json({ error: "Demande introuvable." });

    db.run(
      `UPDATE recuperations SET statut_superviseur = ?, decide_par_superviseur = ?, date_decision_superviseur = ? WHERE id = ?`,
      [statut, req.user.matricule, today, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        logAudit(req, `Pré-validation superviseur récupération : ${statut}`, reqRow.matricule, `${reqRow.duree}h — ${reqRow.motif}`);
        broadcast({ type: 'update', path: '/api/recuperations' });

        createNotification({
          matricule_destinataire: reqRow.matricule,
          titre: statut === 'Approuvé' ? 'Avis favorable sur votre récupération' : 'Avis défavorable sur votre récupération',
          message: `Votre responsable a émis un avis ${statut === 'Approuvé' ? 'FAVORABLE' : 'DÉFAVORABLE'} sur votre demande de récupération de ${(reqRow.duree/8).toFixed(1)}j.`,
          type: 'recuperation',
          lien: '#recuperation?tab=attente',
          email_sent: 0
        });

        res.json({ success: true });
      }
    );
  });
});

// Créditer des heures de récupération directement à un employé (Validation mensuelle H. Supp)
app.post('/api/recuperations/credit', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  const { matricule, heures, motif } = req.body;
  if (!matricule || !heures) {
    return res.status(400).json({ error: "Matricule et heures requis." });
  }

  const id = `r_credit_${randomUUID()}`;
  const today = new Date().toISOString().split('T')[0];

  db.serialize(() => {
    db.run(`INSERT INTO recuperations
      (id, matricule, date_demande, date_debut, date_fin, duree, motif, statut, decide_par, date_decision)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Approuvé', 'Validation RH', ?)`,
      [id, matricule, today, today, today, heures, motif || 'Crédit Heures Supp', today],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // Augmenter le solde
        db.run("UPDATE employees SET solde_recuperation = solde_recuperation + ? WHERE matricule = ?", [heures, matricule], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, id });
        });
      }
    );
  });
});

// 5. GET Absences (Congés)
app.get('/api/absences', authenticate, (req, res) => {
  let { matricule } = req.query;

  // Jointure avec les infos de l'employé et de son supérieur / manager
  let sql = `SELECT a.id, a.matricule, a.date_demande, a.date_debut, a.date_fin, a.duree_jours, a.type_conge, a.motif,
                    a.statut, a.decide_par, a.date_decision, a.statut_superviseur, a.decide_par_superviseur, a.date_decision_superviseur,
                    (a.justificatif IS NOT NULL) AS has_justificatif,
                    e.nom, e.prenom, e.departement, e.poste, e.SuperieurMatricule, e.Email AS email_employe,
                    sup.nom AS sup_nom, sup.prenom AS sup_prenom, sup.poste AS sup_poste, sup.Email AS sup_email
             FROM absences a
             LEFT JOIN employees e ON a.matricule = e.matricule
             LEFT JOIN employees sup ON (a.decide_par_superviseur = sup.matricule OR (a.decide_par_superviseur IS NULL AND e.SuperieurMatricule = sup.matricule))
             WHERE 1=1`;
  const params = [];

  if (req.user.role === 'employee') {
    // Un collaborateur voit ses propres demandes,
    // ou celles de l'équipe pour laquelle il est actuellement désigné comme intérimaire actif
    sql += ` AND (a.matricule = ? OR e.SuperieurMatricule IN (
      SELECT matricule_titulaire FROM interims WHERE matricule_interimaire = ? AND statut = 'Actif' AND CURDATE() BETWEEN date_debut AND date_fin
    ))`;
    params.push(req.user.matricule, req.user.matricule);
  } else if (req.user.role === 'supervisor') {
    // Le manager voit : ses propres demandes, ses subordonnés directs, son département,
    // ou l'équipe pour laquelle il est intérimaire actif
    sql += ` AND (a.matricule = ? OR e.SuperieurMatricule = ? OR e.departement = (SELECT departement FROM employees WHERE matricule = ?) OR e.SuperieurMatricule IN (
      SELECT matricule_titulaire FROM interims WHERE matricule_interimaire = ? AND statut = 'Actif' AND CURDATE() BETWEEN date_debut AND date_fin
    ))`;
    params.push(req.user.matricule, req.user.matricule, req.user.matricule, req.user.matricule);
  } else {
    // HR voit tout ou filtré par matricule si demandé
    if (matricule) {
      sql += " AND a.matricule = ?";
      params.push(matricule);
    }
  }

  sql += " ORDER BY a.date_demande DESC";

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST Absence (Création par collaborateur, ou Décision Finale par DRH)
app.post('/api/absences', authenticate, (req, res) => {
  const { id, matricule: bodyMatricule, date_demande, date_debut, date_fin, duree_jours, type_conge, motif, statut, decide_par, date_decision, justificatif } = req.body;

  if (!id) {
    // --- ÉTAPE 1 : CRÉATION DE LA DEMANDE PAR L'EMPLOYÉ ---
    const matricule = req.user.role === 'employee' ? req.user.matricule : bodyMatricule;

    if (!matricule || !duree_jours || !type_conge) {
      return res.status(400).json({ error: "Champs obligatoires manquants." });
    }
    if (justificatif && justificatif.length > 6_000_000) {
      return res.status(400).json({ error: "Justificatif trop volumineux (max ~4.5 Mo)." });
    }

    let finalStatut = statut || 'En attente';
    if (finalStatut === 'Approuvé' && req.user.role === 'employee') {
      finalStatut = 'En attente';
    }

    const newId = randomUUID();
    const today = new Date().toISOString().split('T')[0];
    const finalDecidePar = finalStatut === 'Approuvé' ? (decide_par || 'RH') : null;
    const finalDateDecision = finalStatut === 'Approuvé' ? (date_decision || today) : null;
    const initialStatutSuperviseur = finalStatut === 'Approuvé' ? 'Approuvé' : 'En attente';

    db.run(`INSERT INTO absences
      (id, matricule, date_demande, date_debut, date_fin, duree_jours, type_conge, motif, statut, decide_par, date_decision, justificatif, statut_superviseur)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, matricule, date_demande || today, date_debut, date_fin, duree_jours, type_conge, motif, finalStatut, finalDecidePar, finalDateDecision, justificatif || null, initialStatutSuperviseur],
      async function(err) {
        if (err) return res.status(500).json({ error: err.message });

        if (finalStatut === 'Approuvé' && type_conge === 'Annuel') {
          db.run("UPDATE employees SET solde_conge = solde_conge - ? WHERE matricule = ?", [duree_jours, matricule]);
        }
        logAudit(req, 'Demande de congé créée', matricule, `${type_conge} — ${duree_jours}j`);

        // Notification & email automatique au Chef / IT Manager responsable (avec détection automatique d'intérim)
        if (finalStatut === 'En attente') {
          db.get("SELECT matricule, nom, prenom, departement, poste, SuperieurMatricule, Email FROM employees WHERE matricule = ?", [matricule], (errEmp, emp) => {
            if (!errEmp && emp) {
              const supMatricule = emp.SuperieurMatricule;
              const findSupSql = supMatricule
                ? "SELECT matricule, nom, prenom, Email, poste FROM employees WHERE matricule = ?"
                : "SELECT matricule, nom, prenom, Email, poste FROM employees WHERE departement = ? AND role = 'supervisor' LIMIT 1";
              const findSupParam = supMatricule || emp.departement;

              db.get(findSupSql, [findSupParam], (errSup, supervisor) => {
                if (!supervisor) return;
                const supNom = `${supervisor.prenom} ${supervisor.nom}`;
                const supEmail = supervisor.Email || `${supervisor.prenom.toLowerCase()}.${supervisor.nom.toLowerCase()}@gica.dz`;

                // VÉRIFIER SI LE CHEF A UN INTÉRIMAIRE ACTIF (Chef en congé ou indisponible)
                const checkInterimSql = `
                  SELECT i.*, r.nom AS int_nom, r.prenom AS int_prenom, r.Email AS int_email, r.poste AS int_poste
                  FROM interims i
                  JOIN employees r ON i.matricule_interimaire = r.matricule
                  WHERE i.matricule_titulaire = ?
                    AND i.statut = 'Actif'
                    AND (
                      (? <= i.date_fin AND ? >= i.date_debut)
                      OR (CURDATE() BETWEEN i.date_debut AND i.date_fin)
                    )
                  ORDER BY i.created_at DESC LIMIT 1
                `;

                // VÉRIFIER LES CONFLITS ET CHEVAUCHEMENTS DANS LE DÉPARTEMENT
                const conflictSql = `
                  SELECT a.id, a.matricule, a.date_debut, a.date_fin, a.duree_jours, a.type_conge, e.nom, e.prenom, e.poste
                  FROM absences a
                  JOIN employees e ON a.matricule = e.matricule
                  WHERE e.departement = ? AND a.matricule != ? AND a.statut != 'Refusé'
                    AND (a.date_debut <= ? AND a.date_fin >= ?)
                `;

                db.all(conflictSql, [emp.departement, emp.matricule, date_fin, date_debut], (errConf, conflictsList) => {
                  const conflicts = conflictsList || [];
                  const backendBase = process.env.SERVER_URL || `http://${req.hostname || 'localhost'}:${PORT}`;

                  db.get(checkInterimSql, [supervisor.matricule, date_debut, date_fin], async (errInt, activeInterim) => {
                    const targetDecider = activeInterim ? activeInterim.matricule_interimaire : supervisor.matricule;
                    const targetEmail = activeInterim
                      ? (activeInterim.int_email || `${activeInterim.int_prenom.toLowerCase()}.${activeInterim.int_nom.toLowerCase()}@gica.dz`)
                      : supEmail;
                    const targetNom = activeInterim ? `${activeInterim.int_prenom} ${activeInterim.int_nom}` : supNom;

                    // Générer les jetons JWT sécurisés pour décision 1-clic par email
                    const approveToken = jwt.sign({ absenceId: newId, action: 'approve', deciderMatricule: targetDecider, role: 'supervisor' }, JWT_SECRET, { expiresIn: '14d' });
                    const rejectToken = jwt.sign({ absenceId: newId, action: 'reject', deciderMatricule: targetDecider, role: 'supervisor' }, JWT_SECRET, { expiresIn: '14d' });
                    const approveUrl = `${backendBase}/api/absences/quick-decision?token=${approveToken}`;
                    const rejectUrl = `${backendBase}/api/absences/quick-decision?token=${rejectToken}`;

                    const supEmailHtml = generateQuickDecisionEmailHtml({
                      titre: activeInterim
                        ? `[Intérim de ${supNom}] Demande de congé — ${emp.prenom} ${emp.nom}`
                        : `Nouvelle demande de congé — ${emp.prenom} ${emp.nom}`,
                      empNom: `${emp.prenom} ${emp.nom}`,
                      empMatricule: emp.matricule,
                      empDepartement: emp.departement,
                      empPoste: emp.poste,
                      typeConge: type_conge,
                      dateDebut: date_debut,
                      dateFin: date_fin,
                      dureeJours: duree_jours,
                      motif,
                      hasJustificatif: !!justificatif,
                      conflicts,
                      approveUrl,
                      rejectUrl,
                      deciderRoleLabel: activeInterim ? `Responsable par intérim de ${supNom}` : 'Responsable Hiérarchique'
                    });

                    if (activeInterim) {
                      // 1. Notification à l'INTÉRIMAIRE (avec boutons 1-clic)
                      await createNotification({
                        matricule_destinataire: activeInterim.matricule_interimaire,
                        titre: `[Intérim de ${supNom}] Demande de congé — ${emp.prenom} ${emp.nom}`,
                        message: `L'employé ${emp.prenom} ${emp.nom} (${emp.poste || emp.departement}) a soumis une demande de congé ${type_conge} de ${duree_jours} jour(s) du ${date_debut} au ${date_fin}. En tant qu'intérimaire désigné de ${supNom}, votre validation préalable est requise pour transmission à la DRH.`,
                        type: 'conge',
                        lien: '#absences?tab=attente',
                        email_destinataire: targetEmail,
                        email_sent: 1,
                        email_html: supEmailHtml
                      });

                      // 2. Notification d'action au Chef Titulaire (reçoit TOUJOURS la demande dans son profil et par email)
                      await createNotification({
                        matricule_destinataire: supervisor.matricule,
                        titre: `Nouvelle demande de congé — ${emp.prenom} ${emp.nom}`,
                        message: `L'employé ${emp.prenom} ${emp.nom} (${emp.poste || emp.departement}) a soumis une demande de congé ${type_conge} de ${duree_jours} jour(s) du ${date_debut} au ${date_fin}. Votre validation est requise (une copie a aussi été transmise à votre intérimaire ${targetNom}).`,
                        type: 'conge',
                        lien: '#absences?tab=attente',
                        email_destinataire: supEmail,
                        email_sent: 1,
                        email_html: supEmailHtml
                      });

                      // 3. Notification de confirmation à l'employé
                      await createNotification({
                        matricule_destinataire: emp.matricule,
                        titre: `Demande de congé enregistrée`,
                        message: `Votre demande de congé ${type_conge} de ${duree_jours} jour(s) du ${date_debut} au ${date_fin} a été enregistrée. Elle a été transmise à votre chef ${supNom} et à son intérimaire désigné ${targetNom} pour validation.`,
                        type: 'conge',
                        lien: '#absences?tab=attente',
                        email_destinataire: emp.Email,
                        email_sent: 1
                      });
                    } else {
                      // Cas standard sans intérim : envoi direct au chef titulaire (avec boutons 1-clic)
                      await createNotification({
                        matricule_destinataire: supervisor.matricule,
                        titre: `Nouvelle demande de congé — ${emp.prenom} ${emp.nom}`,
                        message: `L'employé ${emp.prenom} ${emp.nom} (${emp.poste || emp.departement}) a soumis une demande de congé ${type_conge} de ${duree_jours} jour(s) du ${date_debut} au ${date_fin}. Votre validation en tant que responsable hiérarchique est requise pour transmission à la DRH.`,
                        type: 'conge',
                        lien: '#absences?tab=attente',
                        email_destinataire: supEmail,
                        email_sent: 1,
                        email_html: supEmailHtml
                      });

                      await createNotification({
                        matricule_destinataire: emp.matricule,
                        titre: `Demande de congé transmise à votre responsable`,
                        message: `Votre demande de congé ${type_conge} de ${duree_jours} jour(s) du ${date_debut} au ${date_fin} a été enregistrée avec succès. Elle a été transmise à votre chef ${supNom} pour validation préalable.`,
                        type: 'conge',
                        lien: '#absences?tab=attente',
                        email_destinataire: emp.Email,
                        email_sent: 1
                      });
                    }
                  });
                });
              });
            }
          });
        }

        res.json({ success: true, id: newId });
      }
    );
  } else {
    // --- ÉTAPE 3 : VALIDATION FINALE PAR LA DRH (ou Décision Superviseur) ---
    if (req.user.role !== 'hr' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: "Seuls RH ou Superviseur peuvent approuver/refuser une demande." });
    }

    db.get(`SELECT a.*, e.nom, e.prenom, e.departement, e.poste, e.Email, e.solde_conge, e.SuperieurMatricule
            FROM absences a
            LEFT JOIN employees e ON a.matricule = e.matricule
            WHERE a.id = ?`, [id], (err, oldRequest) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldRequest) return res.status(404).json({ error: "Demande de congé introuvable." });

      db.get("SELECT matricule, nom, prenom FROM employees WHERE matricule = ?", [req.user.matricule], (errDrh, drhUser) => {
        const today = new Date().toISOString().split('T')[0];
        const drhFullName = drhUser ? `${drhUser.prenom} ${drhUser.nom}` : req.user.matricule;
        const drhDecidePar = decide_par || `${drhFullName} (DRH)`.trim();
        const drhDateDecision = date_decision || today;

        db.run(`UPDATE absences SET
          statut = ?, decide_par = ?, date_decision = ?
          WHERE id = ?`,
          [statut, drhDecidePar, drhDateDecision, id],
          async function(err) {
          if (err) return res.status(500).json({ error: err.message });

          // Si approuvé, on déduit uniquement si c'est un "Congé Annuel"
          if (oldRequest.type_conge === 'Annuel') {
            if (oldRequest.statut !== 'Approuvé' && statut === 'Approuvé') {
              db.run("UPDATE employees SET solde_conge = solde_conge - ? WHERE matricule = ?", [oldRequest.duree_jours, oldRequest.matricule]);
            } else if (oldRequest.statut === 'Approuvé' && statut !== 'Approuvé') {
              db.run("UPDATE employees SET solde_conge = solde_conge + ? WHERE matricule = ?", [oldRequest.duree_jours, oldRequest.matricule]);
            }
          }

          logAudit(req, `Décision DRH congé : ${statut}`, oldRequest.matricule, `${oldRequest.type_conge} — ${oldRequest.duree_jours}j`);

          // --- NOTIFICATION & EMAIL DE CONFIRMATION OFFICIEL ENVOYÉS À L'EMPLOYÉ ---
          const empEmail = oldRequest.Email || `${oldRequest.prenom.toLowerCase()}.${oldRequest.nom.toLowerCase()}@gica.dz`;

          if (statut === 'Approuvé') {
            const approvalEmailHtml = generateApprovalEmailHtml({
              empNom: `${oldRequest.prenom} ${oldRequest.nom}`,
              empMatricule: oldRequest.matricule,
              empDepartement: oldRequest.departement,
              empPoste: oldRequest.poste,
              typeConge: oldRequest.type_conge,
              dateDebut: oldRequest.date_debut,
              dateFin: oldRequest.date_fin,
              dureeJours: oldRequest.duree_jours,
              drhDecidePar,
              dateDecision: drhDateDecision
            });

            // 1. Notification & Email à l'employé (ex: 999 Guenfoud Mohamed)
            await createNotification({
              matricule_destinataire: oldRequest.matricule,
              titre: `Confirmation Officielle — Congé Approuvé par la DRH`,
              message: `Félicitations ! Votre demande de congé ${oldRequest.type_conge} de ${oldRequest.duree_jours} jour(s) (du ${oldRequest.date_debut} au ${oldRequest.date_fin}) a été définitivement approuvée par la Direction des Ressources Humaines (${drhDecidePar}). Un email officiel de confirmation a été expédié à ${empEmail}.`,
              type: 'conge',
              lien: '#absences?tab=historique',
              email_destinataire: empEmail,
              email_sent: 1,
              email_html: approvalEmailHtml
            });

            // 2. Notification d'information et email au Manager (ex: 438 Lyes Belatrous)
            const supMat = oldRequest.SuperieurMatricule;
            if (supMat) {
              const [supRows] = await new Promise((resP) => {
                db.all("SELECT matricule, Nom, Prenom, Email FROM employees WHERE matricule = ?", [supMat], (e, r) => resP([r || []]));
              });
              const supEmp = supRows && supRows[0];
              const supEmail = supEmp?.Email || (supEmp ? `${supEmp.Prenom.toLowerCase()}.${supEmp.Nom.toLowerCase()}@gica.dz` : null);

              await createNotification({
                matricule_destinataire: supMat,
                titre: `Congé validé par la DRH — ${oldRequest.prenom} ${oldRequest.nom}`,
                message: `La demande de congé de votre collaborateur ${oldRequest.prenom} ${oldRequest.nom} (${oldRequest.duree_jours}j du ${oldRequest.date_debut} au ${oldRequest.date_fin}) a été définitivement approuvée par la DRH (${drhDecidePar}).`,
                type: 'conge',
                lien: '#absences?tab=historique',
                email_destinataire: supEmail,
                email_sent: supEmail ? 1 : 0
              });
            }
          } else if (statut === 'Refusé') {
            await createNotification({
              matricule_destinataire: oldRequest.matricule,
              titre: `Demande de congé refusée par la DRH`,
              message: `Votre demande de congé ${oldRequest.type_conge} de ${oldRequest.duree_jours} jour(s) du ${oldRequest.date_debut} au ${oldRequest.date_fin} a été refusée par la Direction des Ressources Humaines.`,
              type: 'conge',
              lien: '#absences?tab=historique',
              email_destinataire: empEmail,
              email_sent: 1
            });
          }

          res.json({
            success: true,
            email_sent: statut === 'Approuvé',
            email_destinataire: empEmail,
            message: statut === 'Approuvé'
              ? `Demande validée par la DRH. Confirmation officielle et email envoyés à ${empEmail}.`
              : "Demande refusée."
          });
        }
      );
      });
    });
  }
});

// --- ÉTAPE 2 : VALIDATION PAR LE SUPERVISEUR / MANAGER (OU SON INTÉRIMAIRE) ---
app.post('/api/absences/:id/supervisor-decision', authenticate, async (req, res) => {
  const { statut } = req.body;
  if (!['Approuvé', 'Refusé'].includes(statut)) {
    return res.status(400).json({ error: "Statut invalide." });
  }
  const today = new Date().toISOString().split('T')[0];

  db.get(`SELECT a.*, e.nom, e.prenom, e.departement, e.poste, e.Email, e.SuperieurMatricule
          FROM absences a
          LEFT JOIN employees e ON a.matricule = e.matricule
          WHERE a.id = ?`, [req.params.id], (err, reqRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!reqRow) return res.status(404).json({ error: "Demande introuvable." });

    // Vérifier les droits : soit RH, soit le supérieur titulaire, soit l'intérimaire actif du supérieur
    const checkAuthSql = `
      SELECT 1 FROM interims
      WHERE matricule_interimaire = ? AND matricule_titulaire = ? AND statut = 'Actif' AND CURDATE() BETWEEN date_debut AND date_fin
    `;
    db.get(checkAuthSql, [req.user.matricule, reqRow.SuperieurMatricule], (errAuth, isInterim) => {
      const isAuthorized = (req.user.role === 'hr' || req.user.role === 'supervisor' || !!isInterim);
      if (!isAuthorized) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation pour valider cette demande." });
      }

      db.get("SELECT matricule, nom, prenom, poste, Email FROM employees WHERE matricule = ?", [req.user.matricule], (errSup, supUser) => {
        db.get("SELECT matricule, nom, prenom FROM employees WHERE matricule = ?", [reqRow.SuperieurMatricule], (errTit, titUser) => {
          const userNom = supUser ? `${supUser.prenom} ${supUser.nom}` : req.user.matricule;
          const titNom = titUser ? `${titUser.prenom} ${titUser.nom}` : (reqRow.SuperieurMatricule || 'Responsable');
          const isActingAsInterim = !!isInterim && req.user.matricule !== reqRow.SuperieurMatricule;

          const deciderSignature = isActingAsInterim ? `${userNom} (Intérim de ${titNom})` : userNom;
          const newGlobalStatut = statut === 'Refusé' ? 'Refusé' : reqRow.statut;

          db.run(
            `UPDATE absences SET statut_superviseur = ?, decide_par_superviseur = ?, date_decision_superviseur = ?, statut = ? WHERE id = ?`,
            [statut, deciderSignature, today, newGlobalStatut, req.params.id],
            async function(err) {
              if (err) return res.status(500).json({ error: err.message });
              logAudit(req, `Validation responsable congé : ${statut}`, reqRow.matricule, `${reqRow.type_conge} — ${reqRow.duree_jours}j — Signé: ${deciderSignature}`);

              if (statut === 'Approuvé') {
                // 1. Notification & Email à la DRH (matricule '1002') avec boutons 1-CLIC sécurisés
                const roleMention = isActingAsInterim ? `le responsable par intérim ${userNom} (remplaçant ${titNom} en congé)` : `le responsable hiérarchique ${userNom}`;
                const backendBase = process.env.SERVER_URL || `http://${req.hostname || 'localhost'}:${PORT}`;
                const drhApproveToken = jwt.sign({ absenceId: req.params.id, action: 'approve', deciderMatricule: '1002', role: 'hr' }, JWT_SECRET, { expiresIn: '14d' });
                const drhRejectToken = jwt.sign({ absenceId: req.params.id, action: 'reject', deciderMatricule: '1002', role: 'hr' }, JWT_SECRET, { expiresIn: '14d' });
                const drhApproveUrl = `${backendBase}/api/absences/quick-decision?token=${drhApproveToken}`;
                const drhRejectUrl = `${backendBase}/api/absences/quick-decision?token=${drhRejectToken}`;

                const drhEmailHtml = generateQuickDecisionEmailHtml({
                  titre: `Demande Validée par ${deciderSignature} — Décision DRH Requise`,
                  empNom: `${reqRow.prenom} ${reqRow.nom}`,
                  empMatricule: reqRow.matricule,
                  empDepartement: reqRow.departement,
                  empPoste: reqRow.poste,
                  typeConge: reqRow.type_conge,
                  dateDebut: reqRow.date_debut,
                  dateFin: reqRow.date_fin,
                  dureeJours: reqRow.duree_jours,
                  motif: reqRow.motif,
                  hasJustificatif: !!reqRow.justificatif,
                  approveUrl: drhApproveUrl,
                  rejectUrl: drhRejectUrl,
                  deciderRoleLabel: 'Direction RH'
                });

                await createNotification({
                  matricule_destinataire: '1002',
                  titre: `Congé validé par ${isActingAsInterim ? 'Intérimaire' : 'Manager'} — À approuver par la DRH`,
                  message: `${roleMention} a émis un avis FAVORABLE pour la demande de congé de ${reqRow.prenom} ${reqRow.nom} (${reqRow.duree_jours}j du ${reqRow.date_debut} au ${reqRow.date_fin}). Merci de procéder à la validation finale.`,
                  type: 'conge',
                  lien: '#absences?tab=attente',
                  email_destinataire: 'drh@gica.dz',
                  email_sent: 1,
                  email_html: drhEmailHtml
                });

                // 2. Notification d'avancement à l'employé
                await createNotification({
                  matricule_destinataire: reqRow.matricule,
                  titre: `Avis Favorable de votre responsable ${isActingAsInterim ? 'par intérim ' : ''}${userNom}`,
                  message: `Votre responsable ${isActingAsInterim ? 'par intérim ' : ''}${userNom} a validé votre demande de congé de ${reqRow.duree_jours} jour(s). Votre dossier est maintenant transmis à la Direction des Ressources Humaines (DRH) pour confirmation finale.`,
                  type: 'conge',
                  lien: '#absences?tab=attente',
                  email_destinataire: reqRow.Email,
                  email_sent: 1
                });
              } else {
                // Avis défavorable (Refusé)
                await createNotification({
                  matricule_destinataire: reqRow.matricule,
                  titre: `Avis défavorable sur votre demande de congé`,
                  message: `Votre responsable ${isActingAsInterim ? 'par intérim ' : ''}${userNom} a refusé votre demande de congé de ${reqRow.duree_jours} jour(s).`,
                  type: 'conge',
                  lien: '#absences?tab=historique',
                  email_destinataire: reqRow.Email,
                  email_sent: 1
                });
              }

              res.json({
                success: true,
                message: statut === 'Approuvé'
                  ? `Avis favorable enregistré (${deciderSignature}). La demande est transmise à la DRH pour décision finale.`
                  : "Demande refusée par le responsable."
              });
            }
          );
        });
      });
    });
  });
});

// Justificatif d'une demande de congé (image/PDF encodé en base64)
app.get('/api/absences/:id/justificatif', authenticate, (req, res) => {
  db.get("SELECT matricule, justificatif FROM absences WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Demande introuvable." });
    if (req.user.role === 'employee' && req.user.matricule !== row.matricule) {
      return res.status(403).json({ error: "Accès non autorisé." });
    }
    if (!row.justificatif) return res.status(404).json({ error: "Aucun justificatif joint." });
    res.json({ justificatif: row.justificatif });
  });
});

// Détection des conflits et chevauchements d'absences dans le même département
app.get('/api/absences/conflicts', authenticate, (req, res) => {
  const { matricule, date_debut, date_fin, departement } = req.query;
  if (!date_debut || !date_fin) {
    return res.status(400).json({ error: "Dates de début et de fin requises." });
  }

  const findConflicts = (dept, mat) => {
    const sql = `
      SELECT a.id, a.matricule, a.date_debut, a.date_fin, a.duree_jours, a.type_conge, a.statut, a.statut_superviseur,
             e.nom, e.prenom, e.poste, e.departement
      FROM absences a
      JOIN employees e ON a.matricule = e.matricule
      WHERE e.departement = ?
        AND a.matricule != ?
        AND a.statut != 'Refusé'
        AND (a.date_debut <= ? AND a.date_fin >= ?)
      ORDER BY a.date_debut ASC
    `;
    db.all(sql, [dept, mat || '', date_fin, date_debut], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  };

  if (departement) {
    findConflicts(departement, matricule);
  } else if (matricule) {
    db.get("SELECT departement FROM employees WHERE matricule = ?", [matricule], (err, emp) => {
      if (err || !emp) return res.json([]);
      findConflicts(emp.departement, matricule);
    });
  } else {
    res.json([]);
  }
});

// Page HTML élégante de confirmation de décision pour les liens 1-clic par email
function renderDecisionPage({ success, isApprove = true, alreadyDone = false, title, message, absence = null, deciderNom = '' }) {
  const iconColor = !success ? '#dc2626' : (alreadyDone ? '#f59e0b' : (isApprove ? '#16a34a' : '#dc2626'));
  const iconSvg = !success
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : (alreadyDone
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>`
      : (isApprove
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      )
    );

  const absenceDetailsHtml = absence ? `
    <div style="margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: left; font-size: 0.9rem;">
      <div style="font-weight: 700; color: #1e293b; margin-bottom: 10px; font-size: 0.95rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
        Récapitulatif de la demande :
      </div>
      <div style="display: grid; grid-template-columns: 130px 1fr; gap: 6px; color: #334155;">
        <span style="color: #64748b;">Collaborateur :</span>
        <strong>${absence.prenom || ''} ${absence.nom || ''} (${absence.matricule})</strong>
        <span style="color: #64748b;">Département :</span>
        <span>${absence.departement || 'GICA'}</span>
        <span style="color: #64748b;">Type de congé :</span>
        <span style="font-weight: 600; color: #2563eb;">${absence.type_conge || ''}</span>
        <span style="color: #64748b;">Période :</span>
        <span>Du ${absence.date_debut || ''} au ${absence.date_fin || ''} (${absence.duree_jours || ''} jour(s))</span>
        ${absence.motif ? `<span style="color: #64748b;">Motif :</span><span>${absence.motif}</span>` : ''}
      </div>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} — Portail RH SCHB GICA</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
        body { background: #f1f5f9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #ffffff; width: 100%; max-width: 540px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03); overflow: hidden; border: 1px solid #e2e8f0; }
        .card-header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 24px; text-align: center; }
        .card-header h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 4px; }
        .card-header p { font-size: 0.85rem; opacity: 0.9; }
        .card-body { padding: 32px 28px; text-align: center; }
        .icon-wrapper { width: 80px; height: 80px; border-radius: 50%; background: #f8fafc; border: 2px solid ${iconColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; }
        .title { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
        .desc { font-size: 0.95rem; color: #475569; line-height: 1.6; }
        .btn-portal { display: inline-block; margin-top: 24px; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 0.95rem; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: all 0.2s; }
        .btn-portal:hover { background: #1d4ed8; transform: translateY(-1px); }
        .footer { padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 0.78rem; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="card-header">
          <h1>Portail RH — SCHB GICA</h1>
          <p>Société des Ciments de Hamma Bouziane</p>
        </div>
        <div class="card-body">
          <div class="icon-wrapper">
            ${iconSvg}
          </div>
          <div class="title">${title}</div>
          <div class="desc">${message}</div>
          ${absenceDetailsHtml}
          <div>
            <a href="http://localhost:8082" class="btn-portal">Accéder au Portail RH</a>
          </div>
        </div>
        <div class="footer">
          Validation enregistrée en temps réel par le système RH SCHB GICA.
        </div>
      </div>
    </body>
    </html>
  `;
}

// Route publique de validation/refus rapide en 1 clic par email
app.get('/api/absences/quick-decision', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send(renderDecisionPage({
      success: false,
      title: "Lien Invalide",
      message: "Jeton de validation manquant. Veuillez utiliser le lien figurant dans votre email officiel."
    }));
  }

  jwt.verify(token, JWT_SECRET, (jwtErr, decoded) => {
    if (jwtErr || !decoded || !decoded.absenceId || !decoded.action) {
      return res.status(401).send(renderDecisionPage({
        success: false,
        title: "Lien Expiré ou Invalide",
        message: "Ce lien de validation en 1 clic est invalide ou a expiré (validité 14 jours). Vous pouvez vous connecter directement sur le portail RH pour traiter la demande."
      }));
    }

    const { absenceId, action, deciderMatricule, role } = decoded;
    const isApprove = action === 'approve';
    const decisionStatut = isApprove ? 'Approuvé' : 'Refusé';
    const today = new Date().toISOString().split('T')[0];

    db.get(`
      SELECT a.*, e.nom, e.prenom, e.departement, e.poste, e.Email, e.solde_conge, e.SuperieurMatricule
      FROM absences a
      LEFT JOIN employees e ON a.matricule = e.matricule
      WHERE a.id = ?
    `, [absenceId], (err, absence) => {
      if (err || !absence) {
        return res.status(404).send(renderDecisionPage({
          success: false,
          title: "Demande Introuvable",
          message: "La demande de congé correspondante est introuvable ou a été supprimée."
        }));
      }

      const empNomComplet = `${absence.prenom} ${absence.nom}`;
      const empEmail = absence.Email || `${absence.prenom.toLowerCase()}.${absence.nom.toLowerCase()}@gica.dz`;

      // Cas 1 : Décision SUPERVISEUR / MANAGER
      if (role === 'supervisor') {
        if (absence.statut_superviseur && absence.statut_superviseur !== 'En attente') {
          return res.send(renderDecisionPage({
            success: true,
            alreadyDone: true,
            title: "Demande Déjà Traitée",
            message: `Cette demande a déjà été traitée par ${absence.decide_par_superviseur || 'le responsable'} avec l'avis : <strong>${absence.statut_superviseur}</strong> le ${absence.date_decision_superviseur || today}.`,
            absence
          }));
        }

        db.get("SELECT matricule, nom, prenom, poste FROM employees WHERE matricule = ?", [deciderMatricule], (errDec, decUser) => {
          const deciderNom = decUser ? `${decUser.prenom} ${decUser.nom}` : (deciderMatricule || 'Responsable');
          const signature = `${deciderNom} (Validation Email 1-Clic)`;
          const newGlobalStatut = isApprove ? absence.statut : 'Refusé';

          db.run(
            `UPDATE absences SET statut_superviseur = ?, decide_par_superviseur = ?, date_decision_superviseur = ?, statut = ? WHERE id = ?`,
            [decisionStatut, signature, today, newGlobalStatut, absenceId],
            async (upErr) => {
              if (upErr) {
                return res.status(500).send(renderDecisionPage({
                  success: false,
                  title: "Erreur Système",
                  message: upErr.message
                }));
              }

              broadcast({ type: 'update', path: '/api/absences' });

              if (isApprove) {
                // Créer les tokens DRH pour validation 1-clic par la DRH
                const backendBase = process.env.SERVER_URL || `http://${req.hostname || 'localhost'}:${PORT}`;
                const drhApproveToken = jwt.sign({ absenceId, action: 'approve', deciderMatricule: '1002', role: 'hr' }, JWT_SECRET, { expiresIn: '14d' });
                const drhRejectToken = jwt.sign({ absenceId, action: 'reject', deciderMatricule: '1002', role: 'hr' }, JWT_SECRET, { expiresIn: '14d' });
                const drhApproveUrl = `${backendBase}/api/absences/quick-decision?token=${drhApproveToken}`;
                const drhRejectUrl = `${backendBase}/api/absences/quick-decision?token=${drhRejectToken}`;

                const drhEmailHtml = generateQuickDecisionEmailHtml({
                  titre: `Demande Validée par le Responsable (${deciderNom}) — Décision Finale Requise`,
                  empNom: empNomComplet,
                  empMatricule: absence.matricule,
                  empDepartement: absence.departement,
                  empPoste: absence.poste,
                  typeConge: absence.type_conge,
                  dateDebut: absence.date_debut,
                  dateFin: absence.date_fin,
                  dureeJours: absence.duree_jours,
                  motif: absence.motif,
                  hasJustificatif: !!absence.justificatif,
                  approveUrl: drhApproveUrl,
                  rejectUrl: drhRejectUrl,
                  deciderRoleLabel: 'Direction RH'
                });

                // Notifier la DRH
                await createNotification({
                  matricule_destinataire: '1002',
                  titre: `Congé validé par Manager (${deciderNom}) — À approuver par la DRH`,
                  message: `Le responsable hiérarchique ${deciderNom} a émis un avis FAVORABLE en 1 clic pour la demande de congé de ${empNomComplet} (${absence.duree_jours}j du ${absence.date_debut} au ${absence.date_fin}). Validation finale requise.`,
                  type: 'conge',
                  lien: '#absences?tab=attente',
                  email_destinataire: 'drh@gica.dz',
                  email_sent: 1,
                  email_html: drhEmailHtml
                });

                // Notifier l'employé
                await createNotification({
                  matricule_destinataire: absence.matricule,
                  titre: `Avis Favorable de votre responsable (${deciderNom})`,
                  message: `Votre responsable ${deciderNom} a émis un avis favorable en 1 clic pour votre demande de congé de ${absence.duree_jours} jour(s). Le dossier est maintenant transmis à la DRH pour décision finale.`,
                  type: 'conge',
                  lien: '#absences?tab=attente',
                  email_destinataire: empEmail,
                  email_sent: 1
                });
              } else {
                // Notifier l'employé du refus
                await createNotification({
                  matricule_destinataire: absence.matricule,
                  titre: `Avis défavorable sur votre demande de congé`,
                  message: `Votre responsable ${deciderNom} a refusé votre demande de congé de ${absence.duree_jours} jour(s) (du ${absence.date_debut} au ${absence.date_fin}).`,
                  type: 'conge',
                  lien: '#absences?tab=historique',
                  email_destinataire: empEmail,
                  email_sent: 1
                });
              }

              return res.send(renderDecisionPage({
                success: true,
                isApprove,
                title: isApprove ? "Avis Favorable Enregistré avec Succès" : "Demande Refusée",
                message: isApprove
                  ? `Vous avez émis un avis FAVORABLE pour la demande de <strong>${empNomComplet}</strong>. Le dossier a été immédiatement transmis à la Direction des Ressources Humaines.`
                  : `La demande de congé de <strong>${empNomComplet}</strong> a été refusée. Le collaborateur a été prévenu par notification.`,
                absence,
                deciderNom
              }));
            }
          );
        });
      }

      // Cas 2 : Décision DRH
      else if (role === 'hr') {
        if (absence.statut && absence.statut !== 'En attente') {
          return res.send(renderDecisionPage({
            success: true,
            alreadyDone: true,
            title: "Demande Déjà Clôturée par la DRH",
            message: `Cette demande a déjà été clôturée par la DRH avec le statut final : <strong>${absence.statut}</strong> (signé par ${absence.decide_par || 'DRH'}) le ${absence.date_decision || today}.`,
            absence
          }));
        }

        db.get("SELECT matricule, nom, prenom FROM employees WHERE matricule = ?", [deciderMatricule || '1002'], (errDrh, drhUser) => {
          const drhNom = drhUser ? `${drhUser.prenom} ${drhUser.nom}` : 'Direction RH';
          const signature = `${drhNom} (DRH - Validation Email 1-Clic)`;

          db.run(
            `UPDATE absences SET statut = ?, decide_par = ?, date_decision = ? WHERE id = ?`,
            [decisionStatut, signature, today, absenceId],
            async (drhUpErr) => {
              if (drhUpErr) {
                return res.status(500).send(renderDecisionPage({
                  success: false,
                  title: "Erreur Système",
                  message: drhUpErr.message
                }));
              }

              // Déduire le solde si approuvé et annuel
              if (isApprove && absence.type_conge === 'Annuel') {
                db.run("UPDATE employees SET solde_conge = solde_conge - ? WHERE matricule = ?", [absence.duree_jours, absence.matricule]);
              }

              broadcast({ type: 'update', path: '/api/absences' });

              if (isApprove) {
                const approvalEmailHtml = generateApprovalEmailHtml({
                  empNom: empNomComplet,
                  empMatricule: absence.matricule,
                  empDepartement: absence.departement,
                  empPoste: absence.poste,
                  typeConge: absence.type_conge,
                  dateDebut: absence.date_debut,
                  dateFin: absence.date_fin,
                  dureeJours: absence.duree_jours,
                  drhDecidePar: signature,
                  dateDecision: today
                });

                // Notifier l'employé
                await createNotification({
                  matricule_destinataire: absence.matricule,
                  titre: `Confirmation Officielle — Congé Approuvé par la DRH`,
                  message: `Félicitations ! Votre demande de congé ${absence.type_conge} de ${absence.duree_jours} jour(s) (du ${absence.date_debut} au ${absence.date_fin}) a été définitivement approuvée par la Direction des Ressources Humaines (${signature}). Votre titre de congé officiel est disponible au téléchargement.`,
                  type: 'conge',
                  lien: '#absences?tab=historique',
                  email_destinataire: empEmail,
                  email_sent: 1,
                  email_html: approvalEmailHtml
                });

                // Notifier le responsable
                const supMat = absence.SuperieurMatricule;
                if (supMat) {
                  db.get("SELECT Email FROM employees WHERE matricule = ?", [supMat], async (eS, supEmp) => {
                    await createNotification({
                      matricule_destinataire: supMat,
                      titre: `Congé validé par la DRH — ${empNomComplet}`,
                      message: `La demande de congé de votre collaborateur ${empNomComplet} (${absence.duree_jours}j du ${absence.date_debut} au ${absence.date_fin}) a été définitivement approuvée par la DRH.`,
                      type: 'conge',
                      lien: '#absences?tab=historique',
                      email_destinataire: supEmp?.Email || null,
                      email_sent: supEmp?.Email ? 1 : 0
                    });
                  });
                }
              } else {
                await createNotification({
                  matricule_destinataire: absence.matricule,
                  titre: `Demande de congé refusée par la DRH`,
                  message: `Votre demande de congé ${absence.type_conge} de ${absence.duree_jours} jour(s) du ${absence.date_debut} au ${absence.date_fin} a été refusée par la Direction des Ressources Humaines.`,
                  type: 'conge',
                  lien: '#absences?tab=historique',
                  email_destinataire: empEmail,
                  email_sent: 1
                });
              }

              return res.send(renderDecisionPage({
                success: true,
                isApprove,
                title: isApprove ? "Congé Définitivement Validé par la DRH" : "Demande Refusée par la DRH",
                message: isApprove
                  ? `La demande de congé de <strong>${empNomComplet}</strong> (${absence.duree_jours}j) a été validée avec succès. L'employé et son responsable ont reçu leur confirmation officielle.`
                  : `La demande a été rejetée. Le collaborateur a été informé par notification officielle.`,
                absence,
                deciderNom: drhNom
              }));
            }
          );
        });
      }
    });
  });
});

// POST /api/terminal/punch (Terminal Pointage Virtuel — borne physique partagée, accessible à tout utilisateur connecté)
app.post('/api/terminal/punch', authenticate, (req, res) => {
  const { matricule } = req.body;
  if (!matricule) {
    return res.status(400).json({ error: "Matricule requis." });
  }

  // 1. Trouver l'employé actif
  db.get("SELECT * FROM employees WHERE matricule = ? AND actif = 1", [matricule], async (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: "Employé introuvable ou inactif." });

    const config = await getConfig();
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 2. Vérifier si un pointage existe déjà aujourd'hui
    db.get("SELECT * FROM pointages WHERE matricule = ? AND date = ?", [matricule, todayStr], (err, pointage) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!pointage) {
        // Enregistrement d'Entrée
        const stats = calculatePointageStats(employee, todayStr, currentTimeStr, null, config);
        const id = `p_${matricule}_${todayStr}`;

        db.run(`INSERT INTO pointages
          (id, matricule, date, heure_entree, heure_sortie, retard, heures_supp, heures_travaillees, anomalie, notes, shift_type)
          VALUES (?, ?, ?, ?, NULL, ?, 0, 0, 1, 'Entrée Borne', ?)`,
          [id, matricule, todayStr, currentTimeStr, stats.retard, stats.shiftType],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
              success: true,
              employee: `${employee.prenom} ${employee.nom}`,
              type: 'entree',
              time: currentTimeStr,
              message: `Entrée enregistrée à ${currentTimeStr}`
            });
          }
        );
      } else {
        // Enregistrement de Sortie (Mise à jour du pointage existant)
        if (pointage.heure_sortie) {
          return res.status(400).json({ error: "Vous avez déjà enregistré votre sortie aujourd'hui." });
        }

        const stats = calculatePointageStats(employee, todayStr, pointage.heure_entree, currentTimeStr, config);

        db.run(`UPDATE pointages SET
          heure_sortie = ?, retard = ?, heures_supp = ?,
          heures_travaillees = ?, anomalie = 0, notes = ?, shift_type = ?
          WHERE id = ?`,
          [currentTimeStr, stats.retard, stats.heuresSupp, stats.heuresTravaillees, stats.notes, stats.shiftType, pointage.id],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
              success: true,
              employee: `${employee.prenom} ${employee.nom}`,
              type: 'sortie',
              time: currentTimeStr,
              message: `Sortie enregistrée à ${currentTimeStr}. Durée travaillée : ${stats.heuresTravaillees}h`
            });
          }
        );
      }
    });
  });
});

// 6. GET Settings — réservé à hr (comme la page correspondante)
app.get('/api/settings', authenticate, requireRole('hr'), (req, res) => {
  db.get("SELECT value FROM settings WHERE key = 'config'", (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json({});
    res.json(JSON.parse(row.value));
  });
});

// POST Settings
app.post('/api/settings', authenticate, requireRole('hr'), (req, res) => {
  const configString = JSON.stringify(req.body);
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)", [configString], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    // Relancer la boucle ZKTeco avec la nouvelle configuration
    startZktecoSyncLoop();
    logAudit(req, 'Modification configuration', null, null);
    res.json({ success: true });
  });
});

// --- JOURNAL D'AUDIT (consultation) ---
app.get('/api/audit-log', authenticate, requireRole('hr'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  db.all("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?", [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- NOTIFICATIONS UTILISATEURS (pour tous les collaborateurs, superviseurs et DRH) ---
app.get('/api/notifications', authenticate, (req, res) => {
  db.all(
    `SELECT * FROM user_notifications WHERE matricule_destinataire = ? ORDER BY created_at DESC LIMIT 30`,
    [req.user.matricule],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.post('/api/notifications/:id/mark-read', authenticate, (req, res) => {
  db.run(
    `UPDATE user_notifications SET lu = 1 WHERE id = ? AND matricule_destinataire = ?`,
    [req.params.id, req.user.matricule],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post('/api/notifications/mark-all-read', authenticate, (req, res) => {
  db.run(
    `UPDATE user_notifications SET lu = 1 WHERE matricule_destinataire = ?`,
    [req.user.matricule],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// --- NOTIFICATIONS (compteurs pour la cloche du header - compatibilité) ---
app.get('/api/notifications/pending', authenticate, requireRole('hr', 'supervisor'), (req, res) => {
  db.all(
    `SELECT id, matricule, duree, motif, date_demande, 'recuperation' AS type FROM recuperations WHERE statut = 'En attente'
     UNION ALL
     SELECT id, matricule, duree_jours AS duree, motif, date_demande, 'absence' AS type FROM absences WHERE statut = 'En attente'
     ORDER BY date_demande DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// --- ACCUMULATION AUTOMATIQUE DES CONGÉS ---
// Ajoute au solde_conge de chaque employé actif un nombre de jours configurable par mois
// entièrement écoulé depuis sa dernière régularisation (ou sa date d'embauche si jamais régularisé).
async function runCongeAccrual() {
  const config = await getConfig();
  const rate = parseFloat(config?.accrual?.joursParMois);
  if (!rate || rate <= 0) return { updated: 0 }; // Fonctionnalité désactivée si non configurée

  const employees = await new Promise((resolve) => {
    db.all("SELECT matricule, date_embauche, last_accrual_date FROM employees WHERE actif = 1", [], (err, rows) => {
      resolve(err ? [] : rows);
    });
  });

  const today = new Date();
  let updated = 0;

  for (const emp of employees) {
    const startStr = emp.last_accrual_date || emp.date_embauche;
    if (!startStr) continue;
    const start = new Date(startStr);
    if (isNaN(start.getTime())) continue;

    let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    if (today.getDate() < start.getDate()) months--; // Mois en cours pas encore entièrement écoulé
    if (months <= 0) continue;

    const daysToAdd = parseFloat((months * rate).toFixed(2));
    const newAccrualDate = new Date(start);
    newAccrualDate.setMonth(newAccrualDate.getMonth() + months);
    const newAccrualDateStr = newAccrualDate.toISOString().split('T')[0];

    await new Promise((resolve) => {
      db.run(
        "UPDATE employees SET solde_conge = solde_conge + ?, last_accrual_date = ? WHERE matricule = ?",
        [daysToAdd, newAccrualDateStr, emp.matricule],
        () => resolve()
      );
    });
    updated++;
  }

  if (updated > 0) {
    console.log(`[Accumulation Congés] ${updated} employé(s) régularisé(s).`);
    broadcast({ type: 'update', path: '/api/employees' });
  }
  return { updated };
}

// Déclenchement manuel depuis la page Configuration
app.post('/api/settings/accrual/run', authenticate, requireRole('hr'), async (req, res) => {
  try {
    const result = await runCongeAccrual();
    logAudit(req, 'Régularisation congés (manuel)', null, `${result.updated} employé(s)`);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test d'envoi d'email SMTP
app.post('/api/settings/smtp/test', authenticate, requireRole('hr', 'supervisor'), async (req, res) => {
  const { destinataire } = req.body;
  const targetEmail = destinataire || process.env.SMTP_USER || 'it@dz-com.com';

  const ok = await sendSmtpEmail({
    to: targetEmail,
    subject: "Test de connexion SMTP — Portail RH GICA",
    text: "Ceci est un email de test confirmant que la configuration du serveur de messagerie (mail.dz-com.com / it@dz-com.com) est active et opérationnelle pour le portail RH de la Société des Ciments de Hamma Bouziane (SCHB GICA)."
  });

  if (ok) {
    res.json({ success: true, message: `Email de test envoyé avec succès à ${targetEmail}` });
  } else {
    res.status(500).json({ error: `Impossible d'acheminer l'email de test à ${targetEmail}. Vérifiez les identifiants ou le serveur SMTP.` });
  }
});

// Test de connexion ZKTeco — MODE DÉMO : aucune connexion réseau réelle n'est établie,
// on valide seulement le format de l'IP. Ne pas déployer en pensant qu'un vrai appareil
// biométrique est interrogé ici (voir aussi simulateZktecoPunch plus bas).
app.post('/api/settings/zkteco/test', authenticate, requireRole('hr'), (req, res) => {
  const { ip, port } = req.body;
  if (!ip || !port) {
    return res.status(400).json({ error: "Adresse IP et Port requis." });
  }

  // Simuler un ping réseau de 800ms
  setTimeout(() => {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipPattern.test(ip)) {
      res.json({ success: true, message: `[MODE DÉMO] Format d'adresse valide (${ip}:${port}). Aucune pointeuse réelle n'a été contactée — cette fonctionnalité est simulée.` });
    } else {
      res.status(500).json({ error: "Impossible de contacter la pointeuse. Vérifiez l'adresse IP et le réseau." });
    }
  }, 800);
});

// Synchronisation manuelle ZKTeco — MODE DÉMO (voir simulateZktecoPunch)
app.post('/api/settings/zkteco/sync', authenticate, requireRole('hr'), async (req, res) => {
  // Simuler la récupération de logs récents
  const config = await getConfig();
  if (!config || !config.zkteco || !config.zkteco.enabled) {
    return res.status(400).json({ error: "La synchronisation ZKTeco n'est pas activée dans la configuration." });
  }

  setTimeout(() => {
    simulateZktecoPunch();
    res.json({ success: true, message: "[MODE DÉMO] Synchronisation simulée effectuée — logs fictifs générés à des fins de démonstration uniquement." });
  }, 1000);
});

// Simuler la synchronisation automatique ZKTeco
let zktecoIntervalId = null;

async function startZktecoSyncLoop() {
  if (zktecoIntervalId) {
    clearInterval(zktecoIntervalId);
    zktecoIntervalId = null;
  }

  const config = await getConfig();
  if (config && config.zkteco && config.zkteco.enabled) {
    const intervalMs = (config.zkteco.interval || 5) * 60 * 1000;
    console.log(`[MODE DÉMO] Simulation ZKTeco active (aucun appareil réel connecté). Intervalle configuré : ${config.zkteco.interval} min.`);

    // ATTENTION : ceci est une DÉMO qui fabrique de fausses données de pointage pour un employé
    // aléatoire toutes les 30 secondes. Ne jamais activer sur une base de données de production
    // tant qu'une intégration matérielle réelle n'a pas remplacé cette simulation.
    zktecoIntervalId = setInterval(async () => {
      simulateZktecoPunch();
    }, 30000);
  }
}

// Fonction de SIMULATION (démo) de punch ZKTeco — ne représente aucun appareil réel
function simulateZktecoPunch() {
  db.all("SELECT * FROM employees WHERE actif = 1", [], async (err, employees) => {
    if (err || !employees || employees.length === 0) return;

    const randomEmp = employees[Math.floor(Math.random() * employees.length)];
    const config = await getConfig();
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    db.get("SELECT * FROM pointages WHERE matricule = ? AND date = ?", [randomEmp.matricule, todayStr], (err, pointage) => {
      if (err) return;

      if (!pointage) {
        // Entrée
        const stats = calculatePointageStats(randomEmp, todayStr, currentTimeStr, null, config);
        const id = `p_${randomEmp.matricule}_${todayStr}`;
        db.run(`INSERT INTO pointages
          (id, matricule, date, heure_entree, heure_sortie, retard, heures_supp, heures_travaillees, anomalie, notes, shift_type)
          VALUES (?, ?, ?, ?, NULL, ?, 0, 0, 1, 'Entrée ZKTeco (Démo)', ?)`,
          [id, randomEmp.matricule, todayStr, currentTimeStr, stats.retard, stats.shiftType],
          function(err) {
            if (!err) {
              broadcast({ type: 'update', path: '/api/pointages' });
            }
          }
        );
      } else if (!pointage.heure_sortie) {
        // Sortie
        const stats = calculatePointageStats(randomEmp, todayStr, pointage.heure_entree, currentTimeStr, config);
        db.run(`UPDATE pointages SET
          heure_sortie = ?, retard = ?, heures_supp = ?,
          heures_travaillees = ?, anomalie = 0, notes = ?, shift_type = ?
          WHERE id = ?`,
          [currentTimeStr, stats.retard, stats.heuresSupp, stats.heuresTravaillees, stats.notes, stats.shiftType, pointage.id],
          function(err) {
            if (!err) {
              broadcast({ type: 'update', path: '/api/pointages' });
            }
          }
        );
      }
    });
  });
}

// =====================================================================
// MODULE 1 : BONS DE SORTIE & ORDRES DE MISSION (SCHB GICA)
// =====================================================================
app.get('/api/bons-sortie', authenticate, (req, res) => {
  const { role, matricule } = req.user;
  const filterMat = req.query.matricule;
  const filterDate = req.query.date;

  let query = `
    SELECT bs.*, e.nom, e.prenom, e.departement, e.poste
    FROM bons_sortie bs
    JOIN employees e ON bs.matricule = e.matricule
  `;
  const params = [];
  const whereClauses = [];

  if (role === 'employee') {
    whereClauses.push("bs.matricule = ?");
    params.push(matricule);
  } else if (role === 'supervisor') {
    if (filterMat) {
      whereClauses.push("bs.matricule = ?");
      params.push(filterMat);
    } else {
      whereClauses.push("(e.SuperieurMatricule = ? OR e.departement = ? OR bs.matricule = ?)");
      params.push(matricule, req.user.departement, matricule);
    }
  } else {
    // HR
    if (filterMat) {
      whereClauses.push("bs.matricule = ?");
      params.push(filterMat);
    }
  }

  if (filterDate) {
    whereClauses.push("bs.date_sortie = ?");
    params.push(filterDate);
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query += " ORDER BY bs.date_sortie DESC, bs.heure_depart DESC";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/bons-sortie', authenticate, async (req, res) => {
  const { matricule: bodyMat, date_sortie, heure_depart, heure_retour_prevue, type_sortie, motif, destination } = req.body;
  const targetMat = req.user.role === 'employee' ? req.user.matricule : (bodyMat || req.user.matricule);

  if (!date_sortie || !heure_depart || !heure_retour_prevue) {
    return res.status(400).json({ error: "Date, heure de départ et heure de retour prévue sont requises." });
  }

  const [hDep, mDep] = heure_depart.split(':').map(Number);
  const [hRet, mRet] = heure_retour_prevue.split(':').map(Number);
  let dureeHeures = ((hRet * 60 + mRet) - (hDep * 60 + mDep)) / 60;
  if (dureeHeures <= 0) dureeHeures = 1.0;
  dureeHeures = Math.round(dureeHeures * 100) / 100;

  const id = `bs_${Date.now()}_${targetMat}`;
  const statut = 'En attente';

  db.run(`
    INSERT INTO bons_sortie (id, matricule, date_sortie, heure_depart, heure_retour_prevue, duree_heures, type_sortie, motif, destination, statut)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, targetMat, date_sortie, heure_depart, heure_retour_prevue, dureeHeures, type_sortie || 'Personnel', motif || '', destination || '', statut],
  async function(err) {
    if (err) return res.status(500).json({ error: err.message });

    logAudit(req, 'Création Bon de Sortie', targetMat, `${type_sortie} (${dureeHeures}h) le ${date_sortie}`);

    db.get("SELECT matricule, nom, prenom, departement, SuperieurMatricule FROM employees WHERE matricule = ?", [targetMat], async (eE, emp) => {
      if (emp && emp.SuperieurMatricule) {
        await createNotification({
          matricule_destinataire: emp.SuperieurMatricule,
          titre: `Nouveau Bon de Sortie — ${emp.prenom} ${emp.nom}`,
          message: `L'employé ${emp.prenom} ${emp.nom} (${emp.departement}) a sollicité un bon de sortie (${type_sortie}) le ${date_sortie} de ${heure_depart} à ${heure_retour_prevue} (${dureeHeures}h).`,
          type: 'bon_sortie',
          lien: '#bonssortie?tab=attente'
        });
      }
    });

    broadcast({ type: 'update', path: '/api/bons-sortie' });
    res.json({ success: true, id, message: "Bon de sortie enregistré avec succès." });
  });
});

app.post('/api/bons-sortie/:id/decision', authenticate, requireRole('supervisor', 'hr'), (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const newStatus = action === 'approve' ? 'Validé' : 'Refusé';

  db.get("SELECT * FROM bons_sortie WHERE id = ?", [id], (err, bon) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!bon) return res.status(404).json({ error: "Bon de sortie introuvable." });

    db.get("SELECT nom, prenom FROM employees WHERE matricule = ?", [req.user.matricule], (errUser, u) => {
      const deciderNom = u ? `${u.prenom} ${u.nom}` : (req.user.role === 'hr' ? 'Direction RH' : `Responsable #${req.user.matricule}`);

      db.run(
        "UPDATE bons_sortie SET statut = ?, valide_par = ?, date_validation = NOW() WHERE id = ?",
        [newStatus, deciderNom, id],
        async function(errUpdate) {
          if (errUpdate) return res.status(500).json({ error: errUpdate.message });

          await createNotification({
            matricule_destinataire: bon.matricule,
            titre: `Bon de Sortie ${newStatus === 'Validé' ? 'Validé' : 'Refusé'}`,
            message: `Votre bon de sortie pour le ${bon.date_sortie} (${bon.heure_depart} - ${bon.heure_retour_prevue}) a été ${newStatus.toLowerCase()} par ${deciderNom}.`,
            type: 'bon_sortie',
            lien: '#bonssortie?tab=historique'
          });

          broadcast({ type: 'update', path: '/api/bons-sortie' });
          res.json({ success: true, statut: newStatus, valide_par: deciderNom });
        }
      );
    });
  });
});

app.post('/api/bons-sortie/:id/retour', authenticate, (req, res) => {
  const { id } = req.params;
  const now = new Date();
  const defaultHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const heureRetour = req.body.heure_retour_reelle || defaultHour;

  db.get("SELECT * FROM bons_sortie WHERE id = ?", [id], (err, bon) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!bon) return res.status(404).json({ error: "Bon de sortie introuvable." });

    const [hDep, mDep] = bon.heure_depart.split(':').map(Number);
    const [hRet, mRet] = heureRetour.split(':').map(Number);
    let dureeReelle = ((hRet * 60 + mRet) - (hDep * 60 + mDep)) / 60;
    if (dureeReelle <= 0) dureeReelle = bon.duree_heures;
    dureeReelle = Math.round(dureeReelle * 100) / 100;

    db.run(
      "UPDATE bons_sortie SET heure_retour_reelle = ?, duree_heures = ?, statut = 'Clôturé' WHERE id = ?",
      [heureRetour, dureeReelle, id],
      function(errUpdate) {
        if (errUpdate) return res.status(500).json({ error: errUpdate.message });
        broadcast({ type: 'update', path: '/api/bons-sortie' });
        res.json({ success: true, heure_retour_reelle: heureRetour, duree_heures: dureeReelle });
      }
    );
  });
});

// =====================================================================
// MODULE 2 : SANTÉ AU TRAVAIL & HABILITATIONS (HSE CIMENTERIE)
// =====================================================================
app.get('/api/habilitations', authenticate, (req, res) => {
  const { role, matricule } = req.user;
  const filterMat = req.query.matricule;
  const filterDept = req.query.departement;

  let query = `
    SELECT h.*, e.nom, e.prenom, e.departement, e.poste, e.Email
    FROM habilitations h
    JOIN employees e ON h.matricule = e.matricule
  `;
  const params = [];
  const whereClauses = [];

  if (role === 'employee') {
    whereClauses.push("h.matricule = ?");
    params.push(matricule);
  } else if (role === 'supervisor') {
    if (filterMat) {
      whereClauses.push("h.matricule = ?");
      params.push(filterMat);
    } else {
      whereClauses.push("(e.SuperieurMatricule = ? OR e.departement = ? OR h.matricule = ?)");
      params.push(matricule, req.user.departement, matricule);
    }
  } else {
    if (filterMat) {
      whereClauses.push("h.matricule = ?");
      params.push(filterMat);
    }
    if (filterDept) {
      whereClauses.push("e.departement = ?");
      params.push(filterDept);
    }
  }

  if (whereClauses.length > 0) {
    query += " WHERE " + whereClauses.join(" AND ");
  }

  query += " ORDER BY h.date_expiration ASC";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const todayStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in30DaysStr = in30Days.toISOString().split('T')[0];

    const updated = (rows || []).map(item => {
      let calcStatut = 'Valide';
      if (item.date_expiration < todayStr) {
        calcStatut = 'Expire';
      } else if (item.date_expiration <= in30DaysStr) {
        calcStatut = 'Expire_Bientot';
      }
      return { ...item, statut: calcStatut };
    });

    res.json(updated);
  });
});

app.post('/api/habilitations', authenticate, requireRole('supervisor', 'hr'), (req, res) => {
  const { id, matricule, type_habilitation, organisme_delivreur, date_obtention, date_expiration, numero_certificat, remarques } = req.body;

  if (!matricule || !type_habilitation || !date_obtention || !date_expiration) {
    return res.status(400).json({ error: "Matricule, type d'habilitation, date d'obtention et date d'expiration sont requis." });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];

  let statut = 'Valide';
  if (date_expiration < todayStr) statut = 'Expire';
  else if (date_expiration <= in30DaysStr) statut = 'Expire_Bientot';

  if (id) {
    db.run(`
      UPDATE habilitations SET
        matricule = ?, type_habilitation = ?, organisme_delivreur = ?,
        date_obtention = ?, date_expiration = ?, numero_certificat = ?,
        statut = ?, remarques = ?
      WHERE id = ?
    `, [matricule, type_habilitation, organisme_delivreur || null, date_obtention, date_expiration, numero_certificat || null, statut, remarques || null, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast({ type: 'update', path: '/api/habilitations' });
      res.json({ success: true, message: "Habilitation mise à jour avec succès." });
    });
  } else {
    const newId = randomUUID();
    db.run(`
      INSERT INTO habilitations (id, matricule, type_habilitation, organisme_delivreur, date_obtention, date_expiration, numero_certificat, statut, remarques)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [newId, matricule, type_habilitation, organisme_delivreur || null, date_obtention, date_expiration, numero_certificat || null, statut, remarques || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      broadcast({ type: 'update', path: '/api/habilitations' });
      res.json({ success: true, id: newId, message: "Habilitation enregistrée avec succès." });
    });
  }
});

app.delete('/api/habilitations/:id', authenticate, requireRole('hr'), (req, res) => {
  db.run("DELETE FROM habilitations WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    broadcast({ type: 'update', path: '/api/habilitations' });
    res.json({ success: true });
  });
});

app.post('/api/habilitations/check-alerts', authenticate, requireRole('supervisor', 'hr'), async (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split('T')[0];

  db.all(`
    SELECT h.*, e.nom, e.prenom, e.Email, e.departement, e.SuperieurMatricule
    FROM habilitations h
    JOIN employees e ON h.matricule = e.matricule
    WHERE h.date_expiration <= ?
  `, [in30DaysStr], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let alertsCount = 0;
    for (const h of (rows || [])) {
      const isExpired = h.date_expiration < todayStr;
      const daysLeft = Math.ceil((new Date(h.date_expiration) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
      const titre = isExpired
        ? `ALERTE SÉCURITÉ : Habilitation Expirée — ${h.prenom} ${h.nom}`
        : `Échéance Sécurité J-${daysLeft} : ${h.type_habilitation}`;
      const msg = isExpired
        ? `L'habilitation/visite "${h.type_habilitation}" de ${h.prenom} ${h.nom} a expiré le ${h.date_expiration}. Veuillez programmer son renouvellement d'urgence.`
        : `Rappel : l'habilitation "${h.type_habilitation}" de ${h.prenom} ${h.nom} arrive à expiration le ${h.date_expiration} (${daysLeft} jours restants).`;

      await createNotification({
        matricule_destinataire: h.matricule,
        titre,
        message: msg,
        type: 'sante',
        lien: '#sante'
      });

      if (h.SuperieurMatricule) {
        await createNotification({
          matricule_destinataire: h.SuperieurMatricule,
          titre,
          message: msg,
          type: 'sante',
          lien: '#sante'
        });
      }
      alertsCount++;
    }

    res.json({ success: true, count: alertsCount, message: `${alertsCount} alerte(s) de sécurité générée(s) avec succès.` });
  });
});

// =====================================================================
// =====================================================================
// MODULE 3 : DEMANDES D'ATTESTATIONS RH EN 1 CLIC (CERTIFICATION SCHB GICA)
// =====================================================================
const handleGetAttestations = (req, res) => {
  const { role, matricule } = req.user;
  let query = `
    SELECT d.*, e.nom, e.prenom, e.departement, e.poste
    FROM demandes_documents d
    JOIN employees e ON d.matricule = e.matricule
  `;
  const params = [];
  if (role === 'employee') {
    query += " WHERE d.matricule = ?";
    params.push(matricule);
  }
  query += " ORDER BY d.genere_a DESC LIMIT 50";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

const handleGenerateAttestation = (req, res) => {
  const { type_document, motif } = req.body;
  const targetMat = req.user.role === 'employee' ? req.user.matricule : (req.body.matricule || req.user.matricule);
  const docType = type_document || 'Attestation_Travail';

  db.get("SELECT * FROM employees WHERE matricule = ?", [targetMat], (err, emp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!emp) return res.status(404).json({ error: "Employé introuvable." });

    const year = new Date().getFullYear();
    const refNum = Math.floor(1000 + Math.random() * 9000);
    const reference = `SCHB/DRH/${year}/${refNum}`;
    const id = randomUUID();

    db.run(`
      INSERT INTO demandes_documents (id, matricule, type_document, motif, statut, reference_doc)
      VALUES (?, ?, ?, ?, 'Prêt', ?)
    `, [id, targetMat, docType, motif || 'Usage administratif', reference],
    function(errInsert) {
      if (errInsert) return res.status(500).json({ error: errInsert.message });

      logAudit(req, 'Génération Attestation RH', targetMat, `${docType} [${reference}]`);

      res.json({
        success: true,
        document: {
          id,
          reference,
          type_document: docType,
          date_generation: new Date().toISOString().split('T')[0],
          employee: {
            matricule: emp.matricule,
            nom: emp.nom,
            prenom: emp.prenom,
            departement: emp.departement,
            poste: emp.poste,
            date_embauche: emp.date_embauche,
            type_contrat: emp.type_contrat || 'CDI (Durée Indéterminée)',
            salaire_base: emp.SalaireBase || 48000,
            solde_conge: emp.solde_conge || 0
          },
          signataire: "M. BENZIANE Abdelkader — Directeur des Ressources Humaines SCHB GICA",
          tampon_texte: "SOCIÉTÉ DES CIMENTS DE HAMMA BOUZIANE — GROUPE GICA — DIRECTION DES RESSOURCES HUMAINES",
          qr_code_content: `CERTIF-SCHB:${reference}:${emp.matricule}:${new Date().toISOString().split('T')[0]}:OFFICIEL`
        }
      });
    });
  });
};

app.get('/api/attestations', authenticate, handleGetAttestations);
app.post('/api/attestations/generate', authenticate, handleGenerateAttestation);

// =====================================================================
// MODULE 4 : PRÉ-PAIE, PRIMES INDUSTRIELLES & QUOTAS D'EFFECTIFS
// =====================================================================
app.get('/api/pointages/primes-summary', authenticate, requireRole('supervisor', 'hr'), (req, res) => {
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const mois = req.query.mois || currentMonthStr;
  const dept = req.query.departement;

  let empQuery = "SELECT matricule, nom, prenom, departement, poste, SalaireBase FROM employees WHERE actif = 1";
  const empParams = [];
  if (req.user.role === 'supervisor') {
    empQuery += " AND (departement = ? OR SuperieurMatricule = ?)";
    empParams.push(req.user.departement, req.user.matricule);
  } else if (dept) {
    empQuery += " AND departement = ?";
    empParams.push(dept);
  }
  empQuery += " ORDER BY departement, nom, prenom";

  db.all(empQuery, empParams, (err, employees) => {
    if (err) return res.status(500).json({ error: err.message });

    const pointageQuery = `
      SELECT matricule, date, heure_entree, heure_sortie, retard, heures_supp, heures_travaillees, shift_type
      FROM pointages
      WHERE date LIKE ?
    `;
    db.all(pointageQuery, [`${mois}%`], (errPt, pointages) => {
      if (errPt) return res.status(500).json({ error: errPt.message });

      const ptByEmp = {};
      (pointages || []).forEach(pt => {
        if (!ptByEmp[pt.matricule]) ptByEmp[pt.matricule] = [];
        ptByEmp[pt.matricule].push(pt);
      });

      const TAUX_PANIER = 600;     // 600 DA / jour pointé
      const TAUX_TRANSPORT = 400;  // 400 DA / jour pointé
      const TAUX_NUIT = 800;       // 800 DA / poste de nuit

      const result = (employees || []).map(emp => {
        const empPts = ptByEmp[emp.matricule] || [];
        
        const joursPointes = empPts.filter(p => p.heure_entree && (p.heures_travaillees > 0 || p.heure_sortie)).length;
        
        const shiftsNuit = empPts.filter(p => {
          if (p.shift_type === 'nuit') return true;
          if (p.heure_entree && (p.heure_entree >= '20:30' || p.heure_entree <= '05:00')) return true;
          return false;
        }).length;

        const totalHeures = empPts.reduce((acc, p) => acc + (parseFloat(p.heures_travaillees) || 0), 0);
        const totalHeuresSupp = empPts.reduce((acc, p) => acc + (parseFloat(p.heures_supp) || 0), 0);
        const totalRetards = empPts.reduce((acc, p) => acc + (parseFloat(p.retard) || 0), 0);

        const primePanier = joursPointes * TAUX_PANIER;
        const primeTransport = joursPointes * TAUX_TRANSPORT;
        const primeNuit = shiftsNuit * TAUX_NUIT;
        const totalPrimes = primePanier + primeTransport + primeNuit;

        return {
          matricule: emp.matricule,
          nom: emp.nom,
          prenom: emp.prenom,
          departement: emp.departement,
          poste: emp.poste,
          jours_pointes: joursPointes,
          shifts_nuit: shiftsNuit,
          total_heures: Math.round(totalHeures * 10) / 10,
          total_heures_supp: Math.round(totalHeuresSupp * 10) / 10,
          total_retards: Math.round(totalRetards),
          prime_panier: primePanier,
          prime_transport: primeTransport,
          prime_nuit: primeNuit,
          total_primes: totalPrimes
        };
      });

      const totaux = {
        total_salaries: result.length,
        total_jours_pointes: result.reduce((acc, r) => acc + r.jours_pointes, 0),
        total_prime_panier: result.reduce((acc, r) => acc + r.prime_panier, 0),
        total_prime_transport: result.reduce((acc, r) => acc + r.prime_transport, 0),
        total_prime_nuit: result.reduce((acc, r) => acc + r.prime_nuit, 0),
        total_primes_global: result.reduce((acc, r) => acc + r.total_primes, 0),
        total_heures_supp: Math.round(result.reduce((acc, r) => acc + r.total_heures_supp, 0) * 10) / 10
      };

      res.json({ mois, baremes: { panier: TAUX_PANIER, transport: TAUX_TRANSPORT, nuit: TAUX_NUIT }, totaux, employees: result });
    });
  });
});

app.get('/api/absences/department-quota', authenticate, (req, res) => {
  const { departement, date_debut, date_fin } = req.query;
  if (!departement || !date_debut || !date_fin) {
    return res.status(400).json({ error: "Département, date_debut et date_fin sont requis." });
  }

  db.get("SELECT COUNT(*) as total FROM employees WHERE departement = ? AND actif = 1", [departement], (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });
    const effectifTotal = countRow?.total || 0;

    db.get(`
      SELECT COUNT(DISTINCT a.matricule) as absents
      FROM absences a
      JOIN employees e ON a.matricule = e.matricule
      WHERE e.departement = ?
        AND a.statut IN ('Approuvé', 'En attente')
        AND (a.date_debut <= ? AND a.date_fin >= ?)
    `, [departement, date_fin, date_debut], (errAbs, absRow) => {
      if (errAbs) return res.status(500).json({ error: errAbs.message });
      const absentsPrevus = absRow?.absents || 0;
      const effectifRestant = Math.max(0, effectifTotal - absentsPrevus);

      let seuilMin = Math.max(1, Math.ceil(effectifTotal * 0.5));
      if (departement.toLowerCase().includes('production') || departement.toLowerCase().includes('exploitation')) {
        seuilMin = Math.max(3, Math.ceil(effectifTotal * 0.6));
      } else if (departement.toLowerCase().includes('maintenance')) {
        seuilMin = Math.max(2, Math.ceil(effectifTotal * 0.5));
      }

      const alerteSousEffectif = effectifRestant < seuilMin;

      res.json({
        departement,
        effectif_total: effectifTotal,
        absents_prevus: absentsPrevus,
        effectif_restant: effectifRestant,
        seuil_minimum: seuilMin,
        alerte_sous_effectif: alerteSousEffectif,
        message: alerteSousEffectif
          ? `Alerte sous-effectif : Seul(s) ${effectifRestant} collaborateur(s) présent(s) pour un minimum requis de ${seuilMin} en ${departement} !`
          : `Effectif conforme : ${effectifRestant}/${effectifTotal} collaborateurs présents.`
      });
    });
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur API GICA en cours d'exécution sur le port ${PORT}`);
  // Lancer le service ZKTeco au démarrage
  startZktecoSyncLoop();
  // Régularisation des congés : une fois au démarrage, puis une fois par jour
  runCongeAccrual().catch(err => console.error('[Accumulation Congés] Erreur :', err.message));
  setInterval(() => {
    runCongeAccrual().catch(err => console.error('[Accumulation Congés] Erreur :', err.message));
  }, 24 * 60 * 60 * 1000);
});
