-- =====================================================================
-- ny-hirako : données d'exemple (toutes fictives)
-- Usage : psql -d nyhirako -f db/seed.sql   (après db/schema.sql)
-- Les personnes, titres et diffuseurs sont inventés. Les œuvres ont des identifiants UUID fixes
-- afin que les adresses de démonstration soient identiques après chaque rechargement.
-- Les mots de passe de démonstration sont hachés avec bcrypt (pgcrypto).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Utilisateurs de démonstration
--   admin@nyhirako.example        / Admin123!
--   moderateur@nyhirako.example   / Moderateur123!
-- ---------------------------------------------------------------------
INSERT INTO utilisateur (id_utilisateur, email, mot_de_passe_hash, role_utilisateur) VALUES
    (1, 'admin@nyhirako.example',      crypt('Admin123!',       gen_salt('bf', 10)), 'ADMIN'),
    (2, 'moderateur@nyhirako.example', crypt('Moderateur123!',  gen_salt('bf', 10)), 'MODERATEUR');

-- ---------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------
INSERT INTO role (id_role, libelle) VALUES
    (1, 'Auteur'),
    (2, 'Compositeur'),
    (3, 'Arrangeur'),
    (4, 'Éditeur');

-- ---------------------------------------------------------------------
-- Personnes (ayants droit)
-- ---------------------------------------------------------------------
INSERT INTO personne (id_personne, type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville, statut, id_valideur) VALUES
    (1,  'PHYSIQUE', 'Rakotoarisoa',    'Hery',     'Hery Mora',  '1984-03-12', '+261 34 00 111 01', 'hery@example.com',    'Antananarivo', 'VALIDE', 1),
    (2,  'PHYSIQUE', 'Razafindrasoa',   'Voahangy', 'Voahangy Soa','1990-07-25', '+261 34 00 111 02', 'voahangy@example.com','Antananarivo', 'VALIDE', 1),
    (3,  'PHYSIQUE', 'Randrianarisoa',  'Tiana',    NULL,         '1978-11-02', '+261 33 00 111 03', 'tiana@example.com',   'Toamasina',    'VALIDE', 1),
    (4,  'PHYSIQUE', 'Rasolofoniaina',  'Njaka',    'Njaka Gasy', '1992-01-19', '+261 32 00 111 04', 'njaka@example.com',   'Mahajanga',    'VALIDE', 2),
    (5,  'PHYSIQUE', 'Ravelonarivo',    'Lalaina',  'Lala Vola',  '1987-09-05', '+261 34 00 111 05', 'lalaina@example.com', 'Toliara',      'VALIDE', 2),
    (6,  'PHYSIQUE', 'Andrianjafy',     'Mamy',     NULL,         '1975-04-30', '+261 33 00 111 06', 'mamy@example.com',    'Fianarantsoa', 'VALIDE', 2),
    (7,  'PHYSIQUE', 'Rabemananjara',   'Fenitra',  'Fenitra Zaza','1995-12-14', '+261 32 00 111 07', 'fenitra@example.com', 'Antsirabe',    'VALIDE', 1),
    (8,  'PHYSIQUE', 'Ramanantsoa',     'Faly',     NULL,         '1969-06-08', '+261 34 00 111 08', 'faly@example.com',    'Antsiranana',  'VALIDE', 1),
    (9,  'MORALE',   'Éditions Ravinala', NULL,     NULL,         NULL,         '+261 20 22 000 09', 'contact@editions-ravinala.example', 'Antananarivo', 'VALIDE', 1),
    (10, 'MORALE',   'Maso Music Édition', NULL,    NULL,         NULL,         '+261 20 53 000 10', 'contact@maso-music.example',        'Toamasina',    'VALIDE', 2),
    -- Soumise via le formulaire public, pas encore validée
    (11, 'PHYSIQUE', 'Rasoanaivo',      'Hanta',    NULL,         '1998-02-21', NULL,                'hanta@example.com',   'Antananarivo', 'EN_ATTENTE', NULL);

-- ---------------------------------------------------------------------
-- Œuvres
-- ---------------------------------------------------------------------
INSERT INTO oeuvre (id_oeuvre, titre, annee_creation, genre, duree_sec, statut, soumetteur_email, date_soumission, id_valideur) VALUES
    ('01036840-40db-4276-bf5e-c4a857badb3e', 'Tanindrazako', 2018, 'Malagasy pop',   232, 'VALIDE', NULL,                '2026-01-05', 1),
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 'Ny Lanitra Manga', 2021, 'Salegy',         198, 'VALIDE', NULL,                '2026-01-05', 1),
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 'Mandihiza Ianao', 2019, 'Tsapiky',        245, 'VALIDE', NULL,                '2026-01-06', 2),
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 'Fitiavana Mandrakizay', 2016, 'Afindrafindrao', 260, 'VALIDE', NULL,                '2026-01-06', 2),
    ('1a60bfe3-2d4a-461d-bb97-ac61744e7ed5', 'Hira ho an''ny Ray aman-dreny', 2015, 'Hira gasy', 300, 'VALIDE', NULL,           '2026-01-07', 1),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 'Sakafo Gasy', 2022, 'Salegy',         187, 'VALIDE', NULL,                '2026-01-07', 2),
    -- Soumise via le formulaire public, en attente de modération
    ('f9a08ab6-8414-49b2-98f7-ba30fff802d1', 'Alina Mamirapiratra', 2024, 'Malagasy pop',   205, 'EN_ATTENTE', 'hanta@example.com', '2026-11-10', NULL),
    -- Soumission rejetée
    ('e5d7cdda-e6e3-43b9-99db-f0e08b51fa58', 'Rano Mangatsiaka', 2023, 'Beko',           176, 'REJETE', 'anonyme@example.com',   '2026-10-02', 2);

