import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

export const TerminalComponent = {
  title: 'Borne Pointeuse Virtuelle',
  subtitle: 'Enregistrement direct des entrées et sorties pour le personnel',
  timerInterval: null,

  async render() {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 20px 0; max-width: 600px; margin: 0 auto;">
        
        <!-- Live Clock Card -->
        <div class="card" style="width: 100%; text-align: center; background: linear-gradient(135deg, var(--color-secondary), var(--color-primary)); color: white; padding: 24px 30px; border: none; box-shadow: var(--shadow-lg);">
          <div id="terminal-date" style="font-size: 1rem; font-weight: 600; opacity: 0.9; text-transform: capitalize; margin-bottom: 4px;">--</div>
          <div id="terminal-clock" style="font-size: 3rem; font-weight: 800; font-family: monospace; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">00:00:00</div>
          <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 8px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">SCHB Gica - Station d'Assiduité</div>
        </div>

        <!-- Terminal Input Panel -->
        <div class="card" style="width: 100%; padding: 30px; display: flex; flex-direction: column; gap: 20px;">
          <!-- Matricule display -->
          <div style="position: relative;">
            <input type="text" id="terminal-matricule-input" class="form-control" placeholder="Entrez votre matricule..." readonly
                   style="height: 60px; font-size: 1.8rem; font-weight: 800; text-align: center; letter-spacing: 4px; border: 2px solid var(--border-color); border-radius: var(--radius-md); background-color: var(--bg-tertiary);">
            <button id="btn-terminal-clear" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center;" title="Effacer">
              <i data-lucide="delete" style="width: 24px; height: 24px;"></i>
            </button>
          </div>

          <!-- Keypad Grid -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; max-width: 360px; margin: 0 auto; width: 100%;">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
              <button class="btn btn-secondary keypad-btn" data-value="${num}" 
                      style="height: 60px; font-size: 1.5rem; font-weight: 700; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; background-color: var(--bg-primary); border: 1px solid var(--border-color);">
                ${num}
              </button>
            `).join('')}
            <button class="btn btn-secondary keypad-btn" data-value="clear" 
                    style="height: 60px; font-size: 1rem; font-weight: 700; border-radius: var(--radius-md); background-color: var(--bg-tertiary); color: var(--color-danger); border: 1px solid var(--border-color);">
              C
            </button>
            <button class="btn btn-secondary keypad-btn" data-value="0" 
                    style="height: 60px; font-size: 1.5rem; font-weight: 700; border-radius: var(--radius-md); background-color: var(--bg-primary); border: 1px solid var(--border-color);">
              0
            </button>
            <button class="btn btn-secondary keypad-btn" data-value="backspace" 
                    style="height: 60px; font-size: 1.25rem; font-weight: 700; border-radius: var(--radius-md); background-color: var(--bg-tertiary); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
              <i data-lucide="chevron-left" style="width: 20px; height: 20px;"></i>
            </button>
          </div>

          <button id="btn-terminal-submit" class="btn btn-primary" 
                  style="height: 56px; font-size: 1.15rem; font-weight: 700; border-radius: var(--radius-md); width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i data-lucide="fingerprint"></i>
            VALIDER LE BADGEAGE
          </button>
        </div>

        <!-- Result / Notification overlay -->
        <div id="terminal-feedback" style="display: none; width: 100%; animation: slideDown 0.3s ease-out;">
          <!-- Rempli par JS -->
        </div>

      </div>

      <style>
        .keypad-btn:active {
          background-color: var(--border-color) !important;
          transform: scale(0.96);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
  },

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // 1. Démarrer l'horloge dynamique
    this.startClock();

    const inputField = document.getElementById('terminal-matricule-input');
    const submitBtn = document.getElementById('btn-terminal-submit');
    const clearIconBtn = document.getElementById('btn-terminal-clear');

    // 2. Écouteurs de clavier numérique
    document.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-value');
        if (val === 'clear') {
          inputField.value = '';
        } else if (val === 'backspace') {
          inputField.value = inputField.value.slice(0, -1);
        } else {
          // Limiter à 6 chiffres
          if (inputField.value.length < 6) {
            inputField.value += val;
          }
        }
      });
    });

    if (clearIconBtn) {
      clearIconBtn.addEventListener('click', () => {
        inputField.value = '';
      });
    }

    // 3. Soumission du pointage
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handlePunchSubmit());
    }

    // Autoriser aussi la saisie par clavier physique (uniquement chiffres + entrée)
    this.physicalKeyboardHandler = (e) => {
      if (document.activeElement === inputField || e.target.tagName === 'INPUT') return;
      
      if (e.key >= '0' && e.key <= '9') {
        if (inputField.value.length < 6) inputField.value += e.key;
      } else if (e.key === 'Backspace') {
        inputField.value = inputField.value.slice(0, -1);
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        inputField.value = '';
      } else if (e.key === 'Enter') {
        this.handlePunchSubmit();
      }
    };
    window.addEventListener('keydown', this.physicalKeyboardHandler);
  },

  startClock() {
    const updateTime = () => {
      const clockEl = document.getElementById('terminal-clock');
      const dateEl = document.getElementById('terminal-date');
      if (!clockEl || !dateEl) return;

      const now = new Date();
      
      // Heure HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      clockEl.innerText = `${hours}:${minutes}:${seconds}`;

      // Date en Français
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.innerText = now.toLocaleDateString('fr-FR', options);
    };

    updateTime();
    this.timerInterval = setInterval(updateTime, 1000);
  },

  async handlePunchSubmit() {
    const inputField = document.getElementById('terminal-matricule-input');
    const feedbackEl = document.getElementById('terminal-feedback');
    if (!inputField || !feedbackEl) return;

    const matricule = inputField.value.trim();
    if (!matricule) {
      this.showFeedback("Veuillez saisir votre matricule.", "danger");
      return;
    }

    try {
      const res = await api.terminalPunch(matricule);
      
      // Succès
      const isEntree = res.type === 'entree';
      const themeClass = isEntree ? 'success' : 'info';
      const icon = isEntree ? 'check-circle' : 'log-out';
      
      const welcomeMsg = isEntree
        ? `Bonjour <strong>${escapeHtml(res.employee)}</strong> !<br>Votre entrée a été validée.`
        : `Au revoir <strong>${escapeHtml(res.employee)}</strong> !<br>Votre sortie a été validée.`;

      feedbackEl.innerHTML = `
        <div class="card" style="background-color: var(--bg-tertiary); border-left: 5px solid ${isEntree ? 'var(--color-success)' : 'var(--color-primary)'}; padding: 20px; display: flex; align-items: center; gap: 16px;">
          <div style="color: ${isEntree ? 'var(--color-success)' : 'var(--color-primary)'}; flex-shrink: 0;">
            <i data-lucide="${icon}" style="width: 36px; height: 36px;"></i>
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">${welcomeMsg}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Heure d'enregistrement : <strong>${escapeHtml(res.time)}</strong></div>
          </div>
        </div>
      `;

      feedbackEl.style.display = 'block';
      if (window.lucide) window.lucide.createIcons();

      // Effacer l'entrée et cacher le message après 4 secondes
      inputField.value = '';
      setTimeout(() => {
        feedbackEl.style.display = 'none';
      }, 4000);

    } catch (err) {
      // Erreur (Matricule inexistant, etc.)
      this.showFeedback(err.message || "Erreur de communication avec le serveur.", "danger");
    }
  },

  showFeedback(message, type) {
    const feedbackEl = document.getElementById('terminal-feedback');
    if (!feedbackEl) return;

    const icon = type === 'danger' ? 'alert-triangle' : 'info';
    const border = type === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)';
    
    feedbackEl.innerHTML = `
      <div class="card" style="background-color: var(--bg-tertiary); border-left: 5px solid ${border}; padding: 20px; display: flex; align-items: center; gap: 16px;">
        <div style="color: ${border}; flex-shrink: 0;">
          <i data-lucide="${icon}" style="width: 36px; height: 36px;"></i>
        </div>
        <div>
          <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(message)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Veuillez réessayer ou contacter l'administration RH.</div>
        </div>
      </div>
    `;

    feedbackEl.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      feedbackEl.style.display = 'none';
    }, 4000);
  },

  // Nettoyage lors du changement de page (destruction du timer et écouteur de touches)
  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.physicalKeyboardHandler) {
      window.removeEventListener('keydown', this.physicalKeyboardHandler);
    }
  }
};
