import { api, setToken, clearToken, getToken } from './api.js';
import { DashboardComponent } from './components/dashboard.js';
import { EmployeesComponent } from './components/employees.js';
import { PointageComponent } from './components/pointage.js';
import { RecuperationComponent } from './components/recuperation.js';
import { AbsencesComponent } from './components/absences.js';
import { CalendarComponent } from './components/calendar.js';
import { TerminalComponent } from './components/terminal.js';
import { SettingsComponent } from './components/settings.js';
import { RecupeDetailComponent } from './components/recupedetail.js';
import { OrganigrammeComponent } from './components/organigramme.js';
import { translateDOM } from './i18n.js';
import { escapeHtml, formatTimeAgo } from './utils.js';

// Routeur pour la Single Page Application (SPA)
const routes = {
  dashboard: DashboardComponent,
  employees: EmployeesComponent,
  pointage: PointageComponent,
  recuperation: RecuperationComponent,
  absences: AbsencesComponent,
  organigramme: OrganigrammeComponent,
  calendar: CalendarComponent,
  terminal: TerminalComponent,
  settings: SettingsComponent,
  recupedetail: RecupeDetailComponent
};

let currentUser = null;
let activeComponent = null;
let activeModalSaveCallback = null;

// Verrou partagé : empêche deux rendus concurrents de la vue active (ex: la navigation
// initiale et un événement temps réel (SSE) qui arrive pendant qu'elle est encore en cours).
// Sans ce verrou, deux appels à component.init() en parallèle peuvent créer deux graphiques
// Chart.js sur le même canvas ("Canvas is already in use"), ce qui interrompt le rendu et
// laisse la vue vide.
let isRenderingView = false;

export function getCurrentUser() {
  return currentUser;
}

// Initialisation de l'application au chargement
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  initModalListeners();
  initLanguageToggle();
  initMobileMenuToggle();
  initDarkModeToggle();

  // Déconnexion forcée si le serveur répond 401 (jeton invalide/expiré) sur n'importe quel appel API
  window.addEventListener('auth:unauthorized', () => {
    if (currentUser) {
      toast("Votre session a expiré. Veuillez vous reconnecter.", 'warning');
    }
    forceLogout();
  });

  registerServiceWorker();
});

// PWA : uniquement en production. En développement, un service worker interfère avec
// le rechargement à chaud (HMR) de Vite en interceptant/mettant en cache les requêtes.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('Échec de l\'enregistrement du service worker :', err);
  });
}

