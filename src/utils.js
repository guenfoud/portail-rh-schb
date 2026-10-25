// Petits utilitaires partagés par tous les composants.

// Échappe le texte fourni par un utilisateur avant de l'insérer dans du innerHTML,
// afin d'empêcher toute injection HTML/JS (XSS stocké) via des champs libres comme
// "motif", "notes", "nom", "prenom", etc.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Formate une date en format français "DD/MM/YYYY" de façon propre et robuste.
export function formatDateFR(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }
  let str = String(dateStr).trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  str = str.replace(/^[^\d]+/, '');
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  const matchFR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchFR) {
    const [, d, m, y] = matchFR;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return str;
}

// Redimensionne une image sélectionnée par l'utilisateur (fichier <input type="file">) vers
// une Data URL JPEG compacte, avant envoi au serveur (les photos sont stockées en base64
// dans la base — les garder petites évite d'alourdir les réponses de l'API).
export function resizeImageToDataUrl(file, maxSize = 320, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Fichier image invalide."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Lit un fichier quelconque (document, PDF...) en Data URL brute, sans redimensionnement.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Exporte un tableau d'objets vers un fichier Excel (.xlsx) téléchargé côté client,
// via la bibliothèque SheetJS (window.XLSX) déjà chargée globalement dans index.html.
// `rows` : tableau d'objets simples (les clés deviennent les en-têtes de colonnes).
export function exportToExcel(filename, rows, sheetName = 'Feuille1') {
  if (!window.XLSX) {
    console.error('SheetJS (XLSX) non chargé.');
    return;
  }
  if (!rows || rows.length === 0) {
    rows = [{ 'Aucune donnée': '' }];
  }
  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  window.XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// Formate un timestamp en temps relatif convivial (ex: "À l'instant", "Il y a 5 min", "Hier")
export function formatTimeAgo(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return formatDateFR(d);
}
