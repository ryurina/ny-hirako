import { Router } from 'express';
import { query, transaction } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  Validateur,
  validerNouvellePersonne,
  idDepuisParams,
  pagination,
  motifLike,
} from '../utils/validation.js';

const STATUTS = ['EN_ATTENTE', 'VALIDE', 'REJETE'];

// ---------------------------------------------------------------------
// Requêtes de lecture
// ---------------------------------------------------------------------
const COLONNES_PUBLIQUES =
  'o.id_oeuvre, o.titre, o.code_iswc, o.annee_creation, o.genre, o.duree_sec, o.statut';
// Les modérateurs voient en plus les informations de soumission
const COLONNES_GESTION = `${COLONNES_PUBLIQUES}, o.soumetteur_email, o.date_soumission, o.id_valideur`;

const CONTRIBUTIONS_JSON = `
  COALESCE(
    json_agg(
      json_build_object(
        'id_contribution', c.id_contribution,
        'id_personne',     p.id_personne,
        'nom_affiche',     COALESCE(p.nom_artiste, TRIM(COALESCE(p.prenom, '') || ' ' || p.nom)),
        'role',            r.libelle,
        'part_pct',        c.part_pct
      ) ORDER BY r.id_role, c.id_contribution
    ) FILTER (WHERE c.id_contribution IS NOT NULL),
    '[]'::json
  ) AS contributions`;

const selectOeuvres = (gestion, where = '') => `
  SELECT ${gestion ? COLONNES_GESTION : COLONNES_PUBLIQUES}, ${CONTRIBUTIONS_JSON}
  FROM oeuvre o
  LEFT JOIN contribution c ON c.id_oeuvre = o.id_oeuvre
  LEFT JOIN personne p     ON p.id_personne = c.id_personne
  LEFT JOIN role r         ON r.id_role = c.id_role
  ${where}
  GROUP BY o.id_oeuvre`;

