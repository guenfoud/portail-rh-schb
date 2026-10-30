import { api } from '../api.js';
import { openModal, closeModal, getCurrentUser, toast, confirmDialog } from '../main.js';
import { escapeHtml, formatDateFR } from '../utils.js';
import { renderOfficialHeader, renderOfficialFooter, renderOfficialSeal, wrapInOfficialDocument, printOfficialDocument } from './letterhead.js';

let documentsHistory = [];
let allEmployees = [];
let selectedEmployee = null;
let historySearchQuery = '';
let historyTypeFilter = 'all';

// --- Sélecteur d'employé avec recherche (nom, prénom, matricule, département, poste) ---
const employeeSearchLabel = (emp) => emp
  ? `#${emp.matricule || ''} — ${(emp.nom || '').toUpperCase()} ${emp.prenom || ''}`
  : '';

// Un seul écouteur "clic extérieur" actif par champ (évite l'accumulation au fil des rendus)
const searchOutsideHandlers = new Map();

function renderEmployeeSearchBox({ inputId, resultsId, selected, dark = false, placeholder = 'Rechercher un employé (nom, matricule, département)…' }) {
  const bg = dark ? '#1e293b' : '#ffffff';
  const color = dark ? '#f8fafc' : 'var(--text-primary)';
  const border = dark ? '#475569' : 'var(--border-color)';
  return `
    <div class="emp-search-box" style="position: relative; width: 100%;">
      <input type="text" id="${inputId}" class="form-control" autocomplete="off"
             role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${resultsId}"
             placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(employeeSearchLabel(selected))}"
             style="width: 100%; height: 44px; background: ${bg}; color: ${color}; border: 1px solid ${border}; border-radius: 8px; padding-left: 38px; padding-right: 12px; font-weight: 600; font-size: 0.92rem;">
      <i data-lucide="user-search" style="position: absolute; left: 12px; top: 13px; width: 18px; height: 18px; color: #94a3b8; pointer-events: none;"></i>
      <div id="${resultsId}" role="listbox" hidden
           style="margin-top: 6px; max-height: 240px; overflow-y: auto; background: ${bg}; border: 1px solid ${border}; border-radius: 8px; box-shadow: 0 14px 34px rgba(2, 6, 23, 0.28);"></div>
    </div>
  `;
}

