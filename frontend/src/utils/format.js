export function formaterDuree(secondes) {
  if (!secondes) return 'Durée inconnue';
  const minutes = Math.floor(secondes / 60);
  const reste = String(secondes % 60).padStart(2, '0');
  return `${minutes}:${reste}`;
}

// Montant en Ariary, lisible : 1500000 -> « 1 500 000 Ar »
export function formaterAriary(montant) {
  const nombre = Number(montant);
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(nombre)} Ar`;
}

// '2026-11-20' -> « 20 nov. 2026 » (sans décalage de fuseau horaire)
export function formaterDate(iso) {
  if (!iso) return '—';
  const [annee, mois, jour] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(annee, mois - 1, jour).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Nom à afficher pour une personne : nom d'artiste, sinon « Prénom Nom »
export function nomPersonne(p) {
  return p.nom_artiste || [p.prenom, p.nom].filter(Boolean).join(' ');
}

export function libelleType(type) {
  return type === 'MORALE' ? 'Personne morale' : 'Personne physique';
}

export const TYPES_DIFFUSEUR = [
  { valeur: 'RADIO', libelle: 'Radio' },
  { valeur: 'TV', libelle: 'Télévision' },
  { valeur: 'SALLE', libelle: 'Salle de spectacle' },
  { valeur: 'EVENEMENT', libelle: 'Événement' },
];

export function libelleTypeDiffuseur(type) {
  return TYPES_DIFFUSEUR.find((t) => t.valeur === type)?.libelle ?? type;
}
