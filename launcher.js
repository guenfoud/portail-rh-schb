/**
 * Console de lancement GICA HR
 * ----------------------------
 * Remplace run_all.bat : démarre le serveur API et le frontend Vite,
 * expose une interface graphique locale (http://localhost:8090) avec
 * l'état des services, les logs en temps réel et les opérations de maintenance.
 *
 * Usage (console navigateur) :
 *   node launcher.js            -> ouvre la console (services arrêtés)
 *   node launcher.js --start    -> ouvre la console et démarre tout
 *   node launcher.js --no-open  -> ne pas ouvrir le navigateur
 *   LAUNCHER_PORT=8095 node launcher.js
 *
 * Usage (application de bureau Electron) : voir electron/main.js
 */

import dotenv from 'dotenv';
import express from 'express';
import { spawn, exec } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Fichier de l'interface : toujours à côté de launcher.js (même dans un paquet asar).
const UI_FILE = path.join(__dirname, 'launcher', 'ui.html');

// ROOT = dossier du projet surveillé (dossier de l'exe ou dossier du dépôt).
let ROOT = __dirname;
const IS_WIN = process.platform === 'win32';
let LAUNCHER_PORT = Number(process.env.LAUNCHER_PORT || 8090);
const HOST = '127.0.0.1';
const MAX_LOG_LINES = 2000;

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

const SERVICES = {
  backend: {
    key: 'backend',
    label: 'Serveur API',
    subtitle: 'Express + MySQL',
    port: 8081,
    command: 'node server.js',
    check: { type: 'log', pattern: /Serveur API GICA en cours d'exécution/ },
    openUrl: null,
    accent: '#f59e0b'
  },
  frontend: {
    key: 'frontend',
    label: 'Interface Web',
    subtitle: 'Vite (développement)',
    port: 8082,
    command: 'npm run dev',
    check: { type: 'http' },
    openUrl: 'http://localhost:8082',
    accent: '#7c3aed'
  }
};

const state = {
  startedAt: Date.now(),
  services: {},
  ops: {
    running: false,
    label: '',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    lastResult: null
  }
};

for (const key of Object.keys(SERVICES)) {
  state.services[key] = {
    status: 'stopped', // stopped | starting | running | external | stopping | error
    external: false,
    pid: null,
    startedAt: null,
    stoppedAt: null,
    exitCode: null,
    ready: false,
    message: '',
    restarts: 0,
    child: null,
    logs: [],
    seq: 0
  };
}

const opsLog = { logs: [], seq: 0 };

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const stripAnsi = (s) => String(s).replace(ANSI, '').replace(/\r/g, '');

function logStore(key) {
  return key === 'ops' ? opsLog : state.services[key];
}

function pushLog(key, stream, text) {
  const store = logStore(key);
  if (!store) return;
  const lines = stripAnsi(text).split('\n');
  for (const raw of lines) {
    if (raw === '') continue;
    const line = { seq: ++store.seq, t: Date.now(), stream, text: raw };
    store.logs.push(line);
    if (store.logs.length > MAX_LOG_LINES) store.logs.splice(0, store.logs.length - MAX_LOG_LINES);
    broadcast({ type: 'log', store: key, line });
  }
}

function broadcast(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { /* client parti */ }
  }
}

const sseClients = new Set();

function publicState() {
  const now = Date.now();
  const services = {};
  for (const [key, svc] of Object.entries(SERVICES)) {
    const st = state.services[key];
    services[key] = {
      key,
      label: svc.label,
      subtitle: svc.subtitle,
      port: svc.port,
      accent: svc.accent,
      openUrl: svc.openUrl,
      status: st.status,
      external: st.external,
      pid: st.pid,
      ready: st.ready,
      message: st.message,
      exitCode: st.exitCode,
      restarts: st.restarts,
      startedAt: st.startedAt,
      stoppedAt: st.stoppedAt,
      uptime: st.status === 'running' || st.status === 'starting' ? Math.max(0, now - (st.startedAt || now)) : 0,
      logCount: st.logs.length
    };
  }
  return {
    launcher: { port: LAUNCHER_PORT, startedAt: state.startedAt, uptime: now - state.startedAt, platform: process.platform },
    services,
    ops: {
      running: state.ops.running,
      label: state.ops.label,
      startedAt: state.ops.startedAt,
      finishedAt: state.ops.finishedAt,
      exitCode: state.ops.exitCode,
      lastResult: state.ops.lastResult,
      logCount: opsLog.logs.length
    }
  };
}

