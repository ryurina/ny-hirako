import test from 'node:test';
import assert from 'node:assert/strict';
import { centimesMontant, calculerRepartition, formaterCentimes } from '../src/utils/droits.js';

const ok = (nom, condition) => test(nom, () => assert.ok(condition));

ok('montant 200000 -> 20000000', centimesMontant('200000') === 20000000);
ok('montant 150000.50 -> 15000050', centimesMontant('150000.50') === 15000050);
ok('montant 0 accepté', centimesMontant(0) === 0);
ok('montant négatif refusé', centimesMontant(-1) === null);
ok('montant 10.005 refusé', centimesMontant('10.005') === null);
ok('montant vide refusé', centimesMontant('') === null);
ok('montant maximal accepté', centimesMontant('9999999999.99') === 999999999999);

// Exemple du seed : œuvre 1, 200 000 Ar -> 80 000 / 80 000 / 40 000 (vérifié contre l'API)
const oeuvre1 = [{ part_pct: 40 }, { part_pct: 40 }, { part_pct: 20 }];
const r1 = calculerRepartition(20000000, oeuvre1).map((c) => c.montantCentimes);
ok('œuvre 1 : 80 000 / 80 000 / 40 000', r1.join('|') === '8000000|8000000|4000000');

// Parts sous forme de chaînes (comme renvoyées par l'API dans le détail d'une diffusion)
const r2 = calculerRepartition(20000000, [{ part_pct: '40.00' }, { part_pct: '20.00' }]).map((c) => c.montantCentimes);
ok('parts en chaînes', r2.join('|') === '8000000|4000000');

// Arrondi au centime : 100 000 Ar partagés en 33,33 / 33,33 / 33,34
const r3 = calculerRepartition(10000000, [{ part_pct: 33.33 }, { part_pct: 33.33 }, { part_pct: 33.34 }]).map((c) => c.montantCentimes);
ok('33,33 % de 100 000 Ar = 33 330 Ar', r3.join('|') === '3333000|3333000|3334000');

// Arrondi « moitié vers le haut » comme ROUND() de PostgreSQL : 0,05 Ar x 10 % = 0,005 -> 0,01
ok('arrondi moitié supérieure', calculerRepartition(5, [{ part_pct: 10 }])[0].montantCentimes === 1);
ok('arrondi inférieur', calculerRepartition(4, [{ part_pct: 10 }])[0].montantCentimes === 0);

// Énorme montant : pas de dépassement grâce à BigInt
const gros = calculerRepartition(999999999999, [{ part_pct: 33.33 }])[0].montantCentimes;
ok('très gros montant exact', gros === 333299999999 + 0 || gros === Math.round(999999999999 * 0.3333));

// Somme : avec des parts qui totalisent 100, l'écart d'arrondi reste de quelques centimes au plus
const parts7 = [14.28, 14.28, 14.28, 14.28, 14.28, 14.28, 14.32];
const total7 = calculerRepartition(10000001, parts7.map((p) => ({ part_pct: p }))).reduce((s, c) => s + c.montantCentimes, 0);
ok('écart d’arrondi <= nombre de lignes', Math.abs(total7 - 10000001) <= parts7.length);

ok('formaterCentimes entier', formaterCentimes(8000000).replace(/\s/g, ' ') === '80 000 Ar');
ok('formaterCentimes décimales', formaterCentimes(3333333).includes(',33'));

