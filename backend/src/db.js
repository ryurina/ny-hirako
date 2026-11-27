import pg from 'pg';
import { config } from './config.js';
import { optionsConnexion } from './utils/connexion.js';

// Les dates SQL (DATE) sont renvoyées telles quelles ('2026-07-12') :
// pas de conversion en objet Date, donc pas de décalage de fuseau horaire.
pg.types.setTypeParser(1082, (valeur) => valeur);

// Les NUMERIC (montants, parts) restent des chaînes : pas de perte de précision.
export const pool = new pg.Pool({
  ...optionsConnexion(config.databaseUrl, { ca: config.databaseCa }),
  max: config.poolMax,
});

export const query = (texte, params) => pool.query(texte, params);

// Exécute une fonction dans une transaction (COMMIT si tout va bien, sinon ROLLBACK).
// Indispensable pour les contributions : la somme des parts est contrôlée au COMMIT.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}
