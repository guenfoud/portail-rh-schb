import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR, exportToExcel } from '../utils.js';

export const RecuperationComponent = {
  title: 'Gestion des Récupérations',
  subtitle: 'Suivi des congés compensateurs et demandes de récupération',

  async render() {
    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';
    const isSupervisor = user.role === 'supervisor';

    let recuperations = [];
    let employees = [];

    try {
      if (isEmployee) {
        recuperations = await api.getRecuperations(user.matricule);
        const emp = await api.getEmployee(user.matricule);
        employees = [emp];
      } else {
        const allEmp = await api.getEmployees();
        employees = isSupervisor ? allEmp.filter(e => e.departement === user.departement) : allEmp;
        
        const allRec = await api.getRecuperations();
        const deptMatricules = employees.map(e => e.matricule);
        recuperations = allRec.filter(r => deptMatricules.includes(r.matricule) || r.matricule === user.matricule);
      }
    } catch (e) {
      console.error(e);
    }

    const demandesAttente = recuperations.filter(r => r.statut === 'En attente');
    const historiqueDemandes = recuperations.filter(r => r.statut !== 'En attente');

    return `
      <div class="tab-container">
        <!-- Sub-Tabs Navigation -->
        <div class="sub-tabs-nav" style="display: flex; gap: 24px; border-bottom: 2px solid var(--border-color); margin-bottom: 24px; padding-bottom: 0;">
          <button class="sub-tab-btn active" data-subview="solde" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--color-primary); cursor: pointer; border-bottom: 3px solid var(--color-primary); padding: 10px 4px 12px 4px; transition: all 0.2s;">
            ${isEmployee ? 'Mon Solde' : 'Soldes Collaborateurs'}
          </button>
          <button class="sub-tab-btn" data-subview="attente" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; padding: 10px 4px 12px 4px; border-bottom: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
            Demandes en Attente 
            <span class="badge ${demandesAttente.length > 0 ? 'warning' : 'secondary'}" style="font-size: 0.75rem; padding: 2px 6px;">${demandesAttente.length}</span>
          </button>
          <button class="sub-tab-btn" data-subview="historique" style="background: none; border: none; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; padding: 10px 4px 12px 4px; border-bottom: 3px solid transparent; transition: all 0.2s;">
            Historique des Décisions
          </button>
        </div>

        <!-- SUBVIEW: SOLDE -->
        <div id="subview-solde" class="subview-container">
          <!-- Actions & Filters -->
          <div class="search-bar-container card" style="padding: 16px 24px; margin-bottom: 20px;">
            <div>
              <h3 style="font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="info" style="color: var(--color-info);"></i>
                Solde des Récupérations
              </h3>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">
                ${isEmployee ? `Votre solde de récupération est de <strong>${parseFloat(((employees[0]?.solde_recuperation || 0) / 8).toFixed(2))} jours</strong>.` : 'Créditez les soldes via la validation de la Fiche Mensuelle.'}
              </p>
            </div>
            
            <div style="display: flex; gap: 8px;">
              ${!isEmployee ? `
                <button class="btn btn-secondary" id="btn-export-recuperations" style="border: 1px solid var(--border-color); background-color: var(--bg-secondary); padding: 8px 16px; font-size: 0.85rem; font-weight: 700;">
                  <i data-lucide="file-spreadsheet"></i>
                  Exporter
                </button>
                <button class="btn btn-secondary" id="btn-adjust-recuperation-balance" style="border: 1px solid var(--border-color); background-color: var(--bg-secondary); padding: 8px 16px; font-size: 0.85rem; font-weight: 700;">
                  <i data-lucide="settings-2"></i>
                  Ajuster Solde (Crédit/Débit)
                </button>
              ` : ''}
              <button class="btn btn-primary" id="btn-add-recuperation">
                <i data-lucide="plus"></i>
                Nouvelle Demande
              </button>
            </div>
          </div>

          <!-- Employees Balance Overview Table List -->
          ${!isEmployee ? `
            <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <h4 style="margin: 0; font-weight: 700;">Soldes de Récupération des Collaborateurs</h4>
                <div class="search-input-wrapper" style="max-width: 280px; width: 100%;">
                  <i data-lucide="search" style="width: 15px; height: 15px;"></i>
                  <input type="text" id="rec-balance-search" class="form-control" placeholder="Rechercher par nom ou matricule..." style="height: 34px; padding-left: 36px; font-size: 0.8rem;">
                </div>
              </div>
              <div class="table-container" style="margin-top: 0; overflow-y: auto; flex: 1; border: 1px solid var(--border-color); border-radius: var(--radius-md); max-height: 400px;">
                <style>
                  .rec-balance-row { cursor: pointer; transition: background-color 0.15s ease; }
                  .rec-balance-row:hover { background-color: rgba(124, 58, 237, 0.06) !important; }
                </style>
                <table class="custom-table responsive-card-table" style="font-size: 0.85rem;">
                  <thead>
                    <tr style="position: sticky; top: 0; background-color: var(--bg-secondary); z-index: 1;">
                      <th>Matricule</th>
                      <th>Nom & Prénom</th>
                      <th>Département</th>
                      <th>Poste</th>
                      <th style="text-align: right;">Solde (jours)</th>
                    </tr>
                  </thead>
                  <tbody id="rec-balances-body">
                    ${employees.map(emp => `
                      <tr class="rec-balance-row" data-matricule="${escapeHtml(emp.matricule)}" data-search="${escapeHtml(emp.matricule)} ${escapeHtml(emp.prenom.toLowerCase())} ${escapeHtml(emp.nom.toLowerCase())}">
                        <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(emp.matricule)}</td>
                        <td data-label="Nom & Prénom" style="font-weight: 600;">${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</td>
                        <td data-label="Département"><span class="badge primary" style="font-size: 0.75rem;">${escapeHtml(emp.departement)}</span></td>
                        <td data-label="Poste">${escapeHtml(emp.poste)}</td>
                        <td data-label="Solde (jours)" style="text-align: right;">
                          <span class="badge ${emp.solde_recuperation > 0 ? 'success' : 'secondary'}" style="font-size: 0.85rem; font-weight: 700;">
                            ${parseFloat((emp.solde_recuperation / 8).toFixed(2))} jours
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
                <span style="font-size: 0.9rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Solde total disponible</span>
                <span class="badge success" style="font-size: 1.3rem; padding: 8px 16px; font-weight: 800;">
                  ${parseFloat(((employees[0]?.solde_recuperation || 0) / 8).toFixed(2))} jours
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 8px;">(${employees[0]?.solde_recuperation || 0} heures de récupération accumulées)</span>
              </div>
            </div>
          `}
        </div>

        <!-- SUBVIEW: ATTENTE -->
        <div id="subview-attente" class="subview-container" style="display: none;">
          <!-- Pending Requests Section -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); background-color: rgba(245,158,11,0.02);">
              <h3 style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; margin: 0;">
                <i data-lucide="hourglass" style="color: var(--color-warning); width: 18px; height: 18px;"></i>
                Demandes de Récupération en Attente (${demandesAttente.length})
              </h3>
            </div>
            <div class="table-container" style="margin-top: 0; border: none;">
              <table class="custom-table responsive-card-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Date Demande</th>
                    <th>Date Récupération</th>
                    <th>Durée (jours)</th>
                    <th>Motif</th>
                    <th>Solde Actuel</th>
                    <th style="text-align: right;">Décision</th>
                  </tr>
                </thead>
                <tbody>
                  ${demandesAttente.length === 0 ? `
                    <tr>
                      <td colspan="8" style="text-align: center; padding: 40px 20px;">
                        <div class="table-empty-state">
                          <div class="table-empty-icon"><i data-lucide="check-circle-2" style="width: 24px; height: 24px; color: var(--color-success);"></i></div>
                          <div class="table-empty-title">Aucune demande en attente</div>
                          <div class="table-empty-desc">Toutes les demandes de récupération ont été validées ou traitées.</div>
                        </div>
                      </td>
                    </tr>
                  ` : demandesAttente.map(r => {
                    const emp = employees.find(e => e.matricule === r.matricule);
                    const empName = emp ? `${emp.prenom} ${emp.nom}` : 'Inconnu';
                    const initials = emp ? `${(emp.prenom && emp.prenom[0] ? emp.prenom[0] : '').toUpperCase()}${(emp.nom && emp.nom[0] ? emp.nom[0] : '').toUpperCase()}` : 'EX';
                    const solde = emp ? emp.solde_recuperation : 0;
                    const soldeInsuffisant = solde < r.duree;

                    return `
                      <tr data-id="${escapeHtml(r.id)}">
                        <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(r.matricule)}</td>
                        <td data-label="Employé">
                          <div class="table-user-cell">
                            <div class="table-avatar">${initials}</div>
                            <div class="table-user-info">
                              <span class="table-user-name">${escapeHtml(empName)}</span>
                              <span class="table-user-sub">${escapeHtml(emp?.departement || '')}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Date Demande">${formatDateFR(r.date_demande)}</td>
                        <td data-label="Date Récupération">${formatDateFR(r.date_debut)}</td>
                        <td data-label="Durée"><strong>${parseFloat((r.duree / 8).toFixed(2))} j</strong></td>
                        <td data-label="Motif">
                          ${escapeHtml(r.motif)}
                          <div style="margin-top: 4px;">
                            ${!isEmployee ? (r.statut_superviseur ? `<span class="badge ${r.statut_superviseur === 'Approuvé' ? 'success' : 'danger'}" style="font-size: 0.7rem;">Superviseur : ${escapeHtml(r.statut_superviseur)}</span>` : `<span class="badge secondary" style="font-size: 0.7rem;">Superviseur : —</span>`) : ''}
                          </div>
                        </td>
                        <td data-label="Solde Actuel">
                          <span class="badge ${soldeInsuffisant ? 'danger' : 'success'}">
                            ${parseFloat((solde / 8).toFixed(2))} j
                          </span>
                          ${soldeInsuffisant ? `<span style="color: var(--color-danger); font-size: 0.75rem; display: block; margin-top: 4px;">Solde Insuffisant</span>` : ''}
                        </td>
                        <td data-label="Décision" style="text-align: right; white-space: nowrap;">
                          ${isEmployee && r.matricule === user.matricule ? `
                            <span style="color: var(--text-muted); font-size: 0.85rem;">En attente RH/Superviseur</span>
                          ` : isSupervisor ? `
                            ${r.statut_superviseur ? `
                              <span style="color: var(--text-muted); font-size: 0.8rem;">Déjà pré-validé</span>
                            ` : `
                              <button class="btn btn-success btn-supervisor-decision-rec" data-id="${escapeHtml(r.id)}" data-statut="Approuvé" style="padding: 6px 12px; font-size: 0.8rem;">
                                Valider
                              </button>
                              <button class="btn btn-danger btn-supervisor-decision-rec" data-id="${escapeHtml(r.id)}" data-statut="Refusé" style="padding: 6px 12px; font-size: 0.8rem;">
                                Rejeter
                              </button>
                            `}
                          ` : `
                            <button class="btn btn-success btn-approve" data-id="${escapeHtml(r.id)}" data-matricule="${escapeHtml(r.matricule)}" data-duree="${r.duree}" style="padding: 6px 12px; font-size: 0.8rem;">
                              Approuver
                            </button>
                            <button class="btn btn-danger btn-reject" data-id="${escapeHtml(r.id)}" style="padding: 6px 12px; font-size: 0.8rem;">
                              Refuser
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
        </div>

        <!-- SUBVIEW: HISTORIQUE -->
        <div id="subview-historique" class="subview-container" style="display: none;">
          <!-- History of Requests -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <h3 style="font-weight: 700; font-size: 1.05rem; margin: 0;">Historique des Décisions</h3>
              <div class="search-input-wrapper" style="max-width: 280px; width: 100%;">
                <i data-lucide="search" style="width: 15px; height: 15px;"></i>
                <input type="text" id="rec-history-search" class="form-control" placeholder="Rechercher par nom ou matricule..." style="height: 34px; padding-left: 36px; font-size: 0.8rem;">
              </div>
            </div>
            <div class="table-container" style="margin-top: 0; border: none; max-height: 400px; overflow-y: auto;">
              <table class="custom-table responsive-card-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Date Demande</th>
                    <th>Date Récupération</th>
                    <th>Durée (jours)</th>
                    <th>Motif</th>
                    <th>Statut</th>
                    <th>Décidé Par / Le</th>
                  </tr>
                </thead>
                <tbody>
                  ${historiqueDemandes.length === 0 ? `
                    <tr>
                      <td colspan="8" style="text-align: center; padding: 40px 20px;">
                        <div class="table-empty-state">
                          <div class="table-empty-icon"><i data-lucide="archive" style="width: 24px; height: 24px;"></i></div>
                          <div class="table-empty-title">Aucun historique disponible</div>
                          <div class="table-empty-desc">L'historique des demandes de récupération traitées apparaîtra ici.</div>
                        </div>
                      </td>
                    </tr>
                  ` : historiqueDemandes.reverse().map(r => {
                    const emp = employees.find(e => e.matricule === r.matricule);
                    const empName = emp ? `${emp.prenom} ${emp.nom}` : 'Inconnu';
                    const initials = emp ? `${(emp.prenom && emp.prenom[0] ? emp.prenom[0] : '').toUpperCase()}${(emp.nom && emp.nom[0] ? emp.nom[0] : '').toUpperCase()}` : 'EX';
                    const badgeClass = r.statut === 'Approuvé' ? 'success' : 'danger';

                    return `
                      <tr class="rec-history-row" data-search="${escapeHtml(r.matricule)} ${escapeHtml(empName.toLowerCase())}">
                        <td data-label="Matricule" style="font-weight: 700; color: var(--color-primary);">${escapeHtml(r.matricule)}</td>
                        <td data-label="Employé">
                          <div class="table-user-cell">
                            <div class="table-avatar">${initials}</div>
                            <div class="table-user-info">
                              <span class="table-user-name">${escapeHtml(empName)}</span>
                              <span class="table-user-sub">${escapeHtml(emp?.departement || '')}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Date Demande">${formatDateFR(r.date_demande)}</td>
                        <td data-label="Date Récupération">${formatDateFR(r.date_debut)}</td>
                        <td data-label="Durée">${parseFloat((r.duree / 8).toFixed(2))} j</td>
                        <td data-label="Motif" style="color: var(--text-secondary); font-style: italic;">${escapeHtml(r.motif)}</td>
                        <td data-label="Statut"><span class="badge ${badgeClass}">${escapeHtml(r.statut)}</span></td>
                        <td data-label="Décision" style="font-size: 0.8rem; color: var(--text-muted);">
                          ${escapeHtml(r.decide_par || 'RH')} <br>
                          ${r.date_decision ? formatDateFR(r.date_decision) : ''}
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

    const btnAdd = document.getElementById('btn-add-recuperation');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.showRequestModal());
    }

    const btnAdjust = document.getElementById('btn-adjust-recuperation-balance');
    if (btnAdjust) {
      btnAdjust.addEventListener('click', () => this.showAdjustBalanceModal());
    }

    const btnExport = document.getElementById('btn-export-recuperations');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        try {
          const employees = await api.getEmployees();
          const rows = employees.map(e => ({
            'Matricule': e.matricule,
            'Nom & Prénom': `${e.prenom} ${e.nom}`,
            'Département': e.departement,
            'Poste': e.poste,
            'Solde Récupération (j)': parseFloat((e.solde_recuperation / 8).toFixed(2))
          }));
          exportToExcel(`Soldes_Recuperation_${new Date().toISOString().split('T')[0]}`, rows, 'Récupérations');
        } catch (err) {
          toast(`Erreur export: ${err.message}`, 'danger');
        }
      });
    }

    // Filtrage dynamique en temps réel de la liste des soldes de récupération
    const balanceSearch = document.getElementById('rec-balance-search');
    if (balanceSearch) {
      balanceSearch.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.rec-balance-row').forEach(row => {
          const searchVal = row.getAttribute('data-search');
          if (searchVal.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    // Filtrage dynamique en temps réel de l'historique des décisions
    const historySearch = document.getElementById('rec-history-search');
    if (historySearch) {
      historySearch.addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.rec-history-row').forEach(row => {
          const searchVal = row.getAttribute('data-search');
          if (searchVal && searchVal.includes(query)) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      });
    }

    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const matricule = e.currentTarget.getAttribute('data-matricule');
        const duree = parseFloat(e.currentTarget.getAttribute('data-duree'));
        this.processDecision(id, matricule, duree, 'Approuvé');
      });
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.processDecision(id, '', 0, 'Refusé');
      });
    });

    // Pré-validation Superviseur (étape informative, n'affecte pas le solde)
    document.querySelectorAll('.btn-supervisor-decision-rec').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const statut = e.currentTarget.getAttribute('data-statut');
        try {
          await api.supervisorDecisionRecuperation(id, statut);
          toast(`Pré-validation enregistrée : ${statut}.`, 'success');
          const mainContainer = document.getElementById('main-view-container');
          mainContainer.innerHTML = await this.render();
          this.init();
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        }
      });
    });

    document.querySelectorAll('.rec-balance-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
        const matricule = e.currentTarget.getAttribute('data-matricule');
        window.location.hash = `#recupedetail?matricule=${matricule}`;
      });
    });
  },

  showRequestModal(prefilledMatricule = null) {
    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';

    let employeeSelectHtml = '';
    if (isEmployee) {
      employeeSelectHtml = `<input type="hidden" id="rec-matricule" value="${user.matricule}">`;
    } else {
      employeeSelectHtml = `
        <div class="form-group" style="position: relative;">
          <label for="rec-search-emp">Rechercher un Employé*</label>
          <input type="text" id="rec-search-emp" class="form-control" placeholder="Taper le nom, prénom ou matricule (ex: 130031)..." autocomplete="off" required>
          <input type="hidden" id="rec-matricule" required>
          <div id="rec-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
        </div>
        <style>
          .suggestion-item:hover { background-color: rgba(124, 58, 237, 0.08) !important; }
        </style>
      `;
    }

    const bodyHtml = `
      <form id="recuperation-form" style="display: flex; flex-direction: column; gap: 16px;">
        ${employeeSelectHtml}

        <div class="form-row">
          <div class="form-group">
            <label for="rec-debut">Date de début*</label>
            <input type="date" id="rec-debut" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="rec-duree">Durée de la récupération (Jours)*</label>
            <select id="rec-duree" class="form-control" required>
              <option value="0.5">Demi-journée (0.5 jour)</option>
              <option value="1" selected>Une journée (1 jour)</option>
              <option value="2">Deux journées (2 jours)</option>
              <option value="3">Trois journées (3 jours)</option>
            </select>
          </div>
        </div>

        ${!isEmployee ? `
          <div class="form-group">
            <label for="rec-statut">Statut de l'enregistrement*</label>
            <select id="rec-statut" class="form-control" required>
              <option value="En attente">En attente (Demande à valider)</option>
              <option value="Approuvé" selected>Approuvé directement (Saisie Manuelle)</option>
            </select>
          </div>
        ` : ''}

        <div class="form-group">
          <label for="rec-motif">Motif / Justification*</label>
          <textarea id="rec-motif" class="form-control" rows="3" placeholder="Indiquer la raison de la récupération..." required></textarea>
        </div>
      </form>
    `;

    openModal('Nouvelle demande de récupération', bodyHtml, async () => {
      const form = document.getElementById('recuperation-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const matricule = document.getElementById('rec-matricule').value;
      const dateDebut = document.getElementById('rec-debut').value;
      const dureeJours = parseFloat(document.getElementById('rec-duree').value);
      const dureeHeures = dureeJours * 8; // Convertir jours en heures pour la base de données
      const motif = document.getElementById('rec-motif').value.trim();
      const statut = document.getElementById('rec-statut')?.value || 'En attente';

      const newRequest = {
        matricule,
        date_debut: dateDebut,
        duree: dureeHeures,
        motif,
        statut,
        decide_par: statut === 'Approuvé' ? `${user.prenom} ${user.nom}` : null,
        date_decision: statut === 'Approuvé' ? new Date().toISOString().split('T')[0] : null
      };

      try {
        await api.saveRecuperation(newRequest);
        toast("Demande enregistrée avec succès.", 'success');

        // Rafraîchir
        const mainContainer = document.getElementById('main-view-container');
        mainContainer.innerHTML = await this.render();
        this.init();
        return true;
      } catch (err) {
        toast(err.message, 'danger');
        return false;
      }
    });

    // --- LOGIQUE AUTOCOMPLETE ---
    const searchInput = document.getElementById('rec-search-emp');
    const hiddenInput = document.getElementById('rec-matricule');
    const suggestionsDiv = document.getElementById('rec-suggestions');

    if (searchInput && hiddenInput && suggestionsDiv) {
      if (prefilledMatricule) {
        api.getEmployee(prefilledMatricule).then(emp => {
          if (emp) {
            searchInput.value = `${emp.matricule} - ${emp.prenom} ${emp.nom}`;
            hiddenInput.value = emp.matricule;
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

  async processDecision(id, matricule, duree, statut) {
    const user = getCurrentUser();

    if (statut === 'Approuvé') {
      try {
        const emp = await api.getEmployee(matricule);
        if (emp.solde_recuperation < duree) {
          const proceed = await confirmDialog(
            `Attention : le solde de récupération de cet employé (${emp.solde_recuperation}h) est inférieur à la durée demandée (${duree}h).<br>Voulez-vous quand même approuver ? Son solde deviendra négatif.`,
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
      duree,
      statut,
      decide_par: `${user.prenom} ${user.nom}`,
      date_decision: new Date().toISOString().split('T')[0]
    };

    try {
      await api.saveRecuperation(decisionData);
      
      // Rafraîchir
      const mainContainer = document.getElementById('main-view-container');
      mainContainer.innerHTML = await this.render();
      this.init();
    } catch (err) {
      toast(`Erreur: ${err.message}`, 'danger');
    }
  },

  showAdjustBalanceModal(prefilledMatricule = null) {
    let employeeSelectHtml = `
      <div class="form-group" style="position: relative;">
        <label for="adj-search-emp">Rechercher un Employé*</label>
        <input type="text" id="adj-search-emp" class="form-control" placeholder="Taper le nom, prénom ou matricule (ex: 130031)..." autocomplete="off" required>
        <input type="hidden" id="adj-matricule" required>
        <div id="adj-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
      </div>
    `;

    const bodyHtml = `
      <form id="adjust-balance-form" style="display: flex; flex-direction: column; gap: 16px;">
        ${employeeSelectHtml}

        <div class="form-row">
          <div class="form-group">
            <label for="adj-type">Type d'ajustement*</label>
            <select id="adj-type" class="form-control" required>
              <option value="credit" selected>Ajouter / Créditer des jours (+)</option>
              <option value="debit">Retirer / Débiter des jours (-)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="adj-valeur">Nombre de jours*</label>
            <input type="number" step="0.1" id="adj-valeur" class="form-control" placeholder="ex: 1" required min="0.1">
          </div>
        </div>

        <div class="form-group">
          <label for="adj-motif">Motif d'ajustement*</label>
          <input type="text" id="adj-motif" class="form-control" placeholder="ex: Heures sup weekend, Correction solde" required>
        </div>
      </form>
    `;

    openModal('Ajuster le solde de récupération', bodyHtml, async () => {
      const form = document.getElementById('adjust-balance-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const matricule = document.getElementById('adj-matricule').value;
      const typeAdj = document.getElementById('adj-type').value;
      const valeurJours = parseFloat(document.getElementById('adj-valeur').value);
      const valeurHeures = valeurJours * 8; // Convertir jours en heures pour la base de données
      const motif = document.getElementById('adj-motif').value.trim();

      const finalHours = typeAdj === 'credit' ? valeurHeures : -valeurHeures;

      try {
        await api.creditRecuperation(matricule, finalHours, motif);
        toast("Solde de récupération mis à jour avec succès !", 'success');

        // Rafraîchir
        const mainContainer = document.getElementById('main-view-container');
        mainContainer.innerHTML = await this.render();
        this.init();
        return true;
      } catch (err) {
        toast(`Erreur: ${err.message}`, 'danger');
        return false;
      }
    });

    // --- LOGIQUE AUTOCOMPLETE ---
    const searchInput = document.getElementById('adj-search-emp');
    const hiddenInput = document.getElementById('adj-matricule');
    const suggestionsDiv = document.getElementById('adj-suggestions');

    if (searchInput && hiddenInput && suggestionsDiv) {
      if (prefilledMatricule) {
        api.getEmployee(prefilledMatricule).then(emp => {
          if (emp) {
            searchInput.value = `${emp.matricule} - ${emp.prenom} ${emp.nom}`;
            hiddenInput.value = emp.matricule;
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
                <strong>${escapeHtml(e.matricule)}</strong> - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)} (Solde: ${parseFloat((e.solde_recuperation / 8).toFixed(2))}j)
              </div>
            `).join('');
          }
          suggestionsDiv.style.display = 'block';

          suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
              hiddenInput.value = e.currentTarget.getAttribute('data-matricule');
              searchInput.value = e.currentTarget.getAttribute('data-display');
              suggestionsDiv.style.display = 'none';
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
  }
};
