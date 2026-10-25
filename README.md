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

### 4. Démarrer le serveur API et le frontend
```bash
# Lancer le serveur backend (Port 8081)
node server.js

# Dans un autre terminal, lancer l'application frontend (Port 8082)
npm run dev
```

---

## 📄 Licence & Droits
Tous droits réservés © Société des Ciments de Hachaïchi Béjaïa (SCHB) — Groupe GICA.
