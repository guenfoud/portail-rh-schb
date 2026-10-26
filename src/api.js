// Support des tunnels distants (ngrok, etc.) et du proxy Vite local
const isDirectBackend = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8082';
const API_BASE = isDirectBackend ? `http://${window.location.hostname}:8081/api` : '/api';
const TOKEN_KEY = 'gica_hr_token';

// --- Gestion du jeton d'authentification (JWT) ---
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Se déclenche quand le serveur répond 401 (session invalide/expirée) afin que
// main.js puisse forcer une déconnexion propre, quel que soit l'endroit d'où
// l'appel API a été lancé.
function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

async function fetchJson(url, options = {}) {
  try {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (res.status === 401) {
      notifyUnauthorized();
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erreur serveur (code: ${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  async login(matricule, password) {
    // Le login ne doit jamais envoyer de jeton existant ni déclencher une déconnexion
    // automatique sur un éventuel 401 (identifiants invalides = comportement normal ici).
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erreur serveur (code: ${res.status})`);
    }
    return data;
  },

  // Employés
  async getEmployees() {
    return await fetchJson(`${API_BASE}/employees`);
  },

  async getEmployee(matricule) {
    return await fetchJson(`${API_BASE}/employees/${matricule}`);
  },

  async saveEmployee(employeeData) {
    return await fetchJson(`${API_BASE}/employees`, {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  },

  async deleteEmployee(matricule) {
    return await fetchJson(`${API_BASE}/employees/${matricule}`, {
      method: 'DELETE'
    });
  },

  // Pointages
  async getPointages(date = null, matricule = null) {
    let url = `${API_BASE}/pointages`;
    const params = [];
    if (date) params.push(`date=${date}`);
    if (matricule) params.push(`matricule=${matricule}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    return await fetchJson(url);
  },

  async savePointages(pointagesList) {
    return await fetchJson(`${API_BASE}/pointages`, {
      method: 'POST',
      body: JSON.stringify(pointagesList)
    });
  },

  async saveSinglePointage(pointage) {
    return await this.savePointages([pointage]);
  },

  async deletePointage(id) {
    return await fetchJson(`${API_BASE}/pointages/${id}`, {
      method: 'DELETE'
    });
  },

  // Récupérations
  async getRecuperations(matricule = null) {
    let url = `${API_BASE}/recuperations`;
    if (matricule) url += `?matricule=${matricule}`;
    return await fetchJson(url);
  },

  async saveRecuperation(recupData) {
    return await fetchJson(`${API_BASE}/recuperations`, {
      method: 'POST',
      body: JSON.stringify(recupData)
    });
  },

  async creditRecuperation(matricule, heures, motif) {
    return await fetchJson(`${API_BASE}/recuperations/credit`, {
      method: 'POST',
      body: JSON.stringify({ matricule, heures, motif })
    });
  },

  // Absences (Congés)
  async getAbsences(matricule = null) {
    let url = `${API_BASE}/absences`;
    if (matricule) url += `?matricule=${matricule}`;
    return await fetchJson(url);
  },

  async saveAbsence(absenceData) {
    return await fetchJson(`${API_BASE}/absences`, {
      method: 'POST',
      body: JSON.stringify(absenceData)
    });
  },

  async supervisorDecisionAbsence(id, statut) {
    return await fetchJson(`${API_BASE}/absences/${id}/supervisor-decision`, {
      method: 'POST',
      body: JSON.stringify({ statut })
    });
  },

  async getAbsenceJustificatif(id) {
    return await fetchJson(`${API_BASE}/absences/${id}/justificatif`);
  },

  async getAbsenceConflicts(matricule, date_debut, date_fin) {
    let url = `${API_BASE}/absences/conflicts?matricule=${encodeURIComponent(matricule)}&date_debut=${encodeURIComponent(date_debut)}&date_fin=${encodeURIComponent(date_fin)}`;
    return await fetchJson(url);
  },

  async supervisorDecisionRecuperation(id, statut) {
    return await fetchJson(`${API_BASE}/recuperations/${id}/supervisor-decision`, {
      method: 'POST',
      body: JSON.stringify({ statut })
    });
  },

  // Documents Employé
  async getEmployeeDocuments(matricule) {
    return await fetchJson(`${API_BASE}/employees/${matricule}/documents`);
  },

  async uploadEmployeeDocument(matricule, nom_fichier, type_doc, contenu) {
    return await fetchJson(`${API_BASE}/employees/${matricule}/documents`, {
      method: 'POST',
      body: JSON.stringify({ nom_fichier, type_doc, contenu })
    });
  },

  async getDocument(id) {
    return await fetchJson(`${API_BASE}/documents/${id}`);
  },

  async deleteDocument(id) {
    return await fetchJson(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
  },

  // Notifications & Journal d'audit
  async getNotifications() {
    return await fetchJson(`${API_BASE}/notifications`);
  },

  async markNotificationRead(id) {
    return await fetchJson(`${API_BASE}/notifications/${id}/mark-read`, { method: 'POST' });
  },

  async markAllNotificationsRead() {
    return await fetchJson(`${API_BASE}/notifications/mark-all-read`, { method: 'POST' });
  },

  async getPendingNotifications() {
    return await fetchJson(`${API_BASE}/notifications/pending`);
  },

  async getAuditLog(limit = 100) {
    return await fetchJson(`${API_BASE}/audit-log?limit=${limit}`);
  },

  // Organigramme & Hiérarchie
  async getHierarchy() {
    return await fetchJson(`${API_BASE}/hierarchy`);
  },

  async updateEmployeeSupervisor(matricule, superieur_matricule) {
    return await fetchJson(`${API_BASE}/employees/${matricule}/supervisor`, {
      method: 'POST',
      body: JSON.stringify({ superieur_matricule })
    });
  },

  // Intérims & Délégation
  async getInterims() {
    return await fetchJson(`${API_BASE}/interims`);
  },

  async saveInterim(interimData) {
    return await fetchJson(`${API_BASE}/interims`, {
      method: 'POST',
      body: JSON.stringify(interimData)
    });
  },

  async terminateInterim(id) {
    return await fetchJson(`${API_BASE}/interims/${id}/terminate`, {
      method: 'POST'
    });
  },

  // Accumulation des congés
  async runCongeAccrual() {
    return await fetchJson(`${API_BASE}/settings/accrual/run`, { method: 'POST' });
  },

  // Test du serveur SMTP
  async testSmtp(destinataire = null) {
    return await fetchJson(`${API_BASE}/settings/smtp/test`, {
      method: 'POST',
      body: JSON.stringify({ destinataire })
    });
  },

  // Paramètres
  async getSettings() {
    return await fetchJson(`${API_BASE}/settings`);
  },

  async saveSettings(settingsData) {
    return await fetchJson(`${API_BASE}/settings`, {
      method: 'POST',
      body: JSON.stringify(settingsData)
    });
  },

  async testZkteco(ip, port) {
    return await fetchJson(`${API_BASE}/settings/zkteco/test`, {
      method: 'POST',
      body: JSON.stringify({ ip, port })
    });
  },

  async syncZkteco() {
    return await fetchJson(`${API_BASE}/settings/zkteco/sync`, {
      method: 'POST'
    });
  },

  // Terminal Pointage
  async terminalPunch(matricule) {
    return await fetchJson(`${API_BASE}/terminal/punch`, {
      method: 'POST',
      body: JSON.stringify({ matricule })
    });
  },

  // --- Bons de Sortie & Ordres de mission ---
  async getBonsSortie(params = {}) {
    const q = new URLSearchParams(params).toString();
    return await fetchJson(`${API_BASE}/bons-sortie${q ? '?' + q : ''}`);
  },

  async createBonSortie(data) {
    return await fetchJson(`${API_BASE}/bons-sortie`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async decideBonSortie(id, action) {
    return await fetchJson(`${API_BASE}/bons-sortie/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  },

  async pointageRetourBonSortie(id, heure_retour_reelle = null) {
    return await fetchJson(`${API_BASE}/bons-sortie/${id}/retour`, {
      method: 'POST',
      body: JSON.stringify({ heure_retour_reelle })
    });
  },

  // --- Santé au travail & Habilitations Sécurité HSE ---
  async getHabilitations(params = {}) {
    const q = new URLSearchParams(params).toString();
    return await fetchJson(`${API_BASE}/habilitations${q ? '?' + q : ''}`);
  },

  async saveHabilitation(data) {
    return await fetchJson(`${API_BASE}/habilitations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteHabilitation(id) {
    return await fetchJson(`${API_BASE}/habilitations/${id}`, {
      method: 'DELETE'
    });
  },

  async checkHabilitationAlerts() {
    return await fetchJson(`${API_BASE}/habilitations/check-alerts`, {
      method: 'POST'
    });
  },

  // --- Demandes d'Attestations RH en 1 clic ---
  async getAttestations() {
    return await fetchJson(`${API_BASE}/attestations`);
  },

  async generateAttestation(data) {
    return await fetchJson(`${API_BASE}/attestations/generate`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- Primes Industrielles & Quotas d'effectifs ---
  async getPrimesSummary(mois = null, departement = null) {
    const params = new URLSearchParams();
    if (mois) params.set('mois', mois);
    if (departement) params.set('departement', departement);
    return await fetchJson(`${API_BASE}/pointages/primes-summary?${params.toString()}`);
  },

  async getDepartmentQuota(departement, date_debut, date_fin) {
    const params = new URLSearchParams({ departement, date_debut, date_fin });
    return await fetchJson(`${API_BASE}/absences/department-quota?${params.toString()}`);
  },

  // URL du flux temps réel (SSE), jeton transmis en paramètre de requête car
  // EventSource ne permet pas d'envoyer d'en-têtes personnalisés.
  eventsUrl() {
    const token = getToken();
    const baseUrl = isDirectBackend ? `http://${window.location.hostname}:8081` : '';
    return `${baseUrl}/api/events?token=${encodeURIComponent(token || '')}`;
  }
};
