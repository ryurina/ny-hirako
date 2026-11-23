export function formaterDuree(secondes) {
  if (!secondes) return 'Durée inconnue';
  const minutes = Math.floor(secondes / 60);
  const reste = String(secondes % 60).padStart(2, '0');
  return `${minutes}:${reste}`;
}

// Montant en Ariary, lisible : 1500000 -> « 1 500 000 Ar »
export function formaterAriary(montant) {
  const nombre = Number(montant);
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(nombre)} Ar`;
}