// Construit la clause WHERE (paramétrée) selon les filtres demandés
function construireFiltres({ q, genre, annee, statut }, { publicOnly }) {
  const conditions = [];
  const params = [];
  const ajouter = (valeur) => {
    params.push(valeur);
    return `$${params.length}`;
  };

  if (publicOnly) conditions.push(`o.statut = 'VALIDE'`);
  else if (statut) conditions.push(`o.statut = ${ajouter(statut)}`);

  if (q) {
    const motif = ajouter(motifLike(q));
    conditions.push(`(
      o.titre ILIKE ${motif}
      OR EXISTS (
        SELECT 1 FROM contribution c2
        JOIN personne p2 ON p2.id_personne = c2.id_personne
        WHERE c2.id_oeuvre = o.id_oeuvre
          AND (p2.nom ILIKE ${motif} OR p2.prenom ILIKE ${motif} OR p2.nom_artiste ILIKE ${motif})
      )
    )`);
  }
  if (genre) conditions.push(`o.genre ILIKE ${ajouter(motifLike(genre))}`);
  if (annee) conditions.push(`o.annee_creation = ${ajouter(annee)}`);

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

async function listerOeuvres(req, res, { gestion }) {
  const v = new Validateur();
  const filtres = {
    q: v.texte(req.query.q, 'q', { max: 100 }),
    genre: v.texte(req.query.genre, 'genre', { max: 80 }),
    annee: v.entier(req.query.annee, 'annee', { min: 1800, max: 2100 }),
    statut: gestion ? v.enumeration(req.query.statut, 'statut', STATUTS) : null,
  };
  v.lever();

  const { page, limit } = pagination(req.query);
  const { where, params } = construireFiltres(filtres, { publicOnly: !gestion });

  const { rows: comptage } = await query(`SELECT COUNT(*)::int AS n FROM oeuvre o ${where}`, params);
  const { rows } = await query(
    `${selectOeuvres(gestion, where)}
     ORDER BY o.titre, o.id_oeuvre
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );

  res.json({ data: rows, total: comptage[0].n, page, limit });
}

async function detailOeuvre(id, { gestion }) {
  const filtre = gestion ? 'WHERE o.id_oeuvre = $1' : `WHERE o.id_oeuvre = $1 AND o.statut = 'VALIDE'`;
  const { rows } = await query(selectOeuvres(gestion, filtre), [id]);
  if (!rows[0]) throw new HttpError(404, 'Œuvre introuvable');
  return rows[0];
}

// ---------------------------------------------------------------------
// Validation des données reçues
// ---------------------------------------------------------------------
function validerContributions(v, liste, { requis }) {
  if (liste === undefined || liste === null) {
    if (requis) v.erreur('contributions', 'au moins une contribution est obligatoire');
    return undefined;
  }
  if (!Array.isArray(liste) || liste.length === 0 || liste.length > 20) {
    v.erreur('contributions', 'une liste de 1 à 20 contributions est attendue');
    return undefined;
  }

  let sommeCentimes = 0;
  const resultat = liste.map((element, i) => {
    const champ = (nom) => `contributions[${i}].${nom}`;
    const item = element ?? {};
    const id_role = v.entier(item.id_role, champ('id_role'), { requis: true, min: 1 });
    const part_pct = v.pourcentage(item.part_pct, champ('part_pct'));

    let id_personne = null;
    let nouvelle_personne = null;
    if (item.id_personne !== undefined && item.id_personne !== null) {
      id_personne = v.entier(item.id_personne, champ('id_personne'), { min: 1 });
    } else if (item.nouvelle_personne && typeof item.nouvelle_personne === 'object') {
      nouvelle_personne = validerNouvellePersonne(v, item.nouvelle_personne, champ('nouvelle_personne'));
    } else {
      v.erreur(champ('id_personne'), 'id_personne ou nouvelle_personne obligatoire');
    }

    if (part_pct !== null) sommeCentimes += Math.round(part_pct * 100);
    return { id_role, part_pct, id_personne, nouvelle_personne };
  });

  if (v.erreurs.length === 0 && sommeCentimes !== 10000) {
    v.erreur('contributions', `la somme des parts doit valoir 100 (actuellement ${sommeCentimes / 100})`);
  }
  return resultat;
}

function validerOeuvre(corps, { creation, emailRequis = false }) {
  const v = new Validateur();
  const c = corps ?? {};
  const donnees = {
    titre: v.texte(c.titre, 'titre', { requis: true, max: 255 }),
    code_iswc: v.iswc(c.code_iswc, 'code_iswc'),
    annee_creation: v.entier(c.annee_creation, 'annee_creation', { min: 1800, max: 2100 }),
    genre: v.texte(c.genre, 'genre', { max: 80 }),
    duree_sec: v.entier(c.duree_sec, 'duree_sec', { min: 1 }),
  };
  if (creation) {
    donnees.soumetteur_email = v.email(c.soumetteur_email, 'soumetteur_email', { requis: emailRequis });
  }
  donnees.contributions = validerContributions(v, c.contributions, { requis: creation });
  v.lever();
  return donnees;
}

// ---------------------------------------------------------------------
// Écriture (toujours dans une transaction : la somme des parts est contrôlée au COMMIT)
// ---------------------------------------------------------------------
async function creerPersonne(client, p) {
  const { rows } = await client.query(
    `INSERT INTO personne (type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_personne`,
    [p.type, p.nom, p.prenom, p.nom_artiste, p.date_naissance, p.telephone, p.email, p.ville],
  );
  return rows[0].id_personne; // statut EN_ATTENTE par défaut : à valider par un modérateur
}

async function insererContributions(client, idOeuvre, contributions) {
  for (const c of contributions) {
    const idPersonne = c.id_personne ?? (await creerPersonne(client, c.nouvelle_personne));
    await client.query(
      `INSERT INTO contribution (id_oeuvre, id_personne, id_role, part_pct)
       VALUES ($1, $2, $3, $4)`,
      [idOeuvre, idPersonne, c.id_role, c.part_pct],
    );
  }
}

// Crée l'œuvre (statut EN_ATTENTE) avec ses contributions
function creerOeuvre(donnees) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO oeuvre (titre, code_iswc, annee_creation, genre, duree_sec, soumetteur_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_oeuvre`,
      [
        donnees.titre,
        donnees.code_iswc,
        donnees.annee_creation,
        donnees.genre,
        donnees.duree_sec,
        donnees.soumetteur_email,
      ],
    );
    const idOeuvre = rows[0].id_oeuvre;
    await insererContributions(client, idOeuvre, donnees.contributions);
    return idOeuvre;
  });
}

