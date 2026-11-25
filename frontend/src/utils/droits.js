// Calculs liés aux droits. Les montants sont manipulés en centimes d'Ariary (entiers).
// La règle est la même que celle de la fonction SQL calculer_repartition :
//   montant = ROUND(montant_total x part_pct / 100, 2)

// "200000" ou "150000.50" -> centimes (null si invalide : négatif, trop grand, plus de 2 décimales)
export function centimesMontant(valeur) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  const nombre = Number(String(valeur).replace(',', '.'));
  if (!Number.isFinite(nombre) || nombre < 0 || nombre > 9999999999.99) return null;
  const entier = Math.round(nombre * 100);
  return Math.abs(nombre * 100 - entier) < 1e-3 ? entier : null;
}

// Répartit un montant (en centimes) entre des contributions {part_pct}.
// Renvoie les contributions enrichies de `montantCentimes`. BigInt évite tout dépassement.
export function calculerRepartition(montantCentimes, contributions) {
  return contributions.map((c) => {
    const partCentiemes = BigInt(Math.round(Number(c.part_pct) * 100));
    // arrondi « moitié vers le haut » : floor((2·m·p + d) / (2·d)) avec d = 10000
    const montant = (BigInt(montantCentimes) * partCentiemes * 2n + 10000n) / 20000n;
    return { ...c, montantCentimes: Number(montant) };
  });
}

// 8000000 -> « 80 000 Ar » ; 3333333 -> « 33 333,33 Ar »
export function formaterCentimes(centimes) {
  const entier = centimes % 100 === 0;
  const nombre = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: entier ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centimes / 100);
  return `${nombre} Ar`;
}
