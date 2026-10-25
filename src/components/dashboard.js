import { api } from '../api.js';
import { getCurrentUser, animateCountUp } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';

export const DashboardComponent = {
  title: 'Tableau de Bord',
  subtitle: 'Aperçu général et statistiques RH',

  async render() {
    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';
    const isSupervisor = user.role === 'supervisor';

    let employees = [];
    let pointages = [];
    let recuperations = [];
    let absences = [];

    try {
      employees = await api.getEmployees();
      pointages = await api.getPointages();
      recuperations = await api.getRecuperations();
      absences = await api.getAbsences();
    } catch (e) {
      console.error("Erreur de chargement du tableau de bord :", e);
    }

    // Déterminer la date cible (dernière date enregistrée dans les pointages, ou aujourd'hui)
    let targetDate = new Date().toISOString().split('T')[0];
    if (pointages.length > 0) {
      const dates = pointages.map(p => p.date).sort();
      targetDate = dates[dates.length - 1];
    }

    const parts = targetDate.split('-');
    const dateAfficheeStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : targetDate;

    // --- RENDU PORTAIL COLLABORATEUR (EMPLOYEE) ---
    if (isEmployee) {
      const mesPointages = pointages.filter(p => p.matricule === user.matricule);
      const mesRecups = recuperations.filter(r => r.matricule === user.matricule);
      const mesAbs = absences.filter(a => a.matricule === user.matricule);

      // Calculer ses statistiques individuelles
      const joursPointes = mesPointages.length;
      const totalRetards = mesPointages.reduce((sum, p) => sum + (p.retard || 0), 0);
      
      // Trouver son profil frais en DB pour les soldes exacts
      const monProfil = employees.find(e => e.matricule === user.matricule) || user;

      // Activités récentes de l'employé
      const activites = [];
      mesPointages.slice(-4).forEach(p => {
        if (p.heure_entree) {
          activites.push({
            titre: 'Pointage - Entrée',
            details: `Le ${formatDateFR(p.date)} à ${p.heure_entree}`,
            icon: 'clock',
            badgeClass: p.retard > 0 ? 'warning' : 'success',
            badgeText: p.retard > 0 ? `Retard ${p.retard}m` : 'Présent',
            timestamp: new Date(`${p.date}T${p.heure_entree}`)
          });
        }
        if (p.heure_sortie) {
          activites.push({
            titre: 'Pointage - Sortie',
            details: `Le ${formatDateFR(p.date)} à ${p.heure_sortie}`,
            icon: 'log-out',
            badgeClass: p.heures_supp > 0 ? 'primary' : 'success',
            badgeText: p.heures_supp > 0 ? `+${p.heures_supp}h Supp` : 'Fini',
            timestamp: new Date(`${p.date}T${p.heure_sortie}`)
          });
        }
      });

      mesRecups.slice(-2).forEach(r => {
        activites.push({
          titre: 'Demande de Récupération',
          details: `${escapeHtml(r.motif)} (${r.duree}h)`,
          icon: 'calendar-days',
          badgeClass: r.statut === 'Approuvé' ? 'success' : (r.statut === 'Refusé' ? 'danger' : 'warning'),
          badgeText: r.statut,
          timestamp: new Date(`${r.date_demande}T00:00:00`)
        });
      });

      mesAbs.slice(-2).forEach(a => {
        activites.push({
          titre: 'Demande de Congé',
          details: `Congé ${a.type_conge} : du ${formatDateFR(a.date_debut)} au ${formatDateFR(a.date_fin)}`,
          icon: 'plane-takeoff',
          badgeClass: a.statut === 'Approuvé' ? 'success' : (a.statut === 'Refusé' ? 'danger' : 'warning'),
          badgeText: a.statut,
          timestamp: new Date(`${a.date_demande}T00:00:00`)
        });
      });

      activites.sort((a, b) => b.timestamp - a.timestamp);
      const mesActivitesAff = activites.slice(0, 5);

      return `
        <div style="background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); border-radius: var(--radius-lg); padding: 24px 30px; margin-bottom: 24px; color: white;">
          <h2 style="font-weight: 800; font-size: 1.5rem; margin-bottom: 6px;">Ravi de vous revoir, ${escapeHtml(monProfil.prenom)} !</h2>
          <p style="opacity: 0.85; font-size: 0.95rem;">Voici l'état récapitulatif de votre assiduité et vos soldes de repos.</p>
        </div>

        <div class="stats-grid">
          <div class="card stat-card">
            <div class="stat-info">
              <span class="stat-label">Solde Récupération</span>
              <span class="stat-value" style="color: var(--color-primary);" data-count-target="${parseFloat((monProfil.solde_recuperation / 8).toFixed(2))}" data-count-decimals="2" data-count-suffix=" j">0 j</span>
            </div>
            <div class="stat-icon primary">
              <i data-lucide="award"></i>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-info">
              <span class="stat-label">Solde Congés</span>
              <span class="stat-value" style="color: var(--color-success);" data-count-target="${monProfil.solde_conge}" data-count-suffix=" j">0 j</span>
            </div>
            <div class="stat-icon success">
              <i data-lucide="plane-takeoff"></i>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-info">
              <span class="stat-label">Jours Pointés</span>
              <span class="stat-value" data-count-target="${joursPointes}">0</span>
            </div>
            <div class="stat-icon info">
              <i data-lucide="calendar"></i>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-info">
              <span class="stat-label">Minutes Retard</span>
              <span class="stat-value" style="color: ${totalRetards > 0 ? 'var(--color-warning)' : 'inherit'};" data-count-target="${totalRetards}" data-count-suffix=" m">0 m</span>
            </div>
            <div class="stat-icon warning">
              <i data-lucide="alarm-clock"></i>
            </div>
          </div>
        </div>

        <div class="dashboard-layout">
          <!-- Graphique Heures Individuelles -->
          <div class="card">
            <h3 style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="trending-up" style="color: var(--color-primary);"></i>
              Heures travaillées sur vos derniers pointages
            </h3>
            <div style="height: 320px; position: relative;">
              <canvas id="individualHoursChart"></canvas>
            </div>
          </div>

          <!-- Activités Récentes -->
          <div class="card">
            <h3 style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="activity" style="color: var(--color-info);"></i>
              Historique de vos Demandes
            </h3>
            <div class="activity-list">
              ${mesActivitesAff.length === 0 ? `
                <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                  Aucune activité récente.
                </div>
              ` : mesActivitesAff.map(act => `
                <div class="activity-item">
                  <div class="activity-avatar" style="background-color: rgba(124, 58, 237, 0.05); color: var(--color-primary);">
                    <i data-lucide="${act.icon}"></i>
                  </div>
                  <div class="activity-details">
                    <div class="activity-title" style="font-weight:700;">${act.titre}</div>
                    <div class="activity-subtitle">${act.details}</div>
                  </div>
                  <span class="badge ${act.badgeClass}">${act.badgeText}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // --- RENDU PORTAIL SUPERVISEUR / HR (GLOBAL STATS) ---
    // Filtrer par département si Superviseur
    const deptEmployees = isSupervisor 
      ? employees.filter(e => e.departement === user.departement) 
      : employees;

    const matriculesList = deptEmployees.map(e => e.matricule);
    const pointagesDuJour = pointages.filter(p => p.date === targetDate && matriculesList.includes(p.matricule));

    const presents = pointagesDuJour.filter(p => p.heure_entree && !p.anomalie).length;
    const anomalies = pointagesDuJour.filter(p => p.anomalie).length;
    const retards = pointagesDuJour.filter(p => p.retard > 0).length;

    // Compter les demandes en attente (HR ou spécifiques au département du Superviseur)
    const demandesAttente = recuperations.filter(r => r.statut === 'En attente' && matriculesList.includes(r.matricule)).length;

    // Activités récentes
    const activites = [];
    pointagesDuJour.slice(0, 5).forEach(p => {
      const emp = deptEmployees.find(e => e.matricule === p.matricule);
      if (emp) {
        activites.push({
          type: 'pointage',
          titre: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)} - Entrée`,
          details: `Arrivé à ${p.heure_entree} (${escapeHtml(emp.departement)})`,
          heure: p.heure_entree,
          badgeClass: p.retard > 0 ? 'warning' : 'success',
          badgeText: p.retard > 0 ? `Retard ${p.retard}m` : 'Normal',
          icon: 'clock',
          timestamp: new Date(`${p.date}T${p.heure_entree}`)
        });
        if (p.heure_sortie) {
          activites.push({
            type: 'pointage',
            titre: `${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)} - Sortie`,
            details: `Sortie à ${p.heure_sortie} - Travail: ${p.heures_travaillees}h`,
            heure: p.heure_sortie,
            badgeClass: p.heures_supp > 0 ? 'primary' : 'success',
            badgeText: p.heures_supp > 0 ? `+${p.heures_supp}h Supp` : 'Fini',
            icon: 'log-out',
            timestamp: new Date(`${p.date}T${p.heure_sortie}`)
          });
        }
      }
    });

    recuperations.filter(r => r.statut === 'En attente' && matriculesList.includes(r.matricule)).slice(0, 3).forEach(r => {
      const emp = deptEmployees.find(e => e.matricule === r.matricule);
      if (emp) {
        activites.push({
          type: 'recup',
          titre: `Demande de Récupération - ${escapeHtml(emp.prenom)} ${escapeHtml(emp.nom)}`,
          details: `Motif : ${escapeHtml(r.motif)} (${parseFloat((r.duree / 8).toFixed(2))} j)`,
          heure: 'En attente',
          badgeClass: 'warning',
          badgeText: 'Attente',
          icon: 'award',
          timestamp: new Date(`${r.date_demande}T00:00:00`)
        });
      }
    });

    activites.sort((a, b) => b.timestamp - a.timestamp);
    const activitesAff = activites.slice(0, 5);

    return `
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-info">
            <span class="stat-label">Effectif ${isSupervisor ? 'Section' : 'Total'}</span>
            <span class="stat-value" data-count-target="${deptEmployees.length}">0</span>
          </div>
          <div class="stat-icon primary">
            <i data-lucide="users"></i>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-info">
            <span class="stat-label">Présents (${dateAfficheeStr})</span>
            <span class="stat-value" data-count-target="${presents}">0</span>
          </div>
          <div class="stat-icon success">
            <i data-lucide="user-check"></i>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-info">
            <span class="stat-label">Retards (${dateAfficheeStr})</span>
            <span class="stat-value" data-count-target="${retards}">0</span>
          </div>
          <div class="stat-icon warning">
            <i data-lucide="alarm-clock"></i>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-info">
            <span class="stat-label">Récupérations en Attente</span>
            <span class="stat-value" data-count-target="${demandesAttente}">0</span>
          </div>
          <div class="stat-icon info">
            <i data-lucide="hourglass"></i>
          </div>
        </div>
      </div>

      <div class="dashboard-layout">
        <!-- Chart Section -->
        <div class="card">
          <h3 style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="trending-up" style="color: var(--color-primary);"></i>
            Statistiques de Présence par Département
          </h3>
          <div style="height: 320px; position: relative;">
            <canvas id="attendanceChart"></canvas>
          </div>
        </div>

        <!-- Activity Feed -->
        <div class="card">
          <h3 style="margin-bottom: 16px; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="activity" style="color: var(--color-info);"></i>
            Suivi d'Activité (${dateAfficheeStr})
          </h3>
          <div class="activity-list">
            ${activitesAff.length === 0 ? `
              <div style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                Aucune activité enregistrée.
              </div>
            ` : activitesAff.map(act => `
              <div class="activity-item">
                <div class="activity-avatar" style="background-color: ${act.type === 'pointage' ? 'rgba(124, 58, 237, 0.05)' : 'rgba(245, 158, 11, 0.05)'}; color: ${act.type === 'pointage' ? 'var(--color-primary)' : 'var(--color-warning)'};">
                  <i data-lucide="${act.icon}"></i>
                </div>
                <div class="activity-details">
                  <div class="activity-title" style="font-weight:700;">${act.titre}</div>
                  <div class="activity-subtitle">${act.details}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <span class="badge ${act.badgeClass}">${act.badgeText}</span>
                  <span class="activity-time">${act.heure}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    const user = getCurrentUser();
    const isEmployee = user.role === 'employee';

    // Animer les compteurs des cartes statistiques
    document.querySelectorAll('.stat-value[data-count-target]').forEach(el => {
      const target = parseFloat(el.getAttribute('data-count-target')) || 0;
      const decimals = parseInt(el.getAttribute('data-count-decimals') || '0', 10);
      const suffix = el.getAttribute('data-count-suffix') || '';
      animateCountUp(el, target, { decimals, suffix });
    });

    // Rendre les graphiques
    if (isEmployee) {
      this.initIndividualChart(user.matricule);
    } else {
      this.initGlobalChart();
    }
  },

  async initIndividualChart(matricule) {
    try {
      if (this.individualChart) {
        this.individualChart.destroy();
        this.individualChart = null;
      }
      const existingChart = window.Chart?.getChart?.('individualHoursChart');
      if (existingChart) existingChart.destroy();

      const logs = await api.getPointages(null, matricule);
      // Prendre les 7 derniers logs triés par date
      logs.sort((a, b) => a.date.localeCompare(b.date));
      const lastLogs = logs.slice(-7);

      const labels = lastLogs.map(l => l.date.split('-').slice(1).reverse().join('/'));
      const hoursData = lastLogs.map(l => l.heures_travaillees || 0);

      const ctx = document.getElementById('individualHoursChart');
      if (ctx) {
        this.individualChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Heures Travaillées (h)',
              data: hoursData,
              backgroundColor: 'rgba(124, 58, 237, 0.15)',
              borderColor: '#7C3AED',
              borderWidth: 2,
              tension: 0.3,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { color: '#475569' } },
              y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { color: '#475569' }, min: 0 }
            }
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  },

  async initGlobalChart() {
    try {
      if (this.globalChart) {
        this.globalChart.destroy();
        this.globalChart = null;
      }
      // Filet de sécurité : si un chart existe déjà sur ce canvas (ex: rendu concurrent
      // non intercepté par ailleurs), le détruire avant d'en créer un nouveau plutôt que
      // de laisser Chart.js lever une erreur qui interromprait tout le rendu du tableau de bord.
      const existingChart = window.Chart?.getChart?.('attendanceChart');
      if (existingChart) existingChart.destroy();

      const user = getCurrentUser();
      const employees = await api.getEmployees();
      const pointages = await api.getPointages();

      // Filtrer les employés du département du superviseur
      const targetEmployees = user.role === 'supervisor' 
        ? employees.filter(e => e.departement === user.departement)
        : employees;

      let targetDate = new Date().toISOString().split('T')[0];
      if (pointages.length > 0) {
        const dates = pointages.map(p => p.date).sort();
        targetDate = dates[dates.length - 1];
      }

      const pointagesDuJour = pointages.filter(p => p.date === targetDate);

      // Grouper les employés par département
      const depts = {};
      targetEmployees.forEach(emp => {
        if (!depts[emp.departement]) {
          depts[emp.departement] = { total: 0, presents: 0 };
        }
        depts[emp.departement].total++;
        
        // Est-il présent aujourd'hui ?
        const p = pointagesDuJour.find(pt => pt.matricule === emp.matricule);
        if (p && p.heure_entree && !p.anomalie) {
          depts[emp.departement].presents++;
        }
      });

      const labels = Object.keys(depts);
      const totalData = labels.map(d => depts[d].total);
      const presentData = labels.map(d => depts[d].presents);

      const ctx = document.getElementById('attendanceChart');
      if (ctx) {
        this.globalChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Effectif Total',
                data: totalData,
                backgroundColor: 'rgba(124, 58, 237, 0.15)',
                borderColor: '#7C3AED',
                borderWidth: 1.5,
                borderRadius: 6,
              },
              {
                label: 'Présents',
                data: presentData,
                backgroundColor: 'rgba(16, 185, 129, 0.35)',
                borderColor: '#10b981',
                borderWidth: 1.5,
                borderRadius: 6,
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  color: '#475569',
                  font: { family: 'Plus Jakarta Sans', weight: 500 }
                }
              }
            },
            scales: {
              x: { grid: { color: 'rgba(15, 23, 42, 0.05)' }, ticks: { color: '#475569' } },
              y: { grid: { color: 'rgba(15, 23, 42, 0.05)' }, ticks: { color: '#475569', stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }
};
