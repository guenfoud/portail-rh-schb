import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';

let currentTab = 'mes-bons'; // 'mes-bons' | 'attente' | 'poste-garde' | 'historique'
let bonsData = [];
let allEmployees = [];

export const BonsSortieComponent = {
  title: 'Bons de Sortie & Ordres de Mission',
  subtitle: 'Gestion des autorisations de sortie courte durée (1h à 4h), impact paie et visas sécurité',

  async render(queryParams = {}) {
    const user = getCurrentUser();
    if (queryParams.tab) {
      currentTab = queryParams.tab;
    } else if (user?.role === 'employee' && currentTab === 'attente') {
      currentTab = 'mes-bons';
    }

    try {
      [bonsData, allEmployees] = await Promise.all([
        api.getBonsSortie(),
        (user?.role === 'hr' || user?.role === 'supervisor') ? api.getEmployees() : Promise.resolve([])
      ]);
    } catch (err) {
      console.error('Erreur chargement bons de sortie:', err);
      bonsData = [];
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const userMat = user?.matricule;

    // Filtres selon onglet
    const mesBons = bonsData.filter(b => String(b.matricule) === String(userMat));
    const enAttente = bonsData.filter(b => b.statut === 'En attente');
    const sortiesDuJour = bonsData.filter(b => b.date_sortie === todayStr);

    // Statistiques rapides
    const totalSortiesMois = bonsData.filter(b => b.date_sortie && b.date_sortie.startsWith(todayStr.slice(0, 7))).length;
    const totalHeuresMois = bonsData
      .filter(b => b.date_sortie && b.date_sortie.startsWith(todayStr.slice(0, 7)) && b.statut !== 'Refusé')
      .reduce((acc, b) => acc + (parseFloat(b.duree_heures) || 0), 0);
    const totalEnAttente = enAttente.length;
    const totalEnCoursJour = sortiesDuJour.filter(b => b.statut === 'Validé' && !b.heure_retour_reelle).length;

    return `
      <div class="tab-container" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Cartes Statistiques Métier Industrielles -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid var(--primary);">
            <div style="background: rgba(19, 84, 122, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
              <i data-lucide="send" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Sorties ce mois</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${totalSortiesMois}</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #0284c7;">
            <div style="background: rgba(2, 132, 199, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #0284c7;">
              <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Heures d'absence cumulées</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #0284c7;">${Math.round(totalHeuresMois * 10) / 10} h</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #f59e0b;">
            <div style="background: rgba(245, 158, 11, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
              <i data-lucide="alert-circle" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Bons en attente</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">${totalEnAttente}</div>
            </div>
          </div>

          <div class="card" style="padding: 16px 20px; display: flex; align-items: center; gap: 16px; border-left: 4px solid #16a34a;">
            <div style="background: rgba(22, 163, 74, 0.1); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #16a34a;">
              <i data-lucide="shield-check" style="width: 24px; height: 24px;"></i>
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Sorties Actives du Jour</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: #16a34a;">${totalEnCoursJour}</div>
            </div>
          </div>
        </div>

        <!-- Barre de Navigation Sous-Onglets & Actions -->
        <div class="card" style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap;" id="bons-tabs">
            <button class="btn ${currentTab === 'mes-bons' ? 'btn-primary' : 'btn-secondary'}" data-tab="mes-bons" style="display: inline-flex; align-items: center; gap: 8px;">
              <i data-lucide="user" style="width: 16px; height: 16px;"></i>
              <span>Mes Bons (${mesBons.length})</span>
            </button>

            ${(user?.role === 'hr' || user?.role === 'supervisor') ? `
              <button class="btn ${currentTab === 'attente' ? 'btn-primary' : 'btn-secondary'}" data-tab="attente" style="display: inline-flex; align-items: center; gap: 8px;">
                <i data-lucide="inbox" style="width: 16px; height: 16px;"></i>
                <span>À Valider</span>
                ${enAttente.length > 0 ? `<span class="badge warning" style="margin-left: 4px; padding: 2px 7px; font-size: 0.72rem; border-radius: 10px;">${enAttente.length}</span>` : ''}
              </button>
            ` : ''}

            <button class="btn ${currentTab === 'poste-garde' ? 'btn-primary' : 'btn-secondary'}" data-tab="poste-garde" style="display: inline-flex; align-items: center; gap: 8px;">
              <i data-lucide="shield" style="width: 16px; height: 16px;"></i>
              <span>Poste de Garde (${sortiesDuJour.length})</span>
            </button>

            ${(user?.role === 'hr' || user?.role === 'supervisor') ? `
              <button class="btn ${currentTab === 'historique' ? 'btn-primary' : 'btn-secondary'}" data-tab="historique" style="display: inline-flex; align-items: center; gap: 8px;">
                <i data-lucide="archive" style="width: 16px; height: 16px;"></i>
                <span>Registre Général</span>
              </button>
            ` : ''}
          </div>

          <div>
            <button class="btn btn-primary" id="btn-nouveau-bon" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
              <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i>
              <span>Demander un Bon de Sortie</span>
            </button>
          </div>
        </div>

        <!-- Contenu de l'onglet actif -->
        <div id="bons-content-area">
          ${this.renderTabContent(currentTab, { mesBons, enAttente, sortiesDuJour, all: bonsData, user })}
        </div>
      </div>
    `;
  },

  renderTabContent(tab, { mesBons, enAttente, sortiesDuJour, all, user }) {
    if (tab === 'mes-bons') {
      return this.renderBonsTable(mesBons, 'Aucun bon de sortie enregistré pour votre compte.', true);
    }
    if (tab === 'attente') {
      return this.renderAttenteCards(enAttente);
    }
    if (tab === 'poste-garde') {
      return this.renderPosteGarde(sortiesDuJour);
    }
    if (tab === 'historique') {
      return this.renderBonsTable(all, 'Aucun historique de bon de sortie trouvé.', false);
    }
    return '';
  },

  renderBonsTable(items, emptyMsg, isEmployeeView) {
    if (!items || items.length === 0) {
      return `
        <div class="card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <i data-lucide="file-x" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="font-size: 1rem;">${emptyMsg}</p>
        </div>
      `;
    }

    return `
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-responsive">
          <table class="table" style="width: 100%; margin: 0;">
            <thead>
              <tr style="background: var(--bg-secondary);">
                ${!isEmployeeView ? `<th>Salarié</th>` : ''}
                <th>Date</th>
                <th>Type & Motif</th>
                <th>Créneau Prévu</th>
                <th>Durée</th>
                <th>Retour Réel</th>
                <th>Statut</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(b => {
                const badgeClass = b.statut === 'Validé' ? 'success' : (b.statut === 'En attente' ? 'warning' : (b.statut === 'Clôturé' ? 'info' : 'danger'));
                const typeIcon = b.type_sortie === 'Mission' ? 'briefcase' : (b.type_sortie === 'Médical' ? 'activity' : (b.type_sortie === 'Professionnel' ? 'building' : 'user'));
                return `
                  <tr>
                    ${!isEmployeeView ? `
                      <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${escapeHtml(b.prenom || '')} ${escapeHtml(b.nom || '')}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">#${escapeHtml(b.matricule)} • ${escapeHtml(b.departement || '')}</div>
                      </td>
                    ` : ''}
                    <td>
                      <div style="font-weight: 600;">${formatDateFR(b.date_sortie)}</div>
                      ${b.destination ? `<div style="font-size: 0.8rem; color: var(--text-secondary);"><i data-lucide="map-pin" style="width: 12px; height: 12px; vertical-align: middle;"></i> ${escapeHtml(b.destination)}</div>` : ''}
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
                        <span class="badge secondary" style="font-size: 0.75rem;">${escapeHtml(b.type_sortie)}</span>
                      </div>
                      <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(b.motif || 'Aucun motif renseigné')}
                      </div>
                    </td>
                    <td>
                      <div style="font-weight: 600; color: var(--primary);">${escapeHtml(b.heure_depart)} → ${escapeHtml(b.heure_retour_prevue)}</div>
                    </td>
                    <td>
                      <span style="font-weight: 600;">${b.duree_heures} h</span>
                    </td>
                    <td>
                      ${b.heure_retour_reelle ? `
                        <span style="color: #16a34a; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                          <i data-lucide="check" style="width: 14px; height: 14px;"></i> ${escapeHtml(b.heure_retour_reelle)}
                        </span>
                      ` : `
                        <span style="color: var(--text-secondary); font-style: italic;">Non pointé</span>
                      `}
                    </td>
                    <td>
                      <span class="badge ${badgeClass}">${escapeHtml(b.statut)}</span>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-secondary btn-sm btn-print-bon" data-id="${b.id}" title="Imprimer le Bon officiel SCHB GICA" style="display: inline-flex; align-items: center; gap: 6px;">
                        <i data-lucide="printer" style="width: 14px; height: 14px;"></i>
                        <span>Reçu</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderAttenteCards(items) {
    if (!items || items.length === 0) {
      return `
        <div class="card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <i data-lucide="check-circle-2" style="width: 48px; height: 48px; margin-bottom: 12px; color: #16a34a;"></i>
          <p style="font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">Toutes les demandes de bons de sortie ont été traitées !</p>
          <p style="font-size: 0.9rem;">Aucun bon en attente de visa hiérarchique.</p>
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;">
        ${items.map(b => `
          <div class="card" style="padding: 20px; border-left: 4px solid #f59e0b; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                  <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(b.prenom || '')} ${escapeHtml(b.nom || '')}</div>
                  <div style="font-size: 0.85rem; color: var(--text-secondary);">Matricule #${escapeHtml(b.matricule)} • ${escapeHtml(b.departement || '')}</div>
                </div>
                <span class="badge warning">En attente</span>
              </div>

              <div style="background: var(--bg-secondary); border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 0.9rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: var(--text-secondary);">Type de Sortie :</span>
                  <strong>${escapeHtml(b.type_sortie)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: var(--text-secondary);">Date prévue :</span>
                  <strong>${formatDateFR(b.date_sortie)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="color: var(--text-secondary);">Créneau horaire :</span>
                  <strong style="color: var(--primary);">${escapeHtml(b.heure_depart)} → ${escapeHtml(b.heure_retour_prevue)} (${b.duree_heures}h)</strong>
                </div>
                ${b.destination ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">Destination :</span>
                    <strong>${escapeHtml(b.destination)}</strong>
                  </div>
                ` : ''}
              </div>

              <div style="font-size: 0.88rem; color: var(--text-secondary);">
                <strong>Motif :</strong> ${escapeHtml(b.motif || 'Non précisé')}
              </div>
            </div>

            <div style="display: flex; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
              <button class="btn btn-success btn-sm btn-decide-bon" data-id="${b.id}" data-action="approve" style="flex: 1; display: inline-flex; justify-content: center; align-items: center; gap: 6px;">
                <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                <span>Valider le Bon</span>
              </button>
              <button class="btn btn-danger btn-sm btn-decide-bon" data-id="${b.id}" data-action="reject" style="flex: 1; display: inline-flex; justify-content: center; align-items: center; gap: 6px;">
                <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                <span>Refuser</span>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderPosteGarde(items) {
    return `
      <div class="card" style="padding: 20px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(19,84,122,0.06), rgba(19,84,122,0.01)); border: 1px solid rgba(19,84,122,0.2);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: var(--primary); color: white; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <i data-lucide="shield" style="width: 24px; height: 24px;"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary);">Poste de Garde & Sécurité Industrielle — Sorties du Jour</h3>
            <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
              Contrôle aux portails de l'usine SCHB GICA. Enregistrez en un clic le retour physique du collaborateur.
            </p>
          </div>
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
          <i data-lucide="door-closed" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <p>Aucune sortie autorisée programmée aujourd'hui.</p>
        </div>
      ` : `
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="table-responsive">
            <table class="table" style="width: 100%; margin: 0;">
              <thead>
                <tr style="background: var(--bg-secondary);">
                  <th>Salarié</th>
                  <th>Département</th>
                  <th>Motif / Destination</th>
                  <th>Horaires Autorisés</th>
                  <th>Statut</th>
                  <th>Retour Réel</th>
                  <th style="text-align: right;">Action Poste de Garde</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(b => {
                  const isClosed = b.statut === 'Clôturé' || !!b.heure_retour_reelle;
                  return `
                    <tr>
                      <td>
                        <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(b.prenom || '')} ${escapeHtml(b.nom || '')}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Matricule #${escapeHtml(b.matricule)}</div>
                      </td>
                      <td>${escapeHtml(b.departement || '-')}</td>
                      <td>
                        <strong>${escapeHtml(b.type_sortie)}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(b.destination || b.motif || '')}</div>
                      </td>
                      <td>
                        <span style="font-weight: 600; color: var(--primary);">${escapeHtml(b.heure_depart)} → ${escapeHtml(b.heure_retour_prevue)}</span>
                      </td>
                      <td>
                        <span class="badge ${b.statut === 'Validé' ? 'success' : (b.statut === 'Clôturé' ? 'info' : 'warning')}">
                          ${escapeHtml(b.statut)}
                        </span>
                      </td>
                      <td>
                        ${b.heure_retour_reelle ? `
                          <strong style="color: #16a34a;">${escapeHtml(b.heure_retour_reelle)}</strong>
                        ` : `
                          <span style="color: #ea580c; font-style: italic;">Hors usine (En cours)</span>
                        `}
                      </td>
                      <td style="text-align: right;">
                        ${!isClosed && b.statut === 'Validé' ? `
                          <button class="btn btn-success btn-sm btn-pointer-retour" data-id="${b.id}" data-nom="${escapeHtml(b.prenom)} ${escapeHtml(b.nom)}" style="display: inline-flex; align-items: center; gap: 6px;">
                            <i data-lucide="check-check" style="width: 15px; height: 15px;"></i>
                            <span>Pointer le Retour</span>
                          </button>
                        ` : `
                          <button class="btn btn-secondary btn-sm btn-print-bon" data-id="${b.id}">
                            <i data-lucide="printer" style="width: 14px; height: 14px;"></i> Reçu
                          </button>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    `;
  },

  async init() {
    this.bindEvents();
    if (window.lucide) window.lucide.createIcons();
  },

  bindEvents() {
    // Changement d'onglets
    document.querySelectorAll('#bons-tabs button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        currentTab = tab;
        const mainContainer = document.getElementById('main-view-container');
        if (mainContainer) {
          mainContainer.innerHTML = await this.render({ tab });
          await this.init();
        }
      });
    });

    // Bouton Nouveau Bon de Sortie
    const btnNouveau = document.getElementById('btn-nouveau-bon');
    if (btnNouveau) {
      btnNouveau.addEventListener('click', () => this.openNouveauBonModal());
    }

    // Décisions sur les bons (Valider / Refuser)
    document.querySelectorAll('.btn-decide-bon').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const action = e.currentTarget.getAttribute('data-action');
        const actionLabel = action === 'approve' ? 'valider' : 'refuser';

        const ok = await confirmDialog(`Êtes-vous sûr de vouloir ${actionLabel} ce bon de sortie ?`);
        if (!ok) return;

        try {
          await api.decideBonSortie(id, action);
          toast(`Bon de sortie ${action === 'approve' ? 'validé' : 'refusé'} avec succès.`, 'success');
          const mainContainer = document.getElementById('main-view-container');
          if (mainContainer) {
            mainContainer.innerHTML = await this.render({ tab: currentTab });
            await this.init();
          }
        } catch (err) {
          toast(err.message || 'Erreur lors du traitement.', 'error');
        }
      });
    });

    // Pointer le retour réel (Poste de garde)
    document.querySelectorAll('.btn-pointer-retour').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const nom = e.currentTarget.getAttribute('data-nom');
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const ok = await confirmDialog(`Confirmer le retour de ${nom} à ${currentTime} ?`);
        if (!ok) return;

        try {
          await api.pointageRetourBonSortie(id, currentTime);
          toast(`Retour de ${nom} pointé avec succès à ${currentTime}.`, 'success');
          const mainContainer = document.getElementById('main-view-container');
          if (mainContainer) {
            mainContainer.innerHTML = await this.render({ tab: currentTab });
            await this.init();
          }
        } catch (err) {
          toast(err.message || 'Erreur pointage retour.', 'error');
        }
      });
    });

    // Imprimer le Bon de Sortie officiel
    document.querySelectorAll('.btn-print-bon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const bon = bonsData.find(b => b.id === id);
        if (bon) this.openPrintModal(bon);
      });
    });
  },

  openNouveauBonModal() {
    const user = getCurrentUser();
    const isHrOrSupervisor = user?.role === 'hr' || user?.role === 'supervisor';
    const today = new Date().toISOString().split('T')[0];

    const formHtml = `
      <form id="form-nouveau-bon" style="display: flex; flex-direction: column; gap: 16px;">
        ${isHrOrSupervisor ? `
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Bénéficiaire du Bon :</label>
            <select id="bon-matricule" class="form-control" style="width: 100%;">
              <option value="${user.matricule}">${user.prenom} ${user.nom} (Moi-même #${user.matricule})</option>
              ${allEmployees.filter(e => e.matricule !== user.matricule).map(e => `
                <option value="${e.matricule}">${e.nom} ${e.prenom} (#${e.matricule} • ${e.departement})</option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Type de Sortie * :</label>
            <select id="bon-type" class="form-control" required style="width: 100%;">
              <option value="Personnel">Personnel (Affaires privées)</option>
              <option value="Professionnel">Professionnel (Déplacement local/Client)</option>
              <option value="Mission">Mission (Ordre de mission externe)</option>
              <option value="Médical">Médical (Consultation clinique)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Date de Sortie * :</label>
            <input type="date" id="bon-date" class="form-control" value="${today}" required style="width: 100%;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Heure Départ Prévue * :</label>
            <input type="time" id="bon-heure-dep" class="form-control" value="10:00" required style="width: 100%;">
          </div>
          <div class="form-group">
            <label style="font-weight: 600; display: block; margin-bottom: 6px;">Heure Retour Prévue * :</label>
            <input type="time" id="bon-heure-ret" class="form-control" value="12:00" required style="width: 100%;">
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Destination / Lieu :</label>
          <input type="text" id="bon-destination" class="form-control" placeholder="Ex: Constantine Centre, Clinique, Banque BNA, Siège..." style="width: 100%;">
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Motif Détaillé de la Sortie * :</label>
          <textarea id="bon-motif" class="form-control" rows="3" placeholder="Précisez la raison de la sortie autorisée..." required style="width: 100%;"></textarea>
        </div>

        <!-- Encadré d'Impact Réglementaire Cimenterie SCHB GICA -->
        <div style="background: rgba(19,84,122,0.06); border: 1px solid rgba(19,84,122,0.2); border-radius: 8px; padding: 12px; font-size: 0.85rem; color: var(--text-secondary);">
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">Règle de Gestion des Temps (SCHB GICA) :</div>
          <ul style="margin: 0; padding-left: 18px; line-height: 1.4;">
            <li><strong>Sortie Mission / Professionnelle :</strong> Assimilée à du temps de travail effectif.</li>
            <li><strong>Sortie Personnelle :</strong> Déduite des heures travaillées journalières.</li>
            <li>Le bon validé doit être présenté au poste de garde pour l'autorisation de franchissement de la grille.</li>
          </ul>
        </div>
      </form>
    `;

    openModal(
      'Demande de Bon de Sortie Autorisée',
      formHtml,
      [
        {
          label: 'Annuler',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Enregistrer le Bon',
          class: 'btn btn-primary',
          onClick: async () => {
            const form = document.getElementById('form-nouveau-bon');
            if (!form.reportValidity()) return;

            const matricule = document.getElementById('bon-matricule')?.value || user.matricule;
            const type_sortie = document.getElementById('bon-type').value;
            const date_sortie = document.getElementById('bon-date').value;
            const heure_depart = document.getElementById('bon-heure-dep').value;
            const heure_retour_prevue = document.getElementById('bon-heure-ret').value;
            const destination = document.getElementById('bon-destination').value.trim();
            const motif = document.getElementById('bon-motif').value.trim();

            try {
              await api.createBonSortie({
                matricule,
                type_sortie,
                date_sortie,
                heure_depart,
                heure_retour_prevue,
                destination,
                motif
              });

              toast('Bon de sortie créé avec succès. Notifié à votre hiérarchie.', 'success');
              closeModal();
              const mainContainer = document.getElementById('main-view-container');
              if (mainContainer) {
                mainContainer.innerHTML = await this.render({ tab: 'mes-bons' });
                await this.init();
              }
            } catch (err) {
              toast(err.message || 'Erreur lors de la création du bon.', 'error');
            }
          }
        }
      ]
    );
  },

  openPrintModal(bon) {
    const printHtml = `
      <div id="printable-bon-doc" style="background: white; color: #1e293b; padding: 24px; font-family: 'Inter', Arial, sans-serif; border: 2px solid #0f172a; border-radius: 4px; max-width: 650px; margin: 0 auto;">
        
        <!-- En-tête officiel SCHB GICA -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #475569;">République Algérienne Démocratique et Populaire</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: #1e293b;">GROUPE INDUSTRIEL DES CIMENTS D'ALGÉRIE (GICA)</div>
            <div style="font-size: 1rem; font-weight: 900; color: #13547a;">SOCIÉTÉ DES CIMENTS DE HAMMA BOUZIANE — SCHB</div>
          </div>
          <div style="text-align: right;">
            <div style="border: 2px solid #13547a; padding: 6px 12px; border-radius: 4px; font-weight: 800; color: #13547a; font-size: 0.95rem;">
              BON N° ${escapeHtml(bon.id.slice(-8).toUpperCase())}
            </div>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">Émis le : ${formatDateFR(bon.date_sortie)}</div>
          </div>
        </div>

        <!-- Titre du Document -->
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a;">
            AUTORISATION DE SORTIE / ORDRE DE MISSION
          </h2>
          <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">(Valable pour la journée du ${formatDateFR(bon.date_sortie)})</div>
        </div>

        <!-- Informations Salarié -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 0.9rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Nom & Prénom :</strong> ${escapeHtml(bon.nom || '')} ${escapeHtml(bon.prenom || '')}</div>
            <div><strong>Matricule :</strong> #${escapeHtml(bon.matricule)}</div>
            <div><strong>Département :</strong> ${escapeHtml(bon.departement || '-')}</div>
            <div><strong>Fonction / Poste :</strong> ${escapeHtml(bon.poste || '-')}</div>
          </div>
        </div>

        <!-- Détails de la Sortie -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 18px; font-size: 0.9rem;">
          <div style="margin-bottom: 8px;"><strong>Nature de la Sortie :</strong> <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${escapeHtml(bon.type_sortie)}</span></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
            <div><strong>Heure de Départ :</strong> ${escapeHtml(bon.heure_depart)}</div>
            <div><strong>Heure de Retour Prévue :</strong> ${escapeHtml(bon.heure_retour_prevue)}</div>
          </div>
          <div style="margin-bottom: 8px;"><strong>Durée Prévue :</strong> ${bon.duree_heures} heure(s)</div>
          ${bon.destination ? `<div style="margin-bottom: 8px;"><strong>Destination :</strong> ${escapeHtml(bon.destination)}</div>` : ''}
          <div><strong>Motif :</strong> ${escapeHtml(bon.motif || 'Non précisé')}</div>
        </div>

        <!-- Signatures & Visas -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 24px; font-size: 0.8rem; text-align: center;">
          <div style="border: 1px dashed #94a3b8; border-radius: 4px; padding: 10px; height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-weight: 700;">Signature de l'Agent</div>
            <div style="font-size: 0.72rem; color: #64748b;">(Lu et approuvé)</div>
          </div>

          <div style="border: 1px solid #13547a; background: rgba(19,84,122,0.03); border-radius: 4px; padding: 10px; height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-weight: 700; color: #13547a;">Visa Chef de Service / DRH</div>
            <div style="font-weight: 800; color: #16a34a; font-size: 0.75rem;">
              ${bon.statut === 'Validé' || bon.statut === 'Clôturé' ? `[VALIDÉ par ${escapeHtml(bon.valide_par && !bon.valide_par.includes('undefined') ? bon.valide_par : 'Direction RH')}]` : '<span style="color:#f59e0b;">[EN ATTENTE DE VISA]</span>'}
            </div>
          </div>

          <div style="border: 1px dashed #94a3b8; border-radius: 4px; padding: 10px; height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-weight: 700;">Visa Poste de Garde</div>
            <div style="font-size: 0.72rem; color: #64748b;">Départ: __h__ / Retour: __h__</div>
          </div>
        </div>

        <!-- QR Code Officiel Sécurité -->
        <div style="margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b;">
          <div>Authentification Système RH SCHB GICA • Document généré numériquement</div>
          <div style="font-family: monospace; font-weight: 700; color: #0f172a;">REF: ${escapeHtml(bon.id)}</div>
        </div>
      </div>
    `;

    openModal(
      'Reçu Officiel — Bon de Sortie Autorisée',
      printHtml,
      [
        {
          label: 'Fermer',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Imprimer le Bon',
          class: 'btn btn-primary',
          onClick: () => {
            const printContent = document.getElementById('printable-bon-doc').outerHTML;
            const win = window.open('', '_blank');
            win.document.write(`
              <html>
                <head>
                  <title>Bon de Sortie — SCHB GICA</title>
                  <style>
                    body { margin: 20px; font-family: Arial, sans-serif; }
                    @media print { body { margin: 0; } }
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
