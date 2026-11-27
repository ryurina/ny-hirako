# ny-hirako

> Gestion simplifiée des droits d'auteur pour les artistes malagasy.

*Projet final : Application web avec une base de données relationnelle*

Auteur : RANARISON Rina
Demo: https://ny-hirako.vercel.app/

![Demo](demo.png)

## Sommaire

1. [Problème et objectifs](#1-problème-et-objectifs)
2. [Modèle entité-association](#2-modèle-entité-association)
3. [Schéma relationnel et normalisation](#3-schéma-relationnel-et-normalisation)
4. [Acteurs et fonctionnalités](#4-acteurs-et-fonctionnalités)
5. [Technologies et justification](#5-technologies-et-justification)
6. [Installation et lancement](#6-installation-et-lancement)
7. [Captures d'écran](#7-captures-décran)
8. [Tests et démonstration](#8-tests-et-démonstration)
9. [Documentation complémentaire](#9-documentation-complémentaire)

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

## 2. Modèle entité-association

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

## 3. Schéma relationnel et normalisation

### 3.1 Schéma relationnel

Notation : **clé primaire** en gras, `#` pour les clés étrangères.

- **UTILISATEUR**(**id_utilisateur**, email, mot_de_passe_hash, role_utilisateur)
- **PERSONNE**(**id_personne**, type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville, statut, #id_valideur → UTILISATEUR)
- **ROLE**(**id_role**, libelle)
- **OEUVRE**(**id_oeuvre**, titre, annee_creation, genre, duree_sec, statut, soumetteur_email, date_soumission, #id_valideur → UTILISATEUR)
- **CONTRIBUTION**(**id_contribution**, #id_oeuvre → OEUVRE, #id_personne → PERSONNE, #id_role → ROLE, part_pct)
- **DIFFUSEUR**(**id_diffuseur**, nom, type, ville)
- **DIFFUSION**(**id_diffusion**, #id_oeuvre → OEUVRE, #id_diffuseur → DIFFUSEUR, date_diffusion, montant_total)
- **REPARTITION**(**#id_diffusion** → DIFFUSION, **#id_contribution** → CONTRIBUTION, montant)

### 3.2 Clés étrangères et règles de suppression

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

### 3.3 Dépendances fonctionnelles

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

### 3.4 Justification de la normalisation (jusqu'à BCNF)

- **1NF** : tous les attributs sont atomiques. Les rôles d'une personne ne sont pas stockés dans une liste mais dans CONTRIBUTION, une ligne par rôle.
- **2NF** : aucune dépendance partielle. Les seules clés composées sont celles de REPARTITION et la clé alternative de CONTRIBUTION, et dans les deux cas les attributs non-clés (`montant`, `part_pct`) dépendent de la clé entière.
- **3NF** : aucune dépendance transitive entre attributs non-clés. Les informations du diffuseur, de l'œuvre ou du rôle sont dans leurs propres tables et ne sont pas recopiées ailleurs.
- **BCNF** : pour chaque dépendance fonctionnelle non triviale du tableau 5.3, le membre gauche est une clé candidate (donc une super-clé) de sa relation.

**Ce qui violerait la BCNF** (et que le schéma évite) :

- Stocker `nom_diffuseur` et `ville_diffuseur` directement dans DIFFUSION créerait la dépendance id_diffuseur → nom, ville avec un déterminant qui n'est pas une clé de DIFFUSION. D'où la table DIFFUSEUR séparée.
- Stocker `libelle_role` dans CONTRIBUTION créerait id_role → libelle hors clé. D'où la table ROLE.
- Stocker à la fois `nom` et `email` du soumetteur dans OEUVRE créerait email → nom. D'où le seul attribut `soumetteur_email`.

### 3.5 Contraintes hors dépendances fonctionnelles

Certaines règles métier ne s'expriment pas par une dépendance fonctionnelle et sont donc appliquées par des `CHECK` ou des triggers PostgreSQL :

- `part_pct` entre 0 et 100 (`CHECK`).
- Somme des parts d'une œuvre égale à 100, vérifiée à la validation de l'œuvre (trigger).
- Seule une personne `MORALE` peut avoir le rôle Éditeur (trigger).
- Une œuvre validée ne peut contenir que des ayants droit validés, et une personne liée à une œuvre validée ne peut plus être rejetée (triggers).
- Une personne qui est éditeur d'une œuvre ne peut pas devenir une personne physique (trigger).
- Une ligne de REPARTITION doit référencer une contribution de la même œuvre que la diffusion (trigger). Le `montant` est dérivé de `montant_total × part_pct`, mais cette relation entre plusieurs tables n'est pas une dépendance fonctionnelle interne à REPARTITION, donc elle ne remet pas en cause la BCNF.

## 4. Acteurs et fonctionnalités

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

## 5. Technologies et justification

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
| `DATABASE_CA` | *Facultatif.* Certificat CA d'une base hébergée (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)) | aucun |
| `DATABASE_POOL_MAX` | *Facultatif.* Nombre maximal de connexions à la base | `10` |

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

Un tableau des problèmes courants (PostgreSQL non démarré, mot de passe refusé, port déjà utilisé, Node.js trop ancien…) avec leurs solutions est disponible dans [docs/DEPANNAGE.md](docs/DEPANNAGE.md).

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
    ├── captures/              # captures d'écran utilisées dans ce README
    ├── DEPANNAGE.md           # problèmes courants et solutions
    ├── DEPLOIEMENT.md         # publier une démonstration en ligne (facultatif)
    ├── TESTS-ET-DEMONSTRATION.md   # tests automatisés et scénario de démonstration complet
    └── API.md                 # référence des routes de l'API
```

## 7. Captures d'écran

Les captures correspondent au jeu de données d'exemple (section 6.3) et au scénario de la [section 8](#8-tests-et-démonstration) (version complète dans [docs/TESTS-ET-DEMONSTRATION.md](docs/TESTS-ET-DEMONSTRATION.md)).

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

### Tests automatisés

```bash
cd backend && npm test     # 41 tests : validation des données de l'API
cd frontend && npm test    # 83 tests : calcul des droits, formulaires de soumission et de modification
```

### Démonstration en bref

À faire sur une base fraîchement initialisée (`schema.sql` puis `seed.sql`), API et site démarrés.

| Étape | Rôle | Action | Résultat attendu |
|---|---|---|---|
| 1 | Visiteur | Rechercher `hery` sur l'accueil | *Tanindrazako* et *Fitiavana Mandrakizay* (retrouvées par le nom d'artiste) |
| 2 | Visiteur | Soumettre une œuvre dont les parts font 90 %, puis 100 % | Refus avec le total actuel, puis acceptation : l'œuvre est « en attente » |
| 3 | Modérateur | Valider l'œuvre soumise | Refusé tant que ses ayants droit ne sont pas validés (règle de la base) ; accepté ensuite, et l'œuvre devient publique |
| 4 | Modérateur | Supprimer *Tanindrazako* | Refusé : l'œuvre a déjà été diffusée (intégrité référentielle) |
| 5 | Administrateur | Créer deux fois le même diffuseur | Le second est refusé (unicité nom + ville) |
| 6 | Administrateur | Nouvelle diffusion de *Tanindrazako* à 200 000 Ar | Aperçu puis répartition : 80 000 / 80 000 / 40 000 Ar |
| 7 | Administrateur | Consulter les droits perçus de *Hery Mora* | La diffusion y figure avec 80 000 Ar |

Le scénario complet (15 étapes, avec le résultat attendu à chacune), l'appel à l'API qui prouve qu'une œuvre non validée ne peut pas être diffusée, et les vérifications SQL des contraintes sont dans [docs/TESTS-ET-DEMONSTRATION.md](docs/TESTS-ET-DEMONSTRATION.md).

## 9. Documentation complémentaire

| Document | Contenu |
|---|---|
| [docs/TESTS-ET-DEMONSTRATION.md](docs/TESTS-ET-DEMONSTRATION.md) | Tests automatisés, scénario de démonstration complet en 15 étapes, vérifications SQL |
| [docs/API.md](docs/API.md) | Référence de l'API : authentification, routes par ressource, codes d'erreur, exemples `curl` |
| [docs/DEPANNAGE.md](docs/DEPANNAGE.md) | Problèmes courants d'installation et de lancement, avec leurs solutions |
| [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) | *Facultatif* : publier une démonstration en ligne (PostgreSQL chez Aiven, API et site chez Vercel) |

---

**RANARISON Rina** (Mathématiques Appliquées - Calcul Numérique)
