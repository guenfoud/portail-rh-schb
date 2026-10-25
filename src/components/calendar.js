import { api } from '../api.js';
import { getCurrentUser } from '../main.js';
import { escapeHtml } from '../utils.js';

export const CalendarComponent = {
  title: 'Calendrier de Présence d\'Équipe',
  subtitle: 'Visualisation mensuelle globale des présences, congés et récupérations',
  selectedDate: new Date(),
  activeDayDetails: null, // stocker la date active sélectionnée pour les détails

  async render() {
    const today = this.selectedDate;
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];

    const user = getCurrentUser();
    let employees = [];
    try {
      const allEmp = await api.getEmployees();
      if (user.role === 'supervisor') {
        employees = allEmp.filter(e => e.departement === user.departement);
      } else {
        employees = allEmp;
      }
    } catch (e) {
      console.error(e);
    }

    const depts = [...new Set(employees.map(e => e.departement))];

    return `
      <div class="row-cols-2" style="grid-template-columns: 2fr 1fr; gap: 24px;">
        <!-- Calendrier Principal -->
        <div class="card">
          <!-- Sélecteurs calendrier -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn btn-secondary btn-icon" id="btn-cal-prev"><i data-lucide="chevron-left"></i></button>
              <h3 style="font-weight: 800; font-size: 1.15rem; min-width: 150px; text-align: center;" id="cal-month-year-label">
                ${monthNames[currentMonth]} ${currentYear}
              </h3>
              <button class="btn btn-secondary btn-icon" id="btn-cal-next"><i data-lucide="chevron-right"></i></button>
            </div>

            <div style="display: flex; gap: 12px; align-items: center;">
              ${user.role !== 'supervisor' ? `
                <select id="cal-dept-filter" class="form-control" style="width: 180px; padding: 8px 12px;">
                  <option value="">Tous les Départements</option>
                  ${depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                </select>
              ` : ''}
              <button class="btn btn-primary btn-icon" id="btn-cal-today" title="Aujourd'hui">
                <i data-lucide="calendar"></i>
              </button>
            </div>
          </div>

          <!-- Grille du calendrier -->
          <div class="calendar-grid-wrapper">
            <div class="calendar-weekdays" style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem;">
              <div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div>
            </div>
            <div class="calendar-days-grid" id="calendar-days-container" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 12px; min-height: 280px;">
              <!-- Injecté par JS -->
            </div>
          </div>
        </div>

        <!-- Panneau Détails du jour sélectionné -->
        <div class="card" style="display: flex; flex-direction: column; gap: 16px;" id="calendar-details-panel">
          <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <h3 style="font-weight: 700; font-size: 1.1rem; color: var(--color-primary);" id="details-date-label">
              Sélectionnez un jour
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.8rem;">Statut de l'effectif pour cette journée</p>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 16px; flex: 1; overflow-y: auto;" id="details-lists-container">
            <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
              Cliquez sur un jour du calendrier pour voir le détail des présences, congés et récupérations.
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // Écouteurs de navigation calendrier
    document.getElementById('btn-cal-prev').addEventListener('click', () => {
      this.selectedDate.setMonth(this.selectedDate.getMonth() - 1);
      this.refreshCalendar();
    });

    document.getElementById('btn-cal-next').addEventListener('click', () => {
      this.selectedDate.setMonth(this.selectedDate.getMonth() + 1);
      this.refreshCalendar();
    });

    document.getElementById('btn-cal-today').addEventListener('click', () => {
      this.selectedDate = new Date();
      this.refreshCalendar();
    });

    const deptFilter = document.getElementById('cal-dept-filter');
    if (deptFilter) {
      deptFilter.addEventListener('change', () => this.refreshCalendar());
    }

    await this.refreshCalendar();
  },

  async refreshCalendar() {
    const today = this.selectedDate;
    const year = today.getFullYear();
    const month = today.getMonth();
    const deptFilter = document.getElementById('cal-dept-filter')?.value || '';

    const user = getCurrentUser();
    const activeDept = user.role === 'supervisor' ? user.departement : deptFilter;

    // Nommer le mois courant
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    document.getElementById('cal-month-year-label').innerText = `${monthNames[month]} ${year}`;

    const daysContainer = document.getElementById('calendar-days-container');
    if (!daysContainer) return;
    daysContainer.innerHTML = '';

    // Déterminer les jours du mois
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dimanche, 1 = Lundi
    // Convertir en 1-indexed où 0 = Lundi, 6 = Dimanche
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    const lastDate = new Date(year, month + 1, 0).getDate();

    // Charger les données de la base de données
    let employees = [];
    let pointages = [];
    let recuperations = [];
    let absences = [];

    try {
      const allEmp = await api.getEmployees();
      employees = activeDept ? allEmp.filter(e => e.departement === activeDept) : allEmp;
      
      pointages = await api.getPointages();
      recuperations = await api.getRecuperations();
      absences = await api.getAbsences();
    } catch (e) {
      console.error("Erreur lors de la récupération des données calendrier", e);
    }

    // Filtrer les récupérations et congés approuvés uniquement
    const approvedRecups = recuperations.filter(r => r.statut === 'Approuvé');
    const approvedAbs = absences.filter(a => a.statut === 'Approuvé');

    // Générer les cases vides de début
    for (let i = 0; i < startOffset; i++) {
      daysContainer.innerHTML += `<div class="calendar-day-empty" style="padding: 12px; background-color: transparent;"></div>`;
    }

    // Générer les jours du mois
    for (let day = 1; day <= lastDate; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Calculer stats du jour
      const pointagesJour = pointages.filter(p => p.date === dateStr && employees.some(e => e.matricule === p.matricule));
      const presentsCount = pointagesJour.filter(p => p.heure_entree && !p.anomalie).length;

      // Compter les congés sur ce jour
      const absJour = approvedAbs.filter(a => {
        return employees.some(e => e.matricule === a.matricule) && 
               dateStr >= a.date_debut && dateStr <= a.date_fin;
      });
      const absCount = absJour.length;

      // Compter les récupérations sur ce jour
      const recJour = approvedRecups.filter(r => {
        return employees.some(e => e.matricule === r.matricule) && 
               dateStr >= r.date_debut && dateStr <= r.date_fin;
      });
      const recCount = recJour.length;

      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      // Style de la case
      const borderStyle = isToday ? 'border: 2px solid var(--color-primary);' : 'border: 1px solid var(--border-color);';
      const bgStyle = isToday ? 'background-color: rgba(124, 58, 237, 0.05);' : 'background-color: var(--bg-secondary);';

      daysContainer.innerHTML += `
        <div class="calendar-day-card" data-date="${dateStr}" style="${borderStyle} ${bgStyle} border-radius: var(--radius-md); padding: 8px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; min-height: 70px; transition: var(--transition-fast);">
          <div style="font-weight: 700; font-size: 0.95rem; color: ${isToday ? 'var(--color-primary)' : 'inherit'};">${day}</div>
          
          <!-- Indicateurs de présence -->
          <div style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 6px; flex-wrap: wrap;">
            ${presentsCount > 0 ? `<span style="background-color: var(--color-success); width: 8px; height: 8px; border-radius: 50%; display: inline-block;" title="${presentsCount} Présents"></span>` : ''}
            ${absCount > 0 ? `<span style="background-color: var(--color-info); width: 8px; height: 8px; border-radius: 50%; display: inline-block;" title="${absCount} Congés"></span>` : ''}
            ${recCount > 0 ? `<span style="background-color: var(--color-warning); width: 8px; height: 8px; border-radius: 50%; display: inline-block;" title="${recCount} Récupérations"></span>` : ''}
          </div>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();

    // Attacher les écouteurs de clic sur les jours
    document.querySelectorAll('.calendar-day-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const date = e.currentTarget.getAttribute('data-date');
        document.querySelectorAll('.calendar-day-card').forEach(c => {
          c.style.backgroundColor = c.getAttribute('data-date') === new Date().toISOString().split('T')[0] 
            ? 'rgba(124, 58, 237, 0.05)' 
            : 'var(--bg-secondary)';
        });
        e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.12)';
        this.showDayDetails(date, employees, pointages, approvedRecups, approvedAbs);
      });
    });

    // Auto-charger la date sélectionnée ou aujourd'hui
    const targetDayStr = this.activeDayDetails || new Date().toISOString().split('T')[0];
    const targetCard = document.querySelector(`.calendar-day-card[data-date="${targetDayStr}"]`);
    if (targetCard) {
      targetCard.click();
    } else {
      // Cliquer sur le premier jour disponible
      const firstCard = document.querySelector('.calendar-day-card');
      if (firstCard) firstCard.click();
    }
  },

  showDayDetails(dateStr, employees, pointages, recuperations, absences) {
    this.activeDayDetails = dateStr;

    // Formater la date en français
    const parts = dateStr.split('-');
    const labelDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    document.getElementById('details-date-label').innerText = `Détails du ${labelDate}`;

    const container = document.getElementById('details-lists-container');
    if (!container) return;

    // Trouver les pointages (présents)
    const pts = pointages.filter(p => p.date === dateStr);
    const presents = [];
    pts.forEach(p => {
      const emp = employees.find(e => e.matricule === p.matricule);
      if (emp) {
        presents.push({
          matricule: p.matricule,
          nom: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}`,
          entree: p.heure_entree,
          sortie: p.heure_sortie,
          shift: escapeHtml(p.shift_type),
          anomalie: p.anomalie
        });
      }
    });

    // Trouver les congés (absences approuvées)
    const abList = absences.filter(a => dateStr >= a.date_debut && dateStr <= a.date_fin);
    const enConge = [];
    abList.forEach(a => {
      const emp = employees.find(e => e.matricule === a.matricule);
      if (emp) {
        enConge.push({
          matricule: a.matricule,
          nom: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}`,
          type: escapeHtml(a.type_conge)
        });
      }
    });

    // Trouver les récupérations approuvées
    const recList = recuperations.filter(r => dateStr >= r.date_debut && dateStr <= r.date_fin);
    const enRecup = [];
    recList.forEach(r => {
      const emp = employees.find(e => e.matricule === r.matricule);
      if (emp) {
        enRecup.push({
          matricule: r.matricule,
          nom: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}`,
          motif: escapeHtml(r.motif),
          duree: r.duree
        });
      }
    });

    // Trouver les absents non justifiés (employés actifs qui n'ont ni pointage, ni congé, ni récap)
    const nonJustifies = [];
    employees.forEach(emp => {
      const hasPointage = pts.some(p => p.matricule === emp.matricule);
      const hasConge = abList.some(a => a.matricule === emp.matricule);
      const hasRecup = recList.some(r => r.matricule === emp.matricule);

      // Si aucun des trois
      if (!hasPointage && !hasConge && !hasRecup) {
        nonJustifies.push({
          matricule: emp.matricule,
          nom: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}`,
          poste: escapeHtml(emp.poste)
        });
      }
    });

    container.innerHTML = `
      <!-- Présents -->
      <div>
        <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--color-success); display: flex; align-items: center; gap: 6px;">
          <span style="background-color: var(--color-success); width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
          Présents (${presents.length})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${presents.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted); padding-left: 14px;">Aucun présent enregistré</div>` : presents.map(p => `
            <div style="font-size: 0.8rem; background-color: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${p.nom}</strong>
                <span class="badge primary" style="font-size: 0.65rem; padding: 2px 6px; margin-left: 6px;">${p.shift}</span>
              </div>
              <span style="font-weight: 600;">${p.entree || '--'} - ${p.sortie || '--'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- En Congé -->
      <div>
        <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--color-info); display: flex; align-items: center; gap: 6px;">
          <span style="background-color: var(--color-info); width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
          En Congé (${enConge.length})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${enConge.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted); padding-left: 14px;">Aucun congé ce jour</div>` : enConge.map(c => `
            <div style="font-size: 0.8rem; background-color: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
              <strong>${c.nom}</strong>
              <span class="badge primary" style="font-size: 0.7rem;">${c.type}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- En Récupération -->
      <div>
        <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--color-warning); display: flex; align-items: center; gap: 6px;">
          <span style="background-color: var(--color-warning); width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
          En Récupération (${enRecup.length})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${enRecup.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted); padding-left: 14px;">Aucune récupération ce jour</div>` : enRecup.map(r => `
            <div style="font-size: 0.8rem; background-color: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${r.nom}</strong> <br>
                <span style="font-size: 0.7rem; color: var(--text-secondary);">${r.motif}</span>
              </div>
              <span class="badge warning" style="font-size: 0.7rem;">${r.duree}h</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Absences Non Justifiées -->
      <div>
        <h4 style="margin-bottom: 8px; font-weight: 700; font-size: 0.9rem; color: var(--color-danger); display: flex; align-items: center; gap: 6px;">
          <span style="background-color: var(--color-danger); width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
          Non Pointés (${nonJustifies.length})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${nonJustifies.length === 0 ? `<div style="font-size: 0.8rem; color: var(--text-muted); padding-left: 14px;">Tout le personnel est en règle.</div>` : nonJustifies.map(nj => `
            <div style="font-size: 0.8rem; background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
              <strong>${nj.nom}</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${nj.poste}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};
