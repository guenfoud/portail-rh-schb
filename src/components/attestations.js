import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';

let documentsHistory = [];

export const AttestationsComponent = {
  title: 'Portail d\'Attestations & Documents RH',
  subtitle: 'Délivrance instantanée en 1 clic avec cachet numérique officiel SCHB GICA et certification QR code',

  async render(queryParams = {}) {
    const user = getCurrentUser();
    try {
      documentsHistory = await api.getAttestations();
    } catch (err) {
      console.error('Erreur chargement attestations:', err);
      documentsHistory = [];
    }

    return `
      <div class="tab-container" style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Bannière d'Accueil Self-Service -->
        <div class="card" style="padding: 24px; background: linear-gradient(135deg, rgba(19,84,122,0.1), rgba(19,84,122,0.02)); border: 1px solid rgba(19,84,122,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="background: var(--primary); color: white; width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(19,84,122,0.3);">
                <i data-lucide="stamp" style="width: 28px; height: 28px;"></i>
              </div>
              <div>
                <h2 style="margin: 0; font-size: 1.25rem; color: var(--primary); font-weight: 800;">Libre-Service RH Collaborateurs — SCHB GICA</h2>
                <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-secondary);">
                  Générez vos documents administratifs officiels instantanément, certifiés avec le cachet numérique de la Direction des Ressources Humaines.
                </p>
              </div>
            </div>
            <div>
              <span class="badge success" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 600;">
                <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle;"></i> Service Actif 24/7
              </span>
            </div>
          </div>
        </div>

        <!-- Catalogue des 4 Documents RH Disponibles en 1 Clic -->
        <div>
          <h3 style="margin: 0 0 16px; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="files" style="width: 18px; height: 18px; color: var(--primary);"></i>
            <span>Documents Disponibles Immédiatement</span>
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
            
            <!-- Carte 1 : Attestation de Travail -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid var(--primary); transition: transform 0.2s ease, box-shadow 0.2s ease;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(19,84,122,0.1); color: var(--primary); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="file-text" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge info">1-Clic Instantané</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Attestation de Travail</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Certifie votre qualité de salarié au sein de la SCHB, votre poste, département et ancienneté. Utilisable pour dossiers consulaires, visas et administrations.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Attestation_Travail" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span>Générer l'Attestation</span>
              </button>
            </div>

            <!-- Carte 2 : Relevé d'Émoluments & Salaire -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #0284c7;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(2,132,199,0.1); color: #0284c7; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="receipt" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge info">Prêt Banque</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Relevé d'Émoluments</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Atteste de votre rémunération brute et base contractuelle officielle. Conforme pour les dossiers de crédit bancaire, leasing ou garanties financières.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Releve_Emoluments" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #0284c7; border-color: #0284c7;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span>Générer le Relevé</span>
              </button>
            </div>

            <!-- Carte 3 : Titre de Congé Officiel -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #16a34a;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(22,163,74,0.1); color: #16a34a; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="plane" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge success">Validé RH</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Titre de Congé Réglementaire</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Reçu officiel confirmant votre autorisation d'absence annuelle, vos dates de départ et de reprise, avec décompte du solde de congé payé.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Titre_Conge" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #16a34a; border-color: #16a34a;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span>Générer le Titre</span>
              </button>
            </div>

            <!-- Carte 4 : Certificat de Travail -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #8b5cf6;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(139,92,246,0.1); color: #8b5cf6; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="award" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge secondary">Officiel</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Certificat de Travail</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Document légal certifiant la durée d'activité, les postes occupés et attestant que le collaborateur est libre de tout engagement légal.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Certificat_Travail" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #8b5cf6; border-color: #8b5cf6;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span>Générer le Certificat</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Historique des Documents Générés -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 16px; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="history" style="width: 18px; height: 18px; color: var(--primary);"></i>
            <span>Historique de vos Documents Officiels Déjà Émis</span>
          </h3>

          ${documentsHistory.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
              <i data-lucide="file-question" style="width: 44px; height: 44px; margin-bottom: 8px; opacity: 0.5;"></i>
              <p style="margin: 0;">Aucun document émis pour le moment. Cliquez sur un des boutons ci-dessus pour générer votre premier document en 1 clic.</p>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="table" style="width: 100%; margin: 0;">
                <thead>
                  <tr style="background: var(--bg-secondary);">
                    <th>Réf. Document</th>
                    ${user?.role === 'hr' ? `<th>Salarié</th>` : ''}
                    <th>Type de Document</th>
                    <th>Motif</th>
                    <th>Date d'Émission</th>
                    <th>Statut</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${documentsHistory.map(d => {
                    const typeLabel = d.type_document === 'Attestation_Travail' ? 'Attestation de Travail' :
                      (d.type_document === 'Releve_Emoluments' ? 'Relevé d\'Émoluments' :
                      (d.type_document === 'Titre_Conge' ? 'Titre de Congé' : 'Certificat de Travail'));
                    return `
                      <tr>
                        <td><strong style="font-family: monospace; color: var(--primary);">${escapeHtml(d.reference_doc)}</strong></td>
                        ${user?.role === 'hr' ? `
                          <td>
                            <div style="font-weight: 600;">${escapeHtml(d.prenom || '')} ${escapeHtml(d.nom || '')}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">#${escapeHtml(d.matricule)}</div>
                          </td>
                        ` : ''}
                        <td><strong>${escapeHtml(typeLabel)}</strong></td>
                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(d.motif || 'Usage administratif')}</td>
                        <td>${formatDateFR(d.genere_a ? d.genere_a.split('T')[0] : '')}</td>
                        <td><span class="badge success">${escapeHtml(d.statut)}</span></td>
                        <td style="text-align: right;">
                          <button class="btn btn-secondary btn-sm btn-reprint-doc" data-type="${d.type_document}" data-ref="${d.reference_doc}" data-mat="${d.matricule}">
                            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Voir / Imprimer
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

      </div>
    `;
  },

  async init() {
    this.bindEvents();
    if (window.lucide) window.lucide.createIcons();
  },

  bindEvents() {
    // Boutons de génération directe
    document.querySelectorAll('.btn-generate-doc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        this.promptGenerationModal(type);
      });
    });

    // Revoir un document déjà émis
    document.querySelectorAll('.btn-reprint-doc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        const ref = e.currentTarget.getAttribute('data-ref');
        const mat = e.currentTarget.getAttribute('data-mat');

        try {
          const res = await api.generateAttestation({ type_document: type, matricule: mat, motif: 'Réimpression document' });
          if (res.document) {
            res.document.reference = ref; // Conserver la référence historique
            this.openDocumentViewerModal(res.document);
          }
        } catch (err) {
          toast(err.message || 'Erreur affichage document.', 'error');
        }
      });
    });
  },

  promptGenerationModal(type) {
    const user = getCurrentUser();
    const typeLabel = type === 'Attestation_Travail' ? 'Attestation de Travail' :
      (type === 'Releve_Emoluments' ? 'Relevé d\'Émoluments' :
      (type === 'Titre_Conge' ? 'Titre de Congé Réglementaire' : 'Certificat de Travail'));

    const modalHtml = `
      <form id="form-motif-doc" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: rgba(19,84,122,0.06); padding: 14px; border-radius: 8px; border: 1px solid rgba(19,84,122,0.2);">
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">Document sollicité :</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${typeLabel}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
            Bénéficiaire : <strong>${user.prenom} ${user.nom}</strong> (Matricule #${user.matricule} • ${user.departement})
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Motif / Organisme Destinataire * :</label>
          <select id="doc-motif-select" class="form-control" style="width: 100%; margin-bottom: 8px;">
            <option value="Dossier Bancaire / Demande de Crédit">Dossier Bancaire / Demande de Crédit</option>
            <option value="Dossier Consulaire / Demande de Visa">Dossier Consulaire / Demande de Visa</option>
            <option value="Dossier Logement / AADL / LPP">Dossier Logement (AADL, LPP, LPA)</option>
            <option value="Démarches Administratives Générales">Démarches Administratives Générales</option>
            <option value="Autre">Autre motif personnalisé...</option>
          </select>
          <input type="text" id="doc-motif-custom" class="form-control" placeholder="Précisez le motif..." style="width: 100%; display: none;">
        </div>

        <div style="font-size: 0.82rem; color: #16a34a; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="shield-check" style="width: 16px; height: 16px;"></i>
          <span>Document certifié numériquement avec cachet officiel SCHB GICA et QR code d'intégrité.</span>
        </div>
      </form>
    `;

    openModal(
      `Génération en 1 Clic — ${typeLabel}`,
      modalHtml,
      [
        {
          label: 'Annuler',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Générer et Télécharger',
          class: 'btn btn-primary',
          onClick: async () => {
            const selectVal = document.getElementById('doc-motif-select').value;
            const customVal = document.getElementById('doc-motif-custom').value.trim();
            const motif = selectVal === 'Autre' && customVal ? customVal : selectVal;

            try {
              const res = await api.generateAttestation({ type_document: type, motif });
              closeModal();
              toast('Document officiel généré avec succès !', 'success');
              if (res.document) {
                this.openDocumentViewerModal(res.document);
              }
            } catch (err) {
              toast(err.message || 'Erreur lors de la génération.', 'error');
            }
          }
        }
      ]
    );

    // Basculer l'input personnalisé si 'Autre'
    const select = document.getElementById('doc-motif-select');
    const custom = document.getElementById('doc-motif-custom');
    if (select && custom) {
      select.addEventListener('change', () => {
        custom.style.display = select.value === 'Autre' ? 'block' : 'none';
        if (select.value === 'Autre') custom.focus();
      });
    }
    if (window.lucide) window.lucide.createIcons();
  },

  openDocumentViewerModal(doc) {
    const emp = doc.employee || {};
    const dateGen = formatDateFR(doc.date_generation);
    const dateEmbauche = formatDateFR(emp.date_embauche);

    const docViewerHtml = `
      <div id="official-rh-document" style="background: white; color: #0f172a; padding: 40px; font-family: 'Times New Roman', Times, serif; border: 1px solid #cbd5e1; max-width: 740px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.06); position: relative;">
        
        <!-- En-Tête Officiel République & Groupe GICA -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 24px;">
          <div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            République Algérienne Démocratique et Populaire
          </div>
          <div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
            Ministère de l'Industrie et de la Production Pharmaceutique
          </div>
          <div style="margin-top: 10px; font-size: 1.05rem; font-weight: 900; color: #13547a;">
            GROUPE INDUSTRIEL DES CIMENTS D'ALGÉRIE — GICA
          </div>
          <div style="font-size: 1.15rem; font-weight: 900; letter-spacing: 0.5px; color: #0f172a;">
            SOCIÉTÉ DES CIMENTS DE HAMMA BOUZIANE — SCHB
          </div>
          <div style="font-size: 0.85rem; font-style: italic; color: #475569; margin-top: 2px;">
            Direction des Ressources Humaines & Affaires Générales
          </div>
        </div>

        <!-- Réf & Date -->
        <div style="display: flex; justify-content: space-between; font-size: 0.95rem; margin-bottom: 30px;">
          <div><strong>Réf :</strong> <span style="font-family: monospace; font-weight: 700;">${escapeHtml(doc.reference)}</span></div>
          <div>Hamma Bouziane, le <strong>${dateGen}</strong></div>
        </div>

        <!-- Titre du Document -->
        <div style="text-align: center; margin: 36px 0;">
          <h1 style="font-size: 1.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: underline; margin: 0; color: #0f172a;">
            ATTESTATION DE TRAVAIL
          </h1>
        </div>

        <!-- Corps du Texte Officiel -->
        <div style="font-size: 1.1rem; line-height: 1.8; text-align: justify; margin-bottom: 40px; text-indent: 40px;">
          Nous soussignés, <strong>Société des Ciments de Hamma Bouziane (SCHB)</strong>, Filiale du 
          <strong>Groupe Industriel des Ciments d'Algérie (GICA)</strong>, attestons par la présente que :
        </div>

        <div style="font-size: 1.1rem; line-height: 1.9; margin: 0 0 30px 40px;">
          Monsieur / Madame : <strong>${escapeHtml(emp.nom || '').toUpperCase()} ${escapeHtml(emp.prenom || '')}</strong><br>
          Matricule Professionnel : <strong>#${escapeHtml(emp.matricule || '')}</strong><br>
          Recruté(e) le : <strong>${dateEmbauche}</strong><br>
          Département / Service : <strong>${escapeHtml(emp.departement || '')}</strong><br>
          Fonction Occupée : <strong>${escapeHtml(emp.poste || '')}</strong><br>
          Type de Contrat : <strong>${escapeHtml(emp.type_contrat || 'Contrat à Durée Indéterminée (CDI)')}</strong>
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 40px; text-indent: 40px;">
          Est actuellement en activité au sein de notre complexe industriel cimentier et n'a fait l'objet d'aucune 
          mesure de cessation ou de suspension d'activité à ce jour.
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 50px; text-indent: 40px;">
          La présente attestation est délivrée à l'intéressé(e) à sa demande pour servir et valoir ce que de droit.
        </div>

        <!-- Zone Cachet Numérique Violet & Signature DRH -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 10px;">
          
          <!-- QR Code de certification -->
          <div style="text-align: center; font-size: 0.72rem; color: #64748b; font-family: sans-serif;">
            <div style="width: 80px; height: 80px; border: 2px solid #0f172a; margin: 0 auto 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace; font-size: 0.65rem; background: #f8fafc; padding: 4px;">
              <span style="font-weight: 800;">[QR-CODE]</span>
              <span>VERIF-SCHB</span>
              <span>${doc.reference.slice(-4)}</span>
            </div>
            <div>Certification Numérique<br>Authenticité Vérifiable</div>
          </div>

          <!-- Bloc Signature & Cachet Officiel Violet SCHB GICA -->
          <div style="text-align: center; position: relative; width: 320px;">
            <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px;">
              P/ Le Directeur Général de la SCHB<br>
              Le Directeur des Ressources Humaines
            </div>

            <!-- Simulation du Cachet Officiel Violet SCHB GICA -->
            <div style="width: 170px; height: 170px; border: 3px double #7c3aed; border-radius: 50%; margin: 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #7c3aed; font-family: sans-serif; transform: rotate(-5deg); box-shadow: 0 0 2px rgba(124, 58, 237, 0.5);">
              <div style="font-size: 0.62rem; font-weight: 900; text-align: center; text-transform: uppercase; padding: 0 8px;">
                ★ GROUPE GICA — SCHB ★
              </div>
              <div style="width: 80%; height: 1px; background: #7c3aed; margin: 4px 0;"></div>
              <div style="font-size: 0.75rem; font-weight: 900; text-align: center; text-transform: uppercase;">
                DIRECTION DES RESSOURCES HUMAINES
              </div>
              <div style="width: 80%; height: 1px; background: #7c3aed; margin: 4px 0;"></div>
              <div style="font-size: 0.58rem; font-weight: 800;">
                ★ RÉPUBLIQUE ALGÉRIENNE ★
              </div>
            </div>

            <div style="font-size: 0.85rem; font-weight: 700; margin-top: 6px; font-style: italic; color: #334155;">
              Signé numériquement par la DRH SCHB
            </div>
          </div>

        </div>

        <!-- Bas de page légal -->
        <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 0.72rem; color: #64748b; text-align: center; font-family: sans-serif;">
          Société des Ciments de Hamma Bouziane — SCHB / Filiale du Groupe Industriel des Ciments d'Algérie (GICA)<br>
          Zone Industrielle Hamma Bouziane, Constantine, Algérie • Tél: +213 31 66 12 00 • Web: portail-rh.schb.gica.dz
        </div>
      </div>
    `;

    openModal(
      `Attestation Officielle — ${doc.reference}`,
      docViewerHtml,
      [
        {
          label: 'Fermer',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Télécharger / Imprimer (PDF)',
          class: 'btn btn-primary',
          onClick: () => {
            const printContent = document.getElementById('official-rh-document').outerHTML;
            const win = window.open('', '_blank');
            win.document.write(`
              <html>
                <head>
                  <title>Attestation de Travail — SCHB GICA</title>
                  <style>
                    body { margin: 20px; font-family: 'Times New Roman', serif; background: white; }
                    @media print {
                      body { margin: 0; }
                      @page { size: A4; margin: 15mm; }
                    }
                  </style>
                </head>
                <body onload="window.print(); window.close();">
                  ${printContent}
                </body>
              </html>
            `);
            win.document.close();
          }
        }
      ]
    );
  }
};