function pushState() {
  broadcast({ type: 'state', state: publicState() });
}

function setStatus(key, status, patch = {}) {
  const st = state.services[key];
  st.status = status;
  Object.assign(st, patch);
  pushState();
}

function portInUse(port, timeout = 900) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, '127.0.0.1');
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpOk(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const cmd = IS_WIN ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, { shell: true }, () => {});
}

/* ------------------------------------------------------------------ */
/* Démarrage / arrêt des services                                      */
/* ------------------------------------------------------------------ */

async function startService(key) {
  const svc = SERVICES[key];
  const st = state.services[key];

  if (st.status === 'running' || st.status === 'starting') {
    return { ok: false, message: `${svc.label} est déjà en cours.` };
  }
  if (st.status === 'external') {
    return { ok: false, message: `${svc.label} répond déjà sur le port ${svc.port} (instance lancée hors console).` };
  }

  if (await portInUse(svc.port)) {
    const alreadyOurs = svc.check.type === 'http' ? await httpOk(`http://127.0.0.1:${svc.port}/`) : true;
    setStatus(key, 'external', {
      external: true,
      ready: alreadyOurs,
      message: `Port ${svc.port} déjà occupé : une instance tourne en dehors de la console.`,
      startedAt: Date.now()
    });
    pushLog(key, 'system', `[Console] Port ${svc.port} déjà utilisé — démarrage ignoré.`);
    return { ok: false, message: `Port ${svc.port} déjà occupé.` };
  }

  pushLog(key, 'system', `[Console] Démarrage de ${svc.label} (${svc.command})…`);
  setStatus(key, 'starting', {
    external: false,
    ready: false,
    pid: null,
    startedAt: Date.now(),
    stoppedAt: null,
    exitCode: null,
    message: 'Démarrage en cours…'
  });

  let child;
  try {
    child = spawn(svc.command, {
      cwd: ROOT,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '1' },
      windowsHide: true,
      detached: !IS_WIN
    });
  } catch (err) {
    setStatus(key, 'error', { message: `Impossible de lancer : ${err.message}` });
    pushLog(key, 'stderr', `[Console] ${err.message}`);
    return { ok: false, message: err.message };
  }

  st.child = child;
  st.pid = child.pid;

  const handleChunk = (stream) => (buf) => pushLog(key, stream, buf.toString('utf8'));
  child.stdout?.on('data', handleChunk('stdout'));
  child.stderr?.on('data', handleChunk('stderr'));

  child.once('exit', (code, signal) => {
    st.child = null;
    st.pid = null;
    st.ready = false;
    st.exitCode = code;
    const wasStopping = st.status === 'stopping';
    pushLog(key, 'system', `[Console] ${svc.label} terminé (code ${code ?? '—'}${signal ? `, signal ${signal}` : ''}).`);
    setStatus(key, wasStopping || code === 0 ? 'stopped' : 'error', {
      stoppedAt: Date.now(),
      external: false,
      message: wasStopping ? 'Arrêté.' : code === 0 ? 'Arrêté proprement.' : `Arrêt inattendu (code ${code}).`
    });
  });

  // Attente de disponibilité (max 90 s)
  const deadline = Date.now() + 90000;
  (async () => {
    while (Date.now() < deadline) {
      await sleep(700);
      if (!st.child) return; // processus terminé

      let ready = false;
      if (svc.check.type === 'log') {
        ready = st.logs.some((l) => svc.check.pattern.test(l.text));
      } else {
        ready = await httpOk(`http://127.0.0.1:${svc.port}/`);
      }
      if (ready) {
        setStatus(key, 'running', { ready: true, message: `Disponible sur le port ${svc.port}.` });
        pushLog(key, 'system', `[Console] ${svc.label} prêt sur le port ${svc.port}.`);
        return;
      }
    }
    if (st.child) {
      setStatus(key, 'running', { ready: false, message: `Processus lancé mais port ${svc.port} non confirmé.` });
    }
  })();

  return { ok: true, message: `${svc.label} : démarrage lancé.` };
}

