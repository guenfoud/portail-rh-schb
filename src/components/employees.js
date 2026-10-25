import { api } from '../api.js';
import { openModal, closeModal, renderTimePicker, getTimePickerValue, toast, confirmDialog } from '../main.js';
import { AbsencesComponent } from './absences.js';
import { RecuperationComponent } from './recuperation.js';
import { escapeHtml, formatDateFR, exportToExcel, resizeImageToDataUrl, fileToDataUrl } from '../utils.js';

export const EmployeesComponent = {
  title: 'Gestion des Employés',
  subtitle: 'Annuaire des collaborateurs et fiches de renseignements',

  async render() {
    let employees = [];
    try {
      employees = await api.getEmployees();
    } catch (e) {
      console.error(e);
    }
    
    const departments = [...new Set(employees.map(e => e.departement))];

    return `
      <div class="tab-container">
        <!-- Actions & Filters -->
        <div class="search-bar-container card" style="padding: 16px 24px;">
          <div class="search-input-wrapper">
            <i data-lucide="search"></i>
            <input type="text" id="emp-search" class="form-control" placeholder="Rechercher par nom ou matricule...">
          </div>
          
          <div style="display: flex; gap: 12px; align-items: center;">
            <select id="emp-dept-filter" class="form-control" style="width: 200px; padding: 8px 12px;">
              <option value="">Tous les Départements</option>
              ${departments.map(dept => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`).join('')}
            </select>
            
            <button class="btn btn-secondary" id="btn-export-employees">
              <i data-lucide="file-spreadsheet"></i>
              Exporter
            </button>

            <button class="btn btn-primary" id="btn-add-employee">
              <i data-lucide="user-plus"></i>
              Ajouter Employé
            </button>
          </div>
        </div>

        <!-- Employees Table -->
        <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="padding: 14px 20px; background: #ffffff; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h4 style="margin: 0; font-weight: 700; font-size: 0.95rem; color: #0f172a;">Répertoire du Personnel</h4>
              <span class="badge secondary" id="emp-count-badge">${employees.length} collaborateurs</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              <i data-lucide="building" style="width: 14px; height: 14px;"></i>
              Société des Ciments de Hamma Bouziane (SCHB GICA)
            </div>
          </div>
          <div class="table-container" style="margin-top: 0; border: none;">
            <table class="custom-table" id="employees-table">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Employé</th>
                  <th>Département</th>
                  <th>Poste</th>
                  <th>Embauche</th>
                  <th>Horaires</th>
                  <th>Récupération</th>
                  <th>Congés Restants</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="employees-list-body">
                ${this.renderTableRows(employees)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  renderTableRows(employees) {
    if (employees.length === 0) {
      return `
        <tr>
          <td colspan="9" style="text-align: center; padding: 48px 20px;">
            <div class="table-empty-state">
              <div class="table-empty-icon"><i data-lucide="users" style="width: 24px; height: 24px;"></i></div>
              <div class="table-empty-title">Aucun employé trouvé</div>
              <div class="table-empty-desc">Aucun collaborateur ne correspond aux critères de recherche actuels.</div>
            </div>
          </td>
        </tr>
      `;
    }

    return employees.map((emp, index) => {
      const initials = `${(emp.prenom && emp.prenom[0] ? emp.prenom[0] : '').toUpperCase()}${(emp.nom && emp.nom[0] ? emp.nom[0] : '').toUpperCase()}` || 'RH';
      const roleLabel = emp.role === 'hr' ? 'DRH / Cadre RH' : (emp.role === 'supervisor' ? 'Responsable' : 'Collaborateur');

      return `
        <tr data-matricule="${escapeHtml(emp.matricule)}" class="row-stagger-in">
          <td style="font-weight: 700; color: var(--color-primary);">${escapeHtml(emp.matricule)}</td>
          <td>
            <div class="table-user-cell">
              <div class="table-avatar">${initials}</div>
              <div class="table-user-info">
                <span class="table-user-name">${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</span>
                <span class="table-user-sub">${escapeHtml(emp.Email || roleLabel)}</span>
              </div>
            </div>
          </td>
          <td><span class="badge primary">${escapeHtml(emp.departement)}</span></td>
          <td style="font-weight: 500;">${escapeHtml(emp.poste)}</td>
          <td style="color: var(--text-secondary);">${formatDateFR(emp.date_embauche)}</td>
          <td>
            <span style="font-size: 0.82rem; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; padding: 2px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">
              <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--text-muted);"></i>
              ${escapeHtml(emp.horaire_debut)} - ${escapeHtml(emp.horaire_fin)}
            </span>
          </td>
          <td>
            <span class="badge ${emp.solde_recuperation > 0 ? 'success' : 'secondary'}">
              ${parseFloat((emp.solde_recuperation / 8).toFixed(2))} j
            </span>
          </td>
          <td>
            <span class="badge ${emp.solde_conge > 10 ? 'success' : 'warning'}">
              ${emp.solde_conge} j
            </span>
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <div class="table-actions">
              <button class="btn-icon btn-detail" title="Fiche détaillée" data-matricule="${escapeHtml(emp.matricule)}">
                <i data-lucide="eye"></i>
              </button>
              <button class="btn-icon btn-edit" title="Modifier" data-matricule="${escapeHtml(emp.matricule)}">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon btn-delete" style="color: var(--color-danger);" title="Supprimer" data-matricule="${escapeHtml(emp.matricule)}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async filterEmployees() {
    const query = document.getElementById('emp-search').value.toLowerCase().trim();
    const deptFilter = document.getElementById('emp-dept-filter').value;
    
    let employees = [];
    try {
      employees = await api.getEmployees();
    } catch (e) {
      console.error(e);
    }

    if (query) {
      employees = employees.filter(emp => 
        emp.matricule.includes(query) || 
        emp.nom.toLowerCase().includes(query) || 
        emp.prenom.toLowerCase().includes(query)
      );
    }

    if (deptFilter) {
      employees = employees.filter(emp => emp.departement === deptFilter);
    }

    const countBadge = document.getElementById('emp-count-badge');
    if (countBadge) {
      countBadge.textContent = `${employees.length} collaborateur${employees.length > 1 ? 's' : ''}`;
    }

    const tbody = document.getElementById('employees-list-body');
    if (tbody) {
      tbody.innerHTML = this.renderTableRows(employees);
      if (window.lucide) window.lucide.createIcons();
      this.attachActionListeners();
    }
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    const searchInput = document.getElementById('emp-search');
    const deptFilter = document.getElementById('emp-dept-filter');
    const btnAdd = document.getElementById('btn-add-employee');

    if (searchInput) searchInput.addEventListener('keyup', () => this.filterEmployees());
    if (deptFilter) deptFilter.addEventListener('change', () => this.filterEmployees());
    
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.showEmployeeFormModal());
    }

    const btnExport = document.getElementById('btn-export-employees');
    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        try {
          const employees = await api.getEmployees();
          const rows = employees.map(e => ({
            'Matricule': e.matricule,
            'Nom': e.nom,
            'Prénom': e.prenom,
            'Département': e.departement,
            'Poste': e.poste,
            'Date embauche': formatDateFR(e.date_embauche),
            'Horaire début': e.horaire_debut,
            'Horaire fin': e.horaire_fin,
            'Rôle': e.role,
            'Solde récup (j)': parseFloat((e.solde_recuperation / 8).toFixed(2)),
            'Solde congé (j)': e.solde_conge
          }));
          exportToExcel(`Employes_${new Date().toISOString().split('T')[0]}`, rows, 'Employés');
        } catch (err) {
          toast(`Erreur export: ${err.message}`, 'danger');
        }
      });
    }

    this.attachActionListeners();
  },

  attachActionListeners() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const matricule = e.currentTarget.getAttribute('data-matricule');
        this.showEmployeeFormModal(matricule);
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const matricule = e.currentTarget.getAttribute('data-matricule');
        this.confirmDeleteEmployee(matricule);
      });
    });

    document.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const matricule = e.currentTarget.getAttribute('data-matricule');
        this.showEmployeeDetailsModal(matricule);
      });
    });

    document.querySelectorAll('#employees-list-body tr').forEach(row => {
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('.btn-icon') || e.target.closest('button')) {
          return;
        }
        const matricule = row.getAttribute('data-matricule');
        if (matricule) {
          this.showEmployeeDetailsModal(matricule);
        }
      });
      row.style.cursor = 'pointer';
      row.setAttribute('title', 'Double-cliquez pour afficher la fiche détaillée');
    });
  },

  async showEmployeeFormModal(matricule = null) {
    const isEdit = matricule !== null;
    let emp = null;
    if (isEdit) {
      try {
        emp = await api.getEmployee(matricule);
      } catch (err) {
        toast(err.message, 'danger');
        return;
      }
    }
    const title = isEdit ? `Modifier Employé : ${emp.prenom} ${emp.nom}` : "Ajouter un nouvel employé";
    const initials = isEdit ? `${(emp.prenom || '?')[0]}${(emp.nom || '?')[0]}`.toUpperCase() : null;

    const bodyHtml = `
      <form id="employee-form" class="ef-form">
        <div class="ef-profile-header">
          <button type="button" class="ef-avatar ef-avatar-btn" id="ef-photo-trigger" title="Changer la photo" style="background-image: ${emp?.photo ? `url('${emp.photo}')` : 'none'};">
            ${!emp?.photo ? (isEdit ? escapeHtml(initials) : '<i data-lucide="user-plus"></i>') : ''}
            <span class="ef-avatar-edit"><i data-lucide="camera"></i></span>
          </button>
          <input type="file" id="ef-photo-input" accept="image/*" hidden>
          <div>
            <div class="ef-profile-name">${isEdit ? `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}` : 'Nouveau collaborateur'}</div>
            <div class="ef-profile-sub">${isEdit ? `${escapeHtml(emp.poste)} · ${escapeHtml(emp.departement)}` : 'Renseignez sa fiche ci-dessous'}</div>
          </div>
        </div>

        <div class="ef-section">
          <div class="ef-section-title"><i data-lucide="id-card"></i> Identité</div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-matricule">Matricule pointeuse (Unique)*</label>
              <input type="text" id="form-matricule" class="form-control" required value="${escapeHtml(emp ? emp.matricule : '')}" ${isEdit ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label for="form-embauche">Date d'embauche*</label>
              <input type="date" id="form-embauche" class="form-control" required value="${emp ? emp.date_embauche : new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-nom">Nom de famille*</label>
              <input type="text" id="form-nom" class="form-control" required value="${escapeHtml(emp ? emp.nom : '')}">
            </div>
            <div class="form-group">
              <label for="form-prenom">Prénom*</label>
              <input type="text" id="form-prenom" class="form-control" required value="${escapeHtml(emp ? emp.prenom : '')}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-email">Adresse Email professionnelle (pour alertes & congés)</label>
              <input type="email" id="form-email" class="form-control" placeholder="ex: prenom.nom@gica.dz" value="${escapeHtml(emp ? (emp.Email || '') : '')}">
            </div>
            <div class="form-group">
              <label for="form-tel">Téléphone de contact</label>
              <input type="text" id="form-tel" class="form-control" placeholder="ex: 031 92 XX XX" value="${escapeHtml(emp ? (emp.Telephone || '') : '')}">
            </div>
          </div>
        </div>

        <div class="ef-section">
          <div class="ef-section-title"><i data-lucide="briefcase"></i> Poste & Département</div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-dept">Département*</label>
              <select id="form-dept" class="form-control" required>
                <option value="">Sélectionner...</option>
                <option value="Ressources Humaines" ${emp && emp.departement === 'Ressources Humaines' ? 'selected' : ''}>Ressources Humaines</option>
                <option value="IT" ${emp && emp.departement === 'IT' ? 'selected' : ''}>IT</option>
                <option value="Production" ${emp && emp.departement === 'Production' ? 'selected' : ''}>Production</option>
                <option value="Maintenance" ${emp && emp.departement === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                <option value="Qualité & Laboratoire" ${emp && emp.departement === 'Qualité & Laboratoire' ? 'selected' : ''}>Qualité & Laboratoire</option>
                <option value="Logistique & Expédition" ${emp && emp.departement === 'Logistique & Expédition' ? 'selected' : ''}>Logistique & Expédition</option>
                <option value="Sécurité & Environnement" ${emp && emp.departement === 'Sécurité & Environnement' ? 'selected' : ''}>Sécurité & Environnement</option>
                <option value="Direction" ${emp && emp.departement === 'Direction' ? 'selected' : ''}>Direction</option>
                <option value="Finance & Comptabilité" ${emp && emp.departement === 'Finance & Comptabilité' ? 'selected' : ''}>Finance & Comptabilité</option>
                <option value="Administration" ${emp && emp.departement === 'Administration' ? 'selected' : ''}>Administration</option>
              </select>
            </div>
            <div class="form-group">
              <label for="form-poste">Intitulé du poste*</label>
              <input type="text" id="form-poste" class="form-control" required placeholder="ex: Opérateur Machine" value="${escapeHtml(emp ? emp.poste : '')}">
            </div>
          </div>
        </div>

        <div class="ef-section">
          <div class="ef-section-title"><i data-lucide="clock"></i> Horaires</div>
          <div class="form-row">
            <div class="form-group">
              <label>Horaire de début*</label>
              ${renderTimePicker('form-debut', emp ? emp.horaire_debut : '08:00', true)}
            </div>
            <div class="form-group">
              <label>Horaire de fin*</label>
              ${renderTimePicker('form-fin', emp ? emp.horaire_fin : '16:00', true)}
            </div>
          </div>
        </div>

        <div class="ef-section">
          <div class="ef-section-title"><i data-lucide="shield-check"></i> Accès & Sécurité</div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-role">Rôle Portail*</label>
              <select id="form-role" class="form-control" required>
                <option value="employee" ${emp && emp.role === 'employee' ? 'selected' : ''}>Collaborateur</option>
                <option value="supervisor" ${emp && emp.role === 'supervisor' ? 'selected' : ''}>Superviseur (Shift/Secteur)</option>
                <option value="hr" ${emp && emp.role === 'hr' ? 'selected' : ''}>Directeur RH / Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label for="form-pwd">Mot de passe${isEdit ? '' : '*'}</label>
              <input type="password" id="form-pwd" class="form-control" autocomplete="new-password"
                     placeholder="${isEdit ? 'Laisser vide pour conserver le mot de passe actuel' : 'ex: 1234'}"
                     ${isEdit ? '' : 'required'} value="">
              ${isEdit ? `<span style="font-size: 0.75rem; color: var(--text-muted);">Le mot de passe actuel est stocké de façon sécurisée (haché) et ne peut pas être affiché. Ne renseignez ce champ que pour le changer.</span>` : ''}
            </div>
          </div>
        </div>

        <div class="ef-section">
          <div class="ef-section-title"><i data-lucide="calendar-range"></i> Soldes Initiaux</div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-solde">Solde initial de récupération (Jours)</label>
              <input type="number" step="0.5" id="form-solde" class="form-control" value="${emp ? parseFloat((emp.solde_recuperation / 8).toFixed(2)) : '0'}" ${isEdit ? 'disabled' : ''}>
            </div>
            <div class="form-group">
              <label for="form-solde-conge">Solde initial de congés (Jours)</label>
              <input type="number" step="0.5" id="form-solde-conge" class="form-control" value="${emp ? emp.solde_conge : '30'}" required>
            </div>
          </div>
        </div>

        <div class="ef-section ef-section-accent">
          <div class="ef-section-title"><i data-lucide="repeat"></i> Système de Shift & Rotation (3/8, 2/8)</div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-cycle-travail">Jours travaillés par cycle</label>
              <input type="number" id="form-cycle-travail" class="form-control" min="0" value="${emp ? (emp.cycle_travail || '0') : '0'}" placeholder="ex: 4">
            </div>
            <div class="form-group">
              <label for="form-cycle-repos">Jours de repos par cycle</label>
              <input type="number" id="form-cycle-repos" class="form-control" min="0" value="${emp ? (emp.cycle_repos || '0') : '0'}" placeholder="ex: 2">
            </div>
          </div>
          <div class="form-group">
            <label for="form-cycle-debut">Date de début du premier cycle</label>
            <input type="date" id="form-cycle-debut" class="form-control" value="${emp ? (emp.cycle_debut || '') : ''}">
          </div>
        </div>
      </form>

      ${isEdit ? `
        <div class="ef-section" style="margin-top: 16px;">
          <div class="ef-section-title"><i data-lucide="paperclip"></i> Documents Joints</div>
          <div style="display: flex; gap: 8px; margin-bottom: 14px;">
            <select id="ef-doc-type" class="form-control" style="max-width: 200px;">
              <option value="Contrat">Contrat</option>
              <option value="CNI">Pièce d'identité</option>
              <option value="Certificat">Certificat / Diplôme</option>
              <option value="Autre">Autre</option>
            </select>
            <input type="file" id="ef-doc-input" class="form-control" style="flex: 1;">
            <button type="button" class="btn btn-secondary" id="ef-doc-upload-btn">
              <i data-lucide="upload"></i> Ajouter
            </button>
          </div>
          <div id="ef-documents-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
      ` : ''}
    `;

    openModal(
      title,
      bodyHtml,
      async () => {
        const form = document.getElementById('employee-form');
        if (!form.checkValidity()) {
          form.reportValidity();
          return false;
        }

        const employeeData = {
          matricule: document.getElementById('form-matricule').value.trim(),
          nom: document.getElementById('form-nom').value.trim(),
          prenom: document.getElementById('form-prenom').value.trim(),
          departement: document.getElementById('form-dept').value,
          poste: document.getElementById('form-poste').value.trim(),
          date_embauche: document.getElementById('form-embauche').value,
          horaire_debut: getTimePickerValue('form-debut'),
          horaire_fin: getTimePickerValue('form-fin'),
          role: document.getElementById('form-role').value,
          password: document.getElementById('form-pwd').value,
          solde_conge: parseFloat(document.getElementById('form-solde-conge').value) || 30.0,
          Email: document.getElementById('form-email')?.value.trim() || null,
          Telephone: document.getElementById('form-tel')?.value.trim() || null,
          cycle_travail: parseInt(document.getElementById('form-cycle-travail').value) || 0,
          cycle_repos: parseInt(document.getElementById('form-cycle-repos').value) || 0,
          cycle_debut: document.getElementById('form-cycle-debut').value || '',
          photo: this._pendingPhoto || null
        };

        if (!isEdit) {
          employeeData.solde_recuperation = (parseFloat(document.getElementById('form-solde').value) || 0) * 8.0;
        }

        try {
          await api.saveEmployee(employeeData);
          toast(`Employé ${isEdit ? 'mis à jour' : 'créé'} avec succès.`, 'success');

          // Rafraîchir
          const mainContainer = document.getElementById('main-view-container');
          mainContainer.innerHTML = await this.render();
          this.init();
          return true;
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
          return false;
        }
      }
    );

    // Upload de la photo de profil (redimensionnée côté client avant envoi)
    this._pendingPhoto = emp?.photo || null;
    const photoTrigger = document.getElementById('ef-photo-trigger');
    const photoInput = document.getElementById('ef-photo-input');
    if (photoTrigger && photoInput) {
      photoTrigger.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await resizeImageToDataUrl(file);
          this._pendingPhoto = dataUrl;
          photoTrigger.style.backgroundImage = `url('${dataUrl}')`;
          photoTrigger.textContent = '';
          photoTrigger.innerHTML = `<span class="ef-avatar-edit"><i data-lucide="camera"></i></span>`;
          if (window.lucide) window.lucide.createIcons();
        } catch (err) {
          toast(err.message, 'danger');
        }
      });
    }

    // Documents joints (uniquement en modification, l'employé doit déjà exister)
    if (isEdit) {
      this.renderEmployeeDocuments(matricule);

      const docUploadBtn = document.getElementById('ef-doc-upload-btn');
      if (docUploadBtn) {
        docUploadBtn.addEventListener('click', async () => {
          const fileInput = document.getElementById('ef-doc-input');
          const typeSelect = document.getElementById('ef-doc-type');
          const file = fileInput?.files?.[0];
          if (!file) {
            toast('Veuillez sélectionner un fichier.', 'warning');
            return;
          }
          if (file.size > 4_500_000) {
            toast('Fichier trop volumineux (max ~4.5 Mo).', 'warning');
            return;
          }
          docUploadBtn.disabled = true;
          try {
            const dataUrl = await fileToDataUrl(file);
            await api.uploadEmployeeDocument(matricule, file.name, typeSelect.value, dataUrl);
            toast('Document ajouté.', 'success');
            fileInput.value = '';
            await this.renderEmployeeDocuments(matricule);
          } catch (err) {
            toast(`Erreur: ${err.message}`, 'danger');
          } finally {
            docUploadBtn.disabled = false;
          }
        });
      }
    }
  },

  async renderEmployeeDocuments(matricule) {
    const container = document.getElementById('ef-documents-list');
    if (!container) return;

    try {
      const docs = await api.getEmployeeDocuments(matricule);
      if (docs.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Aucun document joint.</span>`;
        return;
      }

      container.innerHTML = docs.map(d => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <i data-lucide="file-text" style="color: var(--color-primary); flex-shrink: 0;"></i>
            <div style="min-width: 0;">
              <div style="font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(d.nom_fichier)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(d.type_doc)} · ${new Date(d.uploaded_at).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button type="button" class="btn-icon ef-doc-download" data-id="${d.id}" data-name="${escapeHtml(d.nom_fichier)}" title="Télécharger"><i data-lucide="download"></i></button>
            <button type="button" class="btn-icon ef-doc-delete" data-id="${d.id}" title="Supprimer" style="color: var(--color-danger);"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();

      container.querySelectorAll('.ef-doc-download').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const doc = await api.getDocument(btn.getAttribute('data-id'));
            const a = document.createElement('a');
            a.href = doc.contenu;
            a.download = btn.getAttribute('data-name') || 'document';
            a.click();
          } catch (err) {
            toast(err.message, 'danger');
          }
        });
      });

      container.querySelectorAll('.ef-doc-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = await confirmDialog('Supprimer ce document ?', { danger: true });
          if (!ok) return;
          try {
            await api.deleteDocument(btn.getAttribute('data-id'));
            await this.renderEmployeeDocuments(matricule);
          } catch (err) {
            toast(err.message, 'danger');
          }
        });
      });
    } catch (err) {
      container.innerHTML = `<span style="color: var(--color-danger); font-size: 0.85rem;">Erreur: ${escapeHtml(err.message)}</span>`;
    }
  },

  async confirmDeleteEmployee(matricule) {
    try {
      const emp = await api.getEmployee(matricule);
      if (!emp) return;

      const ok = await confirmDialog(
        `Êtes-vous sûr de vouloir supprimer l'employé <strong>${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</strong> (Matricule: ${escapeHtml(matricule)}) ?<br>Ses pointages et données seront conservés mais il n'apparaîtra plus dans la liste active.`,
        { title: 'Supprimer cet employé ?' }
      );
      if (ok) {
        await api.deleteEmployee(matricule);
        toast('Employé supprimé.', 'success');

        // Rafraîchir
        const mainContainer = document.getElementById('main-view-container');
        mainContainer.innerHTML = await this.render();
        this.init();
      }
    } catch (err) {
      toast(err.message, 'danger');
    }
  },

  async showEmployeeDetailsModal(matricule) {
    try {
      const emp = await api.getEmployee(matricule);
      const pointages = await api.getPointages(null, matricule);
      const recups = await api.getRecuperations(matricule);

      // Stats de présence
      const totalJours = pointages.length;
      const retards = pointages.filter(p => p.retard > 0).length;
      const anomalies = pointages.filter(p => p.anomalie).length;

      const detailInitials = `${(emp.prenom || '?')[0]}${(emp.nom || '?')[0]}`.toUpperCase();
      const bodyHtml = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div class="ef-profile-header" style="margin: 0;">
            <div class="ef-avatar" style="background-image: ${emp.photo ? `url('${emp.photo}')` : 'none'};">${!emp.photo ? escapeHtml(detailInitials) : ''}</div>
            <div>
              <div class="ef-profile-name">${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</div>
              <div class="ef-profile-sub">Matricule ${escapeHtml(emp.matricule)}</div>
              <div style="margin-top: 4px; font-size: 0.85rem; color: #2563eb; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="mail" style="width: 14px; height: 14px;"></i>
                ${emp.Email ? `<a href="mailto:${escapeHtml(emp.Email)}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${escapeHtml(emp.Email)}</a>` : '<span style="color: var(--text-muted); font-style: italic;">Aucun email configuré</span>'}
              </div>
            </div>
          </div>

          <div style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: bold;">Département / Poste</span>
              <div style="font-weight: 600; font-size: 1rem; color: var(--color-primary);">${escapeHtml(emp.departement)}</div>
              <div style="font-weight: 500; font-size: 0.9rem;">${escapeHtml(emp.poste)}</div>
            </div>
            <div>
              <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: bold;">Date d'embauche</span>
              <div style="font-weight: 600; font-size: 0.95rem;">${formatDateFR(emp.date_embauche)}</div>
              <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Horaires : ${escapeHtml(emp.horaire_debut)} - ${escapeHtml(emp.horaire_fin)}</span>
              ${emp.cycle_travail > 0 ? `
                <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 600; display: block; margin-top: 4px;">
                  Cycle : ${emp.cycle_travail}j Travail / ${emp.cycle_repos}j Repos (Début: ${emp.cycle_debut ? formatDateFR(emp.cycle_debut) : '-'})
                </span>
              ` : `
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px;">Cycle : Aucun (Standard)</span>
              `}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
            <div style="background-color: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">${totalJours}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Jours Pointés</div>
            </div>
            <div style="background-color: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.1); border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--color-warning);">${retards}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Retards</div>
            </div>
            <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--color-danger);">${anomalies}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Anomalies</div>
            </div>
            <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--color-success);">${parseFloat((emp.solde_recuperation / 8).toFixed(2))} j</div>
              <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Solde Récup.</div>
            </div>
          </div>

          <!-- Section Tables Côte-à-Côte -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            <!-- Colonne Gauche : Pointages -->
            <div>
              <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text-primary); border-left: 3px solid var(--color-primary); padding-left: 8px;">
                Derniers Pointages
              </h4>
              <div class="table-container" style="max-height: 180px; overflow-y: auto; margin-top: 0; border-radius: var(--radius-sm);">
                <table class="custom-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Entrée</th>
                      <th>Sortie</th>
                      <th>Travail</th>
                      <th>Retard</th>
                      <th>H. Supp</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pointages.length === 0 ? `
                      <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Aucun pointage</td></tr>
                    ` : pointages.slice(-5).reverse().map(p => `
                      <tr>
                        <td>${formatDateFR(p.date)}</td>
                        <td>${p.heure_entree || '--:--'}</td>
                        <td>${p.heure_sortie || '--:--'}</td>
                        <td>${p.heures_travaillees ? p.heures_travaillees + 'h' : '--'}</td>
                        <td><span style="color: ${p.retard > 0 ? 'var(--color-warning)' : 'inherit'}">${p.retard > 0 ? p.retard + 'm' : '-'}</span></td>
                        <td><span style="color: ${p.heures_supp > 0 ? 'var(--color-success)' : 'inherit'}">${p.heures_supp > 0 ? '+' + p.heures_supp + 'h' : '-'}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Colonne Droite : Récupérations -->
            <div>
              <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text-primary); border-left: 3px solid var(--color-warning); padding-left: 8px;">
                Historique de Récupérations
              </h4>
              <div class="table-container" style="max-height: 180px; overflow-y: auto; margin-top: 0; border-radius: var(--radius-sm);">
                <table class="custom-table" style="font-size: 0.75rem;">
                  <thead>
                    <tr>
                      <th>Date Demande</th>
                      <th>Date Prise</th>
                      <th>Durée</th>
                      <th>Motif</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recups.length === 0 ? `
                      <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Aucune demande</td></tr>
                    ` : recups.slice(-5).reverse().map(r => `
                      <tr>
                        <td>${formatDateFR(r.date_demande)}</td>
                        <td>${formatDateFR(r.date_debut)}</td>
                        <td>${parseFloat((r.duree / 8).toFixed(2))} j</td>
                        <td>${escapeHtml(r.motif)}</td>
                        <td><span class="badge ${r.statut === 'Approuvé' ? 'success' : (r.statut === 'Refusé' ? 'danger' : 'warning')}">${escapeHtml(r.statut)}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      openModal(
        `Fiche Employé : ${emp.prenom} ${emp.nom} (Matricule: ${matricule})`,
        bodyHtml,
        null,
        `
        <div style="display: flex; gap: 8px; justify-content: flex-end; width: 100%;">
          <button class="btn btn-secondary" id="btn-modal-action-abs" style="border: 1px solid var(--border-color); background-color: var(--bg-secondary); font-size: 0.85rem; font-weight: 700; height: 38px;">Saisir Absence</button>
          <button class="btn btn-secondary" id="btn-modal-action-rec" style="border: 1px solid var(--border-color); background-color: var(--bg-secondary); font-size: 0.85rem; font-weight: 700; height: 38px;">Ajuster Récup.</button>
          <button class="btn btn-primary" id="btn-modal-close-only" style="font-size: 0.85rem; font-weight: 700; height: 38px;">Fermer</button>
        </div>
        `
      );

      document.getElementById('btn-modal-close-only').addEventListener('click', closeModal);

      document.getElementById('btn-modal-action-abs').addEventListener('click', () => {
        closeModal();
        AbsencesComponent.showRequestModal(matricule);
      });

      document.getElementById('btn-modal-action-rec').addEventListener('click', () => {
        closeModal();
        RecuperationComponent.showAdjustBalanceModal(matricule);
      });
    } catch (err) {
      toast(err.message, 'danger');
    }
  }
};
