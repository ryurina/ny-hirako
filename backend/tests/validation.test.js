import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  Validateur,
  validerNouvellePersonne,
  idDepuisParams,
  idUuidDepuisParams,
  motifLike,
  pagination,
} from '../src/utils/validation.js';

const ok = (nom, condition) => test(nom, () => assert.ok(condition));
const UUID = '01036840-40db-4276-bf5e-c4a857badb3e';

// ---------- Textes ----------
{
  const v = new Validateur();
  ok('texte obligatoire vide refusé', v.texte('  ', 't', { requis: true }) === null && v.erreurs.length === 1);
}
{
  const v = new Validateur();
  ok('texte trop long refusé', (v.texte('x'.repeat(11), 't', { max: 10 }), v.erreurs.length === 1));
}

// ---------- Pourcentages (parts des ayants droit) ----------
{
  const v = new Validateur();
  ok('part 33.33 acceptée', v.pourcentage(33.33, 'p') === 33.33 && v.erreurs.length === 0);
  ok('part 0 refusée', (v.pourcentage(0, 'p'), v.erreurs.length === 1));
  ok('part 12.345 refusée (3 décimales)', (v.pourcentage(12.345, 'p'), v.erreurs.length === 2));
  ok('part 101 refusée', (v.pourcentage(101, 'p'), v.erreurs.length === 3));
}

// ---------- Montants en Ariary ----------
for (const [valeur, attendu] of [[200000, 200000], ['150000.50', 150000.5], [0, 0], [123456789.12, 123456789.12], [9999999999.99, 9999999999.99]]) {
  ok(`montant ${valeur} accepté`, (() => { const v = new Validateur(); return v.montant(valeur, 'm') === attendu && v.erreurs.length === 0; })());
}
for (const valeur of [-5, 12.345, 10000000000, 'abc']) {
  ok(`montant ${JSON.stringify(valeur)} refusé`, (() => { const v = new Validateur(); v.montant(valeur, 'm'); return v.erreurs.length === 1; })());
}

// ---------- Dates ----------
{
  const v = new Validateur();
  ok('date 2026-02-28 acceptée', v.date('2026-02-28', 'd') === '2026-02-28' && v.erreurs.length === 0);
  ok('date 2026-02-31 refusée', (v.date('2026-02-31', 'd'), v.erreurs.length === 1));
}

// ---------- Identifiants aléatoires (UUID) ----------
{
  let v = new Validateur();
  ok('UUID valide accepté', v.uuid(UUID, 'id') === UUID && v.erreurs.length === 0);
  v = new Validateur();
  ok('UUID en majuscules normalisé', v.uuid(UUID.toUpperCase(), 'id') === UUID);
  for (const mauvais of ['4', 'pas-un-uuid', "' OR 1=1 --", `${UUID}a`]) {
    ok(`identifiant ${JSON.stringify(mauvais)} refusé`, (() => { const w = new Validateur(); w.uuid(mauvais, 'id'); return w.erreurs.length === 1; })());
  }
  v = new Validateur();
  ok('UUID facultatif vide accepté', v.uuid('', 'id') === null && v.erreurs.length === 0);
  v = new Validateur();
  ok('UUID obligatoire absent refusé', (v.uuid(undefined, 'id', { requis: true }), v.erreurs.length === 1));

  const echantillon = Array.from({ length: 5 }, () => randomUUID());
  const v2 = new Validateur();
  ok('UUID v4 générés acceptés et tous différents', echantillon.every((u) => v2.uuid(u, 'id') === u) && new Set(echantillon).size === 5);
}

ok('idUuidDepuisParams accepte un UUID', idUuidDepuisParams(UUID) === UUID);
for (const mauvais of ['4', 'abc', '', UUID.slice(1), `${UUID}x`]) {
  ok(`idUuidDepuisParams(${JSON.stringify(mauvais)}) lève un 404`, (() => {
    try { idUuidDepuisParams(mauvais); return false; } catch (e) { return e.status === 404; }
  })());
}
ok('idDepuisParams accepte un entier', idDepuisParams('12') === 12);
ok('idDepuisParams(abc) lève un 404', (() => { try { idDepuisParams('abc'); return false; } catch (e) { return e.status === 404; } })());

// ---------- Personnes ----------
{
  let v = new Validateur();
  validerNouvellePersonne(v, { type: 'PHYSIQUE', nom: 'Rakoto' }, 'p');
  ok('personne physique sans prénom refusée', v.erreurs.length === 1);

  v = new Validateur();
  validerNouvellePersonne(v, { type: 'MORALE', nom: 'Éditions X', prenom: 'Jean' }, 'p');
  ok('personne morale avec prénom refusée', v.erreurs.length === 1);

  v = new Validateur();
  const p = validerNouvellePersonne(v, { type: 'PHYSIQUE', nom: 'Rakoto', prenom: 'Jean', ville: 'Tana' }, 'p');
  ok('personne valide acceptée', v.erreurs.length === 0 && p.ville === 'Tana' && p.email === null);

  v = new Validateur();
  validerNouvellePersonne(v, { type: 'PHYSIQUE' }, '');
  ok('préfixe vide : champs « nom » et « prenom »', v.erreurs.map((e) => e.champ).sort().join(',') === 'nom,prenom');
}

// ---------- Recherche et pagination ----------
ok('motifLike échappe % et _', motifLike('50%_a') === '%50\\%\\_a%');
ok('pagination par défaut', JSON.stringify(pagination({})) === '{"page":1,"limit":20}');
ok('pagination limitée à 100', pagination({ limit: '999' }).limit === 100);
