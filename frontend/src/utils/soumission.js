// Logique du formulaire de soumission : calculs, validation et construction de la requête.
// Les parts sont manipulées en centièmes de pourcent (entiers) pour éviter les erreurs d'arrondi.

const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REGEX_ISWC = /^T-\d{3}\.\d{3}\.\d{3}-\d$/;
const REGEX_DUREE = /^(\d{1,3}):([0-5]\d)$/;

// "3:45" -> 225 secondes (null si le format est invalide)
export function parserDuree(texte) {
  const m = REGEX_DUREE.exec(String(texte ?? '').trim());
  if (!m) return null;
  const secondes = Number(m[1]) * 60 + Number(m[2]);
  return secondes > 0 ? secondes : null;
}

// "33.33" -> 3333 (null si la part est invalide : vide, <= 0, > 100 ou plus de 2 décimales)
export function centimes(valeur) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  const nombre = Number(String(valeur).replace(',', '.'));
  if (!Number.isFinite(nombre) || nombre <= 0 || nombre > 100) return null;
  const entier = Math.round(nombre * 100);
  return Math.abs(nombre * 100 - entier) < 1e-6 ? entier : null;
}

export function totalCentimes(lignes) {
  return lignes.reduce((somme, ligne) => somme + (centimes(ligne.part) ?? 0), 0);
}

// Répartit 100 % entre n lignes ; les centimes restants vont aux premières lignes
export function repartirEquitablement(n) {
  const base = Math.floor(10000 / n);
  const reste = 10000 - base * n;
  return Array.from({ length: n }, (_, i) => String((base + (i < reste ? 1 : 0)) / 100));
}

// 12.5 -> "12,5"
export function formaterPourcent(nombre) {
  return Number(nombre.toFixed(2)).toString().replace('.', ',');
}

// Renvoie la liste des problèmes à corriger (tableau vide si le formulaire est valide)
export function validerSoumission(f) {
  const erreurs = [];

  const titre = f.titre.trim();
  if (!titre) erreurs.push('Le titre est obligatoire.');
  else if (titre.length > 255) erreurs.push('Le titre ne doit pas dépasser 255 caractères.');

  if (f.duree.trim() && parserDuree(f.duree) === null) {
    erreurs.push('La durée doit être au format minutes:secondes, par exemple 3:45.');
  }

  if (f.annee !== '' && f.annee !== null && f.annee !== undefined) {
    const annee = Number(f.annee);
    if (!Number.isInteger(annee) || annee < 1800 || annee > 2100) {
      erreurs.push('L’année doit être comprise entre 1800 et 2100.');
    }
  }

  if (f.iswc.trim() && !REGEX_ISWC.test(f.iswc.trim())) {
    erreurs.push('Le code ISWC doit avoir le format T-123.456.789-0.');
  }

  if (!f.email.trim()) erreurs.push('Votre adresse email est obligatoire.');
  else if (!REGEX_EMAIL.test(f.email.trim())) erreurs.push('Votre adresse email n’est pas valide.');

  if (f.lignes.length === 0) erreurs.push('Ajoutez au moins un ayant droit.');

  const dejaVus = new Set();
  let toutesPartsValides = true;

  f.lignes.forEach((ligne, i) => {
    const nom = `Ayant droit ${i + 1}`;
    const p = ligne.personne;

    if (!ligne.id_role) erreurs.push(`${nom} : choisissez un rôle.`);

    if (p.mode === 'existante') {
      if (!p.selection) {
        erreurs.push(`${nom} : sélectionnez un ayant droit ou ajoutez une nouvelle personne.`);
      } else if (ligne.id_role) {
        const cle = `${p.selection.id_personne}-${ligne.id_role}`;
        if (dejaVus.has(cle)) erreurs.push(`${nom} : cette personne a déjà ce rôle sur l’œuvre.`);
        dejaVus.add(cle);
      }
    } else {
      if (!p.nouvelle.nom.trim()) erreurs.push(`${nom} : le nom est obligatoire.`);
      if (p.nouvelle.type === 'PHYSIQUE' && !p.nouvelle.prenom.trim()) {
        erreurs.push(`${nom} : le prénom est obligatoire pour une personne physique.`);
      }
    }

    if (centimes(ligne.part) === null) {
      toutesPartsValides = false;
      erreurs.push(`${nom} : la part doit être supérieure à 0 et au plus 100 (2 décimales maximum).`);
    }
  });

  const somme = totalCentimes(f.lignes);
  if (toutesPartsValides && f.lignes.length > 0 && somme !== 10000) {
    erreurs.push(`La somme des parts doit valoir 100 % (actuellement ${formaterPourcent(somme / 100)} %).`);
  }

  return erreurs;
}

// Construit le corps de la requête POST /api/oeuvres (le formulaire doit être valide)
export function construireCorps(f) {
  const corps = {
    titre: f.titre.trim(),
    soumetteur_email: f.email.trim(),
    contributions: f.lignes.map((ligne) => {
      const base = { id_role: Number(ligne.id_role), part_pct: centimes(ligne.part) / 100 };
      const p = ligne.personne;
      if (p.mode === 'existante') return { ...base, id_personne: p.selection.id_personne };

      const n = p.nouvelle;
      const nouvellePersonne = { type: n.type, nom: n.nom.trim() };
      if (n.type === 'PHYSIQUE') {
        nouvellePersonne.prenom = n.prenom.trim();
        if (n.nom_artiste.trim()) nouvellePersonne.nom_artiste = n.nom_artiste.trim();
      }
      if (n.ville.trim()) nouvellePersonne.ville = n.ville.trim();
      return { ...base, nouvelle_personne: nouvellePersonne };
    }),
  };

  if (f.genre.trim()) corps.genre = f.genre.trim();
  if (f.annee !== '' && f.annee !== null && f.annee !== undefined) corps.annee_creation = Number(f.annee);
  const duree = parserDuree(f.duree);
  if (duree) corps.duree_sec = duree;
  if (f.iswc.trim()) corps.code_iswc = f.iswc.trim();
  return corps;
}
