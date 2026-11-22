import { HttpError } from '../middleware/errors.js';

const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REGEX_ISWC = /^T-\d{3}\.\d{3}\.\d{3}-\d$/;

const estVide = (valeur) =>
  valeur === undefined || valeur === null || (typeof valeur === 'string' && valeur.trim() === '');

// Accumule les erreurs de validation, puis les renvoie toutes d'un coup (HTTP 400)
export class Validateur {
  constructor() {
    this.erreurs = [];
  }

  erreur(champ, message) {
    this.erreurs.push({ champ, message });
  }

  lever() {
    if (this.erreurs.length > 0) {
      throw new HttpError(400, 'Données invalides', this.erreurs);
    }
  }

  texte(valeur, champ, { requis = false, max = 255 } = {}) {
    if (estVide(valeur)) {
      if (requis) this.erreur(champ, 'obligatoire');
      return null;
    }
    if (typeof valeur !== 'string') {
      this.erreur(champ, 'doit être un texte');
      return null;
    }
    const texte = valeur.trim();
    if (texte.length > max) {
      this.erreur(champ, `${max} caractères maximum`);
      return null;
    }
    return texte;
  }

  entier(valeur, champ, { requis = false, min = -Infinity, max = Infinity } = {}) {
    if (estVide(valeur)) {
      if (requis) this.erreur(champ, 'obligatoire');
      return null;
    }
    const nombre = typeof valeur === 'string' ? Number(valeur) : valeur;
    if (!Number.isInteger(nombre) || nombre < min || nombre > max) {
      this.erreur(champ, 'entier invalide');
      return null;
    }
    return nombre;
  }

  // Pourcentage strictement positif, au plus 100, avec 2 décimales maximum
  pourcentage(valeur, champ) {
    const nombre = typeof valeur === 'string' ? Number(valeur) : valeur;
    if (
      typeof nombre !== 'number' ||
      !Number.isFinite(nombre) ||
      nombre <= 0 ||
      nombre > 100 ||
      Math.abs(nombre * 100 - Math.round(nombre * 100)) > 1e-6
    ) {
      this.erreur(champ, 'nombre supérieur à 0 et inférieur ou égal à 100 (2 décimales maximum)');
      return null;
    }
    return nombre;
  }

  email(valeur, champ, { requis = false } = {}) {
    const email = this.texte(valeur, champ, { requis, max: 255 });
    if (email !== null && !REGEX_EMAIL.test(email)) {
      this.erreur(champ, 'adresse email invalide');
      return null;
    }
    return email;
  }

  iswc(valeur, champ) {
    const code = this.texte(valeur, champ, { max: 15 });
    if (code !== null && !REGEX_ISWC.test(code)) {
      this.erreur(champ, 'format attendu : T-123.456.789-0');
      return null;
    }
    return code;
  }

  date(valeur, champ, { requis = false } = {}) {
    const texte = this.texte(valeur, champ, { requis, max: 10 });
    if (texte === null) return null;
    const valide =
      /^\d{4}-\d{2}-\d{2}$/.test(texte) &&
      !Number.isNaN(Date.parse(texte)) &&
      new Date(texte).toISOString().slice(0, 10) === texte;
    if (!valide) {
      this.erreur(champ, 'date attendue au format AAAA-MM-JJ');
      return null;
    }
    return texte;
  }

  enumeration(valeur, champ, valeurs, { requis = false } = {}) {
    if (estVide(valeur)) {
      if (requis) this.erreur(champ, 'obligatoire');
      return null;
    }
    if (!valeurs.includes(valeur)) {
      this.erreur(champ, `valeur attendue : ${valeurs.join(', ')}`);
      return null;
    }
    return valeur;
  }
}

// Valide les champs d'une personne (utilisé pour créer un ayant droit)
export function validerNouvellePersonne(v, p, prefixe) {
  const champ = (nom) => `${prefixe}.${nom}`;
  const type = v.enumeration(p.type, champ('type'), ['PHYSIQUE', 'MORALE'], { requis: true });
  const donnees = {
    type,
    nom: v.texte(p.nom, champ('nom'), { requis: true, max: 150 }),
    prenom: v.texte(p.prenom, champ('prenom'), { requis: type === 'PHYSIQUE', max: 100 }),
    nom_artiste: v.texte(p.nom_artiste, champ('nom_artiste'), { max: 150 }),
    date_naissance: v.date(p.date_naissance, champ('date_naissance')),
    telephone: v.texte(p.telephone, champ('telephone'), { max: 30 }),
    email: v.email(p.email, champ('email')),
    ville: v.texte(p.ville, champ('ville'), { max: 100 }),
  };
  if (type === 'MORALE') {
    if (donnees.prenom) v.erreur(champ('prenom'), 'interdit pour une personne morale');
    if (donnees.date_naissance) v.erreur(champ('date_naissance'), 'interdit pour une personne morale');
  }
  return donnees;
}

// Identifiant dans l'URL : un entier positif, sinon 404
export function idDepuisParams(valeur) {
  const id = Number(valeur);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(404, 'Ressource introuvable');
  }
  return id;
}

export function pagination(requete) {
  const page = Math.max(1, parseInt(requete.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(requete.limit, 10) || 20));
  return { page, limit };
}

// Transforme un texte de recherche en motif ILIKE sûr (échappe % et _)
export const motifLike = (texte) => `%${texte.replace(/[\\%_]/g, '\\$&')}%`;