// Menu mobile hamburger toggle — tiroir latéral (sidebar drawer)
function initMobileMenuToggle() {
  const toggleBtn = document.getElementById('mobile-sidebar-toggle');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (!toggleBtn || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('visible');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('visible');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  toggleBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Fermer quand on clique sur un lien de navigation
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Fermer en cliquant sur l'overlay
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Fermer au redimensionnement si on passe en mode desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}


// --- MODE SOMBRE ---
function applyDarkModeIcon(isDark) {
  const icon = document.getElementById('dark-mode-icon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }
}

function initDarkModeToggle() {
  document.documentElement.removeAttribute('data-theme');
  try { localStorage.removeItem('gica_theme'); } catch (e) {}
}

// --- CLOCHE DE NOTIFICATIONS (collaborateurs, superviseurs et DRH) ---
let notifPollIntervalId = null;
let knownNotifIds = new Set();
let isInitialNotifLoad = true;

async function refreshNotifications(showToastOnNew = false) {
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-dropdown-list');
  if (!badge || !list) return;

  try {
    const notifs = await api.getNotifications();
    const unread = notifs.filter(n => !n.lu);

    if (unread.length > 0) {
      badge.textContent = unread.length > 99 ? '99+' : String(unread.length);
      badge.hidden = false;
      badge.classList.remove('badge-pulse');
      void badge.offsetWidth;
      badge.classList.add('badge-pulse');
    } else {
      badge.hidden = true;
    }

    // Alerter l'utilisateur avec un toast en direct si une nouvelle notification arrive sans recharger la page
    if (!isInitialNotifLoad && showToastOnNew) {
      unread.forEach(n => {
        if (!knownNotifIds.has(n.id)) {
          const previewText = n.message.length > 80 ? `${n.message.slice(0, 80)}...` : n.message;
          toast(`🔔 <strong>${escapeHtml(n.titre)}</strong><br><span style="font-size: 0.8rem; opacity: 0.9;">${escapeHtml(previewText)}</span>`, 'info');
        }
      });
    }
    isInitialNotifLoad = false;
    knownNotifIds = new Set(notifs.map(n => n.id));

    if (notifs.length === 0) {
      list.innerHTML = `<div class="notif-empty" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        <i data-lucide="bell-off" style="width: 28px; height: 28px; opacity: 0.4; margin: 0 auto 8px auto; display: block;"></i>
        Aucune notification pour le moment.
      </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    list.innerHTML = `
      <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary);">
        <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
          <i data-lucide="bell" style="width: 14px; height: 14px; color: var(--color-primary);"></i>
          ${unread.length} non lue(s) sur ${notifs.length}
        </span>
        ${unread.length > 0 ? `
          <button id="btn-mark-all-notifs" style="background: none; border: none; color: var(--color-primary); font-size: 0.75rem; font-weight: 700; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.15s;">
            Tout marquer comme lu
          </button>
        ` : ''}
      </div>
      <div style="max-height: 380px; overflow-y: auto;">
        ${notifs.slice(0, 25).map(item => `
          <div class="notif-item ${item.lu ? 'read' : 'unread'}" 
               data-id="${item.id}" 
               data-target="${escapeHtml(item.lien || '#absences')}"
               data-title="${escapeHtml(item.titre)}"
               data-message="${escapeHtml(item.message)}"
               style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: all 0.15s; background-color: ${item.lu ? 'transparent' : 'rgba(13, 148, 136, 0.07)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
              <span class="notif-item-title" style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                ${!item.lu ? '<span style="width: 8px; height: 8px; border-radius: 50%; background-color: var(--color-primary); flex-shrink: 0; display: inline-block;"></span>' : ''}
                ${escapeHtml(item.titre)}
              </span>
              <span style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap;">${formatTimeAgo(item.created_at)}</span>
            </div>
            <p style="margin: 0 0 6px 0; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${escapeHtml(item.message)}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${item.email_sent ? `
                <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; color: var(--color-primary); font-weight: 600; background: rgba(13, 148, 136, 0.1); padding: 2px 7px; border-radius: 4px;">
                  <i data-lucide="mail-check" style="width: 12px; height: 12px;"></i>
                  ${item.email_destinataire ? escapeHtml(item.email_destinataire) : 'Email expédié'}
                </div>
              ` : '<span></span>'}
              <span style="font-size: 0.72rem; color: var(--color-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
                Ouvrir <i data-lucide="chevron-right" style="width: 12px; height: 12px;"></i>
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const btnMarkAll = document.getElementById('btn-mark-all-notifs');
    if (btnMarkAll) {
      btnMarkAll.addEventListener('click', async (e) => {
        e.stopPropagation();
        await api.markAllNotificationsRead();
        await refreshNotifications(false);
      });
    }

    list.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        let target = el.getAttribute('data-target') || '#absences';
        const notifTitre = el.getAttribute('data-title') || '';
        const notifMsg = el.getAttribute('data-message') || '';

        // Détection intelligente de l'onglet précis si aucun query param n'est spécifié
        if (target === '#absences') {
          if (/en attente|validation|avis préalable|à approuver|nouvelle demande/i.test(notifTitre + ' ' + notifMsg)) {
            target = '#absences?tab=attente';
          } else if (/approuvé|favorable|refusé|rejeté|confirmation/i.test(notifTitre + ' ' + notifMsg)) {
            target = '#absences?tab=historique';
          }
        } else if (target === '#recuperation') {
          if (/en attente|validation|nouvelle demande/i.test(notifTitre + ' ' + notifMsg)) {
            target = '#recuperation?tab=attente';
          } else {
            target = '#recuperation?tab=historique';
          }
        }

        // Marquer la notification comme lue immédiatement
        try {
          await api.markNotificationRead(id);
        } catch (e) {}

        // Fermer le volet déroulant
        const notifDropdown = document.getElementById('notif-dropdown');
        if (notifDropdown) notifDropdown.hidden = true;

        // Mettre à jour le compteur badge sans délai
        refreshNotifications(false);

        // NAVIGATION GARANTIE VERS LA PAGE CONCERNÉE
        const currentHash = window.location.hash;
        if (currentHash === target) {
          // Si on est DÉJÀ sur la même page/ancre, le navigateur ne déclenche pas hashchange.
          // On force donc le routeur à ré-exécuter le rendu directement :
          if (typeof window.navigateRouter === 'function') {
            await window.navigateRouter();
          } else {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }
        } else {
          window.location.hash = target;
        }

        // Si la cible comporte un sous-onglet (?tab=...), forcer son basculement
        const tabMatch = target.match(/tab=([a-zA-Z0-9_-]+)/);
        if (tabMatch && tabMatch[1]) {
          const tabName = tabMatch[1];
          const triggerSubTab = () => {
            const tabBtn = document.querySelector(`.sub-tab-btn[data-subview="${tabName}"]`);
            if (tabBtn) tabBtn.click();
          };
          setTimeout(triggerSubTab, 80);
          setTimeout(triggerSubTab, 300);
        }
      });
    });
  } catch (e) {
    console.error('Erreur de chargement des notifications :', e);
  }
}

function initNotificationBell() {
  const btn = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    if (!dropdown.hidden) refreshNotifications(false);
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== btn) {
      dropdown.hidden = true;
    }
  });

  // Premier chargement
  refreshNotifications(false);

  // Polling automatique ultra-réactif toutes les 8 secondes en arrière-plan
  if (notifPollIntervalId) clearInterval(notifPollIntervalId);
  notifPollIntervalId = setInterval(() => refreshNotifications(true), 8000);

  // Rafraîchir instantanément dès que l'utilisateur revient sur la page ou change d'onglet
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshNotifications(true);
    }
  });
  window.addEventListener('focus', () => {
    refreshNotifications(true);
  });
}

function initButtonRipple() {}

// Vérifier la session de connexion
function checkSession() {
  const sessionUser = sessionStorage.getItem('gica_hr_user');
  const token = getToken();
  if (sessionUser && token) {
    currentUser = JSON.parse(sessionUser);
    showApp();
  } else {
    // Session incomplète (utilisateur sans jeton ou inversement) : on repart de zéro
    sessionStorage.removeItem('gica_hr_user');
    clearToken();
    showLogin();
  }
}

// Afficher l'application principale
function showApp() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // Configurer l'en-tête de l'utilisateur connecté
  document.getElementById('header-user-name').innerText = `${currentUser.prenom} ${currentUser.nom}`;
  document.getElementById('header-user-avatar').innerText = `${currentUser.prenom[0]}${currentUser.nom[0]}`.toUpperCase();

  let roleLabel = "Collaborateur";
  if (currentUser.role === 'supervisor') roleLabel = "Superviseur Secteur";
  if (currentUser.role === 'hr') roleLabel = "Directeur RH";
  document.getElementById('header-user-role').innerText = roleLabel;

  // Filtrer les menus de la barre latérale selon le rôle
  document.querySelectorAll('.nav-item').forEach(item => {
    const roles = item.getAttribute('data-role')?.split(',') || [];
    if (roles.includes(currentUser.role)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  // Filtrer la barre de navigation basse mobile selon le rôle
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    const roles = item.getAttribute('data-role')?.split(',') || [];
    if (roles.includes(currentUser.role)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  if (window.lucide) window.lucide.createIcons();

  // La cloche de notifications est accessible à tous (collaborateurs, superviseurs et DRH)
  const bellWrapper = document.querySelector('.notif-bell-wrapper');
  if (bellWrapper) {
    bellWrapper.style.display = '';
  }

  initRouter();
  initLogoutListener();
  initRealTimeSync();
  initNotificationBell();
}
// Afficher la page de connexion
function showLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-container').style.display = 'flex';

  const loginForm = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');

  if (loginForm) {
    // Supprimer tout ancien écouteur pour éviter les soumissions en double
    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);

    newForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.style.display = 'none';

      const matricule = document.getElementById('login-matricule').value.trim();
      const password = document.getElementById('login-password').value;

      const submitBtn = newForm.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="btn-spinner"></span> Connexion...`;
      }

      try {
        const { token, ...userData } = await api.login(matricule, password);
        setToken(token);
        sessionStorage.setItem('gica_hr_user', JSON.stringify(userData));
        currentUser = userData;
        showApp();
      } catch (err) {
        errorDiv.innerText = err.message || "Erreur de connexion.";
        errorDiv.style.display = 'block';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel;
        }
      }
    });
  }
}

