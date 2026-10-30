const fs = require('fs');
const path = require('path');

const imgDir = path.resolve('c:/rh2/public/assets/letterhead');

const img1 = fs.readFileSync(path.join(imgDir, 'image1.png')).toString('base64');
const img2 = fs.readFileSync(path.join(imgDir, 'image2.png')).toString('base64');
const img3 = fs.readFileSync(path.join(imgDir, 'image3.jpeg')).toString('base64');
const img4 = fs.readFileSync(path.join(imgDir, 'image4.jpeg')).toString('base64');
const img5 = fs.readFileSync(path.join(imgDir, 'image5.png')).toString('base64');

const content = `/**
 * Module Officiel Papier à En-tête & Pied de Page SCHB GICA
 * Reproduit à 100% le document Word officiel :
 * "Papier à en-tête Cimenterie - Copie (2).doc"
 */

export const LETTERHEAD_ASSETS = {
  labelAlgerien: 'data:image/png;base64,${img1}',
  iconPin: 'data:image/png;base64,${img2}',
  isoVincotte: 'data:image/jpeg;base64,${img3}',
  logoGica: 'data:image/jpeg;base64,${img4}',
  isoAfaq: 'data:image/png;base64,${img5}'
};

/**
 * Génère l'En-tête officiel SCHB GICA conforme au fichier Word
 */
export function renderOfficialHeader(options = {}) {
  const {
    ref = '',
    date = '',
    departement = '',
    showRefDate = true
  } = options;

  return \`
    <header class="schb-letterhead-header" style="width: 100%; font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1F497D; margin-bottom: 20px;">
      <!-- Bandeau supérieur Logo GICA + Titres Institutionnels -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 6px;">
        <!-- Logo GICA officiel -->
        <div style="flex-shrink: 0; width: 145px; text-align: left;">
          <img src="\${LETTERHEAD_ASSETS.logoGica}" alt="GROUPE GICA" style="width: 140px; height: auto; max-height: 85px; object-fit: contain; display: block;" />
        </div>

        <!-- Titres Institutionnels Centrés -->
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 15pt; font-weight: 800; font-family: 'Traditional Arabic', 'Segoe UI', Arial, sans-serif; line-height: 1.25; color: #1F497D; direction: rtl;">
            المـجمــع الصنــاعي لإسمنت الجــزائــر
          </div>
          <div style="font-size: 11pt; font-weight: 800; letter-spacing: 0.5px; color: #1F497D; margin-top: 2px;">
            GROUPE INDUSTRIEL DES CIMENTS D'ALGERIE
          </div>
          <div style="width: 220px; height: 1.2px; background: #1F497D; margin: 4px auto 3px auto;"></div>
          <div style="font-size: 11.5pt; font-weight: 800; letter-spacing: 0.3px; color: #1F497D;">
            SOCIETE DES CIMENTS DE HAMMA BOUZIANE
          </div>
          <div style="font-size: 11pt; font-weight: 800; letter-spacing: 1px; color: #1F497D;">
            « S.C.H.B »
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 700; color: #1F497D; margin-top: 3px; padding: 0 8px;">
            <span>SPA au capital social de: 2.200.000.000 DA</span>
            <span style="direction: rtl; font-family: 'Traditional Arabic', Arial, sans-serif;">ش.ذ.أ. – رأسمالها الإجتماعي</span>
          </div>
        </div>
      </div>

      <!-- Ligne de séparation principale bleue foncée (strokeweight 1.2pt) -->
      <div style="height: 1.8px; background: #1F497D; width: 100%; margin: 4px 0 4px 0;"></div>

      <!-- Barre d'identifications fiscales et légales -->
      <div style="display: flex; justify-content: space-between; font-size: 7.8pt; font-weight: 700; color: #1F497D; padding: 0 4px; line-height: 1.2;">
        <span>N° Identification Fiscale : 0998 2500 6224 525</span>
        <span>N° Article d'Imposition : 25 020 1981 71</span>
        <span>N° Registre de Commerce : 98B0062245</span>
      </div>

      <!-- Désignation de l'unité CIMENTERIE -->
      <div style="text-align: center; font-size: 9.5pt; font-weight: 800; color: #1F497D; letter-spacing: 2px; margin-top: 2px;">
        CIMENTERIE
      </div>

      \${departement ? \`
        <div style="text-align: center; font-size: 8.5pt; font-weight: 700; color: #475569; margin-top: 1px; letter-spacing: 0.5px;">
          \${departement}
        </div>
      \` : ''}

      \${showRefDate ? \`
        <!-- Ligne Réf et Date officielle -->
        <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 9.5pt; color: #000000; margin-top: 14px; padding: 0 2px;">
          <div><strong>Réf :</strong> <span style="font-weight: 700; font-family: monospace;">\${ref || '................................'}</span></div>
          <div>Hamma Bouziane, le <strong>\${date || '................................'}</strong></div>
        </div>
      \` : ''}
    </header>
  \`;
}

/**
 * Génère le Pied de page officiel SCHB GICA conforme au fichier Word (Tableau 4 colonnes)
 */
export function renderOfficialFooter() {
  return \`
    <footer class="schb-letterhead-footer" style="width: 100%; margin-top: auto; padding-top: 12px; font-family: Calibri, 'Segoe UI', Arial, sans-serif;">
      <!-- Ligne supérieure de séparation en pointillés bleus -->
      <div style="border-top: 1.5px solid #0070C0; width: 100%; margin-bottom: 6px;"></div>

      <table style="width: 100%; border-collapse: collapse; font-size: 7.2pt; color: #1F497D; table-layout: fixed;">
        <tr>
          <!-- Colonne 1 : Label Produit Algérien (image1.png) -->
          <td style="width: 60px; vertical-align: middle; text-align: center; padding: 2px 4px 2px 0;">
            <img src="\${LETTERHEAD_ASSETS.labelAlgerien}" alt="منتوج جزائري" style="height: 48px; width: auto; object-fit: contain; display: block; margin: 0 auto;" />
          </td>

          <!-- Colonne 2 : Siège Social Constantine -->
          <td style="vertical-align: top; padding: 0 8px; border-right: 1px solid #cbd5e1; width: calc(50% - 70px);">
            <!-- Adresse -->
            <div style="display: flex; align-items: flex-start; gap: 4px; line-height: 1.25; margin-bottom: 2px;">
              <img src="\${LETTERHEAD_ASSETS.iconPin}" alt="" style="width: 9px; height: 11px; margin-top: 1px; flex-shrink: 0;" />
              <div><strong>Siège Social :</strong> Z.I Rhumel, BP.87 – Boussouf – Constantine, Algérie</div>
            </div>
            <!-- Séparateur pointillé bleu (0070C0) -->
            <div style="border-top: 1px dotted #0070C0; margin: 2px 0;"></div>
            <!-- Téléphones & Fax -->
            <div style="display: flex; align-items: center; justify-content: space-between; line-height: 1.2; margin: 2px 0;">
              <span><span style="color: #0070C0; font-weight: bold;">✆</span> 213 (0) 31 60 65 43</span>
              <span><span style="color: #0070C0; font-weight: bold;">📠</span> 213 (0) 31 60 65 39</span>
            </div>
            <!-- Séparateur pointillé bleu -->
            <div style="border-top: 1px dotted #0070C0; margin: 2px 0;"></div>
            <!-- Email -->
            <div style="line-height: 1.2; margin-top: 2px;">
              <span style="color: #0070C0; font-weight: bold;">✉</span> contacts.schbdg@schb.dz / contacts.schbdg@gica.dz
            </div>
          </td>

          <!-- Colonne 3 : Cimenterie Hamma Bouziane -->
          <td style="vertical-align: top; padding: 0 8px; width: calc(50% - 70px);">
            <!-- Adresse -->
            <div style="display: flex; align-items: flex-start; gap: 4px; line-height: 1.25; margin-bottom: 2px;">
              <img src="\${LETTERHEAD_ASSETS.iconPin}" alt="" style="width: 9px; height: 11px; margin-top: 1px; flex-shrink: 0;" />
              <div><strong>Cimenterie :</strong> BP.02 – Hamma Bouziane – Constantine, Algérie</div>
            </div>
            <!-- Séparateur pointillé bleu -->
            <div style="border-top: 1px dotted #0070C0; margin: 2px 0;"></div>
            <!-- Téléphones & Fax -->
            <div style="display: flex; align-items: center; justify-content: space-between; line-height: 1.2; margin: 2px 0;">
              <span><span style="color: #0070C0; font-weight: bold;">✆</span> 213 (0) 31 90 68 45</span>
              <span><span style="color: #0070C0; font-weight: bold;">📠</span> 213 (0) 31 90 66 23</span>
            </div>
            <!-- Séparateur pointillé bleu -->
            <div style="border-top: 1px dotted #0070C0; margin: 2px 0;"></div>
            <!-- Email -->
            <div style="line-height: 1.2; margin-top: 2px;">
              <span style="color: #0070C0; font-weight: bold;">✉</span> contacts.schbunite@schb.dz / contacts.schbunite@gica.dz
            </div>
          </td>

          <!-- Colonne 4 : Certification AFAQ AFNOR ISO 9001 / ISO 14001 (image5.png) -->
          <td style="width: 75px; vertical-align: middle; text-align: center; padding: 2px 0 2px 4px;">
            <img src="\${LETTERHEAD_ASSETS.isoAfaq}" alt="AFNOR ISO 9001 ISO 14001" style="height: 52px; width: auto; object-fit: contain; display: block; margin: 0 auto;" />
          </td>
        </tr>
      </table>
    </footer>
  \`;
}

/**
 * Cachet Officiel SCHB GICA avec signature DRH
 */
export function renderOfficialSeal(options = {}) {
  const {
    signataireTitre = 'Le Directeur des Ressources Humaines',
    signataireNom = 'Direction RH SCHB',
    mention = 'Signé numériquement par la SCHB GICA',
    qrCodeRef = 'SCHB-VAL-2026'
  } = options;

  return \`
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding: 0 10px;">
      <!-- QR Code de certification officielle -->
      <div style="text-align: center; font-size: 7pt; color: #64748b; font-family: Arial, sans-serif;">
        <div style="width: 70px; height: 70px; border: 1.5px solid #0f172a; margin: 0 auto 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace; font-size: 6.5pt; background: #f8fafc; padding: 2px;">
          <span style="font-weight: 800; color: #1e3a8a;">[QR-CODE]</span>
          <span>SCHB-GICA</span>
          <span style="font-size: 5.5pt; color: #0284c7;">\${qrCodeRef.slice(-6)}</span>
        </div>
        <div style="font-weight: 600;">Certification Numérique<br>Authenticité Vérifiable</div>
      </div>

      <!-- Bloc Signature & Cachet Officiel Violet SCHB GICA -->
      <div style="text-align: center; position: relative; width: 310px; font-family: Calibri, Arial, sans-serif;">
        <div style="font-size: 9pt; font-weight: 700; margin-bottom: 6px; color: #0f172a;">
          P/ Le Directeur Général de la SCHB<br>
          \${signataireTitre}
        </div>

        <!-- Simulation du Cachet Rond Officiel Violet SCHB GICA -->
        <div style="width: 145px; height: 145px; border: 2.5px double #6b21a8; border-radius: 50%; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6b21a8; font-family: Arial, sans-serif; transform: rotate(-5deg); background: rgba(107, 33, 168, 0.02); box-shadow: 0 0 2px rgba(107, 33, 168, 0.4);">
          <div style="font-size: 5.8pt; font-weight: 900; text-align: center; text-transform: uppercase; padding: 0 4px; letter-spacing: 0.5px;">
            ★ GROUPE GICA — SCHB ★
          </div>
          <div style="width: 75%; height: 1px; background: #6b21a8; margin: 3px 0;"></div>
          <div style="font-size: 6.8pt; font-weight: 900; text-align: center; text-transform: uppercase; line-height: 1.1;">
            DIRECTION DES RESSOURCES HUMAINES
          </div>
          <div style="width: 75%; height: 1px; background: #6b21a8; margin: 3px 0;"></div>
          <div style="font-size: 5.5pt; font-weight: 800;">
            ★ HAMMA BOUZIANE ★
          </div>
        </div>

        <div style="font-size: 7.8pt; font-weight: 700; margin-top: 6px; font-style: italic; color: #334155;">
          \${mention}
        </div>
      </div>
    </div>
  \`;
}

/**
 * Enveloppe le contenu avec l'en-tête et le pied de page complets
 */
export function wrapInOfficialDocument(bodyContentHtml, options = {}) {
  const headerHtml = renderOfficialHeader(options);
  const footerHtml = renderOfficialFooter();

  return \`
    <div class="schb-official-document-sheet" style="background: white; color: #0f172a; width: 100%; max-width: 800px; min-height: 1050px; margin: 0 auto; padding: 32px 36px 24px 36px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-family: 'Times New Roman', Calibri, Georgia, serif; position: relative; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div>
        \${headerHtml}
        <div class="schb-official-document-body" style="margin-top: 15px;">
          \${bodyContentHtml}
        </div>
      </div>
      \${footerHtml}
    </div>
  \`;
}

/**
 * Déclenche l'impression d'un document officiel dans une fenêtre dédiée
 */
export function printOfficialDocument(bodyContentHtml, options = {}) {
  const {
    documentTitle = 'Document Officiel — SCHB GICA',
    orientation = 'portrait'
  } = options;

  const fullSheetHtml = wrapInOfficialDocument(bodyContentHtml, options);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer ce document.");
    return;
  }

  printWindow.document.write(\`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>\${documentTitle}</title>
        <style>
          @page {
            size: A4 \${orientation};
            margin: 10mm 12mm 10mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #0f172a;
            font-family: Calibri, Arial, sans-serif;
          }
          .schb-official-document-sheet {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            min-height: 270mm !important;
            width: 100% !important;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.print(); window.close(); }, 350);">
        \${fullSheetHtml}
      </body>
    </html>
  \`);
  printWindow.document.close();
}
`;

fs.writeFileSync('c:/rh2/src/components/letterhead.js', content, 'utf8');
console.log('Successfully written c:/rh2/src/components/letterhead.js');
