import { api } from '../api.js';
import { getCurrentUser } from '../main.js';
import { escapeHtml } from '../utils.js';

function format24h(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  // Normaliser les séparateurs (convertir . , espace ou ; en :)
  str = str.replace(/[.,\s;]/g, ':');
  // Supprimer tout caractère non numérique ou non-deux-points
  str = str.replace(/[^0-9:]/g, '');
  if (!str) return '';

  // Cas 1 : contient déjà un deux-points (ex: "8:3", "14:30", "08:00")
  if (str.includes(':')) {
    const parts = str.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1] || '0', 10);
    if (isNaN(h)) return '';
    if (isNaN(m)) m = 0;
    h = Math.min(23, Math.max(0, h));
    m = Math.min(59, Math.max(0, m));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Cas 2 : uniquement des chiffres (ex: "8", "14", "830", "1430", "2215")
  if (/^\d{1,4}$/.test(str)) {
    if (str.length === 1 || str.length === 2) {
      let h = Math.min(23, Math.max(0, parseInt(str, 10)));
      return `${String(h).padStart(2, '0')}:00`;
    }
    if (str.length === 3) {
      let h = Math.min(23, Math.max(0, parseInt(str.substring(0, 1), 10)));
      let m = Math.min(59, Math.max(0, parseInt(str.substring(1, 3), 10)));
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (str.length === 4) {
      let h = Math.min(23, Math.max(0, parseInt(str.substring(0, 2), 10)));
      let m = Math.min(59, Math.max(0, parseInt(str.substring(2, 4), 10)));
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return '';
}

export const RecupeDetailComponent = {
  title: 'Détails Mensuels',
  subtitle: 'Consultation détaillée des pointages, heures supplémentaires et récupérations',

  async render(queryParams = {}) {
    const today = new Date();
    const currentYearMonth = queryParams.month || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const prefilledMatricule = queryParams.matricule || '';

    return `
      <div class="card" style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <h3 style="margin: 0; font-weight: 700; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="calendar" style="color: var(--color-primary);"></i>
            Fiche Mensuelle des Récupérations & Pointages
          </h3>
        </div>

        <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
          <!-- Employee Autocomplete Search -->
          <div class="form-group" style="position: relative; flex: 1; min-width: 280px; margin: 0;">
            <label for="rd-search-emp" style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; display: block;">Rechercher un Collaborateur*</label>
            <input type="text" id="rd-search-emp" class="form-control" placeholder="Taper le nom ou matricule..." autocomplete="off" style="height: 38px;" value="${prefilledMatricule}">
            <input type="hidden" id="rd-matricule" value="${prefilledMatricule}">
            <div id="rd-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); max-height: 180px; overflow-y: auto; z-index: 999; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
          </div>
          
          <!-- Month Picker -->
          <div class="form-group" style="width: 200px; margin: 0;">
            <label for="rd-month-picker" style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; display: block;">Sélectionner le mois*</label>
            <input type="month" id="rd-month-picker" class="form-control" style="height: 38px;" value="${currentYearMonth}">
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">

        <!-- Dynamic Content Table Container -->
        <div id="rd-table-container">
          <div style="text-align: center; color: var(--text-muted); padding: 50px;">
            <i data-lucide="search" style="width: 48px; height: 48px; stroke-width: 1.5; color: var(--text-muted); margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;"></i>
            Veuillez rechercher et sélectionner un collaborateur pour charger son calendrier mensuel.
          </div>
        </div>
      </div>
    `;
  },

  async init(queryParams = {}) {
    if (window.lucide) window.lucide.createIcons();

    const searchInput = document.getElementById('rd-search-emp');
    const hiddenInput = document.getElementById('rd-matricule');
    const suggestionsDiv = document.getElementById('rd-suggestions');
    const monthPicker = document.getElementById('rd-month-picker');

    if (!searchInput || !hiddenInput || !suggestionsDiv || !monthPicker) return;

    try {
      const employeesList = await api.getEmployees();

      const loadFiche = async (matricule, yearMonth) => {
        const container = document.getElementById('rd-table-container');
        if (!container) return;
        
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
            <div style="width: 30px; height: 30px; border: 3px solid rgba(124, 58, 237, 0.2); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px auto;"></div>
            Chargement de la fiche mensuelle...
          </div>
          <style>
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        `;

        try {
          const emp = employeesList.find(e => e.matricule === matricule);
          const pointages = await api.getPointages(null, matricule);
          const recuperations = await api.getRecuperations(matricule);
          const settings = await api.getSettings();
          const config = settings?.config || {};

          this.renderFicheTable(emp, pointages, recuperations, yearMonth, config);
          if (window.lucide) window.lucide.createIcons();
        } catch (e) {
          container.innerHTML = `<div class="alert alert-danger" style="margin: 20px 0;">Erreur de chargement: ${escapeHtml(e.message)}</div>`;
        }
      };

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
            <div class="rd-suggestion-item" data-matricule="${escapeHtml(e.matricule)}" data-display="${escapeHtml(e.matricule)} - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}"
                 style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 0.85rem; transition: background 0.15s; background-color: var(--bg-secondary); color: var(--text-primary);">
              <strong>${escapeHtml(e.matricule)}</strong> - ${escapeHtml(e.prenom)} ${escapeHtml(e.nom)}
            </div>
          `).join('');
        }
        suggestionsDiv.style.display = 'block';

        suggestionsDiv.querySelectorAll('.rd-suggestion-item').forEach(item => {
          item.addEventListener('click', (e) => {
            const matricule = e.currentTarget.getAttribute('data-matricule');
            hiddenInput.value = matricule;
            searchInput.value = e.currentTarget.getAttribute('data-display');
            suggestionsDiv.style.display = 'none';
            loadFiche(matricule, monthPicker.value);
          });
        });
      };

      searchInput.addEventListener('input', (e) => showSuggestions(e.target.value));

      // Vider automatiquement la barre de recherche au clic/focus et afficher toutes les suggestions
      const handleSearchFocus = () => {
        searchInput.value = '';
        showSuggestions('');
      };

      searchInput.addEventListener('click', handleSearchFocus);
      searchInput.addEventListener('focus', handleSearchFocus);
      
      monthPicker.addEventListener('change', () => {
        if (hiddenInput.value) {
          loadFiche(hiddenInput.value, monthPicker.value);
        }
      });

      document.addEventListener('click', (e) => {
        if (e.target !== searchInput && !suggestionsDiv.contains(e.target)) {
          suggestionsDiv.style.display = 'none';
          // Si l'utilisateur clique ailleurs sans choisir et que le champ est vide, ré-afficher le collaborateur actif
          if (!searchInput.value.trim() && hiddenInput.value) {
            const currentEmp = employeesList.find(emp => emp.matricule === hiddenInput.value);
            if (currentEmp) {
              searchInput.value = `${currentEmp.matricule} - ${currentEmp.prenom} ${currentEmp.nom}`;
            }
          }
        }
      });

      // Afficher par défaut le premier collaborateur de la liste si aucun matricule n'est spécifié en URL
      const targetMatricule = queryParams.matricule || (employeesList.length > 0 ? employeesList[0].matricule : null);
      if (targetMatricule) {
        const emp = employeesList.find(e => e.matricule === targetMatricule);
        if (emp) {
          hiddenInput.value = emp.matricule;
          searchInput.value = `${emp.matricule} - ${emp.prenom} ${emp.nom}`;
          loadFiche(emp.matricule, monthPicker.value);
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderFicheTable(emp, pointages, recuperations, yearMonth, config = {}) {
    const container = document.getElementById('rd-table-container');
    if (!container) return;

    const [year, month] = yearMonth.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();

    const daysOfWeekNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <span style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">
          Période: ${month.toString().padStart(2, '0')}/${year}
        </span>
        <div style="text-align: right;">
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Solde de Récupération:</span>
          <span id="rd-solde-badge" class="badge success" style="font-weight: 800; font-size: 0.85rem; padding: 4px 8px;">
            ${parseFloat((emp.solde_recuperation / 8).toFixed(2))} jours
          </span>
        </div>
      </div>
      <div class="table-container" style="margin-top: 0; overflow-y: auto; max-height: 480px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <table class="custom-table" style="font-size: 0.8rem; margin: 0; text-align: center;">
          <thead>
            <tr style="position: sticky; top: 0; background-color: var(--bg-secondary); z-index: 10;">
              <th style="text-align: left;">Date / Jour</th>
              <th>Type de Jour</th>
              <th>Heures Pointées</th>
              <th>H.S/50%</th>
              <th>H.S/75%</th>
              <th>H.S/100%</th>
              <th>Récup. Générée</th>
              <th>Récup. Prise</th>
              <th style="text-align: left;">Notes / Motif</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isFriday = (dayOfWeek === 5);
      const isSaturday = (dayOfWeek === 6);
      const dayName = daysOfWeekNames[dayOfWeek];

      const p = pointages.find(point => point.date === dateStr);
      const activeRec = recuperations.find(r => dateStr >= r.date_debut && dateStr <= r.date_fin && r.statut === 'Approuvé');
      const pendingRec = recuperations.find(r => dateStr >= r.date_debut && dateStr <= r.date_fin && r.statut === 'En attente');

      // Analyser et séparer les détails de calcul des heures supplémentaires
      let hs50 = 0;
      let hs75 = 0;
      let hs100 = 0;
      let recupGenVal = 0;
      let customComment = '';

      if (p && p.notes) {
        const matches = p.notes.matchAll(/([\d.]+)\s*H\s*x\s*(50|75|100)\s*%/g);
        for (const match of matches) {
          const val = parseFloat(match[1]);
          const pct = match[2];
          if (pct === '50') hs50 += val;
          else if (pct === '75') hs75 += val;
          else if (pct === '100') hs100 += val;
        }

        const recupMatch = p.notes.match(/->\s*([\d.]+)\s*j/);
        if (recupMatch) {
          recupGenVal = parseFloat(recupMatch[1]);
        }

        // Extraire tout commentaire textuel personnalisé saisi
        customComment = p.notes.replace(/[\d.]+\s*H\s*x\s*\d+\s*%/g, '')
                               .replace(/\+/g, '')
                               .replace(/->\s*[\d.]+\s*j/g, '')
                               .trim();
      }

      // Détecter les jours de repos selon le cycle ou standard
      const hasCycle = emp.cycle_travail > 0 && emp.cycle_repos > 0 && emp.cycle_debut;
      let isReposDay = false;
      if (hasCycle) {
        const [cyY, cyM, cyD] = emp.cycle_debut.split('-').map(Number);
        const dateDebut = new Date(Date.UTC(cyY, cyM - 1, cyD));
        const dateCurrent = new Date(Date.UTC(year, month - 1, d));
        const diffTime = dateCurrent - dateDebut;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          const cycleLength = emp.cycle_travail + emp.cycle_repos;
          const cycleIndex = diffDays % cycleLength;
          if (cycleIndex >= emp.cycle_travail) {
            isReposDay = true;
          }
        }
      }

      const isHoliday = config.joursFeries?.includes(dateStr) || false;

      let bgStyle = '';
      let dayType = 'Ouvrable';
      
      if (isHoliday) {
        bgStyle = 'background-color: rgba(239, 68, 68, 0.08);';
        dayType = 'Férié';
      } else if (hasCycle) {
        if (isReposDay) {
          bgStyle = 'background-color: rgba(239, 68, 68, 0.04);';
          dayType = 'Repos (Cycle)';
        } else {
          dayType = 'Ouvrable (Cycle)';
        }
      } else {
        if (isFriday) {
          bgStyle = 'background-color: rgba(239, 68, 68, 0.04);';
          dayType = 'Repos (Ven)';
        } else if (isSaturday) {
          bgStyle = 'background-color: rgba(245, 158, 11, 0.03);';
          dayType = 'Repos (Sam)';
        }
      }

      const dateFormatted = `${dayStr}/${monthStr}/${year}`;

      html += `
        <tr id="rd-row-${dateStr}" data-date="${dateStr}" style="${bgStyle}">
          <td style="font-weight: 700; white-space: nowrap;">
            ${dayName.substring(0,3)} ${dateFormatted}
          </td>
          <td>
            <span style="font-size: 0.75rem; font-weight: 600; color: ${isFriday ? 'var(--color-danger)' : isSaturday ? 'var(--color-warning)' : 'var(--text-secondary)'};">
              ${dayType}
            </span>
          </td>
          <td style="white-space: nowrap; padding: 4px 6px;">
            <div class="rd-time-box" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: var(--bg-primary); padding: 3px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md); transition: border-color 0.2s, box-shadow 0.2s;">
              <input type="text" class="rd-time-input" data-date="${dateStr}" data-field="heureEntree" value="${format24h(p?.heure_entree)}" data-last-val="${format24h(p?.heure_entree)}" placeholder="08:00" maxlength="5" inputmode="numeric" style="border: none; background: transparent; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); width: 60px; text-align: center; cursor: text; outline: none;" title="Heure d'entrée format 24h (ex: 08:00, 8, 830, 1430)">
              <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">-</span>
              <input type="text" class="rd-time-input" data-date="${dateStr}" data-field="heureSortie" value="${format24h(p?.heure_sortie)}" data-last-val="${format24h(p?.heure_sortie)}" placeholder="16:00" maxlength="5" inputmode="numeric" style="border: none; background: transparent; font-size: 0.82rem; font-weight: 700; color: var(--text-primary); width: 60px; text-align: center; cursor: text; outline: none;" title="Heure de sortie format 24h (ex: 16:00, 1600, 2215)">
            </div>
            <span class="rd-save-indicator" id="rd-save-ind-${dateStr}" style="margin-left: 4px; font-size: 0.8rem; color: var(--color-success); opacity: 0; transition: opacity 0.3s; font-weight: bold; display: inline-block; width: 14px;">✓</span>
          </td>
          <!-- H.S/50% -->
          <td>
            ${hs50 > 0 ? `
              <span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">
                +${hs50}h
              </span>
            ` : '-'}
          </td>
          <!-- H.S/75% -->
          <td>
            ${hs75 > 0 ? `
              <span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">
                +${hs75}h
              </span>
            ` : '-'}
          </td>
          <!-- H.S/100% -->
          <td>
            ${hs100 > 0 ? `
              <span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">
                +${hs100}h
              </span>
            ` : '-'}
          </td>
          <!-- Récup. Générée -->
          <td>
            ${recupGenVal > 0 ? `
              <span class="badge success" style="font-weight: 800; font-size: 0.75rem; padding: 2px 6px; background-color: var(--color-primary); border-color: var(--color-primary); color: #fff;">
                +${recupGenVal} j
              </span>
            ` : '-'}
          </td>
          <!-- Récupération Prise -->
          <td>
            ${activeRec ? `
              <span class="badge info" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px;">
                Prise (${parseFloat((activeRec.duree / 8).toFixed(2))} j)
              </span>
            ` : pendingRec ? `
              <span class="badge warning" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px;">
                En attente (${parseFloat((pendingRec.duree / 8).toFixed(2))} j)
              </span>
            ` : '-'}
          </td>
          <!-- Notes / Motif -->
          <td style="color: var(--text-secondary); font-size: 0.8rem; font-style: italic; text-align: left; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(customComment || (activeRec ? activeRec.motif : pendingRec ? pendingRec.motif : ''))}">
            ${customComment ? escapeHtml(customComment) : (activeRec ? `Motif: ${escapeHtml(activeRec.motif)}` : pendingRec ? `Motif: ${escapeHtml(pendingRec.motif)}` : '-')}
          </td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    // Attacher les écouteurs d'enregistrement automatique au format 24h lors de la sortie de champ
    const handleTimeChange = async (dateStr) => {
      const row = document.getElementById(`rd-row-${dateStr}`);
      if (!row) return;

      const inputEntree = row.querySelector('.rd-time-input[data-field="heureEntree"]');
      const inputSortie = row.querySelector('.rd-time-input[data-field="heureSortie"]');
      const timeBox = row.querySelector('.rd-time-box');
      const indicator = document.getElementById(`rd-save-ind-${dateStr}`);

      if (!inputEntree || !inputSortie) return;

      const rawEntree = inputEntree.value.trim();
      const rawSortie = inputSortie.value.trim();

      const entreeVal = format24h(rawEntree);
      const sortieVal = format24h(rawSortie);

      // Appliquer le format 24h propre à l'affichage
      inputEntree.value = entreeVal;
      inputSortie.value = sortieVal;

      const lastEntree = inputEntree.getAttribute('data-last-val') || '';
      const lastSortie = inputSortie.getAttribute('data-last-val') || '';

      // Si aucune modification par rapport à la dernière valeur enregistrée, ne rien faire
      if (entreeVal === lastEntree && sortieVal === lastSortie) return;

      // Activer le drapeau local pour empêcher le re-rendu global par SSE
      window.isLocalInlineSaving = true;
      if (timeBox) timeBox.style.borderColor = 'var(--color-primary)';

      try {
        const existingP = pointages.find(pt => pt.date === dateStr);

        if (!entreeVal && !sortieVal) {
          if (existingP && existingP.id) {
            await api.deletePointage(existingP.id);
            const pIdx = pointages.findIndex(pt => pt.id === existingP.id);
            if (pIdx !== -1) pointages.splice(pIdx, 1);
          }
        } else {
          const pointageData = {
            id: existingP ? existingP.id : `p_${emp.matricule}_${dateStr}`,
            matricule: emp.matricule,
            date: dateStr,
            heureEntree: entreeVal || null,
            heureSortie: sortieVal || null,
            notes: existingP ? existingP.notes : ''
          };

          await api.saveSinglePointage(pointageData);
        }

        // Mettre à jour les attributs de dernière valeur enregistrée
        inputEntree.setAttribute('data-last-val', entreeVal);
        inputSortie.setAttribute('data-last-val', sortieVal);

        // Rafraîchir les données locales sans recharger la page
        const freshPointages = await api.getPointages(null, emp.matricule);
        const freshEmployees = await api.getEmployees();
        const freshEmp = freshEmployees.find(e => e.matricule === emp.matricule);

        pointages.length = 0;
        pointages.push(...freshPointages);

        if (timeBox) {
          timeBox.style.borderColor = 'var(--color-success)';
          setTimeout(() => {
            if (timeBox) timeBox.style.borderColor = 'var(--border-color)';
          }, 1500);
        }
        if (indicator) {
          indicator.style.opacity = '1';
          setTimeout(() => {
            if (indicator) indicator.style.opacity = '0';
          }, 1500);
        }

        if (freshEmp) {
          emp.solde_recuperation = freshEmp.solde_recuperation;
          const soldeBadge = document.getElementById('rd-solde-badge');
          if (soldeBadge) {
            soldeBadge.textContent = `${parseFloat((freshEmp.solde_recuperation / 8).toFixed(2))} jours`;
          }
        }

        // Mettre à jour les cellules de calcul de la ligne modifiée
        const p = pointages.find(pt => pt.date === dateStr);
        let hs50 = 0, hs75 = 0, hs100 = 0, recupGenVal = 0, customComment = '';

        if (p && p.notes) {
          const matches = p.notes.matchAll(/([\d.]+)\s*H\s*x\s*(50|75|100)\s*%/g);
          for (const match of matches) {
            const val = parseFloat(match[1]);
            const pct = match[2];
            if (pct === '50') hs50 += val;
            else if (pct === '75') hs75 += val;
            else if (pct === '100') hs100 += val;
          }
          const recupMatch = p.notes.match(/->\s*([\d.]+)\s*j/);
          if (recupMatch) recupGenVal = parseFloat(recupMatch[1]);
          customComment = p.notes.replace(/[\d.]+\s*H\s*x\s*\d+\s*%/g, '')
                                 .replace(/\+/g, '')
                                 .replace(/->\s*[\d.]+\s*j/g, '')
                                 .trim();
        }

        const cells = row.querySelectorAll('td');
        if (cells[3]) {
          cells[3].innerHTML = hs50 > 0 ? `<span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">+${hs50}h</span>` : '-';
        }
        if (cells[4]) {
          cells[4].innerHTML = hs75 > 0 ? `<span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">+${hs75}h</span>` : '-';
        }
        if (cells[5]) {
          cells[5].innerHTML = hs100 > 0 ? `<span class="badge success" style="font-weight: 700; font-size: 0.75rem; padding: 2px 6px; background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: var(--color-success);">+${hs100}h</span>` : '-';
        }
        if (cells[6]) {
          cells[6].innerHTML = recupGenVal > 0 ? `<span class="badge success" style="font-weight: 800; font-size: 0.75rem; padding: 2px 6px; background-color: var(--color-primary); border-color: var(--color-primary); color: #fff;">+${recupGenVal} j</span>` : '-';
        }
        if (cells[8]) {
          const activeRec = recuperations.find(r => dateStr >= r.date_debut && dateStr <= r.date_fin && r.statut === 'Approuvé');
          const pendingRec = recuperations.find(r => dateStr >= r.date_debut && dateStr <= r.date_fin && r.statut === 'En attente');
          const textNote = customComment ? customComment : (activeRec ? `Motif: ${activeRec.motif}` : pendingRec ? `Motif: ${pendingRec.motif}` : '-');
          cells[8].title = textNote;
          cells[8].textContent = textNote;
        }
      } catch (err) {
        console.error('Auto-save error:', err);
        if (timeBox) timeBox.style.borderColor = 'var(--color-danger)';
      } finally {
        setTimeout(() => {
          window.isLocalInlineSaving = false;
        }, 500);
      }
    };

    container.querySelectorAll('.rd-time-input').forEach(input => {
      const dateStr = input.getAttribute('data-date');

      // Valider la saisie et formater immédiatement en 24h à l'appui sur Entrée
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });

      // Formater la valeur au format 24H (ex: 8 -> 08:00, 1430 -> 14:30) et sauvegarder
      input.addEventListener('blur', () => handleTimeChange(dateStr));
      input.addEventListener('change', () => handleTimeChange(dateStr));
    });
  }
};
