import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';

let currentTab = 'hierarchie'; // 'hierarchie' | 'simulateur' | 'interims'
let hierarchyData = [];
let interimsData = [];
let allEmployees = [];
let selectedEmployeeMatricule = '';

export const OrganigrammeComponent = {
  title: 'Organigramme & Circuit de Validation',
  subtitle: 'Hiérarchie des services, simulateur de demande de congé et gestion des intérims',

  async render(queryParams = {}) {
    const user = getCurrentUser();
    try {
      [hierarchyData, interimsData, allEmployees] = await Promise.all([
        api.getHierarchy(),
        api.getInterims(),
        api.getEmployees()
      ]);
    } catch (err) {
      console.error('Erreur chargement organigramme:', err);
    }

    if (user?.role === 'employee') {
      selectedEmployeeMatricule = user.matricule;
    } else if (!selectedEmployeeMatricule) {
      selectedEmployeeMatricule = user?.matricule || (allEmployees[0]?.matricule || '');
    }

    return `
      <div class="tab-container" style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Navigation Sous-Onglets -->
        <div class="card" style="padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap;" id="organi-tabs">
            <button class="btn ${currentTab === 'hierarchie' ? 'btn-primary' : 'btn-secondary'}" data-tab="hierarchie" style="display: inline-flex; align-items: center; gap: 8px;">
              <i data-lucide="git-branch" style="width: 16px; height: 16px;"></i>
              <span>Hiérarchie & Équipes</span>
            </button>
            <button class="btn ${currentTab === 'simulateur' ? 'btn-primary' : 'btn-secondary'}" data-tab="simulateur" style="display: inline-flex; align-items: center; gap: 8px;">
              <i data-lucide="route" style="width: 16px; height: 16px;"></i>
              <span>Simulateur Circuit Congé</span>
            </button>
            <button class="btn ${currentTab === 'interims' ? 'btn-primary' : 'btn-secondary'}" data-tab="interims" style="display: inline-flex; align-items: center; gap: 8px;">
              <i data-lucide="user-check" style="width: 16px; height: 16px;"></i>
              <span>Gestion des Intérims</span>
              ${interimsData.filter(i => i.statut === 'Actif').length > 0 ? 
                `<span class="badge warning" style="margin-left: 6px; padding: 2px 7px; font-size: 0.72rem; border-radius: 10px;">${interimsData.filter(i => i.statut === 'Actif').length} actif(s)</span>` : ''}
            </button>
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${(user?.role === 'hr' || user?.role === 'supervisor') ? `
              <button class="btn btn-primary" id="btn-nouveau-interim" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="user-plus" style="width: 16px; height: 16px;"></i>
                <span>Désigner un Intérimaire</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Contenu dynamique de l'onglet -->
        <div id="organi-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  },

  renderTabContent() {
    if (currentTab === 'simulateur') {
      return this.renderSimulateurView();
    }
    if (currentTab === 'interims') {
      return this.renderInterimsView();
    }
    return this.renderHierarchieView();
  },

  // ==========================================
  // VUE 1 : HIÉRARCHIE & ÉQUIPES
  // ==========================================
  renderHierarchieView() {
    const user = getCurrentUser();
    const isHrOrSupervisor = (user?.role === 'hr' || user?.role === 'supervisor');

    // Grouper par département
    const deptMap = {};
    for (const emp of hierarchyData) {
      const dept = emp.departement || 'Sans Département';
      if (!deptMap[dept]) deptMap[dept] = [];
      deptMap[dept].push(emp);
    }

    const deptKeys = Object.keys(deptMap).sort();

    // Trouver les superviseurs (ceux qui ont des subordonnés ou qui sont marqués superviseur/hr)
    const supervisorMatricules = new Set(
      hierarchyData.filter(e => e.nb_subordonnes > 0 || e.role === 'supervisor' || e.role === 'hr').map(e => e.matricule)
    );

    return `
      ${!isHrOrSupervisor ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 0.88rem; color: #1e40af; margin-bottom: 16px;">
          <i data-lucide="shield-check" style="width: 20px; height: 20px; color: #2563eb; flex-shrink: 0;"></i>
          <span><strong>Périmètre Équipe :</strong> En tant que collaborateur, vous visualisez exclusivement les membres et responsables de votre département <strong>(${escapeHtml(user?.departement || 'Affecté')})</strong>.</span>
        </div>
      ` : ''}

      <!-- Barre de recherche et filtre département -->
      <div class="card" style="padding: 16px 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px; position: relative;">
          <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-muted);"></i>
          <input type="text" id="hierarchie-search" class="form-control" placeholder="Rechercher un collaborateur, un chef ou un poste..." style="padding-left: 38px;">
        </div>
        <div style="min-width: 200px;">
          <select id="hierarchie-dept-filter" class="form-control">
            <option value="">Tous les Départements (${hierarchyData.length} collaborateurs)</option>
            ${deptKeys.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)} (${deptMap[d].length})</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Liste des départements et hiérarchie -->
      <div id="hierarchie-cards-container" style="display: flex; flex-direction: column; gap: 24px;">
        ${deptKeys.map(dept => {
          const members = deptMap[dept];
          const supervisors = members.filter(m => supervisorMatricules.has(m.matricule));
          const regularEmployees = members.filter(m => !supervisorMatricules.has(m.matricule));

          return `
            <div class="card dept-section" data-dept="${escapeHtml(dept)}" style="padding: 24px; border-left: 5px solid #2563eb;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="building" style="width: 22px; height: 22px;"></i>
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(dept)}</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">${members.length} collaborateur(s) affecté(s)</span>
                  </div>
                </div>
                <div>
                  <span class="badge info" style="font-size: 0.8rem; padding: 4px 10px;">
                    ${supervisors.length} responsable(s) d'équipe
                  </span>
                </div>
              </div>

              <!-- Grille des Responsables & Chefs du département -->
              ${supervisors.length > 0 ? `
                <div style="margin-bottom: 20px;">
                  <h4 style="margin: 0 0 12px 0; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="shield" style="width: 14px; height: 14px; color: #2563eb;"></i> Responsables & Chefs d'Équipe
                  </h4>
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                    ${supervisors.map(sup => this.renderEmployeeCard(sup, true, isHrOrSupervisor)).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Grille des Employés & Collaborateurs -->
              <div>
                <h4 style="margin: 0 0 12px 0; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                  <i data-lucide="users" style="width: 14px; height: 14px; color: #64748b;"></i> Membres de l'équipe
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                  ${(regularEmployees.length > 0 ? regularEmployees : members).map(emp => this.renderEmployeeCard(emp, false, isHrOrSupervisor)).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderEmployeeCard(emp, isSupervisorCard = false, isHrOrSupervisor = false) {
    const hasInterim = !!emp.interim_matricule;
    const supFullName = emp.sup_nom ? `${emp.sup_prenom} ${emp.sup_nom}` : null;

    return `
      <div class="card employee-hierarchie-card" data-matricule="${escapeHtml(emp.matricule)}" data-name="${escapeHtml((emp.nom + ' ' + emp.prenom).toLowerCase())}" style="padding: 16px; border: 1px solid ${isSupervisorCard ? '#bfdbfe' : 'var(--border-color)'}; background: ${isSupervisorCard ? '#f8faff' : '#ffffff'}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: ${isSupervisorCard ? '#2563eb' : '#64748b'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; flex-shrink: 0;">
            ${escapeHtml((emp.prenom?.[0] || '') + (emp.nom?.[0] || '')).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 6px;">
              <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(emp.nom)} ${escapeHtml(emp.prenom)}
              </h4>
              <span class="badge" style="font-size: 0.72rem; padding: 2px 6px; background: #f1f5f9; color: #475569;">#${escapeHtml(emp.matricule)}</span>
            </div>
            <div style="font-size: 0.8rem; color: #2563eb; font-weight: 600; margin-top: 2px;">
              ${escapeHtml(emp.poste || 'Collaborateur')}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              <i data-lucide="mail" style="width: 12px; height: 12px; display: inline-block; vertical-align: -1px;"></i> ${escapeHtml(emp.email || 'Aucun email')}
            </div>
          </div>
        </div>

        <!-- Informations Supérieur & Intérim -->
        <div style="background: ${isSupervisorCard ? '#eff6ff' : '#f8fafc'}; border: 1px solid ${isSupervisorCard ? '#dbeafe' : '#e2e8f0'}; border-radius: 6px; padding: 10px; font-size: 0.78rem; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted); font-weight: 500;">Supérieur N+1 :</span>
            <span style="font-weight: 700; color: ${supFullName ? '#1e293b' : '#94a3b8'};">
              ${supFullName ? escapeHtml(supFullName) : 'Direction RH / Aucun'}
            </span>
          </div>

          ${isSupervisorCard ? `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-weight: 500;">Équipe sous sa charge :</span>
              <span class="badge info" style="font-size: 0.72rem; padding: 2px 6px;">${emp.nb_subordonnes || 0} collaborateur(s)</span>
            </div>
          ` : ''}

          <!-- Badge Intérimaire si en congé -->
          ${hasInterim ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 8px; margin-top: 4px;">
              <div style="color: #b45309; font-weight: 700; display: flex; align-items: center; gap: 4px; font-size: 0.75rem;">
                <i data-lucide="alert-circle" style="width: 13px; height: 13px;"></i> Intérim actif en cours
              </div>
              <div style="color: #92400e; font-size: 0.73rem; margin-top: 2px;">
                Délégué à: <strong>${escapeHtml(emp.interim_nom)}</strong> (${formatDateFR(emp.interim_debut)} au ${formatDateFR(emp.interim_fin)})
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Boutons d'action -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px;">
          <button class="btn btn-secondary btn-sm btn-simulate-emp" data-matricule="${escapeHtml(emp.matricule)}" style="flex: 1; padding: 5px 8px; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
            <i data-lucide="route" style="width: 13px; height: 13px;"></i> Tester circuit congé
          </button>

          ${isHrOrSupervisor ? `
            <button class="btn btn-secondary btn-sm btn-edit-supervisor" data-matricule="${escapeHtml(emp.matricule)}" data-nom="${escapeHtml(emp.nom + ' ' + emp.prenom)}" data-sup="${escapeHtml(emp.SuperieurMatricule || '')}" title="Changer le supérieur direct" style="padding: 5px 8px; font-size: 0.75rem;">
              <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i> Supérieur
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // ==========================================
  // VUE 2 : SIMULATEUR DE VALIDATION DE CONGÉ
  // ==========================================
  renderSimulateurView() {
    const emp = allEmployees.find(e => e.matricule === selectedEmployeeMatricule) || allEmployees[0];
    if (!emp) return `<div class="card" style="padding: 24px;">Aucun employé trouvé.</div>`;

    // Dates par défaut pour la simulation : demain pendant 3 jours
    const today = new Date();
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    const end = new Date(tom);
    end.setDate(end.getDate() + 3);
    const dateDebutStr = tom.toISOString().split('T')[0];
    const dateFinStr = end.toISOString().split('T')[0];

    // Trouver le supérieur direct
    const supervisor = allEmployees.find(e => e.matricule === emp.SuperieurMatricule);

    // Vérifier si le supérieur a un intérimaire actif pendant ces dates
    const supInterim = interimsData.find(i => 
      i.matricule_titulaire === emp.SuperieurMatricule &&
      i.statut === 'Actif' &&
      !(dateFinStr < i.date_debut || dateDebutStr > i.date_fin)
    );

    // Trouver le DRH (ex: role 'hr' ou premier RH)
    const drh = allEmployees.find(e => e.role === 'hr') || {
      nom: 'Direction RH',
      prenom: 'Service',
      poste: 'DRH & Administration',
      email: 'drh@gica.dz'
    };

    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Card de sélection de la simulation -->
        <div class="card" style="padding: 20px;">
          <h3 style="margin: 0 0 16px 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <i data-lucide="help-circle" style="width: 20px; height: 20px; color: #2563eb;"></i>
            Comprendre le circuit de ma demande de congé : À qui sera-t-elle envoyée ?
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; align-items: flex-end;">
            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary);">
                Employé demandeur :
              </label>
              ${user?.role === 'employee' ? `
                <input type="text" class="form-control" disabled style="font-weight: 700; background: #f8fafc;" value="${escapeHtml(emp.nom)} ${escapeHtml(emp.prenom)} (${escapeHtml(emp.poste || 'Collaborateur')} - ${escapeHtml(emp.departement)})">
                <input type="hidden" id="sim-employee-select" value="${escapeHtml(emp.matricule)}">
              ` : `
                <select id="sim-employee-select" class="form-control" style="font-weight: 600;">
                  ${allEmployees.map(e => `
                    <option value="${escapeHtml(e.matricule)}" ${e.matricule === selectedEmployeeMatricule ? 'selected' : ''}>
                      ${escapeHtml(e.nom)} ${escapeHtml(e.prenom)} (${escapeHtml(e.poste || 'Collaborateur')} - ${escapeHtml(e.departement)})
                    </option>
                  `).join('')}
                </select>
              `}
            </div>

            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary);">
                Période de congé souhaitée (Du) :
              </label>
              <input type="date" id="sim-date-debut" class="form-control" value="${dateDebutStr}">
            </div>

            <div>
              <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px; color: var(--text-secondary);">
                Période de congé souhaitée (Au) :
              </label>
              <input type="date" id="sim-date-fin" class="form-control" value="${dateFinStr}">
            </div>

            <div>
              <button class="btn btn-primary" id="btn-recalculer-sim" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
                <i data-lucide="play" style="width: 16px; height: 16px;"></i>
                Calculer le Circuit
              </button>
            </div>
          </div>
        </div>

        <!-- Diagramme Visuel du Circuit de Validation -->
        <div class="card" style="padding: 28px 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div>
              <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">
                Schéma Officiel de Validation pour <span style="color: #2563eb;">${escapeHtml(emp.nom)} ${escapeHtml(emp.prenom)}</span>
              </h4>
              <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                Voici le cheminement exact et automatique de la notification et de l'approbation pour cette demande.
              </p>
            </div>

            ${supInterim ? `
              <span class="badge warning" style="font-size: 0.82rem; padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="alert-triangle" style="width: 15px; height: 15px;"></i> RÈGLE D'INTÉRIM ACTIVE
              </span>
            ` : `
              <span class="badge success" style="font-size: 0.82rem; padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="check-circle" style="width: 15px; height: 15px;"></i> CIRCUIT STANDARD
              </span>
            `}
          </div>

          <!-- Ligne de flux horizontal (Workflow Steps) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; position: relative;">
            
            <!-- ÉTAPE 1 : Demandeur -->
            <div class="card" style="padding: 20px; border: 2px solid #bfdbfe; background: #f8faff; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge info" style="font-size: 0.75rem; font-weight: 700;">ÉTAPE 1 : INITIATION</span>
                <i data-lucide="send" style="width: 18px; height: 18px; color: #2563eb;"></i>
              </div>
              <div style="display: flex; gap: 12px; align-items: center;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;">
                  ${escapeHtml((emp.prenom?.[0] || '') + (emp.nom?.[0] || '')).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(emp.nom)} ${escapeHtml(emp.prenom)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(emp.poste || 'Collaborateur')}</div>
                  <div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(emp.departement)}</div>
                </div>
              </div>
              <div style="background: white; border: 1px solid #dbeafe; border-radius: 6px; padding: 8px 10px; font-size: 0.78rem; color: #1e3a8a;">
                <i data-lucide="info" style="width: 13px; height: 13px; display: inline-block; vertical-align: -2px;"></i>
                L'employé saisit sa demande de congé sur le portail RH.
              </div>
            </div>

            <!-- ÉTAPE 2 : Validation N+1 ou Intérimaire -->
            <div class="card" style="padding: 20px; border: 2px solid ${supInterim ? '#f59e0b' : '#3b82f6'}; background: ${supInterim ? '#fffbeb' : '#f0f9ff'}; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge ${supInterim ? 'warning' : 'info'}" style="font-size: 0.75rem; font-weight: 700;">
                  ÉTAPE 2 : ${supInterim ? 'DÉLÉGATION INTÉRIM' : 'AVIS CHEF N+1'}
                </span>
                <i data-lucide="${supInterim ? 'user-check' : 'user'}" style="width: 18px; height: 18px; color: ${supInterim ? '#d97706' : '#2563eb'};"></i>
              </div>

              ${supInterim ? `
                <!-- Cas où le chef a un intérimaire désigné -->
                <div>
                  <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: #d97706; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                      ${escapeHtml((supInterim.interimaire_prenom?.[0] || '') + (supInterim.interimaire_nom?.[0] || '')).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 0.95rem; color: #92400e;">
                        ${escapeHtml(supInterim.interimaire_nom)} ${escapeHtml(supInterim.interimaire_prenom)}
                      </div>
                      <div style="font-size: 0.78rem; font-weight: 600; color: #b45309;">
                        Intérimaire Délégué officiel
                      </div>
                      <div style="font-size: 0.72rem; color: #78350f;">
                        Remplace: <strong>${escapeHtml(supervisor?.nom || supInterim.titulaire_nom)} ${escapeHtml(supervisor?.prenom || '')}</strong> (en congé)
                      </div>
                    </div>
                  </div>
                </div>

                <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; font-size: 0.78rem; color: #78350f;">
                  <div style="font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                    <i data-lucide="bell-ring" style="width: 14px; height: 14px; color: #d97706;"></i>
                    Routage Automatique :
                  </div>
                  La notification & l'email de validation seront envoyés <strong>directement à ${escapeHtml(supInterim.interimaire_nom)}</strong>. 
                  Une copie d'information est archivée pour ${escapeHtml(supervisor?.nom || 'le titulaire')}.
                </div>
              ` : supervisor ? `
                <!-- Cas standard : Chef direct présent -->
                <div>
                  <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                      ${escapeHtml((supervisor.prenom?.[0] || '') + (supervisor.nom?.[0] || '')).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                        ${escapeHtml(supervisor.nom)} ${escapeHtml(supervisor.prenom)}
                      </div>
                      <div style="font-size: 0.78rem; color: #2563eb; font-weight: 600;">
                        ${escapeHtml(supervisor.poste || 'Responsable hiérarchique')}
                      </div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">
                        ${escapeHtml(supervisor.email || 'Aucun email')}
                      </div>
                    </div>
                  </div>
                </div>

                <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; font-size: 0.78rem; color: #1e3a8a;">
                  <div style="font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                    <i data-lucide="bell" style="width: 14px; height: 14px; color: #2563eb;"></i>
                    Envoi Direct :
                  </div>
                  La demande sera soumise à l'approbation préalable du chef direct.
                </div>
              ` : `
                <!-- Cas où aucun chef n'est configuré -->
                <div style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 6px; padding: 12px; font-size: 0.8rem; color: #9a3412;">
                  <div style="font-weight: 700; margin-bottom: 4px;">Aucun supérieur direct assigné</div>
                  La demande sera transmise automatiquement sans intermédiaire à la Direction RH.
                </div>
              `}
            </div>

            <!-- ÉTAPE 3 : Direction RH -->
            <div class="card" style="padding: 20px; border: 2px solid #86efac; background: #f0fdf4; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge success" style="font-size: 0.75rem; font-weight: 700;">ÉTAPE 3 : DÉCISION DRH</span>
                <i data-lucide="shield-check" style="width: 18px; height: 18px; color: #16a34a;"></i>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: #16a34a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem;">
                  RH
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                    ${escapeHtml(drh.nom)} ${escapeHtml(drh.prenom)}
                  </div>
                  <div style="font-size: 0.78rem; color: #16a34a; font-weight: 600;">
                    ${escapeHtml(drh.poste || 'Direction RH')}
                  </div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">
                    ${escapeHtml(drh.email || 'drh@gica.dz')}
                  </div>
                </div>
              </div>
              <div style="background: white; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; font-size: 0.78rem; color: #14532d;">
                Vérification du solde de congés disponible, conformité réglementaire et approbation définitive.
              </div>
            </div>

            <!-- ÉTAPE 4 : Confirmation Finale -->
            <div class="card" style="padding: 20px; border: 2px solid #e2e8f0; background: #f8fafc; border-radius: 8px; display: flex; flex-direction: column; gap: 12px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge info" style="font-size: 0.75rem; font-weight: 700;">ÉTAPE 4 : CLÔTURE</span>
                <i data-lucide="mail-check" style="width: 18px; height: 18px; color: #2563eb;"></i>
              </div>
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
                Confirmation & Notification
              </div>
              <ul style="margin: 0; padding-left: 18px; font-size: 0.78rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px;">
                <li>Email de confirmation envoyé à <strong>${escapeHtml(emp.nom)}</strong></li>
                <li>Mise à jour automatique du solde de congés</li>
                <li>Inscription au planning et calendrier d'équipe</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // VUE 3 : GESTION DES INTÉRIMS & DÉLÉGATIONS
  // ==========================================
  renderInterimsView() {
    const user = getCurrentUser();
    const canManage = (user?.role === 'hr' || user?.role === 'supervisor');

    return `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="card" style="padding: 20px; background: #f8faff; border-left: 5px solid #2563eb;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <i data-lucide="user-check" style="width: 22px; height: 22px; color: #2563eb;"></i>
                Délégations de Validation & Intérim des Chefs de Service
              </h3>
              <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                Lorsqu'un responsable ou chef de service est absent ou en congé, il délègue son autorité à un intérimaire. 
                Toutes les demandes de congé de son équipe sont alors <strong>automatiquement transmises à l'intérimaire</strong> avec pouvoir de validation.
              </p>
            </div>

            ${canManage ? `
              <button class="btn btn-primary" id="btn-nouveau-interim-2" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i>
                Désigner un Intérimaire
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Tableau des Intérims -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="table-container" style="margin-top: 0; border: none;">
            <table class="custom-table" id="interims-table">
              <thead>
                <tr>
                  <th>Chef Titulaire (Absent)</th>
                  <th>Intérimaire Désigné</th>
                  <th>Période d'Intérim</th>
                  <th>Motif de la Délégation</th>
                  <th>Statut</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${interimsData.length === 0 ? `
                  <tr>
                    <td colspan="6" style="text-align: center; padding: 40px 20px;">
                      <div class="table-empty-state">
                        <div class="table-empty-icon"><i data-lucide="user-check" style="width: 24px; height: 24px;"></i></div>
                        <div class="table-empty-title">Aucune délégation d'intérim</div>
                        <div class="table-empty-desc">Aucune période d'intérim active ou programmée pour le moment.</div>
                      </div>
                    </td>
                  </tr>
                ` : interimsData.map(item => {
                  const isActif = item.statut === 'Actif';
                  return `
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                            ${escapeHtml((item.titulaire_prenom?.[0] || '') + (item.titulaire_nom?.[0] || '')).toUpperCase()}
                          </div>
                          <div>
                            <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(item.titulaire_nom)} ${escapeHtml(item.titulaire_prenom)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.titulaire_poste || 'Chef de Service')} (#${escapeHtml(item.matricule_titulaire)})</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="width: 32px; height: 32px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                            ${escapeHtml((item.interimaire_prenom?.[0] || '') + (item.interimaire_nom?.[0] || '')).toUpperCase()}
                          </div>
                          <div>
                            <div style="font-weight: 700; color: #047857;">${escapeHtml(item.interimaire_nom)} ${escapeHtml(item.interimaire_prenom)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.interimaire_poste || 'Collaborateur')} (#${escapeHtml(item.matricule_interimaire)})</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary);">
                          Du ${formatDateFR(item.date_debut)} au ${formatDateFR(item.date_fin)}
                        </div>
                      </td>
                      <td>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                          ${escapeHtml(item.motif || 'Congé / Absence du titulaire')}
                        </div>
                      </td>
                      <td>
                        ${isActif ? `
                          <span class="badge success" style="font-size: 0.78rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;">
                            <i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> Actif
                          </span>
                        ` : `
                          <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.78rem; font-weight: 700; padding: 4px 8px;">
                            ${escapeHtml(item.statut)}
                          </span>
                        `}
                      </td>
                      <td style="text-align: right;">
                        ${(isActif && canManage) ? `
                          <button class="btn btn-secondary btn-sm btn-terminate-interim" data-id="${escapeHtml(item.id)}" title="Mettre fin prématurément à cet intérim" style="color: #dc2626; border-color: #fecaca; background: #fff5f5; font-size: 0.75rem;">
                            <i data-lucide="stop-circle" style="width: 14px; height: 14px;"></i>
                            Mettre fin
                          </button>
                        ` : '-'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // INITIALISATION DES ÉCOUTEURS
  // ==========================================
  init() {
    if (window.lucide) window.lucide.createIcons();

    // Gestion du changement d'onglets
    const tabButtons = document.querySelectorAll('#organi-tabs button');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== currentTab) {
          currentTab = tab;
          tabButtons.forEach(b => {
            b.className = (b.getAttribute('data-tab') === currentTab) ? 'btn btn-primary' : 'btn btn-secondary';
          });
          const contentEl = document.getElementById('organi-tab-content');
          if (contentEl) {
            contentEl.innerHTML = this.renderTabContent();
            this.initTabSpecificListeners();
          }
        }
      });
    });

    // Boutons "Désigner un Intérimaire"
    const btnNewInterim1 = document.getElementById('btn-nouveau-interim');
    const btnNewInterim2 = document.getElementById('btn-nouveau-interim-2');
    if (btnNewInterim1) btnNewInterim1.addEventListener('click', () => this.openInterimModal());
    if (btnNewInterim2) btnNewInterim2.addEventListener('click', () => this.openInterimModal());

    this.initTabSpecificListeners();
  },

  initTabSpecificListeners() {
    if (window.lucide) window.lucide.createIcons();

    // 1. Écouteurs de la vue Hiérarchie
    const searchInput = document.getElementById('hierarchie-search');
    const deptFilter = document.getElementById('hierarchie-dept-filter');
    if (searchInput || deptFilter) {
      const filterCards = () => {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const dept = deptFilter ? deptFilter.value : '';

        const deptSections = document.querySelectorAll('.dept-section');
        deptSections.forEach(section => {
          const sectionDept = section.getAttribute('data-dept');
          if (dept && sectionDept !== dept) {
            section.style.display = 'none';
            return;
          }

          let anyVisible = false;
          const cards = section.querySelectorAll('.employee-hierarchie-card');
          cards.forEach(card => {
            const name = card.getAttribute('data-name') || '';
            const matricule = card.getAttribute('data-matricule') || '';
            if (!query || name.includes(query) || matricule.includes(query)) {
              card.style.display = 'flex';
              anyVisible = true;
            } else {
              card.style.display = 'none';
            }
          });

          section.style.display = (anyVisible || (!query && !dept)) ? 'block' : 'none';
        });
      };

      if (searchInput) searchInput.addEventListener('input', filterCards);
      if (deptFilter) deptFilter.addEventListener('change', filterCards);
    }

    // Boutons "Tester circuit congé" sur les cartes employés
    const simButtons = document.querySelectorAll('.btn-simulate-emp');
    simButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mat = btn.getAttribute('data-matricule');
        if (mat) {
          selectedEmployeeMatricule = mat;
          currentTab = 'simulateur';
          const tabBtn = document.querySelector('#organi-tabs button[data-tab="simulateur"]');
          if (tabBtn) tabBtn.click();
        }
      });
    });

    // Boutons "Changer de supérieur"
    const editSupButtons = document.querySelectorAll('.btn-edit-supervisor');
    editSupButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mat = btn.getAttribute('data-matricule');
        const nom = btn.getAttribute('data-nom');
        const sup = btn.getAttribute('data-sup');
        this.openSupervisorModal(mat, nom, sup);
      });
    });

    // 2. Écouteurs du Simulateur
    const simSelect = document.getElementById('sim-employee-select');
    const btnRecalc = document.getElementById('btn-recalculer-sim');
    if (simSelect) {
      simSelect.addEventListener('change', (e) => {
        selectedEmployeeMatricule = e.target.value;
        const contentEl = document.getElementById('organi-tab-content');
        if (contentEl) {
          contentEl.innerHTML = this.renderSimulateurView();
          this.initTabSpecificListeners();
        }
      });
    }
    if (btnRecalc) {
      btnRecalc.addEventListener('click', () => {
        const contentEl = document.getElementById('organi-tab-content');
        if (contentEl) {
          contentEl.innerHTML = this.renderSimulateurView();
          this.initTabSpecificListeners();
        }
      });
    }

    // 3. Écouteurs des Intérims (Mettre fin)
    const terminateButtons = document.querySelectorAll('.btn-terminate-interim');
    terminateButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;

        confirmDialog("Êtes-vous sûr de vouloir mettre fin à cette délégation d'intérim ?", async () => {
          try {
            await api.terminateInterim(id);
            toast("Délégation d'intérim terminée avec succès.", 'success');
            // Recharger les données
            [hierarchyData, interimsData] = await Promise.all([
              api.getHierarchy(),
              api.getInterims()
            ]);
            const contentEl = document.getElementById('organi-tab-content');
            if (contentEl) {
              contentEl.innerHTML = this.renderInterimsView();
              this.initTabSpecificListeners();
            }
          } catch (err) {
            toast(err.message || "Erreur lors de la clôture de l'intérim.", 'error');
          }
        });
      });
    });
  },

  // ==========================================
  // MODAL : CHANGER DE SUPÉRIEUR HIÉRARCHIQUE
  // ==========================================
  openSupervisorModal(matricule, nomEmploye, currentSupMatricule) {
    const eligibleSupervisors = allEmployees.filter(e => e.matricule !== matricule);

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px; font-size: 0.85rem; color: #1e3a8a;">
          Sélectionnez le responsable direct (N+1) pour <strong>${escapeHtml(nomEmploye)}</strong>. 
          Toutes les futures demandes de congé de cet employé seront transmises à ce responsable pour validation initiale.
        </div>

        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
            Responsable Hiérarchique (N+1) :
          </label>
          <select id="modal-new-supervisor" class="form-control" style="font-weight: 600;">
            <option value="">-- Aucun supérieur direct (Directement DRH) --</option>
            ${eligibleSupervisors.map(s => `
              <option value="${escapeHtml(s.matricule)}" ${s.matricule === currentSupMatricule ? 'selected' : ''}>
                ${escapeHtml(s.nom)} ${escapeHtml(s.prenom)} (${escapeHtml(s.poste || 'Collaborateur')} - ${escapeHtml(s.departement)})
              </option>
            `).join('')}
          </select>
        </div>
      </div>
    `;

    openModal(
      `Attribuer un Supérieur : ${nomEmploye}`,
      bodyHtml,
      async () => {
        const select = document.getElementById('modal-new-supervisor');
        const newSupMatricule = select ? select.value : '';

        try {
          await api.updateEmployeeSupervisor(matricule, newSupMatricule);
          toast("Supérieur hiérarchique mis à jour avec succès !", 'success');
          closeModal();

          // Rafraîchir les données
          [hierarchyData, allEmployees] = await Promise.all([
            api.getHierarchy(),
            api.getEmployees()
          ]);
          const contentEl = document.getElementById('organi-tab-content');
          if (contentEl) {
            contentEl.innerHTML = this.renderHierarchieView();
            this.initTabSpecificListeners();
          }
        } catch (err) {
          toast(err.message || "Erreur lors de la mise à jour du supérieur.", 'error');
        }
      }
    );
  },

  // ==========================================
  // MODAL : DÉSIGNER UN INTÉRIMAIRE
  // ==========================================
  openInterimModal() {
    const user = getCurrentUser();
    const isHr = user?.role === 'hr';

    // Trouver la liste des chefs titulaires possibles
    const potentialTitulaires = isHr ? 
      allEmployees.filter(e => e.role === 'supervisor' || e.role === 'hr' || hierarchyData.some(h => h.SuperieurMatricule === e.matricule)) :
      allEmployees.filter(e => e.matricule === user?.matricule);

    const defaultTitulaire = isHr ? potentialTitulaires[0]?.matricule : user?.matricule;

    // Dates par défaut (demain pour 14 jours)
    const today = new Date();
    const d1 = new Date(today);
    d1.setDate(d1.getDate() + 1);
    const d2 = new Date(d1);
    d2.setDate(d2.getDate() + 14);

    const d1Str = d1.toISOString().split('T')[0];
    const d2Str = d2.toISOString().split('T')[0];

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; font-size: 0.85rem; color: #92400e;">
          <strong>Système d'intérim automatique :</strong> Lorsqu'un chef est en congé ou absent, l'intérimaire désigné reçoit 
          automatiquement toutes les demandes de congés des employés de son équipe avec notification et email.
        </div>

        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
            Chef de service titulaire (Absent / En congé) :
          </label>
          <select id="modal-titulaire-matricule" class="form-control" ${!isHr ? 'disabled' : ''}>
            ${potentialTitulaires.map(t => `
              <option value="${escapeHtml(t.matricule)}" ${t.matricule === defaultTitulaire ? 'selected' : ''}>
                ${escapeHtml(t.nom)} ${escapeHtml(t.prenom)} (${escapeHtml(t.poste || 'Chef de Service')})
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
            Intérimaire désigné (Qui valide à la place du chef) :
          </label>
          <select id="modal-interimaire-matricule" class="form-control" style="font-weight: 600;">
            <option value="">-- Sélectionner un collaborateur --</option>
            ${allEmployees.filter(e => e.matricule !== defaultTitulaire).map(e => `
              <option value="${escapeHtml(e.matricule)}">
                ${escapeHtml(e.nom)} ${escapeHtml(e.prenom)} (${escapeHtml(e.poste || 'Collaborateur')} - ${escapeHtml(e.departement)})
              </option>
            `).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
              Date de début d'intérim :
            </label>
            <input type="date" id="modal-interim-date-debut" class="form-control" value="${d1Str}">
          </div>
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
              Date de fin d'intérim :
            </label>
            <input type="date" id="modal-interim-date-fin" class="form-control" value="${d2Str}">
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 6px;">
            Motif de la délégation (Optionnel) :
          </label>
          <input type="text" id="modal-interim-motif" class="form-control" placeholder="Ex: Congé annuel d'été, Déplacement professionnel, Mission...">
        </div>
      </div>
    `;

    openModal(
      "Désigner un Intérimaire de Service",
      bodyHtml,
      async () => {
        const titulaireSelect = document.getElementById('modal-titulaire-matricule');
        const interimaireSelect = document.getElementById('modal-interimaire-matricule');
        const dateDebutInput = document.getElementById('modal-interim-date-debut');
        const dateFinInput = document.getElementById('modal-interim-date-fin');
        const motifInput = document.getElementById('modal-interim-motif');

        const matricule_titulaire = titulaireSelect ? titulaireSelect.value : defaultTitulaire;
        const matricule_interimaire = interimaireSelect ? interimaireSelect.value : '';
        const date_debut = dateDebutInput ? dateDebutInput.value : '';
        const date_fin = dateFinInput ? dateFinInput.value : '';
        const motif = motifInput ? motifInput.value.trim() : '';

        if (!matricule_titulaire || !matricule_interimaire) {
          toast("Veuillez sélectionner le titulaire et l'intérimaire.", 'warning');
          return;
        }

        if (matricule_titulaire === matricule_interimaire) {
          toast("Le titulaire et l'intérimaire doivent être des personnes différentes.", 'warning');
          return;
        }

        if (!date_debut || !date_fin || date_debut > date_fin) {
          toast("Veuillez renseigner une plage de dates valide.", 'warning');
          return;
        }

        try {
          await api.saveInterim({
            matricule_titulaire,
            matricule_interimaire,
            date_debut,
            date_fin,
            motif
          });

          toast("Délégation d'intérim activée avec succès ! Notification et email transmis.", 'success');
          closeModal();

          // Recharger
          [hierarchyData, interimsData] = await Promise.all([
            api.getHierarchy(),
            api.getInterims()
          ]);

          currentTab = 'interims';
          const tabBtn = document.querySelector('#organi-tabs button[data-tab="interims"]');
          if (tabBtn) tabBtn.click();
        } catch (err) {
          toast(err.message || "Erreur lors de la désignation de l'intérimaire.", 'error');
        }
      }
    );
  }
};