-- ---------------------------------------------------------------------
-- Contributions (la somme des parts vaut 100 pour chaque œuvre validée)
-- ---------------------------------------------------------------------
INSERT INTO contribution (id_oeuvre, id_personne, id_role, part_pct) VALUES
    -- 1 Tanindrazako
    ('01036840-40db-4276-bf5e-c4a857badb3e', 1, 2, 40.00),   -- Hery : compositeur
    ('01036840-40db-4276-bf5e-c4a857badb3e', 2, 1, 40.00),   -- Voahangy : auteur
    ('01036840-40db-4276-bf5e-c4a857badb3e', 9, 4, 20.00),   -- Éditions Ravinala : éditeur
    -- 2 Ny Lanitra Manga
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 4, 1, 25.00),   -- Njaka : auteur
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 4, 2, 35.00),   -- Njaka : compositeur (même personne, autre rôle)
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 7, 3, 10.00),   -- Fenitra : arrangeur
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 10, 4, 30.00),  -- Maso Music : éditeur
    -- 3 Mandihiza Ianao
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 5, 1, 30.00),
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 3, 2, 50.00),
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 10, 4, 20.00),
    -- 4 Fitiavana Mandrakizay
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 6, 1, 35.00),
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 1, 2, 35.00),
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 2, 3, 10.00),
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 9, 4, 20.00),
    -- 5 Hira ho an'ny Ray aman-dreny (sans éditeur)
    ('1a60bfe3-2d4a-461d-bb97-ac61744e7ed5', 8, 1, 50.00),
    ('1a60bfe3-2d4a-461d-bb97-ac61744e7ed5', 8, 2, 50.00),
    -- 6 Sakafo Gasy
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 3, 1, 20.00),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 7, 2, 40.00),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 4, 3, 10.00),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 10, 4, 30.00),
    -- 7 Alina Mamirapiratra (en attente : Hanta n'est pas encore validée)
    ('f9a08ab6-8414-49b2-98f7-ba30fff802d1', 11, 1, 50.00),
    ('f9a08ab6-8414-49b2-98f7-ba30fff802d1', 7, 2, 50.00);

-- ---------------------------------------------------------------------
-- Diffuseurs
-- ---------------------------------------------------------------------
INSERT INTO diffuseur (id_diffuseur, nom, type, ville) VALUES
    (1, 'Radio Fanasina FM',   'RADIO',     'Antananarivo'),
    (2, 'TV Tanindrazana',     'TV',        'Antananarivo'),
    (3, 'Radio Vahiny FM',     'RADIO',     'Nosy Be'),
    (4, 'Salle Ravinala',      'SALLE',     'Toamasina'),
    (5, 'Festival Tsiky Gasy', 'EVENEMENT', 'Mahajanga');

-- ---------------------------------------------------------------------
-- Diffusions (montants en Ariary)
-- ---------------------------------------------------------------------
INSERT INTO diffusion (id_oeuvre, id_diffuseur, date_diffusion, montant_total) VALUES
    ('01036840-40db-4276-bf5e-c4a857badb3e', 1, '2026-01-15',  120000.00),
    ('01036840-40db-4276-bf5e-c4a857badb3e', 2, '2026-02-03',  350000.00),
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 3, '2026-02-20',   90000.00),
    ('2aa54d3f-9654-4100-b80e-bb3f33606271', 5, '2026-07-12', 1500000.00),
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 1, '2026-03-08',  110000.00),
    ('37e4f819-c044-4bb2-8743-78a40fc3103b', 4, '2026-04-18',  600000.00),
    ('715bcca7-387b-4813-8d39-b4df487b3c05', 2, '2026-05-02',  400000.00),
    ('1a60bfe3-2d4a-461d-bb97-ac61744e7ed5', 5, '2026-07-12',  900000.00),
    ('1a60bfe3-2d4a-461d-bb97-ac61744e7ed5', 1, '2026-06-21',   95000.00),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 3, '2026-08-09',   85000.00),
    ('271565b5-42ab-49dc-899b-eefb160e9ce6', 4, '2026-09-27',  700000.00),
    ('01036840-40db-4276-bf5e-c4a857badb3e', 5, '2026-07-13', 1100000.00);

-- ---------------------------------------------------------------------
-- Répartition des droits pour chaque diffusion
-- ---------------------------------------------------------------------
SELECT calculer_repartition(id_diffusion) FROM diffusion ORDER BY id_diffusion;

-- ---------------------------------------------------------------------
-- Les identifiants ont été fournis explicitement : on resynchronise les séquences
-- ---------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('utilisateur', 'id_utilisateur'), (SELECT MAX(id_utilisateur) FROM utilisateur));
SELECT setval(pg_get_serial_sequence('role',        'id_role'),        (SELECT MAX(id_role)        FROM role));
SELECT setval(pg_get_serial_sequence('personne',    'id_personne'),    (SELECT MAX(id_personne)    FROM personne));
SELECT setval(pg_get_serial_sequence('diffuseur',   'id_diffuseur'),   (SELECT MAX(id_diffuseur)   FROM diffuseur));

COMMIT;
