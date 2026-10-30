# Portail RH & Pointage — SCHB GICA 🏭

Système intégré de gestion des Ressources Humaines et de Suivi des Pointages pour la **Société des Ciments de Hachaïchi Béjaïa (SCHB)**, filiale du **Groupe Industriel des Ciments d'Algérie (GICA)**.

---

## 🚀 Fonctionnalités Clés

### 1. 🏖️ Circuit de Congés & Récupérations à 2 Niveaux
- **Workflow hiérarchique structuré** :
  - **Étape 1** : Avis du Responsable Hiérarchique (ou Intérimaire délégué).
  - **Étape 2** : Décision Finale et Débit de Solde par la Direction des Ressources Humaines (DRH).
- **⚡ Validation Rapide par Email en 1 Clic** : Liens et boutons d'action sécurisés `[✓ ACCEPTER]` et `[✗ REFUSER]` chiffrés par jeton JWT (valable 14 jours) permettant aux managers et à la DRH de statuer directement depuis leur messagerie sur smartphone.
- **⚠️ Alerte de Chevauchement d'Équipe** : Détection en temps réel des absences simultanées au sein du même département pour prévenir le risque de sous-effectif.
- **📎 Pièces Jointes & Justificatifs Médicaux** : Prise de photo ou upload de certificats médicaux / convocations (jusqu'à 4.5 Mo) avec prévisualisation et visionneuse intégrée.
- **📄 Titre de Congé Officiel en PDF** : Génération et téléchargement au format A4 avec en-tête officiel SCHB GICA, mentions légales et les 3 visas/signatures (Salarié, Manager, DRH).

### 2. 📱 Interface Mobile Tactile & Responsive
- **Bottom Navigation** : Barre de navigation tactile en bas d'écran adaptée aux collaborateurs sur smartphone avec synchronisation SPA.
- **Responsive Card View** : Transformation automatique des tableaux de données en cartes individuelles lisibles sur mobile.
- **Application Android** : Client mobile WebView natif (inclus dans le dossier `android-app/`).

### 3. 👥 Organigramme Hiérarchique & Délégation d'Intérims
- **Visualisation de l'Organigramme** : Découpage par Direction et Département avec filtrage de visibilité selon les habilitations.
- **Système d'Intérim Avancé** : Lorsqu'un manager est absent ou en congé, délégation temporaire de ses pouvoirs de validation avec notification automatique par email de l'intérimaire et de la DRH.

### 4. ⏱️ Gestion des Pointages & Heures Supplémentaires
- Suivi des heures d'entrée/sortie, retards, pointages manquants et solde d'heures de récupération.
- Importation des pointages depuis fichiers Excel / biométriques.

---

## 🛠️ Stack Technique

- **Frontend** : HTML5, Vanilla JavaScript moderne, CSS3 Glassmorphic / Dark mode, Icônes Lucide.
- **Build Tool** : Vite.
- **Backend API** : Node.js, Express.
- **Base de Données** : MySQL (BDD `gica`).
- **Messagerie** : Nodemailer (Serveur SMTP avec certificats sécurisés).
- **Mobile** : Android Kotlin / WebView.

---

## 📦 Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- [MySQL Server](https://dev.mysql.com/downloads/) (v8.0+)

### 1. Cloner le dépôt
```bash
git clone https://github.com/VOTRE_COMPTE/portail-rh-schb-gica.git
cd portail-rh-schb-gica
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
Copiez le fichier `.env.example` en `.env` et adaptez vos paramètres :
```bash
cp .env.example .env
```
Renseignez les accès MySQL et les identifiants SMTP.

> **SMTP obligatoire :** aucun identifiant de messagerie n'est codé dans le code. Si
> `SMTP_HOST`, `SMTP_USER` ou `SMTP_PASS` manquent, le serveur démarre mais l'envoi d'emails
> est désactivé (avertissement au démarrage). Pour un serveur interne à certificat
> auto-signé, ajoutez `SMTP_TLS_INSECURE=true`.
>
> **Installation réelle :** laissez `SEED_DEMO=false` pour ne pas créer les comptes de
> démonstration (`1001/1001`, `1002/1002`, …) sur une base vide.

### 4. Démarrer l'application

**Le plus simple : double-cliquez sur `lancer.bat`.** La console de lancement s'ouvre,
démarre le serveur API et le frontend, et affiche leur état en temps réel.

En ligne de commande, l'équivalent reste possible :
```bash
# Lancer le serveur backend (Port 8081)
node server.js

# Dans un autre terminal, lancer l'application frontend (Port 8082)
npm run dev
```

---

## 🖥️ Console de lancement (application de bureau)

Une interface graphique remplace l'ancien `run_all.bat` (deux fenêtres noires).

| Commande | Effet |
|---|---|
| `lancer.bat` | Ouvre la console : exécutable s'il est construit, sinon Electron, sinon navigateur |
| `npm run exe` | Construit l'exécutable autonome `release/Console-GICA-RH-<version>.exe` |
| `npm run app` | Ouvre la console en mode développement (Electron) |
| `npm run console` | Console dans le navigateur sur http://localhost:8090 |

**Fonctions de la console**
- Démarrage / arrêt / redémarrage du serveur API (8081) et du frontend (8082), individuellement ou globalement.
- État live : pastille d'état, PID, port, disponibilité réelle (attente du message de démarrage ou de la réponse HTTP) et uptime.
- Journaux en temps réel par service (SSE), coloration des erreurs et avertissements, copie du journal.
- Détection des instances déjà lancées hors console, avec possibilité de les arrêter pour libérer le port.
- Contrôles préalables : Node/npm, `node_modules`, `.env` et variables manquantes, SMTP, `SEED_DEMO`, disponibilité des ports.
- Test de connexion MySQL (version du serveur, nombre d'employés et de pointages).
- Opérations : `npm install`, build de production (`dist/`), ouverture de l'application dans le navigateur.

**Utilisation de l'exécutable**
1. `npm run exe` génère `release/Console-GICA-RH-<version>.exe` (aucune installation requise).
   Une copie prête à l'emploi se trouve à la racine du projet : `Console-GICA-RH.exe`.
   L'interface est en thème clair, comme le portail.
2. Placez l'exécutable **dans le dossier du projet** (à côté de `server.js`) : il le détecte automatiquement.
   S'il est ailleurs, il demande le dossier au premier lancement et le mémorise.
3. À la fermeture de la fenêtre, les services démarrés par la console sont arrêtés.

> Variables utiles : `GICA_PROJECT_DIR` (forcer le dossier du projet),
> `GICA_NO_AUTOSTART=1` (ouvrir sans démarrer les services), `LAUNCHER_PORT` (port de la console).
>
> Le projet doit rester installé (Node.js + `node_modules` + `.env`) : l'exécutable est un
> tableau de bord, il pilote votre projet et n'embarque pas la base de données.

---

## 🔐 Règles de sécurité appliquées

- **Création / modification / désactivation d'un compte, attribution des rôles et soldes :** réservées à la DRH.
- **Circuit de congé à 2 niveaux :** l'avis du responsable est consultatif ; seule la DRH peut clôturer une demande et débiter le solde. Un responsable ne peut statuer que sur son équipe directe, son département ou l'équipe dont il assure l'intérim.
- **Justificatifs médicaux :** accessibles uniquement au collaborateur, à la DRH, à son responsable direct et à l'intérimaire actif de ce responsable.
- **Pointages :** un collaborateur ne peut pas modifier les heures d'un collègue (il pointe via la borne). Un responsable est limité à son département.
- **Liens de validation par email :** le lien ouvre une page de confirmation (le simple chargement du lien n'enregistre rien), le jeton est à usage unique et valable 72 h. Les liens émis avant cette version ne sont plus valides.
- **Mots de passe :** minimum 8 caractères, jamais égaux au matricule ; un compte créé ou réinitialisé par la DRH doit changer son mot de passe à la première connexion.

---

## 📄 Licence & Droits
Tous droits réservés © Société des Ciments de Hachaïchi Béjaïa (SCHB) — Groupe GICA.
