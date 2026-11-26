# Tests et démonstration

[← Retour au README](../README.md)

Ce document décrit comment vérifier le projet : tests automatisés, scénario de démonstration pas à pas et contrôles SQL. L'installation est décrite dans la [section 6 du README](../README.md#6-installation-et-lancement).

## 1. Tests automatisés

Ils vérifient la logique métier sans avoir besoin de la base ni du navigateur : validation des données reçues (montants, parts, identifiants), calcul de la répartition des droits (même règle d'arrondi que la base), validation et construction des requêtes des formulaires.

```bash
cd backend && npm test     # 41 tests : validation des données de l'API
cd frontend && npm test    # 83 tests : calcul des droits, formulaires de soumission et de modification
```

Ils utilisent l'exécuteur de tests intégré à Node.js : aucune dépendance supplémentaire.

## 2. Scénario de démonstration

À faire sur une base fraîchement initialisée (`schema.sql` puis `seed.sql`), API et site démarrés. Chaque étape indique le résultat attendu.

### A. Visiteur (sans connexion)

1. **Rechercher.** Sur l'accueil, 6 œuvres sont listées. Taper `hery` : *Tanindrazako* et *Fitiavana Mandrakizay* apparaissent (retrouvées grâce au nom d'artiste). Genre `salegy` : *Ny Lanitra Manga* et *Sakafo Gasy*. Année `2018` : *Tanindrazako*.
2. **Consulter.** Ouvrir *Ny Lanitra Manga* : Njaka Gasy (auteur 25 % et compositeur 35 %), Fenitra Zaza (arrangeur 10 %), Maso Music Édition (éditeur 30 %).
3. **Ajouter (soumettre).** Menu « Soumettre une œuvre » : titre `Mamelombelona`, genre `Salegy`, email de contact. Ligne *Auteur* : onglet « Nouvelle personne », `Rakoto` / `Jean`, part `30`. Ligne *Compositeur* : rechercher `hery`, choisir *Hery Mora*, part `60`.
   - La jauge indique **90 %** (« il reste 10 % ») et l'envoi est refusé avec le total actuel.
   - Corriger la part de Rakoto Jean à `40` : la jauge devient verte, l'envoi réussit et une confirmation s'affiche. L'œuvre n'apparaît pas encore dans le répertoire public.

### B. Modérateur — `moderateur@nyhirako.example`

4. **Tableau de bord.** 2 œuvres en attente (*Alina Mamirapiratra*, *Mamelombelona*) et 2 ayants droit en attente (*Hanta Rasoanaivo*, *Rakoto Jean*). Pas de cartes d'argent, pas de section « Administration ».
5. **Règle de validation.** Ouvrir *Mamelombelona* et cliquer sur « Valider l'œuvre » : **refusé**, car un ayant droit n'est pas validé (trigger de la base).
6. **Valider.** Cliquer sur « Valider tous les ayants droit en attente », puis « Valider l'œuvre » : statut *Validée*. Le répertoire public liste maintenant 7 œuvres.
7. **Modifier.** Sur la fiche, « Modifier » : changer le genre en `Salegy moderne` et enregistrer. Cocher « Modifier aussi les ayants droit », passer les parts à 70 / 30, enregistrer : accepté (aucune diffusion n'existe encore pour cette œuvre).
8. **Intégrité référentielle.** Sur la fiche de *Tanindrazako*, « Supprimer » : **refusé**, l'œuvre a déjà été diffusée. La suppression de *Mamelombelona* est en revanche possible.
9. **Contrôle d'accès.** Aller à `/gestion/diffusions` : redirection vers le tableau de bord. (Côté API, la même route renvoie 403.)

### C. Administrateur — `admin@nyhirako.example`

10. **Diffuseurs.** Créer `Radio Test` (type Radio, Antananarivo) : accepté. La recréer à l'identique : **refusé** (unicité nom + ville). Supprimer *Radio Fanasina FM* : **refusé** (elle a des diffusions).
11. **Diffusion et répartition.** « Nouvelle diffusion » : œuvre *Tanindrazako*, diffuseur *Radio Fanasina FM*, montant `200000`. L'**aperçu** annonce 80 000 Ar (Voahangy Soa) / 80 000 Ar (Hery Mora) / 40 000 Ar (Éditions Ravinala). Enregistrer : la fiche de la diffusion affiche les mêmes montants et un écart de 0.
12. **Œuvre non validée.** La recherche d'œuvre du formulaire ne propose que des œuvres validées (taper `Alina` : aucun résultat). La base refuse aussi ce cas (voir la commande `curl` ci-dessous).
13. **Droits perçus.** Le classement liste les ayants droit par total ; ouvrir *Hery Mora* : la diffusion du test y figure avec 80 000 Ar.
14. **Recalcul.** Modifier le montant de la diffusion à `250000` : la répartition devient 100 000 / 100 000 / 50 000.
15. **Suppression.** Supprimer la diffusion : elle disparaît du détail de Hery et du classement.

Pour l'étape 12 côté API (le jeton `$TOKEN` s'obtient comme en [référence de l'API](API.md#authentification)) :

```bash
curl -X POST http://localhost:3000/api/gestion/diffusions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id_oeuvre": "f9a08ab6-8414-49b2-98f7-ba30fff802d1", "id_diffuseur": 1, "date_diffusion": "2026-11-20", "montant_total": 100000}'
# -> 422 : « L'œuvre de la diffusion … n'est pas validée : répartition impossible », rien n'est créé
```

## 3. Vérifier la base et ses contraintes en SQL

**Contenu de la base**

```sql
-- Total des droits par ayant droit
SELECT * FROM vue_droits_par_personne ORDER BY total_droits DESC;

-- Répartition d'une diffusion
SELECT p.nom, r_role.libelle, c.part_pct, r.montant
FROM repartition r
JOIN contribution c  ON c.id_contribution = r.id_contribution
JOIN personne p      ON p.id_personne = c.id_personne
JOIN role r_role     ON r_role.id_role = c.id_role
WHERE r.id_diffusion = 1;
```

**Contraintes d'intégrité**

Chacune de ces requêtes doit être refusée par PostgreSQL :

```sql
-- Un éditeur doit être une personne morale
INSERT INTO contribution (id_oeuvre, id_personne, id_role, part_pct) VALUES ('f9a08ab6-8414-49b2-98f7-ba30fff802d1', 1, 4, 10);

-- Validation impossible : l'ayant droit n°11 (Hanta Rasoanaivo) n'est pas validé
UPDATE oeuvre SET statut = 'VALIDE' WHERE id_oeuvre = 'f9a08ab6-8414-49b2-98f7-ba30fff802d1';

-- Une œuvre diffusée ne peut pas être supprimée
DELETE FROM oeuvre WHERE id_oeuvre = '01036840-40db-4276-bf5e-c4a857badb3e';

-- Le même rôle ne peut pas être attribué deux fois à la même personne sur une œuvre
INSERT INTO contribution (id_oeuvre, id_personne, id_role, part_pct) VALUES ('01036840-40db-4276-bf5e-c4a857badb3e', 1, 2, 5);
```
