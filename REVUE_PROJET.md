# Revue technique — Portail RH & Pointage SCHB GICA

Review date: 2026-10-29
Scope: `server.js` (3 094 lines), `db/db.js` (509), `src/` (≈10 000 lines, 13 components), `index.html`, `vite.config.js`, repo hygiene.

---

## 1. Overall impression

This is not a prototype: the functional coverage is genuinely wide (congés 2 niveaux, intérims, pointages 3x8 + heures sup, bons de sortie, HSE/habilitations, attestations, primes, borne, organigramme, FR/AR, PWA, Android WebView).

What is already done right:

- **bcrypt** for passwords + automatic migration of legacy plaintext hashes.
- **Parameterized SQL everywhere** — I found no string-concatenated user input, so no classic SQL injection.
- **Login rate limiting** (6 attempts / 10 min per matricule+IP), persistent JWT secret generated with `randomBytes(48)` and stored `0600`.
- Consistent **`escapeHtml()`** usage in the frontend (≈350 calls, e.g. `absences.js` 53, `organigramme.js` 53) — stored XSS risk is largely handled.
- Real **audit log** table, **SSE** real-time updates, PWA service worker disabled in dev, sensible role-based navigation.

The problem is not the feature set, it is the **authorization boundary**: the API trusts roles more than it trusts ownership. Several endpoints let a `supervisor` — or a plain `employee` — act outside their perimeter. Those must be fixed before this touches production data.

---

## 2. P0 — Blocking, fix before any real deployment

### 2.1 SMTP credential committed in source (and in git history)

`server.js:76-88` — the transporter falls back to a hard-coded host, account and **password**:

```js
host: process.env.SMTP_HOST || 'mail.dz-com.com',
auth: { user: process.env.SMTP_USER || 'it@dz-com.com', pass: process.env.SMTP_PASS || '…' }
```

Actions:
1. **Rotate the mailbox password now** (it is in the history of every clone/archive, `rh2.7z`, `RH_secured_and_animated.zip`, …).
2. Remove the fallbacks: fail fast at boot if `SMTP_*` is missing.
3. Move the mailbox to a dedicated service account (`no-reply@…`) so a leaked password does not expose a real person's inbox.
4. Optionally purge history (`git filter-repo`) — rotating is what actually matters.

### 2.2 Every employee's initial password is their matricule

`db/db.js` seed + `server.js:867` — `const pwdPlain = password || matricule`. The 5 demo accounts are `1001/1001`, `1002/1002` (HR!), `1003/1003`…

On an intranet where matricules are printed on badges, this is equivalent to no password. Actions:
- Force a password change at first login (`must_change_password` flag + blocking screen).
- Generate a random temporary password and hand it over out-of-band.
- Delete/disable the demo seed in production (`SEED_DEMO=false`).

### 2.3 Privilege escalation: a supervisor can create an `hr` account

`server.js:816` — POST `/api/employees` is open to `requireRole('hr','supervisor')` and accepts `role` with `['employee','supervisor','hr']`, plus `solde_conge`. A supervisor can:
- create a new employee with `role: 'hr'` and a password they choose, then log in as HR;
- promote themselves / rewrite anyone's balance and working hours;
- edit employees of **any** department (no perimeter check at all).

Actions: employee CRUD, role assignment, balances and `SuperieurMatricule` should be **HR-only**; supervisors get read-only on their own department (or a narrow "update contact info" endpoint). Never accept `role` from a supervisor. Add "cannot change your own role" and "cannot grant a role higher than yours".

### 2.4 A supervisor can finalize a leave and debit the balance, bypassing the DRH

`server.js:1416` — POST `/api/absences` with an `id` is the "final DRH decision" branch, but the guard is:

```js
if (req.user.role !== 'hr' && req.user.role !== 'supervisor') return 403
```

So step 2 (`supervisor-decision`) is advisory only in the UI, while the same supervisor can pass `statut: 'Approuvé'` and debit `solde_conge` directly. The advertised 2-level circuit is therefore not enforced server-side.

Action: split into two explicit endpoints (`/supervisor-decision`, `/hr-decision`) with `requireRole('hr')` on the final one, and validate the state machine: `En attente → (avis superviseur) → En attente DRH → Approuvé|Refusé`. Reject any transition that skips a step.

### 2.5 Any supervisor can decide on any employee's leave

`server.js:1709` (helper at `:1729`) — the comment says "soit le supérieur titulaire, soit l'intérimaire actif", the code says:

