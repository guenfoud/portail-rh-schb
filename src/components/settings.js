import { api } from '../api.js';
import { renderTimePicker, getTimePickerValue, toast, confirmDialog } from '../main.js';
import { escapeHtml } from '../utils.js';

export const SettingsComponent = {
  title: 'Configuration de l\'Application',
  subtitle: 'Paramètres réglementaires et gestion de la base de données',

  async render() {
    let settings = {};
    try {
      settings = await api.getSettings();
    } catch (e) {
      console.error(e);
    }

    const config = {
      horaires: { debutNormal: '08:00', finNormale: '16:00', toleranceRetard: 15, seuilHeuresSupp: 60, nuitDebut: '22:00', nuitFin: '06:00', coeffNuit: 1.25 },
      shifts: { matin: { debut: '06:00', fin: '14:00' }, apresmidi: { debut: '14:00', fin: '22:00' }, nuit: { debut: '22:00', fin: '06:00' } },
      joursFeries: [],
      zkteco: { enabled: false, ip: '192.168.1.201', port: 4370, interval: 5 },
      accrual: { joursParMois: 0 },
      ...settings
    };

    return `
      <div class="row-cols-2">
        <!-- Configuration des Horaires et Shifts (3x8) -->
        <div class="card">
          <h3 style="margin-bottom: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="clock" style="color: var(--color-primary);"></i>
            Paramètres Horaires & Shifts 3x8
          </h3>
          
          <form id="settings-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="form-row">
              <div class="form-group">
                <label>Entrée standard de jour</label>
                ${renderTimePicker('set-debut', config.horaires.debutNormal, true)}
              </div>
              <div class="form-group">
                <label>Sortie standard de jour</label>
                ${renderTimePicker('set-fin', config.horaires.finNormale, true)}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="set-tolerance">Tolérance retard (minutes)</label>
                <input type="number" id="set-tolerance" class="form-control" value="${config.horaires.toleranceRetard}" min="0">
              </div>
              <div class="form-group">
                <label for="set-seuil">Déclenchement H. Supp (minutes)</label>
                <input type="number" id="set-seuil" class="form-control" value="${config.horaires.seuilHeuresSupp}" min="0">
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 8px;">
              <h4 style="font-weight: 700; font-size: 0.95rem; margin-bottom: 12px; color: var(--color-secondary);">Majoration Heures de Nuit</h4>
              <div class="form-row">
                <div class="form-group">
                  <label for="set-nuit-coeff">Coefficient majoration nuit (ex: 1.25 = +25%)</label>
                  <input type="number" step="0.05" id="set-nuit-coeff" class="form-control" value="${config.horaires.coeffNuit || 1.25}">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end; justify-content: flex-end;">
                  <button class="btn btn-primary" type="button" id="btn-save-settings" style="width: 100%; height: 46px;">Enregistrer les Paramètres</button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Sauvegarde et Récupération Base de données -->
          <div class="card" style="display: flex; flex-direction: column; gap: 20px;">
            <h3 style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="database" style="color: var(--color-info);"></i>
              Maintenance de la Base SQLite
            </h3>
            
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
              L'application stocke les données dans une base relationnelle SQLite centralisée sur le serveur de l'entreprise.
            </p>

            <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
              <div style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
                <i data-lucide="info" style="color: var(--color-info); flex-shrink: 0;"></i>
                <span>Les sauvegardes globales de la base SQLite s'effectuent directement en copiant le fichier <code>C:\\RH\\db\\database.sqlite</code> sur un disque externe.</span>
              </div>
            </div>
          </div>

          <!-- Configuration Serveur de Messagerie SMTP (Emails de Validation) -->
          <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="mail" style="color: #2563eb;"></i>
              Serveur de Messagerie SMTP (Validation des Congés)
            </h3>

            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
              Serveur configuré pour l'expédition des notifications de congés, alertes d'intérim et confirmations DRH.
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px; background: var(--bg-tertiary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted); font-weight: 600;">Serveur SMTP :</span>
                <span style="font-weight: 700; color: var(--text-primary);">mail.dz-com.com (Port 587)</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted); font-weight: 600;">Compte expéditeur :</span>
                <span style="font-weight: 700; color: #2563eb;">it@dz-com.com</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted); font-weight: 600;">Nom d'affichage :</span>
                <span style="font-weight: 700; color: var(--text-primary);">Portail RH GICA</span>
              </div>
            </div>

            <div style="display: flex; gap: 10px; align-items: flex-end;">
              <div style="flex: 1;">
                <label for="smtp-test-dest" style="font-size: 0.82rem; font-weight: 600; margin-bottom: 4px; display: block;">Destinataire pour test :</label>
                <input type="email" id="smtp-test-dest" class="form-control" value="it@dz-com.com" style="height: 42px;">
              </div>
              <button type="button" class="btn btn-secondary" id="btn-test-smtp" style="height: 42px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                <i data-lucide="send" style="width: 14px; height: 14px;"></i>
                Tester l'envoi
              </button>
            </div>
            <div id="smtp-test-feedback" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 0.82rem;"></div>
          </div>

          <!-- Configuration de la Pointeuse ZKTeco -->
          <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="fingerprint" style="color: var(--color-primary);"></i>
              Pointeuse Biométrique ZKTeco
            </h3>
            
            <form id="zkteco-form" style="display: flex; flex-direction: column; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <input type="checkbox" id="zk-enabled" style="width: 18px; height: 18px; cursor: pointer;" ${config.zkteco?.enabled ? 'checked' : ''}>
                <label for="zk-enabled" style="font-weight: 700; cursor: pointer; margin-bottom: 0; font-size: 0.9rem;">Activer la synchronisation en temps réel</label>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="zk-ip">Adresse IP de la Pointeuse</label>
                  <input type="text" id="zk-ip" class="form-control" value="${config.zkteco?.ip || '192.168.1.201'}" placeholder="ex: 192.168.1.201">
                </div>
                <div class="form-group">
                  <label for="zk-port">Port (défaut: 4370)</label>
                  <input type="number" id="zk-port" class="form-control" value="${config.zkteco?.port || 4370}">
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="zk-interval">Intervalle de synchro (min)</label>
                  <input type="number" id="zk-interval" class="form-control" value="${config.zkteco?.interval || 5}" min="1">
                </div>
                <div class="form-group" style="display: flex; align-items: flex-end; gap: 8px;">
                  <button type="button" class="btn btn-secondary" id="btn-test-zkteco" style="flex: 1; height: 42px; font-size: 0.85rem; padding: 0 8px;">
                    Tester
                  </button>
                  <button type="button" class="btn btn-secondary" id="btn-sync-zkteco" style="flex: 1; height: 42px; font-size: 0.85rem; padding: 0 8px;" ${config.zkteco?.enabled ? '' : 'disabled'}>
                    Synchro
                  </button>
                </div>
              </div>

              <div id="zk-status-container" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-tertiary); padding: 10px 14px; border-radius: var(--radius-md); font-weight: 600; font-size: 0.85rem; border: 1px solid var(--border-color);">
                <span>Statut :</span>
                <span id="zk-status-badge" class="badge ${config.zkteco?.enabled ? 'success' : 'danger'}" style="padding: 4px 8px;">
                  ${config.zkteco?.enabled ? 'Service Actif' : 'Désactivé'}
                </span>
              </div>

              <button type="button" class="btn btn-primary" id="btn-save-zkteco" style="width: 100%; height: 44px; margin-top: 4px; font-size: 0.9rem;">
                Enregistrer la Configuration
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Section Jours Fériés -->
      <div class="card" style="margin-top: 24px;">
        <h3 style="margin-bottom: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="calendar" style="color: var(--color-warning);"></i>
          Calendrier des Jours Fériés
        </h3>
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input type="date" id="holiday-date-input" class="form-control" style="width: 200px;">
          <button class="btn btn-secondary" id="btn-add-holiday">Ajouter un jour férié</button>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="holidays-badges-container">
          <!-- Injecté par JS -->
        </div>
      </div>

      <!-- Accumulation Automatique des Congés -->
      <div class="card" style="margin-top: 24px;">
        <h3 style="margin-bottom: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="calendar-range" style="color: var(--color-success);"></i>
          Accumulation Automatique des Congés
        </h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">
          Si activée, chaque employé actif reçoit automatiquement ce nombre de jours de congé pour chaque mois
          entièrement écoulé depuis sa dernière régularisation (calcul quotidien + au démarrage du serveur).
        </p>
        <div class="form-row" style="align-items: flex-end;">
          <div class="form-group">
            <label for="set-accrual-rate">Jours accordés par mois (0 = désactivé)</label>
            <input type="number" step="0.25" min="0" id="set-accrual-rate" class="form-control" value="${config.accrual?.joursParMois || 0}">
          </div>
          <div class="form-group" style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-primary" id="btn-save-accrual" style="flex: 1; height: 42px;">Enregistrer</button>
            <button type="button" class="btn btn-secondary" id="btn-run-accrual" style="flex: 1; height: 42px;">Exécuter maintenant</button>
          </div>
        </div>
      </div>

      <!-- Journal d'Audit -->
      <div class="card" style="margin-top: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="history" style="color: var(--color-primary);"></i>
            Journal d'Audit
          </h3>
          <button type="button" class="btn btn-secondary" id="btn-refresh-audit" style="height: 36px; font-size: 0.8rem;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Actualiser
          </button>
        </div>
        <div class="table-container" id="audit-log-container" style="max-height: 340px; overflow-y: auto;">
          <!-- Injecté par JS -->
        </div>
      </div>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // Enregistrer les paramètres horaires
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveSettings());
    }

    // Tester l'envoi d'email SMTP
    const btnTestSmtp = document.getElementById('btn-test-smtp');
    if (btnTestSmtp) {
      btnTestSmtp.addEventListener('click', async () => {
        const destInput = document.getElementById('smtp-test-dest');
        const feedback = document.getElementById('smtp-test-feedback');
        const destinataire = destInput ? destInput.value.trim() : 'it@dz-com.com';

        btnTestSmtp.innerHTML = `<span class="btn-spinner"></span> Envoi...`;
        btnTestSmtp.disabled = true;
        if (feedback) feedback.style.display = 'none';

        try {
          const res = await api.testSmtp(destinataire);
          toast(res.message || "Email de test transmis avec succès !", 'success');
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#f0fdf4';
            feedback.style.color = '#15803d';
            feedback.style.border = '1px solid #bbf7d0';
            feedback.innerText = res.message;
          }
        } catch (err) {
          toast(err.message || "Erreur lors de l'envoi de l'email test.", 'danger');
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.innerText = `Erreur SMTP : ${err.message}`;
          }
        } finally {
          btnTestSmtp.innerHTML = `<i data-lucide="send" style="width: 14px; height: 14px;"></i> Tester l'envoi`;
          btnTestSmtp.disabled = false;
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    // Tester la connexion ZKTeco
    const btnTestZk = document.getElementById('btn-test-zkteco');
    if (btnTestZk) {
      btnTestZk.addEventListener('click', async () => {
        const ip = document.getElementById('zk-ip').value.trim();
        const port = Number(document.getElementById('zk-port').value);
        
        btnTestZk.innerText = "Connexion...";
        btnTestZk.disabled = true;
        
        try {
          const res = await api.testZkteco(ip, port);
          toast(res.message || "Connexion réussie !", 'success');
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        } finally {
          btnTestZk.innerText = "Tester";
          btnTestZk.disabled = false;
        }
      });
    }

    // Synchroniser maintenant ZKTeco
    const btnSyncZk = document.getElementById('btn-sync-zkteco');
    if (btnSyncZk) {
      btnSyncZk.addEventListener('click', async () => {
        btnSyncZk.innerText = "Synchro...";
        btnSyncZk.disabled = true;
        
        try {
          const res = await api.syncZkteco();
          toast(res.message || "Synchronisation réussie !", 'success');
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        } finally {
          btnSyncZk.innerText = "Synchro";
          btnSyncZk.disabled = false;
        }
      });
    }

    // Checkbox toggle synchro
    const zkEnabledCb = document.getElementById('zk-enabled');
    const btnSyncZkEl = document.getElementById('btn-sync-zkteco');
    if (zkEnabledCb) {
      zkEnabledCb.addEventListener('change', (e) => {
        if (btnSyncZkEl) {
          btnSyncZkEl.disabled = !e.target.checked;
        }
      });
    }

    // Enregistrer la configuration ZKTeco
    const btnSaveZk = document.getElementById('btn-save-zkteco');
    if (btnSaveZk) {
      btnSaveZk.addEventListener('click', async () => {
        const enabled = zkEnabledCb.checked;
        const ip = document.getElementById('zk-ip').value.trim();
        const port = Number(document.getElementById('zk-port').value);
        const interval = Number(document.getElementById('zk-interval').value);
        
        if (!ip) {
          toast("Veuillez saisir une adresse IP.", 'warning');
          return;
        }

        try {
          const current = await api.getSettings();
          const newSettings = {
            ...current,
            zkteco: { enabled, ip, port, interval }
          };

          await api.saveSettings(newSettings);
          toast("Configuration ZKTeco enregistrée avec succès !", 'success');

          const badge = document.getElementById('zk-status-badge');
          if (badge) {
            badge.innerText = enabled ? 'Service Actif' : 'Désactivé';
            badge.className = `badge ${enabled ? 'success' : 'danger'}`;
          }
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        }
      });
    }

    // Jours Fériés
    const btnAddHoliday = document.getElementById('btn-add-holiday');
    if (btnAddHoliday) {
      btnAddHoliday.addEventListener('click', () => this.addHoliday());
    }

    // Accumulation des congés
    const btnSaveAccrual = document.getElementById('btn-save-accrual');
    if (btnSaveAccrual) {
      btnSaveAccrual.addEventListener('click', async () => {
        const rate = parseFloat(document.getElementById('set-accrual-rate').value) || 0;
        try {
          const current = await api.getSettings();
          await api.saveSettings({ ...current, accrual: { joursParMois: rate } });
          toast('Taux d\'accumulation enregistré.', 'success');
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        }
      });
    }

    const btnRunAccrual = document.getElementById('btn-run-accrual');
    if (btnRunAccrual) {
      btnRunAccrual.addEventListener('click', async () => {
        btnRunAccrual.disabled = true;
        btnRunAccrual.innerText = 'Exécution...';
        try {
          const res = await api.runCongeAccrual();
          toast(`Régularisation effectuée : ${res.updated} employé(s) mis à jour.`, 'success');
        } catch (err) {
          toast(`Erreur: ${err.message}`, 'danger');
        } finally {
          btnRunAccrual.disabled = false;
          btnRunAccrual.innerText = 'Exécuter maintenant';
        }
      });
    }

    // Journal d'audit
    const btnRefreshAudit = document.getElementById('btn-refresh-audit');
    if (btnRefreshAudit) {
      btnRefreshAudit.addEventListener('click', () => this.renderAuditLog());
    }

    await this.renderHolidaysBadges();
    await this.renderAuditLog();
  },

  // --- JOURNAL D'AUDIT ---
  async renderAuditLog() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;">Chargement...</div>`;

    try {
      const entries = await api.getAuditLog(100);
      if (entries.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.85rem;">Aucune action enregistrée pour le moment.</div>`;
        return;
      }

      container.innerHTML = `
        <table class="custom-table" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Acteur</th>
              <th>Action</th>
              <th>Cible</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td style="white-space: nowrap;">${escapeHtml(new Date(e.created_at).toLocaleString('fr-FR'))}</td>
                <td>${escapeHtml(e.matricule_acteur || e.nom_acteur || '—')}</td>
                <td>${escapeHtml(e.action)}</td>
                <td>${escapeHtml(e.cible || '—')}</td>
                <td style="color: var(--text-muted);">${escapeHtml(e.details || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger" style="margin: 16px;">Erreur: ${escapeHtml(err.message)}</div>`;
    }
  },

  async saveSettings() {
    const debut = getTimePickerValue('set-debut');
    const fin = getTimePickerValue('set-fin');
    const tolerance = Number(document.getElementById('set-tolerance').value);
    const seuil = Number(document.getElementById('set-seuil').value);
    const coeffNuit = Number(document.getElementById('set-nuit-coeff').value);

    if (!debut || !fin) {
      toast("Veuillez renseigner les horaires d'entrée et de sortie standard.", 'warning');
      return;
    }

    try {
      const current = await api.getSettings();
      const newSettings = {
        ...current,
        horaires: {
          ...current.horaires,
          debutNormal: debut,
          finNormale: fin,
          toleranceRetard: tolerance,
          seuilHeuresSupp: seuil,
          coeffNuit: coeffNuit
        }
      };

      await api.saveSettings(newSettings);
      toast("Paramètres enregistrés avec succès !", 'success');
    } catch (err) {
      toast(`Erreur: ${err.message}`, 'danger');
    }
  },

  // --- JOURS FERIES ---
  async renderHolidaysBadges() {
    const container = document.getElementById('holidays-badges-container');
    if (!container) return;

    let config = {};
    try {
      config = await api.getSettings();
    } catch (e) {
      console.error(e);
    }

    const joursFeries = config.joursFeries || [];

    if (joursFeries.length === 0) {
      container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.9rem;">Aucun jour férié configuré.</span>`;
      return;
    }

    const sorted = [...joursFeries].sort();

    container.innerHTML = sorted.map(date => {
      const formatted = escapeHtml(date.split('-').reverse().join('/'));
      return `
        <span class="badge primary" style="padding: 6px 12px; gap: 8px; font-size: 0.85rem;">
          ${formatted}
          <i data-lucide="x" class="delete-holiday-btn" data-date="${escapeHtml(date)}" style="width: 14px; height: 14px; cursor: pointer; color: var(--color-danger);"></i>
        </span>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll('.delete-holiday-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const date = e.currentTarget.getAttribute('data-date');
        this.removeHoliday(date);
      });
    });
  },

  async addHoliday() {
    const dateInput = document.getElementById('holiday-date-input');
    const dateVal = dateInput.value;
    if (!dateVal) {
      toast("Veuillez sélectionner une date.", 'warning');
      return;
    }

    try {
      const config = await api.getSettings();
      config.joursFeries = config.joursFeries || [];

      if (config.joursFeries.includes(dateVal)) {
        toast("Ce jour férié existe déjà.", 'warning');
        return;
      }

      config.joursFeries.push(dateVal);
      await api.saveSettings(config);

      dateInput.value = '';
      await this.renderHolidaysBadges();
      toast('Jour férié ajouté.', 'success');
    } catch (err) {
      toast(err.message, 'danger');
    }
  },

  async removeHoliday(date) {
    const ok = await confirmDialog('Supprimer ce jour férié ?', { danger: true });
    if (!ok) return;
    try {
      const config = await api.getSettings();
      config.joursFeries = config.joursFeries || [];
      config.joursFeries = config.joursFeries.filter(d => d !== date);
      await api.saveSettings(config);
      await this.renderHolidaysBadges();
    } catch (err) {
      toast(err.message, 'danger');
    }
  }
};