// ---------------------------------------------------------------------
// Routes publiques : /api/oeuvres
// ---------------------------------------------------------------------
export const oeuvresPubliques = Router();

// GET /api/oeuvres?q=&genre=&annee=&page=&limit=   (œuvres validées uniquement)
oeuvresPubliques.get(
  '/',
  asyncHandler((req, res) => listerOeuvres(req, res, { gestion: false })),
);

// GET /api/oeuvres/:id
oeuvresPubliques.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailOeuvre(idDepuisParams(req.params.id), { gestion: false }));
  }),
);

// POST /api/oeuvres : formulaire public de soumission (l'œuvre reste EN_ATTENTE)
oeuvresPubliques.post(
  '/',
  asyncHandler(async (req, res) => {
    const donnees = validerOeuvre(req.body, { creation: true, emailRequis: true });
    const id = await creerOeuvre(donnees);
    res.status(201).json({
      id_oeuvre: id,
      statut: 'EN_ATTENTE',
      message: 'Soumission enregistrée : elle sera examinée par un modérateur.',
    });
  }),
);

// ---------------------------------------------------------------------
// Routes de gestion (modérateurs et administrateurs) : /api/gestion/oeuvres
// ---------------------------------------------------------------------
export const oeuvresGestion = Router();
oeuvresGestion.use(requireAuth, requireRole('ADMIN', 'MODERATEUR'));

// GET /api/gestion/oeuvres?statut=EN_ATTENTE&q=...   (tous les statuts)
oeuvresGestion.get(
  '/',
  asyncHandler((req, res) => listerOeuvres(req, res, { gestion: true })),
);

oeuvresGestion.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailOeuvre(idDepuisParams(req.params.id), { gestion: true }));
  }),
);

// POST /api/gestion/oeuvres : création par un modérateur (email du soumetteur facultatif)
oeuvresGestion.post(
  '/',
  asyncHandler(async (req, res) => {
    const donnees = validerOeuvre(req.body, { creation: true, emailRequis: false });
    const id = await creerOeuvre(donnees);
    res.status(201).json(await detailOeuvre(id, { gestion: true }));
  }),
);

// PUT /api/gestion/oeuvres/:id : modifie l'œuvre ; si "contributions" est fourni, elles sont remplacées
oeuvresGestion.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const donnees = validerOeuvre(req.body, { creation: false });

    await transaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE oeuvre
         SET titre = $1, code_iswc = $2, annee_creation = $3, genre = $4, duree_sec = $5
         WHERE id_oeuvre = $6`,
        [donnees.titre, donnees.code_iswc, donnees.annee_creation, donnees.genre, donnees.duree_sec, id],
      );
      if (rowCount === 0) throw new HttpError(404, 'Œuvre introuvable');

      if (donnees.contributions) {
        // Refusé (409) si des droits ont déjà été répartis sur ces contributions
        await client.query('DELETE FROM contribution WHERE id_oeuvre = $1', [id]);
        await insererContributions(client, id, donnees.contributions);
      }
    });

    res.json(await detailOeuvre(id, { gestion: true }));
  }),
);

// PATCH /api/gestion/oeuvres/:id/statut  { statut: "VALIDE" | "REJETE" }
// Les règles de validation (somme = 100, ayants droit validés) sont appliquées par un trigger.
oeuvresGestion.patch(
  '/:id/statut',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const v = new Validateur();
    const statut = v.enumeration(req.body?.statut, 'statut', ['VALIDE', 'REJETE'], { requis: true });
    v.lever();

    const { rowCount } = await query(
      'UPDATE oeuvre SET statut = $1, id_valideur = $2 WHERE id_oeuvre = $3',
      [statut, req.user.id, id],
    );
    if (rowCount === 0) throw new HttpError(404, 'Œuvre introuvable');

    res.json(await detailOeuvre(id, { gestion: true }));
  }),
);

// DELETE /api/gestion/oeuvres/:id : refusé (409) si l'œuvre a des diffusions
oeuvresGestion.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM oeuvre WHERE id_oeuvre = $1', [
      idDepuisParams(req.params.id),
    ]);
    if (rowCount === 0) throw new HttpError(404, 'Œuvre introuvable');
    res.status(204).end();
  }),
);