function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    if (IS_WIN) {
      exec(`taskkill /PID ${pid} /T /F`, () => resolve());
    } else {
      try { process.kill(-pid, 'SIGTERM'); } catch { /* déjà mort */ }
      setTimeout(() => {
        try { process.kill(-pid, 'SIGKILL'); } catch { /* déjà mort */ }
        resolve();
      }, 3000);
    }
  });
}

function portOwnerPid(port) {
  return new Promise((resolve) => {
    if (IS_WIN) {
      exec('netstat -ano -p tcp', (err, stdout) => {
        if (err) return resolve(null);
        for (const line of stdout.split(/\r?\n/)) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 5 || parts[3] !== 'LISTENING') continue;
          if (parts[1].endsWith(`:${port}`)) return resolve(Number(parts[4]) || null);
        }
        resolve(null);
      });
    } else {
      exec(`lsof -ti tcp:${port} -sTCP:LISTEN`, (err, stdout) => {
        if (err) return resolve(null);
        const pid = Number(String(stdout).split('\n')[0]);
        resolve(Number.isFinite(pid) && pid > 0 ? pid : null);
      });
    }
  });
}

async function stopService(key) {
  const svc = SERVICES[key];
  const st = state.services[key];

  if (st.status === 'external') {
    const owner = await portOwnerPid(svc.port);
    if (!owner) {
      return { ok: false, message: `Aucun processus identifié sur le port ${svc.port}.` };
    }
    setStatus(key, 'stopping', { message: `Arrêt de l'instance externe (PID ${owner})…` });
    pushLog(key, 'system', `[Console] Arrêt de l'instance externe ${svc.label} (PID ${owner})…`);
    await killTree(owner);
    for (let i = 0; i < 20 && (await portInUse(svc.port)); i++) await sleep(250);
    if (await portInUse(svc.port)) {
      setStatus(key, 'external', { message: `Le port ${svc.port} reste occupé.` });
      return { ok: false, message: `Le port ${svc.port} reste occupé.` };
    }
    setStatus(key, 'stopped', { external: false, pid: null, stoppedAt: Date.now(), ready: false, message: 'Instance externe arrêtée.' });
    return { ok: true, message: `${svc.label} : instance externe arrêtée.` };
  }

  if (!st.child) {
    setStatus(key, 'stopped', { message: 'Déjà arrêté.' });
    return { ok: true, message: `${svc.label} était déjà arrêté.` };
  }

  const pid = st.pid;
  setStatus(key, 'stopping', { message: 'Arrêt en cours…' });
  pushLog(key, 'system', `[Console] Arrêt de ${svc.label} (PID ${pid})…`);
  await killTree(pid);

  const deadline = Date.now() + 8000;
  while (st.child && Date.now() < deadline) await sleep(200);

  if (st.child) {
    st.child = null;
    setStatus(key, 'error', { pid: null, message: 'Le processus ne répond pas à l\'arrêt.' });
    return { ok: false, message: `${svc.label} ne s'arrête pas.` };
  }

  setStatus(key, 'stopped', { pid: null, stoppedAt: Date.now(), message: 'Arrêté par la console.' });
  return { ok: true, message: `${svc.label} arrêté.` };
}