// Déconnexion (appelée par l'utilisateur ou automatiquement sur session expirée)
function forceLogout() {
  sessionStorage.removeItem('gica_hr_user');
  clearToken();
  currentUser = null;
  closeRealTimeSync();
  window.location.hash = '#dashboard';
  showLogin();
}

// Gérer la déconnexion
function initLogoutListener() {
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      forceLogout();
    });
  }
}

// Navigation / Routeur SPA
function initRouter() {
  const navigate = async () => {
    // Vérifier si déconnecté entre-temps
    if (!currentUser) return;
    // Éviter un rendu concurrent (ex: hashchange + événement temps réel simultanés)
    if (isRenderingView) return;
    isRenderingView = true;

    try {
      await navigateInner();
    } finally {
      isRenderingView = false;
    }
  };

  const navigateInner = async () => {
    let hash = window.location.hash.slice(1);
    let routeName = hash;
    let queryParams = {};

    if (hash.includes('?')) {
      const parts = hash.split('?');
      routeName = parts[0];
      const searchParams = new URLSearchParams(parts[1]);
      for (const [key, val] of searchParams.entries()) {
        queryParams[key] = val;
      }
    }

    if (!routeName || !routes[routeName]) {
      routeName = 'dashboard';
      // replaceState (et non location.hash=) : évite de déclencher un 'hashchange'
      // qui relancerait navigate() en double pendant que ce rendu est encore en cours
      // (c'était la cause du crash "Canvas already in use" qui vidait le tableau de bord).
      history.replaceState(null, '', '#dashboard');
    }

    // Nettoyer le composant précédent si besoin
    if (activeComponent && typeof activeComponent.destroy === 'function') {
      activeComponent.destroy();
    }

    // Sécuriser l'accès aux routes selon le rôle
    const component = routes[routeName];
    const itemMenu = document.querySelector(`.nav-item[data-view="${routeName}"]`);
    let allowedRoles = itemMenu?.getAttribute('data-role')?.split(',') || [];
    if (routeName === 'recupedetail') {
      allowedRoles = ['supervisor', 'hr'];
    }

    if (component && allowedRoles.includes(currentUser.role)) {
      const mainContainer = document.getElementById('main-view-container');
      const viewTitle = document.getElementById('view-title');
      const viewSubtitle = document.getElementById('view-subtitle');

      if (mainContainer) {
        showRouteLoader();
        try {
          viewTitle.innerText = component.title;
          viewSubtitle.innerText = component.subtitle;

          // Injecter le HTML avec une transition animée rejouée à chaque navigation
          await playViewTransition(mainContainer, async () => {
            mainContainer.innerHTML = await component.render(queryParams);
          });

          // Mettre à jour la classe active dans le menu
          document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === routeName) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });

          // Mettre à jour la classe active dans la barre basse mobile
          document.querySelectorAll('.bottom-nav-item').forEach(item => {
            if (item.getAttribute('data-view') === routeName) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });

          if (window.lucide) window.lucide.createIcons();

          activeComponent = component;

          // Lancer la logique du composant
          await component.init(queryParams);

          // Traduire le DOM après chargement
          translateDOM();
        } finally {
          hideRouteLoader();
        }
      }
    } else {
      // Rediriger vers le tableau de bord si accès non autorisé
      window.location.hash = '#dashboard';
    }
  };

  // Écouter les changements d'ancre
  window.removeEventListener('hashchange', navigate);
  window.addEventListener('hashchange', navigate);

  // Écouter les clics de menu
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.id === 'btn-logout') return;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      window.location.hash = `#${view}`;
    });
  });

  // Exposer globalement pour permettre la ré-exécution forcée depuis les notifications
  window.navigateRouter = navigate;

  // Déclencher le chargement initial
  navigate();
}