```js
const isAuthorized = (req.user.role === 'hr' || req.user.role === 'supervisor' || !!isInterim);
```

A supervisor from Maintenance can approve/refuse an Administration request. Same pattern in `GET /api/recuperations` (supervisors see the whole company) and in `GET /api/absences/:id/justificatif`, where a `supervisor` can open **anyone's medical certificate** (only `employee` is blocked).

Action: one shared helper, e.g. `canDecideFor(user, absence)` = `hr` || `absence.SuperieurMatricule === user.matricule` || active interim of that titular. Use it for decisions, justificatifs and the recuperation lists, and test it.

### 2.6 An employee can rewrite anyone's pointages

`server.js:1121` and `:1175` — POST and DELETE `/api/pointages` include `'employee'` and `'admin'` in `requireRole`, and the body is not checked against `req.user.matricule`. Anyone logged in can backdate, insert or delete a colleague's hours (and therefore their overtime/primes). `'admin'` is not even a valid ENUM role.

Action: employees may only `POST` their own, today's punch — and that is already what `/api/terminal/punch` is for. Make `/api/pointages` `hr|supervisor` and add a perimeter check (`departement`). Log every manual edit with before/after values.

### 2.7 Magic links approve leave via a GET, with no confirmation

`server.js:1959` — `GET /api/absences/quick-decision?token=…` mutates data. Consequences:
- Corporate mail security (Outlook Safe Links, Proofpoint) **prefetches URLs**: a manager's leave request can be approved by a scanner before the manager opens the mail.
- The 14-day JWT sits in browser history, proxy logs and `Referer` headers.
- Nothing proves the clicker is the intended decider, and the DRH token is always signed for matricule `1002` (`server.js:1754`, `2034`), even if another HR user handles it.
- No revocation, no single use, no IP/user-agent recorded.

Action (keep the 1-click UX): the link opens a **read-only confirmation page** with the request details and two buttons (`POST /api/absences/quick-decision` with the token in the body). Add a `jti` + `used_at` column so a token is single-use, shorten to 72 h, and write the clicker's IP/UA to `audit_log`. Sign the token with the actual acting HR matricule.

### 2.8 The biometric sync is a simulation

`server.js:2443-2471`, `simulateZktecoPunch()` — marked `MODE DÉMO` in the code, but the Settings UI presents it as a working integration. Either implement the ZKTeco **push/ADMS** protocol (or a `node-zklib` poller with a device service account) or remove the screen, so nobody builds a payroll process on fake data.

---

## 3. P1 — Important, within the next iteration

| # | Finding | Where | Fix |
|---|---|---|---|
| 3.1 | `app.use(cors())` = any origin can call the API; combined with a token in `sessionStorage`, one XSS = full exfiltration. | `server.js:18` | Allowlist `http://localhost:8082`, `http://<server>`, the Android WebView origin. Reject everything else. |
| 3.2 | JWT (12 h) in `sessionStorage`, no revocation, role changes not reflected until expiry. | `src/api.js`, `server.js:757` | Short access token (15 min) + refresh, or a `token_version` column checked in `authenticate`. Add `sameSite`/`secure` cookie option if you drop the SPA token. |
| 3.3 | `email_sent` is set to `1` **before** the SMTP attempt; failures only `console.error`. The UI claims "email sent" when it never left. | `server.js:140-175` | Email outbox table (`pending/sent/failed`, attempts, last_error, next_retry) + retry worker. Show real delivery status. |
| 3.4 | Every notification is BCC-style copied to `it@dz-com.com` — including medical certificates mentions. | `server.js:127` | Drop the default CC; make it opt-in and excluded for `type_conge='Maladie'`. |
| 3.5 | Missing email addresses are **guessed** as `prenom.nom@gica.dz` in ~8 places. | `server.js:1480, 1753, 2033…` | Never send to a guessed address; skip and flag "email manquant" in the employee record. |
| 3.6 | Internal SQL errors returned to the client (`err.message` in ~60 handlers). | everywhere | Generic message + server-side log with a correlation id. |
| 3.7 | Files stored as base64 in `LONGTEXT` (justificatifs 6 MB, photos 2 MB, documents), served back through JSON. | `db/db.js`, `/api/absences/:id/justificatif` | Store on disk (or S3-compatible/MinIO) with a hashed name + `mime`, keep only metadata in MySQL, serve with an authenticated streaming route. Today a full dump is enormous and `max_allowed_packet` is a latent bug. |
| 3.8 | Manual pointage edits, settings changes and document uploads are not always audited, and the audit log has no UI. | `logAudit` calls | Log every mutation centrally (middleware: actor, route, target, before/after). Add an "Journal" tab with filters + CSV export (the API already exists: `/api/audit-log`). |
| 3.9 | CDN scripts unpinned (`lucide@latest`, `chart.js` without version), no SRI, no CSP. | `index.html` | Pin versions + `integrity` hashes, or vendor them through Vite. Add a CSP meta/header (`default-src 'self'; img-src 'self' data:;`). |
| 3.10 | No HTTPS/HSTS, no `helmet`, no `trust proxy`; `vite --host` + `allowedHosts: true` exposes the dev server on the LAN. | `vite.config.js`, `server.js` | `helmet`, HSTS behind a reverse proxy, `allowedHosts` restricted, and never run `npm run dev` as the production server (use `npm run build` + static serving / nginx). |
| 3.11 | Rate limiting only on `/api/login`. Magic links, `/api/terminal/punch` (matricule only = anyone can punch for a colleague) and `/api/settings/smtp/test` are unthrottled. | `server.js` | Generic limiter + a PIN or badge code for the borne. |
| 3.12 | `multipleStatements: true` on the pool for no visible reason. | `db/db.js:70` | Remove it — it turns any future injection into a multi-statement one. |
| 3.13 | `GET /api/employees` and `/api/hierarchy` expose every colleague's email and, for employees, the whole department's data. | `server.js:778, 897` | Return only what the view needs; emails HR/supervisor only. |

