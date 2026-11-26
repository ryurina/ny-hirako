# ny-hirako

> Gestion simplifiée des droits d'auteur pour les artistes malagasy.

*Projet final : Application web avec une base de données relationnelle (échéance : 27 novembre 2026).*

Dépôt : <https://github.com/ryurina/ny-hirako>

## Sommaire

1. [Problème et objectifs](#1-problème-et-objectifs)
2. [Acteurs et fonctionnalités](#2-acteurs-et-fonctionnalités)
3. [Technologies et justification](#3-technologies-et-justification)
4. [Modèle entité-association](#4-modèle-entité-association)
5. [Schéma relationnel et normalisation](#5-schéma-relationnel-et-normalisation)
6. [Installation et lancement](#6-installation-et-lancement)
7. [Captures d'écran](#7-captures-décran)
8. [Tests et démonstration](#8-tests-et-démonstration)
9. [Référence de l'API](#9-référence-de-lapi)

### Démarrage rapide

Avec Node.js (20.6 ou plus) et PostgreSQL (13 ou plus) installés et PostgreSQL démarré :

```bash
git clone https://github.com/ryurina/ny-hirako.git && cd ny-hirako

# Base de données
createdb nyhirako
psql -d nyhirako -f db/schema.sql
psql -d nyhirako -f db/seed.sql

# API (terminal 1)
cd backend
npm install
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
npm run dev

# Site (terminal 2)
cd frontend
npm install
npm run dev
```

Ouvrir ensuite <http://localhost:5173>. Compte administrateur de démonstration : `admin@nyhirako.example` / `Admin123!`.
Le détail de chaque étape, les variantes et le dépannage sont en [section 6](#6-installation-et-lancement).

## 1. Problème et objectifs

Les auteurs, compositeurs, arrangeurs et éditeurs malagasy n'ont pas d'outil simple pour :

- enregistrer leurs œuvres musicales ;
- déclarer qui a participé à chaque œuvre et pour quelle part ;
- suivre les diffusions (radio, télévision, salle, événement) et calculer les droits dus à chaque ayant droit.

**ny-hirako** est un MVP qui répond à ce besoin avec une base PostgreSQL et une application web.

## 2. Acteurs et fonctionnalités

| Acteur | Accès | Possibilités |
|---|---|---|
| **Visiteur** | Public, sans compte | Rechercher et consulter les œuvres et ayants droit validés ; soumettre une œuvre via un formulaire |
| **Modérateur** | Connexion requise | Valider ou rejeter les soumissions ; gérer les personnes, les œuvres et leurs contributions |
| **Administrateur** | Connexion requise | Tout ce que fait le modérateur, plus la gestion des diffuseurs, des diffusions, des répartitions de droits et des comptes |

Fonctionnalités principales : ajout, consultation, modification, suppression et recherche pour chaque entité, workflow de modération des soumissions, calcul de la répartition des droits par diffusion.

Cycle de vie d'une soumission (œuvre ou personne) :

```mermaid
stateDiagram-v2
    [*] --> EN_ATTENTE : soumission via le formulaire public
    EN_ATTENTE --> VALIDE : validation par un modérateur
    EN_ATTENTE --> REJETE : rejet par un modérateur
    VALIDE --> [*]
    REJETE --> [*]
```

Une œuvre ne peut être validée que si la somme des parts de ses contributions vaut 100 et si tous ses ayants droit sont déjà validés.

### Pages de l'application

| Page | Adresse | Accès |
|---|---|---|
| Répertoire des œuvres (recherche) | `/` | Public |
| Détail d'une œuvre | `/oeuvres/:id` | Public |
| Formulaire de soumission d'une œuvre | `/soumettre` | Public |
| Connexion | `/connexion` | Public |
| Tableau de bord (chiffres, éléments à traiter) | `/gestion` | Modérateur / Admin |
| Œuvres : liste, détail, validation, rejet, suppression | `/gestion/oeuvres`, `/gestion/oeuvres/:id` | Modérateur / Admin |
| Ayants droit : liste, détail, validation, rejet, suppression | `/gestion/personnes`, `/gestion/personnes/:id` | Modérateur / Admin |
| Modifier une œuvre (informations, ayants droit et parts) | `/gestion/oeuvres/:id/modifier` | Modérateur / Admin |
| Modifier un ayant droit | `/gestion/personnes/:id/modifier` | Modérateur / Admin |
| Diffuseurs : liste, création, modification, suppression | `/gestion/diffuseurs` | Admin |
| Diffusions : liste filtrée, détail, modification, recalcul, suppression | `/gestion/diffusions`, `/gestion/diffusions/:id` | Admin |
| Nouvelle diffusion avec aperçu de la répartition | `/gestion/diffusions/nouvelle` | Admin |
| Droits perçus : classement et détail par ayant droit | `/gestion/droits`, `/gestion/droits/:id` | Admin |

#### Espace de gestion

Après connexion, les modérateurs et administrateurs arrivent sur un tableau de bord à barre latérale (menu fixe sur ordinateur, tiroir sur téléphone) : chiffres clés, soumissions à traiter, puis écrans de validation.

- **Œuvres** et **Ayants droit** : onglets par statut (En attente, Validées, Rejetées, Toutes), recherche, validation ou rejet en un clic. Le filtre est conservé dans l'adresse (`?statut=EN_ATTENTE`).
- **Fiche d'une œuvre** : répartition des parts avec le statut de chaque ayant droit. Si certains ne sont pas encore validés, un bouton permet de tous les valider avant de valider l'œuvre.
- Les règles métier restent appliquées par la base (par exemple, une œuvre ne peut pas être validée si la somme des parts n'est pas de 100 %) : l'interface se contente d'afficher le message d'erreur.
- Les pastilles de la barre latérale indiquent le nombre d'éléments en attente.
- **Modification** : depuis la fiche d'une œuvre ou d'un ayant droit, le bouton « Modifier » ouvre un formulaire pré-rempli. Pour une œuvre, la répartition des parts est modifiable avec la même jauge que le formulaire de soumission ; elle est refusée par la base si des droits ont déjà été répartis (l'historique des paiements est protégé), auquel cas seules les informations de l'œuvre peuvent changer.

#### Administration : de la diffusion aux droits

Les pages liées à l'argent sont réservées aux administrateurs (un modérateur qui tape l'adresse est redirigé vers le tableau de bord, et l'API refuse de toute façon avec un code 403).

```mermaid
flowchart LR
    A["Diffuseur<br/>radio, TV, salle, événement"] --> C
    B["Œuvre validée<br/>et ses parts"] --> C["Diffusion<br/>date + montant"]
    C -->|"calculer_repartition()"| D["Répartition<br/>un montant par contribution"]
    D --> E["Droits perçus<br/>classement par ayant droit"]
```

- **Nouvelle diffusion** : après le choix de l'œuvre, du diffuseur, de la date et du montant, un **aperçu** montre ce que percevra chaque ayant droit avant l'enregistrement. Le calcul de l'aperçu reproduit exactement celui de la base (part × montant ÷ 100, arrondi au centime).
- **Détail d'une diffusion** : montant, total réparti et éventuel écart d'arrondi. Modifier le montant recalcule la répartition ; l'œuvre, elle, n'est pas modifiable (la répartition en dépend).
- **Droits perçus** : classement des ayants droit validés avec barres proportionnelles, puis détail diffusion par diffusion.
- Les montants sont en Ariary.

#### Parcours de soumission

Le formulaire public permet à n'importe quel visiteur de proposer une œuvre. Il contrôle en direct que la somme des parts vaut 100 %, et ne révèle jamais l'email du soumetteur.

```mermaid
flowchart TD
    A["Visiteur remplit le formulaire<br/>œuvre + ayants droit + parts"] --> B{"Somme des parts = 100 % ?"}
    B -- non --> A
    B -- oui --> C["POST /api/oeuvres<br/>(une seule transaction)"]
    C --> D["Œuvre EN_ATTENTE<br/>+ nouvelles personnes EN_ATTENTE"]
    D --> E{"Modérateur"}
    E -- valide --> F["Visible dans le répertoire public"]
    E -- rejette --> G["Reste masquée"]
```

Dans le formulaire, un ayant droit existant est recherché par nom ou nom d'artiste ; s'il n'existe pas, il peut être ajouté comme nouvelle personne (elle sera validée par un modérateur). Le rôle « Éditeur » impose une personne morale, conformément à la règle de la base.

## 3. Technologies et justification

| Couche | Choix | Justification |
|---|---|---|
| Frontend | Vue 3 + Vite | Framework réactif, léger, rapide à mettre en place |
| Backend | Node.js + Express | API REST simple et rapide à développer |
| Base de données | PostgreSQL | Contraintes d'intégrité robustes (CHECK, triggers, énumérations) |

```mermaid
flowchart LR
    V["Visiteur<br/>(formulaire, recherche)"] --> F
    M["Modérateur / Admin<br/>(connecté)"] --> F
    F["Frontend<br/>Vue 3 + Vite"] -->|"HTTP / JSON"| A["API REST<br/>Express"]
    A -->|"SQL (pg)"| D[("PostgreSQL")]
```

L'intégrité des données est garantie par la base elle-même (contraintes, triggers) : l'API se contente de traduire les erreurs PostgreSQL en réponses HTTP claires.

### Justification des choix

| Choix | Pourquoi il convient à ce projet |
|---|---|
| **PostgreSQL** | Les règles du projet sont des règles d'intégrité (la somme des parts d'une œuvre vaut 100 %, un éditeur est une personne morale, une œuvre n'est publique que si ses ayants droit sont validés…). PostgreSQL permet de les écrire **dans la base** (`CHECK`, triggers, contraintes différées jusqu'au `COMMIT`), donc elles sont respectées quel que soit le programme qui écrit. Il fournit aussi les types énumérés (statuts), les identifiants `UUID`, les transactions et les fonctions SQL (calcul des droits). |
| **SQL écrit à la main, sans ORM** | Le sujet porte sur la base relationnelle : le schéma, les contraintes, les triggers et les requêtes restent lisibles et expliqués dans `db/schema.sql` et dans l'API. |
| **Express (Node.js)** | API REST simple, qui valide les données reçues et traduit les erreurs de la base en codes HTTP clairs (409, 422…). |
| **Vue 3 + Vite** | Interface réactive : jauge de répartition et aperçu des droits calculés en direct, composants réutilisables, rechargement instantané en développement. |
| **JWT + bcrypt** | Authentification sans état pour les modérateurs et administrateurs ; les mots de passe sont hachés par la base (`pgcrypto`) et vérifiés par l'API. |

### Charte graphique

Interface claire et institutionnelle, pensée comme un tableau de bord professionnel pour l'industrie musicale.

| Rôle | Couleur | Usage |
|---|---|---|
| Primaire | `#172554` bleu marine | Titres, boutons principaux, bandeau d'accueil |
| Secondaire | `#3156A6` bleu roi | Liens, focus, barres de répartition |
| Accent | `#D6A84F` or | Détails distinctifs (jamais pour du texte fin) |
| Fond | `#F8FAFC` | Arrière-plan des pages |
| Cartes | `#FFFFFF` | Blocs de contenu |
| Texte | `#1E293B` | Texte courant |
| États | vert, ambre, rouge | Succès, attente de validation, erreurs |

Typographie : *Fraunces* (titres) et *Inter* (texte), chargées depuis Google Fonts avec repli automatique sur les polices du système. Toutes les couleurs sont des variables CSS définies en tête de `frontend/src/style.css`. L'interface s'adapte aux écrans d'ordinateur, de tablette et de téléphone.

## 4. Modèle entité-association

```mermaid
erDiagram
    PERSONNE ||--o{ CONTRIBUTION : "participe"
    ROLE ||--o{ CONTRIBUTION : "définit"
    OEUVRE ||--|{ CONTRIBUTION : "possède"
    OEUVRE ||--o{ DIFFUSION : "est diffusée"
    DIFFUSEUR ||--o{ DIFFUSION : "diffuse"
    DIFFUSION ||--|{ REPARTITION : "génère"
    CONTRIBUTION ||--o{ REPARTITION : "perçoit"
    UTILISATEUR |o--o{ OEUVRE : "valide"
    UTILISATEUR |o--o{ PERSONNE : "valide"

    PERSONNE {
        int id_personne PK
        string type "PHYSIQUE ou MORALE"
        string nom
        string prenom
        string nom_artiste
        date date_naissance
        string telephone
        string email
        string ville
        string statut "EN_ATTENTE, VALIDE, REJETE"
        int id_valideur FK
    }
    ROLE {
        int id_role PK
        string libelle "Auteur, Compositeur, Arrangeur, Éditeur"
    }
    OEUVRE {
        uuid id_oeuvre PK
        string titre
        int annee_creation
        string genre
        int duree_sec
        string statut "EN_ATTENTE, VALIDE, REJETE"
        string soumetteur_email
        date date_soumission
        int id_valideur FK
    }
    CONTRIBUTION {
        int id_contribution PK
        uuid id_oeuvre FK
        int id_personne FK
        int id_role FK
        decimal part_pct
    }
    DIFFUSEUR {
        int id_diffuseur PK
        string nom
        string type "RADIO, TV, SALLE, EVENEMENT"
        string ville
    }
    DIFFUSION {
        int id_diffusion PK
        uuid id_oeuvre FK
        int id_diffuseur FK
        date date_diffusion
        decimal montant_total
    }
    REPARTITION {
        int id_diffusion FK
        int id_contribution FK
        decimal montant
    }
    UTILISATEUR {
        int id_utilisateur PK
        string email
        string mot_de_passe_hash
        string role_utilisateur "ADMIN ou MODERATEUR"
    }
```

### Contraintes d'intégrité prévues

- `part_pct` est compris entre 0 et 100.
- La somme des `part_pct` d'une œuvre vaut 100 (vérifiée à la validation de l'œuvre).
- Un triplet (œuvre, personne, rôle) est unique.
- Seule une personne de type `MORALE` peut avoir le rôle Éditeur.
- Une œuvre ayant des diffusions ne peut pas être supprimée (`ON DELETE RESTRICT`).
- `email` (utilisateur) est unique.

### Choix de modélisation

- **Répartition stockée** : le montant versé à chaque ayant droit est enregistré, ce qui conserve l'historique même si les parts changent plus tard.
- **Diffuseur séparé** : évite de répéter ses informations dans chaque diffusion.
- **Une seule entité PERSONNE** : auteurs, compositeurs et éditeurs partagent la même table, distingués par leur rôle sur chaque œuvre.
- **Identifiant d'œuvre aléatoire (UUID v4)** : `id_oeuvre` est généré par la base (`gen_random_uuid()`) plutôt qu'incrémenté. Les adresses publiques (`/oeuvres/3f2b…`) ne révèlent ni le nombre ni l'ordre des œuvres, et on ne peut pas deviner l'adresse d'une œuvre voisine. Aucun code ISWC n'est stocké : cet identifiant de substitution est la seule clé de l'œuvre.

## 5. Schéma relationnel et normalisation

### 5.1 Schéma relationnel

Notation : **clé primaire** en gras, `#` pour les clés étrangères.

- **UTILISATEUR**(**id_utilisateur**, email, mot_de_passe_hash, role_utilisateur)
- **PERSONNE**(**id_personne**, type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville, statut, #id_valideur → UTILISATEUR)
- **ROLE**(**id_role**, libelle)
- **OEUVRE**(**id_oeuvre**, titre, annee_creation, genre, duree_sec, statut, soumetteur_email, date_soumission, #id_valideur → UTILISATEUR)
- **CONTRIBUTION**(**id_contribution**, #id_oeuvre → OEUVRE, #id_personne → PERSONNE, #id_role → ROLE, part_pct)
- **DIFFUSEUR**(**id_diffuseur**, nom, type, ville)
- **DIFFUSION**(**id_diffusion**, #id_oeuvre → OEUVRE, #id_diffuseur → DIFFUSEUR, date_diffusion, montant_total)
- **REPARTITION**(**#id_diffusion** → DIFFUSION, **#id_contribution** → CONTRIBUTION, montant)

### 5.2 Clés étrangères et règles de suppression

| Clé étrangère | Référence | ON DELETE | Raison |
|---|---|---|---|
| PERSONNE.id_valideur | UTILISATEUR | SET NULL | Garder la personne si le modérateur est supprimé |
| OEUVRE.id_valideur | UTILISATEUR | SET NULL | Idem |
| CONTRIBUTION.id_oeuvre | OEUVRE | CASCADE | Les contributions n'existent pas sans l'œuvre |
| CONTRIBUTION.id_personne | PERSONNE | RESTRICT | Pas de suppression d'un ayant droit qui a des contributions |
| CONTRIBUTION.id_role | ROLE | RESTRICT | Les rôles sont des données de référence |
| DIFFUSION.id_oeuvre | OEUVRE | RESTRICT | Une œuvre diffusée ne peut pas être supprimée |
| DIFFUSION.id_diffuseur | DIFFUSEUR | RESTRICT | Conserver l'historique des diffusions |
| REPARTITION.id_diffusion | DIFFUSION | CASCADE | La répartition dépend de la diffusion |
| REPARTITION.id_contribution | CONTRIBUTION | RESTRICT | Conserver l'historique des paiements |

Contraintes d'unicité : `UTILISATEUR.email`, `ROLE.libelle`, `DIFFUSEUR(nom, ville)`, `CONTRIBUTION(id_oeuvre, id_personne, id_role)`.

### 5.3 Dépendances fonctionnelles

| Relation | Dépendances fonctionnelles | Clés candidates |
|---|---|---|
| UTILISATEUR | id_utilisateur → email, mot_de_passe_hash, role_utilisateur ; email → id_utilisateur | id_utilisateur, email |
| PERSONNE | id_personne → type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville, statut, id_valideur | id_personne |
| ROLE | id_role → libelle ; libelle → id_role | id_role, libelle |
| OEUVRE | id_oeuvre → titre, annee_creation, genre, duree_sec, statut, soumetteur_email, date_soumission, id_valideur | id_oeuvre |
| CONTRIBUTION | id_contribution → id_oeuvre, id_personne, id_role, part_pct ; (id_oeuvre, id_personne, id_role) → id_contribution, part_pct | id_contribution, (id_oeuvre, id_personne, id_role) |
| DIFFUSEUR | id_diffuseur → nom, type, ville ; (nom, ville) → id_diffuseur, type | id_diffuseur, (nom, ville) |
| DIFFUSION | id_diffusion → id_oeuvre, id_diffuseur, date_diffusion, montant_total | id_diffusion |
| REPARTITION | (id_diffusion, id_contribution) → montant | (id_diffusion, id_contribution) |

### 5.4 Justification de la normalisation (jusqu'à BCNF)

- **1NF** : tous les attributs sont atomiques. Les rôles d'une personne ne sont pas stockés dans une liste mais dans CONTRIBUTION, une ligne par rôle.
- **2NF** : aucune dépendance partielle. Les seules clés composées sont celles de REPARTITION et la clé alternative de CONTRIBUTION, et dans les deux cas les attributs non-clés (`montant`, `part_pct`) dépendent de la clé entière.
- **3NF** : aucune dépendance transitive entre attributs non-clés. Les informations du diffuseur, de l'œuvre ou du rôle sont dans leurs propres tables et ne sont pas recopiées ailleurs.
- **BCNF** : pour chaque dépendance fonctionnelle non triviale du tableau 5.3, le membre gauche est une clé candidate (donc une super-clé) de sa relation.

**Ce qui violerait la BCNF** (et que le schéma évite) :

- Stocker `nom_diffuseur` et `ville_diffuseur` directement dans DIFFUSION créerait la dépendance id_diffuseur → nom, ville avec un déterminant qui n'est pas une clé de DIFFUSION. D'où la table DIFFUSEUR séparée.
- Stocker `libelle_role` dans CONTRIBUTION créerait id_role → libelle hors clé. D'où la table ROLE.
- Stocker à la fois `nom` et `email` du soumetteur dans OEUVRE créerait email → nom. D'où le seul attribut `soumetteur_email`.

### 5.5 Contraintes hors dépendances fonctionnelles

Certaines règles métier ne s'expriment pas par une dépendance fonctionnelle et sont donc appliquées par des `CHECK` ou des triggers PostgreSQL :

- `part_pct` entre 0 et 100 (`CHECK`).
- Somme des parts d'une œuvre égale à 100, vérifiée à la validation de l'œuvre (trigger).
- Seule une personne `MORALE` peut avoir le rôle Éditeur (trigger).
- Une œuvre validée ne peut contenir que des ayants droit validés, et une personne liée à une œuvre validée ne peut plus être rejetée (triggers).
- Une personne qui est éditeur d'une œuvre ne peut pas devenir une personne physique (trigger).
- Une ligne de REPARTITION doit référencer une contribution de la même œuvre que la diffusion (trigger). Le `montant` est dérivé de `montant_total × part_pct`, mais cette relation entre plusieurs tables n'est pas une dépendance fonctionnelle interne à REPARTITION, donc elle ne remet pas en cause la BCNF.

## 6. Installation et lancement

### 6.1 Prérequis

| Outil | Version | Vérification |
|---|---|---|
| Node.js | 20.6 ou plus | `node -v` |
| npm | 9 ou plus | `npm -v` |
| PostgreSQL | 13 ou plus (serveur démarré et client `psql`) | `psql --version` |
| Git | toute version récente | `git --version` |

Le serveur PostgreSQL doit tourner avant de continuer (par exemple `sudo systemctl start postgresql` sous Linux).

### 6.2 Récupérer le projet

```bash
git clone https://github.com/ryurina/ny-hirako.git
cd ny-hirako
```

### 6.3 Créer et remplir la base

```bash
# 1. Créer la base vide
createdb nyhirako            # ou : sudo -u postgres createdb nyhirako

# 2. Créer les types, tables, contraintes, triggers et fonctions (remet la base à zéro)
psql -d nyhirako -f db/schema.sql

# 3. Charger les données d'exemple
psql -d nyhirako -f db/seed.sql
```

Si `psql` demande un utilisateur ou refuse la connexion, ajouter les options de connexion, par exemple `-U postgres -h localhost`, ou préfixer par `sudo -u postgres`.

| Script | Rôle |
|---|---|
| `db/schema.sql` | Supprime puis recrée tout : types énumérés, tables, index, triggers, fonction `calculer_repartition` et vue `vue_droits_par_personne`. Peut être relancé pour repartir de zéro. |
| `db/seed.sql` | Données d'exemple fictives : 2 comptes, 11 ayants droit, 8 œuvres, 5 diffuseurs, 12 diffusions, et la répartition des droits correspondante. |

Vérification : `psql -d nyhirako -c "SELECT titre, statut FROM oeuvre ORDER BY titre;"` doit afficher 8 œuvres.

*Variante avec Docker* (si PostgreSQL n'est pas installé) :

```bash
docker run --name nyhirako-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nyhirako -p 5432:5432 -d postgres:16
psql -h localhost -U postgres -d nyhirako -f db/schema.sql
psql -h localhost -U postgres -d nyhirako -f db/seed.sql
```

Dans ce cas, `DATABASE_URL` vaut `postgresql://postgres:postgres@localhost:5432/nyhirako`.

### 6.4 Lancer l'API

```bash
cd backend
npm install
cp .env.example .env
```

Éditer ensuite `backend/.env` :

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `DATABASE_URL` | Connexion à PostgreSQL. Ajouter `utilisateur:motdepasse@` devant `localhost` si nécessaire. | `postgresql://localhost:5432/nyhirako` |
| `JWT_SECRET` | Secret de signature des jetons de connexion. **À remplacer** par une chaîne aléatoire : `openssl rand -hex 32` | à définir |
| `JWT_EXPIRES_IN` | Durée de validité d'une session | `8h` |
| `PORT` | Port de l'API | `3000` |
| `CORS_ORIGIN` | Adresse du site (plusieurs possibles, séparées par des virgules) | `http://localhost:5173` |

Démarrer l'API :

```bash
npm run dev      # rechargement automatique ; en production : npm start
```

Contrôle : `curl http://localhost:3000/api/health` doit répondre `{"status":"ok","db":"ok"}`.

### 6.5 Lancer le site

Dans un second terminal, l'API restant démarrée :

```bash
cd frontend
npm install
npm run dev
```

Le site est disponible sur <http://localhost:5173>. En développement, Vite redirige les appels `/api` vers l'API (voir `frontend/vite.config.js`) : aucune configuration supplémentaire n'est nécessaire.

### 6.6 Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@nyhirako.example` | `Admin123!` |
| Modérateur | `moderateur@nyhirako.example` | `Moderateur123!` |

Les visiteurs n'ont pas de compte : ils consultent le répertoire et soumettent des œuvres. Ces identifiants servent uniquement à la démonstration.

### 6.7 Œuvres de démonstration

Les œuvres du jeu de données ont des identifiants UUID fixes : leurs adresses sont donc les mêmes après chaque rechargement du seed.

| Œuvre | Statut | Adresse |
|---|---|---|
| Tanindrazako | Validée | `/oeuvres/01036840-40db-4276-bf5e-c4a857badb3e` |
| Ny Lanitra Manga | Validée | `/oeuvres/2aa54d3f-9654-4100-b80e-bb3f33606271` |
| Mandihiza Ianao | Validée | `/oeuvres/37e4f819-c044-4bb2-8743-78a40fc3103b` |
| Fitiavana Mandrakizay | Validée | `/oeuvres/715bcca7-387b-4813-8d39-b4df487b3c05` |
| Hira ho an'ny Ray aman-dreny | Validée | `/oeuvres/1a60bfe3-2d4a-461d-bb97-ac61744e7ed5` |
| Sakafo Gasy | Validée | `/oeuvres/271565b5-42ab-49dc-899b-eefb160e9ce6` |
| Alina Mamirapiratra | En attente | `/oeuvres/f9a08ab6-8414-49b2-98f7-ba30fff802d1` |
| Rano Mangatsiaka | Rejetée | `/oeuvres/e5d7cdda-e6e3-43b9-99db-f0e08b51fa58` |

Seules les œuvres validées sont accessibles par leur adresse publique ; les deux autres sont visibles dans l'espace de gestion (`/gestion/oeuvres/<identifiant>`).

### 6.8 Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `connection refused` ou `ECONNREFUSED` sur le port 5432 | PostgreSQL n'est pas démarré | `sudo systemctl start postgresql`, puis `pg_lsclusters` ou `systemctl status postgresql` |
| `password authentication failed` | La base exige un mot de passe | Renseigner `utilisateur:motdepasse@` dans `DATABASE_URL` |
| `Variable d'environnement manquante : JWT_SECRET` | Le fichier `.env` n'existe pas ou est incomplet | `cp .env.example .env` puis renseigner `JWT_SECRET` |
| `permission denied to create extension "pgcrypto"` | Droits insuffisants | Lancer `schema.sql` avec un utilisateur propriétaire de la base ou administrateur |
| `function gen_random_uuid() does not exist` | PostgreSQL antérieur à la version 13 | Installer PostgreSQL 13 ou plus |
| `node: bad option: --env-file` | Node.js trop ancien | Installer Node.js 20.6 ou plus |
| `EADDRINUSE` (port 3000 déjà utilisé) | Un autre programme occupe le port | Changer `PORT` dans `.env` et la cible du proxy dans `frontend/vite.config.js` |
| Le site affiche « Impossible de joindre l'API » | L'API n'est pas lancée | Démarrer `npm run dev` dans `backend/` |
| Les accents s'affichent mal dans `psql` | Encodage du terminal | `export PGCLIENTENCODING=UTF8` avant de lancer les scripts |

### 6.9 Structure du dépôt

```
ny-hirako/
├── README.md
├── .gitignore
├── db/
│   ├── schema.sql             # création de la base : types, tables, contraintes, triggers, fonctions
│   ├── seed.sql               # données d'exemple fictives
│   └── migrations/            # modifications à appliquer sur une base existante
├── backend/                   # API REST (Express)
│   ├── .env.example           # modèle de configuration
│   ├── src/
│   │   ├── index.js, app.js, config.js, db.js
│   │   ├── middleware/        # authentification JWT, gestion des erreurs
│   │   ├── routes/            # auth, oeuvres, personnes, roles, diffuseurs, diffusions, droits
│   │   └── utils/             # validation des données reçues
│   └── tests/                 # tests automatisés de la validation
├── frontend/                  # site (Vue 3 + Vite)
│   ├── vite.config.js         # proxy /api vers l'API
│   ├── src/
│   │   ├── api/               # client HTTP (jeton JWT, erreurs)
│   │   ├── config/            # informations du site (pied de page)
│   │   ├── composables/       # état partagé (connexion, statistiques)
│   │   ├── router/            # routes et protection des pages
│   │   ├── layouts/           # mise en page de l'espace de gestion
│   │   ├── views/             # pages (publiques et de gestion)
│   │   ├── components/        # composants réutilisables
│   │   └── utils/             # logique métier (calcul des droits, validation des formulaires)
│   └── tests/                 # tests automatisés de la logique métier
└── docs/
    └── captures/              # captures d'écran utilisées dans ce README
```

## 7. Captures d'écran

Les captures correspondent au jeu de données d'exemple (section 6.3) et au scénario de la [section 8](#8-tests-et-démonstration).

### Espace public

![Répertoire des œuvres : recherche par titre, ayant droit, genre ou année](docs/captures/01-repertoire.png)
*Répertoire des œuvres : recherche par titre, ayant droit, genre ou année*

![Fiche d'une œuvre : répartition des droits entre ses ayants droit](docs/captures/02-fiche-oeuvre.png)
*Fiche d'une œuvre : répartition des droits entre ses ayants droit*

![Formulaire de soumission : jauge de répartition indiquant que la somme des parts atteint 100 %](docs/captures/03-soumission.png)
*Formulaire de soumission : jauge de répartition indiquant que la somme des parts atteint 100 %*

![Connexion réservée aux modérateurs et administrateurs](docs/captures/04-connexion.png)
*Connexion réservée aux modérateurs et administrateurs*

### Espace de gestion (modérateurs et administrateurs)

![Tableau de bord : chiffres clés et éléments à traiter](docs/captures/05-tableau-de-bord.png)
*Tableau de bord : chiffres clés et éléments à traiter*

![Modération : œuvres en attente de validation](docs/captures/06-moderation-oeuvres.png)
*Modération : œuvres en attente de validation*

![Une œuvre ne peut pas être validée tant que ses ayants droit ne le sont pas (règle appliquée par la base)](docs/captures/07-validation-refusee.png)
*Une œuvre ne peut pas être validée tant que ses ayants droit ne le sont pas (règle appliquée par la base)*

![Modification d'une œuvre et de la répartition de ses parts](docs/captures/08-modification-oeuvre.png)
*Modification d'une œuvre et de la répartition de ses parts*

### Administration (argent)

![Gestion des diffuseurs](docs/captures/09-diffuseurs.png)
*Gestion des diffuseurs*

![Nouvelle diffusion : aperçu de la répartition avant enregistrement](docs/captures/10-nouvelle-diffusion.png)
*Nouvelle diffusion : aperçu de la répartition avant enregistrement*

![Détail d'une diffusion : droits versés à chaque ayant droit](docs/captures/11-detail-diffusion.png)
*Détail d'une diffusion : droits versés à chaque ayant droit*

![Classement des ayants droit par droits perçus](docs/captures/12-droits.png)
*Classement des ayants droit par droits perçus*

### Affichage sur téléphone

![Interface adaptée aux petits écrans (menu en tiroir)](docs/captures/13-mobile.png)
*Interface adaptée aux petits écrans (menu en tiroir)*

## 8. Tests et démonstration

### 8.1 Tests automatisés

Ils vérifient la logique métier sans avoir besoin de la base ni du navigateur : validation des données reçues (montants, parts, identifiants), calcul de la répartition des droits (même règle d'arrondi que la base), validation et construction des requêtes des formulaires.

```bash
cd backend && npm test     # 41 tests : validation des données de l'API
cd frontend && npm test    # 83 tests : calcul des droits, formulaires de soumission et de modification
```

Ils utilisent l'exécuteur de tests intégré à Node.js : aucune dépendance supplémentaire.

### 8.2 Scénario de démonstration

À faire sur une base fraîchement initialisée (`schema.sql` puis `seed.sql`), API et site démarrés. Chaque étape indique le résultat attendu.

#### A. Visiteur (sans connexion)

1. **Rechercher.** Sur l'accueil, 6 œuvres sont listées. Taper `hery` : *Tanindrazako* et *Fitiavana Mandrakizay* apparaissent (retrouvées grâce au nom d'artiste). Genre `salegy` : *Ny Lanitra Manga* et *Sakafo Gasy*. Année `2018` : *Tanindrazako*.
2. **Consulter.** Ouvrir *Ny Lanitra Manga* : Njaka Gasy (auteur 25 % et compositeur 35 %), Fenitra Zaza (arrangeur 10 %), Maso Music Édition (éditeur 30 %).
3. **Ajouter (soumettre).** Menu « Soumettre une œuvre » : titre `Mamelombelona`, genre `Salegy`, email de contact. Ligne *Auteur* : onglet « Nouvelle personne », `Rakoto` / `Jean`, part `30`. Ligne *Compositeur* : rechercher `hery`, choisir *Hery Mora*, part `60`.
   - La jauge indique **90 %** (« il reste 10 % ») et l'envoi est refusé avec le total actuel.
   - Corriger la part de Rakoto Jean à `40` : la jauge devient verte, l'envoi réussit et une confirmation s'affiche. L'œuvre n'apparaît pas encore dans le répertoire public.

#### B. Modérateur — `moderateur@nyhirako.example`

4. **Tableau de bord.** 2 œuvres en attente (*Alina Mamirapiratra*, *Mamelombelona*) et 2 ayants droit en attente (*Hanta Rasoanaivo*, *Rakoto Jean*). Pas de cartes d'argent, pas de section « Administration ».
5. **Règle de validation.** Ouvrir *Mamelombelona* et cliquer sur « Valider l'œuvre » : **refusé**, car un ayant droit n'est pas validé (trigger de la base).
6. **Valider.** Cliquer sur « Valider tous les ayants droit en attente », puis « Valider l'œuvre » : statut *Validée*. Le répertoire public liste maintenant 7 œuvres.
7. **Modifier.** Sur la fiche, « Modifier » : changer le genre en `Salegy moderne` et enregistrer. Cocher « Modifier aussi les ayants droit », passer les parts à 70 / 30, enregistrer : accepté (aucune diffusion n'existe encore pour cette œuvre).
8. **Intégrité référentielle.** Sur la fiche de *Tanindrazako*, « Supprimer » : **refusé**, l'œuvre a déjà été diffusée. La suppression de *Mamelombelona* est en revanche possible.
9. **Contrôle d'accès.** Aller à `/gestion/diffusions` : redirection vers le tableau de bord. (Côté API, la même route renvoie 403.)

#### C. Administrateur — `admin@nyhirako.example`

10. **Diffuseurs.** Créer `Radio Test` (type Radio, Antananarivo) : accepté. La recréer à l'identique : **refusé** (unicité nom + ville). Supprimer *Radio Fanasina FM* : **refusé** (elle a des diffusions).
11. **Diffusion et répartition.** « Nouvelle diffusion » : œuvre *Tanindrazako*, diffuseur *Radio Fanasina FM*, montant `200000`. L'**aperçu** annonce 80 000 Ar (Voahangy Soa) / 80 000 Ar (Hery Mora) / 40 000 Ar (Éditions Ravinala). Enregistrer : la fiche de la diffusion affiche les mêmes montants et un écart de 0.
12. **Œuvre non validée.** La recherche d'œuvre du formulaire ne propose que des œuvres validées (taper `Alina` : aucun résultat). La base refuse aussi ce cas (voir la commande `curl` ci-dessous).
13. **Droits perçus.** Le classement liste les ayants droit par total ; ouvrir *Hery Mora* : la diffusion du test y figure avec 80 000 Ar.
14. **Recalcul.** Modifier le montant de la diffusion à `250000` : la répartition devient 100 000 / 100 000 / 50 000.
15. **Suppression.** Supprimer la diffusion : elle disparaît du détail de Hery et du classement.

Pour l'étape 12 côté API (le jeton `$TOKEN` s'obtient comme en [section 9](#9-référence-de-lapi)) :

```bash
curl -X POST http://localhost:3000/api/gestion/diffusions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id_oeuvre": "f9a08ab6-8414-49b2-98f7-ba30fff802d1", "id_diffuseur": 1, "date_diffusion": "2026-11-20", "montant_total": 100000}'
# -> 422 : « L'œuvre de la diffusion … n'est pas validée : répartition impossible », rien n'est créé
```

### 8.3 Vérifier la base et ses contraintes en SQL

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

## 9. Référence de l'API

Toutes les routes sont préfixées par `/api`. Les routes `/api/gestion/...` exigent un jeton de connexion (`Authorization: Bearer <jeton>`).

### Authentification

```bash
# L'API et la base répondent
curl http://localhost:3000/api/health

# Connexion : le jeton est rangé dans $TOKEN (Node est déjà installé, pas besoin de jq)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nyhirako.example","password":"Admin123!"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Utilisateur connecté
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
```

Les exemples des sous-sections suivantes utilisent `$TOKEN`.

### Routes des œuvres

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/oeuvres?q=&genre=&annee=&page=&limit=` | Public | Recherche dans les œuvres **validées** (par titre ou par nom d'ayant droit) |
| GET | `/api/oeuvres/:id` | Public | Détail d'une œuvre validée avec ses contributions (`:id` est un UUID) |
| POST | `/api/oeuvres` | Public | Formulaire de soumission : crée l'œuvre en `EN_ATTENTE` |
| GET | `/api/gestion/oeuvres?statut=&q=` | Modérateur / Admin | Liste de toutes les œuvres, tous statuts |
| GET | `/api/gestion/oeuvres/:id` | Modérateur / Admin | Détail avec les informations de soumission, le statut, le type et le rôle de chaque ayant droit |
| POST | `/api/gestion/oeuvres` | Modérateur / Admin | Création directe |
| PUT | `/api/gestion/oeuvres/:id` | Modérateur / Admin | Modification (les contributions sont remplacées si elles sont fournies) |
| PATCH | `/api/gestion/oeuvres/:id/statut` | Modérateur / Admin | Validation ou rejet : `{"statut": "VALIDE"}` |
| DELETE | `/api/gestion/oeuvres/:id` | Modérateur / Admin | Suppression (refusée si l'œuvre a des diffusions) |

Une soumission peut référencer un ayant droit existant (`id_personne`) ou en créer un nouveau (`nouvelle_personne`), qui reste `EN_ATTENTE` jusqu'à sa validation.

```bash
# Recherche publique
curl "http://localhost:3000/api/oeuvres?q=salegy"
curl "http://localhost:3000/api/oeuvres?q=hery"

# Soumission publique (un ayant droit existant + un nouveau)
curl -X POST http://localhost:3000/api/oeuvres \
  -H "Content-Type: application/json" \
  -d '{
    "titre": "Mamelombelona", "genre": "Salegy", "annee_creation": 2025,
    "duree_sec": 210, "soumetteur_email": "test@example.com",
    "contributions": [
      {"id_personne": 1, "id_role": 2, "part_pct": 60},
      {"nouvelle_personne": {"type": "PHYSIQUE", "nom": "Rakoto", "prenom": "Jean"}, "id_role": 1, "part_pct": 40}
    ]
  }'

# Modération (avec le jeton obtenu au login dans $TOKEN)
curl "http://localhost:3000/api/gestion/oeuvres?statut=EN_ATTENTE" -H "Authorization: Bearer $TOKEN"
# <id_oeuvre> est l'identifiant renvoyé par la soumission ci-dessus
curl -X PATCH http://localhost:3000/api/gestion/oeuvres/<id_oeuvre>/statut \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"statut": "VALIDE"}'
```

La dernière commande est refusée (422) tant que l'ayant droit « Rakoto Jean » n'a pas été validé : c'est la règle appliquée par le trigger `trg_valider_oeuvre`.

### Routes des personnes et des rôles

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/roles` | Public | Liste des rôles (pour le formulaire de soumission) |
| GET | `/api/personnes?q=&type=&ville=&page=&limit=` | Public | Recherche parmi les ayants droit **validés** (sans email, téléphone ni date de naissance) |
| GET | `/api/personnes/:id` | Public | Fiche d'un ayant droit avec ses œuvres validées |
| GET | `/api/gestion/personnes?statut=&q=&type=` | Modérateur / Admin | Liste de tous les ayants droit, tous statuts |
| GET | `/api/gestion/personnes/:id` | Modérateur / Admin | Fiche complète avec coordonnées et toutes les œuvres |
| POST | `/api/gestion/personnes` | Modérateur / Admin | Création (statut `VALIDE` directement) |
| PUT | `/api/gestion/personnes/:id` | Modérateur / Admin | Modification |
| PATCH | `/api/gestion/personnes/:id/statut` | Modérateur / Admin | Validation ou rejet : `{"statut": "VALIDE"}` |
| DELETE | `/api/gestion/personnes/:id` | Modérateur / Admin | Suppression (refusée si la personne a des contributions) |

```bash
# Rôles et recherche publique
curl http://localhost:3000/api/roles
curl "http://localhost:3000/api/personnes?q=njaka"
curl http://localhost:3000/api/personnes/1

# Modération : ayants droit en attente, puis validation
curl "http://localhost:3000/api/gestion/personnes?statut=EN_ATTENTE" -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:3000/api/gestion/personnes/12/statut \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"statut": "VALIDE"}'
```

Pour une base déjà créée avant l'ajout des règles sur les ayants droit : `psql -d nyhirako -f db/migrations/001_regles_personnes.sql`.

### Routes des diffuseurs, diffusions et droits (administrateurs)

| Méthode | Route | Description |
|---|---|---|
| GET / POST | `/api/gestion/diffuseurs` | Liste (`q`, `type`, `ville`) et création |
| GET / PUT / DELETE | `/api/gestion/diffuseurs/:id` | Fiche, modification, suppression (refusée s'il a des diffusions) |
| GET | `/api/gestion/diffusions?id_oeuvre=&id_diffuseur=&date_debut=&date_fin=` | Liste filtrée des diffusions |
| POST | `/api/gestion/diffusions` | Enregistre une diffusion **et calcule la répartition** des droits |
| GET | `/api/gestion/diffusions/:id` | Diffusion avec le détail de sa répartition |
| PUT | `/api/gestion/diffusions/:id` | Modifie diffuseur, date ou montant, puis recalcule la répartition |
| POST | `/api/gestion/diffusions/:id/repartition` | Recalcule la répartition |
| DELETE | `/api/gestion/diffusions/:id` | Supprime la diffusion et sa répartition |
| GET | `/api/gestion/droits/personnes?q=` | Classement des ayants droit par total de droits perçus |
| GET | `/api/gestion/droits/personnes/:id` | Détail des droits d'un ayant droit, diffusion par diffusion |
| GET | `/api/gestion/statistiques` | Chiffres du tableau de bord (modérateurs et admins ; les montants sont réservés aux admins) |

Création d'une diffusion :

```mermaid
sequenceDiagram
    participant A as Administrateur
    participant API as API Express
    participant DB as PostgreSQL
    A->>API: POST /api/gestion/diffusions
    API->>DB: BEGIN
    API->>DB: INSERT INTO diffusion
    API->>DB: SELECT calculer_repartition(id)
    Note over DB: montant = montant_total x part_pct / 100<br/>refus si l'œuvre n'est pas validée
    API->>DB: COMMIT
    API-->>A: 201 diffusion + répartition
```

```bash
# Diffuseurs et diffusions existants
curl http://localhost:3000/api/gestion/diffuseurs -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/api/gestion/diffusions?id_oeuvre=01036840-40db-4276-bf5e-c4a857badb3e" -H "Authorization: Bearer $TOKEN"

# Nouvelle diffusion de l'œuvre « Tanindrazako » : 200 000 Ar -> 80 000 / 80 000 / 40 000
curl -X POST http://localhost:3000/api/gestion/diffusions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id_oeuvre": "01036840-40db-4276-bf5e-c4a857badb3e", "id_diffuseur": 1, "date_diffusion": "2026-11-20", "montant_total": 200000}'

# Même chose pour « Alina Mamirapiratra », non validée : refusé (422), rien n'est créé
curl -X POST http://localhost:3000/api/gestion/diffusions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id_oeuvre": "f9a08ab6-8414-49b2-98f7-ba30fff802d1", "id_diffuseur": 1, "date_diffusion": "2026-11-20", "montant_total": 100000}'

# Classement des droits et détail pour un ayant droit
curl http://localhost:3000/api/gestion/droits/personnes -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/gestion/droits/personnes/1 -H "Authorization: Bearer $TOKEN"
```

Les montants sont exprimés en Ariary et renvoyés sous forme de chaînes (`"80000.00"`) pour éviter toute perte de précision.

### Gestion des erreurs

L'API traduit les erreurs PostgreSQL en codes HTTP :

| Erreur PostgreSQL | Code HTTP | Exemple |
|---|---|---|
| Violation d'unicité | 409 | Diffuseur déjà existant dans la même ville |
| Clé étrangère : élément encore utilisé | 409 | Suppression d'une œuvre déjà diffusée |
| Clé étrangère : référence inexistante | 422 | `id_diffuseur` qui n'existe pas |
| `CHECK` ou trigger | 422 | Somme des parts différente de 100 |
| Valeur invalide ou champ manquant | 400 | Statut inconnu |
