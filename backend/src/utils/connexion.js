// Prépare les options de connexion à PostgreSQL à partir de DATABASE_URL.
//
// node-postgres lit le paramètre sslmode de l'adresse : avec « require », il vérifie le certificat du
// serveur, et ce paramètre remplace l'option `ssl` passée dans le code. Avec un hébergeur dont le
// certificat est signé par une autorité privée (par exemple Aiven), la connexion échoue.
// On retire donc sslmode de l'adresse et on construit l'option `ssl` explicitement :
//   - certificat CA fourni      -> chiffrement + vérification complète du certificat ;
//   - sslmode présent, sans CA  -> chiffrement sans vérification (comme psql avec sslmode=require) ;
//   - aucun sslmode, pas de CA  -> adresse inchangée (développement local).
export function optionsConnexion(adresse, { ca } = {}) {
  let url;
  try {
    url = new URL(adresse);
  } catch {
    return { connectionString: adresse };
  }

  const mode = url.searchParams.get('sslmode');
  if (mode === null && !ca) return { connectionString: adresse };

  url.searchParams.delete('sslmode');

  let ssl;
  if (mode === 'disable') ssl = undefined;
  else if (ca) ssl = { ca, rejectUnauthorized: true };
  else ssl = { rejectUnauthorized: false };

  return { connectionString: url.toString(), ssl };
}