---

## 4. P2 — Maintainability & performance

- **No test, no linter, no CI.** The payroll-critical logic is `calculatePointageStats()` (`server.js:402` onward: night premium, 50/75/100 %, Friday/holiday double, rotation cycles). This function decides money and deserves unit tests with a fixed table of cases (normal day, night shift crossing midnight, Friday > 8 h, Saturday, 4 h threshold, 60 min overtime threshold). Add `npm test` with `node --test` and a `npm run lint` (ESLint) — cheap, high value.
- **No `npm start`.** Production instructions are two terminals and `run_all.bat`. Add a single start script, a `Dockerfile` + `docker-compose.yml` (app + MySQL + volume for uploads), and a documented backup/restore procedure.
- **Schema lives in code.** `initDB()` + ad-hoc `ensureColumn()` + a SQLite→MySQL importer. Introduce real migrations (a `migrations/` folder with numbered SQL applied at boot, or `dbmate`/`knex`) so you can reproduce and roll back a schema.
- **Monolith.** 3 094-line `server.js`, 2 088-line `pointage.js`. Split the server into `routes/{auth,employees,absences,pointages,settings,…}.js` + `services/` (mailer, pointage-calc, audit). Splitting the calc into its own module is also the prerequisite for testing it.
- **The SQLite→MySQL adapter** (`adaptSql`) does regex rewriting of SQL, including reserved `key`/`value` handling. It works today but is fragile: every new query can silently break. With real migrations, use MySQL syntax directly.
- **No pagination.** `GET /api/pointages` returns the whole table; `SELECT *` everywhere. Add `?from=&to=&page=&limit=` and indexes: `pointages(date)`, `pointages(matricule,date)`, `absences(matricule,date_debut)`, `notifications(created_at)`.
- **Repo hygiene.** Tracked sample data (`304.xls`, `pointage_test.xlsx`) may contain real payroll data — verify and remove. Untracked local artefacts (`rh.db`, `rh2.7z`, `rh2.rar`, `RH_secured_and_animated.zip`, `doc_full.mht`, `extracted_docx/`, `scratch_*.{cjs,ps1}`, `doc_converted.docx`, `doc_extracted.html`) should be deleted or gitignored. `db/database.sqlite` and `db/.jwt_secret` exist locally — confirm they never get committed and are excluded from the deployment archive.
- **i18n**: FR/AR strings live in one `i18n.js` with DOM post-translation; check RTL layout on the Arabic path (needs `dir="rtl"` and mirrored paddings). Also the backend emails are FR-only.
- **Accessibility**: check contrast and keyboard/focus on the modal system; the global modal has no focus trap or `aria-modal`.

---

## 5. Propositions — what I would add next

Ranked by value/effort for a company of this type.

