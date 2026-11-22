import { Router } from 'express';
import { query } from '../db.js';
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
const TYPES = ['PHYSIQUE', 'MORALE'];

// ---------------------------------------------------------------------
// Requêtes de lecture
// ---------------------------------------------------------------------
// Public : ni email, ni téléphone, ni date de naissance (données personnelles)
const COLONNES_PUBLIQUES = 'p.id_personne, p.type, p.nom, p.prenom, p.nom_artiste, p.ville';
const COLONNES_GESTION = `${COLONNES_PUBLIQUES}, p.date_naissance, p.telephone, p.email, p.statut, p.id_valideur`;

function selectPersonnes(gestion, where = '', { detail = false } = {}) {
  const listeOeuvres = detail
    ? `, COALESCE(
          json_agg(
            json_build_object(
              'id_oeuvre', o.id_oeuvre,
              'titre',     o.titre,
              'role',      r.libelle,
              'part_pct',  c.part_pct${gestion ? ",\n              'statut',    o.statut" : ''}
            ) ORDER BY o.titre, r.id_role
          ) FILTER (WHERE o.id_oeuvre IS NOT NULL),
          '[]'::json
        ) AS oeuvres`
    : '';

  // Côté public, seules les œuvres validées sont comptées et listées
  return `
    SELECT ${gestion ? COLONNES_GESTION : COLONNES_PUBLIQUES},
           COUNT(DISTINCT o.id_oeuvre)::int AS nb_oeuvres${listeOeuvres}
    FROM personne p
    LEFT JOIN contribution c ON c.id_personne = p.id_personne
    LEFT JOIN oeuvre o       ON o.id_oeuvre = c.id_oeuvre${gestion ? '' : " AND o.statut = 'VALIDE'"}
    LEFT JOIN role r         ON r.id_role = c.id_role
    ${where}
    GROUP BY p.id_personne`;
}

function construireFiltres({ q, type, ville, statut }, { publicOnly }) {
  const conditions = [];
  const params = [];
  const ajouter = (valeur) => {
    params.push(valeur);
    return `$${params.length}`;
  };

  if (publicOnly) conditions.push(`p.statut = 'VALIDE'`);
  else if (statut) conditions.push(`p.statut = ${ajouter(statut)}`);

  if (q) {
    const motif = ajouter(motifLike(q));
    conditions.push(`(p.nom ILIKE ${motif} OR p.prenom ILIKE ${motif} OR p.nom_artiste ILIKE ${motif})`);
  }
  if (type) conditions.push(`p.type = ${ajouter(type)}`);
  if (ville) conditions.push(`p.ville ILIKE ${ajouter(motifLike(ville))}`);

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

async function listerPersonnes(req, res, { gestion }) {
  const v = new Validateur();
  const filtres = {
    q: v.texte(req.query.q, 'q', { max: 100 }),
    type: v.enumeration(req.query.type, 'type', TYPES),
    ville: v.texte(req.query.ville, 'ville', { max: 100 }),
    statut: gestion ? v.enumeration(req.query.statut, 'statut', STATUTS) : null,
  };
  v.lever();

  const { page, limit } = pagination(req.query);
  const { where, params } = construireFiltres(filtres, { publicOnly: !gestion });

  const { rows: comptage } = await query(`SELECT COUNT(*)::int AS n FROM personne p ${where}`, params);
  const { rows } = await query(
    `${selectPersonnes(gestion, where)}
     ORDER BY lower(p.nom), p.id_personne
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );

  res.json({ data: rows, total: comptage[0].n, page, limit });
}

async function detailPersonne(id, { gestion }) {
  const filtre = gestion ? 'WHERE p.id_personne = $1' : `WHERE p.id_personne = $1 AND p.statut = 'VALIDE'`;
  const { rows } = await query(selectPersonnes(gestion, filtre, { detail: true }), [id]);
  if (!rows[0]) throw new HttpError(404, 'Personne introuvable');
  return rows[0];
}

function validerPersonne(corps) {
  const v = new Validateur();
  const donnees = validerNouvellePersonne(v, corps ?? {}, '');
  v.lever();
  return donnees;
}

const valeursPersonne = (d) => [
  d.type,
  d.nom,
  d.prenom,
  d.nom_artiste,
  d.date_naissance,
  d.telephone,
  d.email,
  d.ville,
];

// ---------------------------------------------------------------------
// Routes publiques : /api/personnes
// ---------------------------------------------------------------------
export const personnesPubliques = Router();

// GET /api/personnes?q=&type=&ville=&page=&limit=   (ayants droit validés uniquement)
personnesPubliques.get(
  '/',
  asyncHandler((req, res) => listerPersonnes(req, res, { gestion: false })),
);

// GET /api/personnes/:id : fiche avec les œuvres validées
personnesPubliques.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailPersonne(idDepuisParams(req.params.id), { gestion: false }));
  }),
);

// ---------------------------------------------------------------------
// Routes de gestion (modérateurs et administrateurs) : /api/gestion/personnes
// ---------------------------------------------------------------------
export const personnesGestion = Router();
personnesGestion.use(requireAuth, requireRole('ADMIN', 'MODERATEUR'));

// GET /api/gestion/personnes?statut=EN_ATTENTE&q=...
personnesGestion.get(
  '/',
  asyncHandler((req, res) => listerPersonnes(req, res, { gestion: true })),
);

personnesGestion.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailPersonne(idDepuisParams(req.params.id), { gestion: true }));
  }),
);

// POST /api/gestion/personnes : créée directement avec le statut VALIDE
// (un modérateur est de confiance ; les soumissions publiques passent par /api/oeuvres)
personnesGestion.post(
  '/',
  asyncHandler(async (req, res) => {
    const donnees = validerPersonne(req.body);
    const { rows } = await query(
      `INSERT INTO personne (type, nom, prenom, nom_artiste, date_naissance, telephone, email, ville, statut, id_valideur)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'VALIDE', $9)
       RETURNING id_personne`,
      [...valeursPersonne(donnees), req.user.id],
    );
    res.status(201).json(await detailPersonne(rows[0].id_personne, { gestion: true }));
  }),
);

// PUT /api/gestion/personnes/:id : modification complète des informations
personnesGestion.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const donnees = validerPersonne(req.body);
    const { rowCount } = await query(
      `UPDATE personne
       SET type = $1, nom = $2, prenom = $3, nom_artiste = $4,
           date_naissance = $5, telephone = $6, email = $7, ville = $8
       WHERE id_personne = $9`,
      [...valeursPersonne(donnees), id],
    );
    if (rowCount === 0) throw new HttpError(404, 'Personne introuvable');
    res.json(await detailPersonne(id, { gestion: true }));
  }),
);

// PATCH /api/gestion/personnes/:id/statut  { statut: "VALIDE" | "REJETE" }
personnesGestion.patch(
  '/:id/statut',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const v = new Validateur();
    const statut = v.enumeration(req.body?.statut, 'statut', ['VALIDE', 'REJETE'], { requis: true });
    v.lever();

    const { rowCount } = await query(
      'UPDATE personne SET statut = $1, id_valideur = $2 WHERE id_personne = $3',
      [statut, req.user.id, id],
    );
    if (rowCount === 0) throw new HttpError(404, 'Personne introuvable');
    res.json(await detailPersonne(id, { gestion: true }));
  }),
);

// DELETE /api/gestion/personnes/:id : refusé (409) si la personne a des contributions
personnesGestion.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM personne WHERE id_personne = $1', [
      idDepuisParams(req.params.id),
    ]);
    if (rowCount === 0) throw new HttpError(404, 'Personne introuvable');
    res.status(204).end();
  }),
);
