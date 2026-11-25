import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parserDuree, centimes, totalCentimes, repartirEquitablement, formaterPourcent,
  validerSoumission, construireCorps,
} from '../src/utils/soumission.js';

const ok = (nom, condition) => test(nom, () => assert.ok(condition));

// Durée
ok('durée 3:45 -> 225', parserDuree('3:45') === 225);
ok('durée 0:00 refusée', parserDuree('0:00') === null);
ok('durée 3:75 refusée', parserDuree('3:75') === null);
ok('durée "abc" refusée', parserDuree('abc') === null);

// Parts
ok('centimes 33.33 -> 3333', centimes('33.33') === 3333);
ok('centimes virgule 12,5 -> 1250', centimes('12,5') === 1250);
ok('centimes 0 refusé', centimes('0') === null);
ok('centimes 100.01 refusé', centimes('100.01') === null);
ok('centimes 12.345 refusé', centimes('12.345') === null);
ok('centimes vide refusé', centimes('') === null);

// Répartition équitable : la somme fait toujours 100
for (const n of [1, 2, 3, 4, 6, 7, 9, 13, 20]) {
  const parts = repartirEquitablement(n);
  const somme = parts.reduce((s, p) => s + centimes(p), 0);
  ok(`répartition équitable n=${n} somme=100`, somme === 10000 && parts.length === n);
}
ok('répartition 3 -> 33.34/33.33/33.33', repartirEquitablement(3).join('|') === '33.34|33.33|33.33');
ok('formaterPourcent', formaterPourcent(33.5) === '33,5' && formaterPourcent(100) === '100');

// Formulaire valide
const personneExistante = (id, type = 'PHYSIQUE') => ({ mode: 'existante', selection: { id_personne: id, type, libelle: 'X' }, nouvelle: { type: 'PHYSIQUE', nom: '', prenom: '', nom_artiste: '', ville: '' } });
const personneNouvelle = (nouvelle) => ({ mode: 'nouvelle', selection: null, nouvelle: { type: 'PHYSIQUE', nom: '', prenom: '', nom_artiste: '', ville: '', ...nouvelle } });
const base = () => ({
  titre: 'Mamelombelona', genre: 'Salegy', annee: 2025, duree: '3:30', iswc: '', email: 'test@example.com',
  lignes: [
    { cle: 1, id_role: 2, part: '60', personne: personneExistante(1) },
    { cle: 2, id_role: 1, part: '40', personne: personneNouvelle({ nom: 'Rakoto', prenom: 'Jean' }) },
  ],
});

ok('formulaire valide : aucune erreur', validerSoumission(base()).length === 0);

let f = base(); f.titre = '  ';
ok('titre vide détecté', validerSoumission(f).some((e) => e.includes('titre')));

f = base(); f.lignes[1].part = '30';
ok('somme 90 détectée', validerSoumission(f).some((e) => e.includes('100 %') && e.includes('90')));

f = base(); f.lignes[1].personne.nouvelle.prenom = '';
ok('prénom manquant détecté', validerSoumission(f).some((e) => e.includes('prénom')));

f = base(); f.lignes[1] = { cle: 2, id_role: 4, part: '40', personne: personneNouvelle({ type: 'MORALE', nom: 'Éditions X' }) };
ok('éditeur personne morale sans prénom valide', validerSoumission(f).length === 0);

f = base(); f.lignes[1] = { cle: 2, id_role: 2, part: '40', personne: personneExistante(1) };
ok('doublon personne+rôle détecté', validerSoumission(f).some((e) => e.includes('déjà ce rôle')));

f = base(); f.lignes[0].personne = personneExistante(1); f.lignes[0].personne.selection = null;
ok('personne non sélectionnée détectée', validerSoumission(f).some((e) => e.includes('sélectionnez')));

f = base(); f.email = 'pas-un-email';
ok('email invalide détecté', validerSoumission(f).some((e) => e.includes('email')));

f = base(); f.duree = '99'; f.annee = 1500;
ok('durée + année invalides détectés', validerSoumission(f).length === 2);

f = base(); f.lignes[0].part = '';
const e = validerSoumission(f);
ok('part vide : pas de message de somme en double', e.some((x) => x.includes('la part')) && !e.some((x) => x.includes('somme')));

// Corps de la requête
const corps = construireCorps(base());
ok('corps : titre, email, genre, année, durée', corps.titre === 'Mamelombelona' && corps.soumetteur_email === 'test@example.com' && corps.genre === 'Salegy' && corps.annee_creation === 2025 && corps.duree_sec === 210);
ok('corps : contribution existante', corps.contributions[0].id_personne === 1 && corps.contributions[0].id_role === 2 && corps.contributions[0].part_pct === 60);
ok('corps : nouvelle personne', corps.contributions[1].nouvelle_personne.nom === 'Rakoto' && corps.contributions[1].nouvelle_personne.prenom === 'Jean' && corps.contributions[1].id_personne === undefined);
ok('corps : pas de champs vides (ville)', corps.code_iswc === undefined && corps.contributions[1].nouvelle_personne.ville === undefined);

const morale = base();
morale.lignes[1] = { cle: 2, id_role: 4, part: '40', personne: personneNouvelle({ type: 'MORALE', nom: 'Éditions X', prenom: 'ne doit pas partir' }) };
const c2 = construireCorps(morale).contributions[1].nouvelle_personne;
ok('corps : personne morale sans prénom', c2.type === 'MORALE' && c2.prenom === undefined);

const d33 = base(); d33.lignes = repartirEquitablement(3).map((p, i) => ({ cle: i, id_role: 1, part: p, personne: personneExistante(i + 1) }));
ok('3 lignes équitables : total 100 et valide', totalCentimes(d33.lignes) === 10000 && validerSoumission(d33).length === 0);
const parts = construireCorps(d33).contributions.map((c) => c.part_pct);
ok('parts envoyées : 33.34 / 33.33 / 33.33', parts.join('|') === '33.34|33.33|33.33');