function bindEmployeeSearch({ inputId, resultsId, dark = false, onSelect, onQueryChange }) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;

  const activeBg = dark ? 'rgba(56, 189, 248, 0.18)' : '#eff6ff';
  const separator = dark ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9';
  const textColor = dark ? '#f8fafc' : 'var(--text-primary)';
  const mutedColor = dark ? '#94a3b8' : 'var(--text-secondary)';

  let matches = [];
  let activeIndex = -1;

  const paint = () => {
    if (!matches.length) {
      results.innerHTML = `<div style="padding: 14px; font-size: 0.85rem; color: ${mutedColor}; text-align: center;">Aucun employé trouvé.</div>`;
      results.hidden = false;
      return;
    }

    results.innerHTML = matches.map((emp, i) => {
      const initials = `${(emp.prenom || ' ')[0] || ''}${(emp.nom || ' ')[0] || ''}`.toUpperCase();
      return `
        <button type="button" role="option" aria-selected="${i === activeIndex}" data-matricule="${escapeHtml(emp.matricule)}"
          style="display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 12px; border: none; border-bottom: 1px solid ${separator}; background: ${i === activeIndex ? activeBg : 'transparent'}; color: ${textColor}; cursor: pointer;">
          <span style="flex: 0 0 30px; width: 30px; height: 30px; border-radius: 50%; background: rgba(37, 99, 235, 0.16); color: ${dark ? '#38bdf8' : 'var(--color-primary)'}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">${escapeHtml(initials)}</span>
          <span style="display: flex; flex-direction: column; min-width: 0;">
            <span style="font-weight: 700; font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml((emp.nom || '').toUpperCase())} ${escapeHtml(emp.prenom || '')}</span>
            <span style="font-size: 0.74rem; color: ${mutedColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#${escapeHtml(emp.matricule)} · ${escapeHtml(emp.departement || '-')} · ${escapeHtml(emp.poste || '-')}</span>
          </span>
        </button>`;
    }).join('');

    results.hidden = false;
    const activeRow = results.querySelectorAll('[role="option"]')[activeIndex];
    if (activeRow && activeRow.scrollIntoView) activeRow.scrollIntoView({ block: 'nearest' });
  };

  const filter = (rawQuery) => {
    const terms = String(rawQuery || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    matches = allEmployees.filter(emp => {
      const haystack = `${emp.matricule || ''} ${emp.nom || ''} ${emp.prenom || ''} ${emp.departement || ''} ${emp.poste || ''}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    }).slice(0, 80);
    activeIndex = matches.length ? 0 : -1;
    paint();
  };

  const close = () => {
    results.hidden = true;
    results.innerHTML = '';
    activeIndex = -1;
    input.setAttribute('aria-expanded', 'false');
  };

  const choose = (emp) => {
    if (!emp) return;
    input.value = employeeSearchLabel(emp);
    close();
    onSelect?.(emp);
  };

  input.addEventListener('focus', () => {
    input.select();
    input.setAttribute('aria-expanded', 'true');
    filter('');
  });

  input.addEventListener('input', () => {
    input.setAttribute('aria-expanded', 'true');
    onQueryChange?.(input.value);
    filter(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!matches.length) return;
      activeIndex = e.key === 'ArrowDown'
        ? (activeIndex + 1) % matches.length
        : (activeIndex - 1 + matches.length) % matches.length;
      paint();
    } else if (e.key === 'Enter') {
      if (matches.length && activeIndex >= 0) {
        e.preventDefault();
        choose(matches[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  // mousedown (et non click) pour sélectionner avant que le champ ne perde le focus
  results.addEventListener('mousedown', (e) => {
    const row = e.target.closest('[data-matricule]');
    if (!row) return;
    e.preventDefault();
    choose(allEmployees.find(emp => emp.matricule == row.getAttribute('data-matricule')));
  });

  const previous = searchOutsideHandlers.get(inputId);
  if (previous) document.removeEventListener('click', previous);
  const outsideHandler = (ev) => {
    if (!input.parentElement.contains(ev.target)) close();
  };
  searchOutsideHandlers.set(inputId, outsideHandler);
  document.addEventListener('click', outsideHandler);
}

export const AttestationsComponent = {
  title: 'Portail d\'Attestations & Documents RH',
  subtitle: 'Délivrance instantanée en 1 clic avec cachet numérique officiel SCHB GICA et certification QR code',

  async render(queryParams = {}) {
    const user = getCurrentUser();
    const isHR = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'supervisor';

    // 1. Chargement de l'historique des documents
    try {
      documentsHistory = await api.getAttestations();
    } catch (err) {
      console.error('Erreur chargement attestations:', err);
      documentsHistory = [];
    }

    // 2. Si profil DRH / Superviseur, chargement de l'ensemble des employés
    if (isHR) {
      try {
        const emps = await api.getEmployees();
        allEmployees = Array.isArray(emps) ? emps.filter(e => e.actif !== 0) : [];
        allEmployees.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
      } catch (err) {
        console.error('Erreur chargement employés pour DRH:', err);
        allEmployees = [];
      }

      // Sélectionner par défaut l'employé précédemment sélectionné, ou le DRH lui-même s'il est dans la liste, ou le premier
      if (!selectedEmployee || !allEmployees.some(e => e.matricule == selectedEmployee.matricule)) {
        selectedEmployee = allEmployees.find(e => e.matricule == user?.matricule) || allEmployees[0] || user;
      }
    } else {
      allEmployees = user ? [user] : [];
      selectedEmployee = user;
    }

    const targetEmp = selectedEmployee || user || {};
    const empPrenomNom = `${targetEmp.prenom || ''} ${(targetEmp.nom || '').toUpperCase()}`.trim();

    return `
      <div class="tab-container" style="display: flex; flex-direction: column; gap: 24px;">
        
        ${isHR ? `
          <!-- Bannière Espace DRH Multi-Salariés -->
          <div class="card" style="padding: 22px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 18px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="background: linear-gradient(135deg, #0284c7, #1F497D); width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(2,132,199,0.35);">
                  <i data-lucide="users-2" style="width: 26px; height: 26px; color: white;"></i>
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #ffffff;">Espace DRH — Émission Multi-Salariés</h3>
                    <span class="badge" style="background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); font-size: 0.75rem; padding: 2px 8px;">Direction RH & Superviseur</span>
                  </div>
                  <p style="margin: 3px 0 0; font-size: 0.85rem; color: #94a3b8;">
                    Sélectionnez n'importe quel collaborateur de la cimenterie pour émettre et imprimer instantanément ses documents officiels SCHB GICA.
                  </p>
                </div>
              </div>

              <!-- Sélecteur rapide et recherche -->
              <div style="display: flex; align-items: center; gap: 10px; min-width: 320px; flex: 1; max-width: 550px;">
                ${renderEmployeeSearchBox({
                  inputId: 'drh-employee-search',
                  resultsId: 'drh-employee-results',
                  selected: targetEmp,
                  dark: true
                })}
                <button id="btn-select-myself" class="btn btn-secondary btn-sm" style="white-space: nowrap; height: 44px; background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 0 14px; font-size: 0.82rem;" title="Sélectionner mon propre profil">
                  <i data-lucide="user" style="width: 14px; height: 14px;"></i> Mon Profil
                </button>
              </div>
            </div>

            <!-- Fiche synthétique du collaborateur sélectionné -->
            <div id="drh-selected-employee-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; align-items: center;">
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Bénéficiaire Actuel</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">
                  ${escapeHtml((targetEmp.nom || '').toUpperCase())} ${escapeHtml(targetEmp.prenom || '')}
                </div>
                <div style="font-size: 0.8rem; color: #cbd5e1; font-family: monospace;">Matricule #${escapeHtml(targetEmp.matricule || '')}</div>
              </div>
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Direction / Département</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 2px;">
                  ${escapeHtml(targetEmp.departement || '-')}
                </div>
              </div>
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Fonction Occupée</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 2px;">
                  ${escapeHtml(targetEmp.poste || '-')}
                </div>
              </div>
              <div>
                <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Recrutement & Contrat</div>
                <div style="font-size: 0.88rem; font-weight: 600; color: #f1f5f9; margin-top: 2px;">
                  ${formatDateFR(targetEmp.date_embauche)} • <span class="badge" style="background: rgba(14,165,233,0.25); color: #38bdf8; font-size: 0.72rem; padding: 1px 6px;">${escapeHtml(targetEmp.type_contrat || 'CDI')}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge success" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700;">
                  <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle;"></i> Prêt pour Émission
                </span>
              </div>
            </div>
          </div>
        ` : `
          <!-- Bannière Libre-Service Collaborateur standard -->
          <div class="card" style="padding: 24px; background: linear-gradient(135deg, rgba(19,84,122,0.1), rgba(19,84,122,0.02)); border: 1px solid rgba(19,84,122,0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="background: var(--primary); color: white; width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(19,84,122,0.3);">
                  <i data-lucide="stamp" style="width: 28px; height: 28px;"></i>
                </div>
                <div>
                  <h2 style="margin: 0; font-size: 1.25rem; color: var(--primary); font-weight: 800;">Libre-Service RH Collaborateurs — SCHB GICA</h2>
                  <p style="margin: 4px 0 0; font-size: 0.9rem; color: var(--text-secondary);">
                    Générez vos documents administratifs officiels instantanément, certifiés avec le cachet numérique de la Direction des Ressources Humaines.
                  </p>
                </div>
              </div>
              <div>
                <span class="badge success" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 600;">
                  <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle;"></i> Service Actif 24/7
                </span>
              </div>
            </div>
          </div>
        `}

        <!-- Catalogue des 4 Documents RH Disponibles en 1 Clic -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="files" style="width: 18px; height: 18px; color: var(--primary);"></i>
              <span>Documents Disponibles Immédiatement</span>
            </h3>
            ${isHR ? `
              <div id="beneficiary-indicator-text" style="font-size: 0.88rem; color: var(--primary); font-weight: 600; background: rgba(19,84,122,0.08); padding: 4px 12px; border-radius: 20px;">
                Bénéficiaire : <strong>${escapeHtml(empPrenomNom)} (#${escapeHtml(targetEmp.matricule || '')})</strong>
              </div>
            ` : ''}
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">
            
            <!-- Carte 1 : Attestation de Travail -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid var(--primary); transition: transform 0.2s ease, box-shadow 0.2s ease;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(19,84,122,0.1); color: var(--primary); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="file-text" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge info">1-Clic Instantané</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Attestation de Travail</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Certifie la qualité de salarié au sein de la SCHB, le poste, département et ancienneté. Utilisable pour dossiers consulaires, visas et administrations.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Attestation_Travail" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span class="btn-doc-text">${isHR ? `Générer pour ${escapeHtml(targetEmp.prenom || 'Collaborateur')}` : 'Générer l\'Attestation'}</span>
              </button>
            </div>

            <!-- Carte 2 : Relevé d'Émoluments & Salaire -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #0284c7;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(2,132,199,0.1); color: #0284c7; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="receipt" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge info">Prêt Banque</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Relevé d'Émoluments</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Atteste de la rémunération brute et base contractuelle officielle. Conforme pour les dossiers de crédit bancaire, leasing ou garanties financières.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Releve_Emoluments" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #0284c7; border-color: #0284c7;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span class="btn-doc-text">${isHR ? `Générer pour ${escapeHtml(targetEmp.prenom || 'Collaborateur')}` : 'Générer le Relevé'}</span>
              </button>
            </div>

            <!-- Carte 3 : Titre de Congé Officiel -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #16a34a;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(22,163,74,0.1); color: #16a34a; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="plane" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge success">Validé RH</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Titre de Congé Réglementaire</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Reçu officiel confirmant l'autorisation d'absence annuelle, les dates de départ et de reprise, avec décompte du solde de congé payé.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Titre_Conge" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #16a34a; border-color: #16a34a;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span class="btn-doc-text">${isHR ? `Générer pour ${escapeHtml(targetEmp.prenom || 'Collaborateur')}` : 'Générer le Titre'}</span>
              </button>
            </div>

            <!-- Carte 4 : Certificat de Travail -->
            <div class="card" style="padding: 22px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; border-top: 4px solid #8b5cf6;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                  <div style="background: rgba(139,92,246,0.1); color: #8b5cf6; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="award" style="width: 24px; height: 24px;"></i>
                  </div>
                  <span class="badge secondary">Fin de Contrat</span>
                </div>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">Certificat de Travail</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45;">
                  Document légal certifiant la durée d'activité, les postes occupés et attestant que le collaborateur est libre de tout engagement légal.
                </p>
              </div>
              <button class="btn btn-primary btn-generate-doc" data-type="Certificat_Travail" style="width: 100%; display: inline-flex; justify-content: center; align-items: center; gap: 8px; font-weight: 600; background: #8b5cf6; border-color: #8b5cf6;">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                <span class="btn-doc-text">${isHR ? `Générer pour ${escapeHtml(targetEmp.prenom || 'Collaborateur')}` : 'Générer le Certificat'}</span>
              </button>
            </div>

          </div>
        </div>

        <!-- Historique des Documents Générés -->
        <div class="card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="history" style="width: 18px; height: 18px; color: var(--primary);"></i>
              <span>${isHR ? 'Registre & Historique des Documents RH Émis (Tous les Collaborateurs)' : 'Historique de vos Documents Officiels Déjà Émis'}</span>
            </h3>

            <!-- Barre de recherche et filtre d'historique -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <div style="position: relative;">
                <input type="text" id="history-search-input" class="form-control" placeholder="Rechercher salarié, réf, motif..." style="padding-left: 32px; height: 36px; font-size: 0.85rem; width: 230px;">
                <i data-lucide="search" style="position: absolute; left: 10px; top: 10px; width: 14px; height: 14px; color: var(--text-secondary); pointer-events: none;"></i>
              </div>
              <select id="history-type-filter" class="form-control" style="height: 36px; font-size: 0.85rem; padding: 4px 10px;">
                <option value="all">Tous les types de document</option>
                <option value="Attestation_Travail">Attestation de Travail</option>
                <option value="Releve_Emoluments">Relevé d'Émoluments</option>
                <option value="Titre_Conge">Titre de Congé</option>
                <option value="Certificat_Travail">Certificat de Travail</option>
              </select>
            </div>
          </div>

          <div id="history-table-container">
            ${this.renderHistoryTableContent(documentsHistory, isHR)}
          </div>
        </div>

      </div>
    `;
  },

  renderHistoryTableContent(list, isHR) {
    if (!list || list.length === 0) {
      return `
        <div style="text-align: center; padding: 36px; color: var(--text-secondary);">
          <i data-lucide="file-question" style="width: 44px; height: 44px; margin-bottom: 10px; opacity: 0.5;"></i>
          <p style="margin: 0; font-weight: 600;">Aucun document trouvé dans le registre.</p>
          <p style="margin: 4px 0 0; font-size: 0.85rem;">Cliquez sur un des boutons ci-dessus pour générer un premier document certifié SCHB GICA.</p>
        </div>
      `;
    }

    return `
      <div class="table-responsive">
        <table class="table" style="width: 100%; margin: 0;">
          <thead>
            <tr style="background: var(--bg-secondary);">
              <th>Réf. Document</th>
              ${isHR ? `<th>Salarié Bénéficiaire</th>` : ''}
              <th>Type de Document</th>
              <th>Motif / Destinataire</th>
              <th>Date d'Émission</th>
              <th>Statut</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(d => {
              const typeLabel = d.type_document === 'Attestation_Travail' ? 'Attestation de Travail' :
                (d.type_document === 'Releve_Emoluments' ? 'Relevé d\'Émoluments' :
                (d.type_document === 'Titre_Conge' ? 'Titre de Congé' : 'Certificat de Travail'));

              const typeBadgeClass = d.type_document === 'Attestation_Travail' ? 'info' :
                (d.type_document === 'Releve_Emoluments' ? 'primary' :
                (d.type_document === 'Titre_Conge' ? 'success' : 'secondary'));

              return `
                <tr>
                  <td><strong style="font-family: monospace; color: var(--primary);">${escapeHtml(d.reference_doc)}</strong></td>
                  ${isHR ? `
                    <td>
                      <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(d.prenom || '')} ${escapeHtml((d.nom || '').toUpperCase())}</div>
                      <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                        <span>#${escapeHtml(d.matricule)}</span> • <span>${escapeHtml(d.departement || '-')}</span>
                      </div>
                    </td>
                  ` : ''}
                  <td>
                    <span class="badge ${typeBadgeClass}" style="font-size: 0.82rem; font-weight: 600;">
                      ${escapeHtml(typeLabel)}
                    </span>
                  </td>
                  <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 220px; word-break: break-word;">
                    ${escapeHtml(d.motif || 'Usage administratif')}
                  </td>
                  <td>${formatDateFR(d.genere_a ? d.genere_a.split('T')[0] : '')}</td>
                  <td><span class="badge success">${escapeHtml(d.statut || 'Prêt')}</span></td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm btn-reprint-doc" data-type="${d.type_document}" data-ref="${d.reference_doc}" data-mat="${d.matricule}">
                      <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Voir / Imprimer
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async init() {
    this.bindEvents();
    if (window.lucide) window.lucide.createIcons();
  },

  bindEvents() {
    const user = getCurrentUser();
    const isHR = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'supervisor';

    // 1. Recherche + sélection de l'employé bénéficiaire (DRH / Superviseur)
    bindEmployeeSearch({
      inputId: 'drh-employee-search',
      resultsId: 'drh-employee-results',
      dark: true,
      onSelect: (emp) => this.updateSelectedEmployeeUI(emp)
    });

    // 2. Bouton "Mon Profil" pour le DRH
    const myselfBtn = document.getElementById('btn-select-myself');
    if (myselfBtn) {
      myselfBtn.addEventListener('click', () => {
        const myself = allEmployees.find(emp => emp.matricule == user.matricule) || user;
        const searchBox = document.getElementById('drh-employee-search');
        if (searchBox) searchBox.value = employeeSearchLabel(myself);
        this.updateSelectedEmployeeUI(myself);
      });
    }

    // 3. Boutons de génération directe des 4 types de documents
    document.querySelectorAll('.btn-generate-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        this.promptGenerationModal(type);
      });
    });

    // 4. Boutons de réimpression d'un document existant
    this.bindReprintButtons();

    // 5. Filtres de recherche sur l'historique
    const searchInput = document.getElementById('history-search-input');
    const typeFilter = document.getElementById('history-type-filter');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        historySearchQuery = e.target.value.toLowerCase().trim();
        this.filterAndRenderHistory(isHR);
      });
    }

    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        historyTypeFilter = e.target.value;
        this.filterAndRenderHistory(isHR);
      });
    }
  },

  bindReprintButtons() {
    document.querySelectorAll('.btn-reprint-doc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        const ref = e.currentTarget.getAttribute('data-ref');
        const mat = e.currentTarget.getAttribute('data-mat');

        try {
          const res = await api.generateAttestation({ type_document: type, matricule: mat, motif: 'Réimpression document officiel' });
          if (res.document) {
            res.document.reference = ref; // Conserver la référence archivée
            this.openDocumentViewerModal(res.document);
          }
        } catch (err) {
          toast(err.message || 'Erreur affichage document.', 'error');
        }
      });
    });
  },

  updateSelectedEmployeeUI(emp) {
    if (!emp) return;
    selectedEmployee = emp;

    // Garder le champ de recherche synchronisé (sélection depuis la modale ou "Mon Profil")
    const searchBox = document.getElementById('drh-employee-search');
    if (searchBox) searchBox.value = employeeSearchLabel(emp);

    // Fiche DRH en haut
    const card = document.getElementById('drh-selected-employee-card');
    if (card) {
      card.innerHTML = `
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Bénéficiaire Actuel</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">
            ${escapeHtml((emp.nom || '').toUpperCase())} ${escapeHtml(emp.prenom || '')}
          </div>
          <div style="font-size: 0.8rem; color: #cbd5e1; font-family: monospace;">Matricule #${escapeHtml(emp.matricule || '')}</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Direction / Département</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 2px;">
            ${escapeHtml(emp.departement || '-')}
          </div>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Fonction Occupée</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 2px;">
            ${escapeHtml(emp.poste || '-')}
          </div>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px;">Recrutement & Contrat</div>
          <div style="font-size: 0.88rem; font-weight: 600; color: #f1f5f9; margin-top: 2px;">
            ${formatDateFR(emp.date_embauche)} • <span class="badge" style="background: rgba(14,165,233,0.25); color: #38bdf8; font-size: 0.72rem; padding: 1px 6px;">${escapeHtml(emp.type_contrat || 'CDI')}</span>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="badge success" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700;">
            <i data-lucide="check-circle" style="width: 14px; height: 14px; vertical-align: middle;"></i> Prêt pour Émission
          </span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    // Badge indicateur au dessus des cartes
    const indicator = document.getElementById('beneficiary-indicator-text');
    if (indicator) {
      indicator.innerHTML = `Bénéficiaire : <strong>${escapeHtml(emp.prenom || '')} ${escapeHtml((emp.nom || '').toUpperCase())} (#${escapeHtml(emp.matricule || '')})</strong>`;
    }

    // Boutons de génération sur les 4 cartes
    document.querySelectorAll('.btn-generate-doc .btn-doc-text').forEach(span => {
      span.textContent = `Générer pour ${emp.prenom || 'Collaborateur'}`;
    });
  },

  filterAndRenderHistory(isHR) {
    let filtered = [...documentsHistory];

    if (historyTypeFilter !== 'all') {
      filtered = filtered.filter(d => d.type_document === historyTypeFilter);
    }

    if (historySearchQuery) {
      filtered = filtered.filter(d => {
        const ref = (d.reference_doc || '').toLowerCase();
        const mat = String(d.matricule || '').toLowerCase();
        const nom = (d.nom || '').toLowerCase();
        const prenom = (d.prenom || '').toLowerCase();
        const dep = (d.departement || '').toLowerCase();
        const motif = (d.motif || '').toLowerCase();
        return ref.includes(historySearchQuery) ||
               mat.includes(historySearchQuery) ||
               nom.includes(historySearchQuery) ||
               prenom.includes(historySearchQuery) ||
               dep.includes(historySearchQuery) ||
               motif.includes(historySearchQuery);
      });
    }

    const container = document.getElementById('history-table-container');
    if (container) {
      container.innerHTML = this.renderHistoryTableContent(filtered, isHR);
      this.bindReprintButtons();
      if (window.lucide) window.lucide.createIcons();
    }
  },

  promptGenerationModal(type) {
    const user = getCurrentUser();
    const isHR = user?.role === 'hr' || user?.role === 'admin' || user?.role === 'supervisor';
    const targetEmp = selectedEmployee || user || {};
    // Salarié retenu dans la modale : remis à null dès que la recherche est modifiée
    let modalEmployee = isHR ? targetEmp : user;

    const typeLabel = type === 'Attestation_Travail' ? 'Attestation de Travail' :
      (type === 'Releve_Emoluments' ? 'Relevé d\'Émoluments' :
      (type === 'Titre_Conge' ? 'Titre de Congé Réglementaire' : 'Certificat de Travail'));

    const modalHtml = `
      <form id="form-motif-doc" style="display: flex; flex-direction: column; gap: 16px;">
        
        ${isHR ? `
          <div class="form-group" style="margin-bottom: 4px;">
            <label style="font-weight: 700; display: block; margin-bottom: 6px; color: var(--primary);">
              <i data-lucide="user-check" style="width: 15px; height: 15px; vertical-align: middle;"></i> Choisir le Salarié Bénéficiaire :
            </label>
            ${renderEmployeeSearchBox({
              inputId: 'modal-employee-search',
              resultsId: 'modal-employee-results',
              selected: targetEmp
            })}
          </div>
        ` : ''}

        <div id="modal-emp-preview-box" style="background: rgba(19,84,122,0.06); padding: 14px; border-radius: 8px; border: 1px solid rgba(19,84,122,0.2);">
          <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">Document sollicité :</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(typeLabel)}</div>
          <div id="modal-emp-preview-text" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px;">
            Bénéficiaire : <strong>${escapeHtml(targetEmp.prenom || '')} ${escapeHtml((targetEmp.nom || '').toUpperCase())}</strong> 
            (Matricule #${escapeHtml(targetEmp.matricule || '')} • ${escapeHtml(targetEmp.departement || '-')} • ${escapeHtml(targetEmp.poste || '-')})
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight: 600; display: block; margin-bottom: 6px;">Motif / Organisme Destinataire * :</label>
          <select id="doc-motif-select" class="form-control" style="width: 100%; margin-bottom: 8px;">
            <option value="Dossier Bancaire / Demande de Crédit">Dossier Bancaire / Demande de Crédit</option>
            <option value="Dossier Consulaire / Demande de Visa">Dossier Consulaire / Demande de Visa</option>
            <option value="Dossier Logement / AADL / LPP">Dossier Logement (AADL, LPP, LPA)</option>
            <option value="Démarches Administratives Générales">Démarches Administratives Générales</option>
            <option value="Cessation d'Activité / Retraite">Cessation d'Activité / Retraite / Fin de Contrat</option>
            <option value="Autre">Autre motif personnalisé...</option>
          </select>
          <input type="text" id="doc-motif-custom" class="form-control" placeholder="Précisez le motif exact..." style="width: 100%; display: none;">
        </div>

        <div style="font-size: 0.82rem; color: #16a34a; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="shield-check" style="width: 16px; height: 16px;"></i>
          <span>Document officiel certifié avec en-tête réglementaire SCHB GICA, cachet DRH et QR code.</span>
        </div>
      </form>
    `;

    openModal(
      `Émission Document Officiel — ${typeLabel}`,
      modalHtml,
      [
        {
          label: 'Annuler',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Générer & Télécharger (PDF)',
          class: 'btn btn-primary',
          onClick: async () => {
            const selectVal = document.getElementById('doc-motif-select').value;
            const customVal = document.getElementById('doc-motif-custom').value.trim();
            const motif = selectVal === 'Autre' && customVal ? customVal : selectVal;

            if (isHR && !modalEmployee) {
              return toast('Veuillez sélectionner un salarié dans la liste de recherche.', 'warning');
            }
            const targetMat = isHR ? modalEmployee.matricule : user.matricule;

            try {
              const res = await api.generateAttestation({
                type_document: type,
                matricule: targetMat,
                motif
              });

              closeModal();
              toast(`Document officiel émis avec succès pour #${targetMat} !`, 'success');

              if (res.document) {
                this.openDocumentViewerModal(res.document);
              }

              // Actualiser la liste d'historique instantanément
              try {
                documentsHistory = await api.getAttestations();
                this.filterAndRenderHistory(isHR);
              } catch (errRefresh) {
                console.error('Erreur actualisation historique:', errRefresh);
              }

            } catch (err) {
              toast(err.message || 'Erreur lors de la génération du document.', 'error');
            }
          }
        }
      ]
    );

    // Recherche + sélection du bénéficiaire dans la modale
    bindEmployeeSearch({
      inputId: 'modal-employee-search',
      resultsId: 'modal-employee-results',
      onSelect: (found) => {
        modalEmployee = found;
        this.updateSelectedEmployeeUI(found);

        const previewText = document.getElementById('modal-emp-preview-text');
        if (previewText) {
          previewText.innerHTML = `
            Bénéficiaire : <strong>${escapeHtml(found.prenom || '')} ${escapeHtml((found.nom || '').toUpperCase())}</strong> 
            (Matricule #${escapeHtml(found.matricule || '')} • ${escapeHtml(found.departement || '-')} • ${escapeHtml(found.poste || '-')})
          `;
        }
      },
      // Tant qu'aucun employé n'est choisi dans la liste, la génération est bloquée
      onQueryChange: () => { modalEmployee = null; }
    });

    // Basculer l'input personnalisé si 'Autre'
    const select = document.getElementById('doc-motif-select');
    const custom = document.getElementById('doc-motif-custom');
    if (select && custom) {
      select.addEventListener('change', () => {
        custom.style.display = select.value === 'Autre' ? 'block' : 'none';
        if (select.value === 'Autre') custom.focus();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  },

  openDocumentViewerModal(doc) {
    const emp = doc.employee || {};
    const dateGen = formatDateFR(doc.date_generation);
    const dateEmbauche = formatDateFR(emp.date_embauche);
    const typeDoc = doc.type_document || 'Attestation_Travail';
    const nomComplet = `${(emp.nom || '').toUpperCase()} ${emp.prenom || ''}`.trim();
    const matriculeStr = `#${emp.matricule || ''}`;

    let docTitle = 'ATTESTATION DE TRAVAIL';
    let docBodyHtml = '';

    if (typeDoc === 'Releve_Emoluments') {
      docTitle = "RELEVÉ DES ÉMOLUMENTS & SALAIRE";
      const baseSalary = Number(emp.SalaireBase || emp.salaire_base || 56000);
      const primePanier = 13200; // 22j * 600 DA
      const primeTransport = 8800; // 22j * 400 DA
      const primeNuisance = 9500;
      const totalBrut = baseSalary + primePanier + primeTransport + primeNuisance;

      docBodyHtml = `
        <div style="text-align: center; margin: 24px 0 28px 0;">
          <h1 style="font-size: 1.55rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: underline; margin: 0; color: #1F497D;">
            ${docTitle}
          </h1>
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 24px; text-indent: 30px;">
          Nous soussignés, <strong>Société des Ciments de Hamma Bouziane (SCHB)</strong>, Filiale du 
          <strong>Groupe Industriel des Ciments d'Algérie (GICA)</strong>, attestons par la présente que :
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin-bottom: 24px; font-size: 1rem; line-height: 1.8;">
          <div>Monsieur / Madame : <strong>${escapeHtml(nomComplet)}</strong></div>
          <div>Matricule Professionnel : <strong>${escapeHtml(matriculeStr)}</strong></div>
          <div>Date de Recrutement : <strong>${dateEmbauche}</strong></div>
          <div>Département / Direction : <strong>${escapeHtml(emp.departement || '-')}</strong></div>
          <div>Fonction Occupée : <strong>${escapeHtml(emp.poste || '-')}</strong></div>
        </div>

        <div style="font-size: 1rem; line-height: 1.6; margin-bottom: 14px;">
          Perçoit à ce jour, au titre de ses fonctions contractuelles, les éléments de rémunération mensuelle suivants :
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.95rem;">
          <thead>
            <tr style="background: #1F497D; color: white;">
              <th style="padding: 8px 12px; text-align: left; border: 1px solid #1F497D;">Rubrique de Rémunération</th>
              <th style="padding: 8px 12px; text-align: right; border: 1px solid #1F497D;">Montant Mensuel (Dinar Algérien)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: 600;">Salaire de Base Contractuel</td>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">${baseSalary.toLocaleString('fr-FR')} DA</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Indemnité de Nuisance & Risque Industriel Cimenterie</td>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${primeNuisance.toLocaleString('fr-FR')} DA</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Indemnité Forfaitaire de Panier (22 jours)</td>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${primePanier.toLocaleString('fr-FR')} DA</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Indemnité de Transport Réglementaire</td>
              <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${primeTransport.toLocaleString('fr-FR')} DA</td>
            </tr>
            <tr style="background: #eff6ff; font-weight: 800; color: #1e3a8a;">
              <td style="padding: 10px 12px; border: 2px solid #1F497D;">TOTAL RÉMUNÉRATION BRUTE MENSUELLE</td>
              <td style="padding: 10px 12px; border: 2px solid #1F497D; text-align: right; font-size: 1.1rem;">${totalBrut.toLocaleString('fr-FR')} DA</td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 0.95rem; line-height: 1.7; text-align: justify; margin-bottom: 24px; text-indent: 30px;">
          Le présent relevé est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit auprès des organismes compétents (Objet : <strong>${escapeHtml(doc.motif || 'Démarche Administrative / Dossier Financier')}</strong>).
        </div>
      `;
    } else if (typeDoc === 'Certificat_Travail') {
      docTitle = "CERTIFICAT DE TRAVAIL";
      docBodyHtml = `
        <div style="text-align: center; margin: 24px 0 28px 0;">
          <h1 style="font-size: 1.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: underline; margin: 0; color: #1F497D;">
            ${docTitle}
          </h1>
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 30px; text-indent: 30px;">
          Nous soussignés, <strong>Société des Ciments de Hamma Bouziane (SCHB)</strong>, Filiale du 
          <strong>Groupe Industriel des Ciments d'Algérie (GICA)</strong>, sise à Z.I Rhumel, Boussouf / Unité Hamma Bouziane, Constantine, certifions par la présente que :
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px 20px; margin-bottom: 30px; font-size: 1.05rem; line-height: 2;">
          <div>Monsieur / Madame : <strong>${escapeHtml(nomComplet)}</strong></div>
          <div>Matricule Professionnel : <strong>${escapeHtml(matriculeStr)}</strong></div>
          <div>Département / Direction : <strong>${escapeHtml(emp.departement || '-')}</strong></div>
          <div>Poste & Fonctions : <strong>${escapeHtml(emp.poste || '-')}</strong></div>
          <div>Période d'activité : Du <strong>${dateEmbauche}</strong> à ce jour</div>
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 30px; text-indent: 30px;">
          Nous attestons qu'au cours de sa période d'activité au sein de notre complexe industriel cimentier, Monsieur / Madame ${escapeHtml(nomComplet)} s'est acquitté(e) de ses obligations professionnelles avec rigueur, intégrité et professionnalisme.
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 36px; text-indent: 30px;">
          L'intéressé(e) est libre de tout engagement légal et contractuel envers la Société des Ciments de Hamma Bouziane à compter de la date de cessation de ses fonctions. Le présent certificat lui est délivré pour faire valoir ce que de droit.
        </div>
      `;
    } else if (typeDoc === 'Titre_Conge') {
      docTitle = "TITRE DE CONGÉ RÉGLEMENTAIRE";
      docBodyHtml = `
        <div style="text-align: center; margin: 24px 0 28px 0;">
          <h1 style="font-size: 1.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: underline; margin: 0; color: #1F497D;">
            ${docTitle}
          </h1>
          <div style="font-size: 9pt; color: #64748b; margin-top: 6px;">
            Conforme à la Convention Collective & au Règlement Intérieur SCHB GICA
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10pt;">
          <tbody>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 8px 6px; width: 35%; color: #475569; font-weight: 600;">Collaborateur :</td>
              <td style="padding: 8px 6px; font-weight: 800; color: #1F497D; font-size: 11pt;">${escapeHtml(nomComplet)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 8px 6px; color: #475569; font-weight: 600;">Matricule :</td>
              <td style="padding: 8px 6px; font-weight: 700;">${escapeHtml(matriculeStr)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 8px 6px; color: #475569; font-weight: 600;">Département / Direction :</td>
              <td style="padding: 8px 6px; font-weight: 600;">${escapeHtml(emp.departement || '-')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 8px 6px; color: #475569; font-weight: 600;">Poste Occupé :</td>
              <td style="padding: 8px 6px;">${escapeHtml(emp.poste || '-')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 8px 6px; color: #475569; font-weight: 600;">Nature du Titre :</td>
              <td style="padding: 8px 6px; font-weight: 700; color: #0284c7;">CONGÉ RÉGLEMENTAIRE PAYÉ</td>
            </tr>
            <tr>
              <td style="padding: 8px 6px; color: #475569; font-weight: 600;">Statut :</td>
              <td style="padding: 8px 6px; font-weight: 800; color: #16a34a;">AUTORISÉ & VALIDÉ PAR LA DRH</td>
            </tr>
          </tbody>
        </table>

        <div style="background: #f1f5f9; border-left: 4px solid #1F497D; padding: 12px 16px; font-size: 8.5pt; color: #334155; margin-bottom: 24px; line-height: 1.5;">
          <strong>AVIS OBLIGATOIRE :</strong> L'intéressé(e) est tenu(e) de réintégrer son poste de travail le jour prescrit dès la première heure. Tout retard non justifié dans les délais réglementaires expose son auteur aux mesures prévues par la convention collective SCHB GICA.
        </div>
      `;
    } else {
      // Attestation de Travail (par défaut)
      docTitle = "ATTESTATION DE TRAVAIL";
      docBodyHtml = `
        <div style="text-align: center; margin: 24px 0 28px 0;">
          <h1 style="font-size: 1.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: underline; margin: 0; color: #1F497D;">
            ${docTitle}
          </h1>
        </div>

        <div style="font-size: 1.1rem; line-height: 1.8; text-align: justify; margin-bottom: 30px; text-indent: 40px;">
          Nous soussignés, <strong>Société des Ciments de Hamma Bouziane (SCHB)</strong>, Filiale du 
          <strong>Groupe Industriel des Ciments d'Algérie (GICA)</strong>, attestons par la présente que :
        </div>

        <div style="font-size: 1.1rem; line-height: 2; margin: 0 0 30px 40px;">
          Monsieur / Madame : <strong>${escapeHtml(nomComplet)}</strong><br>
          Matricule Professionnel : <strong>${escapeHtml(matriculeStr)}</strong><br>
          Recruté(e) le : <strong>${dateEmbauche}</strong><br>
          Département / Service : <strong>${escapeHtml(emp.departement || '-')}</strong><br>
          Fonction Occupée : <strong>${escapeHtml(emp.poste || '-')}</strong><br>
          Type de Contrat : <strong>${escapeHtml(emp.type_contrat || 'Contrat à Durée Indéterminée (CDI)')}</strong>
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 30px; text-indent: 40px;">
          Est actuellement en activité au sein de notre complexe industriel cimentier et n'a fait l'objet d'aucune 
          mesure de cessation ou de suspension d'activité à ce jour.
        </div>

        <div style="font-size: 1.05rem; line-height: 1.8; text-align: justify; margin-bottom: 36px; text-indent: 40px;">
          La présente attestation est délivrée à l'intéressé(e) à sa demande ${doc.motif ? `pour : <strong>${escapeHtml(doc.motif)}</strong>` : 'pour servir et valoir ce que de droit'}.
        </div>
      `;
    }

    const fullBodyHtml = `
      ${docBodyHtml}
      ${renderOfficialSeal({ qrCodeRef: doc.reference })}
    `;

    const docViewerHtml = wrapInOfficialDocument(fullBodyHtml, {
      ref: doc.reference,
      date: dateGen,
      departement: 'DIRECTION DES RESSOURCES HUMAINES & AFFAIRES GÉNÉRALES'
    });

    openModal(
      `Document Officiel — ${doc.reference}`,
      docViewerHtml,
      [
        {
          label: 'Fermer',
          class: 'btn btn-secondary',
          onClick: () => closeModal()
        },
        {
          label: 'Télécharger / Imprimer (PDF)',
          class: 'btn btn-primary',
          onClick: () => {
            printOfficialDocument(fullBodyHtml, {
              documentTitle: `${docTitle} — SCHB GICA (${doc.reference})`,
              ref: doc.reference,
              date: dateGen,
              departement: 'DIRECTION DES RESSOURCES HUMAINES & AFFAIRES GÉNÉRALES'
            });
          }
        }
      ]
    );
  }
};