async function restartService(key) {
  const st = state.services[key];
  if (st.child) await stopService(key);
  await sleep(600);
  st.restarts += 1;
  return startService(key);
}

/* ------------------------------------------------------------------ */
/* Opérations (build, installation)                                    */
/* ------------------------------------------------------------------ */

function runOperation(label, command) {
  if (state.ops.running) return { ok: false, message: 'Une opération est déjà en cours.' };

  state.ops = { running: true, label, startedAt: Date.now(), finishedAt: null, exitCode: null, lastResult: null };
  pushLog('ops', 'system', `[Opération] ${label} — ${command}`);
  pushState();

  const child = spawn(command, { cwd: ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '1' }, windowsHide: true });
  child.stdout?.on('data', (b) => pushLog('ops', 'stdout', b.toString('utf8')));
  child.stderr?.on('data', (b) => pushLog('ops', 'stderr', b.toString('utf8')));

  child.once('exit', (code) => {
    state.ops.running = false;
    state.ops.finishedAt = Date.now();
    state.ops.exitCode = code;
    state.ops.lastResult = code === 0 ? 'success' : 'error';
    pushLog('ops', 'system', `[Opération] ${label} terminé avec le code ${code}.`);
    pushState();
  });

  return { ok: true, message: `${label} en cours…` };
}

/* ------------------------------------------------------------------ */
/* Contrôles système                                                   */
/* ------------------------------------------------------------------ */

function readNpmVersion() {
  return new Promise((resolve) => {
    exec('npm -v', { cwd: ROOT }, (err, stdout) => resolve(err ? null : stdout.trim()));
  });
}

// Version de Node réellement utilisée pour lancer le projet (celle du système).
function readNodeVersion() {
  return new Promise((resolve) => {
    exec('node -v', { cwd: ROOT }, (err, stdout) => resolve(err ? process.version : stdout.trim()));
  });
}

async function systemChecks() {
  const envPath = path.join(ROOT, '.env');
  const envExists = fs.existsSync(envPath);
  let envKeys = [];
  if (envExists) {
    envKeys = fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => l.split('=')[0].trim());
  }
  const requiredEnv = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
  const smtpEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const missingEnv = requiredEnv.filter((k) => !envKeys.includes(k));
  const missingSmtp = smtpEnv.filter((k) => !envKeys.includes(k));

  const distDir = path.join(ROOT, 'dist');
  let dist = null;
  if (fs.existsSync(distDir)) {
    const stat = fs.statSync(distDir);
    dist = { exists: true, modifiedAt: stat.mtimeMs };
  }

  const ports = {};
  for (const [key, svc] of Object.entries(SERVICES)) {
    ports[key] = await portInUse(svc.port);
  }

  return {
    node: await readNodeVersion(),
    nodeRuntime: process.version,
    npm: await readNpmVersion(),
    platform: `${process.platform} ${process.arch}`,
    cwd: ROOT,
    modulesInstalled: fs.existsSync(path.join(ROOT, 'node_modules')),
    envExists,
    envKeys,
    missingEnv,
    missingSmtp,
    smtpConfigured: missingSmtp.length === 0,
    seedDemo: String(process.env.SEED_DEMO || '').toLowerCase() === 'true',
    database: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || '3306',
      name: process.env.MYSQL_DATABASE || 'gica'
    },
    dist,
    ports
  };
}