// Affichage instantané du contenu sans transition animée
async function playViewTransition(container, updateFn) {
  await updateFn();
}

// Navigation immédiate sans loader bloquant ni animation de logo
function showRouteLoader() {}
function hideRouteLoader() {}

// Initialiser le système modal global
function initModalListeners() {
  const overlay = document.getElementById('global-modal-overlay');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }
}

export function openModal(title, bodyHtml, onSave = null, footerButtons = null) {
  const overlay = document.getElementById('global-modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body-content');
  const modalFooter = document.getElementById('modal-footer-actions');

  if (!overlay || !modalTitle || !modalBody || !modalFooter) return;

  modalTitle.innerText = title;
  modalBody.innerHTML = bodyHtml;

  activeModalSaveCallback = onSave;

  if (footerButtons) {
    modalFooter.innerHTML = footerButtons;
  } else {
    modalFooter.innerHTML = `
      <button class="btn btn-secondary" id="modal-cancel-btn">Annuler</button>
      <button class="btn btn-primary" id="modal-save-btn">Enregistrer</button>
    `;

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.addEventListener('click', async () => {
      if (activeModalSaveCallback) {
        const originalLabel = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="btn-spinner"></span> Enregistrement...`;
        try {
          const shouldClose = await activeModalSaveCallback();
          if (shouldClose !== false) {
            closeModal();
          }
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalLabel;
        }
      } else {
        closeModal();
      }
    });
  }

  overlay.classList.add('open');
  if (window.lucide) window.lucide.createIcons();

  // Traduire le modal
  translateDOM(overlay);
}

export function closeModal() {
  const overlay = document.getElementById('global-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
  activeModalSaveCallback = null;
}

// --- BOÎTE DE DIALOGUE DE CONFIRMATION ANIMÉE ---
// Remplace window.confirm() par une variante intégrée au thème de l'application,
// qui réutilise le système de modal existant. Retourne une Promise<boolean>.
export function confirmDialog(message, { title = 'Confirmation requise', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('global-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body-content');
    const modalFooter = document.getElementById('modal-footer-actions');

    if (!overlay || !modalTitle || !modalBody || !modalFooter) {
      // Repli sur le confirm natif si le système de modal n'est pas disponible
      resolve(window.confirm(message));
      return;
    }

    modalTitle.innerText = title;
    modalBody.innerHTML = `
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: ${danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(13, 148, 136, 0.1)'};">
          <i data-lucide="${danger ? 'alert-triangle' : 'help-circle'}" style="color: ${danger ? 'var(--color-danger)' : 'var(--color-primary)'};"></i>
        </div>
        <p style="margin: 0; padding-top: 8px; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">${message}</p>
      </div>
    `;
    modalFooter.innerHTML = `
      <button class="btn btn-secondary" id="confirm-dialog-cancel">Annuler</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-dialog-ok">Confirmer</button>
    `;

    const cleanup = (result) => {
      overlay.classList.remove('open');
      overlay.removeEventListener('click', overlayClickHandler);
      activeModalSaveCallback = null;
      resolve(result);
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    document.getElementById('confirm-dialog-cancel').addEventListener('click', () => cleanup(false));
    document.getElementById('confirm-dialog-ok').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', overlayClickHandler);

    overlay.classList.add('open');
    if (window.lucide) window.lucide.createIcons();
  });
}

// --- NOTIFICATIONS TOAST ANIMÉES ---
// Remplace la plupart des window.alert() par de petites notifications non bloquantes,
// empilées en bas à droite, qui apparaissent/disparaissent avec une animation.
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
  }
  return toastContainer;
}

const TOAST_ICONS = {
  success: 'check-circle',
  danger: 'x-circle',
  warning: 'alert-triangle',
  info: 'info'
};

export function toast(message, type = 'success', duration = 4000) {
  const container = getToastContainer();
  if (!container) {
    // Repli si le conteneur n'existe pas encore dans le DOM
    if (type === 'danger') alert(message);
    return;
  }

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <i data-lucide="${TOAST_ICONS[type] || 'info'}"></i>
    <span class="toast-message"></span>
    <button class="toast-close" aria-label="Fermer">&times;</button>
  `;
  el.querySelector('.toast-message').innerText = message;

  const remove = () => {
    el.remove();
  };

  el.querySelector('.toast-close').addEventListener('click', remove);
  container.appendChild(el);
  if (window.lucide) window.lucide.createIcons();

  if (duration > 0) {
    setTimeout(remove, duration);
  }
}

// Initialiser le commutateur de langue
function initLanguageToggle() {
  const currentLang = localStorage.getItem('gica_lang') || 'fr';

  // Activer le bon bouton visuellement
  document.querySelectorAll('.btn-lang').forEach(btn => {
    const lang = btn.getAttribute('data-lang');
    if (lang === currentLang) {
      btn.style.backgroundColor = 'var(--color-primary)';
      btn.style.color = 'white';
    } else {
      btn.style.backgroundColor = 'transparent';
      btn.style.color = 'var(--text-secondary)';
    }

    btn.onclick = (e) => {
      e.preventDefault();
      const targetLang = btn.getAttribute('data-lang');
      localStorage.setItem('gica_lang', targetLang);
      window.location.reload();
    };
  });

  // Exécuter la traduction globale
  translateDOM();
}

let activeEventSource = null;

function initRealTimeSync() {
  if (activeEventSource) return;

  try {
    activeEventSource = new EventSource(api.eventsUrl());

    activeEventSource.onopen = () => {
      console.log("[SSE] Flux temps réel synchronisé");
    };

    activeEventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Événement temps réel reçu :", data);

        // Dès qu'une notification est créée ou qu'une ressource change, actualiser le badge et la liste
        if (!data.path || data.path.startsWith('/api/notifications') || data.path.startsWith('/api/absences') || data.path.startsWith('/api/recuperations')) {
          refreshNotifications(true);
        }

        // Ne pas interrompre si l'utilisateur est en train de saisir dans un champ
        if (window.isLocalInlineSaving) return;
        if (isRenderingView) return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
          return;
        }

        // Rafraîchir le composant actif affiché
        if (currentUser && activeComponent) {
          const mainContainer = document.getElementById('main-view-container');
          if (mainContainer) {
            isRenderingView = true;
            try {
              let hash = window.location.hash.slice(1);
              let queryParams = {};
              if (hash.includes('?')) {
                const searchParams = new URLSearchParams(hash.split('?')[1]);
                for (const [k, v] of searchParams.entries()) queryParams[k] = v;
              }
              mainContainer.innerHTML = await activeComponent.render(queryParams);
              await activeComponent.init(queryParams);

              // Ré-appliquer la traduction
              const { translateDOM } = await import('./i18n.js');
              translateDOM();
            } finally {
              isRenderingView = false;
            }
          }
        }
      } catch (err) {
        console.error("[SSE] Erreur traitement événement :", err);
      }
    };

    activeEventSource.onerror = (err) => {
      console.warn("[SSE] Connexion interrompue, reconnexion dans 3s...", err);
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      setTimeout(() => {
        if (currentUser) initRealTimeSync();
      }, 3000);
    };
  } catch (e) {
    console.error("[SSE] Erreur initialisation EventSource :", e);
  }
}

function closeRealTimeSync() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
  if (notifPollIntervalId) {
    clearInterval(notifPollIntervalId);
    notifPollIntervalId = null;
  }
}

export function renderTimePicker(id, value = '', isRequired = false) {
  let timeVal = '';
  if (value && value.includes(':')) {
    const parts = value.split(':');
    const hh = String(parts[0]).padStart(2, '0');
    const mm = String(parts[1]).padStart(2, '0');
    timeVal = `${hh}:${mm}`;
  }

  return `
    <div class="custom-time-picker" id="${id}-wrapper" style="display: flex; gap: 8px; align-items: center;">
      <input type="time" id="${id}" class="form-control" value="${timeVal}" ${isRequired ? 'required' : ''} lang="fr-FR" style="width: 140px; font-weight: 600; text-align: center; height: 38px; padding: 6px 12px;">
    </div>
  `;
}

export function getTimePickerValue(id) {
  const el = document.getElementById(id);
  if (el) {
    return el.value; // Returns "HH:MM"
  }
  // Fallback compatibilité
  const hEl = document.getElementById(`${id}-h`);
  const mEl = document.getElementById(`${id}-m`);
  if (!hEl || !mEl) return '';
  const h = hEl.value;
  const m = mEl.value;
  if (!h || !m) return '';
  return `${h}:${m}`;
}

// Affichage direct sans animation
export function staggerRows(container, rowSelector = 'tbody tr') {}

// Affichage direct de la valeur sans animation de compteur
export function animateCountUp(el, endValue, { decimals = 0, suffix = '' } = {}) {
  if (!el) return;
  el.textContent = `${Number(endValue || 0).toFixed(decimals)}${suffix}`;
}
