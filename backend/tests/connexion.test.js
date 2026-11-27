import test from 'node:test';
import assert from 'node:assert/strict';
import { optionsConnexion } from '../src/utils/connexion.js';

const CA = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----\n';

test('développement local : adresse inchangée, pas de TLS', () => {
  const r = optionsConnexion('postgresql://localhost:5432/nyhirako');
  assert.deepEqual(r, { connectionString: 'postgresql://localhost:5432/nyhirako' });
  assert.equal(r.ssl, undefined);
});

test('sslmode=require sans CA : chiffré, certificat non vérifié, sslmode retiré de l’adresse', () => {
  const r = optionsConnexion('postgres://avnadmin:secret@hote.exemple:13153/defaultdb?sslmode=require');
  assert.deepEqual(r.ssl, { rejectUnauthorized: false });
  assert.ok(!r.connectionString.includes('sslmode'));
  assert.ok(r.connectionString.startsWith('postgres://avnadmin:secret@hote.exemple:13153/defaultdb'));
});

test('avec un certificat CA : vérification complète', () => {
  const r = optionsConnexion('postgres://u:p@hote.exemple:1/db?sslmode=require', { ca: CA });
  assert.deepEqual(r.ssl, { ca: CA, rejectUnauthorized: true });
  assert.ok(!r.connectionString.includes('sslmode'));
});

test('un certificat CA suffit à activer TLS, même sans sslmode dans l’adresse', () => {
  const r = optionsConnexion('postgres://u:p@hote.exemple:1/db', { ca: CA });
  assert.equal(r.ssl.rejectUnauthorized, true);
  assert.equal(r.ssl.ca, CA);
});

test('sslmode=disable désactive TLS', () => {
  const r = optionsConnexion('postgres://u:p@hote.exemple:1/db?sslmode=disable', { ca: CA });
  assert.equal(r.ssl, undefined);
  assert.ok(!r.connectionString.includes('sslmode'));
});

test('les autres paramètres de l’adresse sont conservés', () => {
  const r = optionsConnexion('postgres://u:p@hote.exemple:1/db?application_name=nyhirako&sslmode=require');
  assert.ok(r.connectionString.includes('application_name=nyhirako'));
  assert.ok(!r.connectionString.includes('sslmode'));
});

test('un mot de passe avec des caractères spéciaux (encodés) est préservé', () => {
  const r = optionsConnexion('postgres://u:p%40ss%2Fword@hote.exemple:1/db?sslmode=require');
  assert.ok(r.connectionString.includes('u:p%40ss%2Fword@'));
});

test('une adresse illisible est renvoyée telle quelle', () => {
  assert.deepEqual(optionsConnexion('pas une adresse'), { connectionString: 'pas une adresse' });
});
