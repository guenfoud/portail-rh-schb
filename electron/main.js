/**
 * Application de bureau — Console de lancement GICA HR
 * ----------------------------------------------------
 * Ouvre une vraie fenêtre (Electron) qui pilote le projet situé dans le
 * même dossier que l'exécutable (ou dans le dossier choisi par l'utilisateur).
 *
 * Le dossier du projet doit contenir server.js, package.json et le code source.
 */

import { app, BrowserWindow, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLauncher, closeLauncher } from '../launcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_TITLE = 'Console de lancement — SCHB Gica';

let mainWindow = null;
let launcherUrl = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* Localisation du dossier du projet                                   */
/* ------------------------------------------------------------------ */

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'launcher-config.json');

function readSavedProject() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
    return typeof data.projectDir === 'string' ? data.projectDir : null;
  } catch {
    return null;
  }
}

function saveProject(dir) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify({ projectDir: dir }, null, 2), 'utf8');
  } catch {
    /* le dossier reste utilisable pour la session en cours */
  }
}

function isProjectDir(dir) {
  if (!dir) return false;
  try {
    return fs.existsSync(path.join(dir, 'server.js')) && fs.existsSync(path.join(dir, 'package.json'));
  } catch {
    return false;
  }
}

function projectCandidates() {
  const list = [];
  if (process.env.GICA_PROJECT_DIR) list.push(process.env.GICA_PROJECT_DIR);
  const saved = readSavedProject();
  if (saved) list.push(saved);
  // Version portable : dossier où se trouve le .exe
  if (process.env.PORTABLE_EXECUTABLE_DIR) list.push(process.env.PORTABLE_EXECUTABLE_DIR);
  try { list.push(path.dirname(app.getPath('exe'))); } catch { /* ignore */ }
  // Lancement depuis les sources : electron/.. = racine du dépôt
  list.push(path.resolve(__dirname, '..'));
  list.push(process.cwd());
  return [...new Set(list.filter(Boolean))];
}

async function resolveProjectDir() {
  for (const dir of projectCandidates()) {
    if (isProjectDir(dir)) return dir;
  }

  // Aucun projet trouvé : on demande le dossier à l'utilisateur.
  await dialog.showMessageBox({
    type: 'info',
    title: APP_TITLE,
    message: 'Où se trouve le projet GICA HR ?',
    detail:
      "Sélectionnez le dossier contenant server.js et package.json.\n" +
      "Astuce : placez cet exécutable directement dans le dossier du projet pour un lancement automatique.",
    buttons: ['Choisir le dossier…', 'Quitter'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }).then(({ response }) => {
    if (response === 1) {
      app.exit(0);
      throw new Error('Annulé');
    }
  });

  const picked = await dialog.showOpenDialog({
    title: 'Dossier du projet GICA HR',
    properties: ['openDirectory'],
    buttonLabel: 'Utiliser ce dossier'
  });

  const dir = picked.filePaths?.[0];
  if (!picked.canceled && isProjectDir(dir)) {
    saveProject(dir);
    return dir;
  }

  await dialog.showMessageBox({
    type: 'error',
    title: APP_TITLE,
    message: 'Dossier invalide',
    detail: 'Le dossier choisi ne contient pas server.js et package.json.',
    buttons: ['Fermer']
  });
  app.exit(1);
  throw new Error('Dossier de projet invalide');
}

/* ------------------------------------------------------------------ */
/* Démarrage de la console                                             */
/* ------------------------------------------------------------------ */

async function startLauncherFor(root) {
  const autoStart = process.env.GICA_NO_AUTOSTART !== '1';
  let lastError = null;
  for (let port = 8090; port <= 8099; port++) {
    try {
      const launcher = await createLauncher({ root, port, autoStart, openBrowser: false });
      return launcher.url;
    } catch (err) {
      lastError = err;
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw lastError || new Error('Aucun port disponible pour la console.');
}

function errorPage(message) {
  const html = `<!DOCTYPE html><html lang="fr" style="color-scheme:light"><head><meta charset="utf-8"><title>Erreur</title>
  <style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
  background:#f4f6fb;color:#0f172a;font-family:"Segoe UI",system-ui,sans-serif}
  .box{max-width:620px;padding:32px;border:1px solid #dfe6f1;border-radius:16px;
  background:#fff;box-shadow:0 20px 50px rgba(15,23,42,.12)}
  h1{margin:0 0 12px;font-size:1.2rem;color:#b91c1c}pre{white-space:pre-wrap;color:#334155;font-size:.85rem}
  p{color:#64748b;font-size:.85rem}</style></head><body><div class="box">
  <h1>La console n'a pas pu démarrer</h1><pre>${String(message).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
  <p>Vérifiez que Node.js est installé et que le dossier du projet contient bien server.js.</p>
  </div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    title: APP_TITLE,
    backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Console] Chargement échoué :', code, desc, url);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Console] Processus de rendu terminé :', details);
  });

  // Les liens externes s'ouvrent dans le navigateur du système.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith('http://localhost:') && !target.startsWith('http://127.0.0.1:')) {
      shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(url).catch((err) => {
    mainWindow?.loadURL(errorPage(err.message));
  });

  return mainWindow;
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    let root;
    try {
      root = await resolveProjectDir();
    } catch {
      return;
    }

    console.log('[Console] Dossier du projet :', root);
    try {
      launcherUrl = await startLauncherFor(root);
      console.log('[Console] Interface prête :', launcherUrl);
      createWindow(launcherUrl);
    } catch (err) {
      console.error('[Console] Démarrage impossible :', err);
      const message = err?.code === 'EADDRINUSE'
        ? `Port occupé : ${err.message}`
        : (err?.stack || err?.message || String(err));
      createWindow(errorPage(message));
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(launcherUrl || errorPage('Console non démarrée.'));
      }
    });
  });

  // Fermeture de la fenêtre : on arrête proprement les services du projet.
  app.on('window-all-closed', () => {
    console.log('[Console] Toutes les fenêtres sont fermées — arrêt de l\'application.');
    app.quit();
  });

  app.on('child-process-gone', (_e, details) => {
    console.error('[Console] Processus annexe terminé :', details?.type, details?.reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Console] Exception non gérée :', err);
  });

  app.on('before-quit', (event) => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    const finish = () => app.exit(0);
    Promise.race([
      closeLauncher().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 12000))
    ]).then(finish, finish);
  });
}
