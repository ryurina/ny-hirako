import test from 'node:test';
import assert from 'node:assert/strict';
import {
  secondesVersTexte, lignesDepuisContributions, construireCorpsOeuvre,
  personneVersFormulaire, validerPersonneEdition, construireCorpsPersonne,
} from '../src/utils/edition.js';
import { validerSoumission, totalCentimes } from '../src/utils/soumission.js';

const ok = (nom, condition) => test(nom, () => assert.ok(condition));

// Durée
ok('225 s -> 3:45', secondesVersTexte(225) === '3:45');
ok('187 s -> 3:07', secondesVersTexte(187) === '3:07');
ok('durée inconnue -> vide', secondesVersTexte(null) === '');

// Contributions de l'API (format réel de GET /api/gestion/oeuvres/:id)
const contributions = [
  { id_contribution: 5, id_personne: 4, nom_affiche: 'Njaka Gasy', role: 'Auteur', part_pct: 25, statut_personne: 'VALIDE', type_personne: 'PHYSIQUE', id_role: 1 },
  { id_contribution: 6, id_personne: 4, nom_affiche: 'Njaka Gasy', role: 'Compositeur', part_pct: 35, statut_personne: 'VALIDE', type_personne: 'PHYSIQUE', id_role: 2 },
  { id_contribution: 7, id_personne: 7, nom_affiche: 'Fenitra Zaza', role: 'Arrangeur', part_pct: 10, statut_personne: 'VALIDE', type_personne: 'PHYSIQUE', id_role: 3 },
  { id_contribution: 8, id_personne: 10, nom_affiche: 'Maso Music Édition', role: 'Éditeur', part_pct: 30, statut_personne: 'VALIDE', type_personne: 'MORALE', id_role: 4 },
];
const lignes = lignesDepuisContributions(contributions);
ok('4 lignes pré-remplies', lignes.length === 4);
ok('rôle, personne et part repris', lignes[3].id_role === 4 && lignes[3].personne.selection.id_personne === 10 && lignes[3].personne.selection.type === 'MORALE' && lignes[3].part === '30');
ok('total des parts = 100', totalCentimes(lignes) === 10000);
ok('clés de ligne uniques', new Set(lignes.map((l) => l.cle)).size === 4);

const base = () => ({ titre: 'Ny Lanitra Manga', genre: 'Salegy', annee: 2021, duree: '3:18', iswc: 'T-345.678.902-3', email: '', lignes: lignesDepuisContributions(contributions) });

// Un formulaire pré-rempli sans modification est valide
ok('formulaire d’édition pré-rempli valide', validerSoumission(base(), { avecEmail: false }).length === 0);
ok('email non exigé en modification', !validerSoumission(base(), { avecEmail: false }).some((e) => e.includes('email')));
ok('email toujours exigé à la soumission', validerSoumission({ ...base(), email: '' }).some((e) => e.includes('email')));

// Sans modification des droits : les contributions ne sont pas contrôlées
const sansDroits = { ...base(), lignes: [] };
ok('droits non modifiés : lignes vides acceptées', validerSoumission(sansDroits, { avecEmail: false, avecContributions: false }).length === 0);
ok('droits modifiés : lignes vides refusées', validerSoumission(sansDroits, { avecEmail: false, avecContributions: true }).some((e) => e.includes('au moins un')));

let f = base(); f.lignes[0].part = '20';
ok('parts modifiées à 95 % : erreur de somme', validerSoumission(f, { avecEmail: false }).some((e) => e.includes('95')));

// Corps de la requête PUT
let corps = construireCorpsOeuvre(base(), { avecContributions: false });
ok('PUT sans droits : pas de contributions', corps.contributions === undefined && corps.titre === 'Ny Lanitra Manga' && corps.duree_sec === 198 && corps.annee_creation === 2021 && corps.code_iswc === undefined);
corps = construireCorpsOeuvre(base(), { avecContributions: true });
ok('PUT avec droits : 4 contributions', corps.contributions.length === 4 && corps.contributions[2].id_personne === 7 && corps.contributions[2].id_role === 3 && corps.contributions[2].part_pct === 10);
f = { ...base(), genre: '  ', annee: '', duree: '' };
corps = construireCorpsOeuvre(f, { avecContributions: false });
ok('champs vidés envoyés à null', corps.genre === null && corps.annee_creation === null && corps.duree_sec === null && corps.code_iswc === undefined);

// Ayants droit
const api = { type: 'PHYSIQUE', nom: 'Rasolofoniaina', prenom: 'Njaka', nom_artiste: 'Njaka Gasy', date_naissance: '1992-01-19', telephone: '+261 32 00 111 04', email: 'njaka@example.com', ville: 'Mahajanga' };
const pf = personneVersFormulaire(api);
ok('personne -> formulaire', pf.nom === 'Rasolofoniaina' && pf.date_naissance === '1992-01-19' && pf.ville === 'Mahajanga');
ok('personne inchangée : valide', validerPersonneEdition(pf).length === 0);
ok('null -> chaînes vides', personneVersFormulaire({ type: 'MORALE', nom: 'X', prenom: null, nom_artiste: null, date_naissance: null, telephone: null, email: null, ville: null }).prenom === '');

ok('nom vide refusé', validerPersonneEdition({ ...pf, nom: ' ' }).length === 1);
ok('prénom exigé pour une personne physique', validerPersonneEdition({ ...pf, prenom: '' }).some((e) => e.includes('prénom')));
ok('prénom non exigé pour une personne morale', validerPersonneEdition({ ...pf, type: 'MORALE', prenom: '' }).length === 0);
ok('raison sociale pour une personne morale', validerPersonneEdition({ ...pf, type: 'MORALE', nom: '' }).some((e) => e.includes('raison sociale')));
ok('email invalide refusé', validerPersonneEdition({ ...pf, email: 'abc' }).some((e) => e.includes('email')));
ok('naissance future refusée', validerPersonneEdition({ ...pf, date_naissance: '2999-01-01' }).some((e) => e.includes('futur')));
ok('champ trop long refusé', validerPersonneEdition({ ...pf, ville: 'x'.repeat(101) }).some((e) => e.includes('ville')));

let c = construireCorpsPersonne(pf);
ok('corps personne physique complet', c.prenom === 'Njaka' && c.nom_artiste === 'Njaka Gasy' && c.date_naissance === '1992-01-19' && c.email === 'njaka@example.com');
c = construireCorpsPersonne({ ...pf, type: 'MORALE', nom: 'Éditions X' });
ok('personne morale : prénom, artiste et naissance à null', c.prenom === null && c.nom_artiste === null && c.date_naissance === null && c.nom === 'Éditions X');
c = construireCorpsPersonne({ ...pf, telephone: '', email: '  ', ville: '' });
ok('champs vides -> null', c.telephone === null && c.email === null && c.ville === null);

