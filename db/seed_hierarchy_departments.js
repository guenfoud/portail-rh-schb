import bcrypt from 'bcryptjs';
import { db } from './db.js';

async function seedCompanyHierarchy() {
  console.log('--- INSERTION DE LA HIÉRARCHIE D\'ENTREPRISE SCHB GICA ---');

  const employees = [
    // 1. DIRECTION & RH
    {
      matricule: '1002',
      nom: 'ABRITX',
      prenom: 'Amine',
      departement: 'Ressources Humaines',
      poste: 'Directeur des Ressources Humaines',
      role: 'hr',
      superieur: '',
      date_embauche: '2019-03-01',
      solde_conge: 28,
      solde_recup: 0,
      email: 'drh@gica.dz',
      tel: '031 92 10 02'
    },
    {
      matricule: '2001',
      nom: 'BENALI',
      prenom: 'Salima',
      departement: 'Ressources Humaines',
      poste: 'Chef de Service Administration & Paie',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2020-06-15',
      solde_conge: 24,
      solde_recup: 4.5,
      email: 'salima.benali@gica.dz',
      tel: '031 92 20 01'
    },
    {
      matricule: '2002',
      nom: 'KADRI',
      prenom: 'Soumia',
      departement: 'Ressources Humaines',
      poste: 'Chargée de Recrutement & Formation',
      role: 'employee',
      superieur: '2001',
      date_embauche: '2022-01-10',
      solde_conge: 21,
      solde_recup: 2,
      email: 'soumia.kadri@gica.dz',
      tel: '031 92 20 02'
    },
    {
      matricule: '2003',
      nom: 'MOKHTARI',
      prenom: 'Walid',
      departement: 'Ressources Humaines',
      poste: 'Gestionnaire du Personnel & Pointage',
      role: 'employee',
      superieur: '2001',
      date_embauche: '2023-04-01',
      solde_conge: 18,
      solde_recup: 6,
      email: 'walid.mokhtari@gica.dz',
      tel: '031 92 20 03'
    },

    // 2. DÉPARTEMENT IT & SYSTÈMES
    {
      matricule: '438',
      nom: 'BELATROUS',
      prenom: 'Lyes',
      departement: 'IT',
      poste: 'Chef de Département Informatique (IT Manager)',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2018-09-01',
      solde_conge: 26,
      solde_recup: 8,
      email: 'lyes.belatrous@gica.dz',
      tel: '031 92 04 38'
    },
    {
      matricule: '2101',
      nom: 'CHERGUI',
      prenom: 'Sofiane',
      departement: 'IT',
      poste: 'Chef de Service Réseaux & Télécoms',
      role: 'supervisor',
      superieur: '438',
      date_embauche: '2021-02-15',
      solde_conge: 22,
      solde_recup: 5,
      email: 'sofiane.chergui@gica.dz',
      tel: '031 92 21 01'
    },
    {
      matricule: '999',
      nom: 'GUENFOUD',
      prenom: 'Mohamed',
      departement: 'IT',
      poste: 'Administrateur Systèmes & BDD',
      role: 'employee',
      superieur: '438',
      date_embauche: '2022-05-10',
      solde_conge: 25,
      solde_recup: 12,
      email: 'guenfoud.mohamed@gica.dz',
      tel: '031 92 09 99'
    },
    {
      matricule: '2102',
      nom: 'BOUMEDJANE',
      prenom: 'Yassine',
      departement: 'IT',
      poste: 'Technicien Support & Infrastructure',
      role: 'employee',
      superieur: '2101',
      date_embauche: '2023-09-01',
      solde_conge: 17,
      solde_recup: 3,
      email: 'yassine.boumedjane@gica.dz',
      tel: '031 92 21 02'
    },
    {
      matricule: '2103',
      nom: 'SAIDI',
      prenom: 'Nesrine',
      departement: 'IT',
      poste: 'Développeuse Applicatifs Métier',
      role: 'employee',
      superieur: '438',
      date_embauche: '2023-11-15',
      solde_conge: 16,
      solde_recup: 0,
      email: 'nesrine.saidi@gica.dz',
      tel: '031 92 21 03'
    },

    // 3. DÉPARTEMENT PRODUCTION & EXPLOITATION
    {
      matricule: '2200',
      nom: 'HADDAD',
      prenom: 'Rachid',
      departement: 'Production',
      poste: 'Directeur / Chef de Département Production',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2015-04-12',
      solde_conge: 30,
      solde_recup: 10,
      email: 'rachid.haddad@gica.dz',
      tel: '031 92 22 00'
    },
    {
      matricule: '2201',
      nom: 'BOUZID',
      prenom: 'Karim',
      departement: 'Production',
      poste: 'Chef de Service Four & Cuisson',
      role: 'supervisor',
      superieur: '2200',
      date_embauche: '2019-01-20',
      solde_conge: 24,
      solde_recup: 14,
      email: 'karim.bouzid@gica.dz',
      tel: '031 92 22 01'
    },
    {
      matricule: '2202',
      nom: 'AMARI',
      prenom: 'Farouk',
      departement: 'Production',
      poste: 'Chef de Service Broyage & Matières',
      role: 'supervisor',
      superieur: '2200',
      date_embauche: '2020-08-01',
      solde_conge: 22,
      solde_recup: 8,
      email: 'farouk.amari@gica.dz',
      tel: '031 92 22 02'
    },
    {
      matricule: '1056',
      nom: 'BEDJAMAA',
      prenom: 'Mohamed Nadjib',
      departement: 'Production',
      poste: 'Opérateur Salle de Contrôle Four',
      role: 'employee',
      superieur: '2201',
      date_embauche: '2021-03-10',
      solde_conge: 20,
      solde_recup: 7,
      email: 'nadjib.bedjamaa@gica.dz',
      tel: '031 92 10 56'
    },
    {
      matricule: '1063',
      nom: 'FERGUATI',
      prenom: 'Hossem Eddine',
      departement: 'Production',
      poste: 'Opérateur Cuisson & Ensachage',
      role: 'employee',
      superieur: '2201',
      date_embauche: '2022-07-15',
      solde_conge: 19,
      solde_recup: 4,
      email: 'hossem.ferguati@gica.dz',
      tel: '031 92 10 63'
    },
    {
      matricule: '339',
      nom: 'MEGRAMNA',
      prenom: 'Mourad',
      departement: 'Production',
      poste: 'Conducteur Broyeur Ciment',
      role: 'employee',
      superieur: '2202',
      date_embauche: '2020-11-05',
      solde_conge: 23,
      solde_recup: 9,
      email: 'mourad.megramna@gica.dz',
      tel: '031 92 03 39'
    },
    {
      matricule: '2203',
      nom: 'ZEMMOURI',
      prenom: 'Aymen',
      departement: 'Production',
      poste: 'Rondier Cuisson & Refroidisseur',
      role: 'employee',
      superieur: '2201',
      date_embauche: '2023-02-01',
      solde_conge: 18,
      solde_recup: 6,
      email: 'aymen.zemmouri@gica.dz',
      tel: '031 92 22 03'
    },
    {
      matricule: '2204',
      nom: 'BRIK',
      prenom: 'Hamza',
      departement: 'Production',
      poste: 'Opérateur Dépotage & Matières Premières',
      role: 'employee',
      superieur: '2202',
      date_embauche: '2023-05-12',
      solde_conge: 15,
      solde_recup: 2,
      email: 'hamza.brik@gica.dz',
      tel: '031 92 22 04'
    },

    // 4. DÉPARTEMENT MAINTENANCE & ÉLECTROMÉCANIQUE
    {
      matricule: '2300',
      nom: 'TOUATI',
      prenom: 'Abdelkader',
      departement: 'Maintenance',
      poste: 'Directeur / Chef de Département Maintenance',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2016-10-01',
      solde_conge: 29,
      solde_recup: 16,
      email: 'abdelkader.touati@gica.dz',
      tel: '031 92 23 00'
    },
    {
      matricule: '2301',
      nom: 'MANSOURI',
      prenom: 'Mourad',
      departement: 'Maintenance',
      poste: 'Chef de Service Maintenance Mécanique',
      role: 'supervisor',
      superieur: '2300',
      date_embauche: '2019-04-15',
      solde_conge: 25,
      solde_recup: 10,
      email: 'mourad.mansouri@gica.dz',
      tel: '031 92 23 01'
    },
    {
      matricule: '2302',
      nom: 'KHELIFA',
      prenom: 'Tarek',
      departement: 'Maintenance',
      poste: 'Chef de Service Instrumentation & Électrique',
      role: 'supervisor',
      superieur: '2300',
      date_embauche: '2020-03-01',
      solde_conge: 23,
      solde_recup: 8,
      email: 'tarek.khelifa@gica.dz',
      tel: '031 92 23 02'
    },
    {
      matricule: '2303',
      nom: 'REZGUI',
      prenom: 'Bilal',
      departement: 'Maintenance',
      poste: 'Technicien Supérieur Mécanique Industrielle',
      role: 'employee',
      superieur: '2301',
      date_embauche: '2021-08-20',
      solde_conge: 21,
      solde_recup: 11,
      email: 'bilal.rezgui@gica.dz',
      tel: '031 92 23 03'
    },
    {
      matricule: '2304',
      nom: 'MEDJANI',
      prenom: 'Oussama',
      departement: 'Maintenance',
      poste: 'Électricien Haute Tension & Variateurs',
      role: 'employee',
      superieur: '2302',
      date_embauche: '2022-09-10',
      solde_conge: 19,
      solde_recup: 5,
      email: 'oussama.medjani@gica.dz',
      tel: '031 92 23 04'
    },
    {
      matricule: '2305',
      nom: 'LOUAFI',
      prenom: 'Samir',
      departement: 'Maintenance',
      poste: 'Soudeur Chaudronnier Qualifié',
      role: 'employee',
      superieur: '2301',
      date_embauche: '2023-01-15',
      solde_conge: 17,
      solde_recup: 7,
      email: 'samir.louafi@gica.dz',
      tel: '031 92 23 05'
    },

    // 5. DÉPARTEMENT QUALITÉ & LABORATOIRE
    {
      matricule: '2400',
      nom: 'BENDJABALLAH',
      prenom: 'Samia',
      departement: 'Qualité & Laboratoire',
      poste: 'Chef de Département Contrôle Qualité',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2017-06-01',
      solde_conge: 27,
      solde_recup: 6,
      email: 'samia.bendjaballah@gica.dz',
      tel: '031 92 24 00'
    },
    {
      matricule: '2401',
      nom: 'SLIMANI',
      prenom: 'Nabil',
      departement: 'Qualité & Laboratoire',
      poste: 'Chef de Service Analyses Chimiques',
      role: 'supervisor',
      superieur: '2400',
      date_embauche: '2020-02-10',
      solde_conge: 23,
      solde_recup: 4,
      email: 'nabil.slimani@gica.dz',
      tel: '031 92 24 01'
    },
    {
      matricule: '2402',
      nom: 'GHANEM',
      prenom: 'Meriem',
      departement: 'Qualité & Laboratoire',
      poste: 'Technicienne Chimiste & Spectrométrie',
      role: 'employee',
      superieur: '2401',
      date_embauche: '2022-04-01',
      solde_conge: 20,
      solde_recup: 3,
      email: 'meriem.ghanem@gica.dz',
      tel: '031 92 24 02'
    },
    {
      matricule: '2403',
      nom: 'DERBAL',
      prenom: 'Fouad',
      departement: 'Qualité & Laboratoire',
      poste: 'Échantillonneur Prélèvements Carrière',
      role: 'employee',
      superieur: '2401',
      date_embauche: '2023-06-20',
      solde_conge: 16,
      solde_recup: 1,
      email: 'fouad.derbal@gica.dz',
      tel: '031 92 24 03'
    },

    // 6. DÉPARTEMENT LOGISTIQUE & EXPÉDITION
    {
      matricule: '2500',
      nom: 'MEBARKI',
      prenom: 'Noureddine',
      departement: 'Logistique & Expédition',
      poste: 'Chef de Département Logistique & Expédition',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2016-02-01',
      solde_conge: 28,
      solde_recup: 12,
      email: 'noureddine.mebarki@gica.dz',
      tel: '031 92 25 00'
    },
    {
      matricule: '2501',
      nom: 'TALEB',
      prenom: 'Ryad',
      departement: 'Logistique & Expédition',
      poste: 'Chef de Service Expéditions & Pont Bascule',
      role: 'supervisor',
      superieur: '2500',
      date_embauche: '2019-11-15',
      solde_conge: 24,
      solde_recup: 8,
      email: 'ryad.taleb@gica.dz',
      tel: '031 92 25 01'
    },
    {
      matricule: '2502',
      nom: 'GASMI',
      prenom: 'Walid',
      departement: 'Logistique & Expédition',
      poste: 'Agent d\'Expédition & Facturation Ciment',
      role: 'employee',
      superieur: '2501',
      date_embauche: '2021-10-01',
      solde_conge: 19,
      solde_recup: 5,
      email: 'walid.gasmi@gica.dz',
      tel: '031 92 25 02'
    },
    {
      matricule: '2503',
      nom: 'HABIB',
      prenom: 'Mustapha',
      departement: 'Logistique & Expédition',
      poste: 'Conducteur d\'Engin & Chariot Élévateur',
      role: 'employee',
      superieur: '2501',
      date_embauche: '2022-03-10',
      solde_conge: 18,
      solde_recup: 3,
      email: 'mustapha.habib@gica.dz',
      tel: '031 92 25 03'
    },

    // 7. SÉCURITÉ INDUSTRIELLE & ENVIRONNEMENT (HSE)
    {
      matricule: '2600',
      nom: 'ZIANE',
      prenom: 'Cherif',
      departement: 'Sécurité & Environnement',
      poste: 'Chef de Département Hygiène & Sécurité (HSE)',
      role: 'supervisor',
      superieur: '1002',
      date_embauche: '2018-05-15',
      solde_conge: 26,
      solde_recup: 7,
      email: 'cherif.ziane@gica.dz',
      tel: '031 92 26 00'
    },
    {
      matricule: '2601',
      nom: 'ALLOUCHE',
      prenom: 'Reda',
      departement: 'Sécurité & Environnement',
      poste: 'Inspecteur Sécurité Industrielle & Prévention',
      role: 'employee',
      superieur: '2600',
      date_embauche: '2021-06-01',
      solde_conge: 21,
      solde_recup: 4,
      email: 'reda.allouche@gica.dz',
      tel: '031 92 26 01'
    },
    {
      matricule: '2602',
      nom: 'HAMDAOUI',
      prenom: 'Sabrina',
      departement: 'Sécurité & Environnement',
      poste: 'Ingénieure Environnement & Risques Industriels',
      role: 'employee',
      superieur: '2600',
      date_embauche: '2022-11-20',
      solde_conge: 18,
      solde_recup: 2,
      email: 'sabrina.hamdaoui@gica.dz',
      tel: '031 92 26 02'
    }
  ];

  console.log(`Préparation de ${employees.length} collaborateurs...`);

  for (const emp of employees) {
    const passwordHash = bcrypt.hashSync(emp.matricule, 10);

    const sql = `
      INSERT INTO employees (
        matricule, nom, prenom, departement, poste, role, SuperieurMatricule,
        date_embauche, solde_conge, solde_recuperation, horaire_debut, horaire_fin,
        Email, Telephone, password, actif
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '08:00', '16:00', ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        nom = VALUES(nom),
        prenom = VALUES(prenom),
        departement = VALUES(departement),
        poste = VALUES(poste),
        role = VALUES(role),
        SuperieurMatricule = VALUES(SuperieurMatricule),
        date_embauche = VALUES(date_embauche),
        solde_conge = VALUES(solde_conge),
        solde_recuperation = VALUES(solde_recuperation),
        Email = VALUES(Email),
        Telephone = VALUES(Telephone),
        password = VALUES(password),
        actif = 1
    `;

    await db.run(sql, [
      emp.matricule,
      emp.nom,
      emp.prenom,
      emp.departement,
      emp.poste,
      emp.role,
      emp.superieur || '',
      emp.date_embauche,
      emp.solde_conge,
      emp.solde_recup,
      emp.email,
      emp.tel,
      passwordHash
    ]);

    console.log(`+ Collaborateur [${emp.matricule}] ${emp.nom} ${emp.prenom} (${emp.departement} - ${emp.poste}) [Sup: #${emp.superieur || 'None'}]`);
  }

  console.log('--- INSERTION TERMINÉE AVEC SUCCÈS ! ---');
}

seedCompanyHierarchy().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