### Quick wins (≤ 2 days each)

1. **Self-service password change + "mot de passe oublié".** There is no self-service route today: an employee who forgets their password must ask HR. Add `POST /api/me/password` (old + new, bcrypt, `must_change_password=false`) and a reset by email token (15 min, single use).
2. **"Mon profil" page.** Photo, phone, email, IBAN-free, plus read-only contract data and balances. Employees currently cannot correct their own email — which is exactly why emails are guessed in the backend.
3. **Audit journal screen** for HR (API already returns the log): filters by actor/action/date + Excel export.
4. **Leave balance statement** per employee (`solde_conge`, accrual history, taken, planned) with a PDF "état de solde" — kills 80 % of "combien me reste-t-il ?" questions.
5. **Request cancellation** by the employee (only while `En attente`), with automatic notification to the current decider.

### Medium (≈ 1 week each)

6. **Manager inbox.** A single "À valider" queue (congés + récupérations + bons de sortie) with age/SLA badge, bulk approval and a daily digest email instead of one email per request. Today the decider gets a notification per event; volume will grow.
7. **Payroll export.** A monthly file (CSV/XLSX or XML) per employee: days worked, absences, overtime broken down by rate (50/75/100/night), primes (`primes-summary` already exists). This is the missing link between pointage and paie, and probably the biggest operational win.
8. **Absence/leave policy engine.** You already hard-code thresholds in `department-quota` (`production` 60 %, `maintenance` 50 %). Move them into `settings` so HR can tune quotas, carry-over rules, accrual rate (2.5 d/month?) and the maternity/sick durations without a deploy.
9. **Real biometric integration** (ZKTeco push/ADMS) with an idempotent ingestion table (`device_serial, user_id, punched_at, hash`) so duplicate pulls are harmless, plus a reconciliation screen "pointeuse vs saisie".
10. **Backups & monitoring.** Nightly `mysqldump` + uploads archive with retention, a `/health` endpoint (DB + SMTP) and a simple uptime alert. Right now a corrupted MySQL = the portal is gone, and there is no visible alerting anywhere.

### Larger / strategic

11. **Offboarding/onboarding workflow.** Checklist per hire/exit: contract, badge, habilitation, medical visit, account disabling. Ties into `habilitations` (expiry alerts already exist) and `actif=0` logic.
12. **Mobile app hardening.** The Android WebView client should pin the server certificate / require HTTPS, and stop working if the device is rooted (optional), because it holds a 12 h token.
13. **Data-protection compliance (Algeria, Law 18-07).** You process health data (certificats médicaux), family data, salaries. Concretely: ANPDP declaration, a retention policy, a privacy notice on login, access restriction on medical documents (currently a supervisor can read any certificate), and an "export/delete my data" procedure. This is also the strongest argument to fix 2.5 and 3.7.
14. **Decision on the token/authorization model.** The cleanest long-term shape: httpOnly `SameSite=Strict` cookie session + CSRF token, roles loaded from the DB on each request (not from the token) so a revoked/demoted account loses access immediately. It removes the magic-link/URL-token family of problems too.

---

## 6. Suggested order of work

| Sprint | Content |
|---|---|
| **S0 — this week** | Rotate SMTP password · remove secrets from code · HR-only on employee CRUD/roles · split leave decision endpoints + state machine · perimeter checks on decisions/justificatifs · employees can no longer write others' pointages · CORS allowlist |
| **S1** | Magic links → confirmation page + single-use + audit · self-service password change · email outbox with real status · stop guessing addresses · error messages sanitized |
| **S2** | Pointage unit tests + `npm test`/lint · `npm start` + Docker + backup script · pagination + indexes · move files out of MySQL |
| **S3** | Manager inbox · payroll export · audit UI · leave balance statement |
| **S4** | ZKTeco real sync (or remove) · policy engine in settings · ANPDP/privacy package · monitoring |

---

### One-paragraph summary

The product is rich and mostly well built on the frontend; the gap is the **server-side authorization model**, which is currently role-based instead of ownership-based, and **secret hygiene**. Fix the seven P0 items (especially: rotate the SMTP password, HR-only employee/role management, enforce the real 2-level workflow, stop leaving decisions to any supervisor, stop letting employees write pointages, make magic links confirm on POST) before putting real employee data behind it. Then the two features that will actually change daily life are the **payroll export** and the **manager inbox**, and the cheapest credibility win is a **test suite around the overtime calculation**.
