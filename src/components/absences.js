import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR, fileToDataUrl } from '../utils.js';

// Badge Étape 1 : Validation Responsable / IT Manager
function renderStep1Badge(a) {
  const managerName = a.sup_nom ? `${a.sup_prenom} ${a.sup_nom}` : (a.decide_par_superviseur || 'Manager IT');
  if (a.statut_superviseur === 'Approuvé') {
    return `
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <span class="badge success" style="font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
          <i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> Validé (${escapeHtml(managerName)})
        </span>
        ${a.date_decision_superviseur ? `<span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">Avis favorable le ${formatDateFR(a.date_decision_superviseur)}</span>` : ''}
      </div>
    `;
  }
  if (a.statut_superviseur === 'Refusé') {
    return `
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <span class="badge danger" style="font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
          <i data-lucide="x-circle" style="width: 13px; height: 13px;"></i> Refusé (${escapeHtml(managerName)})
        </span>
        ${a.date_decision_superviseur ? `<span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">Le ${formatDateFR(a.date_decision_superviseur)}</span>` : ''}
      </div>
    `;
  }
  return `
    <span class="badge warning" style="font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;">
      <i data-lucide="clock" style="width: 13px; height: 13px;"></i> En attente avis Chef (${escapeHtml(managerName)})
    </span>
  `;
}

// Badge Étape 2 : Décision Finale Direction RH
function renderStep2Badge(a) {
  if (a.statut === 'Approuvé') {
    return `
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <span class="badge success" style="font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
          <i data-lucide="shield-check" style="width: 13px; height: 13px;"></i> Validé DRH (${escapeHtml(a.decide_par || 'RH')})
        </span>
        <span style="font-size: 0.7rem; color: var(--color-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
          <i data-lucide="mail-check" style="width: 12px; height: 12px;"></i> Email officiel envoyé
        </span>
      </div>
    `;
  }
  if (a.statut === 'Refusé') {
    return `
      <span class="badge danger" style="font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
        <i data-lucide="x-circle" style="width: 13px; height: 13px;"></i> Refusé par DRH
      </span>
    `;
  }
  if (a.statut_superviseur === 'Approuvé') {
    return `
      <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;">
        <i data-lucide="hourglass" style="width: 13px; height: 13px;"></i> Transmis à la DRH pour décision
      </span>
    `;
  }
  return `
    <span class="badge secondary" style="font-size: 0.74rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px;">
      <i data-lucide="pause" style="width: 11px; height: 11px;"></i> En attente de l'étape 1
    </span>
  `;
}


export const AbsencesComponent = {
  title: 'Gestion des Absences & Congés',
  subtitle: 'Suivi des congés annuels, maladie et demandes d\'absences',

  async render() {
    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';
    const isSupervisor = user.role === 'supervisor';
    const isHR = user.role === 'hr';

    let absences = [];
    let employees = [];

    try {
      if (isEmployee) {
        absences = await api.getAbsences(user.matricule);
      } else if (isSupervisor) {
        // Superviseur voit ses collaborateurs directs (SuperieurMatricule = user.matricule) et son département
        const allEmployees = await api.getEmployees();
        employees = allEmployees.filter(e => e.departement === user.departement || e.SuperieurMatricule === user.matricule);
        absences = await api.getAbsences();
      } else {
        // HR voit tout
        absences = await api.getAbsences();
        employees = await api.getEmployees();
      }
    } catch (err) {
      console.error(err);
    }

    const enAttente = absences.filter(a => a.statut === 'En attente');
    const historique = absences.filter(a => a.statut !== 'En attente');
    this._absences = absences;

    return `
      <div class="tab-container">
        <!-- Sub-Tabs Navigation -->
        <div class="sub-tabs-nav" style="display: flex; gap: 24px; border-bottom: 2px solid var(--border-color); margin-bottom: 24px; padding-bottom: 0;">
          <button class="sub-tab-btn active" data-subview="solde" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--color-primary); cursor: pointer; border-bottom: 3px solid var(--color-primary); padding: 10px 4px 12px 4px; transition: all 0.2s;">
            ${isEmployee ? 'Mon Solde' : 'Soldes Collaborateurs'}
          </button>
          <button class="sub-tab-btn" data-subview="attente" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; padding: 10px 4px 12px 4px; border-bottom: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
            Demandes en Attente 
            <span class="badge ${enAttente.length > 0 ? 'warning' : 'secondary'}" style="font-size: 0.75rem; padding: 2px 6px;">${enAttente.length}</span>
          </button>
          <button class="sub-tab-btn" data-subview="historique" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; padding: 10px 4px 12px 4px; border-bottom: 3px solid transparent; transition: all 0.2s;">
            Historique des Congés
          </button>
        </div>

        <!-- SUBVIEW: SOLDE -->
        <div id="subview-solde" class="subview-container">
          <!-- Main Actions Header -->
          <div class="search-bar-container card" style="padding: 16px 24px; margin-bottom: 20px;">
            <div>
              <h3 style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="info" style="color: var(--color-info);"></i>
                Solde des Congés Annuels
              </h3>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">
                ${isEmployee ? `Votre solde actuel est de <strong>${user.solde_conge} jours</strong>.` : 'Consultez et gérez les soldes de congés ci-dessous.'}
              </p>
            </div>
            
            <button class="btn btn-primary" id="btn-add-absence">
              <i data-lucide="plus"></i>
              ${isEmployee ? 'Demander un Congé' : 'Saisir une Absence / Congé'}
            </button>
          </div>

          <!-- Solde Table List for HR and Supervisor -->
          ${!isEmployee ? `
            <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <h4 style="margin: 0; font-weight: 700;">Soldes de Congés des Collaborateurs</h4>
                <div class="search-input-wrapper" style="max-width: 280px; width: 100%;">
                  <i data-lucide="search" style="width: 15px; height: 15px;"></i>
                  <input type="text" id="abs-balance-search" class="form-control" placeholder="Rechercher par nom ou matricule..." style="height: 34px; padding-left: 36px; font-size: 0.8rem;">
                </div>
              </div>
              <div class="table-container" style="margin-top: 0; overflow-y: auto; flex: 1; border: 1px solid var(--border-color); border-radius: var(--radius-md); max-height: 400px;">
                <table class="custom-table responsive-card-table" style="font-size: 0.85rem;">
                  <thead>
                    <tr style="position: sticky; top: 0; background-color: var(--bg-secondary); z-index: 1;">
                      <th>Matricule</th>
                      <th>Nom & Prénom</th>
                      <th>Département</th>
                      <th>Poste</th>
                      <th style="text-align: right;">Solde Restant</th>
                    </tr>
                  </thead>
                  <tbody id="abs-balances-body">
                    ${employees.map(emp => `
                      <tr class="balance-row" data-matricule="${escapeHtml(emp.matricule)}" data-search="${escapeHtml(emp.matricule)} ${escapeHtml(emp.prenom.toLowerCase())} ${escapeHtml(emp.nom.toLowerCase())}">
                        <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(emp.matricule)}</td>
                        <td data-label="Nom & Prénom" style="font-weight: 600;">${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</td>
                        <td data-label="Département"><span class="badge primary" style="font-size: 0.75rem;">${escapeHtml(emp.departement)}</span></td>
                        <td data-label="Poste">${escapeHtml(emp.poste)}</td>
                        <td data-label="Solde Restant" style="text-align: right;">
                          <span class="badge ${emp.solde_conge > 10 ? 'success' : 'warning'}" style="font-size: 0.85rem; font-weight: 700;">
                            ${emp.solde_conge} jours
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : `
            <!-- Personal Balance Box for Employee -->
            <div class="card" style="padding: 24px; text-align: center;">
              <div class="user-avatar" style="width: 64px; height: 64px; font-size: 1.5rem; margin: 0 auto 16px auto;">
                ${user.prenom[0].toUpperCase()}${user.nom[0].toUpperCase()}
              </div>
              <h3 style="margin-bottom: 8px;">${escapeHtml(user.prenom)} ${escapeHtml(user.nom)}</h3>
              <p style="color: var(--text-secondary); margin-bottom: 20px;">Matricule: <strong>${escapeHtml(user.matricule)}</strong> | Département: <strong>${escapeHtml(user.departement)}</strong></p>
              
              <div style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: inline-block;">
                <span style="font-size: 0.9rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Solde de congés disponible</span>
                <span class="badge success" style="font-size: 1.3rem; padding: 8px 16px; font-weight: 800;">
                  ${user.solde_conge} jours
                </span>
              </div>
            </div>
          `}
        </div>

        <!-- SUBVIEW: ATTENTE -->
        <div id="subview-attente" class="subview-container" style="display: none;">
          <!-- Workflow Stepper / Header Banner -->
          <div class="card" style="padding: 16px 20px; margin-bottom: 20px; background-color: #f8fafc; border: 1px solid var(--border-color); border-left: 5px solid var(--color-primary); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <h4 style="margin: 0 0 4px 0; font-size: 0.98rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="git-merge" style="color: var(--color-primary); width: 18px; height: 18px;"></i>
                  Structure de Validation d'une Demande de Congé (Circuit à 2 Niveaux)
                </h4>
                <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                  <strong>Étape 1 :</strong> Validation par le Chef de Service / IT Manager (Lyes Belatrous) ➔ <strong>Étape 2 :</strong> Décision Finale & Débit Solde par la DRH (Amine Abritx) ➔ <strong>Retour :</strong> Notification & Email de confirmation envoyés à l'employé.
                </p>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <span class="badge secondary" style="font-size: 0.75rem; padding: 5px 9px; display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="user-check" style="width: 13px; height: 13px;"></i> 1. Avis Manager
                </span>
                <span class="badge primary" style="font-size: 0.75rem; padding: 5px 9px; display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="shield-check" style="width: 13px; height: 13px;"></i> 2. Décision DRH
                </span>
                <span class="badge success" style="font-size: 0.75rem; padding: 5px 9px; display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="mail-check" style="width: 13px; height: 13px;"></i> Email Confirmation
                </span>
              </div>
            </div>
          </div>

          <!-- Pending Requests Table -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); background-color: rgba(245,158,11,0.02);">
              <h3 style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; margin: 0;">
                <i data-lucide="hourglass" style="color: var(--color-warning); width: 18px; height: 18px;"></i>
                Demandes de Congés en Attente (${enAttente.length})
              </h3>
            </div>
            <div class="table-container" style="margin-top: 0; border: none; overflow-x: auto;">
              <table class="custom-table responsive-card-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Type & Dates</th>
                    <th>Durée</th>
                    <th>Étape 1 : Validation Chef</th>
                    <th>Étape 2 : Décision DRH</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${enAttente.length === 0 ? `
                    <tr>
                      <td colspan="7" style="text-align: center; padding: 40px 20px;">
                        <div class="table-empty-state">
                          <div class="table-empty-icon"><i data-lucide="check-circle-2" style="width: 24px; height: 24px; color: var(--color-success);"></i></div>
                          <div class="table-empty-title">Toutes les demandes sont traitées</div>
                          <div class="table-empty-desc">Aucune demande de congé en attente de validation pour le moment.</div>
                        </div>
                      </td>
                    </tr>
                  ` : enAttente.map(a => {
                    const empFullName = `${a.prenom || ''} ${a.nom || a.matricule}`.trim();
                    const initials = `${(a.prenom && a.prenom[0] ? a.prenom[0] : '').toUpperCase()}${(a.nom && a.nom[0] ? a.nom[0] : '').toUpperCase()}` || 'RH';
                    const empEmail = a.email_employe || '';
                    return `
                    <tr data-id="${escapeHtml(a.id)}">
                      <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(a.matricule)}</td>
                      <td data-label="Employé">
                        <div class="table-user-cell">
                          <div class="table-avatar">${initials}</div>
                          <div class="table-user-info">
                            <span class="table-user-name">${escapeHtml(empFullName)}</span>
                            <span class="table-user-sub">${escapeHtml(a.poste || 'Collaborateur')} · <span class="badge primary" style="font-size: 0.65rem; padding: 1px 5px;">${escapeHtml(a.departement || '')}</span></span>
                            ${empEmail ? `<span style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 3px; margin-top: 1px;"><i data-lucide="mail" style="width: 11px; height: 11px;"></i> ${escapeHtml(empEmail)}</span>` : ''}
                          </div>
                        </div>
                      </td>
                      <td data-label="Type & Dates">
                        <span class="badge primary" style="font-weight: 600;">${escapeHtml(a.type_conge)}</span>
                        <div style="font-size: 0.78rem; margin-top: 3px; color: var(--text-secondary);">
                          Du <strong>${formatDateFR(a.date_debut)}</strong> au <strong>${formatDateFR(a.date_fin)}</strong>
                        </div>
                      </td>
                      <td data-label="Durée">
                        <span class="badge success" style="font-size: 0.85rem; font-weight: 800;">
                          ${a.duree_jours} jour${a.duree_jours > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td data-label="Avis Chef">
                        ${renderStep1Badge(a)}
                        ${a.motif ? `<div style="font-size: 0.74rem; color: var(--text-secondary); font-style: italic; margin-top: 4px; max-width: 220px;">« ${escapeHtml(a.motif)} »</div>` : ''}
                        ${a.has_justificatif ? `<button type="button" class="btn btn-sm btn-outline btn-view-justificatif" data-id="${escapeHtml(a.id)}" style="margin-top: 6px; padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; color: var(--color-info);"><i data-lucide="paperclip" style="width: 12px; height: 12px;"></i> Justificatif</button>` : ''}
                      </td>
                      <td data-label="Statut DRH">
                        ${renderStep2Badge(a)}
                      </td>
                      <td data-label="Actions" style="text-align: right; white-space: nowrap;">
                        ${isEmployee && a.matricule === user.matricule ? `
                          ${a.statut_superviseur === 'Approuvé' ? `
                            <span class="badge" style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                              <i data-lucide="check" style="width: 13px; height: 13px;"></i> Validé Chef ➔ Chez DRH
                            </span>
                          ` : `
                            <span style="color: var(--color-warning); font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                              <i data-lucide="clock" style="width: 14px; height: 14px;"></i> En attente avis Chef
                            </span>
                          `}
                        ` : isSupervisor ? `
                          ${a.matricule === user.matricule ? `
                            <span style="color: var(--text-muted); font-size: 0.8rem;">Votre propre demande</span>
                          ` : a.statut_superviseur === 'Approuvé' ? `
                            <span style="color: var(--color-success); font-weight: 700; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
                              <i data-lucide="check-check" style="width: 15px; height: 15px;"></i> Avis Favorable émis
                            </span>
                          ` : a.statut_superviseur === 'Refusé' ? `
                            <span style="color: var(--color-danger); font-size: 0.8rem; font-weight: 600;">Avis Défavorable</span>
                          ` : `
                            <div class="table-actions" style="display: flex; gap: 6px; justify-content: flex-end;">
                              <button class="btn btn-success btn-supervisor-decision-abs" data-id="${escapeHtml(a.id)}" data-statut="Approuvé" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="check" style="width: 14px; height: 14px;"></i> Valider (Avis Favorable)
                              </button>
                              <button class="btn btn-danger btn-supervisor-decision-abs" data-id="${escapeHtml(a.id)}" data-statut="Refusé" style="padding: 6px 10px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="x" style="width: 14px; height: 14px;"></i> Refuser
                              </button>
                            </div>
                          `}
                        ` : `
                          ${a.statut_superviseur === 'Approuvé' ? `
                            <div class="table-actions" style="display: flex; gap: 6px; justify-content: flex-end;">
                              <button class="btn btn-success btn-approve-abs" data-id="${escapeHtml(a.id)}" data-matricule="${escapeHtml(a.matricule)}" data-duree="${a.duree_jours}" data-type="${escapeHtml(a.type_conge)}" data-emp="${escapeHtml(empFullName)}" data-email="${escapeHtml(empEmail)}" style="padding: 6px 14px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                                <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Validation Finale DRH
                              </button>
                              <button class="btn btn-danger btn-reject-abs" data-id="${escapeHtml(a.id)}" data-matricule="${escapeHtml(a.matricule)}" style="padding: 6px 10px; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="x" style="width: 14px; height: 14px;"></i> Refuser
                              </button>
                            </div>
                          ` : `
                            <div class="table-actions" style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                              <button class="btn btn-primary btn-approve-abs" data-id="${escapeHtml(a.id)}" data-matricule="${escapeHtml(a.matricule)}" data-duree="${a.duree_jours}" data-type="${escapeHtml(a.type_conge)}" data-emp="${escapeHtml(empFullName)}" data-email="${escapeHtml(empEmail)}" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="check" style="width: 14px; height: 14px;"></i> Valider directement
                              </button>
                              <button class="btn btn-danger btn-reject-abs" data-id="${escapeHtml(a.id)}" data-matricule="${escapeHtml(a.matricule)}" style="padding: 6px 10px; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="x" style="width: 14px; height: 14px;"></i> Refuser
                              </button>
                            </div>
                          `}
                        `}
                      </td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SUBVIEW: HISTORIQUE -->
        <div id="subview-historique" class="subview-container" style="display: none;">
          <!-- History of Decisions -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <h3 style="font-weight: 700; font-size: 1.05rem; margin: 0;">Historique des Congés</h3>
              <div class="search-input-wrapper" style="max-width: 280px; width: 100%;">
                <i data-lucide="search" style="width: 15px; height: 15px;"></i>
                <input type="text" id="abs-history-search" class="form-control" placeholder="Rechercher par nom ou matricule..." style="height: 34px; padding-left: 36px; font-size: 0.8rem;">
              </div>
            </div>
            <div class="table-container" style="margin-top: 0; border: none; max-height: 400px; overflow-y: auto;">
              <table class="custom-table responsive-card-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Type & Dates</th>
                    <th>Durée</th>
                    <th>Avis Chef / Manager</th>
                    <th>Décision Finale DRH</th>
                    <th>Statut</th>
                    <th>Date Décision</th>
                    <th style="text-align: right;">Document & Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  ${historique.length === 0 ? `
                    <tr>
                      <td colspan="9" style="text-align: center; padding: 40px 20px;">
                        <div class="table-empty-state">
                          <div class="table-empty-icon"><i data-lucide="archive" style="width: 24px; height: 24px;"></i></div>
                          <div class="table-empty-title">Aucun historique de congé</div>
                          <div class="table-empty-desc">L'historique des demandes validées ou archivées apparaîtra ici.</div>
                        </div>
                      </td>
                    </tr>
                  ` : historique.reverse().map(a => {
                    const empName = `${a.prenom || ''} ${a.nom || a.matricule}`.trim();
                    const initials = `${(a.prenom && a.prenom[0] ? a.prenom[0] : '').toUpperCase()}${(a.nom && a.nom[0] ? a.nom[0] : '').toUpperCase()}` || 'RH';
                    const managerName = a.sup_nom ? `${a.sup_prenom} ${a.sup_nom}` : (a.decide_par_superviseur || 'Manager');
                    return `
                      <tr class="abs-history-row" data-search="${escapeHtml(a.matricule)} ${escapeHtml(empName.toLowerCase())}">
                        <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(a.matricule)}</td>
                        <td data-label="Employé">
                          <div class="table-user-cell">
                            <div class="table-avatar">${initials}</div>
                            <div class="table-user-info">
                              <span class="table-user-name">${escapeHtml(empName)}</span>
                              <span class="table-user-sub">${escapeHtml(a.poste || '')} · <span class="badge primary" style="font-size: 0.65rem; padding: 1px 5px;">${escapeHtml(a.departement || '')}</span></span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Type & Dates">
                          <span class="badge primary">${escapeHtml(a.type_conge)}</span>
                          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                            ${formatDateFR(a.date_debut)} au ${formatDateFR(a.date_fin)}
                          </div>
                        </td>
                        <td data-label="Durée"><strong>${a.duree_jours} j</strong></td>
                        <td data-label="Avis Chef" style="font-size: 0.8rem;">
                          ${a.statut_superviseur ? `
                            <span class="badge ${a.statut_superviseur === 'Approuvé' ? 'success' : 'danger'}" style="font-size: 0.75rem;">
                              ${escapeHtml(a.statut_superviseur)} (${escapeHtml(managerName)})
                            </span>
                          ` : `<span style="color: var(--text-muted);">—</span>`}
                        </td>
                        <td data-label="Décision DRH" style="font-size: 0.8rem;">
                          <strong>${escapeHtml(a.decide_par || 'Direction RH')}</strong>
                          ${a.statut === 'Approuvé' ? `
                            <div style="font-size: 0.7rem; color: var(--color-primary); display: flex; align-items: center; gap: 3px; margin-top: 2px;">
                              <i data-lucide="mail-check" style="width: 11px; height: 11px;"></i> Email envoyé
                            </div>
                          ` : ''}
                        </td>
                        <td data-label="Statut">
                          <span class="badge ${a.statut === 'Approuvé' ? 'success' : 'danger'}">
                            ${escapeHtml(a.statut)}
                          </span>
                        </td>
                        <td data-label="Date Décision" style="font-size: 0.8rem; color: var(--text-muted);">
                          ${a.date_decision ? formatDateFR(a.date_decision) : '—'}
                        </td>
                        <td data-label="Documents & Reçu" style="text-align: right; white-space: nowrap;">
                          <div class="table-actions" style="display: flex; gap: 6px; justify-content: flex-end;">
                            ${a.statut === 'Approuvé' ? `
                              <button type="button" class="btn btn-sm btn-outline btn-print-titre" data-id="${escapeHtml(a.id)}" style="padding: 4px 10px; font-size: 0.75rem; font-weight: 700; color: #1e40af; border-color: #93c5fd; background: #eff6ff; display: inline-flex; align-items: center; gap: 4px;" title="Télécharger le Titre de Congé Officiel en PDF">
                                <i data-lucide="printer" style="width: 13px; height: 13px;"></i> Titre PDF
                              </button>
                            ` : ''}
                            ${a.has_justificatif ? `
                              <button type="button" class="btn btn-sm btn-outline btn-view-justificatif" data-id="${escapeHtml(a.id)}" style="padding: 4px 8px; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px; color: var(--color-info);" title="Voir le justificatif joint">
                                <i data-lucide="paperclip" style="width: 12px; height: 12px;"></i> Justificatif
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // Basculement des sous-onglets
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subview = e.currentTarget.getAttribute('data-subview');
        
        document.querySelectorAll('.sub-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.color = 'var(--text-secondary)';
          b.style.borderBottom = '3px solid transparent';
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.style.color = 'var(--color-primary)';
        e.currentTarget.style.borderBottom = '3px solid var(--color-primary)';
        
        document.querySelectorAll('.subview-container').forEach(c => {
          c.style.display = 'none';
        });
        const activeContainer = document.getElementById(`subview-${subview}`);
        if (activeContainer) {
          activeContainer.style.display = 'block';
        }
      });
    });

    const btnAdd = document.getElementById('btn-add-absence');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.showRequestModal());
    }

    // Filtrage dynamique en temps réel de la liste des soldes
    const balanceSearch = document.getElementById('abs-balance-search');
    if (balanceSearch) {
      balanceSearch.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.balance-row').forEach(row => {
          const searchVal = row.getAttribute('data-search');
          if (searchVal.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    // Filtrage dynamique en temps réel de l'historique des congés
    const historySearch = document.getElementById('abs-history-search');
    if (historySearch) {
      historySearch.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.abs-history-row').forEach(row => {
          const searchVal = row.getAttribute('data-search');
          if (searchVal && searchVal.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    // Boutons d'approbation et de refus (Validation DRH)
    document.querySelectorAll('.btn-approve-abs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const matricule = e.currentTarget.getAttribute('data-matricule');
        const duree = parseFloat(e.currentTarget.getAttribute('data-duree'));
        const typeConge = e.currentTarget.getAttribute('data-type');
        const empName = e.currentTarget.getAttribute('data-emp') || matricule;
        const empEmail = e.currentTarget.getAttribute('data-email') || '';
        this.processDecision(id, matricule, duree, typeConge, 'Approuvé', empName, empEmail);
      });
    });

    document.querySelectorAll('.btn-reject-abs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const matricule = e.currentTarget.getAttribute('data-matricule');
        this.processDecision(id, matricule, 0, '', 'Refusé');
      });
    });

    // Validation Superviseur / IT Manager (Étape 1 du workflow)
    document.querySelectorAll('.btn-supervisor-decision-abs').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const statut = e.currentTarget.getAttribute('data-statut');
        try {
          await api.supervisorDecisionAbsence(id, statut);
          if (statut === 'Approuvé') {
            toast("Avis favorable enregistré ! Transmis à la DRH (Email à drh@gica.dz, copie à it@dz-com.com).", 'success');
          } else {
            toast("Avis défavorable enregistré. Demande rejetée.", 'warning');
          }
          const mainContainer = document.getElementById('main-view-container');
          mainContainer.innerHTML = await this.render();
          this.init();
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        }
      });
    });

    // Consultation du justificatif joint
    document.querySelectorAll('.btn-view-justificatif').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        try {
          const res = await api.getAbsenceJustificatif(id);
          if (!res || !res.justificatif) {
            toast("Aucun document justificatif n'est rattaché à cette demande.", 'warning');
            return;
          }
          this.showJustificatifModal(res.justificatif);
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        }
      });
    });

    // Téléchargement / Impression du Titre de Congé Officiel en PDF
    document.querySelectorAll('.btn-print-titre').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.printTitreConge(id);
      });
    });
  },

  showRequestModal(prefilledMatricule = null) {
    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';

    // Rendre le sélecteur d'employé
    let employeeSelectHtml = '';
    
    if (isEmployee) {
      employeeSelectHtml = `<input type="hidden" id="abs-matricule" value="${user.matricule}">`;
    } else {
      employeeSelectHtml = `
        <div class="form-group" style="position: relative;">
          <label for="abs-search-emp">Rechercher un Employé*</label>
          <input type="text" id="abs-search-emp" class="form-control" placeholder="Taper le nom, prénom ou matricule (ex: 130031)..." autocomplete="off" required>
          <input type="hidden" id="abs-matricule" required>
          <div id="abs-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
        </div>
        <style>
          .suggestion-item:hover { background-color: rgba(124, 58, 237, 0.08) !important; }
        </style>
      `;
    }

    const bodyHtml = `
      <form id="absence-form" style="display: flex; flex-direction: column; gap: 16px;">
        ${employeeSelectHtml}

        <div class="form-row">
          <div class="form-group">
            <label for="abs-debut">Date de début*</label>
            <input type="date" id="abs-debut" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="abs-fin">Date de fin*</label>
            <input type="date" id="abs-fin" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>

        <!-- Alerte temps réel de chevauchement d'équipe (Risque sous-effectif) -->
        <div id="abs-conflicts-container" style="display: none;"></div>

        <div class="form-row">
          <div class="form-group">
            <label for="abs-type">Type de Congé*</label>
            <select id="abs-type" class="form-control" required>
              <option value="Annuel" selected>Congé Annuel</option>
              <option value="Maladie">Congé Maladie</option>
              <option value="Maternité">Maternité</option>
              <option value="Sans Solde">Sans Solde</option>
              <option value="Spécial">Événement Spécial (Mariage, Décès, Naissance)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="abs-duree">Nombre de Jours*</label>
            <input type="number" step="0.5" id="abs-duree" class="form-control" placeholder="Nombre de jours ouvrés" required min="0.5">
          </div>
        </div>

        ${!isEmployee ? `
          <div class="form-group">
            <label for="abs-statut">Statut de l'enregistrement*</label>
            <select id="abs-statut" class="form-control" required>
              <option value="En attente">En attente (Demande à valider)</option>
              <option value="Approuvé" selected>Approuvé directement (Saisie Manuelle)</option>
            </select>
          </div>
        ` : ''}

        <div class="form-group">
          <label for="abs-motif">Motif / Commentaire</label>
          <textarea id="abs-motif" class="form-control" rows="2" placeholder="Indiquer le motif du congé..."></textarea>
        </div>

        <div class="form-group">
          <label for="abs-justificatif" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 600; display: flex; align-items: center; gap: 5px;">
              <i data-lucide="paperclip" style="width: 14px; height: 14px; color: var(--color-primary);"></i>
              Pièce jointe / Justificatif médical
            </span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Prendre en photo ou importer (max 4.5 Mo)</span>
          </label>
          <input type="file" id="abs-justificatif" class="form-control" accept="image/*,application/pdf" capture="environment">
          <div id="abs-file-preview" style="display: none; margin-top: 8px;"></div>
        </div>
      </form>
    `;

    openModal('Formulaire de demande de congé', bodyHtml, async () => {
      const form = document.getElementById('absence-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const matricule = document.getElementById('abs-matricule').value;
      const dateDebut = document.getElementById('abs-debut').value;
      const dateFin = document.getElementById('abs-fin').value;
      const duree = parseFloat(document.getElementById('abs-duree').value);
      const typeConge = document.getElementById('abs-type').value;
      const motif = document.getElementById('abs-motif').value.trim();
      const statut = document.getElementById('abs-statut')?.value || 'En attente';

      let justificatif = null;
      const justificatifFile = document.getElementById('abs-justificatif')?.files?.[0];
      if (justificatifFile) {
        if (justificatifFile.size > 4_500_000) {
          toast('Justificatif trop volumineux (max ~4.5 Mo).', 'warning');
          return false;
        }
        try {
          justificatif = await fileToDataUrl(justificatifFile);
        } catch (err) {
          toast(err.message, 'danger');
          return false;
        }
      }

      const newRequest = {
        matricule,
        date_debut: dateDebut,
        date_fin: dateFin,
        duree_jours: duree,
        type_conge: typeConge,
        motif,
        statut,
        justificatif,
        decide_par: statut === 'Approuvé' ? `${user.prenom} ${user.nom}` : null,
        date_decision: statut === 'Approuvé' ? new Date().toISOString().split('T')[0] : null
      };

      try {
        await api.saveAbsence(newRequest);
        toast("Enregistrement réussi !", 'success');

        // Rafraîchir
        const mainContainer = document.getElementById('main-view-container');
        mainContainer.innerHTML = await this.render();
        this.init();
        return true;
      } catch (err) {
        toast(`Erreur lors de la soumission: ${err.message}`, 'danger');
        return false;
      }
    });

    if (window.lucide) window.lucide.createIcons();

    // --- ALERTE TEMPS RÉEL DE CHEVAUCHEMENT D'ÉQUIPE ---
    const conflictContainer = document.getElementById('abs-conflicts-container');
    const dateDebutInput = document.getElementById('abs-debut');
    const dateFinInput = document.getElementById('abs-fin');
    const hiddenMatriculeInput = document.getElementById('abs-matricule');

    const checkOverlapConflicts = async () => {
      const mat = hiddenMatriculeInput?.value;
      const dDeb = dateDebutInput?.value;
      const dFin = dateFinInput?.value;
      if (!conflictContainer || !mat || !dDeb || !dFin || dDeb > dFin) {
        if (conflictContainer) conflictContainer.style.display = 'none';
        return;
      }
      try {
        const conflicts = await api.getAbsenceConflicts(mat, dDeb, dFin);
        if (conflicts && conflicts.length > 0) {
          conflictContainer.style.display = 'block';
          conflictContainer.innerHTML = `
            <div class="conflict-alert-box">
              <div class="conflict-alert-title">
                <i data-lucide="alert-triangle" style="width: 16px; height: 16px; color: #d97706;"></i>
                Alerte de chevauchement d'équipe (${conflicts.length} collègue(s) absent(s))
              </div>
              <div style="font-size: 0.82rem; margin-top: 4px;">
                Attention : dans votre département, d'autres collaborateurs sont déjà programmés absents sur cette période :
              </div>
              <ul class="conflict-alert-list">
                ${conflicts.map(c => `
                  <li>
                    <strong>${escapeHtml(c.prenom)} ${escapeHtml(c.nom)}</strong> (${escapeHtml(c.poste || 'Collaborateur')}) : 
                    du ${formatDateFR(c.date_debut)} au ${formatDateFR(c.date_fin)} (${escapeHtml(c.type_conge)})
                  </li>
                `).join('')}
              </ul>
              <div style="font-size: 0.78rem; margin-top: 6px; font-style: italic; color: #92400e;">
                Risque de sous-effectif potentiel. Le responsable sera alerté lors de la validation.
              </div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: conflictContainer });
        } else {
          conflictContainer.style.display = 'none';
          conflictContainer.innerHTML = '';
        }
      } catch (err) {
        console.warn('Conflits check warning:', err);
      }
    };

    if (dateDebutInput) dateDebutInput.addEventListener('change', checkOverlapConflicts);
    if (dateFinInput) dateFinInput.addEventListener('change', checkOverlapConflicts);

    // Initial check for employee
    if (hiddenMatriculeInput?.value) {
      setTimeout(checkOverlapConflicts, 250);
    }

    // --- PRÉVISUALISATION DU JUSTIFICATIF / PHOTO ---
    const fileInput = document.getElementById('abs-justificatif');
    const previewDiv = document.getElementById('abs-file-preview');
    if (fileInput && previewDiv) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
          previewDiv.style.display = 'none';
          previewDiv.innerHTML = '';
          return;
        }
        const isImg = file.type.startsWith('image/');
        const sizeKb = (file.size / 1024).toFixed(1);
        if (isImg) {
          const reader = new FileReader();
          reader.onload = (e) => {
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = `
              <div class="file-preview-badge" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-md);">
                <img src="${e.target.result}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" alt="Aperçu justificatif">
                <div style="flex: 1; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis;">
                  <strong style="color: var(--color-success); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.name)}</strong>
                  <span style="color: var(--text-muted); font-size: 0.75rem;">${sizeKb} Ko · Photo prête à être transmise</span>
                </div>
              </div>
            `;
          };
          reader.readAsDataURL(file);
        } else {
          previewDiv.style.display = 'block';
          previewDiv.innerHTML = `
            <div class="file-preview-badge" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3); border-radius: var(--radius-md);">
              <i data-lucide="file-text" style="width: 22px; height: 22px; color: #2563eb;"></i>
              <div style="flex: 1; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis;">
                <strong style="color: #1d4ed8; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.name)}</strong>
                <span style="color: var(--text-muted); font-size: 0.75rem;">${sizeKb} Ko · Document PDF</span>
              </div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ root: previewDiv });
        }
      });
    }

    // --- LOGIQUE AUTOCOMPLETE (RECHERCHE RAPIDE) ---
    const searchInput = document.getElementById('abs-search-emp');
    const hiddenInput = document.getElementById('abs-matricule');
    const suggestionsDiv = document.getElementById('abs-suggestions');

    if (searchInput && hiddenInput && suggestionsDiv) {
      if (prefilledMatricule) {
        api.getEmployee(prefilledMatricule).then(emp => {
          if (emp) {
            searchInput.value = `${emp.matricule} - ${emp.prenom} ${emp.nom}`;
            hiddenInput.value = emp.matricule;
            checkOverlapConflicts();
          }
        });
      }

      api.getEmployees().then(employeesList => {
        const showSuggestions = (query = '') => {
          const cleanQuery = query.toLowerCase().trim();
          const filtered = employeesList.filter(e => 
            e.matricule.includes(cleanQuery) || 
            e.nom.toLowerCase().includes(cleanQuery) || 
            e.prenom.toLowerCase().includes(cleanQuery)
          );

          if (filtered.length === 0) {
            suggestionsDiv.innerHTML = `<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem;">Aucun résultat</div>`;
          } else {
            suggestionsDiv.innerHTML = filtered.map(e => `
              <div class="suggestion-item" data-matricule="${escapeHtml(e.matricule)}" data-display="${escapeHtml(e.matricule)} - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}"
                   style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; transition: background 0.15s; background-color: var(--bg-secondary); color: var(--text-primary);">
                <strong>${escapeHtml(e.matricule)}</strong> - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}
              </div>
            `).join('');
          }
          suggestionsDiv.style.display = 'block';

          suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
              hiddenInput.value = e.currentTarget.getAttribute('data-matricule');
              searchInput.value = e.currentTarget.getAttribute('data-display');
              suggestionsDiv.style.display = 'none';
              checkOverlapConflicts();
            });
          });
        };

        searchInput.addEventListener('input', (e) => showSuggestions(e.target.value));
        searchInput.addEventListener('focus', () => showSuggestions(searchInput.value));

        document.addEventListener('click', (e) => {
          if (e.target !== searchInput && e.target !== suggestionsDiv) {
            suggestionsDiv.style.display = 'none';
          }
        });
      });
    }
  },

  showJustificatifModal(justificatif) {
    const isPdf = typeof justificatif === 'string' && (justificatif.startsWith('data:application/pdf') || justificatif.toLowerCase().includes('.pdf'));
    const isImage = typeof justificatif === 'string' && (justificatif.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)/i.test(justificatif));

    const contentHtml = `
      <div style="text-align: center; max-height: 75vh; overflow-y: auto; padding: 8px;">
        ${isImage ? `
          <img src="${justificatif}" alt="Justificatif Médical" style="max-width: 100%; max-height: 60vh; border-radius: 8px; box-shadow: var(--shadow-md); object-fit: contain;">
        ` : isPdf ? `
          <iframe src="${justificatif}" style="width: 100%; height: 60vh; border: 1px solid var(--border-color); border-radius: 8px;"></iframe>
        ` : `
          <div style="padding: 24px; color: var(--text-muted);">
            Document justificatif disponible au téléchargement.
          </div>
        `}
        <div style="margin-top: 16px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <a href="${justificatif}" download="justificatif_conge" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="download" style="width: 15px; height: 15px;"></i> Télécharger la pièce jointe
          </a>
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('generic-modal')?.remove()">
            Fermer
          </button>
        </div>
      </div>
    `;

    openModal('Pièce jointe & Justificatif Médical', contentHtml, null);
    if (window.lucide) window.lucide.createIcons();
  },

  async printTitreConge(absenceId) {
    let absence = this._absences ? this._absences.find(a => String(a.id) === String(absenceId)) : null;
    if (!absence) {
      try {
        const all = await api.getAbsences();
        absence = all.find(a => String(a.id) === String(absenceId));
      } catch (e) {
        console.error(e);
      }
    }
    if (!absence) {
      toast("Impossible de charger les données du titre de congé.", 'danger');
      return;
    }

    const empName = `${absence.prenom || ''} ${absence.nom || absence.matricule}`.trim();
    const dateEmission = absence.date_decision ? formatDateFR(absence.date_decision) : formatDateFR(new Date().toISOString().split('T')[0]);
    const dateRepriseCalc = () => {
      if (!absence.date_fin) return '—';
      const d = new Date(absence.date_fin);
      d.setDate(d.getDate() + 1);
      return formatDateFR(d.toISOString().split('T')[0]);
    };

    // Création de l'overlay d'impression officiel
    const existingOverlay = document.getElementById('printable-titre-conge-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'printable-titre-conge-overlay';
    overlay.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <!-- En-tête officiel République & Entreprise -->
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <div style="font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE
          </div>
          <div style="font-size: 9.5pt; color: #475569; margin-top: 2px;">
            MINISTÈRE DE L'INDUSTRIE ET DE LA PRODUCTION PHARMACEUTIQUE
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 0 10px;">
            <div style="text-align: left;">
              <div style="font-size: 13pt; font-weight: 800; color: #1e3a8a;">GROUPE GICA</div>
              <div style="font-size: 10pt; font-weight: 700;">SOCIÉTÉ DES CIMENTS DE HACHAÏCHI BÉJAÏA (SCHB)</div>
              <div style="font-size: 8.5pt; color: #64748b;">Direction des Ressources Humaines & Formation</div>
            </div>
            <div style="text-align: right; font-size: 9pt; color: #334155;">
              <div><strong>Réf :</strong> SCHB/DRH/CONGÉ-${absence.id}/${new Date().getFullYear()}</div>
              <div><strong>Béjaïa, le :</strong> ${dateEmission}</div>
            </div>
          </div>
        </div>

        <!-- Titre du document -->
        <div style="text-align: center; margin: 24px 0 20px 0;">
          <div style="display: inline-block; padding: 8px 32px; border: 2px solid #1e3a8a; border-radius: 6px; background-color: #f8fafc;">
            <h1 style="margin: 0; font-size: 16pt; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase;">
              TITRE DE CONGÉ OFFICIEL
            </h1>
          </div>
          <div style="font-size: 9pt; color: #64748b; margin-top: 6px;">
            Document officiel délivré en application du Règlement Intérieur et de la Convention Collective SCHB GICA
          </div>
        </div>

        <!-- Corps des informations collaborateur -->
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-bottom: 20px; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
            <tbody>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; width: 35%; color: #475569; font-weight: 600;">Matricule Employé :</td>
                <td style="padding: 8px 4px; font-weight: 800; color: #1e3a8a; font-size: 11pt;">${escapeHtml(absence.matricule)}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Nom & Prénom :</td>
                <td style="padding: 8px 4px; font-weight: 700; text-transform: uppercase;">${escapeHtml(empName)}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Département / Direction :</td>
                <td style="padding: 8px 4px; font-weight: 600;">${escapeHtml(absence.departement || '—')}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Fonction / Poste :</td>
                <td style="padding: 8px 4px;">${escapeHtml(absence.poste || '—')}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Nature du Congé :</td>
                <td style="padding: 8px 4px; font-weight: 700; color: #0284c7;">CONGÉ ${escapeHtml(absence.type_conge ? absence.type_conge.toUpperCase() : 'ANNUEL')}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Durée accordée :</td>
                <td style="padding: 8px 4px; font-weight: 800; font-size: 11pt;">${absence.duree_jours} jour(s) ouvrable(s)</td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Période d'absence :</td>
                <td style="padding: 8px 4px; font-weight: 700;">
                  Du <strong>${formatDateFR(absence.date_debut)}</strong> au <strong>${formatDateFR(absence.date_fin)}</strong> inclus
                </td>
              </tr>
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Date obligatoire de reprise :</td>
                <td style="padding: 8px 4px; font-weight: 800; color: #166534;">${dateRepriseCalc()} dès la première heure</td>
              </tr>
              <tr>
                <td style="padding: 8px 4px; color: #475569; font-weight: 600;">Motif / Observation :</td>
                <td style="padding: 8px 4px; font-style: italic; color: #64748b;">${escapeHtml(absence.motif || 'Congé réglementaire conforme')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mentions légales & obligations -->
        <div style="background: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 10px 14px; font-size: 8.5pt; color: #334155; margin-bottom: 30px;">
          <strong>AVIS TRÈS IMPORTANT :</strong> L'intéressé(e) est tenu(e) de reprendre le service le jour fixé ci-dessus. Tout retard non justifié dans les quarante-huit (48) heures entraîne l'application des sanctions disciplinaires prévues par le règlement intérieur de la Société des Ciments de Hachaïchi Béjaïa SCHB.
        </div>

        <!-- Zone des Visas & Signatures officielles -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 30px;">
          <div style="width: 32%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; min-height: 120px; text-align: center; font-size: 8.5pt;">
            <div style="font-weight: 700; margin-bottom: 6px; color: #1e293b;">Émargement du Salarié</div>
            <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 40px;">« Lu et approuvé »</div>
          </div>

          <div style="width: 32%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; min-height: 120px; text-align: center; font-size: 8.5pt;">
            <div style="font-weight: 700; margin-bottom: 4px; color: #1e293b;">Visa Responsable Hiérarchique</div>
            <div style="color: #166534; font-weight: 600; font-size: 8pt; margin-top: 4px;">✓ Avis Favorable</div>
            <div style="font-size: 8pt; color: #475569; margin-top: 2px;">${escapeHtml(absence.sup_nom ? `${absence.sup_prenom} ${absence.sup_nom}` : 'Chef de Service')}</div>
          </div>

          <div style="width: 34%; border: 2px solid #1e3a8a; border-radius: 6px; padding: 12px; min-height: 120px; text-align: center; font-size: 8.5pt; background-color: #f8fafc;">
            <div style="font-weight: 800; margin-bottom: 4px; color: #1e3a8a;">Direction Ressources Humaines</div>
            <div style="color: #1e40af; font-weight: 700; font-size: 8pt; margin-top: 4px;">VALIDÉ & ENREGISTRÉ</div>
            <div style="font-size: 8pt; color: #475569; margin-top: 2px;">${escapeHtml(absence.decide_par || 'M. Amine Abritx (DRH)')}</div>
            <div style="margin-top: 15px; font-size: 7pt; color: #94a3b8; letter-spacing: 1px;">CACHET OFFICIEL SCHB</div>
          </div>
        </div>

        <!-- Pied de page officiel -->
        <div style="margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 7.5pt; color: #94a3b8;">
          SCHB Béjaïa · Filiale du Groupe Industriel des Ciments d'Algérie (GICA) · Route des Ciments, Béjaïa, Algérie · Système RH 2.0
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Déclenchement de l'impression PDF
    window.print();

    // Nettoyage après impression
    window.addEventListener('afterprint', () => {
      overlay.remove();
    }, { once: true });
    setTimeout(() => {
      if (document.getElementById('printable-titre-conge-overlay')) {
        overlay.remove();
      }
    }, 4000);
  },

  async processDecision(id, matricule, duree, typeConge, statut, empName = '', empEmail = '') {
    const user = getCurrentUser();

    if (statut === 'Approuvé' && typeConge === 'Annuel') {
      try {
        const emp = await api.getEmployee(matricule);
        if (emp.solde_conge < duree) {
          const proceed = await confirmDialog(
            `Attention : le solde de congé annuel de cet employé (${emp.solde_conge}j) est inférieur à la durée demandée (${duree}j).<br>Voulez-vous quand même approuver ? Son solde deviendra négatif.`,
            { title: 'Solde insuffisant' }
          );
          if (!proceed) return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const decisionData = {
      id,
      matricule,
      duree_jours: duree,
      type_conge: typeConge,
      statut,
      decide_par: `${user.prenom} ${user.nom} (DRH)`,
      date_decision: new Date().toISOString().split('T')[0]
    };

    try {
      const res = await api.saveAbsence(decisionData);

      if (statut === 'Approuvé') {
        const targetEmail = res?.email_destinataire || empEmail;
        const emailMsg = targetEmail ? `<br><br><div style="padding: 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; font-size: 0.85rem; color: #166534; text-align: left;">
          <div style="font-weight: 700; margin-bottom: 4px;">✉ Confirmation Email expédiée via mail.dz-com.com :</div>
          • Destinataire principal : <strong>${escapeHtml(targetEmail)}</strong><br>
          • Copie officielle (CC) : <strong>it@dz-com.com</strong><br>
          <div style="margin-top: 6px; font-size: 0.8rem; color: #4b5563; font-style: italic;">
            Note : Si la boîte de réception est un compte externe (Gmail, Yahoo...), vérifiez également le dossier <strong>Spam / Courrier indésirable</strong>.
          </div>
        </div>` : '';
        await confirmDialog(
          `La demande de congé de <strong>${escapeHtml(empName || matricule)}</strong> (${duree} jours) a été définitivement approuvée par la Direction RH.${emailMsg}`,
          { title: 'Demande de Congé Validée', danger: false }
        );
      } else {
        toast("Demande de congé refusée.", 'danger');
      }

      // Rafraîchir
      const mainContainer = document.getElementById('main-view-container');
      mainContainer.innerHTML = await this.render();
      this.init();
    } catch (err) {
      toast(`Erreur: ${err.message}`, 'danger');
    }
  }
};