async function checkDatabase() {
  let mysql;
  try {
    mysql = (await import('mysql2/promise')).default;
  } catch (err) {
    return { ok: false, message: 'Module mysql2 introuvable — exécutez npm install.' };
  }
  const cfg = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : '',
    database: process.env.MYSQL_DATABASE || 'gica',
    connectTimeout: 5000
  };
  const startedAt = Date.now();
  let conn;
  try {
    conn = await mysql.createConnection(cfg);
    const [rows] = await conn.query('SELECT DATABASE() AS db, @@version AS version');
    const [counts] = await conn.query(
      "SELECT (SELECT COUNT(*) FROM employees) AS employees, (SELECT COUNT(*) FROM pointages) AS pointages"
    );
    return {
      ok: true,
      latency: Date.now() - startedAt,
      target: `${cfg.host}:${cfg.port}/${cfg.database}`,
      server: rows[0]?.version,
      employees: counts[0]?.employees ?? null,
      pointages: counts[0]?.pointages ?? null
    };
  } catch (err) {
    return {
      ok: false,
      latency: Date.now() - startedAt,
      target: `${cfg.host}:${cfg.port}/${cfg.database}`,
      code: err.code || null,
      message: err.code === 'ECONNREFUSED'
        ? 'MySQL ne répond pas : vérifiez que le service MySQL est démarré.'
        : err.code === 'ER_ACCESS_DENIED_ERROR'
          ? 'Identifiants MySQL refusés : vérifiez MYSQL_USER / MYSQL_PASSWORD dans .env.'
          : err.code === 'ER_BAD_DB_ERROR'
            ? 'Base de données inexistante : créez la base indiquée dans MYSQL_DATABASE.'
            : (err.sqlMessage || err.message)
    };
  } finally {
    try { await conn?.end(); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/* Serveur de la console                                               */
/* ------------------------------------------------------------------ */

const app = express();
app.use(express.json({ limit: '64kb' }));

// La console pilote des processus : elle n'accepte que les appels de l'interface locale.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return res.status(403).json({ ok: false, message: 'Origine non autorisée.' });
  }
  next();
});

app.get('/', (req, res) => {
  res.type('html').send(fs.readFileSync(UI_FILE, 'utf8'));
});

app.get('/api/state', async (req, res) => {
  res.json({ ok: true, state: publicState(), system: await systemChecks() });
});

app.get('/api/logs/:key', (req, res) => {
  const store = logStore(req.params.key);
  if (!store) return res.status(404).json({ ok: false, message: 'Service inconnu.' });
  const since = Number(req.query.since || 0);
  res.json({ ok: true, seq: store.seq, lines: store.logs.filter((l) => l.seq > since) });
});

app.post('/api/logs/:key/clear', (req, res) => {
  const store = logStore(req.params.key);
  if (!store) return res.status(404).json({ ok: false, message: 'Service inconnu.' });
  store.logs.length = 0;
  res.json({ ok: true });
});

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`data: ${JSON.stringify({ type: 'state', state: publicState() })}\n\n`);
  sseClients.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.post('/api/services/:key/:action', async (req, res) => {
  const { key, action } = req.params;
  if (!SERVICES[key]) return res.status(404).json({ ok: false, message: 'Service inconnu.' });

  let result;
  if (action === 'start') result = await startService(key);
  else if (action === 'stop') result = await stopService(key);
  else if (action === 'restart') result = await restartService(key);
  else return res.status(400).json({ ok: false, message: 'Action inconnue.' });

  pushState();
  res.json(result);
});

app.post('/api/all/:action', async (req, res) => {
  const { action } = req.params;
  const messages = [];
  if (action === 'start') {
    for (const key of ['backend', 'frontend']) messages.push((await startService(key)).message);
  } else if (action === 'stop') {
    for (const key of ['frontend', 'backend']) messages.push((await stopService(key)).message);
  } else if (action === 'restart') {
    for (const key of ['frontend', 'backend']) await stopService(key);
    await sleep(600);
    for (const key of ['backend', 'frontend']) messages.push((await startService(key)).message);
  } else {
    return res.status(400).json({ ok: false, message: 'Action inconnue.' });
  }
  pushState();
  res.json({ ok: true, message: messages.filter(Boolean).join(' ') });
});

app.post('/api/operation/build', (req, res) => {
  res.json(runOperation('Build de production', 'npm run build'));
});

app.post('/api/operation/install', (req, res) => {
  res.json(runOperation('Installation des dépendances', 'npm install'));
});

