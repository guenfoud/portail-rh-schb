import { api } from '../api.js';
import { openModal, closeModal, renderTimePicker, getTimePickerValue, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR, exportToExcel } from '../utils.js';

function formatTime24h(rawTime) {
  if (!rawTime) return '';
  let str = String(rawTime).trim().toUpperCase();
  
  // Supprimer la date si elle est présente (séparée par un espace)
  const parts = str.split(/\s+/);
  let timePart = '';
  let ampmPart = '';
  
  parts.forEach(p => {
    if (p.includes(':')) {
      timePart = p;
    }
    if (p === 'AM' || p === 'PM') {
      ampmPart = p;
    }
  });
  
  if (!timePart) return '';
  
  const timeSubparts = timePart.split(':');
  let hours = parseInt(timeSubparts[0], 10);
  let minutes = parseInt(timeSubparts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes)) return '';
  
  if (ampmPart === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampmPart === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}


export const PointageComponent = {
  title: 'Gestion des Pointages',
  subtitle: 'Importation des données de pointeuse et journal de présence',
  importedData: [],

  async render() {
    let pointages = [];
    let employees = [];

    try {
      pointages = await api.getPointages();
      employees = await api.getEmployees();
    } catch (e) {
      console.error(e);
    }

    const now = new Date();
    const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return `
      <div class="tab-container">
        <!-- Tabs Buttons -->
        <div style="display: flex; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <button class="btn btn-secondary tab-btn active" data-tab="journal">Journal des Pointages</button>
          <button class="btn btn-secondary tab-btn" data-tab="import">Importer Pointeuse (Excel/CSV)</button>
          <button class="btn btn-secondary tab-btn" data-tab="mensuel">Fiche Mensuelle & Heures Supp</button>
          <button class="btn btn-secondary tab-btn" data-tab="recap">Récap Paye (Mouvement Personnel)</button>
        </div>

        <!-- TAB: JOURNAL -->
        <div id="tab-content-journal" class="tab-content">
          <div class="search-bar-container card" style="padding: 16px 24px;">
            <div style="display: flex; gap: 10px; flex: 1; align-items: center; flex-wrap: wrap;">
              <div class="search-input-wrapper">
                <i data-lucide="search"></i>
                <input type="text" id="journal-search" class="form-control" placeholder="Nom ou matricule...">
              </div>
              <input type="date" id="journal-date-filter" class="form-control" style="width: 170px;" value="${defaultDate}">
              <button type="button" class="btn btn-secondary" id="btn-journal-today" style="padding: 6px 12px; font-size: 0.85rem;" title="Filtrer sur la date d'aujourd'hui">Aujourd'hui</button>
              <button type="button" class="btn btn-secondary" id="btn-journal-all" style="padding: 6px 12px; font-size: 0.85rem;" title="Afficher toutes les dates">Toutes</button>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary" id="btn-add-pointage-manual">
                <i data-lucide="plus"></i>
                Saisie Manuelle
              </button>
              <button class="btn btn-secondary" id="btn-add-pointage-weekly" style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="calendar"></i>
                Saisie Hebdomadaire
              </button>
              <button class="btn btn-secondary" id="btn-export-journal" style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="file-spreadsheet"></i>
                Exporter
              </button>
            </div>
          </div>

          <div class="card" style="padding: 0; overflow: hidden; margin-top: 20px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <div style="padding: 14px 20px; background: #ffffff; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h4 style="margin: 0; font-weight: 700; font-size: 0.95rem; color: #0f172a;">Pointages Enregistrés</h4>
                <span class="badge secondary" id="journal-count-badge">Chargement...</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                <i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--color-success);"></i>
                Horodatage conforme aux fiches de pointage
              </div>
            </div>
            <div class="table-container" style="margin-top: 0; border: none;">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Date</th>
                    <th>Entrée</th>
                    <th>Sortie</th>
                    <th>Durée</th>
                    <th>Retard</th>
                    <th>Heures Supp</th>
                    <th>Shift</th>
                    <th>Statut</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="journal-list-body">
                  <!-- Rempli par JS -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB: IMPORT -->
        <div id="tab-content-import" class="tab-content" style="display: none;">
          <div class="card">
            <h3 style="margin-bottom: 8px; font-weight: 700;">Charger un fichier de pointeuse</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 0.9rem;">
              Sélectionnez ou glissez-déposez le fichier Excel (.xlsx, .xls) ou CSV exporté de votre pointeuse.
            </p>
            
            <div class="upload-zone" id="excel-drop-zone">
              <i data-lucide="file-spreadsheet" class="upload-icon" style="width: 48px; height: 48px;"></i>
              <div>
                <p style="font-weight: 600; font-size: 1.05rem;">Glissez votre fichier ici ou cliquez pour parcourir</p>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Fichiers acceptés: .xlsx, .xls, .csv</p>
              </div>
              <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;">
              <button class="btn btn-secondary" onclick="document.getElementById('excel-file-input').click()">Choisir un fichier</button>
            </div>
            
            <!-- Preset & mapping config -->
            <div id="mapping-config-container" class="card" style="margin-top: 24px; display: none; background-color: var(--bg-primary);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 style="font-weight: 700;">Configuration du mapping des colonnes</h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <label for="mapping-preset" style="font-size: 0.8rem; font-weight: bold; color: var(--text-secondary);">Preset :</label>
                  <select id="mapping-preset" class="form-control" style="width: 160px; padding: 4px 8px; font-size: 0.8rem;">
                    <option value="custom">Manuel</option>
                    <option value="zkteco">Pointeuse ZK</option>
                    <option value="suprema">Pointeuse Suprema</option>
                  </select>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                <div class="form-group">
                  <label for="map-matricule">Matricule Employé</label>
                  <select id="map-matricule" class="form-control"></select>
                </div>
                <div class="form-group">
                  <label for="map-date">Date du pointage</label>
                  <select id="map-date" class="form-control"></select>
                </div>
                <div class="form-group">
                  <label for="map-heure">Heure de passage</label>
                  <select id="map-heure" class="form-control"></select>
                </div>
                <div class="form-group">
                  <label for="map-direction">Entrée / Sortie (Optionnel)</label>
                  <select id="map-direction" class="form-control">
                    <option value="">Détection Chronologique</option>
                  </select>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button class="btn btn-secondary" id="btn-save-preset">Enregistrer comme Preset</button>
                <button class="btn btn-primary" id="btn-process-excel">Analyser les données</button>
              </div>
            </div>
          </div>

          <!-- Preview of imported data -->
          <div id="import-preview-container" class="card" style="margin-top: 24px; display: none; padding: 0; overflow: hidden;">
            <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h3 style="font-weight: 700;">Données prêtes à être importées</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem;" id="import-stats-text">0 pointages analysés</p>
              </div>
              <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" id="btn-cancel-import">Annuler</button>
                <button class="btn btn-primary" id="btn-save-import">
                  <i data-lucide="check"></i>
                  Valider et Enregistrer
                </button>
              </div>
            </div>
            <div class="table-container" style="margin-top: 0; border: none; max-height: 400px; overflow-y: auto;">
              <table class="custom-table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom / Statut DB</th>
                    <th>Date</th>
                    <th>Entrée</th>
                    <th>Sortie</th>
                    <th>Shift Détecté</th>
                    <th>Durée Travail</th>
                    <th>Retard</th>
                    <th>H. Supp + Nuit</th>
                    <th>Anomalie</th>
                  </tr>
                </thead>
                <tbody id="import-preview-body">
                  <!-- Rempli par le parser -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB: MENSUEL -->
        <div id="tab-content-mensuel" class="tab-content" style="display: none;">
          <div class="search-bar-container card" style="padding: 16px 24px; display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 16px; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="mensuel-emp-select">Employé</label>
              <select id="mensuel-emp-select" class="form-control">
                <option value="">Sélectionner un employé...</option>
                ${employees.map(e => `<option value="${e.matricule}">${e.matricule} - ${e.prenom} ${e.nom}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group" style="margin-bottom: 0;">
              <label for="mensuel-mois">Mois</label>
              <select id="mensuel-mois" class="form-control">
                <option value="1">Janvier</option><option value="2">Février</option><option value="3">Mars</option>
                <option value="4">Avril</option><option value="5">Mai</option><option value="6">Juin</option>
                <option value="7" selected>Juillet</option><option value="8">Août</option><option value="9">Septembre</option>
                <option value="10">Octobre</option><option value="11">Novembre</option><option value="12">Décembre</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label for="mensuel-annee">Année</label>
              <select id="mensuel-annee" class="form-control">
                <option value="2026" selected>2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <button class="btn btn-primary" id="btn-search-mensuel" style="height: 48px;">Calculer la fiche</button>
          </div>

          <!-- Monthly summary sheet content -->
          <div id="mensuel-results-container" class="card" style="margin-top: 24px; display: none;">
            <!-- Rempli dynamiquement -->
          </div>
        </div>

        <!-- TAB: RECAP PAYE -->
        <div id="tab-content-recap" class="tab-content" style="display: none;">
          <div class="search-bar-container card" style="padding: 16px 24px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 16px; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label for="recap-mois">Mois</label>
              <select id="recap-mois" class="form-control">
                <option value="1">Janvier</option><option value="2">Février</option><option value="3">Mars</option>
                <option value="4">Avril</option><option value="5">Mai</option><option value="6">Juin</option>
                <option value="7" selected>Juillet</option><option value="8">Août</option><option value="9">Septembre</option>
                <option value="10">Octobre</option><option value="11">Novembre</option><option value="12">Décembre</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label for="recap-annee">Année</label>
              <select id="recap-annee" class="form-control">
                <option value="2026" selected>2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <button class="btn btn-primary" id="btn-search-recap" style="height: 48px;">Générer le Mouvement Personnel</button>
          </div>

          <!-- Recap summary sheet content -->
          <div id="recap-results-container" class="card" style="margin-top: 24px; display: none; overflow-x: auto;">
            <!-- Rempli dynamiquement -->
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // Navigation des onglets
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const targetTab = e.target.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.getElementById(`tab-content-${targetTab}`).style.display = 'block';

        if (targetTab === 'journal') {
          this.refreshJournalList();
        }
      });
    });

    // Événements journal
    const searchInput = document.getElementById('journal-search');
    const dateFilter = document.getElementById('journal-date-filter');
    const btnManualAdd = document.getElementById('btn-add-pointage-manual');
    const btnWeeklyAdd = document.getElementById('btn-add-pointage-weekly');

    const btnJournalToday = document.getElementById('btn-journal-today');
    const btnJournalAll = document.getElementById('btn-journal-all');

    if (searchInput) searchInput.addEventListener('keyup', () => this.refreshJournalList());
    if (dateFilter) dateFilter.addEventListener('change', () => this.refreshJournalList());
    if (btnJournalToday) {
      btnJournalToday.addEventListener('click', () => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (dateFilter) dateFilter.value = todayStr;
        this.refreshJournalList();
      });
    }
    if (btnJournalAll) {
      btnJournalAll.addEventListener('click', () => {
        if (dateFilter) dateFilter.value = '';
        this.refreshJournalList();
      });
    }
    if (btnManualAdd) btnManualAdd.addEventListener('click', () => this.showPointageFormModal());
    if (btnWeeklyAdd) btnWeeklyAdd.addEventListener('click', () => this.showWeeklyPointageFormModal());

    await this.refreshJournalList();

    // Événements upload
    const dropZone = document.getElementById('excel-drop-zone');
    const fileInput = document.getElementById('excel-file-input');

    if (dropZone && fileInput) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          fileInput.files = e.dataTransfer.files;
          this.handleExcelFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleExcelFile(e.target.files[0]);
        }
      });
    }

    // Preset selector
    const presetSelect = document.getElementById('mapping-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));
    }

    const btnSavePreset = document.getElementById('btn-save-preset');
    if (btnSavePreset) {
      btnSavePreset.addEventListener('click', () => this.saveCustomPreset());
    }

    // Événement mensuel
    const btnSearchMensuel = document.getElementById('btn-search-mensuel');
    if (btnSearchMensuel) {
      btnSearchMensuel.addEventListener('click', () => this.calculateMonthlySheet());
    }

    // Événement récap paye
    const btnSearchRecap = document.getElementById('btn-search-recap');
    if (btnSearchRecap) {
      btnSearchRecap.addEventListener('click', () => this.calculatePayrollRecap());
    }

    const btnExportJournal = document.getElementById('btn-export-journal');
    if (btnExportJournal) {
      btnExportJournal.addEventListener('click', () => this.exportJournal());
    }
  },

  async exportJournal() {
    const query = document.getElementById('journal-search')?.value.toLowerCase().trim() || '';
    const dateVal = document.getElementById('journal-date-filter')?.value || '';

    try {
      let list = await api.getPointages(dateVal);
      const employees = await api.getEmployees();

      if (query) {
        list = list.filter(p => {
          const emp = employees.find(e => e.matricule === p.matricule);
          return p.matricule.includes(query) ||
                 (emp && (emp.nom.toLowerCase().includes(query) || emp.prenom.toLowerCase().includes(query)));
        });
      }
      list.sort((a, b) => a.matricule.localeCompare(b.matricule));

      const rows = list.map(p => {
        const emp = employees.find(e => e.matricule === p.matricule);
        return {
          'Matricule': p.matricule,
          'Nom & Prénom': emp ? `${emp.prenom} ${emp.nom}` : 'Ex-employé',
          'Date': formatDateFR(p.date),
          'Entrée': p.heure_entree || '',
          'Sortie': p.heure_sortie || '',
          'Durée Travail (h)': p.heures_travaillees || 0,
          'Retard (min)': p.retard || 0,
          'Heures Supp (h)': p.heures_supp || 0,
          'Type Shift': p.shift_type,
          'Anomalie': p.anomalie ? 'Oui' : 'Non',
          'Notes': p.notes || ''
        };
      });
      exportToExcel(`Journal_Pointages_${dateVal || 'tous'}`, rows, 'Pointages');
    } catch (err) {
      toast(`Erreur export: ${err.message}`, 'danger');
    }
  },

  async refreshJournalList() {
    const query = document.getElementById('journal-search')?.value.toLowerCase().trim() || '';
    const dateVal = document.getElementById('journal-date-filter')?.value || '';

    let list = [];
    let employees = [];

    try {
      list = await api.getPointages(dateVal);
      employees = await api.getEmployees();
    } catch (e) {
      console.error(e);
    }

    if (query) {
      list = list.filter(p => {
        const emp = employees.find(e => e.matricule === p.matricule);
        return p.matricule.includes(query) || 
               (emp && (emp.nom.toLowerCase().includes(query) || emp.prenom.toLowerCase().includes(query)));
      });
    }

    list.sort((a, b) => a.matricule.localeCompare(b.matricule));

    const countBadge = document.getElementById('journal-count-badge');
    if (countBadge) {
      countBadge.textContent = `${list.length} pointage${list.length > 1 ? 's' : ''}`;
    }

    const tbody = document.getElementById('journal-list-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 48px 20px;">
            <div class="table-empty-state">
              <div class="table-empty-icon"><i data-lucide="clock" style="width: 24px; height: 24px;"></i></div>
              <div class="table-empty-title">Aucun pointage trouvé</div>
              <div class="table-empty-desc">Aucune entrée enregistrée pour la date ou les filtres sélectionnés.</div>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = list.map(p => {
      const emp = employees.find(e => e.matricule === p.matricule);
      const initials = emp ? `${(emp.prenom && emp.prenom[0] ? emp.prenom[0] : '').toUpperCase()}${(emp.nom && emp.nom[0] ? emp.nom[0] : '').toUpperCase()}` : 'EX';
      const empName = emp ? `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}` : 'Ex-employé';
      const dept = emp ? emp.departement : 'Inconnu';

      let statusBadge = `<span class="badge success"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Conforme</span>`;
      if (p.anomalie) {
        statusBadge = `<span class="badge danger"><i data-lucide="alert-circle" style="width: 12px; height: 12px;"></i> Incomplet</span>`;
      } else if (p.retard > 0) {
        statusBadge = `<span class="badge warning"><i data-lucide="clock" style="width: 12px; height: 12px;"></i> Retard</span>`;
      }

      return `
        <tr data-id="${p.id}">
          <td style="font-weight: 700; color: var(--color-primary);">${p.matricule}</td>
          <td>
            <div class="table-user-cell">
              <div class="table-avatar">${initials}</div>
              <div class="table-user-info">
                <span class="table-user-name">${empName}</span>
                <span class="table-user-sub">${escapeHtml(dept)}</span>
              </div>
            </div>
          </td>
          <td style="color: var(--text-secondary);">${formatDateFR(p.date)}</td>
          <td>
            <span style="font-weight: 600; background: #f0fdf4; color: #166534; padding: 2px 7px; border-radius: 4px; border: 1px solid #bbf7d0; font-size: 0.82rem;">
              ${p.heure_entree || '--:--'}
            </span>
          </td>
          <td>
            <span style="font-weight: 600; background: #eff6ff; color: #1e40af; padding: 2px 7px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 0.82rem;">
              ${p.heure_sortie || '--:--'}
            </span>
          </td>
          <td style="font-weight: 600;">${p.heures_travaillees ? p.heures_travaillees + ' h' : '<span style="color: #94a3b8;">--</span>'}</td>
          <td>${p.retard > 0 ? `<span class="badge warning">+${p.retard} min</span>` : '<span style="color: #94a3b8;">-</span>'}</td>
          <td>${p.heures_supp > 0 ? `<span class="badge success">+${p.heures_supp} h</span>` : '<span style="color: #94a3b8;">-</span>'}</td>
          <td><span class="badge primary">${escapeHtml(p.shift_type || 'standard')}</span></td>
          <td>${statusBadge}</td>
          <td style="text-align: right; white-space: nowrap;">
            <div class="table-actions">
              <button class="btn-icon btn-edit-pointage" data-id="${p.id}" title="Corriger">
                <i data-lucide="edit-2"></i>
              </button>
              <button class="btn-icon btn-delete-pointage" data-id="${p.id}" style="color: var(--color-danger);" title="Supprimer">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll('.btn-edit-pointage').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.showPointageFormModal(id);
      });
    });

    document.querySelectorAll('.btn-delete-pointage').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ok = await confirmDialog("Supprimer ce pointage ?", { danger: true });
        if (ok) {
          try {
            await api.deletePointage(id);
            await this.refreshJournalList();
            toast('Pointage supprimé.', 'success');
          } catch (err) {
            toast(err.message, 'danger');
          }
        }
      });
    });
  },

  async showPointageFormModal(id = null) {
    const isEdit = id !== null;
    let p = null;
    let employees = [];

    try {
      employees = await api.getEmployees();
      if (isEdit) {
        const pointages = await api.getPointages();
        p = pointages.find(pt => pt.id === id);
      }
    } catch (err) {
      console.error(err);
    }

    const title = isEdit ? "Corriger Pointage" : "Saisir un pointage manuel";

    const empForEdit = isEdit && p ? employees.find(e => e.matricule === p.matricule) : null;
    const empName = empForEdit ? `${empForEdit.prenom} ${empForEdit.nom}` : '';

    const bodyHtml = `
      <form id="pointage-form" style="display: flex; flex-direction: column; gap: 16px;">
        <input type="hidden" id="p-id" value="${p ? p.id : ''}">
        
        ${isEdit ? `
          <div class="form-group">
            <label for="p-matricule-display">Employé</label>
            <input type="text" class="form-control" id="p-matricule-display" value="${p ? `${p.matricule} - ${empName}` : ''}" disabled>
            <input type="hidden" id="p-matricule" value="${p ? p.matricule : ''}">
          </div>
        ` : `
          <div class="form-group" style="position: relative;">
            <label for="p-search-emp">Rechercher un Employé*</label>
            <input type="text" id="p-search-emp" class="form-control" placeholder="Taper le nom, prénom ou matricule (ex: 130031)..." autocomplete="off" required>
            <input type="hidden" id="p-matricule" required>
            <div id="p-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
          </div>
        `}

        <div class="form-row">
          <div class="form-group">
            <label for="p-date">Date*</label>
            <input type="date" id="p-date" class="form-control" required value="${p ? p.date : new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label for="p-notes">Notes / Motif</label>
            <input type="text" id="p-notes" class="form-control" value="${p ? (p.notes || '') : ''}" placeholder="ex: Correction manuelle, Mission">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Heure d'entrée</label>
            ${renderTimePicker('p-entree', p ? p.heure_entree : '')}
          </div>
          <div class="form-group">
            <label>Heure de sortie</label>
            ${renderTimePicker('p-sortie', p ? p.heure_sortie : '')}
          </div>
        </div>
      </form>
    `;

    openModal(title, bodyHtml, async () => {
      const form = document.getElementById('pointage-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const pointageData = {
        id: document.getElementById('p-id').value || null,
        matricule: document.getElementById('p-matricule').value,
        date: document.getElementById('p-date').value,
        heureEntree: getTimePickerValue('p-entree') || null,
        heureSortie: getTimePickerValue('p-sortie') || null,
        notes: document.getElementById('p-notes').value.trim() || 'Correction Manuelle'
      };

      try {
        await api.saveSinglePointage(pointageData);
        await this.refreshJournalList();
        toast('Pointage enregistré.', 'success');
        return true;
      } catch (err) {
        toast(err.message, 'danger');
        return false;
      }
    });

    // --- LOGIQUE AUTOCOMPLETE ---
    if (!isEdit) {
      const searchInput = document.getElementById('p-search-emp');
      const hiddenInput = document.getElementById('p-matricule');
      const suggestionsDiv = document.getElementById('p-suggestions');

      if (searchInput && hiddenInput && suggestionsDiv) {
        const showSuggestions = (query = '') => {
          const cleanQuery = query.toLowerCase().trim();
          const filtered = employees.filter(e => 
            e.matricule.includes(cleanQuery) || 
            e.nom.toLowerCase().includes(cleanQuery) || 
            e.prenom.toLowerCase().includes(cleanQuery)
          );

          if (filtered.length === 0) {
            suggestionsDiv.innerHTML = `<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem;">Aucun résultat</div>`;
          } else {
            suggestionsDiv.innerHTML = filtered.map(e => `
              <div class="suggestion-item" data-matricule="${escapeHtml(e.matricule)}" data-display="${escapeHtml(`${e.matricule} - ${e.prenom} ${e.nom}`)}"
                   style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; transition: background 0.15s; background-color: var(--bg-secondary); color: var(--text-primary);">
                <strong>${escapeHtml(e.matricule)}</strong> - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}
              </div>
            `).join('');
          }
          suggestionsDiv.style.display = 'block';

          // Traduction RTL si Arabe
          const currentLang = localStorage.getItem('gica_lang') || 'fr';
          if (currentLang === 'ar') {
            suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
              item.style.textAlign = 'right';
            });
          }

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
      }
    }
  },

  async showWeeklyPointageFormModal() {
    let employees = [];
    try {
      employees = await api.getEmployees();
    } catch (err) {
      console.error(err);
    }

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const title = "Saisie mensuelle automatique (Dimanche à Jeudi)";

    const bodyHtml = `
      <form id="weekly-pointage-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group" style="position: relative;">
          <label for="pw-search-emp">Rechercher un Employé*</label>
          <input type="text" id="pw-search-emp" class="form-control" placeholder="Taper le nom, prénom ou matricule (ex: 130031)..." autocomplete="off" required>
          <input type="hidden" id="pw-matricule" required>
          <div id="pw-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="pw-month">Mois*</label>
            <select id="pw-month" class="form-control" required>
              ${[
                {v: 1, n: 'Janvier'}, {v: 2, n: 'Février'}, {v: 3, n: 'Mars'},
                {v: 4, n: 'Avril'}, {v: 5, n: 'Mai'}, {v: 6, n: 'Juin'},
                {v: 7, n: 'Juillet'}, {v: 8, n: 'Août'}, {v: 9, n: 'Septembre'},
                {v: 10, n: 'Octobre'}, {v: 11, n: 'Novembre'}, {v: 12, n: 'Décembre'}
              ].map(m => `<option value="${m.v}" ${m.v === currentMonth ? 'selected' : ''}>${m.n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="pw-year">Année*</label>
            <select id="pw-year" class="form-control" required>
              ${[2024, 2025, 2026, 2027, 2028].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="pw-notes">Notes / Motif</label>
            <input type="text" id="pw-notes" class="form-control" placeholder="ex: Enregistrement standard" value="Enregistrement">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Heure d'entrée standard</label>
            ${renderTimePicker('pw-entree', '08:00')}
          </div>
          <div class="form-group">
            <label>Heure de sortie standard</label>
            ${renderTimePicker('pw-sortie', '16:00')}
          </div>
        </div>
      </form>
    `;

    openModal(title, bodyHtml, async () => {
      const form = document.getElementById('weekly-pointage-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const matricule = document.getElementById('pw-matricule').value;
      const month = parseInt(document.getElementById('pw-month').value);
      const year = parseInt(document.getElementById('pw-year').value);
      const heureEntree = getTimePickerValue('pw-entree') || null;
      const heureSortie = getTimePickerValue('pw-sortie') || null;
      const notes = document.getElementById('pw-notes').value.trim() || 'Enregistrement';

      const list = [];
      const numDays = new Date(year, month, 0).getDate(); // Nombre de jours dans le mois

      for (let d = 1; d <= numDays; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeek = dateObj.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 4 = Jeudi

        // Si le jour est un Dimanche, Lundi, Mardi, Mercredi ou Jeudi
        if (dayOfWeek >= 0 && dayOfWeek <= 4) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          list.push({
            id: `p_${matricule}_${dateStr}`,
            matricule,
            date: dateStr,
            heureEntree,
            heureSortie,
            notes
          });
        }
      }

      try {
        await api.savePointages(list);
        await this.refreshJournalList();
        toast('Pointages enregistrés.', 'success');
        return true;
      } catch (err) {
        toast(err.message, 'danger');
        return false;
      }
    });

    // --- LOGIQUE AUTOCOMPLETE ---
    const searchInput = document.getElementById('pw-search-emp');
    const hiddenInput = document.getElementById('pw-matricule');
    const suggestionsDiv = document.getElementById('pw-suggestions');

    if (searchInput && hiddenInput && suggestionsDiv) {
      const showSuggestions = (query = '') => {
        const cleanQuery = query.toLowerCase().trim();
        const filtered = employees.filter(e => 
          e.matricule.includes(cleanQuery) || 
          e.nom.toLowerCase().includes(cleanQuery) || 
          e.prenom.toLowerCase().includes(cleanQuery)
        );

        if (filtered.length === 0) {
          suggestionsDiv.innerHTML = `<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem;">Aucun résultat</div>`;
        } else {
          suggestionsDiv.innerHTML = filtered.map(e => `
            <div class="suggestion-item" data-matricule="${escapeHtml(e.matricule)}" data-display="${escapeHtml(`${e.matricule} - ${e.prenom} ${e.nom}`)}"
                 data-start="${escapeHtml(e.horaire_debut)}" data-fin="${escapeHtml(e.horaire_fin)}"
                 style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; transition: background 0.15s; background-color: var(--bg-secondary); color: var(--text-primary);">
              <strong>${escapeHtml(e.matricule)}</strong> - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}
            </div>
          `).join('');
        }
        suggestionsDiv.style.display = 'block';

        // Traduction RTL si Arabe
        const currentLang = localStorage.getItem('gica_lang') || 'fr';
        if (currentLang === 'ar') {
          suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.style.textAlign = 'right';
          });
        }

        suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const mat = e.currentTarget.getAttribute('data-matricule');
            const display = e.currentTarget.getAttribute('data-display');
            const startH = e.currentTarget.getAttribute('data-start') || '08:00';
            const finH = e.currentTarget.getAttribute('data-fin') || '16:00';
            
            hiddenInput.value = mat;
            searchInput.value = display;
            suggestionsDiv.style.display = 'none';

            // Auto-remplir les heures par défaut de l'employé
            const [seH, seM] = startH.split(':');
            const [ssH, ssM] = finH.split(':');
            
            const inH = document.getElementById('pw-entree-h');
            const inM = document.getElementById('pw-entree-m');
            const outH = document.getElementById('pw-sortie-h');
            const outM = document.getElementById('pw-sortie-m');

            if (inH) inH.value = seH;
            if (inM) inM.value = seM;
            if (outH) outH.value = ssH;
            if (outM) outM.value = ssM;
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
    }
  },

  handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (json.length === 0) {
        toast("Fichier vide ou illisible.", 'danger');
        return;
      }

      const headers = json[0];
      this.importedRawRows = json.slice(1);
      this.headersList = headers;

      const mapMatricule = document.getElementById('map-matricule');
      const mapDate = document.getElementById('map-date');
      const mapHeure = document.getElementById('map-heure');
      const mapDirection = document.getElementById('map-direction');

      [mapMatricule, mapDate, mapHeure, mapDirection].forEach(sel => {
        if (sel) {
          sel.innerHTML = '<option value="">Choisir la colonne...</option>';
          headers.forEach((h, idx) => {
            sel.innerHTML += `<option value="${idx}">${escapeHtml(h)}</option>`;
          });
        }
      });

      // Mapping automatique
      headers.forEach((h, idx) => {
        const hLower = String(h).toLowerCase();
        if (hLower.includes('matr') || hLower.includes('id') || hLower.includes('emp') || hLower.includes('code') || hLower.includes('badge')) {
          mapMatricule.value = idx;
        }
        if (hLower.includes('dat') || hLower.includes('jour')) {
          mapDate.value = idx;
        }
        if (hLower.includes('heur') || hLower.includes('temp') || hLower.includes('pass')) {
          mapHeure.value = idx;
        }
        if (hLower.includes('dir') || hLower.includes('sens') || hLower.includes('action') || hLower.includes('type')) {
          mapDirection.value = idx;
        }
      });

      document.getElementById('mapping-config-container').style.display = 'block';
      document.getElementById('btn-process-excel').onclick = () => this.processExcelData();

      // Appliquer le preset sauvegardé par défaut s'il existe
      this.applySavedPreset();
    };
    reader.readAsArrayBuffer(file);
  },

  applySavedPreset() {
    const saved = localStorage.getItem('gica_excel_mapping_preset');
    if (saved) {
      const preset = JSON.parse(saved);
      document.getElementById('map-matricule').value = preset.matricule || '';
      document.getElementById('map-date').value = preset.date || '';
      document.getElementById('map-heure').value = preset.heure || '';
      document.getElementById('map-direction').value = preset.direction || '';
    }
  },

  saveCustomPreset() {
    const preset = {
      matricule: document.getElementById('map-matricule').value,
      date: document.getElementById('map-date').value,
      heure: document.getElementById('map-heure').value,
      direction: document.getElementById('map-direction').value
    };
    localStorage.setItem('gica_excel_mapping_preset', JSON.stringify(preset));
    toast("Mapping sauvegardé comme preset par défaut !", 'success');
  },

  applyPreset(type) {
    if (type === 'zkteco') {
      // Simulation mapping colonnes typiques ZKTeco (Matricule=Col0, Date=Col1, Heure=Col2)
      document.getElementById('map-matricule').value = "0";
      document.getElementById('map-date').value = "1";
      document.getElementById('map-heure').value = "2";
      document.getElementById('map-direction').value = "";
    } else if (type === 'suprema') {
      document.getElementById('map-matricule').value = "0";
      document.getElementById('map-date').value = "1";
      document.getElementById('map-heure').value = "2";
      document.getElementById('map-direction').value = "3";
    }
  },

  async processExcelData() {
    const colMatricule = document.getElementById('map-matricule').value;
    const colDate = document.getElementById('map-date').value;
    const colHeure = document.getElementById('map-heure').value;

    if (colMatricule === '' || colDate === '' || colHeure === '') {
      toast("Veuillez renseigner les colonnes nécessaires.", 'warning');
      return;
    }

    const logsGrouped = {};
    let employees = [];
    try {
      employees = await api.getEmployees();
    } catch (e) {
      console.error(e);
    }

    this.importedRawRows.forEach(row => {
      const matricule = String(row[colMatricule] || '').trim();
      let rawDate = row[colDate];
      let rawHeure = row[colHeure];

      if (!matricule) return;

      let dateStr = '';
      if (typeof rawDate === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(rawDate);
        dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } else if (rawDate) {
        const cleanDate = String(rawDate).trim();
        if (cleanDate.includes('/')) {
          const parts = cleanDate.split('/');
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (cleanDate.includes('-')) {
          dateStr = cleanDate;
        }
      }

      let heureStr = '';
      if (typeof rawHeure === 'number') {
        const timeObj = XLSX.SSF.parse_date_code(rawHeure);
        heureStr = `${String(timeObj.H).padStart(2, '0')}:${String(timeObj.M).padStart(2, '0')}`;
      } else if (rawHeure) {
        heureStr = formatTime24h(rawHeure);
      }

      if (!dateStr || !heureStr) return;

      const key = `${matricule}_${dateStr}`;
      if (!logsGrouped[key]) {
        logsGrouped[key] = { matricule, date: dateStr, passages: [] };
      }
      logsGrouped[key].passages.push(heureStr);
    });

    this.importedData = [];
    const previewBody = document.getElementById('import-preview-body');
    previewBody.innerHTML = '';

    let countPointages = 0;
    const config = await api.getSettings();

    for (const group of Object.values(logsGrouped)) {
      group.passages.sort();
      const entree = group.passages[0];
      const sortie = group.passages.length > 1 ? group.passages[group.passages.length - 1] : null;
      
      const emp = employees.find(e => e.matricule === group.matricule);
      const empName = emp ? `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}` : '<span style="color: var(--color-danger);">Inconnu</span>';

      // Simulation calcul local pour aperçu
      let hours = 0;
      let retard = 0;
      let supp = 0;
      let shiftType = 'standard';
      let isAnomalie = !sortie ? 1 : 0;

      if (emp && entree && sortie) {
        const [hE, mE] = entree.split(':').map(Number);
        const [hS, mS] = sortie.split(':').map(Number);
        let mOut = hS * 60 + mS;
        let mIn = hE * 60 + mE;
        if (mOut < mIn) mOut += 1440; // Nuit à cheval
        
        hours = parseFloat(((mOut - mIn) / 60).toFixed(2));
        
        const [hRef, mRef] = emp.horaire_debut.split(':').map(Number);
        const diffE = mIn - (hRef * 60 + mRef);
        if (diffE > (config?.horaires?.toleranceRetard || 15)) {
          retard = diffE;
        }

        if (hE >= 5 && hE < 7) shiftType = 'matin';
        else if (hE >= 13 && hE < 15) shiftType = 'apresmidi';
        else if (hE >= 21 && hE < 23) shiftType = 'nuit';
      }

      const pointage = {
        matricule: group.matricule,
        date: group.date,
        heureEntree: entree,
        heureSortie: sortie,
        notes: 'Import Pointeuse'
      };

      this.importedData.push(pointage);
      countPointages++;

      previewBody.innerHTML += `
        <tr>
          <td><strong>${escapeHtml(pointage.matricule)}</strong></td>
          <td>${empName}</td>
          <td>${formatDateFR(pointage.date)}</td>
          <td>${pointage.heureEntree || '--:--'}</td>
          <td>${pointage.heureSortie || '--:--'}</td>
          <td><span class="badge primary">${shiftType}</span></td>
          <td>${hours ? hours + ' h' : '--'}</td>
          <td>${retard > 0 ? retard + ' m' : '-'}</td>
          <td>${supp > 0 ? '+' + supp + ' h' : '-'}</td>
          <td><span class="badge ${isAnomalie ? 'danger' : 'success'}">${isAnomalie ? 'Anomalie' : 'Prêt'}</span></td>
        </tr>
      `;
    }

    document.getElementById('import-stats-text').innerText = `${countPointages} pointages analysés`;
    document.getElementById('import-preview-container').style.display = 'block';
    
    document.getElementById('btn-save-import').onclick = () => this.saveImportedData();
    document.getElementById('btn-cancel-import').onclick = () => {
      document.getElementById('import-preview-container').style.display = 'none';
      document.getElementById('mapping-config-container').style.display = 'none';
    };
  },

  async saveImportedData() {
    if (this.importedData.length === 0) return;

    try {
      const res = await api.savePointages(this.importedData);
      toast(`${res.count} pointages ont été enregistrés avec succès dans SQLite !`, 'success');

      document.getElementById('import-preview-container').style.display = 'none';
      document.getElementById('mapping-config-container').style.display = 'none';

      document.querySelector('.tab-btn[data-tab="journal"]').click();
    } catch (err) {
      toast(`Erreur d'importation: ${err.message}`, 'danger');
    }
  },

  async calculateMonthlySheet() {
    const matricule = document.getElementById('mensuel-emp-select').value;
    const mois = Number(document.getElementById('mensuel-mois').value);
    const annee = Number(document.getElementById('mensuel-annee').value);

    const container = document.getElementById('mensuel-results-container');
    if (!matricule) {
      toast("Veuillez sélectionner un employé.", 'warning');
      return;
    }

    try {
      const emp = await api.getEmployee(matricule);
      const allPointages = await api.getPointages(null, matricule);

      // Filtrer
      const pointagesMois = allPointages.filter(p => {
        const cleanDate = String(p.date || '').split('T')[0];
        const [pY, pM] = cleanDate.split('-').map(Number);
        return pY === annee && pM === mois;
      });

      pointagesMois.sort((a, b) => a.date.localeCompare(b.date));

      const joursTravailles = pointagesMois.filter(p => p.heure_entree && !p.anomalie).length;
      const minutesRetard = pointagesMois.reduce((sum, p) => sum + (p.retard || 0), 0);
      const heuresTravaillees = pointagesMois.reduce((sum, p) => sum + (p.heures_travaillees || 0), 0);
      const heuresSuppCumulees = pointagesMois.reduce((sum, p) => sum + (p.heures_supp || 0), 0);
      const anomaliesCount = pointagesMois.filter(p => p.anomalie).length;

      container.style.display = 'block';
      
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div>
            <h3 style="font-weight: 800; font-size: 1.25rem; color: var(--color-secondary);">Rapport Mensuel : ${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Mois : ${document.getElementById('mensuel-mois').options[mois-1].text} ${annee} | Matricule: ${escapeHtml(matricule)}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="btn-print-mensuel">
              <i data-lucide="printer"></i> Imprimer / PDF
            </button>
            <button class="btn btn-secondary" id="btn-export-mensuel-csv">
              <i data-lucide="download"></i> Exporter CSV
            </button>
            ${heuresSuppCumulees > 0 ? `
              <button class="btn btn-primary" id="btn-crediter-recup" data-heures="${heuresSuppCumulees}">
                <i data-lucide="award"></i> Créditer Récupérations (+${parseFloat((heuresSuppCumulees / 8).toFixed(2))}j)
              </button>
            ` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; text-align: center;">
          <div style="background-color: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-primary);">${joursTravailles}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">Jours Travaillés</div>
          </div>
          <div style="background-color: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-primary);">${heuresTravaillees.toFixed(1)} h</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">Total Heures</div>
          </div>
          <div style="background-color: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.1); padding: 16px; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-warning);">${minutesRetard} min</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">Retard Total</div>
          </div>
          <div style="background-color: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 16px; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-success);">${parseFloat((heuresSuppCumulees / 8).toFixed(2))} j</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">Récupération (jours)</div>
          </div>
          <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 16px; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-danger);">${anomaliesCount}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">Anomalies</div>
          </div>
        </div>

        <h4 style="margin-bottom: 12px; font-weight: 700;">Journal de Présence Détaillé</h4>
        <div class="table-container" style="margin-top: 0;">
          <table class="custom-table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Durée Travail</th>
                <th>Retard</th>
                <th>Heures Supp</th>
                <th>Shift</th>
                <th>Notes / Justification</th>
              </tr>
            </thead>
            <tbody>
              ${pointagesMois.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; color: var(--text-muted);">Aucun pointage ce mois-ci.</td></tr>
              ` : pointagesMois.map(p => `
                <tr>
                  <td><strong>${formatDateFR(p.date)}</strong></td>
                  <td>${p.heure_entree || '--:--'}</td>
                  <td>${p.heure_sortie || '--:--'}</td>
                  <td>${p.heures_travaillees ? p.heures_travaillees + ' h' : '--'}</td>
                  <td><span style="color: ${p.retard > 0 ? 'var(--color-warning)' : 'inherit'}">${p.retard > 0 ? p.retard + ' min' : '-'}</span></td>
                  <td><span style="color: ${p.heures_supp > 0 ? 'var(--color-success)' : 'inherit'}">${p.heures_supp > 0 ? '+' + p.heures_supp + ' h' : '-'}</span></td>
                  <td><span class="badge primary">${escapeHtml(p.shift_type || 'standard')}</span></td>
                  <td style="color: var(--text-secondary); font-style: italic;">${escapeHtml(p.notes || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Listeners
      const btnCrediter = document.getElementById('btn-crediter-recup');
      if (btnCrediter) {
        btnCrediter.addEventListener('click', (e) => {
          const heures = parseFloat(e.currentTarget.getAttribute('data-heures'));
          this.creditHoursToRecovery(emp, mois, annee, heures);
        });
      }

      document.getElementById('btn-export-mensuel-csv').addEventListener('click', () => {
        this.exportMonthlySheetToCSV(emp, pointagesMois);
      });

      document.getElementById('btn-print-mensuel').addEventListener('click', () => {
        window.print(); // Déclenche l'aperçu avant impression PDF stylisé
      });

    } catch (err) {
      toast(`Erreur de calcul: ${err.message}`, 'danger');
    }
  },

  async creditHoursToRecovery(employee, mois, annee, heures) {
    const jours = parseFloat((heures / 8).toFixed(2));
    const ok = await confirmDialog(`Voulez-vous ajouter ${jours} jours de récupération à ${employee.prenom} ${employee.nom} au titre des heures supplémentaires du mois ${mois}/${annee} ?`, { danger: false });
    if (ok) {
      try {
        const motif = `Crédit Heures Supp. validées (${mois}/${annee})`;
        await api.creditRecuperation(employee.matricule, heures, motif);
        toast(`Le solde de l'employé a été mis à jour (+${jours}j) !`, 'success');
        await this.calculateMonthlySheet();
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
  },

  exportMonthlySheetToCSV(employee, pointages) {
    let csv = `Date,Entree,Sortie,Duree Travail,Retard,Heures Supp,Shift,Notes\r\n`;
    pointages.forEach(p => {
      csv += `"${p.date}","${p.heure_entree || ''}","${p.heure_sortie || ''}","${p.heures_travaillees || ''}","${p.retard || ''}","${p.heures_supp || ''}","${p.shift_type || ''}","${p.notes || ''}"\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Fiche_Mensuelle_${employee.matricule}_${employee.nom}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async calculatePayrollRecap() {
    const mois = Number(document.getElementById('recap-mois').value);
    const annee = Number(document.getElementById('recap-annee').value);
    const container = document.getElementById('recap-results-container');

    container.style.display = 'block';
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <div style="width: 30px; height: 30px; border: 3px solid rgba(124, 58, 237, 0.2); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px auto;"></div>
        Calcul et génération du Mouvement Personnel...
      </div>
    `;

    try {
      const employees = await api.getEmployees();
      const allPointages = await api.getPointages();
      const allAbsences = await api.getAbsences();

      // Filtrer les pointages du mois
      const pointagesMois = allPointages.filter(p => {
        const cleanDate = String(p.date || '').split('T')[0];
        const [pY, pM] = cleanDate.split('-').map(Number);
        return pY === annee && pM === mois;
      });

      // Filtrer les absences approuvées
      const absencesApprouvees = allAbsences.filter(a => a.statut === 'Approuvé');

      // Fonction helper pour calculer les absences d'un employé qui tombent dans ce mois
      const getAbsenceDaysInMonth = (abs, y, m) => {
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd = new Date(Date.UTC(y, m, 0));
        
        const absStart = new Date(abs.date_debut);
        const absFin = new Date(abs.date_fin);
        
        let count = 0;
        let curr = new Date(absStart);
        while (curr <= absFin) {
          if (curr >= monthStart && curr <= monthEnd) {
            count++;
          }
          curr.setDate(curr.getDate() + 1);
        }
        
        const totalCalendarDays = Math.round((absFin - absStart) / (1000 * 60 * 60 * 24)) + 1;
        if (totalCalendarDays <= 0) return 0;
        
        const ratio = count / totalCalendarDays;
        return parseFloat((abs.duree_jours * ratio).toFixed(2));
      };

      // Fonction helper pour parser les notes des heures supp
      const parseOvertimeNotes = (notesStr) => {
        let hs50 = 0;
        let hs75 = 0;
        let hs100 = 0;
        if (!notesStr) return { hs50, hs75, hs100 };
        const matches = notesStr.matchAll(/([\d.]+)\s*H\s*x\s*(50|75|100)\s*%/g);
        for (const match of matches) {
          const val = parseFloat(match[1]);
          const pct = match[2];
          if (pct === '50') hs50 += val;
          else if (pct === '75') hs75 += val;
          else if (pct === '100') hs100 += val;
        }
        return { hs50, hs75, hs100 };
      };

      // Construire les lignes de données par employé
      const recapData = employees.map(emp => {
        const empPointages = pointagesMois.filter(p => p.matricule === emp.matricule);
        const empAbsences = absencesApprouvees.filter(a => a.matricule === emp.matricule);

        // Sum absences by type
        let ca = 0; // Annuel
        let cm = 0; // Maladie
        let mat = 0; // Maternité
        let css = 0; // Sans solde
        let ce = 0; // Spécial

        empAbsences.forEach(abs => {
          const days = getAbsenceDaysInMonth(abs, annee, mois);
          if (abs.type_conge === 'Annuel') ca += days;
          else if (abs.type_conge === 'Maladie') cm += days;
          else if (abs.type_conge === 'Maternité') mat += days;
          else if (abs.type_conge === 'Sans Solde') css += days;
          else if (abs.type_conge === 'Spécial') ce += days;
        });

        // Sum overtime and night premium hours
        let hs50 = 0;
        let hs75 = 0;
        let hs100 = 0;
        let pn = 0; // Prime Nuit (heures de nuit)
        let pp = 0; // Prime Panier (jours travaillés)

        empPointages.forEach(p => {
          const splits = parseOvertimeNotes(p.notes);
          hs50 += splits.hs50;
          hs75 += splits.hs75;
          hs100 += splits.hs100;

          // Prime de Nuit
          const nightMatch = p.notes ? p.notes.match(/([\d.]+)\s*H\s*x\s*125\s*%/) : null;
          if (nightMatch) {
            pn += parseFloat(nightMatch[1]);
          }

          // Prime Panier
          if (p.heure_entree && !p.anomalie) {
            pp++;
          }
        });

        return {
          matricule: escapeHtml(emp.matricule),
          nom: escapeHtml(emp.nom),
          prenom: escapeHtml(emp.prenom),
          ca: ca || '-',
          cm: cm || '-',
          mat: mat || '-',
          css: css || '-',
          ce: ce || '-',
          pn: pn || '-',
          pp: pp || '-',
          hs50: hs50 || '-',
          hs75: hs75 || '-',
          hs100: hs100 || '-'
        };
      });

      const nomMois = document.getElementById('recap-mois').options[mois-1].text;

      // Afficher dans l'interface
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div>
            <h3 style="font-weight: 800; font-size: 1.25rem; color: var(--color-secondary);">Mouvement Personnel - Récapitulatif de Paie</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">Période : ${nomMois} ${annee}</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" id="btn-excel-recap-action" style="display: flex; align-items: center; gap: 8px; background-color: #16a34a; border-color: #16a34a; color: #fff;">
              <i data-lucide="file-spreadsheet"></i> Exporter Excel (XLSX)
            </button>
            <button class="btn btn-primary" id="btn-print-recap-action" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="printer"></i> Imprimer la Récap (PDF)
            </button>
          </div>
        </div>

        <div class="table-container" style="margin-top: 0; overflow-x: auto;">
          <table class="custom-table" style="font-size: 0.8rem; text-align: center;">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th title="Congé Annuel">CA</th>
                <th title="Congé Maladie">CM</th>
                <th title="Congé de Maternité">Maternité</th>
                <th title="Sans Solde">CSS</th>
                <th title="Congé Exceptionnel / Spécial">CE</th>
                <th title="Prime de Nuit (heures)">PN</th>
                <th title="Prime Panier (jours)">PP</th>
                <th>HS 50%</th>
                <th>HS 75%</th>
                <th>HS 100%</th>
              </tr>
            </thead>
            <tbody>
              ${recapData.map(row => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-primary);">${row.matricule}</td>
                  <td style="font-weight: 600; text-align: left;">${row.nom}</td>
                  <td style="font-weight: 600; text-align: left;">${row.prenom}</td>
                  <td style="color: ${row.ca !== '-' ? 'var(--color-info)' : 'inherit'}; font-weight: ${row.ca !== '-' ? 'bold' : 'normal'};">${row.ca}</td>
                  <td style="color: ${row.cm !== '-' ? 'var(--color-danger)' : 'inherit'}; font-weight: ${row.cm !== '-' ? 'bold' : 'normal'};">${row.cm}</td>
                  <td style="color: ${row.mat !== '-' ? 'var(--color-warning)' : 'inherit'}; font-weight: ${row.mat !== '-' ? 'bold' : 'normal'};">${row.mat}</td>
                  <td>${row.css}</td>
                  <td>${row.ce}</td>
                  <td style="color: ${row.pn !== '-' ? 'var(--color-primary)' : 'inherit'}; font-weight: ${row.pn !== '-' ? 'bold' : 'normal'};">${row.pn}</td>
                  <td style="font-weight: ${row.pp !== '-' ? 'bold' : 'normal'};">${row.pp}</td>
                  <td style="color: ${row.hs50 !== '-' ? 'var(--color-success)' : 'inherit'}; font-weight: ${row.hs50 !== '-' ? 'bold' : 'normal'};">${row.hs50}</td>
                  <td style="color: ${row.hs75 !== '-' ? 'var(--color-success)' : 'inherit'}; font-weight: ${row.hs75 !== '-' ? 'bold' : 'normal'};">${row.hs75}</td>
                  <td style="color: ${row.hs100 !== '-' ? 'var(--color-success)' : 'inherit'}; font-weight: ${row.hs100 !== '-' ? 'bold' : 'normal'};">${row.hs100}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Événement d'impression
      document.getElementById('btn-print-recap-action').addEventListener('click', () => {
        this.printPayrollRecap(recapData, nomMois, annee);
      });

      // Événement d'export Excel
      document.getElementById('btn-excel-recap-action').addEventListener('click', () => {
        this.exportPayrollRecapToExcel(recapData, nomMois, annee);
      });

    } catch (err) {
      toast(`Erreur lors de la génération : ${err.message}`, 'danger');
    }
  },

  printPayrollRecap(data, monthName, year) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast("Veuillez autoriser les fenêtres pop-up pour cette application afin de pouvoir imprimer.", 'warning');
      return;
    }

    const rowsHtml = data.map(row => `
      <tr>
        <td style="font-weight: bold; border: 1px solid #000; font-size: 8pt; padding: 5px;">${row.matricule}</td>
        <td style="text-align: left; border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: bold;">${row.nom}</td>
        <td style="text-align: left; border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: bold;">${row.prenom}</td>
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- AL -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.ca !== '-' ? 'bold' : 'normal'};">${row.ca}</td> <!-- CA -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.cm !== '-' ? 'bold' : 'normal'};">${row.cm}</td> <!-- CM -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- AT -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.css !== '-' ? 'bold' : 'normal'};">${row.css}</td> <!-- CSS + AA -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- MISE EN DISPONIBILITE -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.mat !== '-' ? 'bold' : 'normal'};">${row.mat}</td> <!-- MATERNITE -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- ABSENCE DEB/FIN CONTRAT -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- HEURE ALLAITEMENT -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.ce !== '-' ? 'bold' : 'normal'};">${row.ce}</td> <!-- CE -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- I.F.S.P -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- MP -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.pn !== '-' ? 'bold' : 'normal'};">${row.pn}</td> <!-- PN -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.pp !== '-' ? 'bold' : 'normal'};">${row.pp}</td> <!-- PP -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px;">-</td> <!-- ITP -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.hs50 !== '-' ? 'bold' : 'normal'};">${row.hs50}</td> <!-- 50% -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.hs75 !== '-' ? 'bold' : 'normal'};">${row.hs75}</td> <!-- 75% -->
        <td style="border: 1px solid #000; font-size: 8pt; padding: 5px; font-weight: ${row.hs100 !== '-' ? 'bold' : 'normal'};">${row.hs100}</td> <!-- 100% -->
      </tr>
    `).join('');

    const documentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mouvement Personnel - ${monthName} ${year}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 5mm 10mm 5mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 0;
              color: #000;
              background-color: #fff;
              font-size: 8pt;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .header-table td {
              border: none;
              padding: 0;
              text-align: center;
              vertical-align: middle;
            }
            .title-main {
              font-size: 13pt;
              font-weight: 800;
              letter-spacing: 1.5px;
              margin: 0;
              text-transform: uppercase;
            }
            .title-sub {
              font-size: 11pt;
              font-weight: 700;
              margin: 5px 0 0 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-left {
              text-align: left !important;
              font-weight: bold;
              font-size: 10pt;
            }
            .title-right {
              text-align: right !important;
              font-weight: bold;
              font-size: 10pt;
              text-transform: uppercase;
            }
            .recap-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            }
            .recap-table th {
              border: 1px solid #000;
              background-color: #eaeaea;
              padding: 6px 3px;
              font-size: 7.5pt;
              font-weight: bold;
              text-align: center;
            }
            .recap-table td {
              border: 1px solid #000;
              padding: 5px 3px;
              text-align: center;
              font-size: 8pt;
            }
            .footer-signatures {
              margin-top: 40px;
              width: 100%;
              border-collapse: collapse;
            }
            .footer-signatures td {
              border: none;
              width: 33.3%;
              text-align: center;
              font-weight: bold;
              font-size: 8.5pt;
              padding: 10px;
            }
            .signature-title {
              text-decoration: underline;
              margin-bottom: 60px;
              display: block;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <table class="header-table">
            <tr>
              <td class="title-left" style="width: 25%;">SCHB</td>
              <td style="width: 50%;">
                <h1 class="title-main">Cimenterie Hamma Bouziane</h1>
                <h2 class="title-sub">Mouvement Personnel</h2>
              </td>
              <td class="title-right" style="width: 25%;">${monthName} // ${year}</td>
            </tr>
          </table>

          <table class="recap-table">
            <thead>
              <tr>
                <th style="width: 5%;">Matricule</th>
                <th style="width: 10%; text-align: left;">Nom</th>
                <th style="width: 10%; text-align: left;">Prénom</th>
                <th style="width: 3%;">AL</th>
                <th style="width: 3%;">CA</th>
                <th style="width: 3%;">CM</th>
                <th style="width: 3%;">AT</th>
                <th style="width: 4%;">CSS + AA</th>
                <th style="width: 6%;">Mise en Disponibilité</th>
                <th style="width: 6%;">Congé Maternité</th>
                <th style="width: 7%;">Absence Déb/Fin Contrat</th>
                <th style="width: 6%;">Heure Allaitement</th>
                <th style="width: 3%;">CE</th>
                <th style="width: 4%;">I.F.S.P</th>
                <th style="width: 3%;">MP</th>
                <th style="width: 3%;">PN</th>
                <th style="width: 3%;">PP</th>
                <th style="width: 3%;">ITP</th>
                <th style="width: 4%;">50%</th>
                <th style="width: 4%;">75%</th>
                <th style="width: 4%;">100%</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <table class="footer-signatures">
            <tr>
              <td>
                <span class="signature-title">CADRE ADMINISTRATIF CHARGE G.P</span>
              </td>
              <td>
                <span class="signature-title">CHEF SERVICE G.P</span>
              </td>
              <td>
                <span class="signature-title">CHEF DEPARTEMENT R.H.S</span>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(documentHtml);
    printWindow.document.close();
  },

  exportPayrollRecapToExcel(data, monthName, year) {
    const rowsHtml = data.map(row => `
      <tr style="height: 22px;">
        <td style="border: 0.5pt solid #000000; font-weight: bold; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;">${row.matricule}</td>
        <td style="border: 0.5pt solid #000000; font-weight: bold; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: left; vertical-align: middle;">${row.nom}</td>
        <td style="border: 0.5pt solid #000000; font-weight: bold; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: left; vertical-align: middle;">${row.prenom}</td>
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- AL -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.ca !== '-' ? 'bold' : 'normal'};">${row.ca === '-' ? '' : row.ca}</td> <!-- CA -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.cm !== '-' ? 'bold' : 'normal'};">${row.cm === '-' ? '' : row.cm}</td> <!-- CM -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- AT -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.css !== '-' ? 'bold' : 'normal'};">${row.css === '-' ? '' : row.css}</td> <!-- CSS + AA -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- MISE EN DISPONIBILITE -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.mat !== '-' ? 'bold' : 'normal'};">${row.mat === '-' ? '' : row.mat}</td> <!-- MATERNITE -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- ABSENCE DEB/FIN CONTRAT -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- HEURE ALLAITEMENT -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.ce !== '-' ? 'bold' : 'normal'};">${row.ce === '-' ? '' : row.ce}</td> <!-- CE -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- I.F.S.P -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- MP -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.pn !== '-' ? 'bold' : 'normal'};">${row.pn === '-' ? '' : row.pn}</td> <!-- PN -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.pp !== '-' ? 'bold' : 'normal'};">${row.pp === '-' ? '' : row.pp}</td> <!-- PP -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle;"></td> <!-- ITP -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.hs50 !== '-' ? 'bold' : 'normal'};">${row.hs50 === '-' ? '' : row.hs50}</td> <!-- 50% -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.hs75 !== '-' ? 'bold' : 'normal'};">${row.hs75 === '-' ? '' : row.hs75}</td> <!-- 75% -->
        <td style="border: 0.5pt solid #000000; font-family: Arial, sans-serif; font-size: 8.5pt; text-align: center; vertical-align: middle; font-weight: ${row.hs100 !== '-' ? 'bold' : 'normal'};">${row.hs100 === '-' ? '' : row.hs100}</td> <!-- 100% -->
      </tr>
    `).join('');

    const documentHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <style>
            table { border-collapse: collapse; }
            th, td { font-family: Arial, sans-serif; }
            .title-left { text-align: left; font-weight: bold; font-size: 11pt; font-family: Arial, sans-serif; }
            .title-center { text-align: center; font-weight: bold; font-size: 13pt; font-family: Arial, sans-serif; }
            .title-right { text-align: right; font-weight: bold; font-size: 11pt; font-family: Arial, sans-serif; }
            .header-cell { 
              background-color: #d9d9d9; 
              font-weight: bold; 
              font-size: 7.5pt; 
              text-align: center; 
              vertical-align: middle;
              border: 0.5pt solid #000000;
              font-family: Arial, sans-serif;
            }
            .signature-block {
              font-weight: bold;
              font-size: 9pt;
              text-align: center;
              text-decoration: underline;
              font-family: Arial, sans-serif;
            }
          </style>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Mouvement Personnel</x:Name>
                  <x:WorksheetOptions>
                    <x:Print>
                      <x:ValidPrinterInfo/>
                      <x:PaperSizeIndex>9</x:PaperSizeIndex> <!-- A4 -->
                      <x:HorizontalResolution>600</x:HorizontalResolution>
                      <x:VerticalResolution>600</x:VerticalResolution>
                      <x:GridLines/>
                    </x:Print>
                    <x:PageSetup>
                      <x:Layout x:Orientation="Landscape"/>
                    </x:PageSetup>
                    <x:FitToPage/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body>
          <table>
            <tr style="height: 25px;">
              <td class="title-left" colspan="3">SCHB</td>
              <td class="title-center" colspan="15" rowspan="2">
                <div style="font-size: 13pt; font-weight: bold;">CIMENTERIE HAMMA BOUZIANE</div>
                <div style="font-size: 11pt; font-weight: bold; margin-top: 4px;">MOUVEMENT PERSONNEL</div>
              </td>
              <td class="title-right" colspan="3">${monthName} // ${year}</td>
            </tr>
            <tr style="height: 25px;">
              <td colspan="3"></td>
              <td colspan="3"></td>
            </tr>
            <tr style="height: 15px;"><td colspan="21"></td></tr>
            
            <tr style="height: 30px;">
              <th class="header-cell">Matricule</th>
              <th class="header-cell" style="text-align: left; padding-left: 5px;">Nom</th>
              <th class="header-cell" style="text-align: left; padding-left: 5px;">Prénom</th>
              <th class="header-cell">AL</th>
              <th class="header-cell">CA</th>
              <th class="header-cell">CM</th>
              <th class="header-cell">AT</th>
              <th class="header-cell">CSS + AA</th>
              <th class="header-cell">Mise en Disponibilité</th>
              <th class="header-cell">Congé Maternité</th>
              <th class="header-cell">Absence Déb/Fin Contrat</th>
              <th class="header-cell">Heure Allaitement</th>
              <th class="header-cell">CE</th>
              <th class="header-cell">I.F.S.P</th>
              <th class="header-cell">MP</th>
              <th class="header-cell">PN</th>
              <th class="header-cell">PP</th>
              <th class="header-cell">ITP</th>
              <th class="header-cell">50%</th>
              <th class="header-cell">75%</th>
              <th class="header-cell">100%</th>
            </tr>
            
            ${rowsHtml}
            
            <tr style="height: 20px;"><td colspan="21"></td></tr>
            <tr style="height: 20px;"><td colspan="21"></td></tr>
            
            <tr style="height: 22px;">
              <td colspan="4" class="signature-block">CADRE ADMINISTRATIF CHARGE G.P</td>
              <td colspan="3"></td>
              <td colspan="5" class="signature-block">CHEF SERVICE G.P</td>
              <td colspan="4"></td>
              <td colspan="5" class="signature-block">CHEF DEPARTEMENT R.H.S</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([documentHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Mouvement_Personnel_${monthName}_${year}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
