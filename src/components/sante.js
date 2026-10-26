import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';

let habilitationsData = [];
let allEmployees = [];
let currentFilter = 'tous'; // 'tous' | 'valide' | 'expire_bientot' | 'expire'
let searchTerm = '';
let selectedDept = 'tous';

export const SanteComponent = {
  title: 'Santé au Travail & Habilitations Sécurité',
  subtitle: 'Suivi de la médecine du travail, permis engins (CACES) et habilitations électriques (HSE Cimenterie)',

  async render(queryParams = {}) {
    const user = getCurrentUser();
    try {
      [habilitationsData, allEmployees] = await Promise.all([
        api.getHabilitations(),
        (user?.role === 'hr' || user?.role === 'supervisor') ? api.getEmployees() : Promise.resolve([])
      ]);
    } catch (err) {
      console.error('Erreur chargement habilitations:', err);
      habilitationsData = [];
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Calculs statistiques
    const totalCount = habilitationsData.length;
    const validesCount = habilitationsData.filter(h => h.statut === 'Valide').length;
    const alertesJ30Count = habilitationsData.filter(h => h.statut === 'Expire_Bientot').length;
    const expiresCount = habilitationsData.filter(h => h.statut === 'Expire').length;

    // Récupérer la liste des départements uniques
    const departements = Array.from(new Set(habilitationsData.map(h => h.departement).filter(Boolean)));

    return `
      <div class="tab-container" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Cartes Statistiques HSE Cimenterie SCHB GICA -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid var(--primary);">
            <div style="background: rgba(19, 84, 122, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
              <i data-lucide="shield-check" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Total Enregistrements</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${totalCount}</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #16a34a;">
            <div style="background: rgba(22, 163, 74, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #16a34a;">
              <i data-lucide="check-circle-2" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Aptitudes Valides</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #16a34a;">${validesCount}</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #f59e0b;">
            <div style="background: rgba(245, 158, 11, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
              <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Alertes Échéance J-30</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">${alertesJ30Count}</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #dc2626;">
            <div style="background: rgba(220, 38, 38, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #dc2626;">
              <i data-lucide="alert-triangle" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Expirées / Inaptes</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${expiresCount}</div>
            </div>
          </div>
        </div>

        <!-- Alerte Industrielle HSE Cimenterie -->
        ${(alertesJ30Count > 0 || expiresCount > 0) ? `
          <div class="card" style="padding: 16px 20px; background: linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(245, 158, 11, 0.08)); border: 1px solid rgba(220, 38, 38, 0.3); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="background: #dc2626; color: white; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="shield-alert" style="width: 22px; height: 22px;"></i>
              </div>
              <div>
                <h4 style="margin: 0; color: #b91c1c; font-size: 1rem;">Vigilance Sécurité Industrielle Cimenterie SCHB GICA</h4>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                  ${expiresCount > 0 ? `<strong>${expiresCount} habilitation(s) expirée(s)</strong> (Interdiction de conduite d'engins ou d'interventions électriques). ` : ''}
                  ${alertesJ30Count > 0 ? `<strong>${alertesJ30Count} visite(s) ou habilitation(s)</strong> arrivent à échéance dans les 30 prochains jours.` : ''}
                </div>
              </div>
            </div>

            ${(user?.role === 'hr' || user?.role === 'supervisor') ? `
              <button class="btn btn-secondary btn-sm" id="btn-trigger-alerts" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="bell-ring" style="width: 15px; height: 15px;"></i>
                <span>Diffuser les Notifications J-30</span>
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- Barre de Filtres et Action -->
        <div class="card" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; flex: 1;">
            
            <!-- Recherche rapide -->
            <div style="position: relative; min-width: 220px; flex: 1; max-width: 320px;">
              <i data-lucide="search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-secondary);"></i>
              <input type="text" id="sante-search" class="form-control" placeholder="Rechercher salarié, permis, B2V..." value="${escapeHtml(searchTerm)}" style="padding-left: 34px; width: 100%;">
            </div>

            <!-- Filtre Statut -->
            <select id="sante-filter-statut" class="form-control" style="width: auto;">
              <option value="tous" ${currentFilter === 'tous' ? 'selected' : ''}>Tous les statuts</option>
              <option value="valide" ${currentFilter === 'valide' ? 'selected' : ''}>Valides (${validesCount})</option>
              <option value="expire_bientot" ${currentFilter === 'expire_bientot' ? 'selected' : ''}>Échéance J-30 (${alertesJ30Count})</option>
              <option value="expire" ${currentFilter === 'expire' ? 'selected' : ''}>Expirées (${expiresCount})</option>
            </select>

            <!-- Filtre Département -->
            ${departements.length > 0 ? `
              <select id="sante-filter-dept" class="form-control" style="width: auto;">
                <option value="tous" ${selectedDept === 'tous' ? 'selected' : ''}>Tous les départements</option>
                ${departements.map(d => `<option value="${d}" ${selectedDept === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            ` : ''}
          </div>

          <!-- Bouton Ajouter -->
          ${(user?.role === 'hr' || user?.role === 'supervisor') ? `
            <div>
              <button class="btn btn-primary" id="btn-nouveau-hab" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i>
                <span>Enregistrer une Habilitation</span>
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Tableau des Habilitations -->
        <div id="sante-table-container">
          ${this.renderHabilitationsTable(this.getFilteredData())}
        </div>

      </div>
    `;
  },

  getFilteredData() {
    return habilitationsData.filter(h => {
      // Filtre statut
      if (currentFilter === 'valide' && h.statut !== 'Valide') return false;
      if (currentFilter === 'expire_bientot' && h.statut !== 'Expire_Bientot') return false;
      if (currentFilter === 'expire' && h.statut !== 'Expire') return false;

      // Filtre département
      if (selectedDept !== 'tous' && h.departement !== selectedDept) return false;

      // Recherche texte
      if (searchTerm) {
        const text = `${h.nom} ${h.prenom} ${h.matricule} ${h.type_habilitation} ${h.numero_certificat || ''} ${h.organisme_delivreur || ''}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }

      return true;
    });
  },

  renderHabilitationsTable(items) {
    if (!items || items.length === 0) {
      return `
        <div class="card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <i data-lucide="shield-off" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="font-size: 1rem;">Aucune habilitation ou visite médicale ne correspond à vos filtres.</p>
        </div>
      `;
    }

    const today = new Date();
    const user = getCurrentUser();

    return `
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="table" style="width: 100%; margin: 0;">
            <thead>
              <tr style="background: var(--bg-secondary);">
                <th>Salarié</th>
                <th>Certification / Habilitation Sécurité</th>
                <th>Organisme & Réf</th>
                <th>Dates Validité</th>
                <th>Échéance</th>
                <th>Statut</th>
                ${user?.role === 'hr' || user?.role === 'supervisor' ? `<th style="text-align: right;">Actions</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${items.map(h => {
                const expDate = new Date(h.date_expiration);
                const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                const isExpired = diffDays < 0;

                let badgeClass = 'success';
                let badgeLabel = 'Valide';
                if (isExpired) {
                  badgeClass = 'danger';
                  badgeLabel = 'Expiré';
                } else if (diffDays <= 30) {
                  badgeClass = 'warning';
                  badgeLabel = `J-${diffDays}`;
                }

                return `
                  <tr style="${isExpired ? 'background: rgba(220, 38, 38, 0.03);' : ''}">
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(h.prenom || '')} ${escapeHtml(h.nom || '')}</div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary);">Matricule #${escapeHtml(h.matricule)} • ${escapeHtml(h.departement || '-')}</div>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(h.type_habilitation)}</div>
                      ${h.remarques ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(h.remarques)}</div>` : ''}
                    </td>
                    <td>
                      <div style="font-size: 0.88rem;">${escapeHtml(h.organisme_delivreur || 'SCHB Médecine')}</div>
                      ${h.numero_certificat ? `<div style="font-size: 0.78rem; font-family: monospace; color: var(--text-secondary);">${escapeHtml(h.numero_certificat)}</div>` : ''}
                    </td>
                    <td>
                      <div style="font-size: 0.85rem;">Obtention : <strong>${formatDateFR(h.date_obtention)}</strong></div>
                      <div style="font-size: 0.85rem; color: ${isExpired ? '#dc2626' : (diffDays <= 30 ? '#d97706' : 'var(--text-primary)')};">
                        Expiration : <strong>${formatDateFR(h.date_expiration)}</strong>
                      </div>
                    </td>
                    <td>
                      ${isExpired ? `
                        <span style="color: #dc2626; font-weight: 700; font-size: 0.85rem;">Expiré depuis ${Math.abs(diffDays)} j</span>
                      ` : (diffDays <= 30 ? `
                        <span style="color: #d97706; font-weight: 700; font-size: 0.85rem;">Reste ${diffDays} jour(s)</span>
                      ` : `
                        <span style="color: #16a34a; font-size: 0.85rem;">${diffDays} jours</span>
                      `)}
                    </td>
                    <td>
                      <span class="badge ${badgeClass}">${badgeLabel}</span>
                    </td>
                    ${user?.role === 'hr' || user?.role === 'supervisor' ? `
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm btn-edit-hab" data-id="${h.id}" title="Renouveler ou modifier" style="margin-right: 4px;">
                          <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        ${user?.role === 'hr' ? `
                          <button class="btn btn-danger btn-sm btn-delete-hab" data-id="${h.id}" title="Supprimer">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                          </button>
                        ` : ''}
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async init() {
    this.bindEvents();
    if (window.lucide) window.lucide.createIcons();
  },

  bindEvents() {
    // Recherche dynamique
    const searchInput = document.getElementById('sante-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.trim();
        this.updateTable();
      });
    }

    // Filtre statut
    const filterStatut = document.getElementById('sante-filter-statut');
    if (filterStatut) {
      filterStatut.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        this.updateTable();
      });
    }

    // Filtre département
    const filterDept = document.getElementById('sante-filter-dept');
    if (filterDept) {
      filterDept.addEventListener('change', (e) => {
        selectedDept = e.target.value;
        this.updateTable();
      });
    }

    // Déclencher les alertes J-30
    const btnTriggerAlerts = document.getElementById('btn-trigger-alerts');
    if (btnTriggerAlerts) {
      btnTriggerAlerts.addEventListener('click', async () => {
        try {
          const res = await api.checkHabilitationAlerts();
          toast(res.message || 'Alertes de sécurité diffusées.', 'success');
        } catch (err) {
          toast(err.message || 'Erreur lors de la diffusion des alertes.', 'error');
        }
      });
    }

    // Nouveau
    const btnNouveau = document.getElementById('btn-nouveau-hab');
    if (btnNouveau) {
      btnNouveau.addEventListener('click', () => this.openHabModal());
    }

    // Éditer / Renouveler
    document.querySelectorAll('.btn-edit-hab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const hab = habilitationsData.find(h => h.id === id);
        if (hab) this.openHabModal(hab);
      });
    });

    // Supprimer
    document.querySelectorAll('.btn-delete-hab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ok = await confirmDialog("Êtes-vous sûr de vouloir supprimer cet enregistrement de sécurité ?");
        if (!ok) return;

        try {
          await api.deleteHabilitation(id);
          toast("Habilitation supprimée avec succès.", "success");
          habilitationsData = await api.getHabilitations();
          this.updateTable();
        } catch (err) {
          toast(err.message || "Erreur lors de la suppression.", "error");
        }
      });
    });
  },

  updateTable() {
    const container = document.getElementById('sante-table-container');
    if (container) {
      container.innerHTML = this.renderHabilitationsTable(this.getFilteredData());
      if (window.lucide) window.lucide.createIcons();
      this.bindTableActions();
    }
  },

  bindTableActions() {
    document.querySelectorAll('.btn-edit-hab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const hab = habilitationsData.find(h => h.id === id);
        if (hab) this.openHabModal(hab);
      });
    });

    document.querySelectorAll('.btn-delete-hab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ok = await confirmDialog("Êtes-vous sûr de vouloir supprimer cet enregistrement de sécurité ?");
        if (!ok) return;

        try {
          await api.deleteHabilitation(id);
          toast("Habilitation supprimée avec succès.", "success");
          habilitationsData = await api.getHabilitations();
          this.updateTable();
        } catch (err) {
          toast(err.message || "Erreur lors de la suppression.", "error");
        }
      });
    });
  },

  openHabModal(hab = null) {
    const isEdit = !!hab;
    const defaultDate = new Date().toISOString().split('T')[0];
    const defaultExp = new Date();
    defaultExp.setFullYear(defaultExp.getFullYear() + 1);
    const defaultExpStr = defaultExp.toISOString().split('T')[0];

    const typesPredefinis = [
      "Visite Médicale Périodique Aptitude au Poste (Médecine du Travail SCHB)",
      "CACES R482 Engins de Chantier Cimenterie (Chargeuse & Dumper)",
      "Habilitation Électrique B2V / BR / BC Haute Tension",
      "Habilitation Électrique B0 / H0V (Non-Électriciens & IT)",
      "Autorisation Travaux en Hauteur & Silos / Espaces Confinés",
      "Secouriste Sauveteur du Travail (SST Cimenterie)",
      "Permis de Feu & Sécurité Incendie Cimenterie"
    ];

    const formHtml = `
      <form id="form-hab" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Salarié Concerne * :</label>
          <select id="hab-matricule" class="form-control" required style="width: 100%;">
            ${allEmployees.map(e => `
              <option value="${e.matricule}" ${hab && hab.matricule === e.matricule ? 'selected' : ''}>
                ${e.nom} ${e.prenom} (Matricule #${e.matricule} • ${e.departement} • ${e.poste})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Type d'Habilitation / Visite Sécurité * :</label>
          <input list="types-list" id="hab-type" class="form-control" value="${escapeHtml(hab?.type_habilitation || '')}" placeholder="Sélectionnez ou saisissez l'intitulé exact..." required style="width: 100%;">
          <datalist id="types-list">
            ${typesPredefinis.map(t => `<option value="${t}">`).join('')}
          </datalist>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Organisme Délivreur :</label>
            <input type="text" id="hab-organisme" class="form-control" value="${escapeHtml(hab?.organisme_delivreur || 'Médecine du Travail SCHB GICA')}" placeholder="Ex: SCHB, Bureau Veritas, Apave..." style="width: 100%;">
          </div>
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">N° de Certificat / Registre :</label>
            <input type="text" id="hab-numero" class="form-control" value="${escapeHtml(hab?.numero_certificat || '')}" placeholder="Ex: CACES-2026-XXXX" style="width: 100%;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Date d'Obtention / Visite * :</label>
            <input type="date" id="hab-date-obt" class="form-control" value="${hab?.date_obtention || defaultDate}" required style="width: 100%;">
          </div>
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Date d'Échéance / Expiration * :</label>
            <input type="date" id="hab-date-exp" class="form-control" value="${hab?.date_expiration || defaultExpStr}" required style="width: 100%;">
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Avis Médical / Restrictions ou Remarques :</label>
          <textarea id="hab-remarques" class="form-control" rows="2" placeholder="Ex: Apte sans restriction, Port de lunettes correctrices obligatoire, Port d'EPI renforcé..." style="width: 100%;">${escapeHtml(hab?.remarques || '')}</textarea>
        </div>
      </form>
    `;

    openModal(
      isEdit ? "Renouvellement d'Habilitation / Visite" : "Enregistrement Sécurité & Santé HSE",
      formHtml,
      [
        {
          label: 'Annuler',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: isEdit ? 'Mettre à Jour' : 'Enregistrer',
          class: 'btn btn-primary',
          onClick: async () => {
            const form = document.getElementById('form-hab');
            if (!form.reportValidity()) return;

            const payload = {
              id: hab?.id || null,
              matricule: document.getElementById('hab-matricule').value,
              type_habilitation: document.getElementById('hab-type').value.trim(),
              organisme_delivreur: document.getElementById('hab-organisme').value.trim(),
              numero_certificat: document.getElementById('hab-numero').value.trim(),
              date_obtention: document.getElementById('hab-date-obt').value,
              date_expiration: document.getElementById('hab-date-exp').value,
              remarques: document.getElementById('hab-remarques').value.trim()
            };

            try {
              await api.saveHabilitation(payload);
              toast(isEdit ? "Habilitation mise à jour avec succès." : "Habilitation enregistrée avec succès.", "success");
              closeModal();
              habilitationsData = await api.getHabilitations();
              const mainContainer = document.getElementById('main-view-container');
              if (mainContainer) {
                mainContainer.innerHTML = await this.render();
                await this.init();
              }
            } catch (err) {
              toast(err.message || "Erreur lors de l'enregistrement.", "error");
            }
          }
        }
      ]
    );
  }
};
