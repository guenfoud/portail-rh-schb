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
import { BonsSortieComponent } from './components/bonssortie.js';
import { SanteComponent } from './components/sante.js';
import { AttestationsComponent } from './components/attestations.js';
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
  recupedetail: RecupeDetailComponent,
  bonssortie: BonsSortieComponent,
  sante: SanteComponent,
  attestations: AttestationsComponent
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
let activeNotifTab = 'all'; // 'all' | 'unread'

/** Déduit une icône Lucide et un type de couleur depuis le titre/message */
function getNotifIconType(titre, message) {
  const txt = (titre + ' ' + message).toLowerCase();
  if (/refusé|rejeté|annulé/.test(txt))   return { icon: 'x-circle',       type: 'danger' };
  if (/approuvé|validé|accord/.test(txt))   return { icon: 'check-circle',   type: 'success' };
  if (/en attente|nouvelle demande/.test(txt)) return { icon: 'clock',          type: 'warning' };
  if (/email|expedié|envoyé/.test(txt))       return { icon: 'mail',          type: 'info' };
  if (/habilitation|visite|santé/.test(txt)) return { icon: 'shield-check',   type: 'info' };
  if (/bon de sortie/.test(txt))               return { icon: 'door-open',      type: 'warning' };
  if (/attestation|document/.test(txt))        return { icon: 'file-check',     type: 'info' };
  if (/récupération/.test(txt))               return { icon: 'calendar-days',  type: 'info' };
  return { icon: 'bell', type: 'default' };
}

async function refreshNotifications(showToastOnNew = false) {
  const badge = document.getElementById('notif-badge');
  const list  = document.getElementById('notif-dropdown-list');
  if (!badge || !list) return;

  try {
    const notifs = await api.getNotifications();
    const unread = notifs.filter(n => !n.lu);

    // --- Badge ---
    if (unread.length > 0) {
      badge.textContent = unread.length > 99 ? '99+' : String(unread.length);
      badge.hidden = false;
      badge.classList.remove('badge-pulse');
      void badge.offsetWidth;
      badge.classList.add('badge-pulse');
    } else {
      badge.hidden = true;
    }

    // --- Toast en direct + animation cloche sur nouvelle notif ---
    if (!isInitialNotifLoad && showToastOnNew) {
      const newOnes = unread.filter(n => !knownNotifIds.has(n.id));
      if (newOnes.length > 0) {
        // Animation de la cloche
        const bellBtn = document.getElementById('notif-bell-btn');
        if (bellBtn) {
          bellBtn.classList.remove('ringing');
          void bellBtn.offsetWidth;
          bellBtn.classList.add('ringing');
          setTimeout(() => bellBtn.classList.remove('ringing'), 800);
        }
        // Son de notification discret
        playNotifSound();
        // Toast(s)
        newOnes.forEach(n => {
          const preview = n.message.length > 70 ? `${n.message.slice(0, 70)}…` : n.message;
          toast(n.titre, preview, 'info', 5500);
        });
      }
    }
    isInitialNotifLoad = false;
    knownNotifIds = new Set(notifs.map(n => n.id));

    // --- Rendu du dropdown ---
    renderNotifDropdown(list, notifs, unread);

  } catch (e) {
    console.error('Erreur de chargement des notifications :', e);
  }
}

/** Joue un son de notification léger (ton sinusoïdal via Web Audio API) */
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) { /* Silencieux si API non disponible */ }
}

