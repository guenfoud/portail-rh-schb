import { api } from '../api.js';
import { openModal, closeModal, renderTimePicker, getTimePickerValue, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR, exportToExcel } from '../utils.js';
import { renderOfficialHeader, renderOfficialFooter, renderOfficialSeal, wrapInOfficialDocument, printOfficialDocument, LETTERHEAD_ASSETS } from './letterhead.js';

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
  subtitle: 'Saisie manuelle, saisie groupée multi-employés, import pointeuse et journal de présence',
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
              <button class="btn btn-secondary" id="btn-add-pointage-bulk" style="display: flex; align-items: center; gap: 6px;">
                <i data-lucide="users"></i>
                Saisie Groupée
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
    const btnBulkAdd = document.getElementById('btn-add-pointage-bulk');

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
    if (btnBulkAdd) btnBulkAdd.addEventListener('click', () => this.showBulkPointageFormModal());

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

  formatISODate(dateObj) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  },

  // Saisie groupée : plusieurs employés à la fois, soit sur une journée (grille),
  // soit sur un mois complet (jours de semaine choisis).
  async showBulkPointageFormModal() {
    let employees = [];
    try {
      employees = await api.getEmployees();
    } catch (err) {
      console.error(err);
      toast("Impossible de charger la liste des employés.", 'danger');
      return;
    }
    if (!Array.isArray(employees) || employees.length === 0) {
      toast("Aucun employé disponible pour la saisie.", 'warning');
      return;
    }

    const departments = [...new Set(employees.map(e => e.departement).filter(Boolean))].sort();
    const now = new Date();
    const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayValue = this.formatISODate(now);
    const weekdayLabels = [
      { v: 0, n: 'Dim' }, { v: 1, n: 'Lun' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Mer' },
      { v: 4, n: 'Jeu' }, { v: 5, n: 'Ven' }, { v: 6, n: 'Sam' }
    ];

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; gap: 8px; background: var(--bg-primary); padding: 6px; border-radius: 10px; border: 1px solid var(--border-color);">
          <button type="button" id="bulk-mode-month" class="btn btn-primary btn-sm" style="flex: 1;">Mois complet</button>
          <button type="button" id="bulk-mode-day" class="btn btn-secondary btn-sm" style="flex: 1;">Une journée (grille)</button>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: 700; display: block; margin-bottom: 8px;">1. Employés concernés *</label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
            <input type="text" id="bulk-emp-search" class="form-control" autocomplete="off"
                   placeholder="Rechercher : nom, prénom, matricule, poste..." style="flex: 1; min-width: 200px;">
            <select id="bulk-emp-dept" class="form-control" style="width: 200px;">
              <option value="">Tous les départements</option>
              ${departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px;">
            <button type="button" id="bulk-select-all" class="btn btn-secondary btn-sm">Tout sélectionner</button>
            <button type="button" id="bulk-select-none" class="btn btn-secondary btn-sm">Tout désélectionner</button>
            <span id="bulk-emp-count" class="badge secondary">0 employé sélectionné</span>
          </div>
          <div id="bulk-emp-list" style="max-height: 230px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary);">
            ${employees.map(e => `
              <label class="bulk-emp-row"
                     data-search="${escapeHtml(`${e.matricule} ${e.nom || ''} ${e.prenom || ''} ${e.poste || ''}`.toLowerCase())}"
                     data-dept="${escapeHtml(e.departement || '')}"
                     style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; font-size: 0.86rem;">
                <input type="checkbox" class="bulk-emp-checkbox" value="${escapeHtml(e.matricule)}"
                       data-entree="${escapeHtml((e.horaire_debut || '08:00').slice(0, 5))}"
                       data-sortie="${escapeHtml((e.horaire_fin || '16:00').slice(0, 5))}"
                       data-name="${escapeHtml(`${e.prenom || ''} ${e.nom || ''}`.trim())}"
                       style="width: 16px; height: 16px; accent-color: var(--color-primary); flex: 0 0 auto;">
                <span style="display: flex; flex-direction: column; min-width: 0;">
                  <strong style="font-size: 0.85rem;">${escapeHtml((e.nom || '').toUpperCase())} ${escapeHtml(e.prenom || '')}</strong>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">#${escapeHtml(e.matricule)} · ${escapeHtml(e.departement || '-')} · ${escapeHtml(e.poste || '-')}</span>
                </span>
                <span style="margin-left: auto; font-size: 0.75rem; color: var(--text-secondary); font-family: monospace; white-space: nowrap;">
                  ${escapeHtml((e.horaire_debut || '08:00').slice(0, 5))}–${escapeHtml((e.horaire_fin || '16:00').slice(0, 5))}
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <div id="bulk-month-fields" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-weight: 700; display: block; margin-bottom: 8px;">2. Mois et jours travaillés *</label>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
              <input type="month" id="bulk-month" class="form-control" value="${monthValue}" style="width: 200px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${weekdayLabels.map(w => `
                  <label class="bulk-weekday" style="display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem; cursor: pointer;">
                    <input type="checkbox" value="${w.v}" ${w.v <= 4 ? 'checked' : ''} style="accent-color: var(--color-primary);"> ${w.n}
                  </label>
                `).join('')}
              </div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Par défaut dimanche → jeudi (week-end vendredi / samedi).</div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="bulk-month-entree">Heure d'entrée (optionnel)</label>
              <input type="time" id="bulk-month-entree" class="form-control">
            </div>
            <div class="form-group">
              <label for="bulk-month-sortie">Heure de sortie (optionnel)</label>
              <input type="time" id="bulk-month-sortie" class="form-control">
            </div>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: -8px;">
            Laissé vide → l'horaire propre de chaque employé est utilisé.
          </div>

          <div class="form-group">
            <label for="bulk-month-notes">Notes</label>
            <input type="text" id="bulk-month-notes" class="form-control" value="Enregistrement" placeholder="ex: Enregistrement standard">
          </div>

          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
            <input type="checkbox" id="bulk-skip-existing" checked style="width: 16px; height: 16px; accent-color: var(--color-primary);">
            Ne pas écraser les pointages déjà saisis
          </label>

          <div id="bulk-preview" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.83rem; color: var(--text-secondary);">
            Sélectionnez au moins un employé.
          </div>
        </div>

        <div id="bulk-day-fields" style="display: none; flex-direction: column; gap: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-weight: 700; display: block; margin-bottom: 8px;">2. Journée à saisir *</label>
            <input type="date" id="bulk-day-date" class="form-control" value="${todayValue}" style="width: 200px;">
          </div>

          <div style="display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;">
            <div class="form-group" style="margin: 0; width: 140px;">
              <label style="font-size: 0.78rem;">Entrée</label>
              <input type="time" id="bulk-day-entree-all" class="form-control" value="08:00">
            </div>
            <div class="form-group" style="margin: 0; width: 140px;">
              <label style="font-size: 0.78rem;">Sortie</label>
              <input type="time" id="bulk-day-sortie-all" class="form-control" value="16:00">
            </div>
            <button type="button" id="bulk-day-apply-all" class="btn btn-secondary btn-sm" style="height: 38px;">Appliquer à tous</button>
          </div>

          <div style="max-height: 260px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
            <table class="custom-table" style="margin: 0;">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th style="width: 130px;">Entrée</th>
                  <th style="width: 130px;">Sortie</th>
                </tr>
              </thead>
              <tbody id="bulk-day-grid">
                <tr><td colspan="3" style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Sélectionnez des employés pour préparer la grille.</td></tr>
              </tbody>
            </table>
          </div>

          <div id="bulk-day-preview" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.83rem; color: var(--text-secondary);">
            0 pointage prêt.
          </div>
        </div>
      </div>
    `;

    let mode = 'month';

    const getCheckedEmployees = () => Array.from(document.querySelectorAll('#bulk-emp-list .bulk-emp-checkbox:checked')).map(cb => ({
      matricule: cb.value,
      entree: cb.getAttribute('data-entree') || '08:00',
      sortie: cb.getAttribute('data-sortie') || '16:00',
      name: cb.getAttribute('data-name') || cb.value
    }));

    const getSelectedWeekdays = () => Array.from(document.querySelectorAll('.bulk-weekday input:checked'))
      .map(cb => parseInt(cb.value, 10));

    const countSelectedDays = (year, month) => {
      const weekdays = new Set(getSelectedWeekdays());
      const total = new Date(year, month, 0).getDate();
      let count = 0;
      for (let d = 1; d <= total; d++) {
        if (weekdays.has(new Date(year, month - 1, d).getDay())) count++;
      }
      return count;
    };

    const syncDayGrid = () => {
      const grid = document.getElementById('bulk-day-grid');
      if (!grid) return;
      const checked = getCheckedEmployees();
      const checkedIds = new Set(checked.map(c => c.matricule));

      Array.from(grid.querySelectorAll('tr[data-matricule]')).forEach(row => {
        if (!checkedIds.has(row.getAttribute('data-matricule'))) row.remove();
      });

      const presentIds = new Set(Array.from(grid.querySelectorAll('tr[data-matricule]'))
        .map(row => row.getAttribute('data-matricule')));

      checked.forEach(emp => {
        if (presentIds.has(emp.matricule)) return;
        const tr = document.createElement('tr');
        tr.setAttribute('data-matricule', emp.matricule);
        tr.innerHTML = `
          <td style="font-size: 0.83rem;">
            <div style="font-weight: 600;">${escapeHtml(emp.name)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">#${escapeHtml(emp.matricule)}</div>
          </td>
          <td><input type="time" class="form-control bulk-row-entree" style="height: 34px; padding: 2px 8px;" value="${escapeHtml(emp.entree)}"></td>
          <td><input type="time" class="form-control bulk-row-sortie" style="height: 34px; padding: 2px 8px;" value="${escapeHtml(emp.sortie)}"></td>
        `;
        grid.appendChild(tr);
      });

      const emptyRow = grid.querySelector('td[colspan="3"]');
      if (emptyRow && checked.length > 0) emptyRow.closest('tr').remove();
      if (checked.length === 0) {
        grid.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Sélectionnez des employés pour préparer la grille.</td></tr>`;
      }
    };

    const updatePreview = () => {
      const checked = getCheckedEmployees();

      if (mode === 'month') {
        const preview = document.getElementById('bulk-preview');
        if (!preview) return;
        if (!checked.length) {
          preview.textContent = 'Sélectionnez au moins un employé.';
          return;
        }
        const monthVal = document.getElementById('bulk-month')?.value;
        if (!monthVal) {
          preview.textContent = 'Choisissez un mois.';
          return;
        }
        const [year, month] = monthVal.split('-').map(Number);
        const days = countSelectedDays(year, month);
        preview.innerHTML = `<strong>${checked.length}</strong> employé(s) × <strong>${days}</strong> jour(s) = <strong>${checked.length * days}</strong> pointage(s) à préparer.`;
      } else {
        const dayPreview = document.getElementById('bulk-day-preview');
        if (!dayPreview) return;
        const rows = Array.from(document.querySelectorAll('#bulk-day-grid tr[data-matricule]'));
        const ready = rows.filter(row => {
          const entree = row.querySelector('.bulk-row-entree')?.value;
          const sortie = row.querySelector('.bulk-row-sortie')?.value;
          return entree && sortie;
        }).length;
        const dateLabel = formatDateFR(document.getElementById('bulk-day-date')?.value || '');
        dayPreview.innerHTML = `<strong>${ready}</strong> pointage(s) prêt(s)${dateLabel ? ` pour le ${dateLabel}` : ''}.`;
      }
    };

    const refreshCount = () => {
      const countEl = document.getElementById('bulk-emp-count');
      if (!countEl) return;
      const n = getCheckedEmployees().length;
      countEl.textContent = `${n} employé${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`;
    };

    const refreshAll = () => {
      refreshCount();
      syncDayGrid();
      updatePreview();
    };

    openModal('Saisie Groupée de Pointages', bodyHtml, async () => {
      const checked = getCheckedEmployees();
      if (checked.length === 0) {
        toast("Sélectionnez au moins un employé.", 'warning');
        return false;
      }

      const list = [];
      let summary = '';

      if (mode === 'month') {
        const monthVal = document.getElementById('bulk-month')?.value;
        if (!monthVal) {
          toast("Choisissez un mois.", 'warning');
          return false;
        }
        const [year, month] = monthVal.split('-').map(Number);
        const weekdays = new Set(getSelectedWeekdays());
        if (weekdays.size === 0) {
          toast("Sélectionnez au moins un jour de la semaine.", 'warning');
          return false;
        }

        const globalEntree = document.getElementById('bulk-month-entree')?.value || null;
        const globalSortie = document.getElementById('bulk-month-sortie')?.value || null;
        const notes = document.getElementById('bulk-month-notes')?.value.trim() || 'Enregistrement';
        const skipExisting = document.getElementById('bulk-skip-existing')?.checked;

        const numDays = new Date(year, month, 0).getDate();
        const dates = [];
        for (let d = 1; d <= numDays; d++) {
          if (!weekdays.has(new Date(year, month - 1, d).getDay())) continue;
          dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        }
        if (dates.length === 0) {
          toast("Aucun jour à saisir pour ce mois.", 'warning');
          return false;
        }

        let existing = new Set();
        if (skipExisting) {
          try {
            const rows = await api.getPointagesRange({
              date_debut: dates[0],
              date_fin: dates[dates.length - 1],
              matricules: checked.map(c => c.matricule)
            });
            existing = new Set((rows || []).map(r => `${r.matricule}|${r.date}`));
          } catch (err) {
            console.error(err);
            toast("Impossible de vérifier les pointages existants : rien n'a été enregistré.", 'danger');
            return false;
          }
        }

        checked.forEach(emp => {
          const entree = globalEntree || emp.entree;
          const sortie = globalSortie || emp.sortie;
          dates.forEach(dateStr => {
            if (skipExisting && existing.has(`${emp.matricule}|${dateStr}`)) return;
            list.push({
              matricule: emp.matricule,
              date: dateStr,
              heureEntree: entree,
              heureSortie: sortie,
              notes
            });
          });
        });

        if (list.length === 0) {
          toast("Tous les pointages de cette période existent déjà : rien à enregistrer.", 'warning');
          return false;
        }
        summary = `${checked.length} employé(s) sur ${dates.length} jour(s)`;
      } else {
        const dateStr = document.getElementById('bulk-day-date')?.value;
        if (!dateStr) {
          toast("Choisissez une date.", 'warning');
          return false;
        }
        const rows = Array.from(document.querySelectorAll('#bulk-day-grid tr[data-matricule]'));
        if (rows.length === 0) {
          toast("Sélectionnez au moins un employé.", 'warning');
          return false;
        }

        let incomplete = 0;
        rows.forEach(row => {
          const matricule = row.getAttribute('data-matricule');
          const entree = row.querySelector('.bulk-row-entree')?.value;
          const sortie = row.querySelector('.bulk-row-sortie')?.value;
          if (!entree && !sortie) return;
          if (!entree || !sortie) {
            incomplete++;
            return;
          }
          list.push({
            matricule,
            date: dateStr,
            heureEntree: entree,
            heureSortie: sortie,
            notes: 'Saisie groupée'
          });
        });

        if (incomplete > 0) {
          toast(`${incomplete} ligne(s) incomplète(s) ignorée(s) : renseignez l'entrée et la sortie.`, 'warning');
        }
        if (list.length === 0) {
          toast("Aucun pointage complet à enregistrer.", 'warning');
          return false;
        }
        summary = `${list.length} employé(s)`;
      }

      try {
        const res = await api.savePointages(list);
        await this.refreshJournalList();
        toast(`${res?.count ?? list.length} pointage(s) enregistré(s) (${summary}).`, 'success');
        return true;
      } catch (err) {
        toast(err.message, 'danger');
        return false;
      }
    });

    // --- Filtres de la liste des employés ---
    const searchEl = document.getElementById('bulk-emp-search');
    const deptEl = document.getElementById('bulk-emp-dept');
    const listEl = document.getElementById('bulk-emp-list');

    const applyFilter = () => {
      if (!listEl) return;
      const terms = (searchEl?.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
      const dept = deptEl?.value || '';
      listEl.querySelectorAll('.bulk-emp-row').forEach(row => {
        const haystack = row.getAttribute('data-search') || '';
        const matchesQuery = terms.every(term => haystack.includes(term));
        const matchesDept = !dept || row.getAttribute('data-dept') === dept;
        row.style.display = matchesQuery && matchesDept ? 'flex' : 'none';
      });
    };

    if (searchEl) searchEl.addEventListener('input', applyFilter);
    if (deptEl) deptEl.addEventListener('change', applyFilter);
    if (listEl) {
      listEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('bulk-emp-checkbox')) refreshAll();
      });
    }

    document.getElementById('bulk-select-all')?.addEventListener('click', () => {
      listEl?.querySelectorAll('.bulk-emp-row').forEach(row => {
        if (row.style.display === 'none') return;
        const cb = row.querySelector('.bulk-emp-checkbox');
        if (cb) cb.checked = true;
      });
      refreshAll();
    });

    document.getElementById('bulk-select-none')?.addEventListener('click', () => {
      listEl?.querySelectorAll('.bulk-emp-checkbox').forEach(cb => { cb.checked = false; });
      refreshAll();
    });

    // --- Bascule Mois / Journée ---
    const setMode = (next) => {
      mode = next;
      const monthBtn = document.getElementById('bulk-mode-month');
      const dayBtn = document.getElementById('bulk-mode-day');
      const monthFields = document.getElementById('bulk-month-fields');
      const dayFields = document.getElementById('bulk-day-fields');
      if (monthBtn && dayBtn) {
        monthBtn.className = `btn btn-sm ${next === 'month' ? 'btn-primary' : 'btn-secondary'}`;
        dayBtn.className = `btn btn-sm ${next === 'day' ? 'btn-primary' : 'btn-secondary'}`;
        monthBtn.style.flex = '1';
        dayBtn.style.flex = '1';
      }
      if (monthFields) monthFields.style.display = next === 'month' ? 'flex' : 'none';
      if (dayFields) dayFields.style.display = next === 'day' ? 'flex' : 'none';
      refreshAll();
    };

    document.getElementById('bulk-mode-month')?.addEventListener('click', () => setMode('month'));
    document.getElementById('bulk-mode-day')?.addEventListener('click', () => setMode('day'));

    // --- Mises à jour du récapitulatif ---
    document.getElementById('bulk-month')?.addEventListener('change', updatePreview);
    document.querySelectorAll('.bulk-weekday input').forEach(cb => cb.addEventListener('change', updatePreview));
    document.getElementById('bulk-day-date')?.addEventListener('change', updatePreview);

    document.getElementById('bulk-day-apply-all')?.addEventListener('click', () => {
      const entree = document.getElementById('bulk-day-entree-all')?.value;
      const sortie = document.getElementById('bulk-day-sortie-all')?.value;
      document.querySelectorAll('#bulk-day-grid tr[data-matricule]').forEach(row => {
        const inEl = row.querySelector('.bulk-row-entree');
        const outEl = row.querySelector('.bulk-row-sortie');
        if (entree && inEl) inEl.value = entree;
        if (sortie && outEl) outEl.value = sortie;
      });
      updatePreview();
    });

    document.getElementById('bulk-day-grid')?.addEventListener('input', updatePreview);
    document.getElementById('bulk-day-grid')?.addEventListener('change', updatePreview);

    setMode('month');
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
            <button class="btn btn-primary" id="btn-fiche-mensuelle-signee" style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
              <i data-lucide="file-check"></i> Fiche Officielle Signée (PDF)
            </button>
            <button class="btn btn-secondary" id="btn-print-mensuel">
              <i data-lucide="printer"></i> Imprimer Relevé
            </button>
            <button class="btn btn-secondary" id="btn-export-mensuel-csv">
              <i data-lucide="download"></i> Exporter CSV
            </button>
            ${heuresSuppCumulees > 0 ? `
              <button class="btn btn-secondary" id="btn-crediter-recup" data-heures="${heuresSuppCumulees}" style="color: #16a34a; border-color: #16a34a;">
                <i data-lucide="award"></i> Créditer Récup (+${parseFloat((heuresSuppCumulees / 8).toFixed(2))}j)
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

      const btnFicheSignee = document.getElementById('btn-fiche-mensuelle-signee');
      if (btnFicheSignee) {
        btnFicheSignee.addEventListener('click', () => {
          this.openSignedMonthlySheetModal(emp, pointagesMois, mois, annee, {
            joursTravailles,
            heuresTravaillees,
            minutesRetard,
            heuresSuppCumulees,
            anomaliesCount
          });
        });
      }

      document.getElementById('btn-export-mensuel-csv').addEventListener('click', () => {
        this.exportMonthlySheetToCSV(emp, pointagesMois);
      });

      document.getElementById('btn-print-mensuel').addEventListener('click', () => {
        window.print();
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

        // Calcul des primes industrielles conventionnelles SCHB GICA
        const primePanier = pp * 600; // 600 DA / jour pointé
        const primeTransport = pp * 400; // 400 DA / jour pointé
        const shiftsNuit = Math.ceil(pn / 8);
        const primeNuit = shiftsNuit * 800; // 800 DA / shift nuit
        const totalPrimes = primePanier + primeTransport + primeNuit;

        return {
          matricule: escapeHtml(emp.matricule),
          nom: escapeHtml(emp.nom),
          prenom: escapeHtml(emp.prenom),
          departement: escapeHtml(emp.departement || '-'),
          ca: ca || '-',
          cm: cm || '-',
          mat: mat || '-',
          css: css || '-',
          ce: ce || '-',
          pn: pn || '-',
          pp: pp || 0,
          hs50: hs50 || '-',
          hs75: hs75 || '-',
          hs100: hs100 || '-',
          primePanier,
          primeTransport,
          shiftsNuit,
          primeNuit,
          totalPrimes
        };
      });

      const nomMois = document.getElementById('recap-mois').options[mois-1].text;

      // Totaux généraux de l'usine pour le mois
      const totalJoursUsine = recapData.reduce((acc, r) => acc + (typeof r.pp === 'number' ? r.pp : 0), 0);
      const totalPanierUsine = recapData.reduce((acc, r) => acc + r.primePanier, 0);
      const totalTransportUsine = recapData.reduce((acc, r) => acc + r.primeTransport, 0);
      const totalNuitUsine = recapData.reduce((acc, r) => acc + r.primeNuit, 0);
      const totalPrimesUsine = recapData.reduce((acc, r) => acc + r.totalPrimes, 0);

      // Afficher dans l'interface
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="font-weight: 800; font-size: 1.25rem; color: var(--color-secondary); margin: 0 0 4px;">Mouvement Personnel & Primes Industrielles (SCHB GICA)</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Période : ${nomMois} ${annee} • Convention Collective Cimenteries</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-excel-recap-action" style="display: flex; align-items: center; gap: 8px; background-color: #16a34a; border-color: #16a34a; color: #fff;">
              <i data-lucide="file-spreadsheet"></i> Exporter Excel (XLSX)
            </button>
            <button class="btn btn-primary" id="btn-print-recap-action" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="printer"></i> Imprimer la Récap (PDF)
            </button>
          </div>
        </div>

        <!-- 4 KPI Métier Primes Cimenterie -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px;">
          <div style="background: rgba(19, 84, 122, 0.08); border-left: 4px solid var(--primary); padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Jours Travaillés Usine</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary);">${totalJoursUsine} j</div>
          </div>
          <div style="background: rgba(2, 132, 199, 0.08); border-left: 4px solid #0284c7; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Total Prime Panier (600 DA)</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #0284c7;">${totalPanierUsine.toLocaleString()} DA</div>
          </div>
          <div style="background: rgba(22, 163, 74, 0.08); border-left: 4px solid #16a34a; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Total Indemnité Transport (400 DA)</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #16a34a;">${totalTransportUsine.toLocaleString()} DA</div>
          </div>
          <div style="background: rgba(124, 58, 237, 0.08); border-left: 4px solid #7c3aed; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Total Primes Industrielles</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #7c3aed;">${totalPrimesUsine.toLocaleString()} DA</div>
          </div>
        </div>

        <div class="table-container" style="margin-top: 0; overflow-x: auto;">
          <table class="custom-table" style="font-size: 0.8rem; text-align: center;">
            <thead>
              <tr style="background: var(--bg-secondary);">
                <th>Matricule</th>
                <th>Nom & Prénom</th>
                <th title="Congé Annuel">CA</th>
                <th title="Congé Maladie">CM</th>
                <th title="Sans Solde">CSS</th>
                <th title="Jours Pointés">Jours</th>
                <th title="Heures Supp Total">HS Total</th>
                <th style="background: rgba(2, 132, 199, 0.08); color: #0284c7;" title="600 DA / jour">Panier (600 DA)</th>
                <th style="background: rgba(22, 163, 74, 0.08); color: #16a34a;" title="400 DA / jour">Transport (400 DA)</th>
                <th style="background: rgba(245, 158, 11, 0.08); color: #b45309;" title="800 DA / poste nuit">Poste Nuit (800 DA)</th>
                <th style="background: rgba(124, 58, 237, 0.12); font-weight: 800; color: #7c3aed;">Total Primes</th>
              </tr>
            </thead>
            <tbody>
              ${recapData.map(row => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-primary);">${row.matricule}</td>
                  <td style="font-weight: 600; text-align: left;">${row.nom} ${row.prenom}</td>
                  <td style="color: ${row.ca !== '-' ? 'var(--color-info)' : 'inherit'}; font-weight: ${row.ca !== '-' ? 'bold' : 'normal'};">${row.ca}</td>
                  <td style="color: ${row.cm !== '-' ? 'var(--color-danger)' : 'inherit'}; font-weight: ${row.cm !== '-' ? 'bold' : 'normal'};">${row.cm}</td>
                  <td>${row.css}</td>
                  <td style="font-weight: 700;">${row.pp}</td>
                  <td style="color: #16a34a; font-weight: 600;">${(typeof row.hs50 === 'number' ? row.hs50 : 0) + (typeof row.hs75 === 'number' ? row.hs75 : 0) + (typeof row.hs100 === 'number' ? row.hs100 : 0)} h</td>
                  <td style="font-weight: 600; color: #0284c7;">${row.primePanier.toLocaleString()} DA</td>
                  <td style="font-weight: 600; color: #16a34a;">${row.primeTransport.toLocaleString()} DA</td>
                  <td style="font-weight: 600; color: #b45309;">${row.primeNuit > 0 ? row.primeNuit.toLocaleString() + ' DA' : '-'}</td>
                  <td style="font-weight: 800; color: #7c3aed; background: rgba(124, 58, 237, 0.04);">${row.totalPrimes.toLocaleString()} DA</td>
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
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 350);">
          <!-- En-tête Officiel SCHB GICA Landscape -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1F497D; padding-bottom: 8px; margin-bottom: 12px; font-family: Calibri, Arial, sans-serif;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${LETTERHEAD_ASSETS.logoGica}" alt="GROUPE GICA" style="height: 55px; width: auto; object-fit: contain;" />
            </div>
            <div style="text-align: center; color: #1F497D;">
              <div style="font-size: 13pt; font-weight: 800; font-family: 'Traditional Arabic', Arial; direction: rtl;">المـجمــع الصنــاعي لإسمنت الجــزائــر</div>
              <div style="font-size: 9.5pt; font-weight: 800; letter-spacing: 0.5px;">GROUPE INDUSTRIEL DES CIMENTS D'ALGERIE — « S.C.H.B »</div>
              <div style="font-size: 11pt; font-weight: 900; letter-spacing: 1px; margin-top: 2px; color: #000;">CIMENTERIE HAMMA BOUZIANE — ÉTAT RÉCAPITULATIF DU MOUVEMENT DU PERSONNEL</div>
            </div>
            <div style="text-align: right; font-size: 9pt; font-weight: bold; color: #1F497D;">
              <div style="background: #eff6ff; border: 1.5px solid #1F497D; padding: 4px 10px; border-radius: 4px;">PÉRIODE : ${monthName.toUpperCase()} ${year}</div>
              <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">Réf : SCHB/DRH/GP-${year}</div>
            </div>
          </div>

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

          <!-- Pied de page officiel SCHB GICA -->
          <div style="margin-top: 15px;">
            ${renderOfficialFooter()}
          </div>
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
  },

  openSignedMonthlySheetModal(emp, pointages, mois, annee, stats) {
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const nomMois = moisNoms[mois - 1] || `Mois ${mois}`;

    const primePanier = stats.joursTravailles * 600;
    const primeTransport = stats.joursTravailles * 400;
    const shiftsNuit = pointages.filter(p => p.shift_type === 'nuit' || (p.heure_entree && p.heure_entree >= '20:30')).length;
    const primeNuit = shiftsNuit * 800;
    const totalPrimes = primePanier + primeTransport + primeNuit;

    const refDoc = `SCHB/PTG-${emp.matricule}-${annee}-${String(mois).padStart(2, '0')}`;
    const dateDoc = formatDateFR(new Date().toISOString().split('T')[0]);

    const sheetBodyHtml = `
      <!-- Titre du Document -->
      <div style="text-align: center; margin: 16px 0 20px 0;">
        <h2 style="margin: 0; font-size: 1.45rem; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #1F497D; text-decoration: underline;">
          FICHE MENSUELLE DE POINTAGE & PRÉ-PAIE
        </h2>
        <div style="font-size: 9pt; font-weight: 800; color: #000; margin-top: 4px;">
          PÉRIODE : ${nomMois.toUpperCase()} ${annee}
        </div>
      </div>

      <!-- Encadré Employé -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 8.5pt; font-family: Calibri, Arial, sans-serif;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
          <div><span style="color: #64748b;">Salarié :</span> <strong>${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}</strong></div>
          <div><span style="color: #64748b;">Matricule :</span> <strong>#${escapeHtml(emp.matricule)}</strong></div>
          <div><span style="color: #64748b;">Département :</span> <strong>${escapeHtml(emp.departement || '-')}</strong></div>
          <div><span style="color: #64748b;">Poste :</span> <strong>${escapeHtml(emp.poste || '-')}</strong></div>
        </div>
      </div>

      <!-- Récapitulatif Heures & Primes Conventionnelles Cimenterie -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; text-align: center; font-size: 8pt; font-family: Calibri, Arial, sans-serif;">
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; background: #fff;">
          <div style="color: #64748b; font-size: 7pt; text-transform: uppercase;">Jours Travaillés</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #1F497D;">${stats.joursTravailles} j</div>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; background: #fff;">
          <div style="color: #64748b; font-size: 7pt; text-transform: uppercase;">Total Heures</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #1F497D;">${stats.heuresTravaillees.toFixed(1)} h</div>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; background: #fff;">
          <div style="color: #64748b; font-size: 7pt; text-transform: uppercase;">Heures Supp</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #16a34a;">+${stats.heuresSuppCumulees} h</div>
        </div>
        <div style="border: 1px solid #7c3aed; border-radius: 4px; padding: 6px; background: rgba(124, 58, 237, 0.05);">
          <div style="color: #7c3aed; font-size: 7pt; text-transform: uppercase; font-weight: 700;">Primes Conventionnelles</div>
          <div style="font-size: 1.15rem; font-weight: 900; color: #7c3aed;">${totalPrimes.toLocaleString()} DA</div>
        </div>
      </div>

      <!-- Détail Primes Cimenterie -->
      <div style="background: rgba(31,73,125,0.03); border: 1px solid rgba(31,73,125,0.15); border-radius: 4px; padding: 6px 12px; margin-bottom: 12px; font-size: 7.5pt; display: flex; justify-content: space-around; font-family: Calibri, Arial, sans-serif;">
        <div>Prime Panier (600 DA/j) : <strong>${primePanier.toLocaleString()} DA</strong> (${stats.joursTravailles} jours)</div>
        <div>Indemnité Transport (400 DA/j) : <strong>${primeTransport.toLocaleString()} DA</strong></div>
        <div>Prime Quart / Nuit (800 DA) : <strong>${primeNuit.toLocaleString()} DA</strong> (${shiftsNuit} postes)</div>
      </div>

      <!-- Tableau des Pointages du Mois -->
      <div style="margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: Calibri, Arial, sans-serif;">
        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt; text-align: center;">
          <thead>
            <tr style="background: #1F497D; color: white; font-weight: 700;">
              <th style="padding: 5px 6px; text-align: left;">Date</th>
              <th style="padding: 5px 6px;">Entrée</th>
              <th style="padding: 5px 6px;">Sortie</th>
              <th style="padding: 5px 6px;">Durée</th>
              <th style="padding: 5px 6px;">Retard</th>
              <th style="padding: 5px 6px;">H. Supp</th>
              <th style="padding: 5px 6px;">Shift</th>
              <th style="padding: 5px 6px; text-align: left;">Observations</th>
            </tr>
          </thead>
          <tbody>
            ${pointages.length === 0 ? `
              <tr><td colspan="8" style="padding: 12px; color: #64748b;">Aucun enregistrement de pointage pour ce mois.</td></tr>
            ` : pointages.map(p => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 4px 6px; text-align: left; font-weight: 600;">${formatDateFR(p.date)}</td>
                <td style="padding: 4px 6px;">${p.heure_entree || '--:--'}</td>
                <td style="padding: 4px 6px;">${p.heure_sortie || '--:--'}</td>
                <td style="padding: 4px 6px; font-weight: 600;">${p.heures_travaillees ? p.heures_travaillees + 'h' : '-'}</td>
                <td style="padding: 4px 6px; color: ${p.retard > 0 ? '#d97706' : 'inherit'};">${p.retard > 0 ? p.retard + 'm' : '-'}</td>
                <td style="padding: 4px 6px; color: ${p.heures_supp > 0 ? '#16a34a' : 'inherit'}; font-weight: ${p.heures_supp > 0 ? '700' : 'normal'};">${p.heures_supp > 0 ? '+' + p.heures_supp + 'h' : '-'}</td>
                <td style="padding: 4px 6px;">${escapeHtml(p.shift_type || 'jour')}</td>
                <td style="padding: 4px 6px; text-align: left; font-size: 7pt; color: #64748b;">${escapeHtml(p.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Blocs de Signature Officiels -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; font-size: 8pt; font-family: Calibri, Arial, sans-serif;">
        <div style="border: 1px dashed #94a3b8; border-radius: 4px; padding: 10px; height: 95px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-weight: 800; color: #0f172a;">Émargement du Salarié</div>
            <div style="font-size: 7pt; color: #64748b;">Mention manuscrite « Lu et approuvé, certifié exact »</div>
          </div>
          <div style="font-size: 7pt; color: #94a3b8; border-top: 1px dotted #cbd5e1; padding-top: 4px;">
            Date : ____ / ____ / ${annee} • Signature :
          </div>
        </div>

        <div style="border: 1.5px solid #1F497D; background: rgba(31,73,125,0.02); border-radius: 4px; padding: 10px; height: 95px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-weight: 800; color: #1F497D;">Visa Chef de Service & Direction RH</div>
            <div style="font-size: 7pt; color: #64748b;">Validé pour prise en compte en paie • SCHB GICA</div>
          </div>
          <div style="font-size: 7pt; color: #1F497D; font-weight: 700; border-top: 1px dotted rgba(31,73,125,0.3); padding-top: 4px;">
            Date : ____ / ____ / ${annee} • Cachet & Signature :
          </div>
        </div>
      </div>
    `;

    const modalHtml = wrapInOfficialDocument(sheetBodyHtml, {
      ref: refDoc,
      date: dateDoc,
      departement: 'DIRECTION DES RESSOURCES HUMAINES • GESTION DU PERSONNEL'
    });

    openModal(
      `Fiche Mensuelle Signée — ${emp.prenom} ${emp.nom} (${nomMois} ${annee})`,
      modalHtml,
      [
        {
          label: 'Fermer',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Imprimer / Exporter en PDF',
          class: 'btn btn-primary',
          onClick: () => {
            printOfficialDocument(sheetBodyHtml, {
              documentTitle: `Fiche_Pointage_${emp.matricule}_${nomMois}_${annee}`,
              ref: refDoc,
              date: dateDoc,
              departement: 'DIRECTION DES RESSOURCES HUMAINES • GESTION DU PERSONNEL'
            });
          }
        }
      ]
    );
  }
};