app.post('/api/system/db-check', async (req, res) => {
  const result = await checkDatabase();
  pushLog('ops', result.ok ? 'stdout' : 'stderr',
    `[MySQL] ${result.target} — ${result.ok ? `OK (${result.latency} ms)` : result.message}`);
  res.json({ ok: result.ok, result });
});

app.post('/api/open', (req, res) => {
  const url = req.body?.url === 'launcher' ? `http://localhost:${LAUNCHER_PORT}` : 'http://localhost:8082';
  openBrowser(url);
  res.json({ ok: true, url });
});

/* ------------------------------------------------------------------ */
/* Cycle de vie (console navigateur et application Electron)           */
/* ------------------------------------------------------------------ */

let activeServer = null;
let shuttingDown = false;

function listen(port) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, HOST);
    srv.once('listening', () => resolve(srv));
    srv.once('error', reject);
  });
}

/**
 * Démarre la console pour un dossier de projet donné.
 * @returns {{url:string, port:number, root:string}}
 */
export async function createLauncher({
  root = __dirname,
  port = LAUNCHER_PORT,
  autoStart = false,
  openBrowser: shouldOpen = false
} = {}) {
  ROOT = path.resolve(root);
  LAUNCHER_PORT = port;
  dotenv.config({ path: path.join(ROOT, '.env') });

  activeServer = await listen(LAUNCHER_PORT);
  const url = `http://localhost:${LAUNCHER_PORT}`;

  // Repérer les services déjà lancés hors console pour un état exact dès l'ouverture.
  for (const [key, svc] of Object.entries(SERVICES)) {
    if (!(await portInUse(svc.port))) continue;
    const st = state.services[key];
    const answers = svc.check.type === 'http' ? await httpOk(`http://127.0.0.1:${svc.port}/`) : false;
    st.status = 'external';
    st.external = true;
    st.ready = answers;
    st.message = `Une instance de « ${svc.label} » tourne déjà sur le port ${svc.port} (lancée hors console).`;
    pushLog(key, 'system', `[Console] Instance existante détectée sur le port ${svc.port}.`);
  }

  if (shouldOpen) openBrowser(url);
  if (autoStart) {
    await sleep(400);
    for (const key of ['backend', 'frontend']) await startService(key);
  }

  return { url, port: LAUNCHER_PORT, root: ROOT };
}

/** Arrête les services surveillés puis le serveur de la console. */
export async function closeLauncher() {
  for (const key of ['frontend', 'backend']) {
    if (state.services[key]?.child) await stopService(key);
  }
  for (const res of sseClients) {
    try { res.end(); } catch { /* ignore */ }
  }
  sseClients.clear();
  if (activeServer) {
    const srv = activeServer;
    activeServer = null;
    await new Promise((resolve) => srv.close(resolve));
  }
}

export function shutdownGracefully() {
  if (shuttingDown) return Promise.resolve();
  shuttingDown = true;
  return closeLauncher();
}

/* ---------------------------- CLI ---------------------------------- */

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  createLauncher({
    autoStart: argv.includes('--start'),
    openBrowser: !argv.includes('--no-open')
  })
    .then(({ url, root }) => {
      console.log('==================================================');
      console.log('  Console de lancement GICA HR');
      console.log(`  Projet    : ${root}`);
      console.log(`  Interface : ${url}`);
      console.log('  Ctrl+C pour tout arrêter et quitter');
      console.log('==================================================');
    })
    .catch((err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Le port ${LAUNCHER_PORT} est déjà utilisé. Essayez LAUNCHER_PORT=8095 node launcher.js`);
      } else {
        console.error(err);
      }
      process.exit(1);
    });

  const stopAndExit = async (signal) => {
    if (shuttingDown) return;
    console.log(`\n[Console] ${signal} reçu — arrêt des services…`);
    shuttingDown = true;
    await closeLauncher();
    process.exit(0);
  };
  process.on('SIGINT', () => stopAndExit('SIGINT'));
  process.on('SIGTERM', () => stopAndExit('SIGTERM'));
}