function renderNotifDropdown(list, notifs, unread) {
  const displayed = activeNotifTab === 'unread' ? unread : notifs;

  list.innerHTML = `
    <!-- En-tête -->
    <div class="notif-dropdown-header">
      <div class="notif-dropdown-header-title">
        <div class="notif-header-icon">
          <i data-lucide="bell" style="width:14px;height:14px;"></i>
        </div>
        Notifications
      </div>
      <div class="notif-header-actions">
        ${unread.length > 0 ? `
          <button id="btn-mark-all-notifs" class="notif-header-action-btn" title="Tout marquer comme lu">
            <i data-lucide="check-check" style="width:14px;height:14px;"></i>
            <span>Tout lire</span>
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Onglets -->
    <div class="notif-tabs">
      <button class="notif-tab-btn ${activeNotifTab === 'all' ? 'active' : ''}" data-tab="all">
        Toutes
        <span class="notif-tab-count">${notifs.length}</span>
      </button>
      <button class="notif-tab-btn ${activeNotifTab === 'unread' ? 'active' : ''}" data-tab="unread">
        Non lues
        <span class="notif-tab-count">${unread.length}</span>
      </button>
    </div>

    <!-- Corps -->
    <div class="notif-dropdown-body">
      ${displayed.length === 0 ? `
        <div class="notif-empty">
          <div class="notif-empty-icon">
            <i data-lucide="bell-off" style="width:24px;height:24px;"></i>
          </div>
          <strong>${activeNotifTab === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}</strong>
          <span style="font-size:0.78rem;">Vous êtes à jour ✔️</span>
        </div>
      ` : displayed.slice(0, 30).map(item => {
        const { icon, type } = getNotifIconType(item.titre, item.message);
        return `
        <div class="notif-item ${item.lu ? 'read' : 'unread'}"
             data-id="${item.id}"
             data-target="${escapeHtml(item.lien || '#absences')}"
             data-title="${escapeHtml(item.titre)}"
             data-message="${escapeHtml(item.message)}">
          <div class="notif-item-icon type-${type}">
            <i data-lucide="${icon}" style="width:16px;height:16px;"></i>
          </div>
          <div class="notif-item-content">
            <div class="notif-item-header">
              <span class="notif-item-title">${escapeHtml(item.titre)}</span>
              <span class="notif-item-time">${formatTimeAgo(item.created_at)}</span>
            </div>
            <p class="notif-item-body">${escapeHtml(item.message)}</p>
            <div class="notif-item-footer">
              ${item.email_sent ? `
                <span class="notif-item-tag">
                  <i data-lucide="mail-check" style="width:10px;height:10px;"></i>
                  ${item.email_destinataire ? escapeHtml(item.email_destinataire) : 'Email envoyé'}
                </span>
              ` : '<span></span>'}
              <span style="font-size:0.7rem;color:var(--color-primary);font-weight:700;display:flex;align-items:center;gap:2px;">
                Ouvrir <i data-lucide="chevron-right" style="width:11px;height:11px;"></i>
              </span>
            </div>
          </div>
          ${!item.lu ? '<div class="notif-unread-dot"></div>' : ''}
        </div>`;
      }).join('')}
    </div>

    <!-- Pied -->
    ${notifs.length > 0 ? `
    <div class="notif-dropdown-footer">
      <button class="notif-footer-link" id="btn-notif-view-all">
        Voir toutes les notifications
        <i data-lucide="arrow-right" style="width:13px;height:13px;"></i>
      </button>
    </div>` : ''}
  `;

  if (window.lucide) window.lucide.createIcons();

  // --- Événements ---
  // Onglets
  list.querySelectorAll('.notif-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeNotifTab = btn.getAttribute('data-tab');
      renderNotifDropdown(list, notifs, unread);
    });
  });

  // Tout marquer comme lu
  const btnMarkAll = document.getElementById('btn-mark-all-notifs');
  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api.markAllNotificationsRead();
      await refreshNotifications(false);
    });
  }

  // Clic sur item
  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-id');
      let target = el.getAttribute('data-target') || '#absences';
      const notifTitre = el.getAttribute('data-title') || '';
      const notifMsg   = el.getAttribute('data-message') || '';

      // Détection intelligente de l'onglet précis
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
      } else if (target === '#bonssortie' || /bon de sortie/i.test(notifTitre + ' ' + notifMsg)) {
        if (/nouveau|en attente|sollicité/i.test(notifTitre + ' ' + notifMsg)) {
          target = '#bonssortie?tab=attente';
        } else {
          target = '#bonssortie?tab=mes-bons';
        }
      } else if (target === '#sante' || /habilitation|visite médicale|sécurité/i.test(notifTitre + ' ' + notifMsg)) {
        target = '#sante';
      } else if (target === '#attestations' || /attestation|document/i.test(notifTitre + ' ' + notifMsg)) {
        target = '#attestations';
      }

      // 1. Marquer comme lue (en arrière-plan, sans bloquer)
      api.markNotificationRead(id).catch(() => {});

      // 2. Fermer le dropdown
      const notifDropdown = document.getElementById('notif-dropdown');
      if (notifDropdown) notifDropdown.hidden = true;

      // 3. Débloquer le verrou de rendu si actif (évite que le routeur ignore le hashchange)
      isRenderingView = false;

      // 4. Naviguer immédiatement
      const currentHash = window.location.hash;
      if (currentHash === target) {
        // Même page → forcer le routeur directement
        if (typeof window.navigateRouter === 'function') {
          await window.navigateRouter();
        } else {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      } else {
        window.location.hash = target;
      }

      // 5. Rafraîchir le badge après navigation (sans interférer)
      setTimeout(() => refreshNotifications(false), 500);

      // 6. Déclencher le sous-onglet si nécessaire
      const tabMatch = target.match(/tab=([a-zA-Z0-9_-]+)/);
      if (tabMatch && tabMatch[1]) {
        const tabName = tabMatch[1];
        const triggerSubTab = () => {
          const tabBtn = document.querySelector(`.sub-tab-btn[data-subview="${tabName}"]`);
          if (tabBtn) tabBtn.click();
        };
        setTimeout(triggerSubTab, 200);
        setTimeout(triggerSubTab, 600);
      }
    });
  });
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
    if (currentUser.must_change_password) promptPasswordChange();
  } else {
    // Session incomplète (utilisateur sans jeton ou inversement) : on repart de zéro
    sessionStorage.removeItem('gica_hr_user');
    clearToken();
    showLogin();
  }
}

// Changement de mot de passe obligatoire (compte créé/réinitialisé par la DRH)
function promptPasswordChange() {
  const bodyHtml = `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 14px; font-size: 0.85rem; color: #92400e; margin-bottom: 18px;">
      Votre compte utilise un mot de passe temporaire. Choisissez un nouveau mot de passe personnel
      (8 caractères minimum) pour sécuriser votre accès.
    </div>
    <div class="form-group">
      <label for="pwd-current">Mot de passe actuel</label>
      <input type="password" id="pwd-current" class="form-control" autocomplete="current-password">
    </div>
    <div class="form-group">
      <label for="pwd-new">Nouveau mot de passe</label>
      <input type="password" id="pwd-new" class="form-control" autocomplete="new-password" minlength="8">
    </div>
    <div class="form-group">
      <label for="pwd-confirm">Confirmer le nouveau mot de passe</label>
      <input type="password" id="pwd-confirm" class="form-control" autocomplete="new-password" minlength="8">
    </div>
  `;

  openModal('Changement de mot de passe obligatoire', bodyHtml, [{
    label: 'Enregistrer et continuer',
    class: 'btn btn-primary',
    onClick: async () => {
      const current = document.getElementById('pwd-current')?.value || '';
      const next = document.getElementById('pwd-new')?.value || '';
      const confirmation = document.getElementById('pwd-confirm')?.value || '';

      if (next.length < 8) return toast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'warning');
      if (next !== confirmation) return toast('Les deux saisies ne correspondent pas.', 'warning');

      try {
        await api.changePassword(current, next);
        currentUser.must_change_password = false;
        sessionStorage.setItem('gica_hr_user', JSON.stringify(currentUser));
        closeModal();
        toast('Mot de passe mis à jour.', 'success');
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
  }]);
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
        if (userData.must_change_password) promptPasswordChange();
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

  if (Array.isArray(onSave)) {
    modalFooter.innerHTML = '';
    onSave.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.className = btnConfig.class || 'btn btn-secondary';
      btn.innerText = btnConfig.label;
      if (btnConfig.onClick) {
        btn.addEventListener('click', async () => {
          const originalLabel = btn.innerText;
          try {
            await btnConfig.onClick();
          } catch (e) {
            console.error('Erreur action modal:', e);
          }
        });
      }
      modalFooter.appendChild(btn);
    });
  } else if (footerButtons) {
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

// --- NOTIFICATIONS TOAST AMÉLIORÉES ---
// Toasts premium : icône dans rond coloré, titre + message, barre de progression,
// bouton d'action optionnel, son, slide-out fluide.
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
  }
  return toastContainer;
}

const TOAST_ICONS = {
  success: 'check-circle',
  danger:  'x-circle',
  warning: 'alert-triangle',
  info:    'bell'
};

/**
 * Affiche un toast premium.
 * @param {string} title      - Titre (gras)
 * @param {string} message    - Message secondaire (optionnel)
 * @param {string} type       - 'success' | 'danger' | 'warning' | 'info'
 * @param {number} duration   - Durée en ms (0 = persistant)
 * @param {Object} [action]   - { label: string, onClick: Function } (optionnel)
 */
export function toast(title, message = '', type = 'success', duration = 4500, action = null) {
  // Rétrocompatibilité : ancien appel toast(message, type, duration)
  // → si le 2ème arg est un type connu, on réorganise les arguments
  const knownTypes = new Set(['success', 'danger', 'warning', 'info', 'error']);
  if (knownTypes.has(message)) {
    // toast(msg, type, duration?) — ancien format
    if (typeof type === 'number') duration = type;
    else if (typeof type !== 'number') duration = 4500;
    type = message;
    message = '';
  }
  // Normaliser 'error' → 'danger'
  if (type === 'error') type = 'danger';

  const container = getToastContainer();
  if (!container) {
    if (type === 'danger') alert(title + (message ? '\n' + message : ''));
    return;
  }

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <div class="toast-icon-wrap">
      <i data-lucide="${TOAST_ICONS[type] || 'info'}"></i>
    </div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
      ${action ? `<button class="toast-action-btn" style="color:var(--color-${type === 'info' ? 'primary' : type})">${escapeHtml(action.label)}</button>` : ''}
    </div>
    <button class="toast-close" aria-label="Fermer">&times;</button>
    ${duration > 0 ? `<div class="toast-progress" style="animation-duration:${duration}ms;"></div>` : ''}
  `;

  const remove = () => {
    if (el.parentNode) {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 300);
    }
  };

  el.querySelector('.toast-close').addEventListener('click', remove);
  if (action) {
    el.querySelector('.toast-action-btn').addEventListener('click', () => {
      action.onClick();
      remove();
    });
  }

  container.appendChild(el);
  if (window.lucide) window.lucide.createIcons();

  if (duration > 0) setTimeout(remove, duration);
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
