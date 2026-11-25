// Logique des formulaires de modification (œuvres et ayants droit)
import { parserDuree, construireCorps } from './soumission.js';

const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// 225 -> "3:45" (chaîne vide si la durée est inconnue)
export function secondesVersTexte(secondes) {
  if (!secondes) return '';
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`;
}

// Contributions renvoyées par l'API de gestion -> lignes du formulaire
export function lignesDepuisContributions(contributions) {
  return contributions.map((c, i) => ({
    cle: i + 1,
    id_role: c.id_role,
    part: String(Number(c.part_pct)),
    personne: {
      mode: 'existante',
      selection: { id_personne: c.id_personne, type: c.type_personne, libelle: c.nom_affiche },
      nouvelle: { type: 'PHYSIQUE', nom: '', prenom: '', nom_artiste: '', ville: '' },
    },
  }));
}

// Corps de PUT /api/gestion/oeuvres/:id : les champs vides sont envoyés à null (remplacement complet).
// Les contributions ne sont envoyées que si on les modifie (elles sont alors remplacées).
export function construireCorpsOeuvre(f, { avecContributions }) {
  const corps = {
    titre: f.titre.trim(),
    genre: f.genre.trim() || null,
    annee_creation: f.annee === '' || f.annee === null || f.annee === undefined ? null : Number(f.annee),
    duree_sec: parserDuree(f.duree) ?? null,
    code_iswc: f.iswc.trim() || null,
  };
  if (avecContributions) corps.contributions = construireCorps(f).contributions;
  return corps;
}

// Ayant droit renvoyé par l'API -> champs du formulaire (tout en chaînes)
export function personneVersFormulaire(p) {
  return {
    type: p.type,
    nom: p.nom ?? '',
    prenom: p.prenom ?? '',
    nom_artiste: p.nom_artiste ?? '',
    date_naissance: p.date_naissance ?? '',
    telephone: p.telephone ?? '',
    email: p.email ?? '',
    ville: p.ville ?? '',
  };
}

export function validerPersonneEdition(p) {
  const erreurs = [];
  const physique = p.type === 'PHYSIQUE';

  if (!p.nom.trim()) erreurs.push(physique ? 'Le nom est obligatoire.' : 'La raison sociale est obligatoire.');
  if (physique && !p.prenom.trim()) erreurs.push('Le prénom est obligatoire pour une personne physique.');

  const limites = [
    ['nom', p.nom, 150],
    ['prénom', p.prenom, 100],
    ['nom d’artiste', p.nom_artiste, 150],
    ['téléphone', p.telephone, 30],
    ['email', p.email, 255],
    ['ville', p.ville, 100],
  ];
  for (const [libelle, valeur, max] of limites) {
    if (valeur.trim().length > max) erreurs.push(`Le champ « ${libelle} » ne doit pas dépasser ${max} caractères.`);
  }

  if (p.email.trim() && !REGEX_EMAIL.test(p.email.trim())) erreurs.push('L’adresse email n’est pas valide.');

  if (physique && p.date_naissance) {
    const date = new Date(`${p.date_naissance}T00:00:00`);
    if (Number.isNaN(date.getTime())) erreurs.push('La date de naissance n’est pas valide.');
    else if (date > new Date()) erreurs.push('La date de naissance ne peut pas être dans le futur.');
  }
  return erreurs;
}

// Corps de PUT /api/gestion/personnes/:id (une personne morale n'a ni prénom, ni nom d'artiste, ni naissance)
export function construireCorpsPersonne(p) {
  const texte = (valeur) => (valeur.trim() === '' ? null : valeur.trim());
  const physique = p.type === 'PHYSIQUE';
  return {
    type: p.type,
    nom: p.nom.trim(),
    prenom: physique ? texte(p.prenom) : null,
    nom_artiste: physique ? texte(p.nom_artiste) : null,
    date_naissance: physique ? p.date_naissance || null : null,
    telephone: texte(p.telephone),
    email: texte(p.email),
    ville: texte(p.ville),
  };
}
